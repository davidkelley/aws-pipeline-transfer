module.exports = {
  reporters: ['default', 'jest-junit'],
  moduleFileExtensions: ['js'],
  transform: {
    '\\.js$': 'babel-jest',
  },
  setupTestFrameworkScriptFile: '<rootDir>/__tests__/__utils__/setup.js',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
};
