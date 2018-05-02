/* globals describe, beforeEach, afterEach, it */
'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const easyFix = require('./index');
const stream = require('stream');

const expectedReturnValue = 'I am a function return value';
const errorMessage = 'This is a predictable error';
const expectedStreamingValue = 'This string gets streamed in chunks';
const thingToTest = {
  state: 0,
  incStateAsync: (stateArg, callback) => {
    thingToTest.state = stateArg.val;
    process.nextTick(() => {
      thingToTest.state += 1;
      callback(null, thingToTest.state);
    });
    return expectedReturnValue;
  },
  causeAsyncError: (callback) => {
    process.nextTick(() => {
      const error = new Error(errorMessage);
      error.otherProperty = 'blah';
      callback(error);
    });
    return expectedReturnValue;
  },
  incStatePromise: (stateArg) => {
    return new Promise((resolve) => {
      thingToTest.state = stateArg.val;
      process.nextTick(() => {
        thingToTest.state += 1;
        resolve(thingToTest.state);
      });
    });
  },
  promiseThatRejects: () => {
    return new Promise((resolve, reject) => {
      process.nextTick(() => {
        const err = new Error(errorMessage);
        err.otherProperty = 'blah';
        reject(err);
      });
    });
  },
  streamSomething: () => {
    const stringStream = new stream.PassThrough();
    let streamIndex = 0;
    const continueSreaming = () => {
      if (streamIndex < expectedStreamingValue.length) {
        stringStream.push(expectedStreamingValue[streamIndex]);
        streamIndex += 1;
        setTimeout(continueSreaming, 5);
        return;
      }
      stringStream.push(null);
    };
    continueSreaming();
    return stringStream;
  },
  resetState: () => {
    thingToTest.state = 0;
  }
};

let asyncStub;
let promiseStub;
let causeErrorStub;
let promiseRejectStub;
let streamStub;
const runSharedTests = (expectTargetFnCalls) => {

  it('falls back onto wrapped method', (done) => {
    const foundReturnValue = thingToTest.incStateAsync({ val: 9 }, (err, state) => {
      expect(foundReturnValue).to.equal(expectedReturnValue);
      expect(state).to.equal(10);
      const expectedTargetState = expectTargetFnCalls ? 10 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(asyncStub.callCount).to.equal(1);
      done();
    });
  });

  it('handles errors gracefully', (done) => {
    const foundReturnValue = thingToTest.causeAsyncError((err) => {
      expect(foundReturnValue).to.equal(expectedReturnValue);
      expect(err instanceof Error).to.equal(true);
      expect(causeErrorStub.callCount).to.equal(1);
      done();
    });
  });

  it('additional properties are present on errors', (done) => {
    thingToTest.causeAsyncError((err) => {
      expect(err.stack).to.not.include('easy-fix/index.js');
      expect(err.otherProperty).to.eql('blah');
      done();
    });
  });

  it('works with mulitple calls', (done) => {
    const firstReturned = thingToTest.incStateAsync({
      val: 98
    }, (firstErr, stateAfterFirstInc) => {
      const secondReturned = thingToTest.incStateAsync({
        val: stateAfterFirstInc
      }, (secondErr, stateAfterSecondInc) => {
        expect(firstReturned).to.equal(expectedReturnValue);
        expect(secondReturned).to.equal(expectedReturnValue);
        expect(stateAfterSecondInc).to.equal(100);
        const expectedTargetState = expectTargetFnCalls ? 100 : 0;
        expect(thingToTest.state).to.equal(expectedTargetState);
        expect(asyncStub.callCount).to.equal(2);
        done();
      });
    });
  });

  it('handles circular references gracefully', (done) => {
    const testObj = { val: 0 };
    testObj.circ = testObj; // add circular reference
    thingToTest.incStateAsync(testObj, (err, state) => {
      expect(state).to.equal(1);
      const expectedTargetState = expectTargetFnCalls ? 1 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(asyncStub.callCount).to.equal(1);
      done();
    });
  });

  it('works with promises', (done) => {
    const testObj = { val: 49 };
    thingToTest.incStatePromise(testObj)
    .then((state) => {
      expect(state).to.equal(50);
      const expectedTargetState = expectTargetFnCalls ? 50 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(promiseStub.callCount).to.equal(1);
      done();
    })
    .catch(done);
  });

  it('handles promise rejection gracefully', (done) => {
    thingToTest.promiseThatRejects()
    .catch((err) => {
      let validationError;
      try {
        expect(err instanceof Error).to.equal(true);
        expect(promiseRejectStub.callCount).to.equal(1);
      } catch (caughtError) {
        validationError = caughtError;
      }
      done(validationError);
    });
  });

  it('handles a return value that does async work, like a stream', (done) => {
    const stringStream = thingToTest.streamSomething();
    const chunks = [];
    stringStream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    stringStream.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      expect(body).to.equal(expectedStreamingValue);
      done();
    });
  });

  it('attaches correct stack and metadata to error', () => {
    return thingToTest.promiseThatRejects()
    .catch((err) => {
      expect(err instanceof Error).to.equal(true);
      expect(promiseRejectStub.callCount).to.equal(1);
      expect(err.stack).to.not.include('easy-fix/index.js');
      expect(err.otherProperty).to.eql('blah');
    });
  });

};

// The call to incStateAsync includes a parameter (val)
// that sets the state, but that won't happen when the
// method is wrapped and called in reply mode.
// So we reset the state with resetState before each test.
beforeEach(() => { thingToTest.resetState(); });

const reverseSerializer = (args) => {
  const str = easyFix.stringifySafe(args, null, '');
  return Array.from(str).reverse().join('');
};

const reverseDeserializer = (str) => {
  const unreversed = Array.from(str).reverse().join('');
  const args = JSON.parse(unreversed, null, '');
  return args;
};

const setupMocks = (mode, useSerializers) => {
  beforeEach(() => {
    const options = {
      mode,
      sinon,
      dir: 'tmp'
    };
    if (useSerializers) {
      options.argumentSerializer = reverseSerializer;
      options.responseSerializer = reverseSerializer;
      options.returnValueSerializer = reverseSerializer;
      options.argumentDeserializer = reverseDeserializer;
      options.responseDeserializer = reverseDeserializer;
      options.returnValueDeserializer = reverseDeserializer;
    }
    asyncStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateAsync', options);
    promiseStub = easyFix.wrapAsyncMethod(thingToTest, 'incStatePromise', options);
    causeErrorStub = easyFix.wrapAsyncMethod(thingToTest, 'causeAsyncError', options);
    promiseRejectStub = easyFix.wrapAsyncMethod(thingToTest, 'promiseThatRejects', options);

    // a streaming return type requires some custom handling:
    streamStub = easyFix.wrapAsyncMethod(thingToTest, 'streamSomething',
      Object.assign({}, options, {
        returnValueSerializer: (stringStream, callback) => {
          const chunks = [];
          stringStream.on('data', (chunk) => {
            chunks.push(chunk);
          });
          stringStream.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            callback(body);
          });
        },
        returnValueDeserializer: (returnValue, returnValueAsyncCallbackArgs) => {
          const stringStream = new stream.PassThrough();
          stringStream.push(returnValueAsyncCallbackArgs[0]);
          stringStream.push(null);
          return stringStream;
        }
      })
    );
  });
};

afterEach(() => {
  asyncStub.restore();
  promiseStub.restore();
  causeErrorStub.restore();
  promiseRejectStub.restore();
  streamStub.restore();
});

describe('wrapAsyncMethod (live mode)', () => {
  setupMocks('live');
  runSharedTests(true);
});

describe('wrapAsyncMethod (capture mode)', () => {
  setupMocks('capture');
  runSharedTests(true);
});

describe('wrapAsyncMethod (capture mode) with custom serializers', () => {
  setupMocks('capture', true);
  runSharedTests(true);
});

describe('wrapAsyncMethod (replay mode)', () => {
  setupMocks('replay');
  runSharedTests(false);

  describe('if no matching mock data is found', () => {
    const fnWithoutMocks = (cb) => {
      thingToTest.incStateAsync({
        foo: 'bar'
      }, () => { cb(new Error('Failed to throw')); });
    };

    it('should throw an error with details about the expected data', (done) => {
      expect(() => fnWithoutMocks(done)).to.throw();
      done();
    });
  });
});

describe('wrapAsyncMethod (replay mode) with custom deserializers', () => {
  setupMocks('replay', true);
  runSharedTests(false);
});

