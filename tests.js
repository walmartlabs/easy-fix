/* globals describe, beforeEach, afterEach, it */
'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const easyFix = require('./index');

const ASYNC_DELAY = 1000;

function createThingToTest() {
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
          }, ASYNC_DELAY);
      },
      resetState: () => {
          thingToTest.state = 0;
      }
    };

    return thingToTest;
}

function wrapThing(mode, thing) {
    const easyFixStub = easyFix.wrapAsyncMethod(thing, 'incStateNextTick', {
      mode: mode,
      sinon,
      dir: 'tmp'
    });

    return easyFixStub;
}

function createPromiseGiverToTest() {
  const thingToTest = {
  state: 0,
  incStateNextTick: (stateArg) => {
      return new Promise(function(resolve, reject) {
        thingToTest.state = stateArg.val;
        process.nextTick(() => {
          thingToTest.state += 1;
          resolve(thingToTest.state);
        });
      });
    },
    resetState: () => {
      thingToTest.state = 0;
    }
  };

  return thingToTest;
}

function wrapPromiseGiver(mode, thing) {
    const easyFixStub = easyFix.wrapAsyncMethod(thing, 'incStateNextTick', {
      mode: mode,
      isPromise: true,
      sinon,
      dir: 'tmp'
    });

    return easyFixStub;
}


const runSharedTests = (expectTargetFnCalls,mode) => {

  it('falls back onto wrapped method', (done) => {
    const thingToTest = createThingToTest(); 
    const easyFixStub = wrapThing(mode, thingToTest);

    thingToTest.incStateNextTick({ val: 0 }, (err, state) => {
      expect(state).to.equal(1);
      const expectedTargetState = expectTargetFnCalls ? 1 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(easyFixStub.callCount).to.equal(1);
      done();
    });
  });

  it('works with mulitple calls', (done) => {
    const thingToTest = createThingToTest(); 
    const easyFixStub = wrapThing(mode, thingToTest);

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

  it('works with circular references', (done) => {
    const thingToTest = createThingToTest(); 
    const easyFixStub = wrapThing(mode, thingToTest);

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

const runSharedPromiseTests = (expectTargetFnCalls, mode) => {
  
  it('falls back onto wrapped method', (done) => {
    const thingToTest = createPromiseGiverToTest(); 
    const easyFixStub = wrapPromiseGiver(mode, thingToTest);

    const incPromise = thingToTest.incStateNextTick({ val: 0 });
    incPromise.then((state) => {
      expect(state).to.equal(1);
      const expectedTargetState = expectTargetFnCalls ? 1 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(easyFixStub.callCount).to.equal(1);
      done();
    });
  });

  it('works with mulitple calls', (done) => {
    const thingToTest = createPromiseGiverToTest(); 
    const easyFixStub = wrapPromiseGiver(mode, thingToTest);


    thingToTest.incStateNextTick({ val: 0 }).then((firstState) => {
      thingToTest.incStateNextTick({ val: firstState }).then((secondState) => {
        expect(secondState).to.equal(2);
        const expectedTargetState = expectTargetFnCalls ? 2 : 0;
        expect(thingToTest.state).to.equal(expectedTargetState);
        expect(easyFixStub.callCount).to.equal(2);
        done();
      });
    });
  });

  it('works with circular references', (done) => {
    const thingToTest = createPromiseGiverToTest(); 
    const easyFixStub = wrapPromiseGiver(mode, thingToTest);

    const testObj = { val: 0 };
    testObj.circ = testObj;
    thingToTest.incStateNextTick(testObj).then((state) => {
      expect(state).to.equal(1);
      const expectedTargetState = expectTargetFnCalls ? 1 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(easyFixStub.callCount).to.equal(1);
      done();
    });
  });

};

describe('wrapAsyncMethod (live mode)', () => {
  runSharedTests(true, 'live');
});

describe('wrapAsyncMethod (capture mode)', () => {
  runSharedTests(true, 'capture');
});

describe('wrapAsyncMethod (replay mode)', () => {
  runSharedTests(false, 'replay');
});

describe('wrapAsyncMethod (promises in live mode)', () => {
  runSharedPromiseTests(true, 'live');
});

describe('wrapAsyncMethod (promises in capture mode)', () => {
  runSharedPromiseTests(true, 'capture');
});

describe('wrapAsyncMethod (promises in replay mode)', () => {
  runSharedPromiseTests(false, 'replay');
});
