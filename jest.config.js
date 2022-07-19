module.exports = {
  roots: ['<rootDir>'],
  testEnvironment: "node",
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.ts?$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverage: true,
  clearMocks: true,
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['node_modules', 'examples'],
  fakeTimers: { enableGlobally: true },
}
