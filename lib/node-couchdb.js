/**
 * Copyright (c) 2013-2014 Dmitry Sorin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @author Dmitry Sorin <info@staypositive.ru>
 * @license http://www.opensource.org/licenses/mit-license.html MIT License
 */

"use strict";

var crypto = require("crypto");
var ask = require("asker");

var DEFAULT_TIMEOUT = 5000;


/**
 * Creates unique string cache key
 * @return {String}
 */
var cacheKey = function () {
    var parts = Array.prototype.slice.call(arguments, 0);
    return crypto.createHash("md5").update(parts.join(":")).digest("hex");
};


/**
 * Both parameters are optional
 * @constructor
 * @param {String} host
 * @param {Number} port
 * @param {Object} cacheObj
 *      Should support 3 methods: get(key, callback), set(key, value, callback), invalidate()
 * @param {Number} [defaultTimeout=5000]
 */
var nodeCouchDB = module.exports = function (host, port, cacheObj, defaultTimeout) {
    if (host) {
        this._host = host;
    }

    if (port) {
        this._port = port;
    }

    if (cacheObj) {
        this._cache = cacheObj;
    }

    this._defaultTimeout = defaultTimeout || DEFAULT_TIMEOUT;
};

nodeCouchDB.prototype = {
    /**
     * Use new cache mechanism (an "invalidate" method of the old cache machanism will be invoked)
     * Don't pass any arguments to use the default caching mechanism ("memory")
     * This method is useful if you want to call GC manually
     * @param {Object} cacheObj (optional) should support 3 methods: get(key, callback), set(key, value, callback), invalidate()
     */
    useCache: function (cacheObj) {
        try {
            this._cache.invalidate();
        } catch (e) {}

        if (arguments.length) {
            this._cache = cacheObj;
        } else {
            this._cache = this.__proto__._cache;
        }
    },

    /**
     * Get the list of all datbases
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Array} list of databases
     */
    listDatabases: function (callback) {
        ask({
            url: "http://" + this._host + ":" + this._port + "/_all_dbs",
            timeout: this._defaultTimeout
        }, function (err, res) {
            if (err) {
                callback && callback("Problem with HTTP GET request: " + err.message);
                return;
            }

            callback && callback(null, JSON.parse(res.data));
        });
    },

    /**
     * Create a database
     * @param {String} dbName database name
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     */
    createDatabase: function (dbName, callback) {
        ask({
            url: "http://" + this._host + ":" + this._port + "/" + dbName,
            method: "PUT",
            timeout: this._defaultTimeout
        }, function (err, res) {
            if (err) {
                callback && callback("Problem with CREATE DATABASE operation: " + err.message);
                return;
            }

            switch (res.statusCode) {
                case 412 : // database already exists
                case 201 : // created
                    callback && callback(null);
                    break;

                default :
                    callback && callback("Problem with CREATE DATABASE operation: " + res);
            }
        });
    },

    /**
     * Drop database
     * @param {String} dbName database name
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     */
    dropDatabase: function (dbName, callback) {
        ask({
            url: "http://" + this._host + ":" + this._port + "/" + dbName + "/",
            method: "DELETE",
            timeout: this._defaultTimeout
        }, function (err, res) {
            if (err) {
                callback && callback("Problem with DELETE DATABASE operation: " + err.message);
                return;
            }

            switch (res.statusCode) {
                case 404 : // database doesn't exist
                case 200 : // okay
                    callback && callback(null);
                    break;

                default :
                    callback && callback("Problem with DELETE DATABASE operation: " + res);
            }
        });
    },

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
    get: function (dbName, uri, query, callback) {
        if (typeof query === "function") {
            callback = query;
            query = {};
        }

        for (var prop in query) {
            query[prop] = JSON.stringify(query[prop]);
        }

        var self = this;
        var key = cacheKey("couchdata", dbName, uri, JSON.stringify(query));

        this._cache.get(key, function (err, data) {
            if (err) {
                callback && callback("Error while fetching data from cache: " + err);
                return;
            }

            var headers = {};
            if (data) {
                if (typeof data === "string") {
                    try {
                        data = JSON.parse(data);
                        headers["if-none-match"] = data[0];
                    } catch (e) {
                        callback && callback("Data from cache is not a JSON string: " + data);
                        return;
                    }
                }

                headers["if-none-match"] = data[0];
            }

            ask({
                url: "http://" + self._host + ":" + self._port + "/" + dbName + "/" + uri,
                query: query,
                headers: headers,
                statusFilter: filter,
                timeout: self._defaultTimeout
            }, function (err, res) {
                if (err) {
                    callback && callback("Problem with HTTP GET request: " + err.message);
                    return;
                }

                var responseBody = res.data ? JSON.parse(res.data) : data[1];
                var outputData = {
                    data: responseBody,
                    headers: res.headers,
                    status: res.statusCode
                };

                if (res.statusCode === 200) {
                    var cacheData = JSON.stringify([res.headers.etag, responseBody]);
                    self._cache.set(key, cacheData);
                }

                callback && callback(null, outputData);
            });
        });
    },

    /**
     * Fetch data from CouchDB without caching
     * @param {String} dbName database name
     * @param {String} uri document ID or design view
     * @param {Object} query query options as key : value (optional)
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Object} with fields:
     *          data    {Object} JSON response
     *          status  {Number} CouchDB response statusCode
     *          headers {Object} response headers
     */
    rawGet: function (dbName, uri, query, callback) {
        if (typeof query === "function") {
            callback = query;
            query = {};
        }

        for (var prop in query) {
            query[prop] = JSON.stringify(query[prop]);
        }

        ask({
            url: "http://" + this._host + ":" + this._port + "/" + dbName + "/" + uri,
            query: query,
            statusFilter: filter,
            timeout: this._defaultTimeout
        }, function (err, res) {
            if (err) {
                callback && callback("Problem with HTTP GET request: " + err.message);
                return;
            }

            var outputData = {
                data: JSON.parse(res.data),
                headers: res.headers,
                status: res.statusCode
            };

            callback && callback(null, outputData);
        });
    },

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
    insert: function (dbName, data, callback) {
        ask({
            url: "http://" + this._host + ":" + this._port + "/" + dbName,
            method: "POST",
            body: data,
            bodyEncoding: "json",
            timeout: this._defaultTimeout
        }, function (err, res) {
            if (err) {
                callback && callback("Problem with HTTP POST request: " + err.message);
                return;
            }

            var outputData = {
                data: JSON.parse(res.data),
                headers: res.headers,
                status: res.statusCode
            };

            callback && callback(null, outputData);
        });
    },

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
    update: function (dbName, data, callback) {
        if (data._id === undefined || data._rev === undefined)
            return callback("Both _id and _rev fields should exist when updating the document");

        ask({
            url: "http://" + this._host + ":" + this._port + "/" + dbName + "/" + encodeURIComponent(data._id),
            method: "PUT",
            body: data,
            bodyEncoding: "json",
            timeout: this._defaultTimeout
        }, function (err, res) {
            if (err) {
                callback && callback("Problem with HTTP PUT request: " + err.message);
                return;
            }

            var outputData = {
                data: JSON.parse(res.data),
                headers: res.headers,
                status: res.statusCode
            };

            callback && callback(null, outputData);
        });
    },

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
    del: function (dbName, docId, docRevision, callback) {
        ask({
            url: "http://" + this._host + ":" + this._port + "/" + dbName + "/" + encodeURIComponent(docId),
            method: "DELETE",
            query: {
                rev: docRevision
            },
            timeout: this._defaultTimeout
        }, function (err, res) {
            if (err) {
                callback && callback("Problem with HTTP DELETE request: " + err.message);
                return;
            }

            var outputData = {
                data: JSON.parse(res.data),
                headers: res.headers,
                status: res.statusCode
            };

            callback && callback(null, outputData);
        });
    },

    /**
     * Get UUIDs for new documents
     * @param {Number} limit number of IDs you want to get (optional)
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     *      @param {Array} IDs list
     */
    uniqid: function (limit, callback) {
        if (typeof limit === "function") {
            callback = limit;
            limit = 1;
        }

        ask({
            url: "http://" + this._host + ":" + this._port + "/_uuids",
            query: {
                count: limit
            },
            timeout: this._defaultTimeout
        }, function (err, res) {
            if (err) {
                callback && callback("Problem with HTTP GET /_uuids request: " + err.message);
                return;
            }

            callback(null, JSON.parse(res.data).uuids);
        });
    },


    _host: "localhost",
    _port: 5984,

    _cache: {
        get: function (key, callback) {
            var self = this;
            process.nextTick(function () {
                callback(null, self._cacheData[key] || null);
            });
        },

        set: function (key, value, callback) {
            var self = this;
            process.nextTick(function () {
                self._cacheData[key] = value;
                callback && callback();
            });
        },

        invalidate: function () {
            this._cacheData = {};
        },

        _cacheData: {}
    }
};

// a hack to use package like this: require("node-couchdb").get(dbName, docId, cb)
nodeCouchDB.__proto__ = nodeCouchDB.prototype;

/**
 * Asker status filter
 *
 * @param {Number} statusCode
 * @return {Object}
 */
function filter(statusCode) {
    return {
        accept: ([200, 201, 304, 404].indexOf(statusCode) !== -1),
        isRetryAllowed: false
    }
}
