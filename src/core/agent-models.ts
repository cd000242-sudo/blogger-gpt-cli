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
 * ## 실측으로만 넣는다 (2026-09-10)
 * 목록에 있는 값은 전부 그 CLI 에 실제로 넣어 돌려 본 것이다. 추측으로 넣으면
 * 사장님이 고른 순간 "그런 모델 없다" 로 죽는다.
 *   claude  `--model claude-fable-5` / `claude-opus-5` 실행 성공 · 별칭 fable/opus/sonnet 은 --help 명시
 *   codex   `-m gpt-6-astra`(사장님 config 기본값) · `gpt-5.6-terra` · `gpt-5.6-sol` · `gpt-5.6-luna` 전부 수용
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
    { value: 'claude-fable-5', label: 'Fable 5', note: '가장 똑똑함 · 한도 소모 큼' },
    { value: 'claude-opus-5', label: 'Opus 5', note: '균형 · 페이블 한도 찼을 때' },
    { value: 'claude-sonnet-5', label: 'Sonnet 5', note: '빠르고 가벼움' },
  ],
  codex: [
    AGENT_MODEL_DEFAULT,
    { value: 'gpt-6-astra', label: 'GPT-6 Astra', note: '최신 · 가장 똑똑함' },
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
  const wanted = String(value ?? '').trim();
  if (!wanted) return '';
  return agentModelsFor(provider).some((m) => m.value === wanted) ? wanted : '';
}

/** 화면에 짧게 보일 이름 (배지용). 안 고른 상태면 빈 문자열 */
export function agentModelLabel(provider: string, value: unknown): string {
  const normalized = normalizeAgentModel(provider, value);
  if (!normalized) return '';
  return agentModelsFor(provider).find((m) => m.value === normalized)?.label || normalized;
}
