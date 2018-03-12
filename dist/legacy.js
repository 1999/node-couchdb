'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// @see https://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
// @see https://github.com/1999/node-couchdb/issues/9
var KEYS_TO_ENCODE = ['key', 'keys', 'startkey', 'endkey'];

var RequestError = function (_Error) {
    _inherits(RequestError, _Error);

    function RequestError(code, message, body) {
        _classCallCheck(this, RequestError);

        var _this = _possibleConstructorReturn(this, (RequestError.__proto__ || Object.getPrototypeOf(RequestError)).call(this, message));

        _this.code = code;
        _this.body = body;
        return _this;
    }

    return RequestError;
}(Error);

var NodeCouchDB = function () {
    function NodeCouchDB() {
        var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, NodeCouchDB);

        var instanceOpts = Object.assign({
            protocol: 'http',
            host: '127.0.0.1',
            port: 5984,
            cache: null,
            timeout: 5000,
            auth: null
        }, opts);

        this._baseUrl = instanceOpts.protocol + '://' + instanceOpts.host + ':' + instanceOpts.port;
        this._cache = instanceOpts.cache;

        this._requestWrappedDefaults = _request2.default.defaults({
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


    _createClass(NodeCouchDB, [{
        key: 'useCache',
        value: function useCache(cache) {
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

    }, {
        key: 'listDatabases',
        value: function listDatabases() {
            return this._requestWrapped(this._baseUrl + '/_all_dbs').then(function (_ref) {
                var body = _ref.body;
                return body;
            });
        }

        /**
         * Creates a database. Returns a promise which is
         * - resolved with no arguments
         * - rejected with `request` original error
         *
         * @param {String} dbName
         * @return {Promise}
         */

    }, {
        key: 'createDatabase',
        value: function createDatabase(dbName) {
            return this._requestWrapped({
                method: 'PUT',
                url: this._baseUrl + '/' + dbName
            }).then(function (_ref2) {
                var res = _ref2.res,
                    body = _ref2.body;

                // database already exists
                if (res.statusCode === 412) {
                    throw new RequestError('EDBEXISTS', 'Database already exists: ' + dbName, body);
                }

                if (res.statusCode === 401) {
                    throw new RequestError('ENOTADMIN', 'Should be authorized as admin to create database: ' + res.statusCode, body);
                }

                if (res.statusCode === 400) {
                    throw new RequestError('EBADREQUEST', res.body.reason, body);
                }

                if (res.statusCode !== 201) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while creating database ' + dbName + ': ' + res.statusCode, body);
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

    }, {
        key: 'dropDatabase',
        value: function dropDatabase(dbName) {
            return this._requestWrapped({
                method: 'DELETE',
                url: this._baseUrl + '/' + dbName + '/'
            }).then(function (_ref3) {
                var res = _ref3.res,
                    body = _ref3.body;

                // database not found
                if (res.statusCode === 404) {
                    throw new RequestError('EDBMISSING', 'Database not found: ' + dbName, body);
                }

                if (res.statusCode === 401) {
                    throw new RequestError('ENOTADMIN', 'Should be authorized as admin to delete database: ' + res.statusCode, body);
                }

                if (res.statusCode !== 200) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while deleting database ' + dbName + ': ' + res.statusCode, body);
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

    }, {
        key: 'get',
        value: function get(dbName, uri) {
            var _this2 = this;

            var query = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

            for (var prop in query) {
                if (KEYS_TO_ENCODE.indexOf(prop) !== -1) {
                    query[prop] = JSON.stringify(query[prop]);
                }
            }

            var requestOpts = {
                url: this._baseUrl + '/' + dbName + '/' + uri,
                qs: query
            };

            return this._requestWrapped(requestOpts).then(function (_ref4) {
                var res = _ref4.res,
                    body = _ref4.body;

                if (res.statusCode === 404) {
                    throw new RequestError('EDOCMISSING', 'Document is not found', body);
                }

                if (res.statusCode !== 200 && res.statusCode !== 304) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while fetching documents from the database: ' + res.statusCode, body);
                }

                if (res.statusCode === 200 && _this2._cache) {
                    var cacheKey = _this2._getCacheKey(requestOpts);

                    _this2._cache.set(cacheKey, {
                        body: body,
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

    }, {
        key: 'getAttachment',
        value: function getAttachment(dbName, docId, attachmentName, docRevision) {
            var _this3 = this;

            var requestOpts = {
                method: 'GET',
                url: this._baseUrl + '/' + dbName + '/' + docId + '/' + attachmentName,
                qs: {
                    rev: docRevision
                }
            };

            return this._requestWrapped(requestOpts).then(function (_ref5) {
                var res = _ref5.res,
                    body = _ref5.body;

                if (res.statusCode === 404) {
                    throw new RequestError('EDOCMISSING', 'Attachment is not found', body);
                }

                if (res.statusCode !== 200 && res.statusCode !== 304) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while fetching attachment from the database: ' + res.statusCode, body);
                }

                if (res.statusCode === 200 && _this3._cache) {
                    var cacheKey = _this3._getCacheKey(requestOpts);

                    _this3._cache.set(cacheKey, {
                        body: body,
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

    }, {
        key: 'insert',
        value: function insert(dbName, data) {
            var _this4 = this;

            return this._requestWrapped({
                method: 'POST',
                url: this._baseUrl + '/' + dbName,
                body: data
            }).then(function (_ref6) {
                var res = _ref6.res,
                    body = _ref6.body;

                _this4._checkDocumentManipulationStatus(res.statusCode, body);

                if (res.statusCode !== 201 && res.statusCode !== 202) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while inserting document into the database: ' + res.statusCode, body);
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
         * @param {String} docId document id
         * @param {String} attachmentName attachment name
         * @param {String} body attachment body
         * @param {String} docRevision document revision
         * @return {Promise}
         */

    }, {
        key: 'insertAttachment',
        value: function insertAttachment(dbName, docId, attachmentName, body, docRevision) {
            return this._requestWrapped({
                method: 'PUT',
                url: this._baseUrl + '/' + dbName + '/' + encodeURIComponent(docId) + '/attachment',
                qs: {
                    rev: docRevision
                },
                body: body
            }).then(function (_ref7) {
                var res = _ref7.res,
                    body = _ref7.body;

                if (res.statusCode === 409) {
                    throw new RequestError('EDOCCONFLICT', 'Document insert conflict - Document’s revision wasn’t specified or it’s not the latest', body);
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

    }, {
        key: 'update',
        value: function update(dbName, data) {
            var _this5 = this;

            if (!data._id || !data._rev) {
                var err = new Error('Both _id and _rev fields should exist when updating the document');
                err.code = 'EFIELDMISSING';

                return Promise.reject(err);
            }

            return this._requestWrapped({
                method: 'PUT',
                url: this._baseUrl + '/' + dbName + '/' + encodeURIComponent(data._id),
                body: data
            }).then(function (_ref8) {
                var res = _ref8.res,
                    body = _ref8.body;

                _this5._checkDocumentManipulationStatus(res.statusCode, body);

                if (res.statusCode !== 201 && res.statusCode !== 202) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while inserting document into the database: ' + res.statusCode, body);
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

    }, {
        key: 'del',
        value: function del(dbName, docId, docRevision) {
            var _this6 = this;

            return this._requestWrapped({
                method: 'DELETE',
                url: this._baseUrl + '/' + dbName + '/' + encodeURIComponent(docId),
                qs: {
                    rev: docRevision
                }
            }).then(function (_ref9) {
                var res = _ref9.res,
                    body = _ref9.body;

                _this6._checkDocumentManipulationStatus(res.statusCode, body);

                if (res.statusCode !== 200) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while deleting document: ' + res.statusCode, body);
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

    }, {
        key: 'mango',
        value: function mango(dbName, mangoQuery) {
            var _this7 = this;

            var query = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

            for (var prop in query) {
                if (KEYS_TO_ENCODE.indexOf(prop) !== -1) {
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

            if ((typeof mangoQuery === 'undefined' ? 'undefined' : _typeof(mangoQuery)) !== 'object') {
                return Promise.reject(new RequestError('EBADREQUEST', 'Invalid Mango query parameter.'));
            }

            var requestOpts = {
                method: 'POST',
                url: this._baseUrl + '/' + dbName + '/_find',
                body: mangoQuery,
                qs: query
            };

            return this._requestWrapped(requestOpts).then(function (_ref10) {
                var res = _ref10.res,
                    body = _ref10.body;

                _this7._checkServerVersion(res.headers.server, 2);

                if (res.statusCode === 404) {
                    throw new RequestError('EDOCMISSING', 'Document is not found', body);
                }

                if (res.statusCode !== 200 && res.statusCode !== 304) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while fetching documents from the database: ' + res.statusCode, body);
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
         * @param {String} attachmentName attachment name
         * @param {String} docRevision document revision
         * @return {Promise}
         */

    }, {
        key: 'delAttachment',
        value: function delAttachment(dbName, docId, attachmentName, docRevision) {
            return this._requestWrapped({
                method: 'DELETE',
                url: this._baseUrl + '/' + dbName + '/' + encodeURIComponent(docId) + '/' + encodeURIComponent(attachmentName),
                qs: {
                    rev: docRevision
                }
            }).then(function (_ref11) {
                var res = _ref11.res,
                    body = _ref11.body;

                if (res.statusCode === 404) {
                    throw new RequestError('EDOCMISSING', 'Attachment is not found', body);
                }

                if (res.statusCode !== 200) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while deleting attachment: ' + res.statusCode, body);
                }

                return {
                    data: body,
                    headers: res.headers,
                    status: res.statusCode
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

    }, {
        key: 'updateFunction',
        value: function updateFunction(dbName, designDocument, updateFunctionName, queryString, docId) {
            var method = docId ? 'PUT' : 'POST';
            queryString = queryString || {};

            var url = void 0;

            if (method === 'PUT') {
                url = this._baseUrl + '/' + dbName + '/_design/' + designDocument + '/_update/' + updateFunctionName + '/' + encodeURIComponent(docId);
            } else {
                url = this._baseUrl + '/' + dbName + '/_design/' + designDocument + '/_update/' + updateFunctionName;
            }

            return this._requestWrapped({
                method: method,
                url: url,
                qs: queryString
            }).then(function (_ref12) {
                var res = _ref12.res,
                    body = _ref12.body;

                if (res.statusCode === 404) {
                    throw new RequestError('EDOCMISSING', 'Design document is not found', body);
                }

                if (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 202) {
                    throw new RequestError('EUNKNOWN', 'Unexpected status code while calling update function: ' + res.statusCode, body);
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

    }, {
        key: 'uniqid',
        value: function uniqid() {
            var count = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;

            return this._requestWrapped({
                url: this._baseUrl + '/_uuids',
                qs: { count: count }
            }).then(function (_ref13) {
                var body = _ref13.body;

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

    }, {
        key: '_checkDocumentManipulationStatus',
        value: function _checkDocumentManipulationStatus(statusCode, body) {
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

    }, {
        key: '_requestWrapped',
        value: function _requestWrapped(opts) {
            var _this8 = this;

            if (typeof opts === 'string') {
                opts = { url: opts };
            }

            var cacheKey = this._getCacheKey(opts);
            var whenCacheChecked = !this._cache || opts.method && opts.method !== 'GET' ? Promise.resolve({}) : this._cache.get(cacheKey);

            return whenCacheChecked.then(function (cache) {
                // cache plugin returns null if record doesn't exist
                var _ref14 = cache || {},
                    etag = _ref14.etag,
                    cacheBody = _ref14.body;

                return new Promise(function (resolve, reject) {
                    if (etag) {
                        opts.headers = opts.headers || {};
                        opts.headers['if-none-match'] = etag;
                    }

                    _this8._requestWrappedDefaults(opts, function (err, res, body) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                res: res,
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

    }, {
        key: '_getCacheKey',
        value: function _getCacheKey(requestOpts) {
            var stringifiedQuery = JSON.stringify(requestOpts.query || {});
            var cacheKeyFull = requestOpts.url + '?' + stringifiedQuery;

            return _crypto2.default.createHash('md5').update(cacheKeyFull).digest('hex');
        }

        /**
         * @param {String} serverHeader
         * @param {Number} minServerVersion
         */

    }, {
        key: '_checkServerVersion',
        value: function _checkServerVersion(serverHeader) {
            var minServerVersion = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;

            var serverVersion = serverHeader.match(/^CouchDB\/([\d]+)/);

            if (!serverVersion || !serverVersion[1]) {
                throw new RequestError('ESERVERNOTSUPPORTED', 'Server is not supported: ' + serverHeader);
            }

            if (serverVersion[1] < minServerVersion) {
                throw new RequestError('ESERVEROLD', 'Server version is too old for using this API: ' + minServerVersion + ' (expected), ' + serverHeader + ' (actual)');
            }
        }
    }]);

    return NodeCouchDB;
}();

exports.default = NodeCouchDB;
;
