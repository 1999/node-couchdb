'use strict';

import crypto from 'crypto';
import request from 'request';

// @see https://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
// @see https://github.com/1999/node-couchdb/issues/9
const KEYS_TO_ENCODE = ['key', 'keys', 'startkey', 'endkey'];

class RequestError extends Error {
    constructor(code, message, body) {
        super(message);

        this.code = code;
        this.body = body;
    }
}

export default class NodeCouchDB {
    constructor(opts = {}) {
        const instanceOpts = Object.assign({
            protocol: 'http',
            host: '127.0.0.1',
            port: 5984,
            cache: null,
            timeout: 5000,
            auth: null
        }, opts);

        this._baseUrl = `${instanceOpts.protocol}://${instanceOpts.host}:${instanceOpts.port}`;
        this._cache = instanceOpts.cache;
        this._auth = instanceOpts.auth;

        this._requestWrappedDefaults = request.defaults({
            auth: instanceOpts.auth,
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
        }).then(({res, body}) => {
            // database already exists
            if (res.statusCode === 412) {
                throw new RequestError('EDBEXISTS', `Database already exists: ${dbName}`, body);
            }

            if (res.statusCode === 401) {
                throw new RequestError('ENOTADMIN', `Should be authorized as admin to create database: ${res.statusCode}`, body);
            }

            if (res.statusCode === 400) {
                throw new RequestError('EBADREQUEST', res.body.reason, body);
            }

            if (res.statusCode !== 201) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while creating database ${dbName}: ${res.statusCode}`, body);
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
    dropDatabase(dbName) {
        return this._requestWrapped({
            method: 'DELETE',
            url: `${this._baseUrl}/${dbName}/`
        }).then(({res, body}) => {
            // database not found
            if (res.statusCode === 404) {
                throw new RequestError('EDBMISSING', `Database not found: ${dbName}`, body);
            }

            if (res.statusCode === 401) {
                throw new RequestError('ENOTADMIN', `Should be authorized as admin to delete database: ${res.statusCode}`, body);
            }

            if (res.statusCode !== 200) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while deleting database ${dbName}: ${res.statusCode}`, body);
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
            if (KEYS_TO_ENCODE.includes(prop)) {
                query[prop] = JSON.stringify(query[prop]);
            }
        }

        const requestOpts = {
            url: `${this._baseUrl}/${dbName}/${uri}`,
            qs: query
        };

        return this._requestWrapped(requestOpts).then(({res, body}) => {
            if (res.statusCode === 404) {
                throw new RequestError('EDOCMISSING', 'Document is not found', body);
            }

            if (res.statusCode !== 200 && res.statusCode !== 304) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while fetching documents from the database: ${res.statusCode}`, body);
            }

            if (res.statusCode === 200 && this._cache) {
                const cacheKey = this._getCacheKey(requestOpts);

                this._cache.set(cacheKey, {
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
            this._checkDocumentManipulationStatus(res.statusCode, body)

            if (res.statusCode !== 201 && res.statusCode !== 202) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while inserting document into the database: ${res.statusCode}`, body);
            }

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
            this._checkDocumentManipulationStatus(res.statusCode, body)


            if (res.statusCode !== 201 && res.statusCode !== 202) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while inserting document into the database: ${res.statusCode}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.statusCode
            };
        });
    }

    /**
     * Trigger a design update script in CouchDB. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error

     * @param dbName database name
     * @param id documentId
     * @param designId design document id
     * @param updateId update script id
     * @param data update payload
     * @returns {*}
     */
    design_update(dbName, docId, designId, updateId, data) {
        if (!docId || !data) {
            const err = new Error('id and data fields should exist when updating the document');
            err.code = 'EFIELDMISSING';

            return Promise.reject(err);
        }

        return this._requestWrapped({
            method: 'PUT',
            url: `${this._baseUrl}/${dbName}/_design/${designId}/_update/${updateId}/${encodeURIComponent(docId)}`,
            body: data
        }).then(({res, body}) => {
            this._checkDocumentManipulationStatus(res.statusCode, body)


            if (res.statusCode !== 201 && res.statusCode !== 202) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while inserting document into the database: ${res.statusCode}`, body);
            }

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
            qs: {
                rev: docRevision
            }
        }).then(({res, body}) => {
            this._checkDocumentManipulationStatus(res.statusCode, body)

            if (res.statusCode !== 200) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while deleting document: ${res.statusCode}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.statusCode
            };
        });
    }

    /**
     * Fetch data from CouchDB using Mango API. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error
     *
     * @param {String} dbName database name
     * @param {String|Object} mangoQuery Mango query as json string or javascript object
     * @param {Object} [query] query options as key: value
     * @return {Promise}
     */
    mango(dbName, mangoQuery, query = {}) {
        for (let prop in query) {
            if (KEYS_TO_ENCODE.includes(prop)) {
                query[prop] = JSON.stringify(query[prop]);
            }
        }
        
        if (typeof mangoQuery === 'string') {
            try {
                mangoQuery = JSON.parse(mangoQuery);
            } catch (e) {
                return Promise.reject(new RequestError('EBADREQUEST', 'The Mango query parameter is not parsable.'));
            }
        }
        
        if (typeof mangoQuery !== 'object') {
            return Promise.reject(new RequestError('EBADREQUEST', 'Invalid Mango query parameter.'));
        }

        const requestOpts = {
            method: 'POST',
            url: `${this._baseUrl}/${dbName}/_find`,
            body: mangoQuery,
            qs: query
        };

        return this._requestWrapped(requestOpts).then(({res, body}) => {
            if (res.statusCode === 404) {
                throw new RequestError('EDOCMISSING', 'Document is not found', body);
            }

            if (res.statusCode !== 200 && res.statusCode !== 304) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while fetching documents from the database: ${res.statusCode}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.statusCode
            };
        });
    }

    /**
    /**
     * Subscribes to the _changes endpoint.  The default query params are to feed=continuous, timeout=Infinite, heartbeat=true, since=now
     * @param dbName
     * @param query
     * @param changesCallback receives changes as JSON objects.
     * This method will initially be called with a null change and a valid context.
     * This initial callback will occur before any received data from CouchDB
     * The context object has an unsubscribe() method needed for closing the connection and releasing resources.
     * @returns {Promise.<TResult>}
     */
    changes(dbName, query, changesCallback, changesFilter, changesFilterData) {
        for (let prop in query) {
            if (KEYS_TO_ENCODE.includes(prop)) {
                query[prop] = JSON.stringify(query[prop]);
            }
        }

        const requestOpts = {
            url: `${this._baseUrl}/${dbName}/_changes`,
            qs: query,
            auth: this._requestWrappedDefaults.auth,
            changesCallback
        };

        if (!changesFilter) {
            requestOpts.method = 'GET';
        } else {
            requestOpts.method = 'POST';
            requestOpts.body = changesFilterData
        }

        return this._requestWrapped(requestOpts)
            .then(({res, body}) => {
                if (res.statusCode === 404) {
                    throw new RequestError('EDOCMISSING', 'Document is not found', body);
                }

                if (res.statusCode !== 200 && res.statusCode !== 304) {
                    throw new RequestError('EUNKNOWN', `Unexpected status code while fetching documents from the database: ${res.statusCode}`, body);
                }

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
            qs: {count}
        }).then(({body}) => {
            return body.uuids;
        });
    }

    /**
     * Check the status code of a documentation manipulation like INSERT, UPDATE, DELETE
     *
     * @param {Number} statusCode
     * @param {Object} body
     * @throws {RequestError}
     */
    _checkDocumentManipulationStatus(statusCode, body) {
      if (statusCode === 400) {
          throw new RequestError('EBADREQUEST', 'Invalid request body or parameters', body);
      }

      if (statusCode === 401) {
          throw new RequestError('EUNAUTHORIZED', 'Write privileges required', body);
      }

      if (statusCode === 404) {
          throw new RequestError('EDOCMISSING', 'Document not found', body);
      }

      if (statusCode === 409) {
          throw new RequestError('EDOCCONFLICT', 'Document insert conflict', body);
      }
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

        if (opts.changesCallback) {
            return this._handleChangesRequest(opts);
        }

        const cacheKey = this._getCacheKey(opts);
        const whenCacheChecked = (!this._cache || (opts.method && opts.method !== 'GET'))
            ? Promise.resolve({})
            : this._cache.get(cacheKey);

        return whenCacheChecked.then(cache => {
            // cache plugin returns null if record doesn't exist
            const {
                etag,
                body: cacheBody
            } = cache || {};

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

    _handleChangesRequest(opts) {
        return new Promise((resolve, reject) => {
            const feed = opts.qs.feed || 'continuous';
            const heartbeat = opts.qs.heartbeat || 'true';
            const since = opts.qs.since || 'now';
            const url = `${opts.url}/_changes?feed=${feed}&heartbeat=${heartbeat}&since=${since}`;
            // request.js was not working in browser, so we use native 
            var httpRequest = new XMLHttpRequest();
            httpRequest.open("GET", url, true);    // async
            if (this._auth.user !== undefined){
                var authorizationBasic = btoa(this._auth.user + ':' + this._auth.pass);
                httpRequest.setRequestHeader('Authorization', 'Basic ' + authorizationBasic);
            }
            httpRequest.setRequestHeader('Accept', 'application/json');
            httpRequest.onreadystatechange = OnStateChange;

            function OnStateChange() {
                switch (httpRequest.readyState) {
                    case 1:
                        break;
                    case 2:
                        break;
                    case 3:
                        const json = httpRequest.responseText;
                        json.split('\n')
                            .filter(line => line.length > 0)
                            .forEach(line => {
                                let parsed;
                                try {
                                    parsed = JSON.parse(line);
                                } catch (e) {
                                    //console.warn(e);
                                    return;
                                }
                                try {
                                    opts.changesCallback(parsed, context);
                                } catch (e) {
                                    console.warn(e);
                                }
                            });
                        break;
                    case 4:
                        break;
                    default:
                        break;
                };
            }
            httpRequest.send(null);

            const context = {
                unsubscribe: function () {
                    httpRequest.abort();
                    //BUG request.js not working in browser
                    //req.abort();
                }
            };
            opts.changesCallback(null, context);
            resolve({
                res: {
                    statusCode: 200,
                    headers: []
                },
                body: '',
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
