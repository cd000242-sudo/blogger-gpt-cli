// 빠른 반복 개발용 jest 설정 (v3.8.376 R0)
//
// jest.config.cjs 는 건드리지 않는다 — 전체 검증(릴리스 게이트)은 그쪽이 기준이다.
// 이 설정은 "고치는 중에 30초 안에 결과를 보는" 용도다.
//
// 느린 원인 2가지를 제거한다:
//   1) ts-jest 타입체크 → isolatedModules + diagnostics:false (타입은 npx tsc --noEmit 로 따로 본다)
//   2) imageDispatcher 계열이 실제 백오프를 기다림 (전체 19분 중 12분 이상을 이 2개가 차지)
const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, diagnostics: false }],
  },
  // 주의: 이 키를 지정하는 순간 jest 기본값(node_modules)이 '대체'되므로 반드시 함께 명시한다.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/backups/',
    '<rootDir>/dist/',
    '<rootDir>/__tests__/imageDispatcher\\.test\\.ts$',
    '<rootDir>/__tests__/imageDispatcher\\.resilience\\.test\\.ts$',
  ],
};
