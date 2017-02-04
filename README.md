# node-couchdb [![Build Status](https://secure.travis-ci.org/1999/node-couchdb.svg?branch=master)](http://travis-ci.org/1999/node-couchdb) [![Dependency Status](https://david-dm.org/1999/node-couchdb.svg)](https://david-dm.org/1999/node-couchdb) [![devDependency Status](https://david-dm.org/1999/node-couchdb/dev-status.svg)](https://david-dm.org/1999/node-couchdb#info=devDependencies)

`node-couchdb` package provides an easy way to interact with CouchDB using preferred cache layer:

 * [process memory](https://www.npmjs.com/package/node-couchdb-plugin-memory)
 * [memcached](https://www.npmjs.com/package/node-couchdb-plugin-memcached)
 * place for your plugin :)

# Installation
``` bash
npm install node-couchdb --save
```

# API
## Constructor
`node-couchdb` exports constructor, which accepts one object argument with properties `host` (127.0.0.1 by default), `port` (5984 by default), `protocol` (http by default), `cache` (one of plugins, null by default), `auth` (object with properties `{user, pass}`) and `timeout` for all requests (5000 by default). All object fields are optional.

```javascript
const NodeCouchDb = require('node-couchdb');

// node-couchdb instance with default options
const couch = new NodeCouchDb();

// node-couchdb instance with Memcached
const MemcacheNode = require('node-couchdb-plugin-memcached');
const couchWithMemcache = new NodeCouchDb({
    cache: new MemcacheNode
});

// node-couchdb instance talking to external service
const couchExternal = new NodeCouchDb({
    host: 'couchdb.external.service',
    protocol: 'https',
    port: 6984
});

// not admin party
const couchAuth = new NodeCouchDb({
    auth: {
        user: 'login',
        pass: 'secret'
    }
});
```

All node-couchdb methods return Promise instances which resolve if everything works as expected and reject with Error instance which usually has `code` and `body` fields. See package source and tests for more info.

## Create database
```javascript
couch.createDatabase(dbName).then(() => {...}, err => {
    // request error occured
});
```

## Drop database
```javascript
couch.dropDatabase(dbName).then(() => {...}, err => {
    // request error occured
});
```

## List databases
```javascript
couch.listDatabases().then(dbs => dbs.map(...), err => {
    // request error occured
});
```

## Get document by its id
```javascript
couch.get("databaseName", "some_document_id").then(({data, headers, status}) => {
    // data is json response
    // headers is an object with all response headers
    // status is statusCode number
}, err => {
    // either request error occured
    // ...or err.code=EDOCMISSING if document is missing
    // ...or err.code=EUNKNOWN if statusCode is unexpected
});
```

## Get view results
```javascript
const dbName = "database";
const startKey = ["Ann"];
const endKey = ["George"];
const viewUrl = "_design/list/_view/by_firstname";

const queryOptions = {
    startKey,
    endKey
};

couch.get(dbName, viewUrl, queryOptions).then(({data, headers, status}) => {
    // data is json response
    // headers is an object with all response headers
    // status is statusCode number
}, err => {
    // either request error occured
    // ...or err.code=EDOCMISSING if document is missing
    // ...or err.code=EUNKNOWN if statusCode is unexpected
});
```

## Query using Mango (CouchDB 2.x)
```javascript
const dbName = "database";
const mangoQuery = {
    selector: {
        $gte: {firstname: 'Ann'},
        $lt: {firstname: 'George'}  
    }
};
const parameters = {};

couch.mango(dbName, mangoQuery, parameters).then(({data, headers, status}) => {
    // data is json response
    // headers is an object with all response headers
    // status is statusCode number
}, err => {
    // either request error occured
    // ...or err.code=EDOCMISSING if document is missing
    // ...or err.code=EUNKNOWN if statusCode is unexpected
});
```

## Insert a document
```javascript
couch.insert("databaseName", {
    _id: "document_id",
    field: ["sample", "data", true]
}).then(({data, headers, status}) => {
    // data is json response
    // headers is an object with all response headers
    // status is statusCode number
}, err => {
    // either request error occured
    // ...or err.code=EDOCCONFLICT if document with the same id already exists
});
```

## Update a document
```javascript
// note that "doc" must have both "_id" and "_rev" fields
couch.update("databaseName", {
    _id: "document_id",
    _rev: "1-xxx"
    field: "new sample data",
    field2: 1
}).then(({data, headers, status}) => {
    // data is json response
    // headers is an object with all response headers
    // status is statusCode number
}, err => {
    // either request error occured
    // ...or err.code=EFIELDMISSING if either _id or _rev fields are missing
});
```

## Delete a document
```javascript
couch.del("databaseName", "some_document_id", "document_revision").then(({data, headers, status}) => {
    // data is json response
    // headers is an object with all response headers
    // status is statusCode number
}, err => {
    // either request error occured
    // ...or err.code=EDOCMISSING if document does not exist
    // ...or err.code=EUNKNOWN if response status code is unexpected
});
```

## Generate unique identifier(s)
```javascript
// get one unique id
couch.uniqid().then(ids => ids[0]);

// get N unique ids
couch.uniqid(N).then(ids => ids.map(...));
```
