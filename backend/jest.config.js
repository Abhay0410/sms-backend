export default {
  testEnvironment: "node",
  transform: {},
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  moduleNameMapper: {
    // Maps imports like import ... from './file.js' to work cleanly in Jest
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  verbose: true,
};