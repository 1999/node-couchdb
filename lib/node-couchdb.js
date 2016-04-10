'use strict';

/**
 * Creates unique string cache key
 * @return {String}
 */
const cacheKey = (...parts) => {
    return crypto.createHash('md5').update(parts.join(':')).digest('hex');
}

export default class NodeCouchDB {
    constructor(host = '127.0.0.1', port = 5984, cache = null) {
        this._host = host;
        this._port = port;
        this._cache = cache;
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
     * Get the list of all datbases
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Array} list of databases
     */
    listDatabases(callback) {
        // ask({
        //     url: "http://" + this._host + ":" + this._port + "/_all_dbs",
        //     timeout: this._defaultTimeout
        // }, function (err, res) {
        //     if (err) {
        //         callback && callback("Problem with HTTP GET request: " + err.message);
        //         return;
        //     }

        //     callback && callback(null, JSON.parse(res.data));
        // });
    }

    /**
     * Create a database
     * @param {String} dbName database name
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     */
    createDatabase(dbName, callback) {
        // ask({
        //     url: "http://" + this._host + ":" + this._port + "/" + dbName,
        //     method: "PUT",
        //     timeout: this._defaultTimeout
        // }, function (err, res) {
        //     var statusCode = err && err.data && err.data.statusCode;

        //     if (statusCode === 412) { // database already exists
        //         var err = new Error('Database already exists: ' + dbName);
        //         err.code = 'EDBEXISTS';

        //         callback && callback(err);
        //         return;
        //     }

        //     if (err) {
        //         callback && callback("Problem with CREATE DATABASE operation: " + err.message);
        //         return;
        //     }

        //     switch (res.statusCode) {
        //         case 201 : // created
        //             callback && callback(null);
        //             break;

        //         default :
        //             callback && callback("Problem with CREATE DATABASE operation: " + res);
        //     }
        // });
    }

    /**
     * Drop database
     * @param {String} dbName database name
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     */
    dropDatabase(dbName, callback) {
        // ask({
        //     url: "http://" + this._host + ":" + this._port + "/" + dbName + "/",
        //     method: "DELETE",
        //     timeout: this._defaultTimeout
        // }, function (err, res) {
        //     var statusCode = err && err.data && err.data.statusCode;

        //     if (statusCode === 404) { // database not found
        //         var err = new Error('Database not found: ' + dbName);
        //         err.code = 'EDBMISSING';

        //         callback && callback(err);
        //         return;
        //     }

        //     if (err) {
        //         callback && callback("Problem with DELETE DATABASE operation: " + err.message);
        //         return;
        //     }

        //     switch (res.statusCode) {
        //         case 200 : // okay
        //             callback && callback(null);
        //             break;

        //         default :
        //             callback && callback("Problem with DELETE DATABASE operation: " + res);
        //     }
        // });
    }

    /**
     * Fetch data from CouchDB and cache it
     * @param {String} dbName database name
     * @param {String} uri document ID or design view
     * @param {Object} [query] query options as key: value
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Object} with fields:
     *          data    {Object} JSON response
     *          status  {Number} CouchDB response statusCode
     *          headers {Object} response headers
     */
    get(dbName, uri, query, callback) {
        // if (typeof query === "function") {
        //     callback = query;
        //     query = {};
        // }

        // for (var prop in query) {
        //     query[prop] = JSON.stringify(query[prop]);
        // }

        // var self = this;
        // var key = cacheKey("couchdata", dbName, uri, JSON.stringify(query));

        // this._cache.get(key, function (err, data) {
        //     if (err) {
        //         callback && callback("Error while fetching data from cache: " + err);
        //         return;
        //     }

        //     var headers = {};
        //     if (data) {
        //         if (typeof data === "string") {
        //             try {
        //                 data = JSON.parse(data);
        //                 headers["if-none-match"] = data[0];
        //             } catch (e) {
        //                 callback && callback("Data from cache is not a JSON string: " + data);
        //                 return;
        //             }
        //         }

        //         headers["if-none-match"] = data[0];
        //     }

        //     ask({
        //         url: "http://" + self._host + ":" + self._port + "/" + dbName + "/" + uri,
        //         query: query,
        //         headers: headers,
        //         statusFilter: filter,
        //         timeout: self._defaultTimeout
        //     }, function (err, res) {
        //         if (err) {
        //             callback && callback("Problem with HTTP GET request: " + err.message);
        //             return;
        //         }

        //         var responseBody = res.data ? JSON.parse(res.data) : data[1];
        //         var outputData = {
        //             data: responseBody,
        //             headers: res.headers,
        //             status: res.statusCode
        //         };

        //         if (res.statusCode === 200) {
        //             var cacheData = JSON.stringify([res.headers.etag, responseBody]);
        //             self._cache.set(key, cacheData);
        //         }

        //         callback && callback(null, outputData);
        //     });
        // });
    }

    /**
     * Insert document to CouchDB
     * @param {String} dbName database name
     * @param {Object} data
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Object} with fields:
     *          data    {Object} JSON response
     *          status  {Number} CouchDB response statusCode
     *          headers {Object} response headers
     */
    insert(dbName, data, callback) {
        // ask({
        //     url: "http://" + this._host + ":" + this._port + "/" + dbName,
        //     method: "POST",
        //     body: data,
        //     bodyEncoding: "json",
        //     timeout: this._defaultTimeout
        // }, function (err, res) {
        //     if (err) {
        //         callback && callback("Problem with HTTP POST request: " + err.message);
        //         return;
        //     }

        //     var outputData = {
        //         data: JSON.parse(res.data),
        //         headers: res.headers,
        //         status: res.statusCode
        //     };

        //     callback && callback(null, outputData);
        // });
    }

    /**
     * Update a document in CouchDB
     * @param {String} dbName database name
     * @param {Object} data should contain both "_id" and "_rev" fields
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Object} with fields:
     *          data    {Object} JSON response
     *          status  {Number} CouchDB response statusCode
     *          headers {Object} response headers
     */
    update(dbName, data, callback) {
        // if (data._id === undefined || data._rev === undefined)
        //     return callback("Both _id and _rev fields should exist when updating the document");

        // ask({
        //     url: "http://" + this._host + ":" + this._port + "/" + dbName + "/" + encodeURIComponent(data._id),
        //     method: "PUT",
        //     body: data,
        //     bodyEncoding: "json",
        //     timeout: this._defaultTimeout
        // }, function (err, res) {
        //     if (err) {
        //         callback && callback("Problem with HTTP PUT request: " + err.message);
        //         return;
        //     }

        //     var outputData = {
        //         data: JSON.parse(res.data),
        //         headers: res.headers,
        //         status: res.statusCode
        //     };

        //     callback && callback(null, outputData);
        // });
    }

    /**
     * Delete a document in the database
     * @param {String} dbName database name
     * @param {String} docId document id
     * @param {String} docRevision document revision
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Object} with fields:
     *          data    {Object} JSON response
     *          status  {Number} CouchDB response statusCode
     *          headers {Object} response headers
     */
    del(dbName, docId, docRevision, callback) {
        // ask({
        //     url: "http://" + this._host + ":" + this._port + "/" + dbName + "/" + encodeURIComponent(docId),
        //     method: "DELETE",
        //     query: {
        //         rev: docRevision
        //     },
        //     timeout: this._defaultTimeout
        // }, function (err, res) {
        //     if (err) {
        //         callback && callback("Problem with HTTP DELETE request: " + err.message);
        //         return;
        //     }

        //     var outputData = {
        //         data: JSON.parse(res.data),
        //         headers: res.headers,
        //         status: res.statusCode
        //     };

        //     callback && callback(null, outputData);
        // });
    }

    /**
     * Get UUIDs for new documents
     * @param {Number} limit number of IDs you want to get (optional)
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Array} IDs list
     */
    uniqid(limit, callback) {
        // if (typeof limit === "function") {
        //     callback = limit;
        //     limit = 1;
        // }

        // ask({
        //     url: "http://" + this._host + ":" + this._port + "/_uuids",
        //     query: {
        //         count: limit
        //     },
        //     timeout: this._defaultTimeout
        // }, function (err, res) {
        //     if (err) {
        //         callback && callback("Problem with HTTP GET /_uuids request: " + err.message);
        //         return;
        //     }

        //     callback(null, JSON.parse(res.data).uuids);
        // });
    }
};




// const crypto = require("crypto");
// const ask = require("asker");

// const DEFAULT_TIMEOUT = 5000;







// // a hack to use package like this: require("node-couchdb").get(dbName, docId, cb)
// nodeCouchDB.__proto__ = nodeCouchDB.prototype;

// /**
//  * Asker status filter
//  *
//  * @param {Number} statusCode
//  * @return {Object}
//  */
// function filter(statusCode) {
//     return {
//         accept: ([200, 201, 304, 404].indexOf(statusCode) !== -1),
//         isRetryAllowed: false
//     }
// }
