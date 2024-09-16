//third party modules
import 'leaflet-control-geocoder';
import 'leaflet.locatecontrol';
import 'leaflet-sidebar-v2';
import $ from "jquery";

//third party css
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
import 'leaflet-sidebar-v2/css/leaflet-sidebar.min.css';

//own css
import "../radlkarte.css";
import "../css/museo-500/style.css";
import "../css/roboto/style.css";

window.$ = $;

//own modules
import loadLeaflet from "./modules/loadLeaflet";


$(document).ready(function () {
  loadLeaflet();
});
