/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ['<rootDir>/src'],
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
  collectCoverageFrom: ['src/utils/*.ts'],
  coverageReporters: ['lcov', 'text', 'html'],
};