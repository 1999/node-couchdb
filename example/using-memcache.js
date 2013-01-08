"use strict";

var util = require("util");
var memcache = require("memcache");
var MemCouchDB = require("../");

var memcacheClient = new memcache.Client(11211, "localhost");
memcacheClient.on("connect", function () {
	var db = new MemCouchDB("localhost", 5984, memcacheClient);
	var dbName = "testing_" + Date.now();

	// create some database
	db.createDatabase(dbName, function (err) {
		if (err)
			throw new Error(err);

		util.puts("Sample database created: " + dbName);

		var doc = {
			"_id" : "_design/list",
			"language" : "javascript",
			"views" : {
				"by_name" : {
					"map" : "function(doc) { emit(doc.name, doc); }"
				}
			}
		};

		// create design document
		db.insert(dbName, doc, function (err, resData) {
			if (err)
				throw new Error(err);

			util.puts("Design document inserted!");

			// fill database with some data
			var sampleData = [
				["Fred Durst", "Limp Bizkit"],
				["Oli Sykes", "Bring Me The Horizon"],
				["Rou Reynolds", "Enter Shikari"],
				["Mike Skinner", "The Streets"],
				["Dmitry Porubov", "Psychea"],
				["Sam Carter", "The Architects"]
			];

			var insertedDocuments = 0;
			var onDocInserted = function () {
				insertedDocuments += 1;
				if (insertedDocuments === sampleData.length) {
					// fetch rockstars starting from "A" to "G" (including "G")
					util.puts("Fetch rockstars from \"A\" to \"O\"...");

					db.get(dbName, "_design/list/_view/by_name", {
						"startkey" : "A",
						"endkey" : "O\ufff0"
					}, function (err, resData) {
						if (err)
							throw new Error(err);

						util.puts(util.inspect(resData, false, null, true));
					});
				}
			};

			sampleData.forEach(function (dataChunk) {
				var doc = {
					"name": dataChunk[0],
					"bands": [dataChunk[1]]
				};

				db.uniqid(function (err, ids) { // this can be done faster by generating all the needed IDs at one request
					if (err)
						throw new Error(err);

					doc._id = ids[0];

					db.insert(dbName, doc, function (err, resData) {
						if (err)
							throw new Error(err);

						util.puts("The data was written into the database!");
						onDocInserted();
					});
				});
			});
		});
	});
});

memcacheClient.connect();
