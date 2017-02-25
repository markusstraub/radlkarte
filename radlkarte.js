var rkGlobal = {}; // global variable for radlkarte properties / data storage
rkGlobal.leafletMap = undefined; // the main leaflet map
rkGlobal.leafletLayersControl = undefined; // leaflet layer-control
rkGlobal.priorityStrings = ["Überregional", "Regional", "Lokal"]; // names of all different levels of priorities (ordered descending by priority)
rkGlobal.stressfulnessStrings = ["Ruhig", "Durchschnittlich", "Stressig"]
rkGlobal.stressfulnessLineWidthFactor = [1.2, 0.5, 0.4];
rkGlobal.stressfulnessArrowWidthFactor = [2, 3, 3];
rkGlobal.priorityOpacities = [1, 1, 1];
rkGlobal.priorityColors = ['#004B67', '#51A4B6', '#a8d1da'];
rkGlobal.debug = true; // debug output will be logged if set to true

function debug(obj) {
    if(rkGlobal.debug)
        console.log(obj);
}

function loadGeoJson() {
    // get rid of "XML Parsing Error: not well-formed" during $.getJSON
    $.ajaxSetup({
        beforeSend: function (xhr) {
            if (xhr.overrideMimeType) {
                xhr.overrideMimeType("application/json");
            }
        }
    });
    $.getJSON("data/radlkarte-at-vienna.min.geojson", function(data) {
        // load into temp layer
        var routeSegments = L.geoJSON(data, {
            filter: function (feature) {
                return feature.geometry.type == "LineString"
                       && feature.properties !== undefined;
            }
        });
        debug("loaded segment count: " + routeSegments.getLayers().length);
        
        // prepare layergroups for each priority and each stressfulness for easier showing/hiding and styling
        rkGlobal.segments = { priority: [], stressfulness: []};
        for(var i=0; i<rkGlobal.priorityStrings.length; i++) {
            rkGlobal.segments.priority.push({
                polyLines: L.featureGroup(), // contains polylines (for easy styling)
                onewayMarkers: L.featureGroup(), // contains oneway markers as L.polylineDecorator (for easy styling)
                all: L.layerGroup(), // contains both polylines & onewaymarkers (for easy toggling of visibility in the map)
            });
        }
        for(var i=0; i<rkGlobal.stressfulnessStrings.length; i++) {
            rkGlobal.segments.stressfulness.push({
                polyLines: L.featureGroup(), // contains polylines (for easy styling)
                onewayMarkers: L.featureGroup() // contains oneway markers as L.polylineDecorator (for easy styling)
            });
        }
        
        routeSegments.getLayers().forEach(function(layer) {
            let priority = parseInt(layer.feature.properties.p, 10);
            let stressfulness = parseInt(layer.feature.properties.s, 10);
            if(!isNaN(priority) && !isNaN(stressfulness) && layer.getLatLngs().length >= 2) {
                // (1) the line
                rkGlobal.segments.priority[priority].polyLines.addLayer(layer);
                rkGlobal.segments.stressfulness[stressfulness].polyLines.addLayer(layer);
                
                // (2) the markers (warning latLon expected!)
                if(layer.feature.properties.oneway == 'yes') {
                    let decoratorLayer = L.polylineDecorator(layer.getLatLngs());
                    decoratorLayer.radlkarteProperties = {priority: priority, stressfulness: stressfulness};
                    rkGlobal.segments.priority[priority].onewayMarkers.addLayer(decoratorLayer);
                    rkGlobal.segments.stressfulness[stressfulness].onewayMarkers.addLayer(decoratorLayer);
                }
            }
        });
        
        // collect lines & markers in 'all' (by priority)
        for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
            rkGlobal.segments.priority[priority].all.addLayer(rkGlobal.segments.priority[priority].polyLines);
            rkGlobal.segments.priority[priority].all.addLayer(rkGlobal.segments.priority[priority].onewayMarkers);
        }
        
        // initial styling for markers and segments
        updateStyles();
        
        // add to map & layercontrol
        for(var priority=rkGlobal.priorityStrings.length-1; priority>= 0; priority--) {
            rkGlobal.segments.priority[priority].all.addTo(rkGlobal.leafletMap);
            rkGlobal.leafletLayersControl.addOverlay(rkGlobal.segments.priority[priority].all, rkGlobal.priorityStrings[priority]);
        }
        
        rkGlobal.leafletMap.on('zoomend', function(ev) {
            debug("restyling - changed zoom level to " + rkGlobal.leafletMap.getZoom());
            updateStyles();
        });
    });
}

/**
 * Updates the styles of all layers. Takes current zoom level into account
 */
function updateStyles() {
    for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
        rkGlobal.segments.priority[priority].polyLines.setStyle(getLineStringStyleForPriority(priority));
        rkGlobal.segments.priority[priority].onewayMarkers.eachLayer(function (layer) {
            layer.setPatterns(getOnewayArrowPatterns(layer.radlkarteProperties.priority, layer.radlkarteProperties.stressfulness));
        });
    }
    for(var stressfulness=0; stressfulness<rkGlobal.stressfulnessStrings.length; stressfulness++) {
        rkGlobal.segments.stressfulness[stressfulness].polyLines.setStyle(getLineStringStyleForStressfulness(stressfulness));
    }
}

function getLineStringStyleForPriority(priority) {
    return {color: rkGlobal.priorityColors[priority], opacity: rkGlobal.priorityOpacities[priority]};
}

function getLineStringStyleForStressfulness(stressfulness) {
    var style = {weight: getLineWeightForStressfulness(stressfulness)};
    if(stressfulness >= 2)
        style.dashArray = "5, 5";
    return style;
}

/**
 * @return an array of patterns as expected by L.PolylineDecorator.setPatterns
 */ 
function getOnewayArrowPatterns(priority, stressfulness) {
    var arrowWidth = Math.max(5, getLineWeightForStressfulness(stressfulness) * rkGlobal.stressfulnessArrowWidthFactor[stressfulness]);
    return [
        {
            offset: 25,
            repeat: 50,
            symbol: L.Symbol.arrowHead({
                pixelSize: arrowWidth,
                headAngle: 90,
                pathOptions: {
                    color: rkGlobal.priorityColors[priority],
                    fillOpacity: rkGlobal.priorityOpacities[priority],
                    weight: 0
                }
            })
        }
    ];
}

function getLineWeightForStressfulness(stressfulness) {
    var lineWeight = rkGlobal.leafletMap.getZoom() - 10;
    lineWeight = (lineWeight <= 0 ? 1 : lineWeight) * 1.4;
    lineWeight *= rkGlobal.stressfulnessLineWidthFactor[stressfulness]
    return lineWeight;
}

function initMap() {
    rkGlobal.leafletMap = L.map('map', { 'zoomControl' : false } ).setView([48.2083537, 16.3725042], 14);
    new L.Hash(rkGlobal.leafletMap);

    var mapboxStreets = L.tileLayer('https://api.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.png?access_token={accessToken}', {
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery &copy; <a href="http://mapbox.com">Mapbox</a>',
        accessToken: 'pk.eyJ1IjoiZHRzLWFpdCIsImEiOiJjaW1kbmV5NjIwMDI1dzdtMzBweW14cmZjIn0.VraboGeyXnUjm1e7xWDWbA'
    });
    var osm = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        minZoom: 8,
        maxZoom: 18,
        attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
    });
//     var ocm = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//         minZoom: 8,
//         maxZoom: 18,
//         attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
//     });
    var mapboxSatellite = L.tileLayer('https://api.tiles.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token={accessToken}', {
        maxZoom: 18,
        attribution: 'Imagery &copy; <a href="http://mapbox.com">Mapbox</a>',
        accessToken: 'pk.eyJ1IjoiZHRzLWFpdCIsImEiOiJjaW1kbmV5NjIwMDI1dzdtMzBweW14cmZjIn0.VraboGeyXnUjm1e7xWDWbA'
    });
    var empty = L.tileLayer('', {attribution: ''});
    
    var baseMaps = {
        "OpenStreetMap (Mapbox)": mapboxStreets,
        "Satellitenbild (Mapbox)": mapboxSatellite,
        //"OpenCycleMap": ocm,
        "OpenStreetMap": osm,
        "Leer": empty,
    };
    var overlayMaps = {};
    
    mapboxStreets.addTo(rkGlobal.leafletMap)
    rkGlobal.leafletLayersControl = L.control.layers(baseMaps, overlayMaps, { 'position' : 'topright', 'collapsed' : true } ).addTo(rkGlobal.leafletMap);
    
    // load overlay & control
    loadGeoJson();
}
