# Follow-ups

Known code issues in the data tooling, none blocking. Raised by the whole-branch review
of the POI pipeline work (2026-08-04) and each verified against the code before being
written down here. Delete an entry once it is done.

For errors in the *route data* rather than the code, see
[known data errors](known-data-errors.md).

## Correctness

### `normalize_website` mangles an uppercase scheme

`data/merge_pois.py` — the guard is `if not website.startswith("http")`, which is
case-sensitive, so a tag written with an uppercase scheme gets a second scheme glued on
and the popup link is dead:

| Tag value | Result |
| --- | --- |
| `HTTP://example.at` | `https://HTTP://example.at` |
| `HttpS://x.at` | `https://HttpS://x.at` |
| `example.at` | `https://example.at` (correct) |

Fix: `if not website.lower().startswith(("http://", "https://"))`. Rare in OSM, but
cheap to get right.

### `download_pois_from_osm.py` raises `NameError` on a non-200 response

In `_download_from_endpoints`, the branch that handles a reachable endpoint returning a
non-200 status logs `{e.code}`, but `e` is only bound by the enclosing
`except URLError as e` — so this raises `NameError` instead of logging and moving to the
next endpoint. Never hit so far because the failures seen in practice are timeouts,
which take the `URLError` path. Fix: use `response.code`.

Pre-existing, unrelated to the pipeline work.

### A typo'd `--only-region` is a silent no-op

`download_pois_from_osm.py` filters regions by exact string match, so
`--only-region wein` downloads nothing and reports
`successfully downloaded all 0 data set(s)` — which reads like success. Fix: fail if the
requested region matched nothing.

## Robustness

### Nothing ties the merge vocabulary to the download vocabulary

`OSM_POI_TYPES` + `TRANSIT_SOURCES` in `data/merge_pois.py` must together equal
`QUERIES` in `data/download_pois_from_osm.py`. They match today — verified — but nothing
enforces it, so adding a query and forgetting the merge list gives a successful download
whose data is silently never merged.

This is the most drift-prone coupling in the tooling and the cheapest to protect:

```python
def test_merge_covers_every_download_query():
    import download_pois_from_osm
    merged = set(merge_pois.OSM_POI_TYPES) | {
        query for pair in merge_pois.TRANSIT_SOURCES for query in pair
    }
    assert merged == set(download_pois_from_osm.QUERIES)
```

### Untested paths in `merge_pois.py`

Both are reachable, neither is covered:

- The invalid-JSON skip in `_load_overpass_files`. `download_pois_from_osm.py` streams
  responses with `copyfileobj`, so a connection dropped mid-transfer leaves a truncated
  file on disk. It is skipped with a warning, which now means that region's POIs are
  quietly absent from the merge rather than the whole run failing — worth deciding
  whether skip-and-warn is the behaviour you want before writing the test to lock it in.
- A `"tags": null` element would raise `AttributeError` from `element.get("tags", {})`.
  Overpass omits the key rather than nulling it, so this is theoretical.

## Tidiness

### `merge_pois.py` has visible seams from being built across five tasks

None of these affect behaviour; they are what a whole-file read shows that a per-task
diff cannot. Worth one small commit, not more:

- `TRANSIT_SOURCES` is declared mid-file, between `extract_properties` and
  `index_lines_by_station`, while the other module constants sit together at the top.
- `merge_basic_poi_type` and `merge_transit` duplicate the feature sort key and the
  `{"type": "FeatureCollection", "features": features}` literal verbatim, so the two
  sort keys can drift apart. A `feature_collection(features)` helper collapses both.
- `element.get("tags", {})` appears four times. A one-line `element_tags(element)` helper
  removes the repetition and is the natural place to handle the `"tags": null` case
  above, if it is ever worth handling.

### The MapCSS sync comment over-claims

The error-visualisation header in `data/josm-radlkarte-style.mapcss` says the rules
mirror `validate_point_properties()` in `prepare_geojson.py` and must be kept in sync.
True of the node rules; the way rules below have no Python counterpart at all. The
comment should be scoped to the node block, the way `README.md` already is ("It checks
points only; the way highlights above have no command-line equivalent yet").

### `RADLKARTE_2026_DRAFT_SPEC.md` is superseded but unmarked

The root draft is superseded by
`docs/superpowers/specs/2026-08-02-radlkarte-2026-design.md`, which says so in its own
header, but the draft does not say it and nothing points from one to the other. Delete
it, or add a one-line "superseded by" note.

## To check at cutover

### Transit stations now deduplicate by name across all of Austria

`build_transit_features` collapses stations by name alone. That is faithful to the
current frontend, but the collision surface changed: previously one region loaded at a
time, so two same-named stations in different regions never met. Now everything merges
into one file and two genuinely distinct stations sharing a name become one — with the
freshest region's copy winning.

Not a defect, and not measurable until the transit queries are downloaded for every
region. Worth one count then:

    python3 -c "import json,collections; \
      n=[f['properties']['name'] for f in json.load(open('data/poi/transit.geojson'))['features']]; \
      print(collections.Counter(n).most_common(5))"

Duplicates in that output are the interesting case — the merge already removed the
same-name collisions, so what you are looking for is names that *should* have been
distinct.
