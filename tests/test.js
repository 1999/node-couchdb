var nodeCouchDB = require("../");

var commonTest = function (test, cacheAPI) {
	test.expect(20);

	var couch = new nodeCouchDB("localhost", 5984, cacheAPI);
	var dbName = "sample_" + Date.now();

	couch.createDatabase(dbName, function (err) {
		test.strictEqual(err, null, err);

		// Creating the same database second time should cause EDBEXISTS error
		couch.createDatabase(dbName, function (err) {
            test.ok(!!err, true, 'Expected error is not met');
            test.strictEqual(err.code, 'EDBEXISTS', 'Expected EDBEXISTS error is not met');

			couch.insert(dbName, {}, function (err, resData) {
				test.strictEqual(err, null, err);

				var docId = resData.data.id;

				couch.get(dbName, docId, function (err, resData) {
					test.strictEqual(err, null, err);

					test.strictEqual(resData.status, 200, "Result status code is not 200");
					test.equal(typeof resData, "object", "Result is not an object");
					test.ok(!!resData.data, "Result data is missing");
					test.ok(!!resData.status, "Result status is missing");
					test.ok(!!resData.headers, "Result headers missing");
					test.equal(Object.keys(resData).length, 3, "Wrong number of resData fields");

					// timeout is used because we do not wait for cache.set() callback
					setTimeout(function () {
						couch.get(dbName, docId, function (err, resData) {
							test.strictEqual(err, null, err);

							test.strictEqual(resData.status, 304, "Result status code is not 304");
							test.equal(typeof resData, "object", "Result is not an object");
							test.ok(!!resData.data, "Result data is missing");
							test.ok(!!resData.status, "Result status is missing");
							test.ok(!!resData.headers, "Result headers missing");
							test.equal(Object.keys(resData).length, 3, "Wrong number of resData fields");

							couch.dropDatabase("sample", function (err) {
                                test.ok(!!err, true, 'Expected error is not met');
                                test.strictEqual(err.code, 'EDBMISSING', 'Expected EDBMISSING error is not met');

                                test.done();
                            });
						});
					}, 1000);
				});
			});
		});
	});
};

exports.cache = {
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
	},

    issue_5: function (test) {
        test.expect(4);

        var couch = new nodeCouchDB("localhost", 5984);
        couch.listDatabases(function (err, dbs) {
            test.strictEqual(err, null, err);
            test.strictEqual(Array.isArray(dbs), true, 'dbs must be an array');

            var types = dbs.reduce(function (types, db) {
                var type = typeof db;

                if (types.indexOf(type) === -1) {
                    types.push(type);
                }

                return types;
            }, []);

            test.strictEqual(types.length, 1, 'must contain only one type');
            test.strictEqual(types[0], 'string', 'it must be a string');

            test.done();
        });
    },

    issue_9: function (test) {
        test.expect(5);

        var couch = new nodeCouchDB("localhost", 5984);
        var dbName = "sample_" + Date.now();

        couch.createDatabase(dbName, function (err) {
            test.strictEqual(err, null, err);

            var doc = {};
            var id = 'http://example.org/';
            doc._id = id;

            couch.insert(dbName, doc, function (err, resData) {
                test.strictEqual(err, null, err);

                couch.update(dbName, {
                    _id: id,
                    _rev: resData.data.rev,
                    field: "new sample data"
                }, function (err, resData) {
                    test.strictEqual(err, null, err);
                    test.strictEqual(resData.data.id, id, 'must be the same document');
                    test.strictEqual(resData.status, 201, 'status must be equal 201');

                    test.done();
                });
            });
        });
    }
};
