# 0.2.2

 * Do not use `_serialize` property: we can't guarantee that the cached value won't change later if `_serialize` if set to `false` and value is cached in memory. Now every cached value is serialized by default;
 * Exclude examples and tests from being published to NPM.

# 0.2.1

 * Use [asker](http://browsenpm.org/package/asker) instead of [request](http://browsenpm.org/package/request);
 * Add additional tests;
 * Add .editorconfig file.
