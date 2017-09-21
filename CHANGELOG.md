
NEW in v2: Support for Promises
===============================

Easy-fix v2 supports Promises.  Use the same method `wrapAsyncMethod` to wrap a function that returns a Promise, and the Promise will operate according to the easy-fix TEST_MODE, just like regular async functions.  In 'live' mode, the Promise will work as usual.  In 'capture' mode, it will generate a test fixture.  In 'replay' mode, the wrapped function will not be called, and the returned Promise will be resolve or rejected with the data found in the fixture.

There is another small (but potentially breaking) change.  Easy-fix v2 now supports the return values of the wrapped functions.  Previously, in easy-fix v1, calling a function wrapped by `wrapAsyncMethod` would allways return null (in capture & replay modes).  Now, the return value is serialized to the fixture file, and returned in all modes.
