//third party modules
import L from "leaflet";

//own modules
import icons from './icons';

function createMarkerIncludingPopup(latLng, icon, description, altText) {
  let marker = L.marker(latLng, {
    icon: icon,
    alt: altText,
  });
  marker.bindPopup(`<article class="tooltip">${description}</article>`, { closeButton: true });
  marker.on('mouseover', function () {
    marker.openPopup();
  });
  // adding a mouseover event listener causes a problem with touch browsers:
  // then two taps are required to show the marker.
  // explicitly adding the click event listener here solves the issue
  marker.on('click', function () {
    marker.openPopup();
  });
  return marker;
}



function createProblemMarkersIncludingPopup(geojsonPoint) {
  let icons = getProblemIcons(geojsonPoint.properties);
  if (icons == null) {
    return undefined;
  }
  let description = getProblemDescriptionText(geojsonPoint.properties);
  let latLng = L.geoJSON(geojsonPoint).getLayers()[0].getLatLng();
  let markers = {
    lowZoom: createMarkerIncludingPopup(latLng, icons.small, description, 'Problemstelle'),
    highZoom: createMarkerIncludingPopup(latLng, icons.large, description, 'Problemstelle')
  };
  return markers;
}


/**
 * @param properties GeoJSON properties of a point
 * @return a small and a large icon or undefined if no icons should be used
 */
function getProblemIcons(properties) {
  if (properties.leisure === 'swimming_pool') {
    return {
      small: icons.swimmingSmall,
      large: icons.swimming
    };
  }

  let dismount = properties.dismount === 'yes';
  let nocargo = properties.nocargo === 'yes';
  let warning = properties.warning === 'yes';

  let problemIcon;
  if (dismount && nocargo) {
    problemIcon = icons.noCargoAndDismount;
  } else if (dismount) {
    problemIcon = icons.dismount;
  } else if (nocargo) {
    problemIcon = icons.noCargo;
  } else if (warning) {
    problemIcon = icons.warning;
  }

  if (problemIcon === undefined) {
    return undefined;
  } else {
    return {
      small: icons.redDot,
      large: problemIcon
    };
  }
}

/**
 * @param properties GeoJSON properties of a point
 * @return a description string
 */
function getProblemDescriptionText(properties) {
  let dismount = properties.dismount === 'yes';
  let nocargo = properties.nocargo === 'yes';
  let warning = properties.warning === 'yes';

  let title = "";
  if (dismount && nocargo) {
    title = 'Schiebestelle / untauglich für Spezialräder';
  } else if (dismount) {
    title = 'Schiebestelle';
  } else if (nocargo) {
    title = 'Untauglich für Spezialräder';
  } else if (warning) {
    title = 'Achtung';
  }

  const description = properties.description ? `<p>${properties.description}</p>` : "";

  return `<h2>${title}</h2>${description}`;
}

export {
  createProblemMarkersIncludingPopup,
  createMarkerIncludingPopup
};
