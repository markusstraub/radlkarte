# Additional Layers

- Bike-Sharing -> Nextbike API
- Ubahn + ÖBB Haltestellen (oder nur S-Bahn?) -> OSM? or GTFS?
- Bicycle shops -> OSM
- Bicycle repair -> OSM

## Nextbike

API doc: https://github.com/nextbike/api-doc/blob/master/maps/nextbike-maps.openapi.yaml

List of all cities (to easily get domain code): https://maps.nextbike.net/maps/nextbike.json?list_cities=1

TODO lazy loading!

## Ubahn Wien

Overpass Query:

  [out:json][timeout:30][bbox:{{bbox}}];
  (
    nwr[railway=station]["station"="subway"];
  );
  (._;>;);
  out body;

https://dev.overpass-api.de/output_formats.html