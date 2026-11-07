/**
 * 🤖 에이전트 안에서 고를 수 있는 모델 (v3.8.714)
 *
 * 사장님: "에이전트 내에 모델선택이 가능하자나 페이블이나 오푸스 소넷 등등 그걸 선택할수있게해줘
 *          … api도 종류가 많은것처럼 모델이 다양하자나 코덱스도 이번에 아스트라나온것처럼"
 *
 * API 모델을 고르듯 **에이전트 안에서도** 모델을 고른다. 목록은 여기 한 곳에만 둔다 —
 * 화면(설정 카드·시작 게이트·비서 패널)과 메인(실행 인자)이 같은 표를 읽어야
 * "화면엔 있는데 안 먹는 모델" 이 안 생긴다.
 *
 * Claude IDs: https://platform.claude.com/docs/en/models/overview (2026-10-14).
 * 모델 추가를 검증하려고 사용자 비용이 드는 실행을 자동으로 하지 않는다.
 *   codex   `-m gpt-6-astra`(사장님 config 기본값) · `gpt-6.1-terra`(앱 기본) · `gpt-6.1-sol` · `gpt-6-luna` · `gpt-5.6-*` 전부 수용
 *           (이름은 로컬 Codex 모델 목록 캐시로 확인. gpt-5.5 는 목록에서 빠졌다)
 *   gemini  모델 이름을 확인하지 못했다 → 목록을 비우고 **에이전트 설정 그대로** 만 쓴다
 */

export interface AgentModelChoice {
  /** CLI 에 그대로 넘길 값. 빈 문자열이면 모델 인자를 안 붙인다(에이전트 설정 그대로) */
  value: string;
  /** 화면에 보일 이름 */
  label: string;
  /** 한 줄 설명 */
  note: string;
}

/** 모델을 고르지 않았을 때 — CLI 자체 설정(config)을 그대로 따른다 */
export const AGENT_MODEL_DEFAULT: AgentModelChoice = {
  value: '',
  label: '에이전트 설정 그대로',
  note: 'CLI 에 설정된 기본 모델을 씁니다',
};

export const AGENT_MODELS: Record<string, AgentModelChoice[]> = {
  claude: [
    AGENT_MODEL_DEFAULT,
    { value: 'claude-haiku-5-5', label: 'Haiku 5.5', note: '빠르고 가벼움 · 저비용' },
    { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5', note: '품질과 속도의 균형' },
    { value: 'claude-opus-5-5', label: 'Opus 5.5', note: '고급 추론 · 복잡한 작업' },
  ],
  codex: [
    AGENT_MODEL_DEFAULT,
    { value: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', note: '앱 기본 · 균형' },
    { value: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', note: '고품질' },
    { value: 'gpt-6-astra', label: 'GPT-6 Astra', note: '가장 똑똑함' },
    { value: 'gpt-6-luna', label: 'GPT-6 Luna', note: '빠르고 가벼움' },
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', note: '고품질' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', note: '균형' },
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', note: '빠르고 가벼움' },
  ],
  // 모델 이름을 실측으로 확인하기 전에는 넣지 않는다 — 없는 모델을 고르게 하면 그 자리에서 죽는다
  gemini: [AGENT_MODEL_DEFAULT],
};

/** 그 에이전트가 고를 수 있는 목록 (모르는 제공자면 기본값 하나) */
export function agentModelsFor(provider: string): AgentModelChoice[] {
  return AGENT_MODELS[String(provider || '').toLowerCase()] || [AGENT_MODEL_DEFAULT];
}

/**
 * 저장된 값이 아직 유효한가. 목록에서 사라진 모델(개편 등)이면 기본값으로 되돌린다 —
 * 없는 모델을 그대로 넘기면 실행이 죽는다.
 */
export function normalizeAgentModel(provider: string, value: unknown): string {
  let wanted = String(value ?? '').trim();
  if (!wanted) return '';
  // gpt-5.5 was retired from the Codex model list (2026-10-14). A saved choice moves to the app default.
  if (String(provider || '').toLowerCase() === 'codex' && wanted === 'gpt-5.5') return 'gpt-6.1-terra';
  if (String(provider || '').toLowerCase() === 'claude') {
    // An old removed model must not fall back to CLI defaults that may still be expensive.
    if (/^(?:claude-)?fable(?:-|$)/i.test(wanted)) return 'claude-sonnet-5-5';
    const alias = wanted.match(/^(?:claude-)?(haiku|sonnet|opus)(?:$|-\d)/i)?.[1]?.toLowerCase();
    if (alias) wanted = `claude-${alias}-5-5`;
  }
  return agentModelsFor(provider).some((m) => m.value === wanted) ? wanted : '';
}

/** 화면에 짧게 보일 이름 (배지용). 안 고른 상태면 빈 문자열 */
export function agentModelLabel(provider: string, value: unknown): string {
  const normalized = normalizeAgentModel(provider, value);
  if (!normalized) return '';
  return agentModelsFor(provider).find((m) => m.value === normalized)?.label || normalized;
}
