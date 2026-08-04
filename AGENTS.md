# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What this is

radlkarte.at shows recommended bicycle routes plus cycling-relevant POIs for several
Austrian regions.

**This repository is mid-rewrite.** The 2026 redesign replaces the entire frontend
stack; the data tooling has already been rebuilt. Read the design before changing
anything:

- Design spec: `docs/superpowers/specs/2026-08-02-radlkarte-2026-design.md`
- Implementation plans: `docs/superpowers/plans/`

The spec is the authority on intended behaviour. Where this file and the spec
disagree, the spec wins and this file needs updating.

## Commands

    pytest                          # Python tests (data/test/), from the repository root
    npm install                     # dev tooling; npm, not yarn (see below)
    npm run geojson -- <file>       # minify + bbox + stable ids + validate an authored GeoJSON
    npm run pois                    # download POIs from Overpass, per region, into data/osm-overpass/
    npm run pois:merge              # merge those downloads into data/poi/<type>.geojson

npm consumes anything starting with `-` as its own option, so flag arguments must
follow a `--`: `npm run pois -- --only-region wien`. Without it npm warns
`Unknown cli config` and the script runs with no arguments. Plain paths pass through
either way; always using `--` is the safe habit.

## Target architecture

**MapLibre GL JS, Vite and TypeScript.** The route network is drawn with one line
layer per priority level, so z-ordering comes from style layer order rather than
computed z-indexes. Zoom-dependent width, opacity and visibility are declarative
`step`/`interpolate` expressions evaluated on the GPU — no JavaScript runs on zoom.
Oneway arrows are a `symbol` layer with `symbol-placement: "line"`. Problem icons and
POIs are symbol layers with `icon-allow-overlap: false` for automatic decluttering.

The decision to use MapLibre was reopened and re-confirmed; the reasoning, the
rejected alternatives (staying on Leaflet, OpenLayers, deck.gl, a hybrid) and the
accepted trade-offs — notably that MapLibre 6 requires WebGL2 — are recorded in the
spec's "Map engine" section. Do not relitigate without reading it.

**No region concept.** All coverage areas load at once and nothing is ever unloaded.
Regions survive only as sidebar navigation bookmarks, a derived Matomo label, and a
legacy-hash redirect. Region is gone from the data layer, application state and URL.

**Source is modular**, replacing the single `rkGlobal` god-object: `map/` (style
construction, layers, icons), `data/` (network and POI loading), `ui/` (sidebar, layer
switcher, search, popups), `state/` (URL hash, Matomo).

## Data pipeline

Route data is authored by hand; POI data is generated. They have separate lifecycles —
code deploys from CI, POI data refreshes from cron on the server.

**Route data** lives in `data/radlkarte-<region>.geojson`, one file per area with one
person responsible for each, and is committed to git. Contributors author it in JOSM
using `data/josm-radlkarte-style.mapcss` for visual feedback, then run
`npm run geojson` (`data/prepare_geojson.py`) to minify, compute the bbox and assign
stable `id`s.

`prepare_geojson.py` also validates point attributes. It **checks values, never
presence**: a recognised key carrying a bad value is reported and the process exits
non-zero, while a point carrying none of the recognised keys is passed over in
silence. That distinction is deliberate — requiring presence was measured first and
flagged 369 of 948 points, of which 6 were real mistakes and the rest were JOSM export
artifacts. The MapCSS style mirrors the same rules as red highlights, so the two must
be kept in sync when the vocabulary changes. README.md holds the attribute reference
and the meaning of each highlight colour.

**POI data** is generated in two steps and is **not** committed to git:

1. `data/download_pois_from_osm.py` (`npm run pois`) queries Overpass once per region and
   POI type into `data/osm-overpass/<region>-<type>.json`. Queries stay per-region with
   small bounding boxes because Austria-wide queries exceed Overpass timeouts, and they
   run from the server's IP, which has working reputation with the public instances.
2. `data/merge_pois.py` (`npm run pois:merge`) merges those into one region-agnostic
   `data/poi/<type>.geojson` per type — the POI source the frontend reads. It
   deduplicates across overlapping region bounding boxes, flattens the OSM tag soup to
   the fields popups need, and writes deterministic output so repeated cron runs do not
   churn HTTP caches.

   Two behaviours worth knowing before changing it. Regions are refreshed
   independently, so their Overpass snapshots differ in age: sources are processed
   freshest-first so that the newest copy of a duplicated POI wins, along with its
   `dataDate`. And a POI type with no source file at all is **skipped**, not written as
   an empty collection — otherwise one failed download would replace a good file with
   nothing and silently empty a map layer.

Deduplication is load-bearing, not cosmetic: bruckleitha, wien and noe-suedost overlap
around Vienna, and since every area now loads simultaneously, duplicates would render
as plausible-looking extra markers. Regular POIs dedupe on the OSM `type/id` key.
Transit cannot — the `convert` statements in the `subwayLines`/`railwayLines` queries
emit one synthetic element per (route, stop) pair, so ids repeat by design — and
dedupes by station name instead, with one shared set across the subway and railway
passes so a station served by both appears once.

Popup properties emitted per feature: `osmType`, `osmId`, `dataDate`, and, when
present, `name`, `address`, `website`, `openingHours`, `phone`, `operator`. Transit
features add `transitType` and a `lines` list of `{ref, colour}`, where `colour` may be
`null`. `openingHours` is deliberately a raw OSM string — the `opening_hours` library
evaluates "open now" client-side against the viewer's clock.

Live Nextbike data is fetched client-side and is not part of this pipeline. A single
request covers every area.

## Legacy code being replaced

`index.html`, `radlkarte.js` and everything under `js/` are the outgoing Leaflet
implementation: one global `rkGlobal` object, region switching driven by a customised
`leaflet-hash` plugin, POIs read straight from `data/osm-overpass/`, and every
third-party library vendored as a checked-in copy rather than an npm dependency. It is
still what production serves.

Treat it as reference, not as a pattern to extend. New work belongs in the rewrite, and
the vendored libraries (jQuery, Leaflet, turf, polylineDecorator, sidebar, geocoder,
locate control, hash plugin) are all slated for removal — `opening_hours` is the one
kept, moved to npm.
