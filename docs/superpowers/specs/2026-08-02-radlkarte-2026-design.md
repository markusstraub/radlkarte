# Radlkarte 2026 — Design

Date: 2026-08-02
Status: approved, ready for implementation planning
Supersedes: `RADLKARTE_2026_DRAFT_SPEC.md`

## Goal

Rewrite radlkarte.at on MapLibre GL JS, replacing the Leaflet stack. The primary
driver is **interactive pan and zoom performance** for the route network: on the
current site, panning and zooming are visibly bad in every browser tested, while a
throwaway MapLibre prototype of the same network is smooth. Secondary drivers: load
all coverage areas seamlessly instead of switching regions, remove the stale-cache
problem (#48), and modernise the toolchain so dependencies can be maintained
rather than hand-vendored.

The rewrite is a big-bang on a branch: the new app is built alongside the current
site and replaces it when feature-complete. Leaflet and MapLibre share almost no
API surface, so incremental porting would mean maintaining two map engines at once.

## Scope

In scope:

- MapLibre GL JS rewrite with full feature parity (see "Feature parity" below)
- Seamless loading of all areas at once; region concept removed from data and state
- Vector base map (OpenFreeMap Positron) alongside the existing raster layers
- Problem-icon priorities
- New Tempo-100 Freilandstraße problem type
- Hillshading
- POI pipeline rework: dedupe across overlapping bboxes, native MapLibre rendering
- Vite + TypeScript build, npm dependencies
- CI deploy to the Debian server; structural fix for stale caching

Out of scope, deliberately:

- **Contour lines.** Needs `maplibre-contour` plus line styling and label placement
  that stays legible over the route network. Real value in hilly areas, but the most
  expensive item on the wish list. Own spec, later.
- **Network routing.** Start/end snapped to the network with an adjustable
  stress-avoidance weight. Needs a graph build step and its own UI. Own spec, later.
- **Sidebar UX redesign.** The sidebar is reimplemented, but its structure and content
  stay as they are. Changing engine and UX simultaneously would make regressions
  impossible to attribute.

## Feature parity

Everything below exists today and must still work after the rewrite:

- Route network: `stress` → colour, `priority` → line width
  - dashed for `unpaved=yes`
  - bristles for `steep=yes`
  - direction arrows for `oneway=yes`
- Problem icons with popups showing type and `description`, at low and high zoom
  - including the combined icon when a point carries both `dismount` and `nocargo`
- Bathing spots: `swimming=yes` points with their own icon and popup
- Controls: zoom buttons, scale bar, geolocation with follow, address search,
  base-layer switch, overlay switch
- Sidebar: Übersicht/Legende, News, Info, Download, Kontakt, Datenschutz
- Permalink URL covering map position and active overlays
- Raster base layers: OSM Mapnik, CyclOSM, OpenCycleMap, basemap.at Luftbild, Weiß
- Matomo virtual pageviews per area

## Architecture

### Map engine

MapLibre GL JS 6.x. The decision was reopened and re-confirmed; this section records
the reasoning so it is not relitigated.

**What is slow today, and why MapLibre fixes it.** The bottleneck is not the number of
features. `radlkarte.js` already merges the network with `turf.combine`, so Leaflet
receives 71 merged MultiLineStrings — one per distinct style combination — for 11,510
line features and ~85,000 vertices across all nine regions. The cost is per
interaction, not per feature: on every `zoomend`, `updateStyles()` calls `setStyle` on
all 71 layer groups and `setPatterns()` on the oneway decorators, which recomputes
every arrow position in JavaScript, and Leaflet re-projects and rewrites the `d`
attribute of every SVG path. In MapLibre the same styling is declarative — `step` and
`interpolate` expressions evaluated on the GPU — so no JavaScript runs on zoom at all,
and styling follows fractional zoom instead of stepping at integer levels.

**Published benchmarks disagree, and are not the relevant measurement.** Balla & Gede
(ICC 2025, doi:10.5194/ica-abs-10-14-2025) find Leaflet and OpenLayers fastest for line
features up to 50k, with MapLibre "significantly slower than all other libraries" and
carrying a ~350 ms fixed map-initialisation cost against ~35 ms. That benchmark
measures load-to-first-render, not sustained interaction, which is the axis that
matters here. A sub-second penalty on initial load is explicitly accepted.

**Secondary technical wins**, independent of performance:

- `symbol-placement: "line"` with `symbol-spacing` repeats and rotates the oneway
  arrows natively, removing both `leaflet.polylineDecorator` and `turf`.
- `icon-allow-overlap: false` declutters problem icons and POIs, which the Leaflet
  implementation never did.
- Vector base maps are native, enabling OpenFreeMap Positron.
- `line-dasharray` is expressed in multiples of line width, so dash patterns scale
  with zoom without the manual pixel arithmetic in `getUnpavedDashStyle`.
- Actively released: 6.1.0 (2026-07-30). Leaflet's stable release is still 1.9.4 from
  2023-05-18, with 2.0 in alpha since 2025-08-16.

**Accepted trade-offs:**

- **WebGL2 is required.** MapLibre 6 dropped WebGL1 support. Coverage is ~92–93%, and
  affected devices — chiefly old low-end Android phones — get no map rather than a slow
  one. Accepted, but it is a hard failure mode and should be watched after cutover.
- **Bundle size**: `maplibre-gl` is ~245 KB gzipped, against ~42 KB for Leaflet and
  ~82 KB for OpenLayers. Set against 588 KB of GeoJSON this is material but not
  dominant.
- MapLibre is ESM-only, which the Vite build handles.

**Alternatives considered and rejected:**

- **Stay on Leaflet and optimise** (batch restyling, `preferCanvas`, cheaper arrows).
  Cheapest option and the benchmarks favour it, but it does not deliver a vector base
  map, decluttering, or GPU-side zoom styling, and it leaves the project on a library
  whose stable release is three years old.
- **OpenLayers 10.x with `ol-mapbox-style`.** The strongest alternative: fast for
  lines, actively released, smaller. Rejected because repeated symbols along a line are
  not supported — `ol-mapbox-style` places a single symbol at the line midpoint
  (openlayers/ol-mapbox-style#230) and native OpenLayers requires manual
  `forEachSegment` placement, so the oneway arrows would stay hand-rolled — and it has
  no GPU-side equivalent of style expressions.
- **`maplibre-gl-leaflet` hybrid.** MapLibre would render only the base map while the
  network stayed in Leaflet, addressing none of the drivers, and input handling
  visibly lags because Leaflet owns the events.
- **deck.gl.** GPU line rendering, but no base map of its own, and dashes, arrows,
  labels and popups would all be hand-built.

### Build and dependencies

Vite + TypeScript. All vendored libraries are replaced by npm dependencies.

Removed: jQuery, turf, Leaflet, leaflet-sidebar-v2, leaflet.polylineDecorator,
leaflet-hash (customized), leaflet-locatecontrol, leaflet-control-geocoder.

Added: `maplibre-gl`. Kept but moved to npm: `opening_hours`.

TypeScript is chosen for a rewrite of this size: the GeoJSON property vocabulary
(`priority`, `stress`, `oneway`, `steep`, `unpaved`, `dismount`, `nocargo`,
`warning`, `speed100`) and the MapLibre style API both benefit from compile-time
checking. The cost is a higher barrier for casual contributors, who today can edit
a single plain `.js` file. This is accepted; data contributors work in JOSM and are
unaffected.

### Module structure

The `rkGlobal` god-object is removed. Source is split into modules that each own
their own state and expose a narrow interface:

- `map/` — style construction, layer definitions, icon registration
- `data/` — network loading and merge, POI loading, Nextbike
- `ui/` — sidebar, layer switcher, city list, search, popups
- `state/` — URL hash serialisation, Matomo tracking

Python tooling stays Python: `prepare_geojson.py` and `download_pois_from_osm.py`
keep their current roles; `merge_pois.py` is new.

### Network data loading

All 8 region GeoJSONs (`bruckleitha`, `klagenfurt`, `linz`, `noe-suedost`,
`rheintal`, `steyr`, `stpoelten`, `wien`) are fetched in parallel on load and merged
into one MapLibre GeoJSON source, appended via `setData` as each response arrives.
Nothing is ever unloaded.

Measured cost: 588 KB gzipped for all 8 regions (385 KB brotli); Wien alone is
167 KB. For comparison, one screenful of raster base map tiles is 400–800 KB. Total
network data therefore costs roughly the same as a single screen of the base map the
user downloads anyway.

**This depends on compression, which is currently not enabled for GeoJSON** (see
"Caching and compression" below — today Wien is served as 1.1 MB uncompressed).
Enabling it is a prerequisite for this loading strategy, not an optimisation: without
compression, eager-loading all areas would put 3.4 MB on the wire.

On-demand loading by bounding box was considered and rejected: it saves at most
~420 KB in the best case and nothing when zoomed out to Austria, while adding
viewport-intersection tests, partial-data edge cases, and a milder version of the
pop-in the rewrite is meant to eliminate.

The region nearest the initial viewport is fetched with `fetch(url, {priority:
'high'})` so first paint matches today's single-region load. This is a three-line
optimisation; if it fights the browser in practice, drop the hint and render regions
in arrival order.

Per-region files are retained rather than merged in CI. They match the authoring
model (one person responsible per area) and give per-region cache invalidation — a
Wien edit does not invalidate the other seven downloads.

`radlkarte-rendertest.geojson` and `radlkarte-example.geojson` are development
fixtures and must not enter the merged production source. Today `rendertest` is
reachable as a hidden region via the URL hash; since regions no longer exist, it
becomes a dev-only opt-in — loaded when the app runs against the Vite dev server, or
behind an explicit query parameter. `download_pois_from_osm.py` already excludes both
files and continues to.

Vector tiles (PMTiles/tippecanoe) were considered and rejected. They only start
earning their complexity in the tens of megabytes, and the covered areas are not
expected to grow substantially.

### Region concept

Regions are removed from the data layer, from application state, and from the URL.
The auto-switch-by-distance logic is deleted.

What remains is a list of named areas with center coordinates, used for three things:

1. A city list in the sidebar; clicking an entry does `flyTo` on that center.
2. Deriving a label for Matomo (see below).
3. Redirecting legacy permalinks.

Adding a new area means adding a GeoJSON file plus a name and center to that list.

### Matomo

The existing mechanism is unchanged: `setCustomUrl('/<region>')` +
`setDocumentTitle` + `trackPageView`. Only the trigger changes.

On a debounced `moveend` (~1–2 s of map idle), the map center is matched against
region bounding boxes — the bbox `prepare_geojson.py` already writes into each file —
falling back to the nearest region center. A virtual pageview fires only when the
derived value differs from the last one tracked. When the map is outside all
coverage areas or below a minimum zoom threshold, the bucket is `/overview`.

Because the virtual URLs are unchanged, historical statistics stay comparable.
Expect a step in the graphs at cutover regardless: today a visit produces 1–3
discrete region views, whereas free panning can cross several areas. Debouncing on
map idle and the zoom threshold keep this bounded.

If per-visitor rather than per-view counts are wanted later, a visit-scoped Matomo
Custom Dimension set to the first region viewed provides that. It requires one
configuration change in the Matomo admin UI and is not part of this work.

### POI pipeline

Overpass downloads stay per region with small bounding boxes. Austria-wide queries
are not viable — the relation-heavy `subwayLines` and `railwayLines` queries, which
iterate every route's stops with `foreach`, would exceed Overpass timeouts at country
scale. Downloads continue to run from the server's IP, which has working reputation
with the public Overpass instances.

A new post-processing step, `merge_pois.py`, runs after download:

1. **Deduplicate** across overlapping region bounding boxes on the OSM `type/id` key
   (`node/123`, `way/456`). This is newly required, not merely nice: bruckleitha,
   wien and noe-suedost overlap around Vienna, and duplicates are invisible today
   only because a single region's file is loaded at a time.
   The synthetic elements produced by the `convert` statements in `subwayLines` and
   `railwayLines` have no stable OSM id — they are one element per (route, stop)
   pair — so those keep the name-based deduplication currently done in the browser,
   moved to build time.
2. **Extract** the fields popups need from the OSM tag soup — name, address, website,
   `opening_hours` — instead of parsing tags client-side. `opening_hours` is kept as
   a raw string; the `opening_hours` library still evaluates "open now" at popup time.
3. **Emit** one region-agnostic GeoJSON per POI type into `data/poi/`, e.g.
   `data/poi/bicycleShop.geojson`.

POI data is not committed to git. Raw Overpass responses remain a local cache on the
server.

### Nextbike

Today one request per region `nextbikeUrl`. The union of all configured domains is
`la,eq,ka,al,wr`, so this collapses to a single request covering every area.

## Map rendering

One MapLibre GeoJSON source for the network, with **one line layer per priority
level** rather than a single layer driven by a priority expression. This gives exact
z-ordering through style layer order — replacing `getSegmentZIndex` — and lets each
layer use simple constants for width, opacity and zoom thresholds instead of nested
expressions.

- **Stress → colour**: `["match", ["get","stress"], …]` over the existing three
  colours (`#004B67`, `#51A4B6`, `#FF6600`).
- **Priority → width**: per-layer zoom interpolation preserving the current
  `lineWidthFactor` values.
- **Zoom visibility**: `priorityFullVisibleFromZoom` and
  `priorityReducedVisibilityFromZoom` become per-layer opacity `step` expressions.
- **`unpaved`**: a separate dashed line layer. MapLibre's `line-dasharray` units are
  multiples of line width, so the dash pattern scales with zoom automatically and the
  manual pixel-dash computation in `getUnpavedDashStyle` disappears.
- **`steep`**: the same technique as today — a wider dashed line beneath the main
  line producing the bristle comb.
- **`oneway`**: a `symbol` layer with `symbol-placement: "line"`. Arrows follow line
  direction natively and respace on zoom. This removes both `leaflet.polylineDecorator`
  and `turf`.
- **Problem icons and POIs**: symbol layers. The ~30 existing SVGs are registered at
  runtime with `map.addImage()`; at this count a generated sprite sheet is not worth
  the toolchain. `icon-allow-overlap: false` provides automatic decluttering, which
  the Leaflet implementation never had.

### Base layers

- **Straßenkarte** (default): OpenFreeMap Positron vector tiles at z0–15, OSM Mapnik
  raster at z16–19. This is a direct modernisation of today's stacked layer (CARTO
  Positron + Mapnik), so the full OSM detail at high zoom is preserved and the
  behaviour users know is unchanged. MapLibre layers a raster source over vector
  layers natively.
- **Luftbild**: basemap.at Orthofoto 30 cm (unchanged)
- **CyclOSM** (unchanged)
- **OpenCycleMap**: Thunderforest (unchanged, key remains in the client)
- **Weiß**: empty

OpenFreeMap is chosen because it needs no API key, has no quota, no registration and
no tracking, and its Positron style is the "visually simple, low detail" look the
draft asks for. It is donation-funded with no SLA; the raster layers remain available
as fallbacks if it is ever unreachable.

### Overlays

Problem icons, Leihräder (Nextbike), the six OSM POI types, and hillshading.

**Hillshading** uses basemap.at's Geländedarstellung as a toggleable
semi-transparent raster layer — Austrian, free, no key, and consistent with the
existing basemap.at Luftbild usage.

## Problem icons

### Priority

Point features gain an explicit `priority` attribute (0/1/2), the same vocabulary as
line segments, authored in JOSM. The mapper decides: a genuinely nasty spot on a
local route can still be flagged prominently.

Two point categories that already exist are easy to lose in the rewrite and are called
out here because `getProblemIcons` (`radlkarte.js:1002`) is the only place they are
written down today:

- **`swimming=yes`** is a rendered point category with its own icon
  (`css/swimming.svg`), not a problem type. It takes `description` and `priority` like
  any other point.

  Renamed from `leisure=swimming_pool` so that every radlkarte attribute uses the same
  yes-flag format instead of borrowing an OSM tag. **The seven Klagenfurt bathing spots
  (`radlkarte-klagenfurt.geojson` ids 452-458) are retagged at cutover, not before**:
  the outgoing frontend tests `leisure === 'swimming_pool'` (`radlkarte.js:1002`), so
  retagging early would make them vanish from the live site. Until then they render on
  production and nowhere in the rewrite. `leisure` is no longer a recognised key, so
  `prepare_geojson.py` passes those points over in silence rather than reporting them.
- **`dismount` + `nocargo` together** render a single combined icon, not two
  overlapping ones. A naive one-symbol-layer-per-attribute design would draw both.

Neither is a problem attribute, so `prepare_geojson.py` validates their values but
never requires their presence — see below.

Derivation from the nearest line segment was considered and rejected — it is fragile
where routes of different priority meet at junctions, and gives the mapper no way to
override a bad guess.

Required changes: `data/josm-radlkarte-style.mapcss` gains visual feedback for the
attribute, and `prepare_geojson.py` validates it. When the attribute is absent the
default is 1 (medium prominency).

**Validation checks values, never presence.** A recognised key with a bad value is
reported (`warning=2`, `priority=-1`, `swimming=pool`); a point carrying none of the
recognised keys is passed over in silence. Requiring presence was tried and measured
first: it flagged 369 of 948 points, of which 6 were real mistakes. The rest are JOSM
export artifacts — points with no properties at all, or with way attributes such as
`priority`+`stress` on a node — which the map has always silently skipped. Under the
value-only rule the same data yields exactly those 6 real mistakes, which makes the
script's exit code meaningful enough to gate on later.

**Consequence: this is a data migration, done by hand.** No existing problem point
carries the attribute, so all of them fall back to priority 1 and pick up that
level's higher zoom threshold and smaller icon. Icons that are visible at overview
zooms today will not appear until someone raises them to 0 explicitly. This is
intended — the default should be the middle of the range, not the loudest — but it
means the person responsible for each area has to review their problem points in JOSM
and set `priority` where the fallback is wrong. The work is per-area and can proceed
gradually after cutover; it does not block the rewrite, and no migration script is
appropriate, since only the area maintainer can judge which spots deserve prominence.

### Visual treatment

Lower priority means both a higher zoom threshold and a smaller icon, mirroring what
line priorities already do. Problem icons appear from progressively higher zoom
levels as priority decreases (replacing the single `problemIconThreshold = 14`), with
a size step down per level. This declutters the overview zooms, where crowding
actually hurts, while keeping everything findable close up.

### New problem type

`speed100` — Freilandstraße with a 100 km/h limit. Requires a new icon, a new
attribute recognised by `prepare_geojson.py` and the mapcss style, a symbol layer,
and popup text. It behaves like the existing `dismount`/`nocargo`/`warning` types in
every other respect.

## UI

### Sidebar

Hand-rolled: a tab strip plus panes overlaid on the map. It does not need to be a map
control, so replacing `leaflet-sidebar-v2` costs roughly 100 lines of TypeScript and
CSS. The existing German content (Übersicht/Legende, News, Info, Download, Kontakt,
Datenschutz) moves over unchanged.

The Übersicht pane's list of covered cities becomes the area navigation: clicking an
entry flies the map to that area's center.

### Address search

Photon (`photon.komoot.io`), replacing OpenCage. Measured against real Austrian
queries, with map-center bias applied to both:

| Query | Photon | OpenCage |
| --- | --- | --- |
| `Marihilfer Strase 100 Wien` | Mariahilfer Straße 100, 1070 | "Wien" (confidence 4) |
| `Landstrasser Hauptstrase 20 Wien` | Landstraßer Hauptstraße 20, 1030 | "Wien" |
| `Kärtner Ring Wien` | Kärntner Ring, 1010 | "Wien" |
| `Klagenfurth Bahnhof` | Bahnhof Klagenfurt Viktring | no results |
| `Mariahilfer Str` (prefix) | Mariahilfer Straße | Museumsquartier ranked first |

OpenCage wraps Nominatim and inherits its exact-match behaviour, so every misspelling
collapses to a city centroid. Photon is Elasticsearch-backed with fuzzy matching and
was built for search-as-you-type.

Three mitigations are required:

- **Noise**: Photon indexes POIs alongside addresses, so the exact query
  `Mariahilfer Straße 100` returns "Piercing Studio Wien" first. Passing
  `layer=house&layer=street&layer=locality&layer=city` removes this; verified.
- **No `formatted` field**: the display label is assembled from the structured
  properties (`name`, `street`, `housenumber`, `postcode`, `city`).
- **Near-duplicate rows**: the same address appears multiple times from different OSM
  objects; deduplicate client-side on street + housenumber + postcode.

Photon's public instance is fair-use with no SLA. The existing "Leider nicht gefunden"
error path covers failures. If it ever becomes unreliable, self-hosting Photon on an
Austria extract is possible on the existing Debian server — noted as an escape hatch,
not planned work.

Switching also removes the OpenCage API key currently committed in the client bundle.

### URL hash

Carries map position (zoom, lat, lng), active overlays, and the selected base layer.
The region is gone. Base layer is newly included — today's hash carries only position
and POI overlays.

**Legacy redirect**: on load, a hash matching a known region name (e.g.
`radlkarte.at/#wien`) flies the map to that area's center at the default zoom and
rewrites the hash to the new format. This keeps links in the wild working, including
the `<a href="#bruckleitha">`-style anchors in the current sidebar.

## Deployment

Code deploys from CI; data refreshes on the server. The two have genuinely different
lifecycles — a POI refresh should not require a code deploy, and vice versa.

**GitHub Actions**, on push to `main`: `npm ci && npm run build`, then rsync `dist/` to
the Debian server over SSH using a deploy key stored as a repository secret. This
replaces the current `git pull` on the server and keeps the Node toolchain off
production, so build failures surface in CI rather than on the live site.

**Server cron**, weekly: runs the per-region Overpass downloads exactly as today,
then `merge_pois.py`, writing `data/poi/*.geojson`. Overpass queries keep the
server's IP reputation. Running them from GitHub Actions was rejected: runner IPs are
shared and Overpass slot allocation from them is unpredictable.

The POI scripts are deployed with the site, so cron invokes the deployed copy.

**Deploy must not delete cron-generated data.** POI output lives in a directory
outside the deploy root and is served under its public path via an Apache `Alias`, so
an rsync with `--delete` physically cannot touch it.

## Caching and compression

The server is Apache on Debian.

### Diagnosis

Measured against the live site, both the stale-cache bug (#48) and a second,
previously unnoticed problem share one root cause:

| Asset | Compressed | Cache-Control |
| --- | --- | --- |
| `index.html` | yes | none |
| `radlkarte.js` | yes | `max-age=86400` |
| `*.geojson` | **no** | **none** |

`mod_deflate` and the cache headers are both configured by MIME type. The
`AddType` for `application/geo+json` was added correctly, but that type was never
added to `AddOutputFilterByType` or to the expires configuration, so GeoJSON falls
through both lists.

**Compression.** `radlkarte-wien.geojson` is served as 1.1 MB uncompressed where it
would be 167 KB gzipped — a 6.6× reduction. Across all regions, 3.4 MB versus
588 KB. This should be fixed on the live site immediately; it does not depend on the
rewrite, and the rewrite's eager-loading strategy depends on it.

**Caching.** With no `Cache-Control` and no `Expires`, browsers apply **heuristic
freshness** (RFC 9111 §4.2.2): given only a `Last-Modified`, they invent a lifetime
of roughly 10% of the elapsed time since that date. A file last modified six months
ago is treated as fresh for about eighteen days. Nothing in the configuration looks
wrong, because the caching is entirely the browser's invention.

This also explains why Ctrl+F5 does not help. A hard reload forces revalidation for
the document and for subresources the page requests, but `loadGeoJson()` fetches via
`$.getJSON` after page load. JS-initiated fetches use the normal cache mode, so the
hard-reload bypass never reaches them.

Both halves of the fix below address this independently: content-hashed filenames
change the URL whenever the content changes, and explicit headers stop the browser
guessing. The server must start sending `Cache-Control` — a required Apache change,
not something the build can do on its own.

### Strategy

| Asset | Strategy |
| --- | --- |
| JS/CSS bundles | Vite content-hashed filenames → `Cache-Control: public, max-age=31536000, immutable` |
| `index.html` | `Cache-Control: no-cache` (revalidate; cheap 304) |
| Region GeoJSONs | Run through Vite as hashed assets (`import.meta.glob(..., {query:'?url'})`) → immutable, no manifest needed |
| POI GeoJSONs | Written by cron, outside the build → `Cache-Control: no-cache` with ETag |

Everything the build produces therefore cannot go stale by construction.

The required Apache changes (needs `mod_deflate`, `mod_headers`, `mod_alias`):

```apache
# 1. compression for GeoJSON — apply to the live site now, independent of the rewrite
AddOutputFilterByType DEFLATE application/geo+json

# 2. hashed build output — safe to cache forever
<FilesMatch "-[0-9a-zA-Z_-]{8,}\.(js|css|geojson)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>

# 3. entry point — always revalidate
<Files "index.html">
    Header set Cache-Control "no-cache"
</Files>

# 4. cron-written POI data, outside the deploy root so rsync --delete cannot touch it
Alias /data/poi /var/lib/radlkarte/poi
<Directory /var/lib/radlkarte/poi>
    Require all granted
    Header set Cache-Control "no-cache"
</Directory>
```

The hashed-filename pattern in (2) must be checked against Vite's actual output
during implementation rather than assumed.

Acceptance checks:

- `curl -sI --compressed <geojson-url>` returns `content-encoding: gzip`.
- Deploy, change a region GeoJSON, redeploy, and confirm a returning browser picks up
  the change on a normal reload without a hard refresh.

## Testing

**pytest** (existing suite in `data/test/`, extended): coverage for `merge_pois.py`,
with emphasis on deduplication across overlapping bounding boxes — the failure most
likely to go unnoticed, since duplicates render as plausible-looking extra markers.
Also the new `priority` and `speed100` validation in `prepare_geojson.py`.

**Vitest** for pure TypeScript logic: hash parse/serialise including the legacy
region redirect, region derivation from map center, Photon result normalisation and
deduplication, opening-hours formatting.

**Playwright** smoke suite: map loads, network renders, overlays toggle, permalink
round-trips, legacy hash redirects. A small suite, but it carries more weight than
usual when every layer of the stack is replaced at once.

## Risks

- **OpenFreeMap availability.** Donation-funded, no SLA. Mitigated by keeping all
  raster base layers selectable.
- **Photon availability.** Public instance is fair-use. Mitigated by the existing
  error path; self-hosting is a known escape hatch.
- **Rendering fidelity.** The `steep` bristle effect is the least certain visual to
  reproduce, since it depends on dash geometry relative to line width. Verify against
  `data/radlkarte-rendertest.geojson` early rather than late.
- **Matomo discontinuity.** Per-area numbers will step at cutover because the
  trigger semantics change. Expected and accepted; noted here so the graphs are not
  misread later.
- **Contributor barrier.** TypeScript and a build step raise the bar for casual code
  contributions. Data contributors, who work in JOSM, are unaffected.
- **Problem icons are quieter at cutover.** Every existing problem point defaults to
  priority 1, so some icons visible at overview zooms today disappear until area
  maintainers set `priority` in JOSM. Intended, but it depends on other people's work
  and lands as a visible change for users, so it needs announcing rather than
  shipping silently.
- **Bathing spots disappear if the retag is missed.** The seven Klagenfurt points still
  carry `leisure=swimming_pool`; the rewrite only renders `swimming=yes`. The retag is
  deliberately deferred to cutover because doing it earlier breaks the live site, which
  means it is a step that has to happen *during* the switch, not before or after. See
  the cutover checklist below.

## Cutover checklist

Steps that cannot be done ahead of time because they would break the live site, and
cannot be forgotten because they are user-visible:

1. Retag the seven Klagenfurt bathing spots from `leisure=swimming_pool` to
   `swimming=yes` (`radlkarte-klagenfurt.geojson` ids 452-458), then run
   `npm run geojson -- <file>` on it. Doing this before cutover removes them from production;
   not doing it at cutover removes them from the rewrite.
2. Apply the Apache changes from "Caching and compression" — compression for
   `application/geo+json` is a prerequisite for eager-loading every area, not an
   optimisation.
3. Announce the problem-icon prominence change to area maintainers, with the list of
   points still lacking an explicit `priority`.
- **WebGL2 hard requirement.** Devices without WebGL2 lose the map entirely instead of
  degrading. See "Map engine" for the accepted reasoning; the mitigation, if the loss
  turns out to be visible in the Matomo device breakdown, is a static fallback notice
  rather than a second render path.
- **Caching depends on a server change.** The build cannot emit headers by itself. If
  the Apache change is missed at cutover, hashed assets still work correctly, but the
  cron-written POI files inherit the same heuristic-freshness bug that #48 describes.
