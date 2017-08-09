# 1.2.0

 * **new**: New `mango` API support ([@Flamenco](https://github.com/1999/node-couchdb/pull/20))

# 1.1.1
 * **fix**: CouchDB 400 status codes now produce `EBADREQUEST` error code ([@pvomhoff](https://github.com/pvomhoff))
 * **fix**: `UnhandledPromiseRejectionWarning` inside tests is fixed ([@pvomhoff](https://github.com/pvomhoff))

# 1.1.0

 * **new**: you can pass new `auth` field into node-couchdb constructor argument to support non-admin-party CouchDB mode. See [README](https://github.com/1999/node-couchdb#constructor) for more info.

# 1.0.x

There had been problems with extending and support of `node-couchdb` since its first release due to its code. Tests were a bit messy and code was too old. Also there was an architecture problem with cache layers: internally they were acting really weird. `node-couchdb@1` was designed to be extremely simple to read and extend. Cache layers were renamed into plugins and separated from the package itself. Tests were rewritten in `mocha`. Library code was rewritten in ES2015.

 * **breaking change**: `node-couchdb` is now ES2015-compatible: only node.js >= 4 is supported. If you're using node.js 0.10 or 0.12, `require('node-couchdb/dist/legacy')`, but it's not tested. You have been warned!
 * **breaking change**: new API: package exports constructor with new arguments, all methods return promise instance
 * **breaking change**: cache layers have been removed from the package into separate NPM packages: [memcached](https://www.npmjs.com/package/node-couchdb-plugin-memcached), [process memory](https://www.npmjs.com/package/node-couchdb-plugin-memory). If you're missing smth feel free to add a new one and publish it with `node-couchdb-plugin` keyword. Also send a PR to `node-couchdb` README about your plugin and it will be added to the list.
 * **new**: promises can be rejected with Error instance which usually has `code` and `body` fields. Look tests and README for more examples
 * **new**: all tests rewritten in `mocha` + many new tests introduced

Note about writing your own node-couchdb-plugin: grab tests from `node-couchdb-plugin-memory` and enhance with your own. Package should export constructor and the prototype should have only three methods (set, get, invalidate), so it should be pretty simple to write tests for it.

# 0.5.0

 * new: createDatabase invokes callback with EDBEXISTS error if database already exists
 * new: dropDatabase invokes callback with EDBMISSING error if database doesn't exist

# 0.4.0

 * `listDatabases()` method output was wrong (#5, fixed by @dethtron5000)
 * node.js minimum version is now 0.10 due to asker's `contimer` dependency.

# 0.3.2

 * `update()` method failed to update docs with URL in their _id (#7)
 * update dependencies: asker and nodeunit.

# 0.3.1

 * `node-couchdb` constructor accepts 4th parameter - default timeout for all requests, which is 5 seconds by default.

# 0.3.0

 * Use 5 seconds default timeout for all requests

# 0.2.2

 * Do not use `_serialize` property: we can't guarantee that the cached value won't change later if `_serialize` if set to `false` and value is cached in memory. Now every cached value is serialized by default;
 * Exclude examples and tests from being published to NPM.

# 0.2.1

 * Use [asker](http://browsenpm.org/package/asker) instead of [request](http://browsenpm.org/package/request);
 * Add additional tests;
 * Add .editorconfig file.
