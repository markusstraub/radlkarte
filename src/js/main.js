//third party modules
import L from "leaflet";
import 'leaflet-control-geocoder';
import 'leaflet.locatecontrol';
import 'leaflet-sidebar-v2';
import 'opening_hours';
import $ from "jquery";

//css
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
import 'leaflet-sidebar-v2/css/leaflet-sidebar.min.css';

window.$ = $;

//own modules
import './modules/leaflet-hash-1.0.1-customized/leaflet-hash.js';
import rk from './modules/base_radlkarte_object';
import icons from "./modules/icons";
import debug from "./modules/debug";
import loadGeoJson from "./modules/loadGeoJson";
import {createMarkerIncludingPopup} from "./modules/markers";
//own css
import "../radlkarte.css";
import "../css/museo-500/style.css";
import "../css/roboto/style.css";




function getPageHeader (){
  return $('h1');
}

/**
 * set the currently active region.
 * called from the CUSTOMIZED hash plugin
 * (when region is changed e.g. via hyperlink or by changing the URL)
 */
function updateRadlkarteRegion(region) {
  rk.currentRegion = region;
  let configuration = rk.configurations[region];
  if (configuration === undefined) {
    console.warn('ignoring unknown region ' + region);
    return;
  }

  removeAllSegmentsAndMarkers();
  loadGeoJson(rk.configurations[region].filename);
  // POI layers: only reload visible layers
  if (rk.leafletMap.hasLayer(rk.poiLayers.bikeShareLayer)) {
    clearAndLoadNextbike(configuration.nextbikeUrl);
  }
  let visibleOsmPois = [];
  for (const [k, v] of Object.entries(rk.osmPoiTypes)) {
    if (rk.leafletMap.hasLayer(v.layer)) {
      visibleOsmPois.push(k);
    }
  }
  clearAndLoadOsmPois(visibleOsmPois);

  getPageHeader().text('Radlkarte ' + configuration.title);


  // virtual page hit in matomo analytics
  _paq.push(['setCustomUrl', '/' + region]);
  _paq.push(['setDocumentTitle', region]);
  _paq.push(['trackPageView']);
}

function removeAllSegmentsAndMarkers() {
  // we can't simply delete all layers (otherwise the base layer is gone as well)
  // TODO refactor?
  for (const key of Object.keys(rk.segments)) {
    rk.leafletMap.removeLayer(rk.segments[key].lines);
    if (rk.segments[key].steepLines && rk.leafletMap.hasLayer(rk.segments[key].steepLines)) {
      rk.leafletMap.removeLayer(rk.segments[key].steepLines);
    }
    rk.leafletMap.removeLayer(rk.segments[key].decorators);
  }
  rk.segments = {};

  for (const [k, v] of Object.entries(rk.osmPoiTypes)) {
    v.layer.clearLayers();
  }
}

/**
 * @returns a key representing activated layers with one char each. x means no active layer.
 */
function getSelectedPoiLayerKey() {
  let selected = "";
  if (rk.leafletMap.hasLayer(rk.poiLayers.problemLayerActive)) {
    selected += 'p';
  }
  if (rk.leafletMap.hasLayer(rk.poiLayers.bikeShareLayer)) {
    selected += 'b';
  }
  for (const type in rk.osmPoiTypes) {
    if (rk.leafletMap.hasLayer(rk.poiLayers[type])) {
      selected += rk.osmPoiTypes[type].urlKey;
    }
  }
  if (selected.length == 0) {
    selected = "x";
  }
  return selected;
}

function selectPoiLayersForKey(key) {
  if (key.includes("p")) {
    rk.leafletMap.addLayer(rk.poiLayers.problemLayerActive);
  } else {
    rk.leafletMap.removeLayer(rk.poiLayers.problemLayerActive);
  }
  if (key.includes("b")) {
    rk.leafletMap.addLayer(rk.poiLayers.bikeShareLayer);
  } else {
    rk.leafletMap.removeLayer(rk.poiLayers.bikeShareLayer);
  }
  for (const type in rk.osmPoiTypes) {
    if (key.includes(rk.osmPoiTypes[type].urlKey)) {
      rk.leafletMap.addLayer(rk.poiLayers[type]);
    } else {
      rk.leafletMap.removeLayer(rk.poiLayers[type]);
    }
  }
}

/**
 * use nextbike API to get stations and current nr of bikes.
 * API doc: https://github.com/nextbike/api-doc/blob/master/maps/nextbike-maps.openapi.yaml
 * List of all cities (to easily get domain code): https://maps.nextbike.net/maps/nextbike.json?list_cities=1
 */
function clearAndLoadNextbike(url) {
  rk.poiLayers.bikeShareLayer.clearLayers();
  $.getJSON(url, function (data) {
    for (const country of data.countries) {
      for (const city of country.cities) {
        let cityUrl = `<a href="${city.website}" target="_blank">Nextbike ${city.name}</a>`;
        for (const place of city.places) {
          let markerLayer = createNextbikeMarkerIncludingPopup(country.domain, place, cityUrl);
          if (markerLayer != null) {
            rk.poiLayers.bikeShareLayer.addLayer(markerLayer);
          }
        }
      }
    }
  });
}

/**
 * @param domain 2-letter Nextbike domain for determining special icons (optional).
 * @param place JSON from Nextbike API describing a bike-share station.
 */
function createNextbikeMarkerIncludingPopup(domain, place, cityUrl) {
  let description = '<h2>' + place.name + '</h2>';
  if (place.bikes === 1) {
    description += "<p>1 Rad verfügbar</p>";
  } else {
    description += `<p>${place.bikes} Räder verfügbar</p>`;
  }
  description += `<p class="sidenote">Mehr Informationen: ${cityUrl}</p>`;

  let icon = place.bikes !== 0 ? icons.nextbike : icons.nextbikeGray;
  if (domain === "wr") {
    icon = place.bikes !== 0 ? icons.wienmobilrad : icons.wienmobilradGray;
  } else if (domain === "al") {
    icon = place.bikes !== 0 ? icons.citybikelinz : icons.citybikelinzGray;
  }

  return createMarkerIncludingPopup(L.latLng(place.lat, place.lng), icon, description, place.name);
}

/** expects a list of poi types */
function clearAndLoadOsmPois(types) {
  for (const type of types) {
    if (type === "transit") {
      clearAndLoadTransit(rk.currentRegion);
    } else {
      clearAndLoadBasicOsmPoi(type, rk.currentRegion);
    }
  }
}

/** special handling for transit because we need to merge subway and railway in one layer */
async function clearAndLoadTransit(region) {
  rk.poiLayers.transit.clearLayers();
  const seen = new Set();

  for (const transitType of ["subway", "railway"]) {
    if (transitType === "subway" && region !== "wien") {
      continue;
    }
    const stationName2Line2Colour = await loadStationName2Line2Colour(region, `data/osm-overpass/${region}-${transitType}Lines.json`);
    let transitFile = `data/osm-overpass/${region}-${transitType}.json`;
    $.getJSON(transitFile, function (data) {
      for (const element of data.elements) {
        if (seen.has(element.tags.name)) {
          // filter duplicate stations (happens when multiple lines cross)
          continue;
        }
        let latLng = "center" in element ? L.latLng(element.center.lat, element.center.lon) : L.latLng(element.lat, element.lon);
        if (latLng == null) {
          // L.latLng can return null/undefined for invalid lat/lon values, catch this here
          console.warn("invalid lat/lon for " + element.type + " with OSM id " + element.id);
          continue;
        }
        let description = `<h2>${element.tags.name}</h2>`;
        let icon = icons[transitType];
        if (stationName2Line2Colour[element.tags.name] != null) {
          let refs = Array.from(Object.keys(stationName2Line2Colour[element.tags.name])).sort();
          for (const ref of refs) {
            description += `<span class="transitLine" style="background-color:${stationName2Line2Colour[element.tags.name][ref]};">${ref}</span>\n`;
          }

          if (transitType === "railway") {
            icon = icons.sbahn;
          }
        }
        let altText = element.tags.name;
        const markerLayer = createMarkerIncludingPopup(latLng, icon, description, altText);
        if (markerLayer != null) {
          seen.add(element.tags.name);
          rk.poiLayers.transit.addLayer(markerLayer);
        }
      }
      debug('created ' + seen.size + ' ' + transitType + ' icons.');
    });
  }
}

async function loadStationName2Line2Colour(region, fileName) {
  const stationName2Line2Colour = {};
  $.getJSON(fileName, function (data) {
    for (const element of data.elements) {
      if (stationName2Line2Colour[element.tags.name] == null) {
        stationName2Line2Colour[element.tags.name] = {};
      }
      stationName2Line2Colour[element.tags.name][element.tags.ref] = element.tags.colour;
    }
  });
  return stationName2Line2Colour;
}

function clearAndLoadBasicOsmPoi(type, region) {
  rk.poiLayers[type].clearLayers();
  let poiFile = "data/osm-overpass/" + region + "-" + type + ".json";
  $.getJSON(poiFile, function (data) {
    let count = 0;
    let dataDate = extractDateFromOverpassResponse(data);
    for (const element of data.elements) {
      const latLng = "center" in element ? L.latLng(element.center.lat, element.center.lon) : L.latLng(element.lat, element.lon);
      if (latLng == null) {
        // L.latLng can return null/undefined for invalid lat/lon values, catch this here
        console.warn("invalid lat/lon for " + type + " with OSM id " + element.id);
        continue;
      }
      const tags = element.tags;

      const access = tags.access;
      if (["no", "private", "permit"].includes(access)) {
        continue;
      }

      const name = tags.name;
      const website = extractWebsiteFromTagSoup(tags);
      let heading = name != null ? name : rk.osmPoiTypes[type].name;
      if (website != null) {
        heading = `<a href="${website}" target="_blank">${heading}</a>`;
      }
      let description = `<h2>${heading}</h2>`;

      const address = extractAddressFromTagSoup(tags);
      if (address) {
        description += `<p>${address}</p>`;
      }

      let currentlyOpen = type === 'bicycleShop' ? false : true;
      let opening_hours_value = tags.opening_hours;
      if (opening_hours_value) {
        if (type === "bicycleShop" && !opening_hours_value.includes("PH")) {
          // bicycle shops are usually closed on holidays but this is rarely mapped
          opening_hours_value += ";PH off";
        }
        // NOTE: state left empty because school holidays are likely not relevant (not a single mapped instance in our data set)
        // noinspection JSPotentiallyInvalidConstructorUsage
        const oh = new opening_hours(opening_hours_value, {
          lat: latLng.lat,
          lon: latLng.lng,
          address: { country_code: "at", state: "" }
        });
        currentlyOpen = oh.getState();
        const openText = currentlyOpen ? "jetzt geöffnet" : "derzeit geschlossen";
        let items = oh.prettifyValue({ conf: { locale: 'de' }, }).split(";");

        for (let i = 0; i < items.length; i++) {
          items[i] = items[i].trim();
          if (type === "bicycleShop" && items[i] === "Feiertags geschlossen") {
            // avoid redundant info
            items[i] = "";
          } else {
            items[i] = `<li>${items[i]}</li>`;
          }
        }
        const itemList = "<ul>" + items.join("\n") + "</ul>";
        description += `<p>Öffnungszeiten (${openText}):</p>${itemList}`;
      }

      const phone = tags.phone != null ? tags.phone : tags["contact:phone"];
      if (phone) {
        description += `<p>${phone}</p>`;
      }

      const operator = tags.operator;
      if (operator) {
        description += `<p class="sidenote">Betreiber: ${operator}</p>`;
      }

      const osmLink = `<a href="https://www.osm.org/${element.type}/${element.id}" target="_blank">Quelle: OpenStreetMap</a>`;
      description += `<p class="sidenote">${osmLink} (Stand: ${dataDate})</p>`;

      let icon = icons[`${type}${currentlyOpen ? "" : "Gray"}`];
      let altText = element.tags.name;
      const markerLayer = createMarkerIncludingPopup(latLng, icon, description, altText);
      if (markerLayer != null) {
        rk.poiLayers[type].addLayer(markerLayer);
        count++;
      }
    }
    debug('created ' + count + ' ' + type + ' icons.');
  });
}

function extractDateFromOverpassResponse(data) {
  if (data.osm3s && data.osm3s.timestamp_osm_base) {
    if (typeof data.osm3s.timestamp_osm_base === 'string') {
      return data.osm3s.timestamp_osm_base.split("T")[0];
    }
  }
  return null;
}

function extractAddressFromTagSoup(tags) {
  if (tags["addr:street"] != null) {
    let address = "";
    address += tags["addr:street"];
    if (tags["addr:housenumber"] != null) {
      address += " " + tags["addr:housenumber"];
    }
    if (tags["addr:postcode"] != null) {
      address += ", " + tags["addr:postcode"];
      if (tags["addr:city"] != null) {
        address += " " + tags["addr:city"];
      }
    } else if (tags["addr:city"] != null) {
      address += ", " + tags["addr:city"];
    }
    return address;
  }
  return undefined;
}

function extractWebsiteFromTagSoup(tags) {
  let website = tags.website != null ? tags.website : tags["contact:website"];
  if (website == null) {
    return website;
  }
  if (!website.startsWith("http")) {
    website = `http://${website}`;
  }
  return website;
}




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


$( document ).ready(function() {
  loadLeaflet();
});
