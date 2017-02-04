var rkGlobal = {}; // global variable for radlkarte properties / data storage

rkGlobal.debug = false; // debug output will be logged if set to true

rkGlobal.map = undefined; // leaflet-map-object
rkGlobal.layerControl = undefined; // leaflet layer-control

rkGlobal.markerLines = new Array();

rkGlobal.jsonLayers = new Array();
rkGlobal.jsonLayersVisible = new Array();
rkGlobal.layer; // radlkarte-overlay layer displaying the geojson objects
rkGlobal.opacity = 0.7;
rkGlobal.widthFactor = {
    "premium" : 1.2,
    "calm" : 1.2,
    "medium": 0.5,
    "stressful": 0.4
};

function debug(obj) {
    if(rkGlobal.debug)
        console.log(obj);
}


// ----------------------------------------------------------- geojson functions

function loadGeoJson() {
    // load GeoJSON layer (in separate thread)
    $.getJSON("data/wege-durch-wien.geojson", function(data) {
        // add all geojson objects to the layer and style them
        var cnt = 0;
        var cntGood = 0;
        rkGlobal.layer = L.geoJSON(data, {
            onEachFeature: function (feature, layer) {
                if(feature.properties.oneway == 'yes') {
                    // warning latLon expected!
                    //console.log("layer.getLatLngs: " + layer.getLatLngs());
                    var arrowWidth = getBaseLineWeight() * rkGlobal.widthFactor[feature.properties.ambience];
                    arrowWidth = Math.max(arrowWidth * 2, arrowWidth + 8);
                    var markerLine = L.polylineDecorator(layer.getLatLngs(), {
                        patterns: [
                            {
                                offset: 25,
                                repeat: 50,
                                symbol: L.Symbol.arrowHead({
                                    pixelSize: arrowWidth,
                                    headAngle: 90,
                                    pathOptions: {
                                        color: '#FF6600',
                                        fillOpacity: rkGlobal.opacity,
                                        weight: 0}
                                })
                            }
                        ]
                    }).addTo(rkGlobal.map);
                    rkGlobal.markerLines.push(markerLine)
                }
            },
            style: function(feature) {
                cnt++;
                // ignore invalid entries
                if(feature.geometry.type != "LineString" || feature.properties == undefined) {
                    return;
                } else {
                    cntGood++;
                    return styleGeoJson(feature);
                }
            }
        }).addTo(rkGlobal.map);

        
        debug('styled geojson. ' + cnt + ' total, ' + cntGood + ' styled');
        
        // filter out empty/invalid objects & put the rest into an array
        var cnt = 0;
        var cntGood = 0;
        rkGlobal.layer.eachLayer(function (layer) {
            cnt++;
            if(layer.feature.geometry.type != "LineString" || layer.feature.properties == undefined || layer.feature.geometry.coordinates.length == 0) {
                debug("removing feature:");
                debug(layer.feature);
                rkGlobal.layer.removeLayer(layer);
                return;
            }
            rkGlobal.jsonLayers.push(layer);
            rkGlobal.jsonLayersVisible.push(true);
            cntGood++;
        });
        debug(rkGlobal.jsonLayers);
        debug(rkGlobal.jsonLayersVisible);
        debug('finished loading geojson. ' + cnt + ' total, ' + cntGood + ' in result');
    });
    
    rkGlobal.map.on('zoomend', function(ev) {
        debug("current zoom level: " + rkGlobal.map.getZoom());
        rkGlobal.layer.setStyle(styleGeoJson);
        // TODO adapt zoom of arrows
        /*
        var currentZoom = (rkGlobal.map.getZoom()-10)*2.4;
        rkGlobal.layer.eachLayer(function (layer) {
            layer.options.weight = currentZoom;
        });
        */
    });
}

/** 
expects: a feature (linestring) with properties
returns: a style for the feature depending on the properties & the current zoom level
*/
function styleGeoJson(feature) {
    var lineWeight = getBaseLineWeight() * rkGlobal.widthFactor[feature.properties.ambience];
    switch (feature.properties.ambience) {
        case 'premium':   return {color: "#FF6600", weight: lineWeight, opacity: rkGlobal.opacity}; //#7b3294
        case 'calm':      return {color: "#FF6600", weight: lineWeight, opacity: rkGlobal.opacity}; //#c2a5cf
        case 'medium':    return {color: "#FF6600", weight: lineWeight, opacity: rkGlobal.opacity}; //#a6dba0
        case 'stressful': return {color: "#FF6600", weight: lineWeight, opacity: rkGlobal.opacity, dashArray: "5, 5"}; //#008837
    }
}

function getBaseLineWeight() {
    var lineWeight = rkGlobal.map.getZoom() - 10;
    lineWeight = (lineWeight <= 0 ? 1 : lineWeight) * 1.4;
    return lineWeight;
}


// ------------------------------------------------------------------------ main


function initMap() {
    rkGlobal.map = L.map('map', { 'zoomControl' : false } ).setView([48.22764,16.40774545], 14);

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
    
    empty.addTo(rkGlobal.map)
    rkGlobal.layerControl = L.control.layers(baseMaps, overlayMaps, { 'position' : 'topleft', 'collapsed' : false } ).addTo(rkGlobal.map);
    
    // load overlay & control
    loadGeoJson();
}
