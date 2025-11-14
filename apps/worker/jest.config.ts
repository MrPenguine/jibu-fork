/* eslint-disable */
export default {
  displayName: 'worker',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: '.',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^@jibu/cache-utils$': '<rootDir>/../../libs/cache-utils/src/index.ts',
    '^@jibu/queue-definitions$': '<rootDir>/../../libs/queue-definitions/src/index.ts',
  },
  coverageDirectory: '../../coverage/apps/worker',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
};
