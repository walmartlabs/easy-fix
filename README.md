
Easy-fix: record & replay test data for flexible integration testing
====================================================================

Opinions diverge on how to do integration testing.  One camp says: "mock your input data to isolate the target code" but tests using mock data can lose fidelity with changing real-world systems.  The other camp says: "let your integration tests run live. Side effects are no problem" but those tests can run slow (for network latency, etc) and might require you to be on a private network.  Neither camp wins!

Why choose?  This module helps integration tests capture and replay test data.  This allows tests to run in "live" mode, interacting with remote systems/db, or in "replay" mode, isolated to using serialized mock data, with no side effects. This is integration testing zen.

NEW in v3
---------
Several new features include
* better serialization for whitespace
* Error reinstantiation
* mock file access log
* a file cache for mock data
* named mock files

Notes on the new options have been added below.
See the [changelog](CHANGELOG.md) for more details.

NEW in v2
---------
Easy-fix v2 now supports promises!  See the [changelog](CHANGELOG.md) for details.

Installing
----------
`npm install easy-fix --save-dev`


Usage & documentation
---------------------

Easy-fix exposes only two methods: "wrapAsyncMethod" and "restore"

Let's start with an example.  This test shows sinon stub replace with the easy-fix equivalent:

```javascript

let wrapper;

// set up the stubs/mocks:
before(function () {

  // Perhaps you use stubs, something like this:
  //   sinon.stub(productFees, 'getFeesForUpcs', /* stub function here */ );

  // Let's replace that and use easy-fix:
  wrapper = easyFix.wrapAsyncMethod(productFees, 'getFeesForUpcs', {
    dir: 'test/captured-data', // directory for the captured test data
    prefix: 'product-fees', // filenames are prefixed with this string
  });
};

it('gets linked upcs', function (done) {
  var upcs = [
    '0007800015274',
    '0069766210858'
  ];

  productFees.getFeesForUpcs(upcs, function (err, fees) {
    expect(err).to.not.exist;
    expect(fees).to.exist;
    expect(_.keys(fees)).to.have.length.above(2);
    done();
  });
});

after(function () {
  wrapper.restore() // remove stubs
});
```

If you had no 'before' setup method, the test would hit the database.

If you used the sinon stub, you'd have to plumb in your own mock function.  This is typically how people feed in the mock data.

Use easy-fix much like the sinon.stub - pass in an object, the name of a method, and an options hash.  Easy-fix will then operate in one of three modes...

Test modes
----------

Modes are specified by the `TEST_MODE` environment variable, and they can be overridden as the 'mode' in the options hash.  The modes are:

*  "live": test runs live.  Easy-fix simply falls back onto the target function.
*  "capture": test runs live, but the arguments and response are captured and written to disk.
*  "replay": test does not run live - the function is mocked by the captured data.

Options
-------

*  `dir: <string>`: test data is written into this directory. This defaults to "test/data".
*  `prefix: <string>`: test data filenames are prefixed with this string. This defaults to the name of the target function.
*  `mode: <replay | live | capture>`: override the TEST_MODE environment variable.  In the absence of the TEST_MODE and this option, the mode defaults to "replay".
*  `callbackSwap: <function>`: allow an alternate function to monkey-patch the target function callback.  If the target function (under test) does not follow the nodejs convention of having a callback as it's last argument, you'll need to use this option to provide a custom function to swap the callbacks.
*  `reinstantiateErrors: <boolean>`: if the first argument to a callback is an Errror, or the first argument for a rejected Promise is an Error, easy-fix will attempt to reinstantiate this Error (when in replay mode). Default is `true`.
*  `filepath: <string>`: capture/replay a mock in the named file path (joined with the `dir` option).  This avoids the filename being derived from a hash of the calling arguments to the target function.
*  `sinon: <sinon module>`: if your project uses sinon, you can pass in the module here, and the wrapped target function will be a sinon stub. This adds functionality to the easy-fix wrapped function object, but does not change the behavior of easy-fix.  Allowing sinon as an option avoids taking it as a dependency.
*  `log: <filename>`: A file will be appended with lines describing the names of the mock files read and written.

Options - serialization
-----------------------

*  `argumentSerializer: <function (argument_array)>`:  an alternate serialization of the target function arguments.  The default is a cycle-safe JSON serializer.  Easy-fix will match responses to a hash of the serialized call arguments. This is useful for deduplicating test data where you expect the call arguments will be different for each call but do not require a unique response (perhaps for a timestamp or uuid).
*  `responseSerializer: <function (argument_array)>`:  use an alternate serialization of the target function callback arguments.  This may be useful, for example, in removing details from a long response, if the test requires only some of the unaffected details.  Note that this argument applies to the callback arguments for Promise resolution/rejection as well as an asynchronous function callback.
*  `responseDeserializer: <function (string)>`:  use an alternate deserialization of the target function callback arguments.  The default is JSON.parse. This is typically only useful if you specify a responseSerializer. This may be useful to reinstantiate a derived Object or Error type, if needed.
*  `returnValueSerializer: <function (argument_array, callback)>`:  allow an alternate serialization to JSON.stringify on the target function return value.  This may be useful, for example, in removing details from a long return value, if the test requires only some of the unaffected details.  A callback is provided to allow the test to capture asynchronous information produced by the return value.  This may help with capturing values produced by streams, for example.
*  `returnValueDeserializer: <function (string, argument_array)>`:  use an alternate deserialization of the return value of the target function.  The default is JSON.parse. This is typically only useful if you specify a returnValueSerializer. This may be useful to reinstantiate a derived Object or Error type, if needed.  The second argument is the provided if any data was captured by the callback to the `returnValueSerializer`.

