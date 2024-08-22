//third party modules
import L from "leaflet";

//own modules
import rk from "./base_radlkarte_object";
import './leaflet-hash-1.0.1-customized/leaflet-hash.js';
import updateRadlkarteRegion from "./updateRadlkarteRegion";
import {getSelectedPoiLayerKey, selectPoiLayersForKey} from "./poi";
import {clearAndLoadNextbike} from "./poi_nextbike";
import {clearAndLoadOsmPois} from "./poi_osm";
import debug from "./debug";

function loadLeaflet() {
  rk.leafletMap = L.map('map', { 'zoomControl': false });

  // avoid troubles with min/maxZoom from our layer group, see https://github.com/Leaflet/Leaflet/issues/6557
  let minMaxZoomLayer = L.gridLayer({
    minZoom: 0,
    maxZoom: 19
  });
  let cartodbPositronLowZoom = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org" target="_blank">OpenStreetMap</a> contributors | &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    subdomains: 'abcd',
    minZoom: 0,
    maxZoom: 15
  });
  let osmHiZoom = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 16,
    maxZoom: 19,
    // low and high zoom layer contributions are combined, so skip it here
    //attribution: 'map data &amp; imagery &copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors'
  });
  let mixed = L.layerGroup([minMaxZoomLayer, cartodbPositronLowZoom, osmHiZoom]);

  let basemapAtOrthofoto = L.tileLayer('https://maps{s}.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.{format}', {
    maxZoom: 18, // up to 20 is possible
    attribution: '<a href="https://www.basemap.at" target="_blank">basemap.at</a>',
    subdomains: ["", "1", "2", "3", "4"],
    format: 'jpeg',
    bounds: [[46.35877, 8.782379], [49.037872, 17.189532]]
  });
  let ocm = L.tileLayer('https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=ab5e4b2d24854fefb139c538ef5187a8', {
    minZoom: 0,
    maxZoom: 18,
    attribution: '&copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors | &copy; <a href="https://www.thunderforest.com" target="_blank">Thunderforest</a>'
  });
  let cyclosm = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    minZoom: 0,
    maxZoom: 18,
    attribution: '&copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors | <a href="https://www.cyclosm.org" target="_blank">CyclOSM</a> | <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap Frankreich</a>.'
  });
  let empty = L.tileLayer('', { attribution: '' });

  /*let osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 0,
    maxZoom: 18,
    attribution: 'map data &amp; imagery &copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors'
  });*/

  let baseMaps = {
    "Straßenkarte": mixed,
    "Luftbild": basemapAtOrthofoto,
    "CyclOSM": cyclosm,
    "OpenCycleMap": ocm,
    //"OpenStreetMap": osm,
    "Weiß": empty,
  };
  let overlayMaps = {
    "Problemstellen": rk.poiLayers.problemLayerActive,
    "Leihräder": rk.poiLayers.bikeShareLayer
  };
  for (const [k, v] of Object.entries(rk.osmPoiTypes)) {
    overlayMaps[v.layerName] = v.layer;
  }

  mixed.addTo(rk.leafletMap);
  // default overlays are added via the customized leaflet-hash (see L.Hash.parseHash)
  // rk.poiLayers.problemLayerActive.addTo(rk.leafletMap);
  L.control.layers(baseMaps, overlayMaps, { 'position': 'topright', 'collapsed': true }).addTo(rk.leafletMap);

  rk.leafletMap.on({
    overlayadd: function (e) {
      let configuration = rk.configurations[rk.currentRegion];
      if (e.layer === rk.poiLayers.bikeShareLayer) {
        clearAndLoadNextbike(configuration.nextbikeUrl);
      }
      for (const [k, v] of Object.entries(rk.osmPoiTypes)) {
        if (e.layer === v.layer) {
          clearAndLoadOsmPois([k]);
        }
      }
    }
  });

  rk.geocodingControl = L.Control.geocoder({
    position: 'topright',
    placeholder: 'Adresssuche',
    errorMessage: 'Leider nicht gefunden',
    geocoder: L.Control.Geocoder.opencage({
      apiKey: "657bf10308f144c7a9cbb7675c9b0d36",
      geocodingQueryParams: {
        countrycode: 'at',
        language: 'de'
        // bounds are set whenever a JSON is read (min lon, min lat, max lon, max lat)
      }
    }),
    defaultMarkGeocode: false
  }).on('markgeocode', function (e) {
    let result = e.geocode || e;
    debug(result);

    let resultText = result.name;
    resultText = resultText.replace(/, Österreich$/, "").replace(/, /g, "<br/>");
    L.popup({
      autoClose: false,
      closeOnClick: false,
      closeButton: true
    }).setLatLng(result.center).setContent(resultText).openOn(rk.leafletMap);

    let roughlyHalfPopupWidth = 100; // TODO ideally get the real width of the popup
    let topLeft = L.point(document.querySelector('#sidebar').offsetWidth + roughlyHalfPopupWidth, 0);
    let bottomRight = L.point(document.querySelector('#radlobby-logo').offsetWidth + roughlyHalfPopupWidth, document.querySelector('#radlobby-logo').offsetHeight);
    rk.leafletMap.panInside(result.center, { "paddingTopLeft": topLeft, "paddingBottomRight": bottomRight });
  }).addTo(rk.leafletMap);

  L.control.locate({
    position: 'topright',
    setView: 'untilPan',
    flyTo: true,
    //markerStyle: { weight: 5 },
    locateOptions: {
      enableHighAccuracy: true,
      watch: true,
      maxZoom: 16
    },
    strings: {
      title: 'Verfolge Position'
    }
  }).addTo(rk.leafletMap);

  L.control.zoom({ position: 'topright' }).addTo(rk.leafletMap);

  L.control.scale({ position: 'topleft', imperial: false, maxWidth: 200 }).addTo(rk.leafletMap);

  let sidebar = L.control.sidebar({
    container: 'sidebar',
    position: 'left'
  }).addTo(rk.leafletMap);
  if (window.innerWidth < rk.fullWidthThreshold) {
    sidebar.close();
  }

  // initialize hash, this causes loading of the default region
  // and positioning of the map

  new L.Hash(rk, updateRadlkarteRegion, selectPoiLayersForKey, getSelectedPoiLayerKey);
}

export default loadLeaflet;
