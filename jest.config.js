module.exports = {
  roots: ['<rootDir>'],
  testEnvironment: "node",
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverage: true,
  clearMocks: true,
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['node_modules', 'examples'],
  fakeTimers: { enableGlobally: true },
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  testPathIgnorePatterns: [
    "<rootDir>/lib/",
    "/node_modules/"
  ]
}
