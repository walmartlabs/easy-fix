/* globals describe, beforeEach, afterEach, it */
'use strict';

const sinon = require('sinon');
const domain = require('domain');
const expect = require('chai').expect;
const easyFix = require('./index');

const ASYNC_DELAY = 1000;
const expectedReturnValue = 'I am a function return value';
const thingToTest = {
  state: 0,
  incStateNextTick: (stateArg, callback) => {
    thingToTest.state = stateArg.val;
    process.nextTick(() => {
      thingToTest.state += 1;
      callback(null, thingToTest.state);
    });
    return expectedReturnValue;
  },
  incStateAfterThreeSeconds: (stateArg, callback) => {
    thingToTest.state = stateArg.val;
    setTimeout(() => {
      thingToTest.state += 1;
      callback(null, thingToTest.state);
    }, ASYNC_DELAY);
    return expectedReturnValue;
  },
  resetState: () => {
    thingToTest.state = 0;
  }
};

let easyFixStub;
const runSharedTests = (expectTargetFnCalls) => {

  it('falls back onto wrapped method', (done) => {
    const foundReturnValue = thingToTest.incStateNextTick({ val: 0 }, (err, state) => {
      expect(foundReturnValue).to.equal(expectedReturnValue);
      expect(state).to.equal(1);
      const expectedTargetState = expectTargetFnCalls ? 1 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(easyFixStub.callCount).to.equal(1);
      done();
    });
  });

  it('works with mulitple calls', (done) => {
    const firstReturned = thingToTest.incStateNextTick({ val: 0 }, (firstErr, firstState) => {
      const secondReturned = thingToTest.incStateNextTick({
        val: firstState
      }, (secondErr, secondState) => {
        expect(firstReturned).to.equal(expectedReturnValue);
        expect(secondReturned).to.equal(expectedReturnValue);
        expect(secondState).to.equal(2);
        const expectedTargetState = expectTargetFnCalls ? 2 : 0;
        expect(thingToTest.state).to.equal(expectedTargetState);
        expect(easyFixStub.callCount).to.equal(2);
        done();
      });
    });
  });

  it('works with circular references', (done) => {
    const testObj = { val: 0 };
    testObj.circ = testObj;
    thingToTest.incStateNextTick(testObj, (err, state) => {
      expect(state).to.equal(1);
      const expectedTargetState = expectTargetFnCalls ? 1 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(easyFixStub.callCount).to.equal(1);
      done();
    });
  });
};

describe('wrapAsyncMethod (live mode)', () => {
  beforeEach(() => {
    thingToTest.resetState();
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateNextTick', {
      mode: 'live',
      sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(true);
});

describe('wrapAsyncMethod (capture mode)', () => {
  beforeEach(() => {
    thingToTest.resetState();
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateNextTick', {
      mode: 'capture',
      sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(true);
});

describe('wrapAsyncMethod (replay mode)', () => {
  const STUBBED_METHOD = 'incStateNextTick';

  beforeEach(() => {
    thingToTest.resetState();
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, STUBBED_METHOD, {
      mode: 'replay',
      sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(false);

  describe('if no matching mock data is found', () => {
    const fnWithoutMocks = (cb) => {
      thingToTest[STUBBED_METHOD]({
        foo: 'bar'
      }, () => { cb(new Error('Failed to throw')); });
    };

    it('should throw an error with details about the expected data', (done) => {
      expect(() => fnWithoutMocks(done)).to.throw();
      done();
    });
  });
});
