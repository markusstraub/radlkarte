import maplibregl from "maplibre-gl";
import 'maplibre-gl/dist/maplibre-gl.css';
import testStyle from "./styles/teststyle";


function init() {

  const map = new maplibregl.Map({
    container: 'map',
    style: testStyle,
    center: [ 16.37,48.21],
    zoom: 12,
    hash: true
  });
  map.addControl(new mapboxgl.NavigationControl());

}


export default init;
