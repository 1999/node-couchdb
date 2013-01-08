"use strict";

var util = require("util");
var async = require("async");
var MemCouchDB = require("../");

var CacheAPI = function () {
	this._cache = {};
};

CacheAPI.prototype = {
	get: function (key, callback) {
		var self = this;
		process.nextTick(function () {
			callback(null, self._cache[key] || null);
		});
	},

	set: function (key, data, callback) {
		var self = this;
		process.nextTick(function () {
			self._cache[key] = data;
			callback && callback(null);
		});
	}
};

var cacheClient = new CacheAPI;
var db = new MemCouchDB("localhost", 5984, cacheClient);

// your code...
