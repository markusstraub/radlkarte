# radlkarte.at

Website for desktop, tablet & smartphone usage with the goal to provide useful (route) information for cyclists.

![radlkarte banner](css/radlkarte-banner.jpg)

> If you use the software and/or route data the preferred way to credit is: **© radlkarte.at - Radlobby Österreich**

## Features
- Show recommended bicycle routes
  - Three quality types of route segments: calm, medium, stressful
  - Three importance levels of route segments: main, regional, local
    - Hide parts of the recommended routes when zooming out (for a better overview)
  - Special properties of the routes
    - Oneway (arrow)
    - Steep (bristles)
    - Unpaved (dotted lines)
- Automatically switch to the bicycle routes of the currently viewed region
- Show problematic points along the route where dismounting or usage of heavy/wide bicycles may not be possible
- GPS localization (especially useful for mobile devices)
- Geocoding (address search)


## Route Data

Route data is stored in .geojson format with the following attributes.

### Line Attributes

Mandatory:
- priority: 0 (highest), 1 (medium), 2 (lowest)
- stress: 0 (no stress), 1 (medium), 2 (a lot of stress)

Optional (omitting the attributes means 'no'):
- oneway: yes (route only legal in one direction)
- steep: yes (very steep,
- unpaved: yes (dirt, gravel or extremely uneven surfaces even though they are paved)

### Point Attributes

- dismount: yes (bicycle must or should be pushed (in at least one direction), either due to legal restrictions or because it's a very dangrous spot)
- nocargo: yes (not feasible for heavy/extra-long/extra-wide bicycles, e.g. cargo bicycles or bikes with trailers due to e.g. stairs or chicanes)
- warning: yes (problematic location, should be combined with the `description` attribute)
- description: string explaining details (shown to the users via popup)

### Edit Instructions

1. [Download JOSM](https://josm.openstreetmap.de)
2. Add [josm-radlkarte-style.mapcss](data/josm-radlkarte-style.mapcss) in `edit > preferences > map paint styles`
3. Load an existing radlkarte .geojson file, e.g. [radlkarte-example.geojson](data/radlkarte-example.geojson), or create a new layer.
4. Edit routes
5. Save the result as .geojson (not as .osm!)
6. Minify the .geojson with [minify_and_sort_geojson.py](data/minify_and_sort_geojson.py)


## Development

To test locally with Firefox go to `about:config` and set `privacy.file_unique_origin=false`, this allows local CORS requests.

Linting:

	sudo npm i -g jshint html5-lint
	/usr/local/lib/node_modules/html5-lint/html5check.py index.html
	jshint radlkarte.js

### Known Bugs
- Arrows in wrong size on fast zoom (synchronization issue of rendering method that is called more than once I fear)

### Future Ideas
- Describe layer-switching & opencyclemap legend? explicitly show cycleways somehow (user request hotjar)?
- Make problem-POIs hidable in layer switcher
- Optional overlays for cycling-POIs
  - bike sharing stations (Citybike + Nextbike),
  - bicycle shops
  - bicycle pumps / repair stations
  - train and metro stations
- Differentiate between a simple & an advanced UI.
  - simple: auto-hides parts of the network based on zoom level, no layer switcher
  - advanced: layer switcher, control opacity of overlay, freely choose network-parts to show
