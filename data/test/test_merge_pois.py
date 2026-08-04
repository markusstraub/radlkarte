#!/usr/bin/env python3

"""
Run these unit tests with pytest from the repository root.
"""

import merge_pois


def test_osm_key_combines_type_and_id():
    assert merge_pois.osm_key({"type": "node", "id": 123}) == "node/123"
    assert merge_pois.osm_key({"type": "way", "id": 456}) == "way/456"


def test_node_coordinates_come_from_lat_lon():
    element = {"type": "node", "id": 1, "lat": 48.208, "lon": 16.372}
    assert merge_pois.element_coordinates(element) == [16.372, 48.208]


def test_way_coordinates_come_from_center():
    """All Overpass queries use 'out center', so ways carry a center."""
    element = {"type": "way", "id": 1, "center": {"lat": 48.208, "lon": 16.372}}
    assert merge_pois.element_coordinates(element) == [16.372, 48.208]


def test_coordinates_are_rounded_to_five_decimals():
    element = {"type": "node", "id": 1, "lat": 48.2081234567, "lon": 16.3721234567}
    assert merge_pois.element_coordinates(element) == [16.37212, 48.20812]


def test_missing_coordinates_return_none():
    assert merge_pois.element_coordinates({"type": "way", "id": 1}) is None


def test_out_of_range_coordinates_return_none():
    element = {"type": "node", "id": 1, "lat": 148.2, "lon": 16.3}
    assert merge_pois.element_coordinates(element) is None


def test_poi_without_access_tag_is_accessible():
    assert merge_pois.is_accessible({"type": "node", "id": 1}) is True
    assert merge_pois.is_accessible({"type": "node", "id": 1, "tags": {}}) is True


def test_public_access_values_are_accessible():
    element = {"type": "node", "id": 1, "tags": {"access": "yes"}}
    assert merge_pois.is_accessible(element) is True


def test_restricted_access_values_are_not_accessible():
    for value in ("no", "private", "permit"):
        element = {"type": "node", "id": 1, "tags": {"access": value}}
        assert merge_pois.is_accessible(element) is False, value
