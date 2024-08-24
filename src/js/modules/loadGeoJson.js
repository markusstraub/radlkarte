//third party modules
import * as turf from "@turf/turf";
import L from "leaflet";
import 'leaflet-polylinedecorator';
import $ from "jquery";

//own modules
import rk from "./base_radlkarte_object";
import {createProblemMarkersIncludingPopup} from "./markers";
import updateStyles from "./updateStyles";
import debug from './debug';


function loadGeoJson(file) {
  rk.poiLayers.problemLayerLowZoom.clearLayers();
  rk.poiLayers.problemLayerHighZoom.clearLayers();
  $.getJSON(file, function (data) {
    if (data.type != "FeatureCollection") {
      console.error("expected a GeoJSON FeatureCollection. no radlkarte network can be displayed.");
      return;
    }

    if (!data.bbox) {
      console.warn("no bbox defined in GeoJSON - can not configure geocoding");
      rk.geocodingControl.options.geocoder.options.geocodingQueryParams.bounds = null;
    } else {
      rk.geocodingControl.options.geocoder.options.geocodingQueryParams.bounds = data.bbox.join(",");
    }

    // collect geojson linestring features (and marker points)
    let ignoreCount = 0;
    let goodCount = 0;
    let poiCount = 0;
    let categorizedLinestrings = {};
    for (let i = 0; i < data.features.length; i++) {
      let geojson = data.features[i];
      if (geojson.type != 'Feature' || geojson.properties == undefined || geojson.geometry == undefined || geojson.geometry.type != 'LineString' || geojson.geometry.coordinates.length < 2) {
        if (geojson.geometry.type == 'Point') {
          let problemMarkers = createProblemMarkersIncludingPopup(geojson);
          if (problemMarkers != null) {
            rk.poiLayers.problemLayerLowZoom.addLayer(problemMarkers.lowZoom);
            rk.poiLayers.problemLayerHighZoom.addLayer(problemMarkers.highZoom);
            ++poiCount;
          } else {
            console.warn("ignoring invalid point (not a problem marker): " + JSON.stringify(geojson));
            ++ignoreCount;
          }
        } else {
          console.warn("ignoring invalid object (not a proper linestring feature): " + JSON.stringify(geojson));
          ++ignoreCount;
        }
        continue;
      }

      let priority = parseInt(geojson.properties.priority, 10);
      let stress = parseInt(geojson.properties.stress, 10);
      if (isNaN(priority) || isNaN(stress)) {
        console.warn("ignoring invalid object (priority / stress not set): " + JSON.stringify(geojson));
        ++ignoreCount;
        continue;
      }

      // collect linestrings by category
      addSegmentToObject(categorizedLinestrings, geojson);

      ++goodCount;
    }
    debug("processed " + goodCount + " valid LineString features, " + poiCount + " Point features, and " + ignoreCount + " ignored features.");

    // merge geojson linestring features
    // with the same properties into a single multilinestring
    // and then put them in a leaflet layer
    for (const key of Object.keys(categorizedLinestrings)) {
      let multilinestringFeatures = turf.combine(turf.featureCollection(categorizedLinestrings[key]));
      let properties = JSON.parse(key);
      multilinestringFeatures.properties = properties;

      let decoratorCoordinates = [];
      for (const linestring of categorizedLinestrings[key]) {
        decoratorCoordinates.push(turf.flip(linestring).geometry.coordinates);
      }

      // separate panes to allow setting zIndex, which is not possible on
      // the geojson layers themselves
      // see https://stackoverflow.com/q/39767499/1648538
      rk.leafletMap.createPane(key);
      rk.leafletMap.getPane(key).style.zIndex = getSegmentZIndex(properties);
      rk.segments[key] = {
        'lines': L.geoJSON(multilinestringFeatures, { pane: key }),
        'steepLines': properties.steep === 'yes' ? L.geoJSON(multilinestringFeatures, { pane: key }) : undefined,
        'decorators': L.polylineDecorator(decoratorCoordinates)
      };
    }

    // apply styles
    updateStyles();

    rk.leafletMap.on('zoomend', function (ev) {
      //debug("zoom level changed to " + rk.leafletMap.getZoom() + ".. enqueueing style change");
      $("#map").queue(function () {
        updateStyles();
        $(this).dequeue();
      });
    });
  });
}



/**
 * Get a zIndex based on priority and stress
 * where low-stress high-priority is on the top
 */
function getSegmentZIndex(properties) {
  // 400 is the default zIndex for overlayPanes, stay slightly below this level
  let index = 350;
  index += 10 * (rk.priorityStrings.length - properties.priority);
  index += 1 * (rk.stressStrings.length - properties.stress);
  return index;
}

function addSegmentToObject(object, geojsonLinestring) {
  let key = getSegmentKey(geojsonLinestring);
  let keyString = JSON.stringify(key);
  if (object[keyString] === undefined) {
    object[keyString] = [];
  }
  object[keyString].push(geojsonLinestring);
}

/*
 * Get a JSON object as key for a segment linestring.
 * This object explicitly contains all values to be used in styling
 */
function getSegmentKey(geojsonLinestring) {
  let properties = geojsonLinestring.properties;
  return {
    "priority": properties.priority,
    "stress": properties.stress,
    "oneway": properties.oneway === undefined ? 'no' : properties.oneway,
    "unpaved": properties.unpaved === undefined ? 'no' : properties.unpaved,
    "steep": properties.steep === undefined ? 'no' : properties.steep
  };
}


export default loadGeoJson;
