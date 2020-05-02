(function(window) {
	var HAS_HASHCHANGE = (function() {
		var doc_mode = window.documentMode;
		return ('onhashchange' in window) &&
			(doc_mode === undefined || doc_mode > 7);
	})();

	L.Hash = function(map) {
		this.onHashChange = L.Util.bind(this.onHashChange, this);

		if (map) {
			this.init(map);
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
			region: rkGlobal.defaultRegion,
			zoom: rkGlobal.defaultZoom,
			center: undefined
		}

		var args = hash.split("/");

		if(args.length >= 1) {
			var region = args[0];
			if(region in rkGlobal.configurations) {
				parsed.region = region;
			}
		}

		if(args.length >= 2) {
			var zoom = (L.version >= '1.0.0') ? parseFloat(args[1]) : parseInt(args[1], 10);
			if(!isNaN(zoom)) {
				parsed.zoom = zoom
			}
		}

		var lat = undefined;
		var lon = undefined;
		if (args.length >= 4) {
			var lat = parseFloat(args[2]);
			var lon = parseFloat(args[3]);
		}

		if (!isNaN(lat) && !isNaN(lon)) {
			parsed.center = new L.LatLng(lat, lon);
		} else {
			var config = rkGlobal.configurations[parsed.region];
			parsed.center = config.centerLatLng;
		}

		return parsed;
	};

	L.Hash.formatHash = function(map) {
		var center = map.getCenter(),
		    zoom = map.getZoom(),
		    precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));

		return "#" + [this.region,
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
			for(const key of Object.keys(rkGlobal.configurations)) {
				var distanceM = this.map.getCenter().distanceTo(rkGlobal.configurations[key].centerLatLng);
				if(distanceM < minDistanceM) {
					minDistanceM = distanceM;
					minRegion = key;
				}
			}
			if(this.region != minRegion && minDistanceM < rkGlobal.autoSwitchDistanceMeters) {
				updateRadlkarteRegion(minRegion);
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
				updateRadlkarteRegion(parsed.region);
				this.region = parsed.region;
			}
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
