const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  moduleNameMapper: {
    '^@jibu/cache-utils$': '<rootDir>/libs/cache-utils/src/index.ts',
    '^@jibu/queue-definitions$': '<rootDir>/libs/queue-definitions/src/index.ts',
  },
};
