# POI Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Python side of the Radlkarte 2026 rewrite — a new `merge_pois.py` that turns per-region Overpass downloads into region-agnostic per-type GeoJSON, plus problem-point attribute validation in `prepare_geojson.py`.

**Architecture:** Pure functions over plain dicts, unit-tested with pytest. `download_pois_from_osm.py` keeps its current role and is not touched; `merge_pois.py` is a new post-processing step that reads `data/osm-overpass/<region>-<type>.json` and writes `data/poi/<type>.geojson`. Deduplication happens on the OSM `type/id` key for regular POIs and on station name for transit, because region bounding boxes overlap around Vienna. Tag-soup flattening moves from the browser to build time.

**Tech Stack:** Python 3.14, pytest 9, stdlib only (`json`, `pathlib`, `argparse`, `logging`) — matching `download_pois_from_osm.py`, which has no third-party dependencies.

## Global Constraints

- Python standard library only. Do not add dependencies to the Python tooling.
- Output GeoJSON must be deterministic: features sorted by OSM key, `json.dump(..., sort_keys=True)`. Two runs over the same input produce byte-identical files.
- POI output is **not** committed to git — `data/poi/` goes in `.gitignore`, like `/data/osm-overpass` already is.
- `opening_hours` values are emitted as **raw OSM strings**. Evaluation stays in the browser (the `opening_hours` library needs the viewer's clock).
- Coordinates are rounded to **5 decimal places**, matching `restrict_decimal_precision` in `prepare_geojson.py`.
- Problem-point attribute vocabulary: `dismount`, `nocargo`, `warning`, `speed100` — value always `yes`.
- Additional rendered point category: `leisure` — value always `swimming_pool`. Not a
  problem type, but validated the same way.
- **Validation checks values, never presence.** A recognised key with a bad value is
  reported; a point carrying none of the recognised keys is valid and silent. (Amended
  2026-08-04 after Task 2 measured the presence-requiring rule against real data: it
  flagged 369 points, 6 of them real. See the spec's Priority section.)
- Priority vocabulary: `0`, `1`, `2` where 0 is most prominent. **Absence is meaningful** and must never be filled in at build time (see Task 2).
- All log output goes through `logging`, format as already configured in the two existing scripts.
- Run tests from the repository root with `pytest`.

## Key design decision: absent `priority` stays absent

The spec says the default for a missing point `priority` is 1. That default is applied **in the frontend**, not written into the GeoJSON by `prepare_geojson.py`.

Reason: the spec's Priority section commits area maintainers to reviewing every existing problem point in JOSM. If the build stamped `priority=1` into the data, "not yet reviewed" and "deliberately medium" would become indistinguishable and that review could never be tracked. Keeping the attribute absent lets a JOSM MapCSS rule highlight exactly the points still needing attention (Task 3).

Consequence for the frontend plan: it must treat missing `priority` on a Point as 1.

## File Structure

| File | Responsibility |
| --- | --- |
| `pyproject.toml` (create) | pytest configuration so the suite runs from the repo root |
| `data/merge_pois.py` (create) | Merge + dedupe + flatten Overpass results into per-type GeoJSON |
| `data/test/test_merge_pois.py` (create) | Unit tests for every pure function in `merge_pois.py` |
| `data/prepare_geojson.py` (modify) | Gains problem-point attribute validation; existing behaviour unchanged |
| `data/test/test_prepare_geojson.py` (modify) | Runs from repo root; gains validation tests |
| `data/josm-radlkarte-style.mapcss` (modify) | Visual feedback for point `priority` and `speed100` |
| `README.md` (modify) | Attribute reference gains `speed100` and point `priority` |
| `AGENTS.md` (modify) | Corrected test command, new `merge_pois.py` role |
| `package.json` (modify) | `pois:merge` script |
| `.gitignore` (modify) | Ignore `data/poi/` |

---

### Task 1: Make the pytest suite runnable from the repo root

The existing suite only works when the working directory is `data/test` — it does `sys.path.append("..")` and opens fixtures by bare filename. Every later task adds tests, so fix this first.

**Files:**
- Create: `pyproject.toml`
- Modify: `data/test/test_prepare_geojson.py` (whole file)
- Modify: `AGENTS.md:15-17` (the Commands section)

**Interfaces:**
- Consumes: nothing.
- Produces: `pytest` run from the repository root collects and passes `data/test/`. All later tasks rely on this.

- [ ] **Step 1: Run the suite from the root to see it fail**

Run: `cd /home/evod/projects/radlkarte && pytest`

Expected: a collection error — `ModuleNotFoundError: No module named 'prepare_geojson'`. The `sys.path.append("..")` in the test resolves relative to the working directory, so from the root it points outside the repository.

- [ ] **Step 2: Add pytest configuration**

Create `pyproject.toml`:

```toml
[tool.pytest.ini_options]
pythonpath = ["data"]
testpaths = ["data/test"]
```

`pythonpath` makes `import prepare_geojson` work regardless of the working directory. `testpaths` means a bare `pytest` finds the suite.

- [ ] **Step 3: Rewrite the test module to be location-independent**

Replace the entire contents of `data/test/test_prepare_geojson.py`:

```python
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
```

Three changes beyond the path fix: fixtures are resolved from the module's own location, output goes to pytest's `tmp_path` instead of littering `data/test/`, and `filecmp.cmp` gets `shallow=False` so it compares content rather than `stat` signatures.

- [ ] **Step 4: Run the suite to verify it passes**

Run: `cd /home/evod/projects/radlkarte && pytest -v`
Expected: PASS, `2 passed`.

- [ ] **Step 5: Confirm it still works from the old directory**

Run: `cd /home/evod/projects/radlkarte/data/test && pytest -v`
Expected: PASS, `2 passed`. (pytest finds `pyproject.toml` by walking up to the repo root, so both invocations work. If this fails, do not paper over it — the `pythonpath` entry is relative to the config file's directory and must resolve to `<repo>/data`.)

- [ ] **Step 6: Update the documented command**

In `AGENTS.md`, replace the Commands section body:

```markdown
Python tests live in `data/test/` and run with pytest from the repository root:

    pytest
```

- [ ] **Step 7: Commit**

```bash
cd /home/evod/projects/radlkarte
git add pyproject.toml data/test/test_prepare_geojson.py AGENTS.md
git commit -m "test: make pytest suite runnable from the repository root"
```

---

### Task 2: Validate problem-point attributes in `prepare_geojson.py`

Today an unrecognised Point feature is only noticed in the browser console at runtime (`radlkarte.js:190`). Move that check to the authoring step, and add `speed100` and `priority` to the vocabulary it knows.

**Files:**
- Modify: `data/prepare_geojson.py` (add constants + `validate_point_properties`, call it from `minimize`, change `minimize`'s return value and the `__main__` block)
- Modify: `data/test/test_prepare_geojson.py` (append tests)

**Interfaces:**
- Consumes: Task 1's root-runnable pytest setup.
- Produces:
  - `prepare_geojson.PROBLEM_ATTRIBUTES: tuple[str, ...]` — `("dismount", "nocargo", "warning", "speed100")`
  - `prepare_geojson.VALID_PRIORITIES: tuple[str, ...]` — `("0", "1", "2")`
  - `prepare_geojson.validate_point_properties(feature: dict) -> list[str]` — human-readable problem descriptions, empty when valid
  - `prepare_geojson.minimize(infile, outfile) -> int` — now returns the number of invalid Point features (was `None`)

- [ ] **Step 1: Write the failing tests**

Append to `data/test/test_prepare_geojson.py`:

```python
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


def test_point_without_any_problem_attribute_is_reported():
    problems = prepare_geojson.validate_point_properties(point(description="Engstelle"))
    assert len(problems) == 1
    assert "dismount" in problems[0]


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
    problems = prepare_geojson.validate_point_properties(point(priority="9"))
    assert len(problems) == 2
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/evod/projects/radlkarte && pytest -v -k "point or priority or problem"`

Expected: FAIL with `AttributeError: module 'prepare_geojson' has no attribute 'validate_point_properties'`.

- [ ] **Step 3: Implement the validation function**

In `data/prepare_geojson.py`, after the `logging.basicConfig` line (i.e. after line 20), add:

```python
PROBLEM_ATTRIBUTES = ("dismount", "nocargo", "warning", "speed100")
VALID_PRIORITIES = ("0", "1", "2")


def validate_point_properties(feature):
    """Check a Point feature's problem-marker attributes.

    A Point must carry at least one problem attribute with the value 'yes'.
    'priority' is optional: an absent priority means the point has not been
    reviewed yet and the frontend renders it with medium prominence. It is
    deliberately not filled in here, so that unreviewed points stay
    recognisable in JOSM.

    :returns a list of human readable problem descriptions (empty if valid)
    """
    properties = feature["properties"]
    problems = []

    present = [attribute for attribute in PROBLEM_ATTRIBUTES if attribute in properties]
    if not present:
        problems.append(
            "no problem attribute, expected one of {}".format(
                ", ".join(PROBLEM_ATTRIBUTES)
            )
        )
    for attribute in present:
        if str(properties[attribute]) != "yes":
            problems.append(
                "{}={} (only 'yes' is allowed)".format(attribute, properties[attribute])
            )

    if "priority" in properties and str(properties["priority"]) not in VALID_PRIORITIES:
        problems.append(
            "priority={} (allowed: {})".format(
                properties["priority"], ", ".join(VALID_PRIORITIES)
            )
        )

    return problems
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/evod/projects/radlkarte && pytest -v`
Expected: PASS, `10 passed`.

- [ ] **Step 5: Call the validation from `minimize` and report via the exit code**

Three edits in `data/prepare_geojson.py`.

First, both early returns in `minimize` must return a count. Change:

```python
    except json.JSONDecodeError:
        logging.warning("{} is not a valid json file - skipping.".format(infile))
        return
```

to `return 0`, and likewise:

```python
    if "features" not in data:
        logging.warning("{} is not a valid geojson file - skipping.".format(infile))
        return
```

to `return 0`.

Second, insert the validation pass after `set_new_ids(bad_features, max_id + 1)` — after ids are final, so the log messages identify features usefully:

```python
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
```

Third, add `return invalid_count` as the last line of `minimize`, after the closing `logging.info(...)` call.

- [ ] **Step 6: Make the CLI exit non-zero when a file has invalid points**

Replace the `__main__` block at the bottom of `data/prepare_geojson.py`:

```python
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
```

The file is still written; the exit code only reports. A mapper mid-edit must not lose their minified output because one point is wrong.

- [ ] **Step 7: Add a test for the return value and run the suite**

Append to `data/test/test_prepare_geojson.py`:

```python
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
```

Run: `cd /home/evod/projects/radlkarte && pytest -v`
Expected: PASS, `11 passed`.

- [ ] **Step 8: Check the real data and record what it reports**

Run: `cd /home/evod/projects/radlkarte && python3 data/prepare_geojson.py data/radlkarte-wien.geojson; echo "exit=$?"`

Expected: the file is rewritten, and warnings appear for any Point that lacks a problem attribute. `git diff --stat data/radlkarte-wien.geojson` should show **no change** — the file is already minified and validation does not mutate. If the diff is non-empty, stop and investigate before committing; something other than validation changed.

Note the exit code and warning count in the commit message — this is the first measurement of how much data the maintainers need to review.

- [ ] **Step 9: Commit**

```bash
cd /home/evod/projects/radlkarte
git checkout -- data/radlkarte-wien.geojson
git add data/prepare_geojson.py data/test/test_prepare_geojson.py
git commit -m "feat: validate problem-point attributes in prepare_geojson"
```

---

### Task 3: MapCSS and README for point priority and `speed100`

JOSM styling cannot be unit-tested, so this task's gate is a manual check in JOSM. Do not skip it — a MapCSS rule that JOSM silently ignores looks identical to one that works.

**Files:**
- Modify: `data/josm-radlkarte-style.mapcss` (header comment + new rules at the end)
- Modify: `README.md:33` and `README.md:47-49` (attribute reference)

**Interfaces:**
- Consumes: `PROBLEM_ATTRIBUTES` vocabulary from Task 2.
- Produces: nothing other code depends on.

- [ ] **Step 1: Update the style file header comment**

Replace lines 1-6 of `data/josm-radlkarte-style.mapcss`:

```
/**
 * radlkarte way attributes:
 * priority=0|1|2 (mandatory)
 * stress=0|1|2 (mandatory)
 * oneway=yes (optional)
 * unpaved=yes, steep=yes (optional)
 *
 * radlkarte problem point attributes:
 * one of dismount=yes, nocargo=yes, warning=yes, speed100=yes (mandatory)
 * priority=0|1|2 (optional; absent means "not reviewed yet")
 * description=... (free text)
 */
```

- [ ] **Step 2: Add the `speed100` icon rule**

Append to `data/josm-radlkarte-style.mapcss`:

```
node[speed100=yes] {
    icon-image: "presets/vehicle/restriction/maxspeed.svg";
    text: auto;
}
```

- [ ] **Step 3: Add point priority sizing and a review highlight**

Append to `data/josm-radlkarte-style.mapcss`:

```
/* problem point prominence: 0=most prominent, 1=medium, 2=least */
node[priority=0] {
    icon-width: 24;
}
node[priority=1] {
    icon-width: 18;
}
node[priority=2] {
    icon-width: 12;
}

/* problem points still missing an explicit priority - these need review */
node[dismount=yes][!priority],
node[nocargo=yes][!priority],
node[warning=yes][!priority],
node[speed100=yes][!priority] {
    symbol-shape: circle;
    symbol-size: 28;
    symbol-stroke-width: 3;
    symbol-stroke-color: #FFFF00;
}
```

- [ ] **Step 4: Verify in JOSM — the actual gate for this task**

Open `data/radlkarte-rendertest.geojson` and `data/radlkarte-wien.geojson` in JOSM with this MapCSS active, then check all four of these:

1. **No MapCSS errors.** JOSM reports style errors in its status bar and in `Preferences → Map Paint Styles`. A red badge there means a property name is wrong — fix it before continuing.
2. **`maxspeed.svg` resolves.** If the icon is missing, JOSM draws a placeholder. Pick a real path from `Preferences → Map Paint Styles → <style> → Edit` icon browser, or use any other existing restriction icon, and update Step 2's rule.
3. **Priority sizing is visible.** Add `priority=0` and `priority=2` to two test points and confirm they differ in size. If `icon-width` has no effect, use `icon-height` alongside it.
4. **The yellow review ring is visible on points without `priority`.** If JOSM draws the symbol *instead of* the icon rather than behind it, drop `symbol-shape` and use `text: "priority fehlt";` on those selectors instead — less pretty, equally findable.

Record which of the four needed adjustment in the commit message.

- [ ] **Step 5: Update the README attribute reference**

In `README.md`, in the point-attribute list that currently ends at line 49, add after the `warning` entry:

```markdown
- `speed100`=`yes`: Freilandstraße with a 100 km/h speed limit and no separate cycling infrastructure
- `priority`=`0` | `1` | `2` (optional): how prominently the problem icon is drawn — `0` shows it from low zoom levels at full size, `2` only when zoomed in close. If absent the map treats it as `1`; unreviewed points are highlighted in JOSM by the MapCSS style.
```

- [ ] **Step 6: Commit**

```bash
cd /home/evod/projects/radlkarte
git add data/josm-radlkarte-style.mapcss README.md
git commit -m "feat: JOSM feedback for problem point priority and speed100"
```

---

### Task 4: `merge_pois.py` — element conversion primitives

Start `merge_pois.py` with the three smallest pure functions. Everything later builds on them.

**Files:**
- Create: `data/merge_pois.py`
- Create: `data/test/test_merge_pois.py`

**Interfaces:**
- Consumes: Task 1's pytest setup.
- Produces:
  - `merge_pois.OSM_POI_TYPES: tuple[str, ...]` — `("bicycleShop", "bicycleRepairStation", "bicyclePump", "bicycleTubeVending", "drinkingWater")`
  - `merge_pois.BLOCKED_ACCESS: tuple[str, ...]` — `("no", "private", "permit")`
  - `merge_pois.osm_key(element: dict) -> str` — e.g. `"node/123"`
  - `merge_pois.element_coordinates(element: dict) -> list[float] | None` — `[lon, lat]` rounded to 5 decimals
  - `merge_pois.is_accessible(element: dict) -> bool`

- [ ] **Step 1: Write the failing tests**

Create `data/test/test_merge_pois.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'merge_pois'`.

- [ ] **Step 3: Implement the primitives**

Create `data/merge_pois.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v`
Expected: PASS, `9 passed`.

- [ ] **Step 5: Commit**

```bash
cd /home/evod/projects/radlkarte
git add data/merge_pois.py data/test/test_merge_pois.py
git commit -m "feat: add merge_pois element conversion primitives"
```

---

### Task 5: Deduplicate elements across overlapping regions

This is the failure the spec singles out as most likely to go unnoticed: duplicates render as plausible-looking extra markers. It is invisible today only because one region loads at a time.

**Files:**
- Modify: `data/merge_pois.py` (add `deduplicate_by_osm_key`)
- Modify: `data/test/test_merge_pois.py` (append tests)

**Interfaces:**
- Consumes: `merge_pois.osm_key`.
- Produces: `merge_pois.deduplicate_by_osm_key(elements: list[dict]) -> list[dict]` — first occurrence of each OSM key wins, input order preserved.

- [ ] **Step 1: Write the failing tests**

Append to `data/test/test_merge_pois.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v -k deduplicate`
Expected: FAIL — `AttributeError: module 'merge_pois' has no attribute 'deduplicate_by_osm_key'`.

- [ ] **Step 3: Implement deduplication**

Append to `data/merge_pois.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v`
Expected: PASS, `13 passed`.

- [ ] **Step 5: Commit**

```bash
cd /home/evod/projects/radlkarte
git add data/merge_pois.py data/test/test_merge_pois.py
git commit -m "feat: deduplicate POIs across overlapping region bounding boxes"
```

---

### Task 6: Flatten the OSM tag soup into popup properties

Ports `extractAddressFromTagSoup`, `extractWebsiteFromTagSoup` and `extractDateFromOverpassResponse` from `radlkarte.js:507-560` to build time.

**Files:**
- Modify: `data/merge_pois.py`
- Modify: `data/test/test_merge_pois.py`

**Interfaces:**
- Consumes: `merge_pois.osm_key`.
- Produces:
  - `merge_pois.format_address(tags: dict) -> str | None`
  - `merge_pois.normalize_website(tags: dict) -> str | None`
  - `merge_pois.parse_data_date(overpass_json: dict) -> str | None` — `"YYYY-MM-DD"`
  - `merge_pois.extract_properties(element: dict, data_date: str | None) -> dict` — always contains `osmType` and `osmId`; contains `dataDate`, `name`, `address`, `website`, `openingHours`, `phone`, `operator` only when present. **The frontend plan consumes exactly these keys.**

- [ ] **Step 1: Write the failing tests**

Append to `data/test/test_merge_pois.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v -k "address or website or data_date or extract or opening"`
Expected: FAIL — `AttributeError: module 'merge_pois' has no attribute 'format_address'`.

- [ ] **Step 3: Implement the extraction functions**

Append to `data/merge_pois.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v`
Expected: PASS, `27 passed`.

- [ ] **Step 5: Commit**

```bash
cd /home/evod/projects/radlkarte
git add data/merge_pois.py data/test/test_merge_pois.py
git commit -m "feat: flatten OSM tag soup into popup properties at build time"
```

---

### Task 7: Merge transit stations with their line references

Transit is the one type whose four Overpass queries collapse into a single layer, and the one that cannot use OSM-id deduplication. The `convert` statements in the `subwayLines`/`railwayLines` queries emit one synthetic element per (route, stop) pair, so ids repeat by design. Ports `clearAndLoadTransit` and `loadStationName2Line2Colour` from `radlkarte.js:369-427`.

**Files:**
- Modify: `data/merge_pois.py`
- Modify: `data/test/test_merge_pois.py`

**Interfaces:**
- Consumes: `element_coordinates`, `extract_properties`, `osm_key`.
- Produces:
  - `merge_pois.TRANSIT_SOURCES: tuple[tuple[str, str], ...]` — `(("subway", "subwayLines"), ("railway", "railwayLines"))`
  - `merge_pois.index_lines_by_station(overpass_json: dict) -> dict[str, dict[str, str | None]]` — station name → `{line ref: colour}`
  - `merge_pois.build_transit_features(stations_json: dict, lines_index: dict, transit_type: str, data_date: str | None, seen_names: set) -> list[dict]` — mutates `seen_names`, so subway and railway share one dedup set as they do today. Features carry `transitType` plus an optional `lines` list of `{"ref", "colour"}` sorted by `ref`. **The frontend plan reads `transitType` and `lines`.**

- [ ] **Step 1: Write the failing tests**

Append to `data/test/test_merge_pois.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v -k "index_lines or transit"`
Expected: FAIL — `AttributeError: module 'merge_pois' has no attribute 'index_lines_by_station'`.

- [ ] **Step 3: Implement the transit merge**

Append to `data/merge_pois.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v`
Expected: PASS, `36 passed`.

- [ ] **Step 5: Commit**

```bash
cd /home/evod/projects/radlkarte
git add data/merge_pois.py data/test/test_merge_pois.py
git commit -m "feat: merge transit stations with their line references"
```

---

### Task 8: File-level merge, output writing and CLI

Wire the pure functions into something runnable.

**Files:**
- Modify: `data/merge_pois.py`
- Modify: `data/test/test_merge_pois.py`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: everything from Tasks 4-7.
- Produces:
  - `merge_pois.merge_basic_poi_type(overpass_dir: Path, poi_type: str) -> dict` — a GeoJSON FeatureCollection
  - `merge_pois.merge_transit(overpass_dir: Path) -> dict`
  - `merge_pois.write_feature_collection(out_dir: Path, name: str, collection: dict) -> Path`
  - `merge_pois.main(overpass_dir: Path, out_dir: Path) -> None`
  - Output contract for the frontend plan: `data/poi/transit.geojson` plus one file per entry in `OSM_POI_TYPES`, e.g. `data/poi/bicycleShop.geojson`.

- [ ] **Step 1: Write the failing tests**

First add `import json` to the imports at the **top** of `data/test/test_merge_pois.py`, above `import merge_pois`. Then append:

```python
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


def test_merge_basic_poi_type_handles_a_missing_type(tmp_path):
    collection = merge_pois.merge_basic_poi_type(tmp_path, "bicyclePump")
    assert collection == {"type": "FeatureCollection", "features": []}


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


def test_main_writes_one_file_per_poi_type(tmp_path):
    overpass_dir = tmp_path / "overpass"
    overpass_dir.mkdir()
    write_overpass(overpass_dir, "wien-drinkingWater.json", [node(1)])
    out_dir = tmp_path / "poi"
    merge_pois.main(overpass_dir, out_dir)
    written = sorted(path.name for path in out_dir.glob("*.geojson"))
    assert written == sorted(
        ["transit.geojson"] + [f"{poi_type}.geojson" for poi_type in merge_pois.OSM_POI_TYPES]
    )
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/evod/projects/radlkarte && pytest data/test/test_merge_pois.py -v -k "merge_basic or merge_transit or write_feature or main_writes"`
Expected: FAIL — `AttributeError: module 'merge_pois' has no attribute 'merge_basic_poi_type'`.

- [ ] **Step 3: Implement the merge, write and CLI layer**

Append to `data/merge_pois.py`:

```python
def _load_overpass_files(overpass_dir, data_name):
    """Yield (parsed json, data date) for every region's file of one query.

    Matching is exact on the suffix so that '*-subway.json' does not also
    pick up '*-subwayLines.json'. Sorted for deterministic output.
    """
    for path in sorted(overpass_dir.glob("*-{}.json".format(data_name))):
        with open(path, encoding="utf-8") as file_pointer:
            try:
                overpass_json = json.load(file_pointer)
            except json.JSONDecodeError:
                logging.warning("%s is not valid json - skipping", path)
                continue
        yield overpass_json, parse_data_date(overpass_json)


def merge_basic_poi_type(overpass_dir, poi_type):
    """Merge every region's download of one POI type into a FeatureCollection."""
    elements = []
    data_dates = {}
    for overpass_json, data_date in _load_overpass_files(overpass_dir, poi_type):
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
    """Merge subway and railway stations into a single FeatureCollection."""
    features = []
    seen_names = set()
    for station_query, lines_query in TRANSIT_SOURCES:
        lines_index = {}
        for overpass_json, _ in _load_overpass_files(overpass_dir, lines_query):
            for name, lines in index_lines_by_station(overpass_json).items():
                lines_index.setdefault(name, {}).update(lines)

        for overpass_json, data_date in _load_overpass_files(
            overpass_dir, station_query
        ):
            features += build_transit_features(
                overpass_json, lines_index, station_query, data_date, seen_names
            )

    features.sort(key=lambda f: (f["properties"]["osmType"], f["properties"]["osmId"]))
    logging.info("transit: %d station(s)", len(features))
    return {"type": "FeatureCollection", "features": features}


def write_feature_collection(out_dir, name, collection):
    """Write one POI type to <out_dir>/<name>.geojson.

    :returns the path written
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "{}.geojson".format(name)
    with open(path, "w", encoding="utf-8") as file_pointer:
        json.dump(collection, file_pointer, sort_keys=True, ensure_ascii=False)
    return path


def main(overpass_dir, out_dir):
    logging.info("merging Overpass data from '%s'", overpass_dir)
    if not overpass_dir.is_dir():
        logging.error("'%s' does not exist - run download_pois_from_osm.py first", overpass_dir)
        raise SystemExit(1)

    write_feature_collection(out_dir, "transit", merge_transit(overpass_dir))
    for poi_type in OSM_POI_TYPES:
        write_feature_collection(
            out_dir, poi_type, merge_basic_poi_type(overpass_dir, poi_type)
        )
    logging.info("all output written to '%s'", out_dir)


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
```

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `cd /home/evod/projects/radlkarte && pytest -v`
Expected: PASS, `60 passed` — 14 in `test_prepare_geojson.py` and 46 in `test_merge_pois.py`.
(Was written as 57/11 before Task 2's validation rule changed and added three tests.)

- [ ] **Step 5: Make the script executable and wire it up**

```bash
cd /home/evod/projects/radlkarte
chmod +x data/merge_pois.py
```

In `package.json`, add to `scripts` immediately after the `"pois"` entry:

```json
    "pois:merge": "./data/merge_pois.py data/osm-overpass data/poi",
```

In `.gitignore`, add below the existing `/data/osm-overpass` line:

```
/data/poi
```

In `AGENTS.md`, in the POI paragraph, replace the sentence describing source 1 with:

```markdown
1. OSM Overpass data, pre-downloaded per region/type into `data/osm-overpass/*.json`
   by `data/download_pois_from_osm.py` (run via `yarn pois*`), then merged into
   region-agnostic per-type files in `data/poi/*.geojson` by `data/merge_pois.py`
   (`yarn pois:merge`), which deduplicates across overlapping region bounding boxes
   and flattens the OSM tags to the fields popups need. Neither directory is
   committed to git.
```

- [ ] **Step 6: Verify the CLI's argument handling and failure path**

Run: `cd /home/evod/projects/radlkarte && python3 data/merge_pois.py --help`
Expected: usage text listing the `in` and `out` positional arguments.

Run: `cd /home/evod/projects/radlkarte && python3 data/merge_pois.py data/does-not-exist data/poi; echo "exit=$?"`
Expected: an error log mentioning `download_pois_from_osm.py`, and `exit=1`.

- [ ] **Step 7: Commit**

```bash
cd /home/evod/projects/radlkarte
git add data/merge_pois.py data/test/test_merge_pois.py package.json .gitignore AGENTS.md
git commit -m "feat: add merge_pois CLI writing per-type POI GeoJSON"
```

---

### Task 9: Verify against real Overpass data

The unit tests use synthetic fixtures. The deduplication claim — that regions genuinely overlap and produce duplicates — has to be confirmed against real downloads, because it is the reason this whole script exists.

`data/osm-overpass/` is gitignored and empty in a fresh checkout, so this task downloads a little real data. Use one cheap query and two regions that the spec says overlap around Vienna.

**Files:** none modified. This task produces a measurement and, if it fails, a bug report.

**Interfaces:**
- Consumes: the complete `merge_pois.py`.
- Produces: confirmation that dedup fires on real data, plus recorded counts.

- [ ] **Step 1: Download two overlapping regions for one POI type**

```bash
cd /home/evod/projects/radlkarte
yarn pois --only-region wien --only-query drinkingWater
yarn pois --only-region bruckleitha --only-query drinkingWater
```

Expected: two files in `data/osm-overpass/`. If Overpass rate-limits, wait and retry — do not work around it by faking data.

- [ ] **Step 2: Count raw elements versus merged features**

```bash
cd /home/evod/projects/radlkarte
python3 -c "
import json, pathlib
total = 0
for path in pathlib.Path('data/osm-overpass').glob('*-drinkingWater.json'):
    n = len(json.load(open(path))['elements'])
    print(path.name, n)
    total += n
print('raw total:', total)
"
yarn pois:merge
python3 -c "
import json
print('merged:', len(json.load(open('data/poi/drinkingWater.geojson'))['features']))
"
```

Expected: `merged` is **lower** than `raw total`. The difference is duplicates in the Vienna overlap plus any POIs dropped for `access` or bad coordinates.

If merged equals raw total, either the two bboxes do not actually overlap for this POI type — try `bicycleShop` instead, which is denser — or dedup is broken. Confirm which before moving on: the spec's claim that bruckleitha/wien/noe-suedost overlap is the premise of Task 5.

- [ ] **Step 3: Inspect one feature and check the output contract**

```bash
cd /home/evod/projects/radlkarte
python3 -c "
import json
features = json.load(open('data/poi/drinkingWater.geojson'))['features']
print(json.dumps(features[0], indent=2, ensure_ascii=False))
print('with name:', sum('name' in f['properties'] for f in features))
print('with openingHours:', sum('openingHours' in f['properties'] for f in features))
"
```

Confirm: `geometry.coordinates` is `[lon, lat]` with at most 5 decimals, `properties` has `osmType`/`osmId`/`dataDate`, and no `tags` key leaked through.

- [ ] **Step 4: Confirm the output is byte-stable across runs**

```bash
cd /home/evod/projects/radlkarte
sha256sum data/poi/drinkingWater.geojson
yarn pois:merge
sha256sum data/poi/drinkingWater.geojson
```

Expected: identical hashes. A difference means non-deterministic ordering — fix the sort before this pipeline reaches cron, where it would produce pointless cache churn.

- [ ] **Step 5: Record the outcome**

No commit — nothing changed. Report to the reviewer: raw versus merged counts, the duplicate count, and whether the hashes matched. If Step 2 showed no duplicates, that is a finding to escalate, not a pass.

---

## Handover to the next plans

- **Frontend plan** consumes: `data/poi/<type>.geojson` for `transit` + the five `OSM_POI_TYPES`; feature properties `osmType`, `osmId`, `dataDate`, `name`, `address`, `website`, `openingHours`, `phone`, `operator`, and for transit `transitType` + `lines[{ref, colour}]`. It must:
  - default a Point's missing `priority` to 1;
  - append `;PH off` to a `bicycleShop`'s `openingHours` when it contains no `PH` rule, before evaluating — that hack lives in `radlkarte.js:465-468` today and deliberately stays client-side;
  - tolerate `lines[].colour` being `null` (mapped routes sometimes lack `colour`; today the browser renders `background-color:undefined`).
- **Deployment plan** consumes: `merge_pois.py` runs from the deployed copy under server cron, after `download_pois_from_osm.py`, writing into the directory Apache serves via `Alias /data/poi`.
