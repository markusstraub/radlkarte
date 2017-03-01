var rkGlobal = {}; // global variable for radlkarte properties / data storage
rkGlobal.leafletMap = undefined; // the main leaflet map
rkGlobal.leafletLayersControl = undefined; // leaflet layer-control
rkGlobal.priorityStrings = ["Überregional", "Regional", "Lokal"]; // names of all different levels of priorities (ordered descending by priority)
rkGlobal.stressfulnessStrings = ["Ruhig", "Durchschnittlich", "Stressig"];
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
        if(data.type != "FeatureCollection")    {
            console.error("expected a GeoJSON FeatureCollection. no radlkarte network can be displayed.");
            return;
        }
        // combine linestrings with same attributes to multilinestrings
        
        // prepare matrix
        rkGlobal.segmentsPS = []
        for(var i=0; i<rkGlobal.priorityStrings.length; i++) {
            rkGlobal.segmentsPS[i] = [];
            for(var j=0; j<rkGlobal.stressfulnessStrings.length; j++)
                rkGlobal.segmentsPS[i][j] = {lines: [], decorators: []};
        }
        
        // first step - collect geojson linestring features in the matrix 
        var ignoreCount = 0;
        var goodCount = 0;
        for (var geojson of data.features) {
            if(geojson.type != 'Feature' || geojson.properties == undefined || geojson.geometry == undefined || geojson.geometry.type != 'LineString' || geojson.geometry.coordinates.length < 2) {
                console.warn("ignoring invalid object (not a proper linestring feature): " + JSON.stringify(geojson));
                ++ignoreCount;
                continue;
            }
            
            let priority = parseInt(geojson.properties.p, 10);
            let stressfulness = parseInt(geojson.properties.s, 10);
            if(isNaN(priority) || isNaN(stressfulness)) {
                console.warn("ignoring invalid object (priority / stressfulness not set): " + JSON.stringify(geojson));
                ++ignoreCount;
                continue;
            }
            
            // 1) for the lines: add geojson linestring features
            rkGlobal.segmentsPS[priority][stressfulness].lines.push(geojson);
            
            // 2) for the decorators: add latlons
            if(geojson.properties.oneway == 'yes') {
                rkGlobal.segmentsPS[priority][stressfulness].decorators.push(turf.flip(geojson).geometry.coordinates);
            }
            
            ++goodCount;
        }
        debug("processed " + goodCount + " valid LineString Features and " + ignoreCount + " ignored objects");
        
        // second step - merge the geojson linestring features for the same priority-stressfulness level into a single multilinestring
        // and then put them in a leaflet layer
        for(var p in rkGlobal.segmentsPS) {
            for(var s in rkGlobal.segmentsPS[p]) {
                let multilinestringfeature = turf.combine(turf.featureCollection(rkGlobal.segmentsPS[p][s].lines));
                rkGlobal.segmentsPS[p][s].lines = L.geoJSON(multilinestringfeature);
                rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[p][s].lines);
                
                if(rkGlobal.segmentsPS[p][s].decorators.length > 0) {
                    rkGlobal.segmentsPS[p][s].decorators = L.polylineDecorator(rkGlobal.segmentsPS[p][s].decorators);
                    rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[p][s].decorators);
                } else {
                    rkGlobal.segmentsPS[p][s].decorators = undefined;
                }
                // discard properties of multilinestringfeature? no longer needed.
            }
        }
        
        // layer sorting (high priority on top)
        for(var p in rkGlobal.segmentsPS) {
            for(var s in rkGlobal.segmentsPS[p]) {
                rkGlobal.segmentsPS[p][s].lines.bringToBack();
                if(rkGlobal.segmentsPS[p][s].decorators != undefined)
                    rkGlobal.segmentsPS[p][s].decorators.bringToBack();
            }
        }
        
        updateStylesNewskool();
        
        // add to map & layercontrol
//         for(var priority=rkGlobal.priorityStrings.length-1; priority>= 0; priority--) {
//             rkGlobal.segments.priority[priority].all.addTo(rkGlobal.leafletMap);
//             rkGlobal.leafletLayersControl.addOverlay(rkGlobal.segments.priority[priority].all, rkGlobal.priorityStrings[priority]);
//         }
        
        rkGlobal.leafletMap.on('zoomend', function(ev) {
            debug("restyling - changed zoom level to " + rkGlobal.leafletMap.getZoom());
            updateStylesNewskool();
        });
    });
}


rkGlobal.priorityVisibleFromZoom = [0, 14, 15];
rkGlobal.stressfulnessLineWidthFactor = [1.2, 0.5, 0.4];
rkGlobal.stressfulnessArrowWidthFactor = [2, 3, 3];
rkGlobal.priorityOpacities = [0.75, 0.75, 0.75];
// rkGlobal.priorityColors = ['#004B67', '#29788F', '#51A4B6']; // 3 blues
// rkGlobal.priorityColors = ['#FF6600', '#51A4B6', '#51A4B6']; // orange - blue
// rkGlobal.priorityColors = ['#51A4B6', '#51A4B6', '#51A4B6']; // blue (light)
// rkGlobal.priorityColors = ['#004B67', '#004B67', '#004B67']; // blue (dark)
rkGlobal.priorityColors = ['#004B67', '#51A4B6', '#FF6600']; // blue - orange

/**
 * Updates the styles of all layers. Takes current zoom level into account
 */
function updateStylesNewskool() {
    for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
        for(var stressfulness=0; stressfulness<rkGlobal.stressfulnessStrings.length; stressfulness++) {
            if(rkGlobal.leafletMap.getZoom() >= rkGlobal.priorityVisibleFromZoom[priority]) {
//                 rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[priority][stressfulness].lines);
                rkGlobal.segmentsPS[priority][stressfulness].lines.setStyle(getLineStringStyle(stressfulness,priority));
                if(rkGlobal.segmentsPS[priority][stressfulness].decorators != undefined) {
                    rkGlobal.segmentsPS[priority][stressfulness].decorators.setPatterns(getOnewayArrowPatterns(priority, stressfulness));
                    rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[priority][stressfulness].decorators);
                }
            } else {
                rkGlobal.segmentsPS[priority][stressfulness].lines.setStyle(getLineStringStyleMinimal(priority,stressfulness));
//                 rkGlobal.leafletMap.removeLayer(rkGlobal.segmentsPS[priority][stressfulness].lines);
                if(rkGlobal.segmentsPS[priority][stressfulness].decorators != undefined) {
                    rkGlobal.leafletMap.removeLayer(rkGlobal.segmentsPS[priority][stressfulness].decorators);
                }
            }
        }
    }
}

function getLineStringStyle(priority,stressfulness) {
    var style = {
        color: rkGlobal.priorityColors[priority],
        weight: getLineWeightForStressfulness(stressfulness),
        opacity: rkGlobal.priorityOpacities[priority]
    };
    if(stressfulness >= 2)
        style.dashArray = "5, 5";
    return style;
}

function getLineStringStyleMinimal(priority,stressfulness) {
    var style = {
        color: '#999',
        weight: 1,
        opacity: rkGlobal.priorityOpacities[priority],
        dashArray: undefined
    };
    return style;
}

function loadGeoJsonOld() {
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
