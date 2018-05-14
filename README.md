# radlkarte.at

Website for desktop, tablet & smartphone usage with the goal to provide useful (route) information for cyclists.

## Features
- Show recommended bicycle routes
  - Three quality types of route segments: calm, medium, stressful
  - Three importance levels of route segments: main, regional, local
    - Hide parts of the recommended routes when zooming out (for a better overview)
  - Oneway arrow for route segments only usable in one direction
- Show problematic points along the route where dismounting or usage of heavy/wide bicycles may not be possible
- GPS localization (especially useful for mobile devices)
- Geocoding with OSM (nominatim)

### Pending Usability Improvements
- Arrows in wrong size on fast zoom (synchronization issue of rendering method that is called more than once I fear)
- On Chrome/Android you need to double-tap on symbols to see the popup. Safari/iPhone works.
- Describe layer-switching & opencyclemap legend? explicitly show cycleways somehow (user request hotjar)?
- Make problem-POIs hidable in layer switcher

### Future Work
- Highlighting properties of lines:
  - very steep (e.g. double lines)
  - unpaved paths (e.g. dotted lines)
- Optional overlays for cycling-POIs such as citybike stations or bicycle shops
- Differentiate between a simple & an advanced UI.
  - simple: auto-hides parts of the network based on zoom level, no layer switcher
  - advanced: layer switcher, control opacity of overlay, freely choose network-parts to show
- Which background layer could we use as fallback if traffic gets too much for mapbox?
  basemap.at? (even better: use normal osm/openCycleMap for high zoom levels - more details!)


## Route Data

As input for the minifying script a GeoJSON file containing the routes is required with the following attributes.

### Line Attributes

Mandatory:
- priority: 0 (highest), 1 (medium), 2 (lowest)
- stress: 0 (no stress), 1 (medium), 2 (a lot of stress)

Optional (omitting the attributes means 'no'):
- oneway: yes (route only legal in one direction)
- steep: yes
- unpaved: yes (dirt, gravel or very uneven cobblestones)

### Point Attributes

- dismount: yes (bicycle must or should be pushed (in at least one direction), either due to legal restrictions or because it's a very dangrous spot)
- nocargo: yes (not feasible for heavy/extra-long/extra-wide bicycles, e.g. cargo bicycles or bikes with trailers due to e.g. stairs or chicanes)
- description: string explaining details about the dismount and/or nocargo restriction

### Edit Instructions

1. Download JOSM from josm.openstreetmap.de
2. Add the `josm-radlkartestyle.mapcss` under `edit > preferences > map settings (3rd buttom from the top) > map paint styles`
3. Create a new layer or load an .osm file
4. Edit the routes
5. Save the .osm file (for further editing, because JOSM can only load & edit .osm files)
6. Save the result to .geojson
7. Run the minify script


## Notes

linting:
    jshint radlkarte.js
    /usr/local/lib/node_modules/html5-lint/html5check.py index.html
