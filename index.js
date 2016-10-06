'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const modes = {
  live: 'live',
  capture: 'capture',
  replay: 'replay'
};

const HASH_LENGTH = 12;

const NICE_ERR_HEADER = 'This test (in replay mode) could not read the expected mock data from'; // eslint-disable-line max-len
const NICE_ERR_SERIALIZATION_DESCRIPTOR = 'Serialized arguments';
const NICE_ERR_FOOTER = 'If you have not already, try running this test in capture mode to generate new test fixtures.  If you continue to see this error, a likely cause is differing (frequently changing) argument for the wrapped asynchronous task.  This can be mitigated by defining an argumentSerializer option that ignores the frequently-changing argument.'; // eslint-disable-line max-len

const getNiceError = (file, details) => {
  return `${NICE_ERR_HEADER} "${file}"\n\n${NICE_ERR_SERIALIZATION_DESCRIPTOR}:\n${details}\n\n${NICE_ERR_FOOTER}`; // eslint-disable-line max-len
};

/**
 * Safe JSON Serializer will not fail in the face of circular references
 * Derived heavily from @isaacs ISC Licensed json-stringify-safe repo
 * https://github.com/isaacs/json-stringify-safe/blob/master/stringify.js
 * @param {?function} replacer to transform serialized values
 * @param {?function} cycleReplacer to transform cyclical values
 * @returns {string} serialized value of the object
 */
const stringifySafeSerializer = (replacer, cycleReplacer) => {
  const stack = [];
  const keys = [];

  if (!cycleReplacer) {
    cycleReplacer = (key, value) => {
      if (stack[0] === value) {
        return '[Circular ~]';
      }
      return `[Circular ~.${keys.slice(0, stack.indexOf(value)).join('.')}]`;
    };
  }

  return function (key, value) {
    if (stack.length > 0) {
      const thisPos = stack.indexOf(this);
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
      if (~stack.indexOf(value)) {
        value = cycleReplacer.call(this, key, value);
      }
    } else {
      stack.push(value);
    }

    return replacer ? replacer.call(this, key, value) : value;
  };
};

const stringifySafe = (obj, replacer, spaces, cycleReplacer) => {
  return JSON.stringify(obj, stringifySafeSerializer(replacer, cycleReplacer), spaces);
};

exports.wrapAsyncMethod = function (obj, method, optionsArg) {
  const originalFn = obj[method];
  const options = {};
  options.dir = typeof optionsArg === 'string' ? optionsArg : optionsArg.dir || 'test/data';
  options.prefix = optionsArg.prefix || method;
  options.mode = optionsArg.mode || modes[process.env.TEST_MODE || modes.replay];
  options.callbackSwap = optionsArg.callbackSwap || function (args, newCallback) {
    const origCallback = args[args.length - 1];
    args[args.length - 1] = newCallback;
    return origCallback;
  };
  options.argumentSerializer = optionsArg.argumentSerializer || function (args) {
    return stringifySafe(args, null, '  ');
  };
  options.responseSerializer = optionsArg.responseSerializer || function (args) {
    return stringifySafe(args, null, '  ');
  };
  options.responsePath = optionsArg.responsePath;
  options.sinon = optionsArg.sinon;

  const wrapper = function () {
    const callingArgs = Array.apply(null, arguments);
    const self = this;

    if (options.mode === modes.live) { // no fixtures, no problems
      return originalFn.apply(self, callingArgs);
    }

    const argStr = options.argumentSerializer(callingArgs);
    const hashKey = crypto.createHash('sha256').update(argStr).digest('hex').slice(0, HASH_LENGTH);
    const basePath = path.join(options.dir, `${options.prefix}-${hashKey}`);
    const argPath = `${basePath}-args.json`;
    const responsePath = options.responsePath || `${basePath}-response.json`;
    // REFACTOR: determine how to generate nicer file names.
    const origCallback = options.callbackSwap.apply(self, [callingArgs, function () {
      const callbackArgs = Array.apply(null, arguments);
      fs.writeFileSync(
        responsePath,
        options.responseSerializer(callbackArgs) + os.EOL,
        'utf8');
      origCallback.apply(this, callbackArgs);
    }]);

    if (options.mode === modes.capture) {
      fs.writeFileSync(
        argPath,
        argStr + os.EOL,
        'utf8');
      originalFn.apply(self, callingArgs);
      return null;
    }

    // mode is replay
    fs.readFile(responsePath, (err, cannedResponse) => {
      if (err) {
        if (err.code === 'ENOENT') {
          throw new Error(getNiceError(responsePath, argStr));
        }
        throw err;
      }
      const cannedJson = JSON.parse(cannedResponse);
      origCallback.apply(self, cannedJson);
    });
  };

  if (options.sinon) {
    return options.sinon.stub(obj, method, wrapper);
  }
  obj[method] = wrapper;
  wrapper.restore = function () {
    obj[method] = originalFn;
  };
  return wrapper;
};

