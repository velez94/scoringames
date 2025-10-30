module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['**/*.js', '!**/node_modules/**', '!**/test/**'],
  testMatch: ['**/test/**/*.test.js']
};
