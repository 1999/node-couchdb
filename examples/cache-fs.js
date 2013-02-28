"use strict";

var fs = require("fs");
var path = require("path");
var nodeCouchDB = require("../");
var tmpDir = process.env.TMPDIR || require("os").tmpDir();

var fsCache = {
	get: function (key, callback) {
		var filePath = path.resolve(tmpDir + "/" + key);
		console.log("Get data from path: " + filePath);

		fs.exists(filePath, function (exists) {
			if (exists) {
				fs.readFile(filePath, "utf-8", callback);
			} else {
				callback();
			}
		});
	},

	set: function (key, value, callback) {
		var filePath = path.resolve(tmpDir + "/" + key);
		console.log("Write data to path: " + filePath);

		fs.writeFile(filePath, value, "utf-8", function () {
			callback && callback();
		});
	},

	invalidate: function () {}
};

// run test!
var couch = new nodeCouchDB("localhost", 5984, fsCache);
require("./sample.js").runTest(couch);
