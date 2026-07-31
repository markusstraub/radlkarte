# Features

## Keep existing features

- Route network with color representing `stress` and line width representing `priority`
  - dashed style for `unpaved=yes`
  - bristles for `steep=yes`
  - oneway arrows for `oneway=yes`
- Problem icons (both low and high zoom versions)
  - Popups with type and `description`
- Controls
  - zoom buttons
  - scale legend
  - location (go to current GPS location and keep following it)
  - geocode / search for address
  - base layer switch: (1) pale vector map with low details (2) high detail map, e.g. OSM mapnik (3) OpenCycleMap
  - marker layer switch (problem icons & OSM POIs)
- Sidebar with info about radlkarte, legend, contact,..
- Permalink URL 
  - zoom & location
  - POI layers
  - current region (for Matomo statistics)
- OpenStreetMap Mapnik, Cyclosm, OpenCycleMap,.. as raster base layer

## New / improved features

- Use the most recent version of https://github.com/maplibre/maplibre-gl-js instead of Leaflet. The main goal behind this change: better performance (when drawing our radlkarte network)
- Visually simple OpenStreetMap base layer with vector tiles (as an additional option to the old raster base layers)
- Load all radlkarte areas seamlessly at once. Why?
  - Seamless transition for the user (instead of network parts blinking in and out)
  - Easier maintenance of radlkarte networks (split the networks into areas where one person is responsible, no more overlapping parts)
  - no need to invent names for the coverage areas
- introduce priorities for problem icons (problems on prio2 routes should not be that prominent)
- introduce a new problem icon for Freilandstraßen Tempo 100
- avoid stale cached geojsons (that can't even be updated through ctrl+f5) see #48 
- check if we can still have basic Mapnik for high zoom levels (full details of OSM are useful!)
- support for hillshading / contour lines in map?

### Gotchas
- How to handle the POI downloading process? Currently it is per .geojson. We don't want to strain the overpass API!

## Major possible future features
- Routing on the radlkarte network: user selects start and end point and gets a route on the radlkarte network (origin/destination are simply snapped to the network, no real routing on OpenStreetMap involved!)
  - User should be able to adjust sensitivity to stressful segments (from completely avoiding them to fully accepting them)
