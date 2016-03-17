/* globals sinon */
'use strict';

require('repo-standards').exposeTestGlobals();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const captureDir = 'test/data';

const modes = {
  live: 'live',
  capture: 'capture',
  replay: 'replay'
};
const mode = modes[process.env.TEST_MODE || modes.replay];

exports.wrapAsyncMethod = function (obj, method, bucket) {
  const originalFn = obj[method];

  const stub = sinon.stub(obj, method, function () {
    const callingArgs = Array.apply(null, arguments);
    const self = this;

    if (mode === modes.live) { // no fixtures, no problems
      return originalFn.apply(self, callingArgs);
    }

    const argStr = JSON.stringify(callingArgs, null, '  ');
    const hashKey = crypto.createHash('sha256').update(argStr).digest('hex');
    const argPath = path.join(captureDir, bucket, hashKey + '-args.json');
    const responsePath = path.join(captureDir, bucket, hashKey + '-response.json');
    // REFACTOR: determine how to generate nicer file names.
    const callback = callingArgs[callingArgs.length - 1];
    if (mode === modes.capture) {
      fs.writeFileSync(argPath, argStr);
      callingArgs[callingArgs.length - 1] = function () {
        const callbackArgs = Array.apply(null, arguments);
        fs.writeFileSync(
          responsePath,
          JSON.stringify(callbackArgs, null, '  '));
        callback.apply(self, callbackArgs);
      };
      originalFn.apply(self, callingArgs);
      return;
    }

    // mode is replay
    const cannedResponse = fs.readFileSync(responsePath);
    const cannedJson = JSON.parse(cannedResponse);
    process.nextTick(() => {
      callback.apply(self, cannedJson);
    });
  });
  return stub;
};

