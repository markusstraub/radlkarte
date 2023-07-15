# Additional Layers

- Bike-Sharing -> Nextbike API
- Ubahn + ÖBB Haltestellen (oder nur S-Bahn?) -> OSM? or GTFS?
- Bicycle shops -> OSM
- Bicycle repair -> OSM

## Nextbike

API doc: https://github.com/nextbike/api-doc/blob/master/maps/nextbike-maps.openapi.yaml

List of all cities (to easily get domain code): https://maps.nextbike.net/maps/nextbike.json?list_cities=1

## OpenStreetMap Queries

doc: https://dev.overpass-api.de/output_formats.html

  curl -o wien-ubahn.json -d @wien-ubahn.oql https://overpass.kumi.systems/api/interpreter

> **TODO** can we auto-extract the bboxes of the geojson files?