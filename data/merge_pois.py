#!/usr/bin/env python3
"""Merge per-region OpenStreetMap POI downloads into region-agnostic GeoJSON.

Reads the raw Overpass responses written by download_pois_from_osm.py
(one file per region and query) and writes one GeoJSON FeatureCollection
per POI type, with:

1) duplicates removed - region bounding boxes overlap, most notably
   bruckleitha / wien / noe-suedost around Vienna
2) the OSM tag soup flattened to the handful of fields popups need
3) a stable feature order, so repeated runs produce identical files
"""

import argparse
import json
import logging
from pathlib import Path

logFormatter = "%(asctime)s - %(levelname)s - %(message)s"
logging.basicConfig(format=logFormatter, level=logging.INFO)

# POI types that get one output file each. Transit is handled separately
# because it merges four Overpass queries into a single layer.
OSM_POI_TYPES = (
    "bicycleShop",
    "bicycleRepairStation",
    "bicyclePump",
    "bicycleTubeVending",
    "drinkingWater",
)

# access values that mean the public may not use this POI
BLOCKED_ACCESS = ("no", "private", "permit")


def osm_key(element):
    """Stable identity of an OSM element, e.g. 'node/123'."""
    return "{}/{}".format(element["type"], element["id"])


def element_coordinates(element):
    """Extract GeoJSON coordinates from an Overpass element.

    Nodes carry lat/lon directly; ways and relations carry 'center'
    because every query in download_pois_from_osm.py uses 'out center'.

    :returns [lon, lat] rounded to 5 decimals, or None if unusable
    """
    if "center" in element:
        latitude = element["center"].get("lat")
        longitude = element["center"].get("lon")
    else:
        latitude = element.get("lat")
        longitude = element.get("lon")

    if latitude is None or longitude is None:
        return None
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return None
    return [round(longitude, 5), round(latitude, 5)]


def is_accessible(element):
    """False for POIs the general public may not use."""
    access = element.get("tags", {}).get("access")
    return access not in BLOCKED_ACCESS


def deduplicate_by_osm_key(elements):
    """Keep the first occurrence of each OSM element.

    Region bounding boxes overlap, so the same element is downloaded once
    per covering region. Duplicates are harmless today because only one
    region is loaded at a time, but the rewrite loads all of them at once.
    """
    seen = set()
    unique = []
    for element in elements:
        key = osm_key(element)
        if key in seen:
            continue
        seen.add(key)
        unique.append(element)
    return unique


def format_address(tags):
    """Human readable address, or None if there is no street.

    Mirrors the format previously built in the browser
    (extractAddressFromTagSoup in radlkarte.js).
    """
    street = tags.get("addr:street")
    if not street:
        return None

    address = street
    housenumber = tags.get("addr:housenumber")
    if housenumber:
        address += " " + housenumber

    postcode = tags.get("addr:postcode")
    city = tags.get("addr:city")
    if postcode:
        address += ", " + postcode
        if city:
            address += " " + city
    elif city:
        address += ", " + city
    return address


def normalize_website(tags):
    """Website URL with a scheme, or None.

    OSM values frequently omit the scheme. https is assumed rather than
    http, because the map itself is served over https and browsers block
    or warn about mixed active content.
    """
    website = tags.get("website") or tags.get("contact:website")
    if not website:
        return None
    if not website.startswith("http"):
        website = "https://" + website
    return website


def parse_data_date(overpass_json):
    """Date of the OSM snapshot the data was cut from, e.g. '2026-08-01'."""
    timestamp = overpass_json.get("osm3s", {}).get("timestamp_osm_base")
    if not isinstance(timestamp, str):
        return None
    return timestamp.split("T")[0]


def extract_properties(element, data_date):
    """Flatten an element's tags to exactly the fields a popup needs.

    Keys with no value are omitted rather than set to null, to keep the
    output small - all of them are optional on the frontend anyway.
    """
    tags = element.get("tags", {})
    properties = {
        "osmType": element["type"],
        "osmId": element["id"],
    }
    optional = (
        ("dataDate", data_date),
        ("name", tags.get("name")),
        ("address", format_address(tags)),
        ("website", normalize_website(tags)),
        ("openingHours", tags.get("opening_hours")),
        ("phone", tags.get("phone") or tags.get("contact:phone")),
        ("operator", tags.get("operator")),
    )
    for key, value in optional:
        if value:
            properties[key] = value
    return properties


# (station query, line query) pairs that together form the transit layer
TRANSIT_SOURCES = (("subway", "subwayLines"), ("railway", "railwayLines"))


def index_lines_by_station(overpass_json):
    """Map station name -> {line ref: colour}.

    The 'convert' statements in the subwayLines / railwayLines queries emit
    one synthetic element per (route, stop) pair, so ids repeat by design
    and cannot be deduplicated. Aggregating by station name is what the
    browser did previously (loadStationName2Line2Colour).
    """
    stations = {}
    for element in overpass_json.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name")
        ref = tags.get("ref")
        if not name or not ref:
            continue
        stations.setdefault(name, {})[ref] = tags.get("colour")
    return stations


def build_transit_features(
    stations_json, lines_index, transit_type, data_date, seen_names
):
    """Build one feature per transit station.

    Stations are deduplicated by name, not by OSM id: Overpass returns one
    element per platform where several lines cross, and overlapping regions
    return the same station repeatedly. seen_names is shared between the
    subway and railway passes so a station served by both appears once,
    matching the previous browser behaviour.
    """
    features = []
    for element in stations_json.get("elements", []):
        name = element.get("tags", {}).get("name")
        if not name or name in seen_names:
            continue

        coordinates = element_coordinates(element)
        if coordinates is None:
            logging.warning("unusable coordinates for %s", osm_key(element))
            continue

        properties = extract_properties(element, data_date)
        properties["transitType"] = transit_type
        lines = lines_index.get(name, {})
        if lines:
            properties["lines"] = [
                {"ref": ref, "colour": lines[ref]} for ref in sorted(lines)
            ]

        seen_names.add(name)
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": coordinates},
                "properties": properties,
            }
        )
    return features


def _load_overpass_files(overpass_dir, data_name):
    """All of a query's per-region downloads, freshest snapshot first.

    Matching is exact on the suffix so that '*-subway.json' does not also
    pick up '*-subwayLines.json'.

    Order matters downstream: deduplication keeps the first occurrence of an
    element, so putting the freshest region first makes the freshest copy of a
    POI win, along with its dataDate. Regions are refreshed independently (see
    the pois:<region> scripts), so their snapshot dates routinely differ by
    weeks. Files without a parseable date sort last, and ties fall back to the
    filename so the output stays deterministic.

    :returns a list of (parsed json, data date) tuples
    """
    loaded = []
    for path in sorted(overpass_dir.glob("*-{}.json".format(data_name))):
        with open(path, encoding="utf-8") as file_pointer:
            try:
                overpass_json = json.load(file_pointer)
            except json.JSONDecodeError:
                logging.warning("%s is not valid json - skipping", path)
                continue
        loaded.append((overpass_json, parse_data_date(overpass_json), path.name))

    # two stable passes: filename ascending, then date descending. Python's sort
    # is stable, so equal dates keep filename order.
    loaded.sort(key=lambda item: item[2])
    loaded.sort(key=lambda item: item[1] or "", reverse=True)
    return [(overpass_json, data_date) for overpass_json, data_date, _ in loaded]


def merge_basic_poi_type(overpass_dir, poi_type):
    """Merge every region's download of one POI type into a FeatureCollection.

    :returns the FeatureCollection, or None if no source file existed at all.
        None and an empty FeatureCollection mean different things: the latter is
        a real answer ("we looked, there are none"), the former means we have no
        data to speak for this type and must not overwrite what is already there.
    """
    sources = _load_overpass_files(overpass_dir, poi_type)
    if not sources:
        logging.warning(
            "%s: no source file in '%s' - not writing anything for this type",
            poi_type,
            overpass_dir,
        )
        return None

    elements = []
    data_dates = {}
    for overpass_json, data_date in sources:
        for element in overpass_json.get("elements", []):
            elements.append(element)
            data_dates.setdefault(osm_key(element), data_date)

    features = []
    for element in deduplicate_by_osm_key(elements):
        if not is_accessible(element):
            continue
        coordinates = element_coordinates(element)
        if coordinates is None:
            logging.warning("unusable coordinates for %s", osm_key(element))
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": coordinates},
                "properties": extract_properties(
                    element, data_dates[osm_key(element)]
                ),
            }
        )

    features.sort(key=lambda f: (f["properties"]["osmType"], f["properties"]["osmId"]))
    logging.info("%s: %d feature(s) from %d element(s)", poi_type, len(features), len(elements))
    return {"type": "FeatureCollection", "features": features}


def merge_transit(overpass_dir):
    """Merge subway and railway stations into a single FeatureCollection.

    A missing subway download is normal - only wien has one - so this only
    reports "no data" when neither station query produced a file.

    :returns the FeatureCollection, or None if no station file existed at all.
    """
    features = []
    seen_names = set()
    station_files = 0
    for station_query, lines_query in TRANSIT_SOURCES:
        lines_index = {}
        for overpass_json, _ in _load_overpass_files(overpass_dir, lines_query):
            for name, lines in index_lines_by_station(overpass_json).items():
                lines_index.setdefault(name, {}).update(lines)

        stations = _load_overpass_files(overpass_dir, station_query)
        station_files += len(stations)
        for overpass_json, data_date in stations:
            features += build_transit_features(
                overpass_json, lines_index, station_query, data_date, seen_names
            )

    if station_files == 0:
        logging.warning(
            "transit: no source file in '%s' - not writing anything for this type",
            overpass_dir,
        )
        return None

    features.sort(key=lambda f: (f["properties"]["osmType"], f["properties"]["osmId"]))
    logging.info("transit: %d station(s)", len(features))
    return {"type": "FeatureCollection", "features": features}


def write_feature_collection(out_dir, name, collection):
    """Write one POI type to <out_dir>/<name>.geojson.

    Formatted like the network files (one feature per line) written by prepare_network.py: one

    :returns the path written
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "{}.geojson".format(name)
    features = collection["features"]
    with open(path, "w", encoding="utf-8") as file_pointer:
        file_pointer.write('{"type": "FeatureCollection", "features": [')
        for index, feature in enumerate(features):
            file_pointer.write(",\n" if index else "\n")
            file_pointer.write(
                json.dumps(feature, sort_keys=True, ensure_ascii=False)
            )
        file_pointer.write("]}\n" if not features else "\n]}\n")
    return path


def main(overpass_dir, out_dir):
    logging.info("merging Overpass data from '%s'", overpass_dir)
    if not overpass_dir.is_dir():
        logging.error("'%s' does not exist - run download_pois_from_osm.py first", overpass_dir)
        raise SystemExit(1)

    collections = [("transit", merge_transit(overpass_dir))]
    collections += [
        (poi_type, merge_basic_poi_type(overpass_dir, poi_type))
        for poi_type in OSM_POI_TYPES
    ]

    written = 0
    for name, collection in collections:
        # None means no source file existed. Writing an empty FeatureCollection
        # here would replace a previously good file with nothing, so a single
        # failed download would silently empty a POI layer on the live site.
        if collection is None:
            continue
        write_feature_collection(out_dir, name, collection)
        written += 1

    skipped = len(collections) - written
    if skipped:
        logging.warning(
            "%d of %d POI type(s) had no source data and were left untouched",
            skipped,
            len(collections),
        )
    logging.info("%d POI type(s) written to '%s'", written, out_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "in",
        type=Path,
        help="directory containing downloaded OpenStreetMap JSON files",
    )
    parser.add_argument(
        "out",
        type=Path,
        help="directory for the merged per-type GeoJSON files",
    )
    args = vars(parser.parse_args())
    main(args["in"], args["out"])
