Introduction
============

[CouchDB](http://couchdb.apache.org/) is amazing and easy-to-use NoSQL document-oriented database. This package provides an easy way to interact with CouchDB using Memcached server as a cache layer to store the ETags which uniquely represent the current state of the documents. Moreover you can use [your own cache implementation](https://github.com/1999/couchdb-memcached/blob/master/example/own-cache.js) API.

Installation
============

``` bash
npm install node-couchdb
```
or
``` bash
npm install --dev
```
to run examples

API
========

```
couchdb.useCache("memcache");
couchdb.useCache("fs");
couchdb.useCache("custom");
```

How to start
``` javascript
// using simple memcache client (https://npmjs.org/package/memcache)
var memcacheClient = require("memcache").Client(11211, "localhost");
memcacheClient.on("connect", function () {
	var db = new MemCouchDB("localhost", 5984, memcacheClient);
});

memcacheClient.connect();
```

``` javascript
// using your own cache client which should contain both "set(key, data, callback)" and "get(key, callback)" methods
var db = new MemCouchDB("localhost", 5984, cacheClient);
```

Fetch document by its id
``` javascript
var dbName = "database";
var docId = "some_document_id";

CouchDB.get(dbName, docId, function (err, resData) {
	if (err) {
		util.error(err);
		return;
	}

	util.puts(util.inspect(resData, false, null, true));
});
```

Insert a document
``` javascript
var dbName = "database";
var doc = {
	"_id" : "document_id",
	"field" : ["sample", "data", true]
};

CouchDB.insert(dbName, doc, function (err, resData) {
	if (err) {
		util.error(err);
		return;
	}

	util.puts(util.inspect(resData, false, null, true));
});
```

Update a document
``` javascript
var dbName = "database";
var doc = {
	"_id" : "document_id",
	"_rev" : "1-xxx"
	"field" : "new sample data",
	"field2" : 1
};

// note that "doc" must have both "_id" and "_rev" fields
CouchDB.update(dbName, doc, function (err, resData) {
	if (err) {
		util.error(err);
		return;
	}

	util.puts(util.inspect(resData, false, null, true));
});
```

Delete a document
``` javascript
var dbName = "database";
var docId = "document_id";
var revision = "2-yyy";

CouchDB.del(dbName, docId, revision, function (err, resData) {
	if (err) {
		util.error(err);
		return;
	}

	util.puts(util.inspect(resData, false, null, true));
});
```

Generate unique identifier(s)
``` javascript
CouchDB.uniqid(1, function (err, ids) { // or even simplier: CouchDB.uniqid(function (err, ids) {
	if (err) {
		util.error(err);
		return;
	}

	util.puts(util.inspect(ids, false, null, true)); // ids is an array
});
```

Create database
``` javascript
CouchDB.createDatabase("database_name", function (err) {
	if (err) {
		util.error(err);
		return;
	}

	util.puts("Database created");
});
```

Drop database
``` javascript
CouchDB.dropDatabase("database_name", function (err) {
	if (err) {
		util.error(err);
		return;
	}

	util.puts("Database deleted");
});
```

Fetch data by requesting a view

``` javascript
var dbName = "database";
var startKey = ["Ann"];
var endKey = ["George"];
var viewUrl = "_design/list/_views/by_firstname";
var queryOptions = {
	"startkey" : startKey,
	"endkey" : endKey
};

CouchDB.get(dbName, viewUrl, queryOptions, function (err, resData) {
	if (err) {
		util.error(err);
		return;
	}

	util.puts(util.inspect(resData, false, null, true));
});
```

Live examples
=============

Look into the *examples* folder

Package author
==============

[Dmitry Sorin](http://www.staypositive.ru) @ [Yandex LLC](http://www.yandex.ru)