#!/usr/bin/env python3

"""
Run these unit tests with pytest from the repository root.
"""

import json

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


def line_element(name, ref, colour):
    """A synthetic element as produced by the 'convert' statements."""
    return {"type": "node", "id": 1, "tags": {"name": name, "ref": ref, "colour": colour}}


def station(id, name):
    return {"type": "node", "id": id, "lat": 48.2, "lon": 16.3, "tags": {"name": name}}


def test_index_lines_groups_refs_and_colours_by_station():
    overpass = {
        "elements": [
            line_element("Karlsplatz", "U1", "#E20613"),
            line_element("Karlsplatz", "U4", "#00963F"),
            line_element("Stephansplatz", "U1", "#E20613"),
        ]
    }
    index = merge_pois.index_lines_by_station(overpass)
    assert index["Karlsplatz"] == {"U1": "#E20613", "U4": "#00963F"}
    assert index["Stephansplatz"] == {"U1": "#E20613"}


def test_index_lines_ignores_elements_without_name_or_ref():
    overpass = {
        "elements": [
            {"type": "node", "id": 1, "tags": {"ref": "U1"}},
            {"type": "node", "id": 2, "tags": {"name": "Nirgendwo"}},
            {"type": "node", "id": 3, "tags": {}},
        ]
    }
    assert merge_pois.index_lines_by_station(overpass) == {}


def test_index_lines_tolerates_a_missing_colour():
    overpass = {"elements": [{"type": "node", "id": 1, "tags": {"name": "A", "ref": "S1"}}]}
    assert merge_pois.index_lines_by_station(overpass) == {"A": {"S1": None}}


def test_transit_features_carry_type_and_sorted_lines():
    stations = {"elements": [station(1, "Karlsplatz")]}
    index = {"Karlsplatz": {"U4": "#00963F", "U1": "#E20613"}}
    features = merge_pois.build_transit_features(stations, index, "subway", None, set())
    assert len(features) == 1
    properties = features[0]["properties"]
    assert properties["transitType"] == "subway"
    assert properties["lines"] == [
        {"ref": "U1", "colour": "#E20613"},
        {"ref": "U4", "colour": "#00963F"},
    ]
    assert features[0]["geometry"] == {"type": "Point", "coordinates": [16.3, 48.2]}


def test_transit_features_omit_lines_when_there_are_none():
    stations = {"elements": [station(1, "Kleinbahnhof")]}
    features = merge_pois.build_transit_features(stations, {}, "railway", None, set())
    assert "lines" not in features[0]["properties"]


def test_transit_stations_are_deduplicated_by_name():
    """Overpass returns one element per platform where lines cross."""
    stations = {"elements": [station(1, "Karlsplatz"), station(2, "Karlsplatz")]}
    features = merge_pois.build_transit_features(stations, {}, "subway", None, set())
    assert len(features) == 1


def test_transit_dedup_set_is_shared_across_subway_and_railway():
    """A station served by both must appear once, as it does today."""
    seen = set()
    subway = {"elements": [station(1, "Praterstern")]}
    railway = {"elements": [station(2, "Praterstern")]}
    features = merge_pois.build_transit_features(subway, {}, "subway", None, seen)
    features += merge_pois.build_transit_features(railway, {}, "railway", None, seen)
    assert len(features) == 1
    assert features[0]["properties"]["transitType"] == "subway"


def test_transit_skips_stations_without_a_name():
    stations = {"elements": [{"type": "node", "id": 1, "lat": 48.2, "lon": 16.3, "tags": {}}]}
    assert merge_pois.build_transit_features(stations, {}, "subway", None, set()) == []


def test_transit_skips_stations_with_unusable_coordinates():
    stations = {"elements": [{"type": "way", "id": 1, "tags": {"name": "Kaputt"}}]}
    assert merge_pois.build_transit_features(stations, {}, "railway", None, set()) == []


def write_overpass(directory, filename, elements, timestamp="2026-08-01T20:14:37Z"):
    payload = {"osm3s": {"timestamp_osm_base": timestamp}, "elements": elements}
    (directory / filename).write_text(json.dumps(payload), encoding="utf-8")


def test_merge_basic_poi_type_reads_every_region(tmp_path):
    write_overpass(tmp_path, "wien-drinkingWater.json", [node(1), node(2)])
    write_overpass(tmp_path, "linz-drinkingWater.json", [node(3)])
    collection = merge_pois.merge_basic_poi_type(tmp_path, "drinkingWater")
    assert collection["type"] == "FeatureCollection"
    assert len(collection["features"]) == 3


def test_merge_basic_poi_type_deduplicates_across_regions(tmp_path):
    write_overpass(tmp_path, "wien-drinkingWater.json", [node(1), node(2)])
    write_overpass(tmp_path, "bruckleitha-drinkingWater.json", [node(1)])
    collection = merge_pois.merge_basic_poi_type(tmp_path, "drinkingWater")
    assert len(collection["features"]) == 2


def test_merge_basic_poi_type_drops_inaccessible_pois(tmp_path):
    write_overpass(tmp_path, "wien-drinkingWater.json", [node(1), node(2, access="private")])
    collection = merge_pois.merge_basic_poi_type(tmp_path, "drinkingWater")
    assert len(collection["features"]) == 1
    assert collection["features"][0]["properties"]["osmId"] == 1


def test_merge_basic_poi_type_does_not_match_other_types(tmp_path):
    """'*-subway.json' must not pick up '*-subwayLines.json'."""
    write_overpass(tmp_path, "wien-subway.json", [node(1)])
    write_overpass(tmp_path, "wien-subwayLines.json", [node(2)])
    collection = merge_pois.merge_basic_poi_type(tmp_path, "subway")
    assert len(collection["features"]) == 1


def test_merge_basic_poi_type_output_is_sorted_by_osm_key(tmp_path):
    """Ids sort numerically, not as strings - 4 before 30."""
    write_overpass(tmp_path, "wien-drinkingWater.json", [node(30), node(4)])
    collection = merge_pois.merge_basic_poi_type(tmp_path, "drinkingWater")
    assert [f["properties"]["osmId"] for f in collection["features"]] == [4, 30]


def test_merge_transit_combines_subway_and_railway(tmp_path):
    write_overpass(tmp_path, "wien-subway.json", [station(1, "Karlsplatz")])
    write_overpass(tmp_path, "wien-subwayLines.json", [line_element("Karlsplatz", "U1", "#E20613")])
    write_overpass(tmp_path, "linz-railway.json", [station(2, "Linz Hbf")])
    write_overpass(tmp_path, "linz-railwayLines.json", [])
    collection = merge_pois.merge_transit(tmp_path)
    types = sorted(f["properties"]["transitType"] for f in collection["features"])
    assert types == ["railway", "subway"]


def test_merge_transit_tolerates_regions_without_subway(tmp_path):
    """download_pois_from_osm.py only downloads subway data for wien."""
    write_overpass(tmp_path, "linz-railway.json", [station(1, "Linz Hbf")])
    collection = merge_pois.merge_transit(tmp_path)
    assert len(collection["features"]) == 1


def test_write_feature_collection_is_deterministic(tmp_path):
    collection = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [16.3, 48.2]},
         "properties": {"osmId": 1, "osmType": "node", "name": "A"}}]}
    first = merge_pois.write_feature_collection(tmp_path, "drinkingWater", collection)
    content = first.read_bytes()
    merge_pois.write_feature_collection(tmp_path, "drinkingWater", collection)
    assert first.name == "drinkingWater.geojson"
    assert first.read_bytes() == content


def test_main_only_writes_types_that_have_source_data(tmp_path):
    """A type with no download must not be written at all.

    Writing an empty FeatureCollection would replace a previously good file, so
    one failed download would silently empty a POI layer.
    """
    overpass_dir = tmp_path / "overpass"
    overpass_dir.mkdir()
    write_overpass(overpass_dir, "wien-drinkingWater.json", [node(1)])
    out_dir = tmp_path / "poi"
    merge_pois.main(overpass_dir, out_dir)
    assert [path.name for path in out_dir.glob("*.geojson")] == ["drinkingWater.geojson"]


def test_main_leaves_an_existing_file_untouched_when_its_download_is_missing(tmp_path):
    overpass_dir = tmp_path / "overpass"
    overpass_dir.mkdir()
    write_overpass(overpass_dir, "wien-drinkingWater.json", [node(1)])
    out_dir = tmp_path / "poi"
    out_dir.mkdir()
    stale = out_dir / "bicycleShop.geojson"
    stale.write_text("PREVIOUS GOOD DATA", encoding="utf-8")

    merge_pois.main(overpass_dir, out_dir)

    assert stale.read_text(encoding="utf-8") == "PREVIOUS GOOD DATA"


def test_merge_returns_none_when_no_source_file_exists(tmp_path):
    assert merge_pois.merge_basic_poi_type(tmp_path, "bicyclePump") is None
    assert merge_pois.merge_transit(tmp_path) is None


def test_merge_returns_an_empty_collection_when_sources_hold_no_features(tmp_path):
    """Distinct from None: we looked, and there genuinely are none."""
    write_overpass(tmp_path, "wien-bicyclePump.json", [])
    assert merge_pois.merge_basic_poi_type(tmp_path, "bicyclePump") == {
        "type": "FeatureCollection",
        "features": [],
    }


def test_the_freshest_region_wins_a_duplicate(tmp_path):
    """Regions are refreshed independently, so their snapshots differ in age."""
    write_overpass(
        tmp_path, "wien-drinkingWater.json", [node(1, name="new")],
        timestamp="2026-08-04T10:00:00Z",
    )
    write_overpass(
        tmp_path, "bruckleitha-drinkingWater.json", [node(1, name="old")],
        timestamp="2026-07-02T10:00:00Z",
    )
    features = merge_pois.merge_basic_poi_type(tmp_path, "drinkingWater")["features"]
    assert len(features) == 1
    # wien is alphabetically last but has the fresher snapshot, so it must win
    assert features[0]["properties"]["name"] == "new"
    assert features[0]["properties"]["dataDate"] == "2026-08-04"


def test_a_file_without_a_date_loses_to_one_with_a_date(tmp_path):
    write_overpass(tmp_path, "aaa-drinkingWater.json", [node(1, name="undated")], timestamp=None)
    write_overpass(
        tmp_path, "zzz-drinkingWater.json", [node(1, name="dated")],
        timestamp="2026-07-02T10:00:00Z",
    )
    features = merge_pois.merge_basic_poi_type(tmp_path, "drinkingWater")["features"]
    assert features[0]["properties"]["name"] == "dated"


def test_equal_dates_fall_back_to_filename_order(tmp_path):
    write_overpass(tmp_path, "bbb-drinkingWater.json", [node(1, name="bbb")])
    write_overpass(tmp_path, "aaa-drinkingWater.json", [node(1, name="aaa")])
    features = merge_pois.merge_basic_poi_type(tmp_path, "drinkingWater")["features"]
    assert features[0]["properties"]["name"] == "aaa"
