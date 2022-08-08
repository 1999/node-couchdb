'use strict';
import crypto from 'crypto';
import fetch, { AbortError } from 'node-fetch';
import AbortController from 'abort-controller';

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

        this._controller = new AbortController();
        this._timeout = setTimeout(() => this._controller.abort(), instanceOpts.timeout);
        this._controller.signal.addEventListener("abort", () => {});

        this._baseUrl = `${instanceOpts.protocol}://`;
        this._baseUrl += `${instanceOpts.host}:${instanceOpts.port}`;

        this._cache = instanceOpts.cache;

        const defaultHeaders = {
            'user-agent': 'node-couchdb/1',
            'content-type': 'application/json'
        };

        if (instanceOpts.auth) {
            const str = `${instanceOpts.auth.user}:${instanceOpts.auth.pass}`;
            const b64 = Buffer.from(str, 'utf8').toString('base64');
            defaultHeaders['authorization'] = 'Basic ' + b64;
        }


        this._fetchDefaultOpts = {
            headers: defaultHeaders,
            signal: this._controller.signal
        };
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
        return this._fetchWrapped(`${this._baseUrl}/_all_dbs`).then(({body}) => body);
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
        return this._fetchWrapped(`${this._baseUrl}/${dbName}`, {
            method: 'PUT',
        }).then(({res, body}) => {
            // database already exists
            if (res.status === 412) {
                throw new RequestError('EDBEXISTS', `Database already exists: ${dbName}`, body);
            }

            if (res.status === 401) {
                throw new RequestError('ENOTADMIN', `Should be authorized as admin to create database: ${res.status}`, body);
            }

            if (res.status === 400) {
                throw new RequestError('EBADREQUEST', res.body.reason, body);
            }

            if (res.status !== 201 && res.status !== 202) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while creating database ${dbName}: ${res.status}`, body);
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
        const url = `${this._baseUrl}/${dbName}/`;
        return this._fetchWrapped(url, {
            method: 'DELETE',
        }).then(({res, body}) => {
            // database not found
            if (res.status === 404) {
                throw new RequestError('EDBMISSING', `Database not found: ${dbName}`, body);
            }

            if (res.status === 401) {
                throw new RequestError('ENOTADMIN', `Should be authorized as admin to delete database: ${res.status}`, body);
            }

            if (res.status !== 200 && res.status !== 202) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while deleting database ${dbName}: ${res.status}`, body);
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
        const url = new URL(`${this._baseUrl}/${dbName}/${uri}`); 

        for (let prop in query) {
            if (KEYS_TO_ENCODE.includes(prop)) {
                url.searchParams.set(prop, JSON.stringify(query[prop]));
            } else {
                url.searchParams.set(prop, query[prop]);
            }
        }

        return this._fetchWrapped(url).then(({res, body}) => {
            if (res.status === 404) {
                throw new RequestError('EDOCMISSING', 'Document is not found', body);
            }

            if (res.status !== 200 && res.status !== 304) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while fetching documents from the database: ${res.status}`, body);
            }

            if (res.status === 200 && this._cache) {
                const cacheKey = this._getCacheKey(url);

                this._cache.set(cacheKey, {
                    body,
                    etag: res.headers.get('ETag')
                });
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
            };
        });
    }

    /**
     * Fetch attachment from CouchDB. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error
     *
     * @param {String} dbName database name
     * @param {String} docId document id
     * @param {String} attachmentName attachment name
     * @param {String} docRevision document revision
     * @return {Promise}
     */
    getAttachment(dbName, docId, attachmentName, docRevision) {

        const url = new URL(`${this._baseUrl}/${dbName}/${docId}/${attachmentName}`);
        url.searchParams.set('rev', docRevision);

        return this._fetchWrapped(url).then(({res, body}) => {
            if (res.status === 404) {
                throw new RequestError('EDOCMISSING', 'Attachment is not found', body);
            }

            if (res.status !== 200 && res.status !== 304) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while fetching attachment from the database: ${res.status}`, body);
            }

            if (res.status === 200 && this._cache) {
                const cacheKey = this._getCacheKey(url);

                this._cache.set(cacheKey, {
                    body,
                    etag: res.headers.get('ETag')
                });
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
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
        const url = `${this._baseUrl}/${dbName}`;
        return this._fetchWrapped(url, {
            method: 'POST',
            body: JSON.stringify(data)
        }).then(({res, body}) => {
            this._checkDocumentManipulationStatus(res.status, body)

            if (res.status !== 201 && res.status !== 202) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while inserting document into the database: ${res.status}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
            };
        });
    }

    /**
     * Insert document into CouchDB. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error
     *
     * @param {String} dbName database name
     * @param {String} docId document id
     * @param {String} attachmentName attachment name
     * @param {String} body attachment body
     * @param {String} docRevision document revision
     * @return {Promise}
     */
    insertAttachment(dbName, docId, attachmentName, body, docRevision) {
        const url = new URL(`${this._baseUrl}/${dbName}/${encodeURIComponent(docId)}/attachment`);
        url.searchParams.set('rev', docRevision);
        return this._fetchWrapped(url, {
            method: 'PUT',
            body: JSON.stringify(body)
        }).then(({res, body}) => {
            if (res.status === 409) {
                throw new RequestError('EDOCCONFLICT', 'Document insert conflict - Document’s revision wasn’t specified or it’s not the latest', body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
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

        const url = `${this._baseUrl}/${dbName}/${encodeURIComponent(data._id)}`;

        return this._fetchWrapped(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        }).then(({res, body}) => {
            this._checkDocumentManipulationStatus(res.status, body)


            if (!(res.status >= 200 && res.status <= 202)) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while inserting document into the database: ${res.status}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
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
        const url = new URL(`${this._baseUrl}/${dbName}/${encodeURIComponent(docId)}`);
        url.searchParams.set('rev', docRevision);
        return this._fetchWrapped(url, {
            method: 'DELETE',
        }).then(({res, body}) => {
            this._checkDocumentManipulationStatus(res.status, body)

            if (res.status !== 200) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while deleting document: ${res.status}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
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
    mango(dbName, mangoQuery) {
        const url = new URL(`${this._baseUrl}/${dbName}/_find`);

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
            body: JSON.stringify(mangoQuery),
        };

        return this._fetchWrapped(url, requestOpts).then(({res, body}) => {
            this._checkServerVersion(res.headers.get('Server'), 2);

            if (res.status === 404) {
                throw new RequestError('EDOCMISSING', 'Document is not found', body);
            }

            if (res.status !== 200 && res.status !== 304) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while fetching documents from the database: ${res.status}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
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
     * @param {String} attachmentName attachment name
     * @param {String} docRevision document revision
     * @return {Promise}
     */
    delAttachment(dbName, docId, attachmentName, docRevision) {
        const url = new URL(`${this._baseUrl}/${dbName}/${encodeURIComponent(docId)}/${encodeURIComponent(attachmentName)}`);
        url.searchParams.set('rev', docRevision);

        return this._fetchWrapped(url, {
            method: 'DELETE',
        }).then(({res, body}) => {
            if (res.status === 404) {
                throw new RequestError('EDOCMISSING', 'Attachment is not found', body);
            }

            if (res.status !== 200) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while deleting attachment: ${res.status}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
            };
        });
    }

    /**
     * Calls an update function in the database. Returns a promise which is
     * - resolved with {data, headers, status} object
     * - rejected with `request` original error
     *
     * @param  {String} dbName             database name
     * @param  {String} designDocument     design document name
     * @param  {String} updateFunctionName update function name
     * @param  {Object} queryString        query string parameters
     * @param  {String} docId              document id

     * @return {Promise}
     */
    updateFunction(dbName, designDocument, updateFunctionName, queryString, docId ) {
        const method = docId ? 'PUT' : 'POST';
        queryString = queryString || {};

        let url;

        if (method === 'PUT') {
            url = new URL(`${this._baseUrl}/${dbName}/_design/${designDocument}/_update/${updateFunctionName}/${docId}`);
        } else {
            url = new URL(`${this._baseUrl}/${dbName}/_design/${designDocument}/_update/${updateFunctionName}`);
        }
        
        for (let prop in queryString) {
            url.searchParams.set(prop, queryString[prop]);
        }

        return this._fetchWrapped(url, {
            method: method,
        }).then(({res, body}) => {
            if (res.status === 404) {
                throw new RequestError('EDOCMISSING', 'Design document is not found', body);
            }

            if (res.status !== 200 && res.status !== 201 && res.status !== 202) {
                throw new RequestError('EUNKNOWN', `Unexpected status code while calling update function: ${res.status}`, body);
            }

            return {
                data: body,
                headers: res.headers,
                status: res.status
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
        const url = new URL(`${this._baseUrl}/_uuids`); 
        url.searchParams.set('count', count);

        return this._fetchWrapped(url).then(({body}) => {
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
    async _fetchWrapped(url, opts) {

        opts = opts || {};

        const cacheKey = this._getCacheKey(url);
        const whenCacheChecked = (!this._cache || (opts.method && opts.method !== 'GET'))
            ? Promise.resolve({})
            : this._cache.get(cacheKey);

        return whenCacheChecked.then(cache => {

            // cache plugin returns null if record doesn't exist
            const {
                etag,
                body: cacheBody
            } = cache || {};

            return new Promise(async (resolve, reject) => {
                opts = Object.assign({ ... this._fetchDefaultOpts }, opts);

                if (etag) {
                    opts.headers = opts.headers || {};
                    opts.headers['if-none-match'] = etag;
                }

                try {
                    const res = await fetch(url, opts);

                    let data = null;
                    if (res.ok) {
                        const contentType = res.headers.get('content-type');

                        if (contentType.includes('application/json')) {
                            data = await res.json();
                        } else if (contentType.includes('text/html')){
                            data = await res.text();
                        }
                    }

                    resolve({
                        res,
                        body: data || cacheBody
                    });
                } catch (err) {
                    if (error instanceof AbortError) {
                        console.log('request was aborted');
                    }
                    reject(err);
                } finally {
                    clearTimeout(this._timeout);
                }
            });
        });
    }


    /**
     * Gets cache key built from request options
     *
     * @param {Object} requestOpts
     * @return {String}
     */
    _getCacheKey(url) {
        const cacheKeyFull = url.toString();
        return crypto.createHash('md5').update(cacheKeyFull).digest('hex');
    }

    /**
     * @param {String} serverHeader
     * @param {Number} minServerVersion
     */
    _checkServerVersion(serverHeader, minServerVersion = 1) {
        const serverVersion = serverHeader.match(/^CouchDB\/([\d]+)/);

        if (!serverVersion || !serverVersion[1]) {
            throw new RequestError('ESERVERNOTSUPPORTED', `Server is not supported: ${serverHeader}`);
        }

        if (serverVersion[1] < minServerVersion) {
            throw new RequestError('ESERVEROLD', `Server version is too old for using this API: ${minServerVersion} (expected), ${serverHeader} (actual)`);
        }
    }
};
