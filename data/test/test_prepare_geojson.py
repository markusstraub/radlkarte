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
