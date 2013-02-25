/**
 * Copyright (c) 2013 Dmitry Sorin
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

var url = require("url");
var crypto = require("crypto");
var request = require("request");
var util = require("util");


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
 *      Also cacheObj can have {Boolean} "_serialize" property to mark if cacheObj can accept JSON-objects without serializing them into string
 */
var nodeCouchDB = module.exports = function (host, port, cacheObj) {
    if (host)
        this._host = host;

    if (port)
        this._port = port;

    if (cacheObj) {
        if (cacheObj._serialize === undefined)
            cacheObj._serialize = true;

        this._cache = cacheObj;
    }
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
            if (cacheObj._serialize === undefined)
                cacheObj._serialize = true;

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
        request({
            url: "http://" + this._host + ":" + this._port + "/_all_dbs",
            json: true,
            encoding: "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP GET request: " + err);
                return;
            }

            callback && callback(null, body);
        });
    },

    /**
     * Create a database
     * @param {String} dbName database name
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     */
    createDatabase: function (dbName, callback) {
        request({
            url: "http://" + this._host + ":" + this._port + "/" + dbName,
            method: "PUT",
            json: true,
            encoding: "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with CREATE DATABASE operation: " + err);
                return;
            }

            switch (res.statusCode) {
                case 412 : // database already exists
                case 201 : // created
                    callback && callback(null);
                    break;

                default :
                    callback && callback("Problem with CREATE DATABASE operation: " + body);
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
        request({
            url: "http://" + this._host + ":" + this._port + "/" + dbName + "/",
            method: "DELETE",
            json: true,
            encoding: "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with DELETE DATABASE operation: " + err);
                return;
            }

            switch (res.statusCode) {
                case 404 : // database doesn't exist
                case 200 : // okay
                    callback && callback(null);
                    break;

                default :
                    callback && callback("Problem with DELETE DATABASE operation: " + body);
            }
        });
    },

    /**
     * Fetch data from CouchDB and cache it
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
    get: function (dbName, uri, query, callback) {
        if (typeof query === "function") {
            callback = query;
            query = {};
        }

        for (var prop in query)
            query[prop] = JSON.stringify(query[prop]);

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

            request({
                url: "http://" + self._host + ":" + self._port + "/" + dbName + "/" + uri,
                qs: query,
                headers: headers,
                json: true,
                encoding: "utf8"
            }, function (err, res, body) {
                if (err) {
                    callback && callback("Problem with HTTP GET request: " + err);
                    return;
                }

                body = body || data[1];
                var outputData = {
                    data: body,
                    headers: res.headers,
                    status: res.statusCode
                };

                var cacheData = [res.headers.etag, body];
                if (self._cache._serialize)
                    cacheData = JSON.stringify(cacheData);

                self._cache.set(key, cacheData);
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

        request({
            url: "http://" + this._host + ":" + this._port + "/" + dbName + "/" + uri,
            qs: query,
            json: true,
            encoding: "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP GET request: " + err);
                return;
            }

            var outputData = {
                data: body,
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
        request({
            url: "http://" + this._host + ":" + this._port + "/" + dbName,
            method: "POST",
            body: data,
            json: true,
            encoding: "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP POST request: " + err);
                return;
            }

            var outputData = {
                data: body,
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

        request({
            url: "http://" + this._host + ":" + this._port + "/" + dbName + "/" + data._id,
            method: "PUT",
            body: data,
            json: true,
            encoding: "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP PUT request: " + err);
                return;
            }

            var outputData = {
                data: body,
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
        request({
            url: "http://" + this._host + ":" + this._port + "/" + dbName + "/" + docId,
            method: "DELETE",
            qs: {
                rev: docRevision
            },
            json: true,
            encoding: "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP DELETE request: " + err);
                return;
            }

            var outputData = {
                data: body,
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

        request({
            url: "http://" + this._host + ":" + this._port + "/_uuids",
            qs: {
                count: limit
            },
            json: true,
            encoding: "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP GET /_uuids request: " + err);
                return;
            }

            callback(null, body.uuids);
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

        _cacheData: {},
        _serialize: false
    }
};

// a hack to use package like this: require("node-couchdb").get(dbName, docId, cb)
nodeCouchDB.__proto__ = nodeCouchDB.prototype;
