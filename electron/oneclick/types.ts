// electron/oneclick/types.ts
// 원클릭 세팅 모듈 — 공유 타입 정의

// Playwright는 런타임에 동적 로딩되므로 type-only import
// 설치되지 않은 환경에서도 컴파일 가능하도록 조건부 타입 처리
type PlaywrightBrowser = import('playwright').Browser;
type PlaywrightPage = import('playwright').Page;

// ───────────────────────────────────────
// 공통 타입
// ───────────────────────────────────────

export type StepStatus = 'idle' | 'running' | 'waiting-login' | 'done' | 'error';

export interface BrowserConfig {
  viewport?: { width: number; height: number };
  userAgent?: string;
}

// ───────────────────────────────────────
// 상태 인터페이스
// ───────────────────────────────────────

export interface BaseState {
  stepStatus: StepStatus;
  message: string;
  completed: boolean;
  cancelled: boolean;
  error: string | null;
  browser: PlaywrightBrowser | null;
  page: PlaywrightPage | null;
}

export interface SetupState extends BaseState {
  platform: string;
  currentStep: number;
  totalSteps: number;
  /** 각 step 결과를 개별 기록 — 부분 실패 시 재시도 기준점으로 사용 */
  stepResults?: Array<{ index: number; label: string; ok: boolean; message: string }>;
  /** 재시작 시 이 step부터 재실행 (undefined이면 처음부터) */
  resumeFromStep?: number;
}

export interface WebmasterState extends BaseState {
  engine: string;
  blogUrl: string;
  results: Record<string, boolean> | null;
}

export interface ConnectState extends BaseState {
  platform: string;
  results: Record<string, string> | null;
}

export interface InfraState extends BaseState {
  currentStep: number;
  totalSteps: number;
}
