#!/usr/bin/env python3
"""Radlkarte Network Preparation Script

This script deals with GeoJSON network files produced by JOSM,
i.e. a FeatureCollection with Points and LineStrings,
and serves these purposes:
1) reduce file size (for faster download)
2) calculate the bbox
3) stable feature order for minimum diffs after changes
   (JOSM unfortunately reorders the GeoJSON)
4) human explorable file (one feature per line)

For the latter point it adds unique ids to each feature and gracefully
handles duplicate and invalid ids.
"""
import json
import logging
import sys

logFormatter = "%(asctime)s - %(levelname)s - %(message)s"
logging.basicConfig(format=logFormatter, level=logging.INFO)

PROBLEM_ATTRIBUTES = ("dismount", "nocargo", "warning", "speed100")
VALID_PRIORITIES = ("0", "1", "2")
# non-problem point categories the map renders: key -> the only allowed value.
# Keep in sync with data/josm-radlkarte-style.mapcss, which visualises the same rules.
OTHER_POINT_CATEGORIES = {"swimming": "yes"}


def validate_point_properties(feature):
    """Check a Point feature's problem-marker attributes and other categories.

    Recognized keys are problem attributes (dismount, nocargo, warning, speed100),
    priority (optional), and other rendered categories such as swimming.

    A Point with NO recognized keys is valid (it may carry foreign tags or be a
    JOSM export artifact). A Point with recognized keys must have valid values.

    'priority' is optional: an absent priority means the point has not been
    reviewed yet and the frontend renders it with medium prominence. It is
    deliberately not filled in here, so that unreviewed points stay
    recognisable in JOSM.

    :returns a list of human readable problem descriptions (empty if valid)
    """
    properties = feature["properties"] if feature["properties"] else {}
    problems = []

    # Check problem attributes that are present
    for attribute in PROBLEM_ATTRIBUTES:
        if attribute in properties:
            if str(properties[attribute]) != "yes":
                problems.append(
                    "{}={} (only 'yes' is allowed)".format(attribute, properties[attribute])
                )

    # Check other point categories
    for key, expected_value in OTHER_POINT_CATEGORIES.items():
        if key in properties:
            if str(properties[key]) != expected_value:
                problems.append(
                    "{}={} (only '{}' is allowed)".format(key, properties[key], expected_value)
                )

    # Check priority if present
    if "priority" in properties and str(properties["priority"]) not in VALID_PRIORITIES:
        problems.append(
            "priority={} (allowed: {})".format(
                properties["priority"], ", ".join(VALID_PRIORITIES)
            )
        )

    return problems


def enforce_int_id_in_feature_properties(feature):
    if feature["properties"] is None:
        feature["properties"] = {}
    int_id = -1
    try:
        int_id = int(feature["properties"]["id"])
    except KeyError:
        logging.info("no id in {}".format(feature["properties"]))
    except ValueError:
        logging.info("invalid id in {}".format(feature["properties"]))
    feature["properties"]["id"] = int_id


def restrict_decimal_precision(geometry):
    tuples = None
    if geometry["type"] == "LineString":
        tuples = geometry["coordinates"]
    elif geometry["type"] == "Point":
        tuples = [geometry["coordinates"]]
    else:
        logging.warning("ignoring geometry type {}".format(geometry["type"]))

    for tuple in tuples:
        tuple[0] = float("{:.5f}".format(tuple[0]).rstrip("0").rstrip("."))
        tuple[1] = float("{:.5f}".format(tuple[1]).rstrip("0").rstrip("."))


def get_max_id(features):
    ids = [feature["properties"]["id"] for feature in features]
    return max(ids)


def get_features_with_duplicate_or_invalid_ids(features):
    seen_ids = set()
    bad_features = []
    for feature in features:
        id = feature["properties"]["id"]
        if id in seen_ids or id < 0:
            bad_features.append(feature)
        seen_ids.add(id)
    return bad_features


def set_new_ids(features, start_id):
    current_id = start_id
    for feature in features:
        feature["properties"]["id"] = current_id
        current_id += 1


def calc_bbox(features):
    """
    Simple bbox calculation, returns a list of min_lon, min_lat, max_lon, max_lat.

    Won't work for datasets crossing the 180th meridian.
    """
    min_lat = 90
    max_lat = -90
    min_lon = 180
    max_lon = -180
    for feature in features:
        geometry = feature["geometry"]
        tuples = None
        if geometry["type"] == "LineString":
            tuples = geometry["coordinates"]
        elif geometry["type"] == "Point":
            tuples = [geometry["coordinates"]]
        else:
            logging.warning("ignoring geometry type {}".format(geometry["type"]))
            continue

        lats = set()
        lons = set()
        for tuple in tuples:
            lats.add(tuple[1])
            lons.add(tuple[0])
        if min(lats) < min_lat:
            min_lat = min(lats)
        if max(lats) > max_lat:
            max_lat = max(lats)
        if min(lons) < min_lon:
            min_lon = min(lons)
        if max(lons) > max_lon:
            max_lon = max(lons)

    return [min_lon, min_lat, max_lon, max_lat]


def minimize(infile, outfile):
    data = None
    try:
        with open(infile, encoding=sys.getfilesystemencoding()) as json_file:
            data = json.load(json_file)
    except json.JSONDecodeError:
        logging.warning("{} is not a valid json file - skipping.".format(infile))
        return 0

    if "features" not in data:
        logging.warning("{} is not a valid geojson file - skipping.".format(infile))
        return 0

    features = data["features"]
    logging.info("{} features parsed from {}".format(len(features), infile))

    for feature in features:
        enforce_int_id_in_feature_properties(feature)
        restrict_decimal_precision(feature["geometry"])

    bad_features = get_features_with_duplicate_or_invalid_ids(features)
    max_id = max(1, get_max_id(features))
    logging.info("max id found was {}".format(max_id))
    set_new_ids(bad_features, max_id + 1)

    invalid_count = 0
    for feature in features:
        if feature["geometry"]["type"] != "Point":
            continue
        problems = validate_point_properties(feature)
        if problems:
            invalid_count += 1
            logging.warning(
                "point id {}: {}".format(
                    feature["properties"]["id"], "; ".join(problems)
                )
            )

    id_to_feature = {feature["properties"]["id"]: feature for feature in features}
    sorted_ids = sorted(id_to_feature.keys())
    bbox = calc_bbox(features)

    with open(outfile, "w") as json_file:
        json_file.write(
            f'{{"type": "FeatureCollection", "bbox": {bbox}, "features": [\n'
        )
        for id in sorted_ids[:-1]:
            json_file.write(json.dumps(id_to_feature[id], sort_keys=True, indent=None))
            json_file.write(",\n")
        json_file.write(
            json.dumps(id_to_feature[sorted_ids[-1]], sort_keys=True, indent=None)
        )
        json_file.write("]}")
    logging.info(
        "{} features ({} with new id) written to {}".format(
            len(sorted_ids), len(bad_features), outfile
        )
    )
    return invalid_count

if __name__ == "__main__":
    if len(sys.argv) > 1:
        invalid_total = 0
        for infile in sys.argv[1:]:
            invalid_total += minimize(infile, infile)
        if invalid_total > 0:
            logging.error(
                "{} point feature(s) have invalid attributes - see warnings above".format(
                    invalid_total
                )
            )
            sys.exit(1)
    else:
        print("Usage: one or more geojson files to be minimized in-place as arguments")
