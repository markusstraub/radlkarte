# radlkarte

## Features

- show recommended bicycle routes
  - three quality types of route segments: calm, medium, stressful
  - oneway segments (arrows)


### Desired Feature List
- handle oneway arrows properly (width does not change now on zoom)
- hide parts of the recommended routes when zooming out (two / three importance levels?)
- Simple & Advanced UI.
  - simple: auto-hides parts of the network based on zoom level, no layer switcher
  - advanced: layer switcher, control opacity of overlay, freely choose network-parts to show
- add OpenCycleMap? http://thunderforest.com/maps/opencyclemap/
- add basemap.at as background layer?
- Visualize short parts where bicycle has to be pushed
- Geocoding (Google Maps? wien.gv.at?)
- GPS localization (especially for smartphones)
- nicer opacity? not possible with current approach: https://github.com/Leaflet/Leaflet/issues/3610
