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


def node(id, **tags):
    return {"type": "node", "id": id, "lat": 48.2, "lon": 16.3, "tags": tags}


def test_deduplicate_keeps_distinct_elements():
    elements = [node(1), node(2), node(3)]
    assert len(merge_pois.deduplicate_by_osm_key(elements)) == 3


def test_deduplicate_collapses_the_same_element_from_two_regions():
    """bruckleitha, wien and noe-suedost overlap around Vienna."""
    wien = [node(1, name="Radgeschäft"), node(2)]
    bruckleitha = [node(1, name="Radgeschäft"), node(9)]
    merged = merge_pois.deduplicate_by_osm_key(wien + bruckleitha)
    assert [element["id"] for element in merged] == [1, 2, 9]


def test_deduplicate_distinguishes_types_with_the_same_id():
    """OSM ids are only unique per element type."""
    elements = [
        {"type": "node", "id": 1},
        {"type": "way", "id": 1},
        {"type": "relation", "id": 1},
    ]
    assert len(merge_pois.deduplicate_by_osm_key(elements)) == 3


def test_deduplicate_keeps_the_first_occurrence():
    elements = [node(1, name="first"), node(1, name="second")]
    merged = merge_pois.deduplicate_by_osm_key(elements)
    assert merged[0]["tags"]["name"] == "first"


def test_address_needs_a_street():
    assert merge_pois.format_address({"addr:city": "Wien"}) is None
    assert merge_pois.format_address({}) is None


def test_address_formats_street_and_housenumber():
    tags = {"addr:street": "Mariahilfer Straße", "addr:housenumber": "100"}
    assert merge_pois.format_address(tags) == "Mariahilfer Straße 100"


def test_address_formats_postcode_and_city():
    tags = {
        "addr:street": "Mariahilfer Straße",
        "addr:housenumber": "100",
        "addr:postcode": "1070",
        "addr:city": "Wien",
    }
    assert merge_pois.format_address(tags) == "Mariahilfer Straße 100, 1070 Wien"


def test_address_with_city_but_no_postcode():
    tags = {"addr:street": "Hauptstraße", "addr:city": "Linz"}
    assert merge_pois.format_address(tags) == "Hauptstraße, Linz"


def test_website_falls_back_to_contact_website():
    assert merge_pois.normalize_website({"contact:website": "https://a.at"}) == "https://a.at"


def test_website_prefers_website_over_contact_website():
    tags = {"website": "https://a.at", "contact:website": "https://b.at"}
    assert merge_pois.normalize_website(tags) == "https://a.at"


def test_website_without_scheme_gets_https():
    assert merge_pois.normalize_website({"website": "example.at"}) == "https://example.at"


def test_missing_website_is_none():
    assert merge_pois.normalize_website({}) is None


def test_data_date_is_the_date_part_of_the_overpass_timestamp():
    overpass = {"osm3s": {"timestamp_osm_base": "2026-08-01T20:14:37Z"}}
    assert merge_pois.parse_data_date(overpass) == "2026-08-01"


def test_data_date_is_none_when_absent_or_malformed():
    assert merge_pois.parse_data_date({}) is None
    assert merge_pois.parse_data_date({"osm3s": {}}) is None
    assert merge_pois.parse_data_date({"osm3s": {"timestamp_osm_base": 17}}) is None


def test_extract_properties_always_carries_osm_identity():
    properties = merge_pois.extract_properties(node(42), "2026-08-01")
    assert properties["osmType"] == "node"
    assert properties["osmId"] == 42
    assert properties["dataDate"] == "2026-08-01"


def test_extract_properties_omits_absent_fields():
    properties = merge_pois.extract_properties(node(42), None)
    assert set(properties) == {"osmType", "osmId"}


def test_extract_properties_collects_popup_fields():
    element = node(
        42,
        name="Radgeschäft",
        website="example.at",
        opening_hours="Mo-Fr 09:00-18:00",
        operator="Radlobby",
        **{"addr:street": "Hauptstraße", "contact:phone": "+43 1 234"},
    )
    properties = merge_pois.extract_properties(element, None)
    assert properties["name"] == "Radgeschäft"
    assert properties["website"] == "https://example.at"
    assert properties["openingHours"] == "Mo-Fr 09:00-18:00"
    assert properties["phone"] == "+43 1 234"
    assert properties["operator"] == "Radlobby"
    assert properties["address"] == "Hauptstraße"


def test_opening_hours_is_kept_raw():
    """The frontend evaluates 'open now' against the viewer's clock."""
    element = node(1, opening_hours="Mo-Sa 08:00-19:00; PH off")
    properties = merge_pois.extract_properties(element, None)
    assert properties["openingHours"] == "Mo-Sa 08:00-19:00; PH off"
