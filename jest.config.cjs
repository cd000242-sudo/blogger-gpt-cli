module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  /**
   * 🧯 v3.8.454 — 게이트가 노트북을 잡아먹지 않게 한다.
   *
   * 사용자 보고: "게이트 백그라운드 돌려서 릴리스까지할때 … 노트북이 엄청
   * 느려져서 아무것도 못하네". 이 머신은 논리 코어 16개라 Jest 기본값이
   * **워커 15개**를 띄웠고, ts-jest 컴파일러 15개가 동시에 돌며 CPU 를 통째로
   * 먹었다. 절반이면 게이트는 몇 분 느려질 뿐이지만 나머지 코어가 온전히
   * 사용자 몫으로 남는다.
   *
   * 부수 효과: schedule-manager-reentrancy 가 CPU 기아로 두 번 flaky 했는데
   * (격리 10초 통과 · 포화 상태에서 38~61초 실패) 경합이 줄어 안정된다.
   */
  maxWorkers: '50%',
  // ts-jest 워커가 오래 돌면 메모리를 계속 문다 — 1GB 넘긴 유휴 워커는 재시작
  workerIdleMemoryLimit: '1GB',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '<rootDir>/test/external-traffic/unit/**/*.test.js',
    '<rootDir>/test/external-traffic/golden/**/*.test.js',
  ],
  modulePathIgnorePatterns: ['<rootDir>/backups/', '<rootDir>/dist/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  /**
   * 🧠 v3.8.677 — 워커 하나가 1.9GB 를 물고 있었다 (--logHeapUsage 실측, 18개 스위트 전부 1,940MB 안팎).
   * ts-jest 가 파일마다 프로젝트 전체 타입 프로그램을 워커 안에 들고 검사하기 때문이다. 워커 3개면 6GB —
   * 사장님이 캡컷을 켠 채로 돌리자 exit 134 로 두 번 죽고 IDE 세션까지 재시작됐다.
   * 타입 검사는 게이트 전에 `tsc --noEmit` 이 따로 한다. 여기서는 변환만 한다(isolatedModules).
   */
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, diagnostics: false }],
  },
  moduleNameMapper: {
    // src/ 내의 .js 대신 .ts를 강제 로드 (단, external-traffic는 JS 통일이라 예외)
    '^(.*)/src/(?!core/external-traffic/)(.*)\\.js$': '$1/src/$2.ts',
    '^(\\.\\./src/.*)$': '$1',
  },
  resolver: '<rootDir>/jest-resolver.cjs',
  clearMocks: true,
};
