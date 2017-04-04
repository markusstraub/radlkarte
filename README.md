# radlkarte.at

online map with the goal to provide useful (route) information for cyclists

## Features
- show recommended bicycle routes
  - three quality types of route segments: calm, medium, stressful
  - three importance levels of route segments: main, regional, local
    - hide parts of the recommended routes when zooming out
  - oneway arrow for route segments only usable in one direction
- GPS localization (especially useful for mobile devices)
- geocoding with OSM (nominatim)

### Usability Improvements

- i fa-info statt fragezeichen für details
- explicit zoom in/out buttons (already two users noted they can't zoom)
- smaller size footprint of info-bar. especially on mobile devices it would be good to already see the map when the website opens. minimize it by default?
- describe layer-switching & opencyclemap legend? explicitly show cycleways somehow (user request hotjar)?

### Future Work
- highlighting problematic points along the route
  - problem=dangerous: a dangerous spot (typically a crossing)
  - problem=dismount: bicycle should be pushed. either due to legal restrictions or because it's a dangerous spot. the spot can be used with trailers / cargo bicycles.
  - problem=nocargo: only regular bicycles can be used (no cargo bikes, no trailers) because of e.g. stairs or extremely narrow turns (e.g. Bahnübergang Lobau)
  - other classification: (push-because-dangerous), push-because-forbidden, no-cargo-bikes (because of stairs/narrow turns)
  - can a spot fulfill both conditions? -> yes! .. so tagging should be differnt & a combined symbol is required!
- highlighting properties of lines:
  - very steep (e.g. double lines)
  - unpaved paths (e.g. dotted lines)
- optional overlays for cycling-POIs such as citybike stations or bicycle shops
- differentiate between a simple & an advanced UI.
  - simple: auto-hides parts of the network based on zoom level, no layer switcher
  - advanced: layer switcher, control opacity of overlay, freely choose network-parts to show
- which background layer could we use as fallback if traffic gets too much for mapbox?
  basemap.at?

## Notes

linting:
    jshint radlkarte.js
    /usr/local/lib/node_modules/html5-lint/html5check.py index.html
