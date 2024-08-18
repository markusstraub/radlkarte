(function(window) {
	var HAS_HASHCHANGE = (function() {
		var doc_mode = window.documentMode;
		return ('onhashchange' in window) &&
			(doc_mode === undefined || doc_mode > 7);
	})();

	L.Hash = function(rk, updateRadlkarteRegion,selectPoiLayersForKey, getSelectedPoiLayerKey) {
    this.rk = rk;
    this.updateRadlkarteRegion = updateRadlkarteRegion;
    this.selectPoiLayersForKey = selectPoiLayersForKey;
    this.getSelectedPoiLayerKey = getSelectedPoiLayerKey;
		this.onHashChange = L.Util.bind(this.onHashChange, this);

		if (rk.leafletMap) {
			this.init(rk.leafletMap, rk, updateRadlkarteRegion, selectPoiLayersForKey);
		}
	};

	/** adapted to additionally parse region info from the hash
	 *  and to provide default values if parts of the hash are not present
	 */
	L.Hash.parseHash = function(hash) {
		if(hash.indexOf('#') === 0) {
			hash = hash.substr(1);
		}

		var parsed = {
			region: this.rk.defaultRegion,
			poiLayers: 'p',
			zoom: this.rk.defaultZoom,
			center: undefined
		}

		var args = hash.split("/");

		if(args.length >= 1) {
			var region = args[0];
			if(region in this.rk.configurations) {
				parsed.region = region;
			}
		}

		if(args.length >= 2) {
			parsed.poiLayers = args[1];
		}

		if(args.length >= 3) {
			var zoom = (L.version >= '1.0.0') ? parseFloat(args[2]) : parseInt(args[2], 10);
			if(!isNaN(zoom)) {
				parsed.zoom = zoom
			}
		}

		var lat = undefined;
		var lon = undefined;
		if (args.length >= 5) {
			var lat = parseFloat(args[3]);
			var lon = parseFloat(args[4]);
		}

		if (!isNaN(lat) && !isNaN(lon)) {
			parsed.center = new L.LatLng(lat, lon);
		} else {
			var config = this.rk.configurations[parsed.region];
			parsed.center = config.centerLatLng;
		}

		return parsed;
	};

	L.Hash.formatHash = function(map) {
		var center = map.getCenter(),
		    zoom = map.getZoom(),
		    precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));

		return "#" + [this.region,
			this.getSelectedPoiLayerKey(),
			//(L.version >= '1.0.0') ? zoom.toFixed(precision) : zoom,
			zoom,
			center.lat.toFixed(precision),
			center.lng.toFixed(precision)
		].join("/");
	};

	L.Hash.prototype = {
		map: null,
		lastHash: null,
		region: undefined,

		parseHash: L.Hash.parseHash,
		formatHash: L.Hash.formatHash,

		init: function(map) {
			this.map = map;

			// reset the hash
			this.lastHash = null;
			this.onHashChange();

			if (!this.isListening) {
				this.startListening();
			}
		},

		removeFrom: function(map) {
			if (this.changeTimeout) {
				clearTimeout(this.changeTimeout);
			}

			if (this.isListening) {
				this.stopListening();
			}

			this.map = null;
		},

		onMapMove: function() {
			// bail if we're moving the map (updating from a hash),
			// or if the map is not yet loaded

			if (this.movingMap || !this.map._loaded) {
				return false;
			}

			this.autoSwitchRegionIfCloseEnough();

			var hash = this.formatHash(this.map);
			if (this.lastHash != hash) {
				location.replace(hash);
				this.lastHash = hash;
			}
		},

		autoSwitchRegionIfCloseEnough: function() {
			var minDistanceM = Number.MAX_VALUE;
			var minRegion = undefined;
			for(const key of Object.keys(this.rk.configurations)) {
				var distanceM = this.map.getCenter().distanceTo(this.rk.configurations[key].centerLatLng);
				if(distanceM < minDistanceM) {
					minDistanceM = distanceM;
					minRegion = key;
				}
			}
			if(this.region != minRegion && minDistanceM < this.rk.autoSwitchDistanceMeters) {
				this.updateRadlkarteRegion(minRegion);
				this.region = minRegion;
				console.log("auto-switching region to " + minRegion + ", map center is only " + Math.round(minDistanceM) + "m away");
				return;
			}
		},

		movingMap: false,
		update: function() {
			var hash = location.hash;
			if (hash === this.lastHash) {
				return;
			}
			var parsed = this.parseHash(hash);
			this.movingMap = true;
			if(this.region !== parsed.region) {
				// console.log('hash update got a new region, change from ' + this.region + ' to ' + parsed.region);
				this.updateRadlkarteRegion(parsed.region);
				this.region = parsed.region;
			}
			this.selectPoiLayersForKey(parsed.poiLayers);
			this.map.setView(parsed.center, parsed.zoom);
			this.movingMap = false;
		},

		// defer hash change updates every 100ms
		changeDefer: 100,
		changeTimeout: null,
		onHashChange: function() {
			// throttle calls to update() so that they only happen every
			// `changeDefer` ms
			if (!this.changeTimeout) {
				var that = this;
				this.changeTimeout = setTimeout(function() {
					that.update();
					that.changeTimeout = null;
				}, this.changeDefer);
			}
		},

		isListening: false,
		hashChangeInterval: null,
		startListening: function() {
			this.map.on("moveend", this.onMapMove, this);
			this.rk.leafletMap.on("overlayadd", this.onMapMove, this);
			this.rk.leafletMap.on("overlayremove", this.onMapMove, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.addListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
				this.hashChangeInterval = setInterval(this.onHashChange, 50);
			}
			this.isListening = true;
		},

		stopListening: function() {
			this.map.off("moveend", this.onMapMove, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.removeListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
			}
			this.isListening = false;
		}
	};

	L.hash = function(map) {
		return new L.Hash(map);
	};

	L.Map.prototype.addHash = function() {
		this._hash = L.hash(this);
	};

	L.Map.prototype.removeHash = function() {
		this._hash.removeFrom();
	};
})(window);
