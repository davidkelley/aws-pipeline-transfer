module.exports = {
  moduleFileExtensions: ['js'],
  transform: {
    '\\.js$': 'babel-jest',
  },
  setupTestFrameworkScriptFile: '<rootDir>/__tests__/__utils__/setup.js',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
};
