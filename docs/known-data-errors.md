# Known data errors

Snapshot taken 2026-08-04, when attribute validation and the JOSM error highlights were
added. These are pre-existing errors in the committed route data, not regressions — they
had simply never been reported before.

Everything here needs an **area maintainer** to fix it in JOSM. Nothing here is a code
bug — for those see [follow-ups](follow-ups.md). Delete a row once it is fixed.

Re-derive the current list at any time:

    npm run geojson -- data/radlkarte-<region>.geojson    # points, exits 1 if any

The way errors have no command-line equivalent yet; load the file in JOSM with
`data/josm-radlkarte-style.mapcss` and look for red casings.

## Points — `prepare_geojson.py` exits 1 on these

None of these render on the site today: the frontend tests each attribute against the
exact string `yes`, so a wrong value is silently dropped.

| Region | id | Problem |
| --- | --- | --- |
| bruckleitha | 4702 | `warning` holds a free-text sentence ("Schild: Sackgasse. Radfahrende dürfen und können aber durch") — the text belongs in `description`, and `warning` should be `yes` |
| noe-suedost | 2147 | `priority=-1` |
| noe-suedost | 2207 | `priority=-1` |
| stpoelten | 108 | `dismount=1` |
| stpoelten | 120 | `dismount=1` |
| stpoelten | 174 | `warning=2` |

Because of these, `npm run geojson` currently exits non-zero for **bruckleitha,
noe-suedost and stpoelten** even when the contributor changed nothing related. That is
the intended fail-loud behaviour, not a broken script.

## Ways — wrong values, so the attribute is silently ignored

`radlkarte.js` tests optional flags with a strict `=== 'yes'`, so these render **wrong
on the live site right now**: no direction arrows, or no dashes.

| Region | ids | Problem |
| --- | --- | --- |
| linz | 19, 31, 67, 117, 144, 255, 400, 403, 436, 445, 473, 475, 479, 519, 529 | `oneway=true` → 15 segments draw without direction arrows |
| linz | 615 | `unpaved=true` → draws without dashes |
| stpoelten | 135 | `oneway=-1` → OSM's "reversed direction", which radlkarte does not implement; draws without arrows |
| bruckleitha | 690 | `priority=x` and `stress=x` → segment does not render at all |

## Ways — missing a mandatory attribute, so the segment does not render

`priority` and `stress` are both mandatory. A way with only one of them is dropped.

| Region | id | Problem |
| --- | --- | --- |
| bruckleitha | 918, 1022, 1346, 1737 | missing `priority` (all four also carry `fixme`, so they are known work-in-progress) |
| rheintal | 254, 366, 407 | missing `priority` |
| stpoelten | 49 | key typo `proi` instead of `priority` |
| wien | 2190 | `disabled:priority` — JOSM's convention for switching a tag off, so the segment does not render |
| noe-suedost | 17 | missing `stress` |

## Ways — redundant, harmless

39 segments in **noe-suedost** carry `oneway=no`. These are flagged red by the JOSM style
but nothing is broken: omitting an optional flag already means "no", and radlkarte reads
`oneway=no` as "not oneway", which is correct. They are worth removing for tidiness, at
whatever point that file is being edited anyway.

ids: 216, 282, 294, 346, 395, 435, 473, 542, 552, 657, 664, 741, 745, 856, 884, 957, 971,
1015, 1136, 1155, 1173, 1204, 1315, 1369, 1404, 1447, 1494, 1507, 1530, 1592, 1653, 1718,
1771, 2054, 2129, 2169, 2213, 2236, 2240.

## Deferred by decision, not an error

The seven Klagenfurt bathing spots (ids 452-458) still carry the old
`leisure=swimming_pool` instead of `swimming=yes`. This is deliberate: the outgoing
frontend tests `leisure === 'swimming_pool'`, so retagging before cutover would remove
them from the live site. See the cutover checklist in
`docs/superpowers/specs/2026-08-02-radlkarte-2026-design.md`.
