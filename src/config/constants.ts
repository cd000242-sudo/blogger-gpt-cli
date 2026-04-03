/**
 * 전역 상수 정의
 * 매직 넘버를 한 곳에서 관리
 */

// ─── 타임아웃 ────────────────────────────────────
export const TIMEOUT_MS = 15_000;
export const URL_FETCH_TIMEOUT_MS = 10_000;
export const SESSION_VALIDATION_INTERVAL_MS = 5 * 60 * 1000;
export const OFFLINE_GRACE_PERIOD_MS = 30 * 60 * 1000;
export const BROWSER_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// ─── 콘텐츠 ──────────────────────────────────────
export const MAX_CONTENT_LENGTH = 3_000;
export const MAX_CONTENT_SIZE = 500_000;
export const MAX_OUTPUT_TOKENS = 8_000;
export const MAX_OUTPUT_TOKENS_TITLE = 500;
export const MAX_TITLE_LENGTH = 30;
export const MIN_TITLE_LENGTH = 5;

// ─── 이미지 ──────────────────────────────────────
export const IMAGE_COMPRESSION_LEVEL = 9;
export const IMAGE_QUALITY = 90;
export const THUMBNAIL_WIDTH = 1200;
export const THUMBNAIL_HEIGHT = 630;

// ─── 브라우저 풀 ─────────────────────────────────
export const MAX_BROWSER_INSTANCES = 3;

// ─── API / 캐싱 ──────────────────────────────────
export const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
export const API_RATE_LIMIT_GENERAL = 60;   // 분당
export const API_RATE_LIMIT_ADMIN = 10;     // 분당

// ─── 로깅 ────────────────────────────────────────
export const MAX_LOG_ENTRIES = 1_000;

// ─── 재시도 ──────────────────────────────────────
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 1_000;
export const DEFAULT_BACKOFF_MULTIPLIER = 2;

// ─── 라이선스 ────────────────────────────────────
export const LICENSE_APP_ID = 'com.ridernam.blogger.automation';
export const BCRYPT_SALT_ROUNDS = 12;
