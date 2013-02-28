var nodeCouchDB = require("../");

var commonTest = function (test, cacheAPI) {
	test.expect(12);

	var couch = new nodeCouchDB("localhost", 5984, cacheAPI);
	var dbName = "sample_" + Date.now();

	couch.createDatabase(dbName, function (err) {
		if (err)
			throw new Error(err);

		couch.insert(dbName, {}, function (err, resData) {
			if (err)
				throw new Error(err);

			var docId = resData.data.id;

			couch.get(dbName, docId, function (err, resData) {
				if (err)
					throw new Error(err);

				test.strictEqual(resData.status, 200, "Result status code is not 200");
				test.equal(typeof resData, "object", "Result is not an object");
				test.ok(!!resData.data, "Result data is missing");
				test.ok(!!resData.status, "Result status is missing");
				test.ok(!!resData.headers, "Result headers missing");
				test.equal(Object.keys(resData).length, 3, "Wrong number of resData fields");

				// timeout is used because we do not wait for cache.set() callback
				setTimeout(function () {
					couch.get(dbName, docId, function (err, resData) {
						if (err)
							throw new Error(err);

						test.strictEqual(resData.status, 304, "Result status code is not 304");
						test.equal(typeof resData, "object", "Result is not an object");
						test.ok(!!resData.data, "Result data is missing");
						test.ok(!!resData.status, "Result status is missing");
						test.ok(!!resData.headers, "Result headers missing");
						test.equal(Object.keys(resData).length, 3, "Wrong number of resData fields");

						couch.dropDatabase("sample");
						test.done();
					});
				}, 1000);
			});
		});
	});
};

exports.cache = {
	setUp: function (callback) {
		callback();
	},
	tearDown: function (callback) {
		if (this.memcachedClient)
			this.memcachedClient.end();

		if (this.memcacheClient)
			this.memcacheClient.close();

		callback();
	},

	fs: function (test) {
		var fs = require("fs");
		var path = require("path");
		var tmpDir = process.env.TMPDIR || require("os").tmpDir();

		var fsCache = {
			get: function (key, callback) {
				var filePath = path.resolve(tmpDir + "/" + key);

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

				fs.writeFile(filePath, value, "utf-8", function () {
					callback && callback();
				});
			},

			invalidate: function () {}
		};

		commonTest.call(this, test, fsCache);
	},
	memory: function (test) {
		commonTest.call(this, test);
	},
	memcached: function (test) {
		var memcached = require("memcached");
		var memcachedClient = new memcached("localhost:11211", {keyCompression: false, timeout: 0, retries: 0, reconnect: 3000, poolSize: 1});

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

		this.memcachedClient = memcachedClient;
		commonTest.call(this, test, cacheAPI);
	},
	memcache: function (test) {
		var memcache = require("memcache");
		var memcacheClient = new memcache.Client(11211, "localhost");
		var self = this;

		memcacheClient.on("connect", function () {
			commonTest.call(self, test, memcacheClient);
		});

		this.memcacheClient = memcacheClient;
		memcacheClient.connect();
	}
};
