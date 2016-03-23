/* globals sinon */
'use strict';

require('repo-standards').exposeTestGlobals();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let sandbox = sinon.sandbox.create();

const modes = {
  live: 'live',
  capture: 'capture',
  replay: 'replay'
};

exports.restore = function () {
  if (sandbox) {
    sandbox.restore();
  }
  sandbox = sinon.sandbox.create();
};

exports.wrapAsyncMethod = function (obj, method, optionsArg) {
  sandbox = sandbox || sinon.sandbox.create();
  const originalFn = obj[method];
  const options = {};
  options.bucket = typeof optionsArg === 'string' ? optionsArg : optionsArg.bucket || 'test/data';
  options.mode = optionsArg.mode || modes[process.env.TEST_MODE || modes.replay];
  options.callbackSwap = optionsArg.callbackSwap || function (args, newCallback) {
    const origCallback = args[args.length - 1];
    args[args.length - 1] = newCallback;
    return origCallback;
  };
  options.argumentSerializer = optionsArg.argumentSerializer || function (args) {
    return JSON.stringify(args, null, '  ');
  };

  const stub = sinon.stub(obj, method, function () {
    const callingArgs = Array.apply(null, arguments);
    const self = this;

    if (options.mode === modes.live) { // no fixtures, no problems
      return originalFn.apply(self, callingArgs);
    }

    const argStr = options.argumentSerializer(callingArgs);
    const hashKey = crypto.createHash('sha256').update(argStr).digest('hex');
    const argPath = path.join(options.bucket, hashKey + '-args.json');
    const responsePath = path.join(options.bucket, hashKey + '-response.json');
    // REFACTOR: determine how to generate nicer file names.
    const origCallback = options.callbackSwap.apply(self, [callingArgs, function () {
      const callbackArgs = Array.apply(null, arguments);
      fs.writeFileSync(
        responsePath,
        JSON.stringify(callbackArgs, null, '  '));
      origCallback.apply(this, callbackArgs);
    }]);

    if (options.mode === modes.capture) {
      fs.writeFileSync(argPath, argStr);
      originalFn.apply(self, callingArgs);
      return;
    }

    // mode is replay
    const cannedResponse = fs.readFileSync(responsePath);
    const cannedJson = JSON.parse(cannedResponse);
    process.nextTick(() => {
      origCallback.apply(self, cannedJson);
    });
  });
  return stub;
};

