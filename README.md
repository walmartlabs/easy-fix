
Easy-fix: record & replay test data for flexible integration testing
====================================================================

Opinions diverge on how to do integration testing.  One camp says: "mock your input data to isolate the target code" but tests using mock data can lose fidelity with changing real-world systems.  The other camp says: "let your integration tests run live. Side effects are no problem" but those tests can run slow (for network latency, etc) and might require you to be on a private network.  Neither camp wins!

Why chose?  This module helps integration tests capture and replay test data.  This allows tests to run in "live" mode, interacting with remote systems/db, or in "replay" mode, isolated to using serialized mock data, with no side effects. This is integration testing zen.

Usage & documentation
---------------------

Easy-fix exposes only two methods: "wrapAsyncMethod" and "restore"

Let's start with an example.  this test shows sinon stub replace with the easy-fix equivalent:

```javascript
    // set up the stubs/mocks:
    before(function () {

      // Perhaps you use stubs, something like this:
      //   sinon.stub(productFees, 'getFeesForUpcs', /* stub function here */ );

      // Let's replace that and use easy-fix:
      easyFix.wrapAsyncMethod(productFees, 'getFeesForUpcs', {
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
      easyFix.restore() // remove stubs
    });
```

If you had no 'before' setup method, the test would hit the database.

If you used the sinon stub, you'd have to plumb in your own mock function.  This is typically how people feed in the mock data.

Use easy-fix much like the sinon.stub - pass in an object, the name of a method, and an options hash.  Easy-fix will then operate in one of three modes...

Test modes
----------

Modes are specified by the TEST_MODE environment variable, and they can be overridden as the 'mode' in the options hash.  The modes are:

*  "live": test runs live.  Easy-fix simply falls back onto the target function.
*  "capture": test runs live, but the arguments and response are captured and written to disk.
*  "replay": test does not run live - the function is mocked by the captured data.

Options
-------

*  "dir": test data is written into this directory. This defaults to "test/data".
*  "prefix": test data filenames are prefixed with this string. This defaults to the name of the target function.
*  "mode": override the TEST_MODE environment variable.  In the absence of the TEST_MODE and this option, the mode defaults to "replay".
*  "callbackSwap": allow an alternate function to monkey-patch the target function callbacks.  If the target function under test does not follow node convention of having a callback as it's last agument, you'll need to provide a custom function for this option.
*  "argumentSerializer":  allow an alternate serialization to JSON.stringify on the target function arguments.  This is useful for deduplicating test data where you expect the arguments will be different for each call (perhaps with a timestamp or uuid) but do not require a unique response.

