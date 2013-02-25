"use strict";

var nodeCouchDB = require("../");
var memcache = require("memcache");

var memcacheClient = new memcache.Client(11211, "localhost");
memcacheClient.on("connect", function () {
	var couch = new nodeCouchDB("localhost", 5984, memcacheClient);
	require("./sample.js").runTest(couch);
});

memcacheClient.connect();
