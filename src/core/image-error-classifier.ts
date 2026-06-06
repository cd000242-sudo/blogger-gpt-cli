/**
 * 🛡️ S-4 (v3.5.84): 이미지 엔진 통합 에러 분류기
 *
 * 모든 이미지 엔진(Flow, ImageFX, Nano Banana 2, DeepInfra)의 에러를
 * 통일된 카테고리로 분류하고, 각 카테고리에 맞는 우회 전략 적용 결정.
 *
 * 사용자 의도 (사용자 발언 인용):
 *   "에러를 명확하게 인식하고, 할당량이면 할당량에 가로막혔다,
 *    아니면 지역차단이 걸렸다 이런걸 우회시켜서 가능하게끔 해야되는게 정답"
 *   "무한으로 대기하면서 실패한걸 또시도하고 하지말고"
 *
 * 분류 결과:
 *   - bypassable: 자동 우회 (재시도 + cooldown 또는 갱신)
 *   - unrecoverable: 즉시 fail-fast (사용자 알림)
 *   - usable_after_cooldown: 짧은 대기 후 재시도
 */

export type ImageErrorCategory =
  | 'auth_token_expired'      // HTTP 401 — 토큰 자동 갱신 (bypassable)
  | 'rate_limit'              // HTTP 429 — exponential backoff (bypassable, 30s+)
  | 'quota_daily_exceeded'    // 일일 할당량 — 다음 날까지 대기 (unrecoverable in session)
  | 'server_overload'         // HTTP 503 — exponential backoff 1-2회 (bypassable)
  | 'server_internal'         // HTTP 500 — 짧은 대기 1회 (bypassable)
  | 'server_timeout'          // HTTP 504 — 프롬프트 트림 후 1회 (bypassable)
  | 'safety_filter'           // safety/blocked/policy — 프롬프트 순화 후 재시도 (bypassable)
  | 'permission_denied'       // 403, Pro 미가입, 계정 정지 (unrecoverable)
  | 'billing_required'        // FAILED_PRECONDITION (unrecoverable)
  | 'region_blocked'          // 지역 차단 (unrecoverable)
  | 'recaptcha_blocked'       // reCAPTCHA 감지 — 5분 cooldown (usable_after_cooldown)
  | 'model_not_found'         // 404 — 모델 ID 오류 (다른 모델 시도)
  | 'invalid_request'         // 400 INVALID_ARGUMENT — 코드 버그 (unrecoverable)
  | 'network_error'           // ECONNREFUSED, ETIMEDOUT — 짧은 대기 (bypassable)
  | 'unknown';                // 분류 실패

export interface ImageErrorClassification {
  category: ImageErrorCategory;
  bypassable: boolean;
  recommendedAction: 'retry_immediately' | 'retry_after_cooldown' | 'sanitize_prompt' | 'refresh_token' | 'fail_fast';
  cooldownMs: number; // 0이면 즉시 재시도, 0보다 크면 그만큼 대기
  userMessage: string; // 한국어 사용자 안내 메시지 (UI 표시용)
  shouldShowDialog: boolean; // 다이얼로그로 사용자 결정 받을지 여부
}

/**
 * 에러 메시지/코드를 분석하여 카테고리 분류 + 우회 전략 결정
 */
export function classifyImageError(rawError: unknown): ImageErrorClassification {
  const errMsg = (() => {
    if (!rawError) return '';
    if (typeof rawError === 'string') return rawError;
    if (typeof rawError === 'object' && 'message' in (rawError as any)) {
      return String((rawError as any).message || '');
    }
    return String(rawError);
  })();

  const lower = errMsg.toLowerCase();

  if (/reported\s+as\s+leaked|api\s*key.*leaked|key.*compromised|leaked\s+api\s*key/i.test(errMsg)) {
    return {
      category: 'permission_denied',
      bypassable: false,
      recommendedAction: 'fail_fast',
      cooldownMs: 0,
      userMessage: 'Gemini API 키가 유출/차단 상태로 보고되었습니다. Google AI Studio에서 새 API 키를 발급해 저장한 뒤 다시 시도해주세요.',
      shouldShowDialog: true,
    };
  }

  if (/api\s*key\s*(missing|not\s*set|required|empty|없음)|api\s*키\s*없음|키\s*없음|api.*키.*없음/i.test(errMsg)) {
    return {
      category: 'permission_denied',
      bypassable: false,
      recommendedAction: 'fail_fast',
      cooldownMs: 0,
      userMessage: '이미지 엔진 API 키가 저장되어 있지 않습니다. 환경 설정에서 해당 엔진의 API 키를 저장한 뒤 다시 시도해주세요.',
      shouldShowDialog: true,
    };
  }

  // ── unrecoverable: 사용자 결정/조치 필요 ──

  // PERMISSION_DENIED — Pro 미가입, API 키 권한 없음, 계정 정지
  if (/permission_denied|403\b|forbidden|consumer\s*suspended|does\s*not\s*have\s*permission/i.test(errMsg)) {
    return {
      category: 'permission_denied',
      bypassable: false,
      recommendedAction: 'fail_fast',
      cooldownMs: 0,
      userMessage: '권한 없음 — Google AI Pro 미가입 또는 API 키 권한 부족. 다른 엔진으로 변경하시거나 구독을 확인해주세요.',
      shouldShowDialog: true,
    };
  }

  // BILLING — FAILED_PRECONDITION
  if (/failed_precondition|billing.*not.*enabled|billing[_\s-]*required/i.test(errMsg)) {
    return {
      category: 'billing_required',
      bypassable: false,
      recommendedAction: 'fail_fast',
      cooldownMs: 0,
      userMessage: '빌링 미활성화 — Google Cloud 결제 정보를 활성화해주세요. (https://aistudio.google.com/plan_billing)',
      shouldShowDialog: true,
    };
  }

  // 지역 차단
  if (/region.*block|geo.*restrict|country.*not.*supported|location.*not.*available/i.test(errMsg)) {
    return {
      category: 'region_blocked',
      bypassable: false,
      recommendedAction: 'fail_fast',
      cooldownMs: 0,
      userMessage: '지역 차단 — 현재 지역에서 사용 불가. ImageFX 또는 다른 엔진을 사용해주세요.',
      shouldShowDialog: true,
    };
  }

  // 모델 없음 (NOT_FOUND)
  if (/not_found|404\b|model.*not.*found/i.test(errMsg)) {
    return {
      category: 'model_not_found',
      bypassable: false,
      recommendedAction: 'fail_fast',
      cooldownMs: 0,
      userMessage: '모델을 찾을 수 없습니다 — 다른 엔진을 시도하거나 모델 ID를 확인해주세요.',
      shouldShowDialog: false,
    };
  }

  // 잘못된 요청 (INVALID_ARGUMENT, 코드 버그)
  if (/invalid_argument|400\b/i.test(errMsg) && !/safety|policy/i.test(errMsg)) {
    return {
      category: 'invalid_request',
      bypassable: false,
      recommendedAction: 'fail_fast',
      cooldownMs: 0,
      userMessage: '요청 형식 오류 — 코드 버그 가능성. 개발자에게 문의해주세요.',
      shouldShowDialog: true,
    };
  }

  // ── usable_after_cooldown: 시간 두고 재시도 ──

  // reCAPTCHA — 5분 cooldown
  if (/recaptcha|public_error_unusual_activity|flow_blocked|flow_recaptcha/i.test(errMsg)) {
    return {
      category: 'recaptcha_blocked',
      bypassable: true,
      recommendedAction: 'retry_after_cooldown',
      cooldownMs: 5 * 60 * 1000,
      userMessage: 'reCAPTCHA 감지 — 5분 후 자동 재시도합니다. (자동화 패턴 회피 중)',
      shouldShowDialog: false,
    };
  }

  // FLOW_COOLDOWN — 이미 cooldown 중
  if (/flow_cooldown/i.test(errMsg)) {
    const remainingMatch = errMsg.match(/(\d+)초/);
    const remainingSec = remainingMatch ? parseInt(remainingMatch[1]!) : 60;
    return {
      category: 'recaptcha_blocked',
      bypassable: true,
      recommendedAction: 'retry_after_cooldown',
      cooldownMs: remainingSec * 1000,
      userMessage: `Flow 쿨다운 중 — ${remainingSec}초 후 자동 재시도`,
      shouldShowDialog: false,
    };
  }

  // 일일 할당량 초과 (Pro 50장/일 등)
  if (/quota.*exceeded|flow_quota_exceeded|daily.*limit|일일.*할당량/i.test(errMsg)) {
    return {
      category: 'quota_daily_exceeded',
      bypassable: false,
      recommendedAction: 'fail_fast',
      cooldownMs: 24 * 60 * 60 * 1000,
      userMessage: '일일 할당량 초과 — 자정(PT 기준) 이후 재시도하거나 다른 엔진을 사용해주세요.',
      shouldShowDialog: true,
    };
  }

  // ── bypassable: 자동 우회 ──

  // RATE LIMIT (분당) — exponential backoff
  if (/rate.*limit|too.*many.*requests|429\b|resource_exhausted/i.test(errMsg)) {
    return {
      category: 'rate_limit',
      bypassable: true,
      recommendedAction: 'retry_after_cooldown',
      cooldownMs: 30 * 1000, // 30초
      userMessage: '요청 빈도 초과 — 30초 후 자동 재시도',
      shouldShowDialog: false,
    };
  }

  // 토큰 만료
  if (/http_401|401\b|unauthorized|token.*expired|invalid.*token/i.test(errMsg)) {
    return {
      category: 'auth_token_expired',
      bypassable: true,
      recommendedAction: 'refresh_token',
      cooldownMs: 2000, // 2초 (페이지 로드 여유)
      userMessage: '인증 토큰 만료 — 자동 갱신 중...',
      shouldShowDialog: false,
    };
  }

  // 서버 과부하
  if (/http_503|503\b|unavailable|overloaded|service.*unavailable/i.test(errMsg)) {
    return {
      category: 'server_overload',
      bypassable: true,
      recommendedAction: 'retry_after_cooldown',
      cooldownMs: 5000,
      userMessage: '서버 과부하 — 5초 후 자동 재시도',
      shouldShowDialog: false,
    };
  }

  // 서버 내부 에러
  if (/http_500|500\b|internal.*error/i.test(errMsg)) {
    return {
      category: 'server_internal',
      bypassable: true,
      recommendedAction: 'retry_after_cooldown',
      cooldownMs: 3000,
      userMessage: '서버 내부 오류 — 3초 후 자동 재시도',
      shouldShowDialog: false,
    };
  }

  // 타임아웃
  if (/http_504|504\b|deadline_exceeded|deadline.*expired|timeout/i.test(errMsg)) {
    return {
      category: 'server_timeout',
      bypassable: true,
      recommendedAction: 'retry_after_cooldown',
      cooldownMs: 5000,
      userMessage: '서버 응답 지연 — 5초 후 자동 재시도',
      shouldShowDialog: false,
    };
  }

  // 안전 필터
  if (/safety|blocked|policy|content.*filter/i.test(errMsg)) {
    return {
      category: 'safety_filter',
      bypassable: true,
      recommendedAction: 'sanitize_prompt',
      cooldownMs: 0,
      userMessage: '안전 필터 감지 — 프롬프트 자동 순화 후 재시도',
      shouldShowDialog: false,
    };
  }

  // 네트워크 에러
  if (/econnrefused|enotfound|etimedout|network|fetch.*failed/i.test(errMsg)) {
    return {
      category: 'network_error',
      bypassable: true,
      recommendedAction: 'retry_after_cooldown',
      cooldownMs: 3000,
      userMessage: '네트워크 오류 — 3초 후 자동 재시도',
      shouldShowDialog: false,
    };
  }

  // 분류 실패
  return {
    category: 'unknown',
    bypassable: false,
    recommendedAction: 'fail_fast',
    cooldownMs: 0,
    userMessage: `알 수 없는 오류: ${errMsg.substring(0, 200)}`,
    shouldShowDialog: true,
  };
}

/**
 * 카테고리별 한국어 라벨 (UI 다이얼로그 헤더용)
 */
export function categoryLabel(c: ImageErrorCategory): string {
  const labels: Record<ImageErrorCategory, string> = {
    auth_token_expired: '🔑 인증 만료',
    rate_limit: '⏳ 요청 빈도 초과',
    quota_daily_exceeded: '📊 일일 할당량 초과',
    server_overload: '🔥 서버 과부하',
    server_internal: '⚠️ 서버 오류',
    server_timeout: '⌛ 응답 지연',
    safety_filter: '🛡️ 안전 필터',
    permission_denied: '🚫 권한 없음',
    billing_required: '💳 빌링 필요',
    region_blocked: '🌏 지역 차단',
    recaptcha_blocked: '🤖 reCAPTCHA 감지',
    model_not_found: '❓ 모델 없음',
    invalid_request: '❌ 요청 오류',
    network_error: '📡 네트워크 오류',
    unknown: '❓ 알 수 없음',
  };
  return labels[c] || '❓ 알 수 없음';
}
