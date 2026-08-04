# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What this is

radlkarte.at is a static, vanilla-JS website (Leaflet map) that shows recommended
bicycle routes plus cycling-relevant POIs for several Austrian regions. There is no
build step and no framework: `index.html` loads jQuery, Leaflet and plugins, and
`radlkarte.js` directly, and route/POI data comes from GeoJSON files under `data/`.

## Commands

Python tests live in `data/test/` and run with pytest from the repository root:

    pytest

## Architecture

**Single global namespace.** All map state lives on one global object, `rkGlobal`
(defined at the top of `radlkarte.js`): the Leaflet map instance, per-region
configuration (`rkGlobal.configurations`), style/zoom-threshold constants, and
layer groups for both route segments (`rkGlobal.segments`) and POIs
(`rkGlobal.poiLayers`). There are no modules/imports — every script tag in
`index.html` contributes to the same global scope, in load order.

**Region switching drives everything.** Each region (wien, linz, klagenfurt, …) is
an entry in `rkGlobal.configurations` with a title, center coordinates, and an
optional `nextbikeUrl`. The current region is stored in the URL hash and handled by
a customized `leaflet-hash` plugin (`js/leaflet-hash-1.0.1-customized/`), which
calls `updateRadlkarteRegion()` on change. That function clears existing
segments/markers, loads `data/radlkarte-<region>.geojson` via `loadGeoJson()`, and
reloads whichever POI layers (Nextbike, OSM POI types) are currently visible.
Auto-switching to the region nearest the map center also runs off this path
(`rkGlobal.autoSwitchDistanceMeters`).

**Route rendering is data-driven from GeoJSON properties.** GeoJSON line features
carry `priority` (0=main/2=local) and `stress` (0=calm/2=stressful); these two
values drive color/width via `updateStyles()` / `getLineStyle()`, and zoom-based
visibility thresholds (`rkGlobal.priorityFullVisibleFromZoom`,
`priorityReducedVisibilityFromZoom`) control what's shown at each zoom level.
Optional flags (`oneway`, `steep`, `unpaved`) add decorators: arrow patterns via
`leaflet.polylineDecorator`, dash patterns, or bristle-like steep markers. Point
features (`dismount`, `nocargo`, `warning` + `description`) become problem-icon
markers via `createProblemMarkersIncludingPopup()`, split into low/high-zoom layer
groups.

**POI data has two independent sources**, both keyed by region:
1. OSM Overpass data, pre-downloaded per region/type into `data/osm-overpass/*.json`
   by `data/download_pois_from_osm.py` (run manually via `yarn pois*`, not at
   request time), then rendered client-side by `clearAndLoadBasicOsmPoi()`.
2. Live Nextbike bike-share data, fetched client-side per region's `nextbikeUrl`
   by `clearAndLoadNextbike()`.

**Route data authoring happens outside this repo's JS**, in JOSM: contributors edit
GeoJSON using `data/josm-radlkarte-style.mapcss` for visual feedback, then run
`data/prepare_geojson.py` (via `yarn geojson`) to minify, add a bounding box, and
assign stable `id`s before committing. See README.md for the full attribute
reference (`priority`, `stress`, `oneway`, `steep`, `unpaved`, `dismount`,
`nocargo`, `warning`, `description`).

**Third-party libraries are vendored, not installed.** Everything under `js/*` and
`css/font-awesome-*`, `css/roboto/`, `css/museo-*` is a checked-in copy of a
specific library version (Leaflet, sidebar, geocoder, polylineDecorator, hash
plugin, locate control, turf, jQuery, opening_hours.js) — there is no npm/yarn
dependency for the runtime site, only for dev tooling (`html5-lint`, `http-server`,
`jshint`). The `leaflet-hash` plugin is explicitly "customized" in-repo, so don't
expect upstream behavior to match.
