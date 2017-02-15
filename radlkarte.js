var rkGlobal = {}; // global variable for radlkarte properties / data storage
rkGlobal.leafletMap = undefined; // the main leaflet map
rkGlobal.leafletLayersControl = undefined; // leaflet layer-control
rkGlobal.priorityStrings = ["Überregional", "Regional", "Lokal"]; // names of all different levels of priorities (ordered descending by priority)
rkGlobal.priorityWidthFactor = [1.2, 0.5, 0.4];
rkGlobal.opacity = 0.7;
rkGlobal.color = '#FF6600';
rkGlobal.debug = false; // debug output will be logged if set to true

function debug(obj) {
    if(rkGlobal.debug)
        console.log(obj);
}

function loadGeoJson() {
    $.getJSON("data/wege-durch-wien.geojson", function(data) {
        // load into temp layer
        var routeSegments = L.geoJSON(data, {
            filter: function (feature) {
                return feature.geometry.type == "LineString"
                       && feature.properties !== undefined;
            }
        });
        console.log("loaded segment count: " + routeSegments.getLayers().length);
        
        // separate segments by priority & extract latLons
        rkGlobal.segmentsByPriority = []
        for(var i=0; i<rkGlobal.priorityStrings.length; i++)
            rkGlobal.segmentsByPriority.push({
                all: L.layerGroup(), // contains polylines & onewaymarkers (for easy toggling of visibility in the map)
                polyLines: L.featureGroup(), // contains polylines (for easy styling)
                onewayMarkers: undefined, // contains oneway markers in a L.polylineDecorator (for easy styling)
                onewayLatLons: []
            });
        
        routeSegments.getLayers().forEach(function(layer) {
            var priority = parseInt(layer.feature.properties.detail, 10);
            if(!isNaN(priority) && layer.getLatLngs().length >= 2) {
                // (1) the line
                rkGlobal.segmentsByPriority[priority].polyLines.addLayer(layer);
                
                // (2) the markers (warning latLon expected!)
                if(layer.feature.properties.oneway == 'yes') {
                    rkGlobal.segmentsByPriority[priority].onewayLatLons.push(layer.getLatLngs());
                }
            }
        });
        
        // create a single polylineDecorator layer (which is a layergroup) per priority (so can be styled in one go)
        for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
            var markerLayer = L.polylineDecorator(rkGlobal.segmentsByPriority[priority].onewayLatLons);
            rkGlobal.segmentsByPriority[priority].onewayMarkers = markerLayer;
        }

        // collect lines & markers in 'all'
        for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
            rkGlobal.segmentsByPriority[priority].all.addLayer(rkGlobal.segmentsByPriority[priority].polyLines);
            rkGlobal.segmentsByPriority[priority].all.addLayer(rkGlobal.segmentsByPriority[priority].onewayMarkers);
        }
        
        // initial styling for markers and segments
        updateStyles();
        
        // add to map & layercontrol
        for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
            rkGlobal.segmentsByPriority[priority].all.addTo(rkGlobal.leafletMap);
            rkGlobal.leafletLayersControl.addOverlay(rkGlobal.segmentsByPriority[priority].all, rkGlobal.priorityStrings[priority]);
        }
        
        rkGlobal.leafletMap.on('zoomend', function(ev) {
            debug("current zoom level: " + rkGlobal.leafletMap.getZoom());
            updateStyles();
        });
    });
}


/**
 * Updates the styles of all layers. Takes current zoom level into account
 */
function updateStyles() {
    for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
        rkGlobal.segmentsByPriority[priority].polyLines.setStyle(getLineStringStyle(priority));
        rkGlobal.segmentsByPriority[priority].onewayMarkers.setPatterns(getOnewayArrowPatterns(priority));
    }
}

function getLineStringStyle(priority) {
    var style = {color: rkGlobal.color, weight: getLineWeight(priority), opacity: rkGlobal.opacity};
    if(priority >= 2)
        style.dashArray = "5, 5";
    return style;
}

/**
 * @return an array of patterns as expected by L.PolylineDecorator.setPatterns
 */ 
function getOnewayArrowPatterns(priority) {
    var arrowWidth = getLineWeight(priority) * 2;
    return [
        {
            offset: 25,
            repeat: 50,
            symbol: L.Symbol.arrowHead({
                pixelSize: arrowWidth,
                headAngle: 90,
                pathOptions: {
                    color: rkGlobal.color,
                    fillOpacity: rkGlobal.opacity,
                    weight: 0
                }
            })
        }
    ];
}

function getLineWeight(priority) {
    var lineWeight = rkGlobal.leafletMap.getZoom() - 10;
    lineWeight = (lineWeight <= 0 ? 1 : lineWeight) * 1.4;
    lineWeight *= rkGlobal.priorityWidthFactor[priority]
    return lineWeight;
}

function initMap() {
    rkGlobal.leafletMap = L.map('map', { 'zoomControl' : false } ).setView([48.2083537, 16.3725042], 14);

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
    
    empty.addTo(rkGlobal.leafletMap)
    rkGlobal.leafletLayersControl = L.control.layers(baseMaps, overlayMaps, { 'position' : 'topleft', 'collapsed' : false } ).addTo(rkGlobal.leafletMap);
    
    // load overlay & control
    loadGeoJson();
}
