"use strict";

var nodeCouchDB = require("../");
var memcached = require("memcached");

var memcachedClient = new memcached("127.0.0.1:11211");
var cacheAPI = {
	get: function (key, callback) {
		memcachedClient.get(key, function (err, data) {
			if (err || data === false || data === undefined)
				return callback(err);

			callback(null, data);
		});
	},

	set: function (key, value, callback) {
		memcachedClient.set(key, value, 0, function () {
			callback && callback.apply(null, arguments);
		});
	},

	_serialize: false
};

var couch = new nodeCouchDB("localhost", 5984, cacheAPI);
require("./sample.js").runTest(couch);
