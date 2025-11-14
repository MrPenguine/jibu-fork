/* eslint-disable */
export default {
  displayName: 'cache-utils',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: '.',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^@jibu/queue-definitions$': '<rootDir>/../../libs/queue-definitions/src/index.ts',
  },
  coverageDirectory: '../../coverage/libs/cache-utils',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
