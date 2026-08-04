#!/usr/bin/env python3

"""
Run these unit tests with pytest from the repository root.
"""

import filecmp
from pathlib import Path

import prepare_geojson

FIXTURE_DIR = Path(__file__).parent
INPUT_GEOJSON = FIXTURE_DIR / "test.geojson"
EXPECTED_GEOJSON = FIXTURE_DIR / "expected.geojson"


def test_minify_josm_export(tmp_path):
    output = tmp_path / "output.geojson"
    prepare_geojson.minimize(INPUT_GEOJSON, output)
    assert filecmp.cmp(output, EXPECTED_GEOJSON, shallow=False)


def test_minify_again(tmp_path):
    output = tmp_path / "output.geojson"
    prepare_geojson.minimize(INPUT_GEOJSON, output)
    prepare_geojson.minimize(output, output)
    assert filecmp.cmp(output, EXPECTED_GEOJSON, shallow=False)


def point(**properties):
    """A minimal Point feature for validation tests."""
    return {"geometry": {"type": "Point"}, "properties": properties}


def test_valid_problem_point_has_no_problems():
    assert prepare_geojson.validate_point_properties(point(warning="yes", priority="0")) == []


def test_speed100_is_a_recognised_problem_attribute():
    assert prepare_geojson.validate_point_properties(point(speed100="yes")) == []


def test_absent_priority_is_allowed():
    """Absence means 'not reviewed yet' - the frontend defaults it to 1."""
    assert prepare_geojson.validate_point_properties(point(dismount="yes")) == []


def test_point_with_only_foreign_tags_is_valid():
    """A Point with no recognized keys is valid (may be JOSM export artifact)."""
    assert prepare_geojson.validate_point_properties(point(description="Engstelle")) == []


def test_problem_attribute_with_wrong_value_is_reported():
    problems = prepare_geojson.validate_point_properties(point(warning="true"))
    assert len(problems) == 1
    assert "warning=true" in problems[0]


def test_invalid_priority_is_reported():
    problems = prepare_geojson.validate_point_properties(point(warning="yes", priority="3"))
    assert len(problems) == 1
    assert "priority=3" in problems[0]


def test_integer_valued_attributes_are_accepted():
    """JOSM writes strings, but hand-edited files may contain numbers."""
    assert prepare_geojson.validate_point_properties(point(warning="yes", priority=1)) == []


def test_several_problems_are_all_reported():
    """Multiple invalid values on the same point are all reported."""
    problems = prepare_geojson.validate_point_properties(point(warning="true", priority="9"))
    assert len(problems) == 2
    assert "warning=true" in problems[0]
    assert "priority=9" in problems[1]


def test_minimize_returns_invalid_point_count(tmp_path):
    source = tmp_path / "input.geojson"
    source.write_text(
        '{"type": "FeatureCollection", "features": ['
        '{"type": "Feature", "properties": {"id": 1, "warning": "yes"},'
        ' "geometry": {"type": "Point", "coordinates": [16.3, 48.2]}},'
        '{"type": "Feature", "properties": {"id": 2, "priority": "7"},'
        ' "geometry": {"type": "Point", "coordinates": [16.4, 48.3]}}]}',
        encoding="utf-8",
    )
    assert prepare_geojson.minimize(source, tmp_path / "out.geojson") == 1


def test_swimming_is_a_valid_point_category():
    """swimming=yes marks a bathing spot - a rendered category, not a problem."""
    assert prepare_geojson.validate_point_properties(point(swimming="yes")) == []


def test_swimming_with_wrong_value_is_reported():
    """swimming with any other value is reported."""
    problems = prepare_geojson.validate_point_properties(point(swimming="pool"))
    assert len(problems) == 1
    assert "swimming=pool" in problems[0]


def test_unrecognised_key_is_silent():
    """A leftover leisure=swimming_pool is now just a foreign tag, so it is ignored.

    Only recognised keys are validated; a point carrying none of them is valid.
    """
    assert prepare_geojson.validate_point_properties(point(leisure="swimming_pool")) == []


def test_point_with_no_properties_is_valid():
    """A Point with no properties at all is valid (JOSM export artifact)."""
    feature = {"geometry": {"type": "Point"}, "properties": None}
    assert prepare_geojson.validate_point_properties(feature) == []
