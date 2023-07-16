#!/usr/bin/env python3

"""
Run these unit tests with pytest.
"""

import filecmp
import sys

sys.path.append("..")

import prepare_geojson

input_geojson = "test.geojson"
output_geojson = "test_output.geojson"
expected_geojson = "expected.geojson"


def test_minify_josm_export():
    prepare_geojson.minimize(input_geojson, output_geojson)
    assert filecmp.cmp(output_geojson, expected_geojson)


def test_minify_again():
    prepare_geojson.minimize(input_geojson, output_geojson)
    prepare_geojson.minimize(output_geojson, output_geojson)
    assert filecmp.cmp(output_geojson, expected_geojson)
