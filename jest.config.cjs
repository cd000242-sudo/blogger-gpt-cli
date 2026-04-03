module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/backups/', '<rootDir>/dist/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    // src/ 내의 .js 대신 .ts를 강제 로드
    '^(.*)/src/(.*)\\.js$': '$1/src/$2.ts',
    '^(\\.\\./src/.*)$': '$1',
  },
  resolver: '<rootDir>/jest-resolver.cjs',
  clearMocks: true,
};
