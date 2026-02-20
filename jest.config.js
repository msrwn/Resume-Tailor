module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared', '<rootDir>/main'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@main/(.*)$': '<rootDir>/main/$1',
  },
  collectCoverageFrom: [
    'shared/**/*.ts',
    'main/**/*.ts',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
};
