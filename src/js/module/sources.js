import geoJsonKlagenfurt from "../../data/radlkarte-klagenfurt.geojson";
import geoJsonLinz from "../../data/radlkarte-linz.geojson";
import geoJsonRheintal from "../../data/radlkarte-rheintal.geojson";
import geoJsonSchwarzatal from "../../data/radlkarte-schwarzatal.geojson";
import geoJsonSteyr from "../../data/radlkarte-steyr.geojson";
import geoJsonWien from "../../data/radlkarte-wien.geojson";

const sources = {
  "carto": {
    "type": "vector",
    "url": "https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json"
  },
  "klagenfurt": { "type": "geojson", "data": geoJsonKlagenfurt },
  "linz": { "type": "geojson", "data": geoJsonLinz },
  "rheintal": { "type": "geojson", "data": geoJsonRheintal },
  "schwarzatal": { "type": "geojson", "data": geoJsonSchwarzatal },
  "steyr": { "type": "geojson", "data": geoJsonSteyr },
  "wien": { "type": "geojson", "data": geoJsonWien },
}

export default sources;
