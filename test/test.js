'use strict';

import {assert} from 'chai';
import memoryCache from 'node-couchdb-plugin-memory';
import nodeCouchDb from '../lib/node-couchdb';

const noop = function () {}
const cache = new memoryCache;

describe('node-couchdb tests', () => {
    let dbName;
    let couch;

    beforeEach(() => {
        dbName = `sample${Date.now()}`;
        couch = new nodeCouchDb;
    });

    afterEach(() => couch.dropDatabase(dbName).catch(noop));

    it('should expose expected API', () => {
        assert.typeOf(nodeCouchDb, 'function', 'exported object is not a function');

        for (let method of [
            'useCache',
            'listDatabases', 'createDatabase', 'dropDatabase',
            'insert', 'update', 'del', 'get',
            'uniqid'
        ]) {
            assert.typeOf(couch[method], 'function', `instance[${method}] is not a function`);
        }
    });

    it('should construct NodeCouchDb instance with different arguments', () => {
        const couch1 = new nodeCouchDb;
        assert.strictEqual(couch1._baseUrl, 'http://127.0.0.1:5984');
        assert.isNull(couch1._cache);

        const couch2 = new nodeCouchDb({});
        assert.strictEqual(couch2._baseUrl, 'http://127.0.0.1:5984');
        assert.isNull(couch2._cache);

        const couch3 = new nodeCouchDb({port: 82});
        assert.strictEqual(couch3._baseUrl, 'http://127.0.0.1:82');
        assert.isNull(couch3._cache);

        const couch4 = new nodeCouchDb({cache, host: 'example.com'});
        assert.strictEqual(couch4._baseUrl, 'http://example.com:5984');
        assert.strictEqual(couch4._cache, cache);
    });

    it('should replace cache object', () => {
        couch.useCache(null);
        assert.isNull(couch._cache);

        couch.useCache(cache);
        assert.strictEqual(couch._cache, cache);
    });

    it('should create database', () => {
        const promise = couch.createDatabase(dbName);
        assert.instanceOf(promise, Promise, 'createDatabase() result is not a promise');

        return promise;
    });

    it('should reject with EDBEXISTS is database already exists', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.createDatabase(dbName))
            .then(() => {
                throw new Error('Second createDatabase() call didn\'t fail')
            }, err => {
                assert.instanceOf(err, Error, 'rejected error is not an instance of Error');
                assert.strictEqual(err.code, 'EDBEXISTS');
            });
    });

    it('should list all databases', () => {
        const promise = couch.listDatabases();
        assert.instanceOf(promise, Promise, 'listDatabases() result is not a promise');

        return promise.then(dbs => {
            assert.instanceOf(dbs, Array, 'listDatabases() resolved data is not an array');
        });
    });

    it('should list all databases and the new one', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.listDatabases())
            .then(dbs => {
                assert.include(dbs, dbName, 'databases list doesn\'t contain created database');
            });
    });



    // it('should create database', done => {
    //     couch.createDatabase(dbName, err => {
    //         assert.isNull(err, 'Unexpected error occured');
    //         done();
    //     });
    // });

    // it('should fail with EDBEXISTS if database exists', done => {
    //     couch.createDatabase(dbName, err => {
    //         assert.isNull(err, 'Unexpected error occured');

    //         couch.createDatabase(dbName, err => {
    //             assert.isNotNull(err, 'Error was expected but nothing happened');
    //             assert.instanceOf(err, Error, 'err is not an instance of Error');
    //             assert.strictEqual(err.code, 'EDBEXISTS', 'err code is not EDBEXISTS');

    //             done();
    //         });
    //     });
    // });

    // it('should drop database', done => {
    //     couch.createDatabase(dbName, err => {
    //         assert.isNull(err, 'Unexpected error occured');

    //         couch.dropDatabase(dbName, err => {
    //             assert.isNull(err, 'Unexpected error occured');
    //             done();
    //         });
    //     });
    // });

    // it('should fail with EDBMISSING if database with this name doesn\'t exist', done => {
    //     couch.dropDatabase(dbName, err => {
    //         assert.isNotNull(err, 'Error was expected but nothing happened');
    //         assert.instanceOf(err, Error, 'err is not an instance of Error');
    //         assert.strictEqual(err.code, 'EDBMISSING', 'err code is not EDBMISSING');

    //         done();
    //     });
    // });

    // it('should fail if CouchDB server is unavailable', done => {
    //     let couch = new nodeCouchDb('127.0.0.2', 80);

    //     couch.createDatabase(dbName, err => {
    //         assert.isNotNull(err, 'Error was expected but nothing happened');
    //         done();
    //     });
    // });

    // it('should insert documents', done => {
    //     couch.createDatabase(dbName, err => {
    //         assert.isNull(err, 'Unexpected error occured');

    //         couch.insert(dbName, {}, (err, resData) => {
    //             assert.isNull(err, 'Unexpected error occured');
    //             assert.isObject(resData, 'Result is not an object');
    //             assert.isObject(resData.data, 'Result data is not an object');
    //             assert.isString(resData.data.id, 'ID is not a string');
    //             assert.match(resData.data.id, /^[a-z0-9]+$/, 'ID is not valid');

    //             done();
    //         });
    //     });
    // });

    // it('should get expected document', done => {
    //     couch.createDatabase(dbName, err => {
    //         assert.isNull(err, 'Unexpected error occured');

    //         couch.insert(dbName, {}, (err, resData) => {
    //             assert.isNull(err, 'Unexpected error occured');
    //             const docId = resData.data.id;

    //             couch.get(dbName, docId, (err, resData) => {
    //                 assert.isNull(err, 'Unexpected error occured');
    //                 assert.isObject(resData, 'Result is not an object');
    //                 assert.strictEqual(resData.status, 200, 'Result status code is not 200');
    //                 assert.isObject(resData.data, 'Document is missing');
    //                 assert.isObject(resData.headers, 'Headers are missing');
    //                 assert.strictEqual(Object.keys(resData).length, 3, 'Wrong number of result fields');

    //                 done();
    //             });
    //         });
    //     });
    // });

    // it('listDatabase should not crash when parsing result', done => {
    //     couch.listDatabases((err, dbs) => {
    //         assert.isNull(err, 'Unexpected error occured');
    //         assert.instanceOf(dbs, Array, 'dbs variable is not an Array instance');

    //         const types = dbs.reduce((memo, db) => {
    //             const type = typeof db;

    //             if (!memo.includes(type)) {
    //                 memo.push(type);
    //             }

    //             return memo;
    //         }, []);

    //         assert.strictEqual(types.length, 1, 'More than one type is listed among dbs');
    //         assert.strictEqual(types[0], 'string', 'Type is not a string');

    //         done();
    //     });
    // });

    // it('should not encode startkey_docid as JSON', done => {
    //     couch.createDatabase(dbName, err => {
    //         assert.isNull(err, 'Unexpected error occured');

    //         const doc = {};
    //         const id = 'http://example.org/';
    //         doc._id = id;

    //         couch.insert(dbName, doc, (err, resData) => {
    //             assert.isNull(err, 'Unexpected error occured');

    //             couch.update(dbName, {
    //                 _id: id,
    //                 _rev: resData.data.rev,
    //                 field: 'new sample data'
    //             }, (err, resData) => {
    //                 assert.isNull(err, 'Unexpected error occured');
    //                 assert.strictEqual(resData.data.id, id, 'ID must be the same document');
    //                 assert.strictEqual(resData.status, 201, 'Status is not equal 201');

    //                 done();
    //             });
    //         });
    //     });
    // });
});


// 

// var commonTest = function (test, cacheAPI) {

// 					// timeout is used because we do not wait for cache.set() callback
// 					setTimeout(function () {
// 						couch.get(dbName, docId, function (err, resData) {
// 							test.strictEqual(err, null, err);

// 							test.strictEqual(resData.status, 304, "Result status code is not 304");
// 							test.equal(typeof resData, "object", "Result is not an object");
// 							test.ok(!!resData.data, "Result data is missing");
// 							test.ok(!!resData.status, "Result status is missing");
// 							test.ok(!!resData.headers, "Result headers missing");
// 							test.equal(Object.keys(resData).length, 3, "Wrong number of resData fields");

// 						});
// 					}, 1000);
// 				});
// 			});
// 		});
// 	});
// };

// exports.cache = {
// 	tearDown: function (callback) {
// 		if (this.memcachedClient)
// 			this.memcachedClient.end();

// 		if (this.memcacheClient)
// 			this.memcacheClient.close();

// 		callback();
// 	},

// 	fs: function (test) {
// 		var fs = require("fs");
// 		var path = require("path");
// 		var tmpDir = process.env.TMPDIR || require("os").tmpDir();

// 		var fsCache = {
// 			get: function (key, callback) {
// 				var filePath = path.resolve(tmpDir + "/" + key);

// 				fs.exists(filePath, function (exists) {
// 					if (exists) {
// 						fs.readFile(filePath, "utf-8", callback);
// 					} else {
// 						callback();
// 					}
// 				});
// 			},

// 			set: function (key, value, callback) {
// 				var filePath = path.resolve(tmpDir + "/" + key);

// 				fs.writeFile(filePath, value, "utf-8", function () {
// 					callback && callback();
// 				});
// 			},

// 			invalidate: function () {}
// 		};

// 		commonTest.call(this, test, fsCache);
// 	},
// 	memory: function (test) {
// 		commonTest.call(this, test);
// 	},
// 	memcached: function (test) {
// 		var memcached = require("memcached");
// 		var memcachedClient = new memcached("localhost:11211", {keyCompression: false, timeout: 0, retries: 0, reconnect: 3000, poolSize: 1});

// 		var cacheAPI = {
// 			get: function (key, callback) {
// 				memcachedClient.get(key, function (err, data) {
// 					if (err || data === false || data === undefined)
// 						return callback(err);

// 					callback(null, data);
// 				});
// 			},

// 			set: function (key, value, callback) {
// 				memcachedClient.set(key, value, 0, function () {
// 					callback && callback.apply(null, arguments);
// 				});
// 			},

// 			_serialize: false
// 		};

// 		this.memcachedClient = memcachedClient;
// 		commonTest.call(this, test, cacheAPI);
// 	},
// 	memcache: function (test) {
// 		var memcache = require("memcache");
// 		var memcacheClient = new memcache.Client(11211, "localhost");
// 		var self = this;

// 		memcacheClient.on("connect", function () {
// 			commonTest.call(self, test, memcacheClient);
// 		});

// 		this.memcacheClient = memcacheClient;
// 		memcacheClient.connect();
// 	},


// };
