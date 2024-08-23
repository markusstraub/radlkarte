import rk from "./base_radlkarte_object";
import icons from "./icons";
import {createMarkerIncludingPopup} from "./markers";

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

export {
  clearAndLoadNextbike
};
