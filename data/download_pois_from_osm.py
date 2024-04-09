#!/usr/bin/env python3
"""Download latest points of interest for each Radlkarte region from the OpenStreetMap Overpass API"""
import argparse
import json
import logging
import shutil
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

logFormatter = "%(asctime)s - %(levelname)s - %(message)s"
logging.basicConfig(format=logFormatter, level=logging.INFO)


# see https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

QUERY_TEMPLATE = """[out:json][timeout:120][bbox:{min_lat},{min_lon},{max_lat},{max_lon}];
{query}"""

QUERIES = {
    "subway": "nwr[railway=station][station=subway]; out center;",
    "subwayLines": """relation[type=route][route=subway] -> .subway_routes;
foreach .subway_routes -> .subway_route {
  node(r.subway_route:"stop") -> .stops;
  foreach .stops {
  	convert node
    	::id = id(),
        //::geom = center(geom()),
    	name = u(t["name"]),
        ref = subway_route.u(t["ref"]),
        colour = subway_route.u(t["colour"]);
        //:: = ::;
    out meta;
  }
}""",
    "railway": 'nwr[railway~"^station$|^halt$"][station!=subway][station!=miniature]; out center;',
    "railwayLines": """relation[type=route][route=train][ref~"^S"] -> .sbahn_routes;
foreach .sbahn_routes -> .sbahn_route {
  node(r.sbahn_route:"stop") -> .stops;
  foreach .stops {
  	convert node
    	::id = id(),
    	name = u(t["name"]),
        ref = sbahn_route.u(t["ref"]),
        colour = sbahn_route.u(t["colour"]);
    out meta;
  }
}""",
    "bicycleShop": """(
  nwr[shop=bicycle];
  nwr[shop=sports]["service:bicycle:retail"=yes];
  nwr[shop=sports]["service:bicycle:repair"=yes];
);
out center;""",
    "bicycleRepairStation": "nwr[amenity=bicycle_repair_station]; out center;",
    "bicyclePump": '(nwr[amenity=compressed_air]; nwr["service:bicycle:pump"=yes]; ); out center;',
    "bicycleTubeVending": "nwr[vending=bicycle_tube]; out center;",
    "drinkingWater": "(node[amenity=drinking_water]; nwr[drinking_water=yes];); out center;",
}


def get_regions_with_bboxes(radlkarte_dir):
    geojsons = radlkarte_dir.glob("*.geojson")
    regions = {region.stem.replace("radlkarte-", ""): region for region in geojsons}
    regions = {k: v for (k, v) in regions.items() if k not in ["rendertest", "example"]}
    return {k: _load_bbox_from_geojson(v) for (k, v) in regions.items()}


def _load_bbox_from_geojson(filename):
    """since geojson and overpass use different ordering of bbox values
    this method extracts a bbox to a dict"""
    with open(filename) as fp:
        geojson = json.load(fp)
    keys = ["min_lon", "min_lat", "max_lon", "max_lat"]
    return dict(zip(keys, geojson["bbox"]))


def download(query, filename):
    """Downloads data and writes it to the file iff the HTTP status code is 200.

    :returns http status code"""
    response = _download_from_endpoints(query)
    if response is None:
        return -1

    with open(filename, "wb") as fd:
        shutil.copyfileobj(response, fd)
    return response.code


def _download_from_endpoints(query):
    """try to download until we are successful (or we run out of endpoints)

    :returns an urllib.response.Response object with http status code 200 (or None)"""
    for endpoint in OVERPASS_ENDPOINTS:
        data = urlencode({"data": query})
        data = data.encode("ascii")
        request = Request(endpoint, data)

        try:
            response = urlopen(request)
        except URLError as e:
            if hasattr(e, "reason"):
                logging.warning(f"could not reach {endpoint}: {e.reason}")
            elif hasattr(e, "code"):
                logging.warning(
                    f"expected HTTP status code 200 but got {e.code} from {endpoint}"
                )
            continue

        if response.code != 200:
            logging.warning(
                f"expected HTTP status code 200 but got {e.code} from {endpoint}"
            )
            continue
        return response

    return None


def main(radlkarte_dir, out_dir, only_region, only_query):
    logging.info(f"loading regions from '{radlkarte_dir}'")
    regions = get_regions_with_bboxes(radlkarte_dir)
    logging.info(f"found {len(regions)} regions: {sorted(list(regions.keys()))}")
    if only_region != None:
        logging.info(f"Only downloading data for region: {only_region}")
    if only_query != None:
        logging.info(f"Only downloading data for query: {only_query}")
    logging.info(f"all output will be written to '{out_dir}'")
    out_dir.mkdir(parents=True, exist_ok=True)

    success_count = 0
    failed_datasets = []
    for region_name, bbox in regions.items():
        if only_region != None and only_region != region_name:
            continue
        for data_name, query in QUERIES.items():
            if only_query != None and only_query != data_name:
                continue
            if data_name.startswith("subway") and region_name != "wien":
                continue

            logging.info(f"downloading {data_name} data for {region_name}..")
            full_query = QUERY_TEMPLATE.format(query=query, **bbox)
            logging.debug(full_query)
            output_filename = out_dir / f"{region_name}-{data_name}.json"
            status_code = download(full_query, output_filename)
            if status_code == 200:
                success_count += 1
            else:
                logging.warning(f"failed with HTTP status code {status_code}")
                failed_datasets.append(f"{region_name}-{data_name}")

    if len(failed_datasets) == 0:
        logging.info(f"successfully downloaded all {success_count} data set(s)")
    else:
        logging.info(f"successfully downloaded {success_count} data set(s)")
        failed_str = "\n- ".join(failed_datasets)
        logging.warning(f"download failed for:\n- {failed_str}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "in",
        type=Path,
        help="directory containing radlkarte GeoJSON files",
    )
    parser.add_argument(
        "out",
        type=Path,
        help="directory for storage of downloaded OpenStreetMap JSON files",
    )
    parser.add_argument(
        "--only-region",
        metavar="NAME",
        type=str,
        help="only download data for a specific region",
    )
    parser.add_argument(
        "--only-query",
        metavar="NAME",
        type=str,
        help="only download data for a specific query",
    )
    args = vars(parser.parse_args())
    main(args["in"], args["out"], args["only_region"], args["only_query"])
