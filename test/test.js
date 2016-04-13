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

    it('should fail if CouchDB server is unavailable', () => {
        const couch = new nodeCouchDb({port: 80});

        return couch.createDatabase(dbName).then(() => {
            throw new Error('Error was expected but nothing happened');
        }, err => ({}));
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

    it('should return promise for dropDatabase operation', () => {
        const promise = couch.dropDatabase(dbName);
        assert.instanceOf(promise, Promise, 'dropDatabase() result is not a promise');
    });

    it('should fail with EDBMISSING if database with this name doesn\'t exist', () => {
        return couch.dropDatabase(dbName).then(() => {
            throw new Error('dropDatabase() op promise resolved for missing database');
        }, err => {
            assert.instanceOf(err, Error, 'err is not an instance of Error');
            assert.strictEqual(err.code, 'EDBMISSING', 'err code is not EDBMISSING');
        });
    });

    it('should create and drop database', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.listDatabases())
            .then(dbs => {
                assert.include(dbs, dbName, 'databases list doesn\'t contain created database');
            })
            .then(() => couch.dropDatabase(dbName))
            .then(() => couch.listDatabases())
            .then(dbs => {
                assert.notInclude(dbs, dbName, 'databases list still contains created database');
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

    it('listDatabase should not crash when parsing result', () => {
        return couch.listDatabases(dbs => {
            const types = dbs.reduce((memo, db) => {
                const type = typeof db;

                if (!memo.includes(type)) {
                    memo.push(type);
                }

                return memo;
            }, []);

            assert.strictEqual(types.length, 1, 'More than one type is listed among dbs');
            assert.strictEqual(types[0], 'string', 'Type is not a string');
        });
    });

    it('should return promise for insert operation', () => {
        const promise = couch.insert(dbName, {});
        assert.instanceOf(promise, Promise, 'insert() result is not a promise');
    });

    it('should insert documents', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.insert(dbName, {}))
            .then(resData => {
                assert.isObject(resData, 'result is not an object');
                assert.isObject(resData.headers, 'result headers is not an object');
                assert.isObject(resData.data, 'result data is not an object');
                assert.isString(resData.data.id, 'ID is not a string');
                assert.match(resData.data.id, /^[a-z0-9]+$/, 'ID is not valid');
                assert.isNumber(resData.status, 'status is not a number')
            });
    });

    it('should return promise for update operation', () => {
        const promise = couch.update(dbName, {});
        assert.instanceOf(promise, Promise, 'update() result is not a promise');
    });

    it('should return rejected promise if either _id or _rev field is missing', () => {
        return couch.update(dbName, {_id: 123})
            .then(() => {
                throw new Error('_rev was missing but update() op promise has been resolved');
            }, err => {
                assert.instanceOf(err, Error, 'err is not an instance of Error');
                assert.strictEqual(err.code, 'EFIELDMISSING', 'err code is not EFIELDMISSING');
            })
            .then(() => couch.update(dbName, {_rev: 1}))
            .then(() => {
                throw new Error('_id was missing but update() op promise has been resolved');
            }, err => {
                assert.instanceOf(err, Error, 'err is not an instance of Error');
                assert.strictEqual(err.code, 'EFIELDMISSING', 'err code is not EFIELDMISSING');
            });
    });

    it('should update documents', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.insert(dbName, {}))
            .then(resData => {
                assert.isObject(resData, 'result is not an object');
                assert.isObject(resData.headers, 'result headers is not an object');
                assert.isObject(resData.data, 'result data is not an object');
                assert.isString(resData.data.id, 'ID is not a string');
                assert.match(resData.data.id, /^[a-z0-9]+$/, 'ID is not valid');
                assert.isNumber(resData.status, 'status is not a number')
            });
    });

    it('should return promise for del operation', () => {
        const promise = couch.del(dbName, 'docId', 1);
        assert.instanceOf(promise, Promise, 'del() result is not a promise');
    });

    // EDOCMISSING - get
    // EUNKNOWN - get

    it('should delete documents', () => {
        let docId;
        let docRevision;

        return couch.createDatabase(dbName)
            .then(() => couch.insert(dbName, {}))
            .then(({data}) => {
                docId = data._id;
            })
            .then(() => couch.get(dbName, docId))
            .then(({data, headers, status}) => {
                console.log(data)
                console.log(headers)
                console.log(status)
            })
            .then(() => couch.del(dbName, docId, docRevision))
            .then(() => couch.get(dbName, docId))
            .then(({doc}) => {
                assert(doc).not_exists;
            });
    });

    it('should return promise for uniqid operation', () => {
        const promise1 = couch.uniqid();
        assert.instanceOf(promise1, Promise, 'uniqid() result is not a promise');

        const promise2 = couch.uniqid(10);
        assert.instanceOf(promise2, Promise, 'uniqid(N) result is not a promise');
    });

    it('should return new unique id for uniqid()', () => {
        return couch.uniqid().then(ids => {
            assert.instanceOf(ids, Array, 'ids is not an array');
            assert.lengthOf(ids, 1, 'ids length is not 1');
            assert.match(ids[0], /^[a-z0-9]+$/, 'ID is not valid');
        });
    });

    it('should return N unique ids for uniqid(N)', () => {
        return couch.uniqid(10).then(ids => {
            assert.lengthOf(ids, 10, 'ids length is not 1');
            ids.forEach(id => assert.match(id, /^[a-z0-9]+$/, 'ID is not valid'));
        });
    });



    

    

    

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
