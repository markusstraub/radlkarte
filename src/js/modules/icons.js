import L from "leaflet";

//assets
import iconDismount from '../../css/dismount.svg';
import iconWarning from '../../css/warning.svg';
import iconNoCargo from '../../css/nocargo.svg';
import iconNoCargoDismount from '../../css/nocargo+dismount.svg';
import iconRedDot from '../../css/reddot.svg';
import iconSwimming from '../../css/swimming.svg';
import iconSwimmingSmall from '../../css/swimming_small.svg';
import iconSubway from '../../css/subway.svg';
import iconSBahn from '../../css/sbahn.svg';
import iconRailway from '../../css/railway.svg';
import iconNextBike from '../../css/nextbike.svg';
import iconNextBikeGray from '../../css/nextbike-gray.svg';
import iconWienMobilRad from '../../css/wienmobilrad.svg';
import iconWienMobilRadGray from '../../css/wienmobilrad-gray.svg';
import iconCityBikeLinz from '../../css/citybikelinz.svg';
import iconCityBikeLinzGray from '../../css/citybikelinz-gray.svg';
import iconBikeShop from '../../css/bicycleShop.svg';
import iconBikeShopGray from '../../css/bicycleShop-gray.svg';
import iconRepairStation from '../../css/bicycleRepairStation.svg';
import iconRepairStationGray from '../../css/bicycleRepairStation-gray.svg';
import iconPump from '../../css/bicyclePump.svg';
import iconPumpGray from '../../css/bicyclePump-gray.svg';
import bicycleTubeVending from '../../css/bicycleTubeVending.svg';
import bicycleTubeVendingGray from '../../css/bicycleTubeVending-gray.svg';
import drinkingWater from '../../css/drinkingWater.svg';
import drinkingWaterGray from '../../css/drinkingWater-gray.svg';

const icons = {};
icons.dismount = L.icon({
  iconUrl: iconDismount,
  iconSize: [33, 29],
  iconAnchor: [16.5, 14.5],
  popupAnchor: [0, -14.5]
});
icons.warning = L.icon({
  iconUrl: iconWarning,
  iconSize: [33, 29],
  iconAnchor: [16.5, 14.5],
  popupAnchor: [0, -14.5]
});
icons.noCargo = L.icon({
  iconUrl: iconNoCargo,
  iconSize: [29, 29],
  iconAnchor: [14.5, 14.5],
  popupAnchor: [0, -14.5]
});
icons.noCargoAndDismount = L.icon({
  iconUrl: iconNoCargoDismount,
  iconSize: [57.7, 29],
  iconAnchor: [28.85, 14.5],
  popupAnchor: [0, -14.5]
});
icons.redDot = L.icon({
  iconUrl: iconRedDot,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -5]
});
icons.swimming = L.icon({
  iconUrl: iconSwimming,
  iconSize: [29, 29],
  iconAnchor: [14.5, 14.5],
  popupAnchor: [0, -14.5]
});
icons.swimmingSmall = L.icon({
  iconUrl: iconSwimmingSmall,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -5]
});
let subwaySize = 15;
icons.subway = L.icon({
  iconUrl: iconSubway,
  iconSize: [subwaySize, subwaySize],
  iconAnchor: [subwaySize / 2, subwaySize / 2],
  popupAnchor: [0, -subwaySize / 2]
});
icons.sbahn = L.icon({
  iconUrl: iconSBahn,
  iconSize: [subwaySize, subwaySize],
  iconAnchor: [subwaySize / 2, subwaySize / 2],
  popupAnchor: [0, -subwaySize / 2]
});
let railwaySize = 20;
icons.railway = L.icon({
  iconUrl: iconRailway,
  iconSize: [railwaySize, railwaySize],
  iconAnchor: [railwaySize / 2, railwaySize / 2],
  popupAnchor: [0, -railwaySize / 2]
});

icons.nextbike = createMarkerIcon(iconNextBike);
icons.nextbikeGray = createMarkerIcon(iconNextBikeGray);
icons.wienmobilrad = createMarkerIcon(iconWienMobilRad);
icons.wienmobilradGray = createMarkerIcon(iconWienMobilRadGray);
icons.citybikelinz = createMarkerIcon(iconCityBikeLinz);
icons.citybikelinzGray = createMarkerIcon(iconCityBikeLinzGray);
icons.bicycleShop = createMarkerIcon(iconBikeShop);
icons.bicycleShopGray = createMarkerIcon(iconBikeShopGray);
icons.bicycleRepairStation = createMarkerIcon(iconRepairStation);
icons.bicycleRepairStationGray = createMarkerIcon(iconRepairStationGray);
icons.bicyclePump = createMarkerIcon(iconPump);
icons.bicyclePumpGray = createMarkerIcon(iconPumpGray);
icons.bicycleTubeVending = createMarkerIcon(bicycleTubeVending);
icons.bicycleTubeVendingGray = createMarkerIcon(bicycleTubeVendingGray);
icons.drinkingWater = createMarkerIcon(drinkingWater);
icons.drinkingWaterGray = createMarkerIcon(drinkingWaterGray);

function createMarkerIcon(url) {
  let markerWidth = 100 / 5;
  let markerHeight = 150 / 5;
  return L.icon({
    iconUrl: url,
    iconSize: [markerWidth, markerHeight],
    iconAnchor: [markerWidth / 2, markerHeight],
    popupAnchor: [0, -markerHeight]
  });
}

export default icons;
