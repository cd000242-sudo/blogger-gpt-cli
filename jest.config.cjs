module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '<rootDir>/test/external-traffic/unit/**/*.test.js',
    '<rootDir>/test/external-traffic/golden/**/*.test.js',
  ],
  modulePathIgnorePatterns: ['<rootDir>/backups/', '<rootDir>/dist/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    // src/ 내의 .js 대신 .ts를 강제 로드 (단, external-traffic는 JS 통일이라 예외)
    '^(.*)/src/(?!core/external-traffic/)(.*)\\.js$': '$1/src/$2.ts',
    '^(\\.\\./src/.*)$': '$1',
  },
  resolver: '<rootDir>/jest-resolver.cjs',
  clearMocks: true,
};
