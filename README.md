# radlkarte

## Features

- show recommended bicycle routes
  - three quality types of route segments: calm, medium, stressful
  - three importance levels of route segments: main, regional, local
  - oneway arrow for route segments only usable in one direction

### Future Work
- GPS localization (especially for smartphones)
- hide parts of the recommended routes when zooming out (two / three importance levels?)
- Simple & Advanced UI.
  - simple: auto-hides parts of the network based on zoom level, no layer switcher
  - advanced: layer switcher, control opacity of overlay, freely choose network-parts to show
- add OpenCycleMap? http://thunderforest.com/maps/opencyclemap/
- add basemap.at as background layer?
- Visualize short parts where bicycle has to be pushed
- Geocoding (Google Maps? wien.gv.at?)
- nicer opacity? not possible with current approach: https://github.com/Leaflet/Leaflet/issues/3610
  but maybe just add the background layer on top again with high opacity?
