"use strict";

var rkGlobal = {}; // global variable for radlkarte properties / data storage
rkGlobal.leafletMap = undefined; // the main leaflet map
rkGlobal.hash = undefined; // leaflet-hash object, contains the currently active region
rkGlobal.leafletLayersControl = undefined; // leaflet layer-control
rkGlobal.geocodingControl = undefined;
rkGlobal.segments = {}; // object holding all linestring and decorator layers (the key represents the properties)
rkGlobal.segmentsPS = []; // matrix holding all segments (two dimensions: priority & stress)
rkGlobal.markerLayerLowZoom = L.layerGroup(); // layer group holding all icons to be viewed at lower zoom levels
rkGlobal.markerLayerHighZoom = L.layerGroup(); // layer group holding all icons to be viewed at higher zoom levels
rkGlobal.priorityStrings = ["Überregional", "Regional", "Lokal"]; // names of all different levels of priorities (ordered descending by priority)
rkGlobal.stressStrings = ["Ruhig", "Durchschnittlich", "Stressig"];
rkGlobal.debug = true; // debug output will be logged if set to true
rkGlobal.fullWidthThreshold = 768;
rkGlobal.baseUrl = './'

// style: stress = color, priority = line width
rkGlobal.styleFunction = updateStyles;
rkGlobal.tileLayerOpacity = 1;
rkGlobal.priorityFullVisibleFromZoom = [0, 14, 15];
rkGlobal.priorityReducedVisibilityFromZoom = [0, 12, 14];
rkGlobal.onewayIconThreshold = 12;
rkGlobal.iconZoomThresholds = [12, 14];
rkGlobal.lineWidthFactor = [1.4, 0.5, 0.5];
rkGlobal.arrowWidthFactor = [2, 3, 3];
rkGlobal.opacity = 0.62;
rkGlobal.colors = ['#004B67', '#51A4B6', '#FF6600']; // dark blue - light blue - orange

rkGlobal.autoSwitchDistanceMeters = 55000;
rkGlobal.defaultRegion = 'wien';
rkGlobal.defaultZoom = 14;
rkGlobal.configurations = {
	'feldkirch' : {
		loaded: false,
		centerLatLng: L.latLng(47.237, 9.598),
		geocodingBounds: '9.497,47.122,9.845,47.546',
		geoJsonFile: 'data/radlkarte-feldkirch.geojson'
	},
	'klagenfurt' : {
		loaded: false,
		centerLatLng: L.latLng(46.624, 14.308),
		geocodingBounds: '13.978,46.477,14.624,46.778',
		geoJsonFile: 'data/radlkarte-klagenfurt.geojson'
	},
	'linz' : {
		loaded: false,
		centerLatLng: L.latLng(48.30, 14.285),
		geocodingBounds: '13.999,48.171,14.644,48.472',
		geoJsonFile: 'data/radlkarte-linz.geojson'
	},
	'wien' : {
		loaded: false,
		centerLatLng: L.latLng(48.208, 16.372),
		geocodingBounds: '16.105,47.995,16.710,48.389', // min lon, min lat, max lon, max lat
		geoJsonFile: 'data/radlkarte-wien.geojson'
	}
}

function debug(obj) {
	if(rkGlobal.debug) {
		console.log(obj);
	}
}

/**
 * set the currently active region.
 * called from rkGlobal.hash (when region is changed e.g. via hyperlink or by changing the URL)
 */
function updateRadlkarteRegion(region) {
	var configuration = rkGlobal.configurations[region];
	if(configuration === undefined) {
		console.log('unknown region ' + region);
	} else if(configuration.loaded === false) {
		loadGeoJson(configuration.geoJsonFile);
		rkGlobal.geocodingControl.options.geocoder.options.geocodingQueryParams.bounds = configuration.geocodingBounds;
		configuration.loaded = true;

		// virtual page hit in google analytics
		ga('set', 'page', '/' + region);
		ga('send', 'pageview');
	}
}

function loadGeoJson(file) {
	// get rid of "XML Parsing Error: not well-formed" during $.getJSON
	$.ajaxSetup({
		beforeSend: function (xhr) {
			if (xhr.overrideMimeType) {
				xhr.overrideMimeType("application/json");
			}
		}
	});
	$.getJSON(file, function(data) {
		var i, j; // loop counter
		var p, s; // priority / stress

		if(data.type != "FeatureCollection") {
			console.error("expected a GeoJSON FeatureCollection. no radlkarte network can be displayed.");
			return;
		}

		// first step - collect geojson linestring features
		var ignoreCount = 0;
		var goodCount = 0;
		var poiCount = 0;
		var markerLayers;

		var categorizedLinestrings = {};
		for (i=0; i<data.features.length; i++) {
			var geojson = data.features[i];
			if(geojson.type != 'Feature' || geojson.properties == undefined || geojson.geometry == undefined || geojson.geometry.type != 'LineString' || geojson.geometry.coordinates.length < 2) {
				if(geojson.geometry.type == 'Point') {
					markerLayers = getMarkerLayersIncludingPopup(geojson);
					if(markerLayers != null) {
						rkGlobal.markerLayerLowZoom.addLayer(markerLayers.lowZoom);
						rkGlobal.markerLayerHighZoom.addLayer(markerLayers.highZoom);
						++poiCount;
					} else {
						++ignoreCount;
					}
				} else {
					console.warn("ignoring invalid object (not a proper linestring feature): " + JSON.stringify(geojson));
					++ignoreCount;
				}
				continue;
			}

			p = parseInt(geojson.properties.priority, 10);
			s = parseInt(geojson.properties.stress, 10);
			if(isNaN(p) || isNaN(s)) {
				console.warn("ignoring invalid object (priority / stress not set): " + JSON.stringify(geojson));
				++ignoreCount;
				continue;
			}

			// collect linestrings by category
			addSegmentToObject(categorizedLinestrings, geojson);

			++goodCount;
		}
		debug("processed " + goodCount + " valid LineString features, " + poiCount + " Point features, and " + ignoreCount + " ignored features.");

		// second step - merge geojson linestring features
		// with the same properties into a single multilinestring
		// and then put them in a leaflet layer
		for(const key of Object.keys(categorizedLinestrings)) {
			var multilinestringFeatures = turf.combine(turf.featureCollection(categorizedLinestrings[key]));
			multilinestringFeatures['properties'] = JSON.parse(key);

			var decoratorCoordinates = []
			for(const linestring of categorizedLinestrings[key]) {
				decoratorCoordinates.push(turf.flip(linestring).geometry.coordinates);
			}

			rkGlobal.segments[key] = {
				'lines': L.geoJSON(multilinestringFeatures),
				'decorators': L.polylineDecorator(decoratorCoordinates)
			}
		}

		// TODO reactivate layer sorting? (high priority on top)
//		 for(p in rkGlobal.segmentsPS) {
//			 for(s in rkGlobal.segmentsPS[p]) {
//				 rkGlobal.segmentsPS[p][s].lines.bringToBack();
//				 if(rkGlobal.segmentsPS[p][s].decorators != undefined)
//					 rkGlobal.segmentsPS[p][s].decorators.bringToBack();
//			 }
//		 }

		rkGlobal.styleFunction();

		// add to map & layercontrol
//		for(var priority=rkGlobal.priorityStrings.length-1; priority>= 0; priority--) {
//			rkGlobal.segments.priority[priority].all.addTo(rkGlobal.leafletMap);
//			rkGlobal.leafletLayersControl.addOverlay(rkGlobal.segments.priority[priority].all, rkGlobal.priorityStrings[priority]);
//		}

		rkGlobal.leafletMap.on('zoomend', function(ev) {
			//debug("zoom level changed to " + rkGlobal.leafletMap.getZoom() + ".. enqueueing style change");
			$("#map").queue(function() {
				rkGlobal.styleFunction();
				$(this).dequeue();
			});
		});
	});
}

function addSegmentToObject(object, geojsonLinestring) {
	var key = getSegmentKey(geojsonLinestring);
	var keyString = JSON.stringify(key);
	if(object[keyString] === undefined) {
		object[keyString] = [];
	}
	object[keyString].push(geojsonLinestring);
}

/*
 * Get a JSON object as key for a segment linestring.
 * This object explicitly contains all values to be used in styling
 */
function getSegmentKey(geojsonLinestring) {
	var properties = geojsonLinestring.properties
	return {
		"priority": properties.priority,
		"stress": properties.stress,
		"oneway": properties.oneway === undefined ? 'no' : properties.oneway,
		"unpaved": properties.unpaved === undefined ? 'no' : properties.unpaved,
		"steep": properties.steep === undefined ? 'no' : properties.steep,
		"winter": properties.winter === undefined ? 'no' : properties.winter
	};
}

/**
 * Updates the styles of all layers. Takes current zoom level into account
 */
function updateStyles() {
	var zoom = rkGlobal.leafletMap.getZoom();
	for(const key of Object.keys(rkGlobal.segments)) {
		var properties = JSON.parse(key);
		var showFull = zoom >= rkGlobal.priorityFullVisibleFromZoom[properties.priority];
		var showMinimal = zoom < rkGlobal.priorityFullVisibleFromZoom[properties.priority] && zoom >= rkGlobal.priorityReducedVisibilityFromZoom[properties.priority];

		var lineStyle;
		if(showFull) {
			 lineStyle = getLineStyle(zoom, properties);
		} else if(showMinimal) {
			lineStyle = getLineStyleMinimal(properties);
		}

		if(showFull || showMinimal) {
			rkGlobal.segments[key].lines.setStyle(lineStyle);
			rkGlobal.leafletMap.addLayer(rkGlobal.segments[key].lines);
		} else {
			rkGlobal.leafletMap.removeLayer(rkGlobal.segments[key].lines);
		}

		if(showFull && zoom >= rkGlobal.onewayIconThreshold && properties.oneway === 'yes') {
			rkGlobal.segments[key].decorators.setPatterns(getOnewayArrowPatterns(zoom, properties));
			rkGlobal.leafletMap.addLayer(rkGlobal.segments[key].decorators);
		} else {
			rkGlobal.leafletMap.removeLayer(rkGlobal.segments[key].decorators);
		}
	}

	if(zoom >= rkGlobal.iconZoomThresholds[1]) {
		rkGlobal.leafletMap.removeLayer(rkGlobal.markerLayerLowZoom);
		rkGlobal.leafletMap.addLayer(rkGlobal.markerLayerHighZoom);
	} else if(zoom >= rkGlobal.iconZoomThresholds[0]) {
		rkGlobal.leafletMap.removeLayer(rkGlobal.markerLayerHighZoom);
		rkGlobal.leafletMap.addLayer(rkGlobal.markerLayerLowZoom);
	} else {
		rkGlobal.leafletMap.removeLayer(rkGlobal.markerLayerHighZoom);
		rkGlobal.leafletMap.removeLayer(rkGlobal.markerLayerLowZoom);
	}
}

function getLineStyle(zoom, properties) {
	var style = {
		color: rkGlobal.colors[properties.stress],
		weight: getLineWeight(zoom, properties.priority),
		opacity: rkGlobal.opacity,
	};
	if(properties.unpaved === 'yes') {
		style.dashArray = getDashStyle(style.weight);
	}
	return style;
}

function getLineStyleMinimal(properties) {
	var style = {
		color: rkGlobal.colors[properties.stress],
		weight: 1,
		opacity: rkGlobal.opacity
	};
	if(properties.unpaved === 'yes') {
		style.dashArray = getDashStyle(style.weight);
	}
	return style;
}

function getLineWeight(zoom, priority) {
	var lineWeight = zoom - 10;
	lineWeight = (lineWeight <= 0 ? 1 : lineWeight) * 1.4;
	lineWeight *= rkGlobal.lineWidthFactor[priority];
	return lineWeight;
}

function getDashStyle(lineWidth) {
	return (lineWidth * 2) + " " + (lineWidth * 2);
}

/**
 * @return an array of patterns as expected by L.PolylineDecorator.setPatterns
 */
function getOnewayArrowPatterns(zoom, properties) {
	var arrowWidth = Math.max(5, getLineWeight(zoom, properties.priority) * rkGlobal.arrowWidthFactor[properties.priority]);
	return [
	{
		offset: 25,
		repeat: 50,
		symbol: L.Symbol.arrowHead({
			pixelSize: arrowWidth,
			headAngle: 90,
			pathOptions: {
				color: rkGlobal.colors[properties.stress],
				fillOpacity: rkGlobal.opacity,
				weight: 0
			}
		})
	}
	];
}

function loadLeaflet() {
	rkGlobal.leafletMap = L.map('map', { 'zoomControl' : false } );

	var cartodbPositronLowZoom = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: 'abcd',
		minZoom: 0,
		maxZoom: 15
	});
	var osmHiZoom = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		minZoom: 16,
		maxZoom: 19,
		attribution: 'map data &amp; imagery &copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors'
	});
	var mixed = L.layerGroup([cartodbPositronLowZoom, osmHiZoom]);

	var basemapAtOrthofoto = L.tileLayer('https://maps{s}.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.{format}', {
		maxZoom: 18, // up to 20 is possible
		attribution: 'Datenquelle: <a href="https://www.basemap.at">basemap.at</a>',
		subdomains: ["", "1", "2", "3", "4"],
		format: 'jpeg',
		bounds: [[46.35877, 8.782379], [49.037872, 17.189532]]
	});
	var ocm = L.tileLayer('https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=ab5e4b2d24854fefb139c538ef5187a8', {
		minZoom: 0,
		maxZoom: 18,
		attribution: 'map data &copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors, imagery &copy; <a href="https://www.thunderforest.com" target="_blank">Thunderforest</a>'
	});
	var empty = L.tileLayer('', {attribution: ''});

	/*var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		minZoom: 0,
		maxZoom: 18,
		attribution: 'map data &amp; imagery &copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors'
	});*/

	var baseMaps = {
		"Straßenkarte": mixed,
		"Luftbild": basemapAtOrthofoto,
		"OpenCycleMap": ocm,
		//"OpenStreetMap": osm,
		"Weiß": empty,
	};
	var overlayMaps = {};

	// TODO zoom level jumps: https://github.com/Leaflet/Leaflet/issues/6557
	mixed.addTo(rkGlobal.leafletMap);
	rkGlobal.leafletLayersControl = L.control.layers(baseMaps, overlayMaps, { 'position' : 'topright', 'collapsed' : true } ).addTo(rkGlobal.leafletMap);

	rkGlobal.geocodingControl = L.Control.geocoder({
		position: 'topright',
		placeholder: 'Adresssuche',
		errorMessage: 'Leider nicht gefunden',
		geocoder: L.Control.Geocoder.opencage("657bf10308f144c7a9cbb7675c9b0d36", {
			geocodingQueryParams: {
				countrycode: 'at',
				language: 'de'
				// bounds are set later via updateRadlkarteRegion (min lon, min lat, max lon, max lat)
			}
		}),
		defaultMarkGeocode: false
	}).on('markgeocode', function(e) {
		var result = e.geocode || e;
// 		var bbox = result.bbox;
// 		var poly = L.polygon([
// 			bbox.getSouthEast(),
// 			bbox.getNorthEast(),
// 			bbox.getNorthWest(),
// 			bbox.getSouthWest()
// 		]);
// 		rkGlobal.leafletMap.fitBounds(poly.getBounds(), {maxZoom: 17});
		console.log(result);
		var resultCenter = L.latLng(result.center.lat, result.center.lng);
		rkGlobal.leafletMap.panTo(resultCenter);
		var resultText = result.name;
		resultText = resultText.replace(/, Österreich$/, "").replace(/, /g, "<br/>");

		var popup = L.popup({
			autoClose: false,
			closeOnClick: false,
			closeButton: true
		}).setLatLng(e.geocode.center).setContent(resultText).openOn(rkGlobal.leafletMap);
	}).addTo(rkGlobal.leafletMap);

	var locateControl = L.control.locate({
		position: 'topright',
		setView: 'untilPanOrZoom',
		flyTo: true,
		//markerStyle: { weight: 5 },
		locateOptions: {
			enableHighAccuracy: true,
			watch: true,
			maxZoom: 16
		},
		strings: {
			title: 'Verfolge Position'
		}
	}).addTo(rkGlobal.leafletMap);

	L.control.zoom({position: 'topright'}).addTo(rkGlobal.leafletMap);

	var sidebar = L.control.sidebar({
		container: 'sidebar',
		position: 'left'
	}).addTo(rkGlobal.leafletMap);
	if(window.innerWidth < rkGlobal.fullWidthThreshold) {
		sidebar.close();
	}

	initializeIcons();

	// initialize hash, this causes loading of the default region
	// and positioning of the map
	rkGlobal.hash = new L.Hash(rkGlobal.leafletMap);
}

function initializeIcons() {
	rkGlobal.icons = {};
	rkGlobal.icons.dismount = L.icon({
		iconUrl: rkGlobal.baseUrl + 'css/dismount.png',
		iconSize: [33, 29],
		iconAnchor: [16.5, 14.5],
		popupAnchor: [0, -14.5]
	});
	rkGlobal.icons.noCargo = L.icon({
		iconUrl: rkGlobal.baseUrl + 'css/nocargo.png',
		iconSize: [29, 29],
		iconAnchor: [14.5, 14.5],
		popupAnchor: [0, -14.5]
	});
	rkGlobal.icons.noCargoAndDismount = L.icon({
		iconUrl: rkGlobal.baseUrl + 'css/nocargo+dismount.png',
		iconSize: [57.7, 29],
		iconAnchor: [28.85, 14.5],
		popupAnchor: [0, -14.5]
	});
	rkGlobal.icons.redDot = L.icon({
		iconUrl: rkGlobal.baseUrl + 'css/reddot.png',
		iconSize: [10, 10],
		iconAnchor: [5, 5],
		popupAnchor: [0, -5]
	});
}

function getMarkerLayersIncludingPopup(geojsonPoint) {
	var icon = getIcon(geojsonPoint.properties);
	if(icon == null)
		return undefined;

	var description = getDescriptionText(geojsonPoint.properties);
	var markers = {
		lowZoom: L.marker(L.geoJSON(geojsonPoint).getLayers()[0].getLatLng(), {
			icon: rkGlobal.icons.redDot,
			alt: description
		}),
		highZoom: L.marker(L.geoJSON(geojsonPoint).getLayers()[0].getLatLng(), {
			icon: icon,
			alt: description
		})
	};

	markers.lowZoom.bindPopup(description, {closeButton: false});
	markers.lowZoom.on('mouseover', function() { markers.lowZoom.openPopup(); });
	markers.lowZoom.on('mouseout', function() { markers.lowZoom.closePopup(); });

	markers.highZoom.bindPopup(description, {closeButton: false});
	markers.highZoom.on('mouseover', function() { markers.highZoom.openPopup(); });
	markers.highZoom.on('mouseout', function() { markers.highZoom.closePopup(); });

//	 var key, marker;
//	 for (key in markers) {
//		 marker = markers[key];
//		 marker.bindPopup(description, {closeButton: false});  //, offset: L.point(0, -10)});
//		 marker.on('mouseover', function() { marker.openPopup(); });
//		 marker.on('mouseout', function() { marker.closePopup(); }); // FIXME why is mouseover/out not working for lowZoom?
//		 break;
//	 }

	return markers;
}

/**
 * @param properties GeoJSON properties of a point
 * @return an matching icon or undefined if no icon should be used
 */
function getIcon(properties) {
	var dismount = properties.dismount == 'yes';
	var nocargo = properties.nocargo == 'yes';

	if(dismount && nocargo) {
		return rkGlobal.icons.noCargoAndDismount;
	} else if(dismount) {
		return rkGlobal.icons.dismount;
	} else if(nocargo) {
		return rkGlobal.icons.noCargo;
	}
	return undefined;
}

/**
 * @param properties GeoJSON properties of a point
 * @return a description string
 */
function getDescriptionText(properties) {
	var dismount = properties.dismount == 'yes';
	var nocargo = properties.nocargo == 'yes';
	var description = properties.description;
	if(description == null) {
		description = '';
	} else {
		description = ':<br>' + description;
	}

	if(dismount && nocargo) {
		return '<span class="popup">Schiebestelle / untauglich für Spezialräder' + description + '</span>';
	} else if(dismount) {
		return '<span class="popup">Schiebestelle' + description+ '</span>';
	} else if(nocargo) {
		return '<span class="popup">Untauglich für Spezialräder' + description+ '</span>';
	}
	return undefined;
}
