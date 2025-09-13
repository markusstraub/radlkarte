"use strict";
/** global variable for radlkarte properties / data storage */
var rkGlobal = {};
/** the main maplibre map */
rkGlobal.map = undefined;
rkGlobal.geocodingControl = undefined;
/** object holding all data sources and layers */
rkGlobal.segments = {};
rkGlobal.poiLayers = {};
/** data sources for the map */
rkGlobal.dataSources = {};
rkGlobal.osmPoiTypes = {
  transit: { urlKey: "o", name: "ÖV-Station", layerName: "Öffentlicher Verkehr" },
  bicycleShop: { urlKey: "f", name: "Fahrradgeschäft", layerName: "Fahrradgeschäfte" },
  bicycleRepairStation: { urlKey: "r", name: "Reparaturstation", layerName: "Reparaturstationen" },
  bicyclePump: { urlKey: "l", name: "Luftpumpe", layerName: "Luftpumpen" },
  bicycleTubeVending: { urlKey: "s", name: "Schlauchomat", layerName: "Schlauchomaten" },
  drinkingWater: { urlKey: "w", name: "Trinkwasser", layerName: "Trinkwasser" },
};
// Initialize empty layer groups for POI types
for (const [k, v] of Object.entries(rkGlobal.osmPoiTypes)) {
  v.layer = { features: [], visible: false };
  rkGlobal.poiLayers[k] = v.layer;
}
/** names of all different levels of priorities (ordered descending by priority) */
rkGlobal.priorityStrings = ["Überregional", "Regional", "Lokal"];
rkGlobal.stressStrings = ["Ruhig", "Durchschnittlich", "Stressig"];
rkGlobal.debug = true;
rkGlobal.fullWidthThreshold = 768;

// style: stress = color, priority = line width
// rkGlobal.styleFunction = updateStyles; // Not needed for MapLibre
rkGlobal.tileLayerOpacity = 1;
rkGlobal.priorityFullVisibleFromZoom = [0, 14, 15];
rkGlobal.priorityReducedVisibilityFromZoom = [0, 12, 14];
rkGlobal.onewayIconThreshold = 12;
rkGlobal.problemIconThreshold = 14;
rkGlobal.lineWidthFactor = [1.6, 0.6, 0.3];
rkGlobal.arrowWidthFactor = [2, 3, 3];
rkGlobal.opacity = 0.62;
rkGlobal.colors = ['#004B67', '#51A4B6', '#FF6600']; // dark blue - light blue - orange

rkGlobal.autoSwitchDistanceMeters = 55000;
rkGlobal.defaultRegion = 'wien';
rkGlobal.currentRegion = undefined;
rkGlobal.defaultZoom = 14;
rkGlobal.configurations = {
  'rendertest': {
    title: '[DEV] Rendertest',
    centerLatLng: [14.39, 50.09], // [longitude, latitude] for MapLibre
  },
  'bruckleitha': {
    title: 'Bezirk Bruck/Leitha',
    centerLatLng: [16.78, 48.02],
    nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=la,eq&bikes=false'
  },
  'klagenfurt': {
    title: 'Klagenfurt',
    centerLatLng: [14.31, 46.62],
    nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=ka&bikes=false'
  },
  'linz': {
    title: 'Linz',
    centerLatLng: [14.26, 48.30],
    nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=al&bikes=false'
  },
  'noe-suedost': {
    title: 'NÖ-Südost',
    centerLatLng: [15.94, 47.67],
    nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=la&bikes=false'
  },
  'rheintal': {
    title: 'Rheintal',
    centerLatLng: [9.72, 47.41],
  },
  'steyr': {
    title: 'Steyr',
    centerLatLng: [14.42, 48.04],
  },
  'wien': {
    title: 'Wien',
    centerLatLng: [16.37, 48.21],
    nextbikeUrl: 'https://maps.nextbike.net/maps/nextbike.json?domains=wr,la&bikes=false',
  },
};
rkGlobal.pageHeader = function () {
  return $('h1');
};

function loadMapLibre() {
  // Create the MapLibre map
  rkGlobal.map = new maplibregl.Map({
    container: 'map',
    style: createBaseMapStyle(),
    center: [16.3738, 48.2082], // Vienna center
    zoom: 11,
    minZoom: 0,
    maxZoom: 19
  });

  // Initialize sidebar manually since we don't have leaflet-sidebar
  initializeSidebar();

  // Initialize map controls
  initializeMapControls();

  // Initialize data loading
  initializeDataLoading();
}

function createBaseMapStyle() {
  return {
    version: 8,
    glyphs: 'glyphs/{fontstack}/{range}.pbf',
    sources: {
      'carto-light': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org" target="_blank">OpenStreetMap</a> contributors | &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
      }
    },
    layers: [
      {
        id: 'carto-light-layer',
        type: 'raster',
        source: 'carto-light'
      }
    ]
  };
}

function initializeSidebar() {
  // Manual sidebar implementation since we're not using leaflet-sidebar
  const sidebar = document.getElementById('sidebar');
  const tabs = sidebar.querySelectorAll('[role="tab"]');
  const panes = sidebar.querySelectorAll('.leaflet-sidebar-pane');

  // Add click handlers for tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.getAttribute('href').substring(1);

      // Remove active from all tabs and panes
      tabs.forEach(t => t.parentElement.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      // Add active to clicked tab and corresponding pane
      tab.parentElement.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Add close button functionality
  const closeBtns = sidebar.querySelectorAll('.leaflet-sidebar-close');
  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth < rkGlobal.fullWidthThreshold) {
        sidebar.classList.remove('open');
      }
    });
  });

  // Show sidebar by default on desktop
  if (window.innerWidth >= rkGlobal.fullWidthThreshold) {
    sidebar.classList.add('open');
  } else {
    sidebar.classList.remove('open');
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth >= rkGlobal.fullWidthThreshold) {
      sidebar.classList.add('open');
    } else {
      sidebar.classList.remove('open');
    }
  });
}

function initializeMapControls() {
  // Add zoom controls
  rkGlobal.map.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Add scale control
  rkGlobal.map.addControl(new maplibregl.ScaleControl({
    maxWidth: 200,
    unit: 'metric'
  }), 'top-left');

  // Add geolocate control
  rkGlobal.map.addControl(new maplibregl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true
  }), 'top-right');
}

function initializeDataLoading() {
  // Load default region (Wien) when map is loaded
  rkGlobal.map.on('load', () => {
    console.log('Map loaded, loading Wien data...');
    // Set default region
    rkGlobal.currentRegion = rkGlobal.defaultRegion;
    updateRadlkarteRegion(rkGlobal.currentRegion);

    // Initialize icons after map is loaded
    initializeIcons();
  });

  // Add zoom event listener to update layer visibility
  rkGlobal.map.on('zoom', updateLayerVisibility);
  rkGlobal.map.on('zoomend', updateLayerVisibility);

  // Initialize layer control
  initializeLayerControl();
}

function initializeIcons() {
  // Placeholder function for icon initialization
  // TODO: Implement icon loading for MapLibre GL JS if needed
  console.log('Icons initialized (placeholder)');
}

function debug(obj) {
  if (rkGlobal.debug) {
    console.log(obj);
  }
}

/**
 * set the currently active region.
 * called from the CUSTOMIZED hash plugin
 * (when region is changed e.g. via hyperlink or by changing the URL)
 */
function updateRadlkarteRegion(region) {
  rkGlobal.currentRegion = region;
  let configuration = rkGlobal.configurations[region];
  if (configuration === undefined) {
    console.warn('ignoring unknown region ' + region);
    return;
  }

  removeAllSegmentsAndMarkers();
  loadGeoJson('data/radlkarte-' + region + '.geojson');

  // Update page title
  rkGlobal.pageHeader().text('Radlkarte ' + configuration.title);

  // Center map on region
  if (configuration.centerLatLng) {
    rkGlobal.map.flyTo({
      center: configuration.centerLatLng,
      zoom: rkGlobal.defaultZoom
    });
  }

  // Virtual page hit in matomo analytics
  if (typeof _paq !== 'undefined') {
    _paq.push(['setCustomUrl', '/' + region]);
    _paq.push(['setDocumentTitle', region]);
    _paq.push(['trackPageView']);
  }
}

function removeAllSegmentsAndMarkers() {
  // Remove all sources and layers from MapLibre map
  if (rkGlobal.map.getSource('bike-routes')) {
    rkGlobal.map.removeSource('bike-routes');
  }
  if (rkGlobal.map.getSource('problem-markers')) {
    rkGlobal.map.removeSource('problem-markers');
  }

  // Remove route layers
  ['bike-routes-main', 'bike-routes-main-unpaved', 'bike-routes-secondary', 'bike-routes-secondary-unpaved',
    'bike-routes-local', 'bike-routes-local-unpaved', 'bike-routes-main-steep', 'bike-routes-secondary-steep',
    'bike-routes-local-steep', 'bike-routes-main-arrows', 'bike-routes-secondary-arrows', 'bike-routes-local-arrows',
    'problem-markers-layer'].forEach(layerId => {
      if (rkGlobal.map.getLayer(layerId)) {
        rkGlobal.map.removeLayer(layerId);
      }
    });

  rkGlobal.segments = {};
}

function loadGeoJson(file) {
  console.log('Loading GeoJSON:', file);
  fetch(file)
    .then(response => response.json())
    .then(data => {
      if (data.type !== "FeatureCollection") {
        console.error("expected a GeoJSON FeatureCollection. no radlkarte network can be displayed.");
        return;
      }

      processGeoJsonData(data);
    })
    .catch(error => {
      console.error('Error loading GeoJSON:', error);
    });
}

function processGeoJsonData(data) {
  console.log(`Processing ${data.features.length} features`);

  // Separate LineString features (bike routes) from Point features (markers)
  const bikeRoutes = {
    type: "FeatureCollection",
    features: data.features.filter(f => f.geometry.type === "LineString" &&
      f.properties.priority !== undefined &&
      f.properties.stress !== undefined)
  };

  const problemMarkers = {
    type: "FeatureCollection",
    features: data.features.filter(f => f.geometry.type === "Point" &&
      (f.properties.dismount === "yes" ||
        f.properties.nocargo === "yes" ||
        f.properties.warning === "yes"))
  };

  console.log(`Found ${bikeRoutes.features.length} bike routes and ${problemMarkers.features.length} problem markers`);

  // Add bike routes to map
  if (bikeRoutes.features.length > 0) {
    addBikeRoutesToMap(bikeRoutes);
  }

  // Add problem markers to map
  if (problemMarkers.features.length > 0) {
    addProblemMarkersToMap(problemMarkers);
  }
}

function addBikeRoutesToMap(bikeRoutes) {
  // Add source for bike routes
  rkGlobal.map.addSource('bike-routes', {
    type: 'geojson',
    data: bikeRoutes
  });

  // Add main routes layer (priority 0) - paved roads
  rkGlobal.map.addLayer({
    id: 'bike-routes-main',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '0'],
      ['!=', ['get', 'unpaved'], 'yes']
    ],
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 3,
        15, 6,
        18, 12
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0], // calm - dark blue
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1], // medium - light blue
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2], // stressful - orange
        rkGlobal.colors[1] // default
      ],
      'line-opacity': rkGlobal.opacity
    }
  });

  // Add main routes layer (priority 0) - unpaved roads (dashed)
  rkGlobal.map.addLayer({
    id: 'bike-routes-main-unpaved',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '0'],
      ['==', ['get', 'unpaved'], 'yes']
    ],
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 3,
        15, 6,
        18, 12
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'line-opacity': rkGlobal.opacity,
      'line-dasharray': [2, 1]
    }
  });

  // Add secondary routes layer (priority 1) - paved roads
  rkGlobal.map.addLayer({
    id: 'bike-routes-secondary',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '1'],
      ['!=', ['get', 'unpaved'], 'yes']
    ],
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 1.5,
        15, 3,
        18, 6
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'line-opacity': rkGlobal.opacity
    }
  });

  // Add secondary routes layer (priority 1) - unpaved roads (dashed)
  rkGlobal.map.addLayer({
    id: 'bike-routes-secondary-unpaved',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '1'],
      ['==', ['get', 'unpaved'], 'yes']
    ],
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 1.5,
        15, 3,
        18, 6
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'line-opacity': rkGlobal.opacity,
      'line-dasharray': [2, 1]
    }
  });

  // Add local routes layer (priority 2) - paved roads
  rkGlobal.map.addLayer({
    id: 'bike-routes-local',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '2'],
      ['!=', ['get', 'unpaved'], 'yes']
    ],
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 0.8,
        15, 1.5,
        18, 3
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'line-opacity': rkGlobal.opacity
    }
  });

  // Add local routes layer (priority 2) - unpaved roads (dashed)
  rkGlobal.map.addLayer({
    id: 'bike-routes-local-unpaved',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '2'],
      ['==', ['get', 'unpaved'], 'yes']
    ],
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 0.8,
        15, 1.5,
        18, 3
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'line-opacity': rkGlobal.opacity,
      'line-dasharray': [2, 1]
    }
  });

  // Add steep sections overlay layers (bristles effect)
  addSteepSectionLayers();

  // Add oneway arrow layers
  addOnewayArrowLayers();

  // Update layer visibility based on current zoom level
  updateLayerVisibility();
}

function addSteepSectionLayers() {
  // For steep sections (bristles), MapLibre GL JS doesn't have direct equivalent to Leaflet's bristle patterns
  // Original Leaflet used getSteepDashStyle() with special dashArray and dashOffset for bristle effect
  // MapLibre alternatives implemented:
  // 1. Short dash patterns to simulate bristles (current implementation)
  // 2. Alternative: thicker lines with different colors for steep sections
  // 3. Alternative: double lines or dotted patterns

  // Add steep section layers (bristles effect using perpendicular dash pattern)
  // Priority 0 (main) steep sections
  rkGlobal.map.addLayer({
    id: 'bike-routes-main-steep',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '0'],
      ['==', ['get', 'steep'], 'yes']
    ],
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 6,
        15, 12,
        18, 24
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'line-opacity': rkGlobal.opacity,
      'line-dasharray': [0.5, 2] // Short dashes to create bristle effect
    }
  });

  // Priority 1 (secondary) steep sections
  rkGlobal.map.addLayer({
    id: 'bike-routes-secondary-steep',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '1'],
      ['==', ['get', 'steep'], 'yes']
    ],
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 3,
        15, 6,
        18, 12
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'line-opacity': rkGlobal.opacity,
      'line-dasharray': [0.5, 2] // Short bristles
    }
  });

  // Priority 2 (local) steep sections
  rkGlobal.map.addLayer({
    id: 'bike-routes-local-steep',
    type: 'line',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '2'],
      ['==', ['get', 'steep'], 'yes']
    ],
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 1.6,
        15, 3,
        18, 6
      ],
      'line-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'line-opacity': rkGlobal.opacity,
      'line-dasharray': [0.5, 2] // Short bristles
    }
  });
}

function addOnewayArrowLayers() {
  // adds symbol layer with text arrows

  // Priority 0 (main) oneway arrows
  rkGlobal.map.addLayer({
    id: 'bike-routes-main-arrows',
    type: 'symbol',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '0'],
      ['==', ['get', 'oneway'], 'yes']
    ],
    layout: {
      'visibility': 'visible',
      'symbol-placement': 'line',
      'text-field': '▶',
      'text-font': ['NotoCJK'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 8,
        15, 12,
        18, 20
      ],
      'symbol-spacing': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 25,
        15, 40,
        18, 60
      ],
      'text-rotation-alignment': 'map',
      'text-pitch-alignment': 'map'
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'text-opacity': rkGlobal.opacity
    }
  });

  // Priority 1 (secondary) oneway arrows
  rkGlobal.map.addLayer({
    id: 'bike-routes-secondary-arrows',
    type: 'symbol',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '1'],
      ['==', ['get', 'oneway'], 'yes']
    ],
    layout: {
      'visibility': 'visible',
      'symbol-placement': 'line',
      'text-field': '▶',
      'text-font': ['NotoCJK'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 6,
        15, 10,
        18, 16
      ],
      'symbol-spacing': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 10,
        15, 15,
        18, 25
      ],
      'text-rotation-alignment': 'map',
      'text-pitch-alignment': 'map'
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'text-opacity': rkGlobal.opacity
    }
  });

  // Priority 2 (local) oneway arrows
  rkGlobal.map.addLayer({
    id: 'bike-routes-local-arrows',
    type: 'symbol',
    source: 'bike-routes',
    filter: ['all',
      ['==', ['get', 'priority'], '2'],
      ['==', ['get', 'oneway'], 'yes']
    ],
    layout: {
      'visibility': 'visible',
      'symbol-placement': 'line',
      'text-field': '▶',
      'text-font': ['NotoCJK'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 5,
        15, 8,
        18, 12
      ],
      'symbol-spacing': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 10,
        15, 15,
        18, 25
      ],
      'text-rotation-alignment': 'map',
      'text-pitch-alignment': 'map'
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'stress'], '0'], rkGlobal.colors[0],
        ['==', ['get', 'stress'], '1'], rkGlobal.colors[1],
        ['==', ['get', 'stress'], '2'], rkGlobal.colors[2],
        rkGlobal.colors[1]
      ],
      'text-opacity': rkGlobal.opacity
    }
  });
}

function addProblemMarkersToMap(problemMarkers) {
  // Add source for problem markers
  rkGlobal.map.addSource('problem-markers', {
    type: 'geojson',
    data: problemMarkers
  });

  // Add problem markers layer
  rkGlobal.map.addLayer({
    id: 'problem-markers-layer',
    type: 'symbol',
    source: 'problem-markers',
    layout: {
      'icon-image': 'warning-triangle', // We'll need to add this icon
      'icon-size': 0.8,
      'icon-allow-overlap': true
    },
    paint: {
      'icon-opacity': 0.8
    }
  });
}

function getProblemIcons(properties) {
  if (properties.leisure === 'swimming_pool') {
    return {
      small: rkGlobal.icons.swimmingSmall,
      large: rkGlobal.icons.swimming
    };
  }

  let dismount = properties.dismount === 'yes';
  let nocargo = properties.nocargo === 'yes';
  let warning = properties.warning === 'yes';

  let problemIcon;
  if (dismount && nocargo) {
    problemIcon = rkGlobal.icons.noCargoAndDismount;
  } else if (dismount) {
    problemIcon = rkGlobal.icons.dismount;
  } else if (nocargo) {
    problemIcon = rkGlobal.icons.noCargo;
  } else if (warning) {
    problemIcon = rkGlobal.icons.warning;
  }

  if (problemIcon === undefined) {
    return undefined;
  } else {
    return {
      small: rkGlobal.icons.redDot,
      large: problemIcon
    };
  }
}

/**
 * Updates layer visibility based on current zoom level.
 * Mimics the original Leaflet updateStyles function behavior.
 */
function updateLayerVisibility() {
  const zoom = rkGlobal.map.getZoom();

  // Priority visibility rules (matching original Leaflet behavior):
  // Priority 0 (Überregional): fully visible from zoom 0, reduced from zoom 0 (always visible)
  // Priority 1 (Regional): fully visible from zoom 14, reduced from zoom 12
  // Priority 2 (Lokal): fully visible from zoom 15, reduced from zoom 14

  // Priority 0 layers (main routes) - always visible
  setLayerVisibility('bike-routes-main', true);
  setLayerVisibility('bike-routes-main-unpaved', true);
  setLayerVisibility('bike-routes-main-steep', true);

  // Priority 1 layers (secondary routes) - visible from zoom 12+
  const showSecondary = zoom >= rkGlobal.priorityReducedVisibilityFromZoom[1]; // zoom 12+
  setLayerVisibility('bike-routes-secondary', showSecondary);
  setLayerVisibility('bike-routes-secondary-unpaved', showSecondary);
  setLayerVisibility('bike-routes-secondary-steep', showSecondary);

  // Priority 2 layers (local routes) - visible from zoom 14+
  const showLocal = zoom >= rkGlobal.priorityReducedVisibilityFromZoom[2]; // zoom 14+
  setLayerVisibility('bike-routes-local', showLocal);
  setLayerVisibility('bike-routes-local-unpaved', showLocal);
  setLayerVisibility('bike-routes-local-steep', showLocal);

  // Oneway arrows - only visible from zoom 12+ (matching original rkGlobal.onewayIconThreshold)
  const showArrows = zoom >= rkGlobal.onewayIconThreshold; // zoom 12+
  setLayerVisibility('bike-routes-main-arrows', showArrows);
  setLayerVisibility('bike-routes-secondary-arrows', showArrows && showSecondary);
  setLayerVisibility('bike-routes-local-arrows', showArrows && showLocal);
}

/**
 * Helper function to set layer visibility
 */
function setLayerVisibility(layerId, visible) {
  if (rkGlobal.map.getLayer(layerId)) {
    rkGlobal.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

/**
 * Initialize the layer control functionality
 */
function initializeLayerControl() {
  const control = document.getElementById('layer-control');
  const toggle = control.querySelector('.layer-control-toggle');

  // Toggle layer control visibility
  toggle.addEventListener('click', function () {
    control.classList.toggle('expanded');
  });

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    if (!control.contains(e.target)) {
      control.classList.remove('expanded');
    }
  });

  // Handle layer checkbox changes
  const layerCheckboxes = {
    'layer-problems': 'problem-markers-layer',
    'layer-transit': 'poi-transit',
    'layer-bicycleShop': 'poi-bicycleShop',
    'layer-bicycleRepairStation': 'poi-bicycleRepairStation',
    'layer-bicyclePump': 'poi-bicyclePump',
    'layer-bicycleTubeVending': 'poi-bicycleTubeVending',
    'layer-drinkingWater': 'poi-drinkingWater'
  };

  Object.entries(layerCheckboxes).forEach(([checkboxId, layerId]) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.addEventListener('change', function () {
        togglePoiLayer(layerId, checkbox.checked);
      });
    }
  });
}

/**
 * Toggle POI layer visibility and load data if needed
 */
function togglePoiLayer(layerId, visible) {
  if (layerId === 'problem-markers-layer') {
    // Problem markers are already loaded
    setLayerVisibility(layerId, visible);
    return;
  }

  if (visible) {
    // Load POI data if not already loaded
    const poiType = layerId.replace('poi-', '');
    loadPoiData(poiType);
  } else {
    // Hide layer
    setLayerVisibility(layerId, false);
  }
}

/**
 * Load POI data for a specific type
 */
async function loadPoiData(poiType) {
  if (!rkGlobal.currentRegion) {
    console.warn('No region selected, cannot load POI data');
    return;
  }

  const poiFile = `data/osm-overpass/${rkGlobal.currentRegion}-${poiType}.json`;

  try {
    const response = await fetch(poiFile);
    if (!response.ok) {
      console.warn(`POI file not found: ${poiFile}`);
      return;
    }

    const data = await response.json();
    createPoiLayer(poiType, data);
  } catch (error) {
    console.warn(`Error loading POI data for ${poiType}:`, error);
  }
}

/**
 * Create MapLibre layer for POI data
 */
function createPoiLayer(poiType, data) {
  const layerId = `poi-${poiType}`;
  const sourceId = `source-${poiType}`;

  // Convert OSM Overpass data to GeoJSON
  const geojsonData = {
    type: "FeatureCollection",
    features: data.elements
      .filter(element => element.lat && element.lon)
      .map(element => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [element.lon, element.lat]
        },
        properties: {
          ...element.tags,
          osmId: element.id,
          osmType: element.type
        }
      }))
  };

  // Remove existing source and layer if they exist
  if (rkGlobal.map.getSource(sourceId)) {
    rkGlobal.map.removeLayer(layerId);
    rkGlobal.map.removeSource(sourceId);
  }

  // Add source
  rkGlobal.map.addSource(sourceId, {
    type: 'geojson',
    data: geojsonData
  });

  // Add layer - use circle symbol for now since we don't have the POI icons loaded yet
  rkGlobal.map.addLayer({
    id: layerId,
    type: 'circle',
    source: sourceId,
    layout: {
      'visibility': 'visible'
    },
    paint: {
      'circle-radius': 6,
      'circle-color': getPoiColor(poiType),
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
      'circle-opacity': 0.8
    }
  });

  console.log(`Added POI layer: ${layerId} with ${geojsonData.features.length} features`);
}

/**
 * Get color for POI type (temporary until we have proper icons)
 */
function getPoiColor(poiType) {
  const colorMap = {
    'transit': '#004B67',     // Dark blue for transit
    'bicycleShop': '#B8CC24',  // Green for bike shops
    'bicycleRepairStation': '#51A4B6', // Light blue for repair
    'bicyclePump': '#FF6600',  // Orange for pumps
    'bicycleTubeVending': '#A2C8D3', // Light blue for vending
    'drinkingWater': '#51A4B6' // Blue for water
  };

  return colorMap[poiType] || '#666666';
}

/**
 * Get icon name for POI type
 */
function getPoiIcon(poiType) {
  const iconMap = {
    'transit': 'subway-icon',
    'bicycleShop': 'bicycle-shop-icon',
    'bicycleRepairStation': 'repair-station-icon',
    'bicyclePump': 'pump-icon',
    'bicycleTubeVending': 'tube-vending-icon',
    'drinkingWater': 'water-icon'
  };

  return iconMap[poiType] || 'default-poi-icon';
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
