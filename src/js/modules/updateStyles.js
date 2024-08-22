import rk from "./config";

/**
 * Updates the styles of all layers. Takes current zoom level into account.
 * Special styles for unpaved, steep, oneway arrows are matched, take care in future adapations
 */
function updateStyles() {
  let zoom = rk.leafletMap.getZoom();
  for (const key of Object.keys(rk.segments)) {
    let properties = JSON.parse(key);
    let showFull = zoom >= rk.priorityFullVisibleFromZoom[properties.priority];
    let showMinimal = zoom < rk.priorityFullVisibleFromZoom[properties.priority] && zoom >= rk.priorityReducedVisibilityFromZoom[properties.priority];

    let lineStyle;
    if (showFull) {
      lineStyle = getLineStyle(zoom, properties);
    } else if (showMinimal) {
      lineStyle = getLineStyleMinimal(properties);
    }

    let lines = rk.segments[key].lines;
    if (showFull || showMinimal) {
      lines.setStyle(lineStyle);
      rk.leafletMap.addLayer(lines);
    } else {
      rk.leafletMap.removeLayer(lines);
    }

    // steep lines are drawn twice, once regular,
    // a second time as bristles (that's what this copy is for)
    let steepLines = rk.segments[key].steepLines;
    if (steepLines !== undefined) {
      if (showFull || showMinimal) {
        let steepLineStyle;
        if (showFull) {
          steepLineStyle = getSteepLineStyle(zoom, properties);
        } else {
          steepLineStyle = getSteepLineStyleMinimal(properties);
        }
        steepLines.setStyle(steepLineStyle);
        rk.leafletMap.addLayer(steepLines);
      } else {
        rk.leafletMap.removeLayer(steepLines);
      }
    }

    let decorators = rk.segments[key].decorators;
    if ((showFull || showMinimal) && zoom >= rk.onewayIconThreshold && properties.oneway === 'yes') {
      decorators.setPatterns(getOnewayArrowPatterns(zoom, properties, lineStyle.weight));
      rk.leafletMap.addLayer(decorators);
    } else {
      rk.leafletMap.removeLayer(decorators);
    }
  }

  if (zoom >= rk.problemIconThreshold) {
    rk.poiLayers.problemLayerActive.clearLayers();
    rk.poiLayers.problemLayerActive.addLayer(rk.poiLayers.problemLayerHighZoom);
  } else {
    rk.poiLayers.problemLayerActive.clearLayers();
    rk.poiLayers.problemLayerActive.addLayer(rk.poiLayers.problemLayerLowZoom);
  }
}

function getLineStyle(zoom, properties) {
  let lineWeight = getLineWeight(zoom, properties.priority);
  return _getLineStyle(lineWeight, properties);
}

function getLineStyleMinimal(properties) {
  let lineWeight = 1;
  return _getLineStyle(lineWeight, properties);
}

function _getLineStyle(lineWeight, properties) {
  let style = {
    color: rk.colors[properties.stress],
    weight: lineWeight,
    opacity: rk.opacity
  };
  if (properties.unpaved === 'yes') {
    style.dashArray = getUnpavedDashStyle(Math.max(2, lineWeight));
  }
  return style;
}

function getSteepLineStyle(zoom, properties) {
  let lineWeight = getLineWeight(zoom, properties.priority);
  return _getSteepLineStyle(lineWeight, properties);
}

function getSteepLineStyleMinimal(properties) {
  let lineWeight = 1;
  return _getSteepLineStyle(lineWeight, properties);
}

function _getSteepLineStyle(lineWeight, properties) {
  let steepBristleLength = 2;
  return {
    color: rk.colors[properties.stress],
    weight: lineWeight * 2,
    opacity: rk.opacity,
    lineCap: 'butt',
    dashArray: getSteepDashStyle(Math.max(2, lineWeight), steepBristleLength),
    dashOffset: Math.max(2, lineWeight) * -0.5 + steepBristleLength / 2
  };
}

/**
 * weight aka width of a line
 */
function getLineWeight(zoom, priority) {
  let lineWeight = zoom - 10;
  lineWeight = (lineWeight <= 0 ? 1 : lineWeight) * 1.4;
  lineWeight *= rk.lineWidthFactor[priority];
  return lineWeight;
}

function getUnpavedDashStyle(lineWeight) {
  return lineWeight + " " + lineWeight * 1.5;
}

function getSteepDashStyle(lineWeight, steepBristleLength) {
  return steepBristleLength + " " + (lineWeight * 2.5 - steepBristleLength);
}

/**
 * @return an array of patterns as expected by L.PolylineDecorator.setPatterns
 */
function getOnewayArrowPatterns(zoom, properties, lineWeight) {
  let arrowWidth = Math.max(5, lineWeight * rk.arrowWidthFactor[properties.priority]);
  return [{
    offset: arrowWidth - 2,
    repeat: Math.max(2, lineWeight) * 5,
    symbol: L.Symbol.arrowHead({
      pixelSize: arrowWidth,
      headAngle: 90,
      pathOptions: {
        color: rk.colors[properties.stress],
        fillOpacity: rk.opacity,
        weight: 0
      }
    })
  }];
}

export default updateStyles;
