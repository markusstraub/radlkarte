/**  variable for radlkarte properties / data storage */
const rk = {
  /** the main leaflet map */
  leafletMap: undefined,
  geocodingControl: undefined,
  /** object holding all linestring and decorator layers (the key represents the properties) */
  segments: {},
  poiLayers: {
    /** layer group holding currently active variant of problem icons */
    problemLayerActive: L.layerGroup(),
    /** layer group holding problem icons for low zoom levels */
    problemLayerLowZoom: L.layerGroup(),
    /** layer group holding problem icons for high zoom levels */
    problemLayerHighZoom: L.layerGroup(),
    /** layer group holding bike sharing icons */
    bikeShareLayer: L.layerGroup(),
  },

  osmPoiTypes: {
    transit: { urlKey: "o", name: "ÖV-Station", layerName: "Öffentlicher Verkehr" },
    bicycleShop: { urlKey: "f", name: "Fahrradgeschäft", layerName: "Fahrradgeschäfte" },
    bicycleRepairStation: { urlKey: "r", name: "Reparaturstation", layerName: "Reparaturstationen" },
    bicyclePump: { urlKey: "l", name: "Luftpumpe", layerName: "Luftpumpen" },
    bicycleTubeVending: { urlKey: "s", name: "Schlauchomat", layerName: "Schlauchomaten" },
    drinkingWater: { urlKey: "w", name: "Trinkwasser", layerName: "Trinkwasser" },
  },

  /** names of all different levels of priorities (ordered descending by priority) */
  priorityStrings: ["Überregional", "Regional", "Lokal"],
  stressStrings: ["Ruhig", "Durchschnittlich", "Stressig"],
  debug: true,
  fullWidthThreshold: 768,

  // style: stress = color, priority = line width
  tileLayerOpacity: 1,
  priorityFullVisibleFromZoom: [0, 14, 15],
  priorityReducedVisibilityFromZoom: [0, 12, 14],
  onewayIconThreshold: 12,
  problemIconThreshold: 14,
  lineWidthFactor: [1.6, 0.6, 0.3],
  arrowWidthFactor: [2, 3, 3],
  opacity: 0.62,
  colors: ['#004B67', '#51A4B6', '#FF6600'], // dark blue - light blue - orang

  autoSwitchDistanceMeters: 55000,
  defaultRegion: 'wien',
  currentRegion: undefined,
  defaultZoom: 14,
  configurations: {
    'rendertest': {
      title: '[DEV] Rendertest',
      centerLatLng: L.latLng(50.09, 14.39),
    },
    'klagenfurt': {
      title: 'Klagenfurt',
      centerLatLng: L.latLng(46.62, 14.31),
      nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=ka&bikes=false'
    },
    'linz': {
      title: 'Linz',
      centerLatLng: L.latLng(48.30, 14.26),
      nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=al&bikes=false'
    },
    'rheintal': {
      title: 'Rheintal',
      centerLatLng: L.latLng(47.41, 9.72),
    },
    'schwarzatal': {
      title: 'Schwarztal',
      centerLatLng: L.latLng(47.67, 15.94),
      nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=la&bikes=false'
    },
    'steyr': {
      title: 'Steyr',
      centerLatLng: L.latLng(48.04, 14.42),
    },
    'wien': {
      title: 'Wien',
      centerLatLng: L.latLng(48.21, 16.37),
      nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=wr,la&bikes=false',
    },
  },
  pageHeader: function () {
    return $('h1');
  }
}

for (const [k, v] of Object.entries(rk.osmPoiTypes)) {
  v.layer = L.layerGroup();
  rk.poiLayers[k] = v.layer;
}

export default rk;
