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


- nwr[railway~"^station$|^halt$"][station!=subway][station!=miniature];
- shop=bicycle (name, website, phone (?))
- amenity=bicycle_repair_station (operator)
- amenity=compressed_air (operator)
- vending=bicycle_tube (operator)


## TODOs

- auto-extract bboxes of geojson files for OSM downloads
  - or: just make the minify-script write the bbox to the geojson!
    > like: {"type": "FeatureCollection", "bbox": [ 14.30921, 47.94649, 14.50838, 48.22303 ], "features":
- keep popups open a bit so that a link in the popup can be clicked (bicycle shops!)
- script for cronjob that downloads osm data files for all radlkarte regions