NEW in v3: Workflow features
============================

Easy-fix v3 will default to a more readable serialization of JSON data.  Previous versions would serialize call arguments, return and response values as (an escaped) string, and serialize the whole object of mock data to write the mock file to disk.  A result of this double serialization is arguments and response/return values would each be encoded as a single (often very long) line.  With the changes in v3, the JSON object of mock data is only serialized once (by default) and result is typically more readable.  Changes in the mock files also typically look better in diff results.

Errors as a first argument in callbacks and rejected promises are re-instantiated by easy-fix, when running in replay mode.  This avoids a potentially-confusing behavior where easy-fix will intercept an Error result, but replay it as a deserialized Object.  Note that the new behavior will only reinstantiate an Error, not any derived Error types.  If your tests are sensitive to different Error types, you can make sure the correct types are used by defining a `responseSerializer` and `responseDeserializer`.

An optional log file will be written with mock file read/write attempts, if a filename is passed in to the easy-fix options.  This may help investigate failing tests, where easy-fix is attempting to read a mock file that does not exist.

A cache of mock files will prevent multiple reads of the same path.  This will reduce the number of synchronous file reads for repeated tests, which may make performance metrics more accurate.

A named file may be specified as the 'filepath' option, preventing easy-fix from generating a filename from a hash of the calling arguments.  This may be useful in keeping tests robust across changes to the arguments of the wrapped target function.  This option should be used with caution: changes to the calling arguments typically represent changes to behavior of the target function, but the mock file named with this argument will be used (in replay mode) regardless of the calling function arguments.


NEW in v2: Support for Promises
===============================

Easy-fix v2 supports Promises.  Use the same method `wrapAsyncMethod` to wrap a function that returns a Promise, and the Promise will operate according to the easy-fix TEST_MODE, just like regular async functions.  In 'live' mode, the Promise will work as usual.  In 'capture' mode, it will generate a test fixture.  In 'replay' mode, the wrapped function will not be called, and the returned Promise will be resolve or rejected with the data found in the fixture.

There is another small (but potentially breaking) change.  Easy-fix v2 now supports the return values of the wrapped functions.  Previously, in easy-fix v1, calling a function wrapped by `wrapAsyncMethod` would allways return null (in capture & replay modes).  Now, the return value is serialized to the fixture file, and returned in all modes.
