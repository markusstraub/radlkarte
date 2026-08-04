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
