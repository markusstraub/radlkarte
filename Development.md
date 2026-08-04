# radlkarte.at - Development

Development guidelines for the website.


## Local environment

To use work on the radlkarte.at locally, either to develop the codebase or make using the scripts easier, you need to install Node.js on your computer. If you just want to run the radlkarte.at locally in your browser to, i.e. to preview your changes made in JOSM before committing them, you can do so by running the following command:

    npx http-server -a localhost -s

Then you can open it in the browser using http://localhost:8080.

## Setup

First install [Node.js 18.x or newer](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs) (please only use versions with an even major version number: `18.x`, `20.x`, …). npm comes with it, so there is nothing else to install.

Now you have prepared your computer (you might whish to install an IDE like VSCode or Webstorm or a git client as well) and can setup the repository. Create a [personal fork from `markusstraub/radlkarte`](https://github.com/markusstraub/radlkarte/fork), clone it and execute `npm install` in its root folder. This will install all dependencies in your project (as of Feb. 2024 only the development tools).

## Available tools and scripts

There are a some scripts helping with the data (preparing the GeoJSON files – minifying, add bbox, ensure all objects have a unique ID etc. – downloading POI data from [OSM](https://openstreetmap.org) via Overpass queries) and more technical tools like linting the HTML and JavaScript code or running a local HTTP hosting the radlkarte.at locally.

All of them are made available via _npm scripts_ and you simply can execute `npm start` to show a list of all available scripts with explanation.

> [!NOTE]
> `npm start` is normally the script that starts a project, but here it shows the script help instead. Use `npm run serve` to start the local HTTP server.

### Starting the HTTP server

To start the HTTP server run `npm run serve`. Then you can open the radlkarte on http://localhost:8081, caching is disabled.

### Preparing GeoJSON files

Run `npm run geojson -- [path to GeoJSON file]` after editing route data in JOSM. Note
the `--`: npm needs it to pass arguments through to the script rather than treating
them as its own.

### Downloading POI data

To download the POI data from OSM you can either use `npm run pois` to download all data (which can take a while) or `npm run pois:[region]` to download it only for a specific region, i.e. `npm run pois:wien` for Vienna.

Afterwards run `npm run pois:merge` to merge the per-region downloads into the
region-agnostic per-type files the map reads from `data/poi/`.

You can append `-- --only-query` with one of the following values to only download data for the given type of POIs:

- `subway` => Subway stations (Vienna only)
- `subwayLines` => Subway lines (Vienna only)
- `railway` => Railway stations
- `railwayLines` = Railway lines with bicycle transport permission without reservation ("S-Bahn")
- `bicycleShop` => Bicycle shops and general sport shops with bicycle retail or repair services
- `bicycleRepairStation` => Bicycle self-repair stations
- `bicyclePump` => Bicycle self-service air pumps (excluding fuel stations which usually have air pumps and bicycle vent adapters as well)
- `bicycleTubeVending` => Bicycle tube vending machines
- `drinkingWater` => Drinking water fountains
