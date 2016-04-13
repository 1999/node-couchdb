'use strict';

import crypto from 'crypto';
import request from 'request';

export default class NodeCouchDB {
    constructor(opts = {}) {
        const instanceOpts = Object.assign({
            host: '127.0.0.1',
            port: 5984,
            cache: null,
            timeout: 5000
        }, opts);

        this._baseUrl = `http://${instanceOpts.host}:${instanceOpts.port}`;
        this._cache = instanceOpts.cache;
        
        this._requestWrappedDefaults = request.defaults({
            headers: {
                'user-agent': 'node-couchdb/1'
            },
            json: true,
            timeout: instanceOpts.timeout
        });
    }

    /**
     * Use new cache mechanism (an "invalidate" method of the old cache machanism will be invoked)
     * This method is useful if you want to call GC manually
     * 
     * @param {Object} cacheObj
     * @return {Undefined}
     */
    useCache(cache) {
        try {
            this._cache.invalidate();
        } catch (e) {}

        this._cache = cache;
    }

    /**
     * Get the list of all databases. Returns a promise which is
     * - resolved with {Array} list of databases
     * - rejected with `request` original error
     *
     * @return {Promise}
     */
    listDatabases() {
        return this._requestWrapped(`${this._baseUrl}/_all_dbs`).then(({body}) => body);
    }

    /**
     * Creates a database. Returns a promise which is
     * - resolved with no arguments
     * - rejected with `request` original error
     * 
     * @param {String} dbName
     * @return {Promise}
     */
    createDatabase(dbName) {
        return this._requestWrapped({
            method: 'PUT',
            url: `${this._baseUrl}/${dbName}`
        }).then(({res}) => {
            // database already exists
            if (res.statusCode === 412) {
                const err = new Error(`Database already exists: ${dbName}`);
                err.code = 'EDBEXISTS';

                throw err;
            }

            if (res.statusCode !== 201) {
                const err = new Error(`Unexpected status code while creating database ${dbName}: ${res.statusCode}`);
                err.code = 'EUNKNOWN';

                throw err;
            }
        });
    }

    /**
     * Drops database by its name. Returns a promise which is
     * - resolved with no arguments
     * - rejected with `request` original error
     * 
     * @param {String} dbName
     * @return {Promise}
     */
    dropDatabase(dbName, callback) {
        return this._requestWrapped({
            method: 'DELETE',
            url: `${this._baseUrl}/${dbName}/`
        }).then(({res}) => {
            // database not found
            if (res.statusCode === 404) {
                const err = new Error(`Database not found: ${dbName}`);
                err.code = 'EDBMISSING';

                throw err;
            }

            if (res.statusCode !== 200) {
                const err = new Error(`Unexpected status code while deleting database ${dbName}: ${res.statusCode}`);
                err.code = 'EUNKNOWN';

                throw err;
            }
        });
    }

    /**
     * Fetch data from CouchDB. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error
     * 
     * @param {String} dbName database name
     * @param {String} uri document ID or design view
     * @param {Object} [query] query options as key: value
     * @return {Promise}
     */
    get(dbName, uri, query = {}) {
        for (let prop in query) {
            query[prop] = JSON.stringify(query[prop]);
        }

        return this._requestWrapped({
            query,
            url: `${this._baseUrl}/${dbName}/${uri}`
        }).then(({res, body}) => {
            if (res.statusCode === 404) {
                const err = new Error('Document is not found');
                err.code = 'EDOCMISSING';

                throw err;
            }

            if (res.statusCode !== 200 && res.statusCode !== 304) {
                const err = new Error(`Unexpected status code while fetching documents from the database: ${res.statusCode}`);
                err.code = 'EUNKNOWN';

                throw err;
            }

            if (res.statusCode === 200 && this._cache) {
                this._cache.set(KEYTODO, {
                    body,
                    etag: res.headers.etag
                });
            }

            return {
                data: body,
                headers: res.headers,
                status: res.statusCode
            };
        });
    }

    /**
     * Insert document into CouchDB. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error
     * 
     * @param {String} dbName database name
     * @param {Object} data
     * @return {Promise}
     */
    insert(dbName, data) {
        return this._requestWrapped({
            method: 'POST',
            url: `${this._baseUrl}/${dbName}`,
            body: data
        }).then(({res, body}) => {
            return {
                data: body,
                headers: res.headers,
                status: res.statusCode
            };
        });
    }

    /**
     * Update a document in CouchDB. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error
     * 
     * @param {String} dbName database name
     * @param {Object} data should contain both "_id" and "_rev" fields
     * @return {Promise}
     */
    update(dbName, data) {
        if (!data._id || !data._rev) {
            const err = new Error('Both _id and _rev fields should exist when updating the document');
            err.code = 'EFIELDMISSING';

            return Promise.reject(err);
        }

        return this._requestWrapped({
            method: 'PUT',
            url: `${this._baseUrl}/${dbName}/${encodeURIComponent(data._id)}`,
            body: data
        }).then(({res, body}) => {
            return {
                data: body,
                headers: res.headers,
                status: res.statusCode
            };
        });
    }

    /**
     * Delete a document in the database. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error
     * 
     * @param {String} dbName database name
     * @param {String} docId document id
     * @param {String} docRevision document revision
     * @return {Promise}
     */
    del(dbName, docId, docRevision) {
        return this._requestWrapped({
            method: 'DELETE',
            url: `${this._baseUrl}/${dbName}/${encodeURIComponent(docId)}`,
            query: {
                rev: docRevision
            }
        }).then(({res, body}) => {
            return {
                data: body,
                headers: res.headers,
                status: res.statusCode
            };
        });
    }

    /**
     * Get UUIDs for new documents. Returns a promise which is
     * - resolved with array of new unique ids
     * - rejected with `request` original error
     * 
     * @param {Number} [count = 1] number of IDs you want to get
     * @return {Promise}
     */
    uniqid(count = 1) {
        return this._requestWrapped({
            url: `${this._baseUrl}/_uuids`,
            query: {count}
        }).then(({body}) => {
            return body.uuids;
        });
    }

    /**
     * Requests wrapper. Checks for cache first for GET requests.
     * Should be invoked with arguments suitable for `request`
     * 
     * @return {Promise}
     */
    _requestWrapped(opts) {
        if (typeof opts === 'string') {
            opts = {url: opts};
        }

        const cacheKey = this._getCacheKey(opts);
        const whenCacheChecked = (!this._cache || (opts.method && opts.method !== 'GET'))
            ? Promise.resolve({})
            : this._cache.get(cacheKey);

        return whenCacheChecked.then(({etag, cacheBody}) => {
            return new Promise((resolve, reject) => {
                if (etag) {
                    opts.headers = opts.headers || {};
                    opts.headers['if-none-match'] = etag;
                }

                this._requestWrappedDefaults(opts, (err, res, body) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            res,
                            body: body || cacheBody
                        });
                    }
                });
            });
        });
    }

    /**
     * Gets cache key built from request options
     * 
     * @param {Object} requestOpts
     * @return {String}
     */
    _getCacheKey(requestOpts) {
        const stringifiedQuery = JSON.stringify(requestOpts.query || {});
        const cacheKeyFull = `${requestOpts.url}?${stringifiedQuery}`;

        return crypto.createHash('md5').update(cacheKeyFull).digest('hex');
    }
};
