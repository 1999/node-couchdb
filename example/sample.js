"use strict";

exports.runTest = function (couch) {
	couch.createDatabase("sample", function (err) {
		if (err)
			throw new Error(err);

		couch.insert("sample", {}, function (err, resData) {
			if (err)
				throw new Error(err);

			couch.get("sample", resData.data.id, function (err, data) {
				if (err)
					throw new Error(err);

				console.log("[Get the document for the first time]");
				console.dir(data);

				// timeout is used because we do not wait for cache.set() callback
				setTimeout(function () {
					couch.get("sample", resData.data.id, function (err, data) {
						if (err)
							throw new Error(err);

						console.log("[Get the document for the second time]");
						console.dir(data);

						couch.dropDatabase("sample");
						couch.useCache();
					});
				}, 100)
			});
		});
	});
};
