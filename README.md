node-couchdb ![Travis CI](https://secure.travis-ci.org/1999/node-couchdb.png?branch=master)
============

[CouchDB](http://couchdb.apache.org/) is amazing and easy-to-use NoSQL document-oriented database. This package provides an easy way to interact with CouchDB using ETags and your preferred cache layer (memcached, file system, memory, etc). Check out [examples](https://github.com/1999/node-couchdb/tree/master/examples) folder for more info.

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

How to start
``` javascript
// use memory caching
var nodeCouchDB = require("node-couchdb");
var couch = new nodeCouchDB("localhost", 5984);

// even simplier, but you can't set host and port this way
var couch = require("node-couchdb");

// use memcached with "memcache" NPM package
var nodeCouchDB = require("node-couchdb");
var memcacheClient = require("memcache").Client(11211, "localhost");
memcacheClient.on("connect", function () {
	memcacheClient.invalidate = function () {};
	var couch = new nodeCouchDB("localhost", 5984, memcacheClient);
});

memcacheClient.connect();
```

Fetch document by its id
``` javascript
couch.get("databaseName", "some_document_id", function (err, resData) {
	if (err)
		return console.error(err);

	console.dir(resData);
});
```

Insert a document
``` javascript
couch.insert("databaseName", {
	"_id" : "document_id",
	"field" : ["sample", "data", true]
}, function (err, resData) {
	if (err)
		return console.error(err);

	console.dir(resData)
});
```

Update a document
``` javascript
// note that "doc" must have both "_id" and "_rev" fields
couch.update("databaseName, {
	"_id" : "document_id",
	"_rev" : "1-xxx"
	"field" : "new sample data",
	"field2" : 1
}, function (err, resData) {
	if (err)
		return console.error(err);

	console.dir(resData);
});
```

Delete a document
``` javascript
couch.del("databaseName", "some_document_id", "document_revision", function (err, resData) {
	if (err)
		return console.error(err);

	console.dir(resData);
});
```

Generate unique identifier(s)
``` javascript
couch.uniqid(1, function (err, ids) { // or even simplier: couch.uniqid(function (err, ids) {
	if (err)
		return console.error(err);

	console.dir(ids);
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

couch.get(dbName, viewUrl, queryOptions, function (err, resData) {
	if (err)
		return console.error(err);

	console.dir(resData)
});
```

```couch.createDatabase()```, ```couch.dropDatabase()``` and ```couch.listDatabases()``` are also available. Check out the [sources](https://github.com/1999/node-couchdb/blob/master/lib/node-couchdb.js) for more info.
