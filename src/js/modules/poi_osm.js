import rk from "./base_radlkarte_object";
import icons from "./icons";
import {createMarkerIncludingPopup} from "./markers";
import opening_hours from "opening_hours";

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

export {
  clearAndLoadOsmPois
}
