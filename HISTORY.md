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
