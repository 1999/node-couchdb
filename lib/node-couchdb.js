/**
 * Copyright (c) 2012 Dmitry Sorin
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
 * @constructor
 * @param {String} CouchDBHost
 * @param {Number} CouchDBPort
 * @param {Object} memcacheClient todo
 */
var MemCouchDB = function (CouchDBHost, CouchDBPort, memcacheClient) {
    this._couchdbHost = CouchDBHost;
    this._couchdbPort = CouchDBPort;
    this._cacheAPI = memcacheClient;
};

MemCouchDB.prototype = {
    /**
     * Fetch data from CouchDB using Memcached as a cache layer
     *
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

        for (var prop in query) {
            query[prop] = JSON.stringify(query[prop]);
        }

        var self = this;
        var cacheKey = crypto.createHash("md5").update(["couchdata", dbName, uri, JSON.stringify(query)].join(":")).digest("hex");

        this._cacheAPI.get(cacheKey, function (err, cacheData) {
            if (err) {
                callback && callback("Error while fetching data from Memcached: " + err);
                return;
            }

            var headers = {};
            if (cacheData) {
                try {
                    cacheData = JSON.parse(cacheData);
                    headers["if-none-match"] = cacheData[0];
                } catch (e) {
                    // Memcached limit is 1M per document
                    // set() can cut the string length
                }
            }

            var docUrl = "http://" + self._couchdbHost + ":" + self._couchdbPort + "/" + dbName + "/" + uri;
            request({
                "url" : docUrl,
                "qs" : query,
                "headers" : headers,
                "json" : true,
                "encoding" : "utf8"
            }, function (err, res, body) {
                if (err) {
                    callback && callback("Problem with HTTP GET request: " + err);
                    return;
                }

                body = body || cacheData[1];
                var outputData = {
                    "data" : body,
                    "headers" : res.headers,
                    "status" : res.statusCode
                };

                self._cacheAPI.set(cacheKey, JSON.stringify([res.headers.etag, body]));
                callback && callback(null, outputData);
            });
        });
    },

    /**
     * Raw (without ETags) fetch data from CouchDB without using Memcached
     *
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

        var docUrl = "http://" + this._couchdbHost + ":" + this._couchdbPort + "/" + dbName + "/" + uri;
        request({
            "url" : docUrl,
            "qs" : query,
            "json" : true,
            "encoding" : "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP GET request: " + err);
                return;
            }

            var outputData = {
                "data" : body,
                "headers" : res.headers,
                "status" : res.statusCode
            };

            callback && callback(null, outputData);
        });
    },

    /**
     * Insert document to CouchDB
     *
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
            "url" : "http://" + this._couchdbHost + ":" + this._couchdbPort + "/" + dbName,
            "method" : "POST",
            "body" : data,
            "json" : true,
            "encoding" : "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP POST request: " + err);
                return;
            }

            var outputData = {
                "data" : body,
                "headers" : res.headers,
                "status" : res.statusCode
            };

            callback && callback(null, outputData);
        });
    },

    /**
     * Update a document in CouchDB
     *
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
            "url" : "http://" + this._couchdbHost + ":" + this._couchdbPort + "/" + dbName + "/" + data._id,
            "method" : "PUT",
            "body" : data,
            "json" : true,
            "encoding" : "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP PUT request: " + err);
                return;
            }

            var outputData = {
                "data" : body,
                "headers" : res.headers,
                "status" : res.statusCode
            };

            callback && callback(null, outputData);
        });
    },

    /**
     * Delete document in the database
     *
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
            "url" : "http://" + this._couchdbHost + ":" + this._couchdbPort + "/" + dbName + "/" + docId,
            "method" : "DELETE",
            "qs" : {"rev" : docRevision},
            "json" : true,
            "encoding" : "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP DELETE request: " + err);
                return;
            }

            var outputData = {
                "data" : body,
                "headers" : res.headers,
                "status" : res.statusCode
            };

            callback && callback(null, outputData);
        });
    },

    /**
     * Getting a UUIDs for new documents
     *
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
            "url" : "http://" + this._couchdbHost + ":" + this._couchdbPort + "/_uuids",
            "qs" : {"count" : limit},
            "json" : true,
            "encoding" : "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with HTTP GET /_uuids request: " + err);
                return;
            }

            callback(null, body.uuids);
        });
    },

    /**
     * Creating a database
     *
     * @param {String} dbName database name
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     */
    createDatabase: function (dbName, callback) {
        request({
            "url" : "http://" + this._couchdbHost + ":" + this._couchdbPort + "/" + dbName,
            "method" : "PUT",
            "json" : true,
            "encoding" : "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with CREATE DATABASE operation: " + err);
                return;
            }

            switch (res.statusCode) {
                case 412 : // database alrady exists
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
     *
     * @param {String} dbName database name
     * @param {Function} callback invokes:
     *      @param {String} error string or NULL
     */
    dropDatabase: function (dbName, callback) {
        request({
            "url" : "http://" + this._couchdbHost + ":" + this._couchdbPort + "/" + dbName + "/",
            "method" : "DELETE",
            "json" : true,
            "encoding" : "utf8"
        }, function (err, res, body) {
            if (err) {
                callback && callback("Problem with DELETE DATABASE operation: " + err);
                return;
            }

            switch (res.statusCode) {
                case 404 : // database diesn't exist
                case 200 : // okay
                    callback && callback(null);
                    break;

                default :
                    callback && callback("Problem with DELETE DATABASE operation: " + body);
            }
        });
    }
};

module.exports = MemCouchDB;
