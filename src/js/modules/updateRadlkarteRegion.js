//third party modules
import $ from "jquery";

//own modules
import rk from "./base_radlkarte_object";
import loadGeoJson from "./loadGeoJson";
import {clearAndLoadOsmPois} from "./poi_osm";
import {clearAndLoadNextbike} from "./poi_nextbike";

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

function getPageHeader (){
  return $('h1');
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

export default updateRadlkarteRegion;
