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

    // common
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

    // useCache()
    it('should replace cache API', () => {
        couch.useCache(null);
        assert.isNull(couch._cache);

        couch.useCache(cache);
        assert.strictEqual(couch._cache, cache);
    });

    // createDatabase() operations
    it('should return promise for createDatabase operation', () => {
        const promise = couch.createDatabase(dbName);
        assert.instanceOf(promise, Promise, 'createDatabase() result is not a promise');
    });

    it('should create new database', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.listDatabases())
            .then(dbs => {
                assert.include(dbs, dbName, 'database was not created');
            });
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

    // dropDatabase() operations
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

    // listDatabase() operations
    it('should return promise for listDatabases operation', () => {
        const promise = couch.listDatabases();
        assert.instanceOf(promise, Promise, 'listDatabases() result is not a promise');
    });

    it('should list all databases', () => {
        return couch.listDatabases()
            .then(dbs => {
                assert.instanceOf(dbs, Array, 'listDatabases() resolved data is not an array');
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

    // insert() operations
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

    // update() operations
    it('should return promise for update operation', () => {
        const promise = couch.update(dbName, {});
        assert.instanceOf(promise, Promise, 'update() result is not a promise');
    });

    it('should return rejected promise if either _id or _rev field is missing', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.update(dbName, {_id: 123}))
            .then(() => {
                throw new Error('_rev was missing but update() op promise has been resolved');
            }, err => {
                assert.instanceOf(err, Error, 'err is not an instance of Error');
                assert.strictEqual(err.code, 'EFIELDMISSING', 'err code is not EFIELDMISSING');

                return couch.update(dbName, {_rev: 1}).then(() => {
                    throw new Error('_id was missing but update() op promise has been resolved');
                }, err => {
                    assert.instanceOf(err, Error, 'err is not an instance of Error');
                    assert.strictEqual(err.code, 'EFIELDMISSING', 'err code is not EFIELDMISSING');
                });
            });
    });

    it('should update documents', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.insert(dbName, {}))
            .then(({data}) => couch.update(dbName, {_id: data.id, _rev: data.rev, new_field: 'some_string'}))
            .then(({data, headers, status}) => {
                assert.isObject(headers, 'result headers is not an object');
                assert.isObject(data, 'result data is not an object');

                assert.strictEqual(status, 201);
                assert.isString(data.id, 'ID is not a string');
                assert.match(data.id, /^[a-z0-9]+$/, 'ID is not valid');
                assert.isTrue(data.ok);
                assert.isTrue(data.rev.startsWith('2-'));
            });
    });

    // del() operations
    it('should return promise for del operation', () => {
        const promise = couch.del(dbName, 'docId', 1);
        assert.instanceOf(promise, Promise, 'del() result is not a promise');
    });

    it('should delete documents', () => {
        let docId;
        let docRevision;

        return couch.createDatabase(dbName)
            .then(() => couch.insert(dbName, {}))
            .then(({data}) => {
                docId = data.id;
                docRevision = data.rev;
            })
            .then(() => couch.get(dbName, docId))
            .then(() => couch.del(dbName, docId, docRevision))
            .then(() => {
                return couch.get(dbName, docId).then(res => {
                    throw new Error('Fetching deleted document ended with resolved promise, but rejected one was expected');
                }, err => {
                    assert.instanceOf(err, Error, 'err is not an Error instance');
                    assert.instanceOf(err.code, 'EDOCMISSING');
                });
            });
    });

    // uniqid() operations
    it('should return promise for uniqid operation', () => {
        const promise1 = couch.uniqid();
        assert.instanceOf(promise1, Promise, 'uniqid() result is not a promise');

        const promise2 = couch.uniqid(10);
        assert.instanceOf(promise2, Promise, 'uniqid(N) result is not a promise');
    });

    it('should return new unique id for uniqid()', () => {
        return couch.uniqid().then(ids => {
            assert.instanceOf(ids, Array);
            assert.lengthOf(ids, 1);
            assert.match(ids[0], /^[a-z0-9]+$/, 'ID is not valid');
        });
    });

    it('should return N unique ids for uniqid(N)', () => {
        return couch.uniqid(10).then(ids => {
            assert.lengthOf(ids, 10);
            ids.forEach(id => assert.match(id, /^[a-z0-9]+$/, 'ID is not valid'));
        });
    });

    // get() operations
    it('should return promise for get operation', () => {
        const promise = couch.get(dbName, 'smth');
        assert.instanceOf(promise, Promise, 'get() result is not a promise');
    });

    it('should return inserted document', () => {
        const doc = {
            _id: 'some_id',
            node: 'root',
            children: ['node1', 'node2', 'node3']
        };

        return couch.createDatabase(dbName)
            .then(() => couch.insert(dbName, doc))
            .then(({data, headers, status}) => {
                assert.isObject(data);
                assert.isObject(headers);
                assert.strictEqual(status, 201);
            })
            .then(() => couch.get(dbName, doc._id))
            .then(({data, headers, status}) => {
                assert.strictEqual(status, 200);
                assert.isObject(headers);
                assert.isObject(data);
                assert.strictEqual(data._id, doc._id, 'fetched document id differs from original');
            });
    });

    it('should return inserted document from cache', () => {
        const doc = {
            _id: 'some_id',
            node: 'root',
            children: ['node1', 'node2', 'node3']
        };

        const delay = timeout => {
            return new Promise(resolve => {
                setTimeout(resolve, timeout);
            })
        }

        return couch.createDatabase(dbName)
            .then(() => couch.useCache(cache))
            .then(() => couch.insert(dbName, doc))
            .then(() => couch.get(dbName, doc._id))
            .then(() => delay(1000)) // cache.set doesn't block get operation
            .then(() => couch.get(dbName, doc._id))
            .then(({data, headers, status}) => {
                assert.strictEqual(status, 304);
                assert.isObject(headers, 'headers data is not an object');
                assert.isObject(data, 'data is empty');
                assert.strictEqual(data._id, doc._id, 'fetched document id differs from original');
            });
    });

    it('should reject get promise with EDOCMISSING code if document is missing', () => {
        return couch.createDatabase(dbName)
            .then(() => couch.get(dbName, 'some_missing_id'))
            .then(() => {
                throw new Error('Get operation was resolved but reject was expected');
            }, err => {
                assert.instanceOf(err, Error, 'err is not an Error instance');
                assert.strictEqual(err.code, 'EDOCMISSING');
            });
    });

    it('should not encode startkey_docid as JSON', () => {
        throw new Error('NOT_IMPLEMENTED');
    });
});
