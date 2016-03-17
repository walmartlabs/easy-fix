/* globals describe, it */
'use strict';
require('repo-standards').exposeTestGlobals();
let easyFix = require('./index');

const thingToTest = {
  state: 0,
  incStateNextTick: (callback) => {
    process.nextTick(() => {
      thingToTest.state += 1;
      callback();
    });
  }
};

describe('wrapAsyncMethod', function () {
  it('has a function wrapAsyncMethod', function () {
    easyFix.wrapAsyncMethod(thingToTest, 'incStateNextTick');
  });
});
