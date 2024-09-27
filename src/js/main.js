import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import teststyle from "./teststyle"
import "../radlkarte.css"

const map = new maplibregl.Map({
  container: 'map',
  style: teststyle,
  center: [14,47],
  zoom: 12,
  hash: true
});
map.addControl(new mapboxgl.NavigationControl());
