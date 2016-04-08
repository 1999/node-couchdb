'use strict';

var exportsAPI;

if (process.release) {
    // this is nodejs >= 4
    exportsAPI = (process.version.indexOf('v4') === 0)
        ? require('./dist/node-4')
        : require('./dist/node-5');
} else {
    exportsAPI = (process.version.indexOf('v0.10') === 0)
        ? require('./dist/node-0.10')
        : require('./dist/node-0.12');
}

module.exports = exportsAPI;
