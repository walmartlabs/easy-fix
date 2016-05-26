/* globals describe, beforeEach, afterEach, it */

'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const easyFix = require('./index');

const thingToTest = {
  state: 0,
  incStateNextTick: (stateArg, callback) => {
    thingToTest.state = stateArg.val;
    process.nextTick(() => {
      thingToTest.state += 1;
      callback(null, thingToTest.state);
    });
  },
  incStateAfterThreeSeconds: (stateArg, callback) => {
    thingToTest.state = stateArg.val;
    setTimeout(() => {
      thingToTest.state += 1;
      callback(null, thingToTest.state);
    }, 3000);
  },
  resetState: () => {
    thingToTest.state = 0;
  }
};

let easyFixStub;
const runSharedTests = (expectTargetFnCalls) => {

  it('falls back onto wrapped method', function (done) {
    thingToTest.incStateNextTick({ val: 0 }, (err, state) => {
      expect(state).to.equal(1);
      const expectedTargetState = expectTargetFnCalls ? 1 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(easyFixStub.callCount).to.equal(1);
      done();
    });
  });

  it('works with mulitple calls', function (done) {
    thingToTest.incStateNextTick({ val: 0 }, (firstErr, firstState) => {
      thingToTest.incStateNextTick({ val: firstState }, (secondErr, secondState) => {
        expect(secondState).to.equal(2);
        const expectedTargetState = expectTargetFnCalls ? 2 : 0;
        expect(thingToTest.state).to.equal(expectedTargetState);
        expect(easyFixStub.callCount).to.equal(2);
        done();
      });
    });
  });

  it('works with circular references', function (done) {
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

describe('wrapAsyncMethod (live mode)', function () {
  beforeEach(() => {
    thingToTest.resetState();
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateNextTick', {
      mode: 'live',
      sinon: sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(true);
});

describe('wrapAsyncMethod (capture mode)', function () {
  beforeEach(() => {
    thingToTest.resetState();
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateNextTick', {
      mode: 'capture',
      sinon: sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(true);
});

describe('wrapAsyncMethod (replay mode)', function () {
  beforeEach(() => {
    thingToTest.resetState();
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateNextTick', {
      mode: 'replay',
      sinon: sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(false);
});
