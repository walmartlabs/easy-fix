'use strict';

/**
 * Gulpfile
 */
var gulpfileHelper = require('repo-standards').gulpfileHelper;
gulpfileHelper.init({
  lintEnv: 'es6',
  paths: {
    source: ['index.js', 'gulpfile.js'],
    test: {
      unit: ['tests.js']
    }
  }
});
