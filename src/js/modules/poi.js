import rk from './base_radlkarte_object';

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


export {
  selectPoiLayersForKey,
  getSelectedPoiLayerKey
};
