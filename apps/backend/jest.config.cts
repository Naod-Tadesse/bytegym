const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@org/backend',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Several @nestjs packages now ship ESM-only `dist/index.js`, and Jest does
  // not transform node_modules by default — so importing anything that reaches
  // them fails on `Unexpected token 'export'`. Transform those, leave the rest.
  transformIgnorePatterns: ['/node_modules/(?!(@nestjs)/)'],
  coverageDirectory: 'test-output/jest/coverage',
};
