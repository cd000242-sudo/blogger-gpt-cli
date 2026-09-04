/**
 * 🎯 어느 엔진으로 부를지 정하는 한 곳 (v3.8.628)
 *
 * ## 왜 뺐나
 * 사장님: "비평 개선버튼 누르면 openapi 만 반응하고 다른 api를 선택하면 안되네?"
 *
 * 글 생성(orchestration)은 payload 에서 사용자가 고른 엔진을 읽어
 * `process.env.PRIMARY_TEXT_MODEL` 에 심고 부른다. 그런데 **비평은 그 단계를
 * 통째로 건너뛰었다.** 그래서 화면에서 무엇을 골라도 직전에 남아 있던 값이나
 * 기본값으로 갔다 — 사장님 눈에는 "OpenAI 만 반응" 으로 보였다.
 *
 * 규칙을 복사해 붙이면 또 어긋난다. 이 저장소는 이미 그 사고를 겪었다
 * (화면 모델 라벨표를 손으로 베껴 두어 3.6 을 골라도 3.5 로 뜨던 건).
 * 그래서 **정하는 규칙은 여기 하나뿐**이고, 생성도 비평도 이 함수를 부른다.
 *
 * ## 우선순위 (기존 orchestration 의 것을 그대로 옮겼다)
 *   1) payload.provider — 포스팅 탭 드롭다운. 사용자가 방금 고른 것이라 가장 세다.
 *      단, 함께 온 모델값이 그 provider 의 것이면 그 구체 모델을 쓴다.
 *   2) payload.primaryGeminiTextModel — provider 없이 모델만 온 경우(모달 라디오)
 *   3) 저장된 설정값 — 둘 다 없을 때. 예전에는 이 갈래가 없어 설정을 무시하고
 *      Gemini 로 갔다(v3.8.446 에서 메움).
 */

/** provider 만 왔을 때 쓸 대표 모델 */
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  openai: 'openai-gpt41',
  claude: 'claude-sonnet',
  perplexity: 'perplexity-sonar',
  gemini: 'gemini-3.5-flash',
};

/** 함께 온 모델값이 그 provider 의 것이 맞는가 */
function belongsToProvider(provider: string, modelValue: string): boolean {
  const v = String(modelValue || '');
  if (!v) return false;
  switch (provider) {
    case 'gemini': return v.startsWith('gemini-');
    case 'openai': return v.startsWith('openai-') || v.startsWith('gpt-') || /^o\d/i.test(v);
    case 'claude': return v.startsWith('claude-');
    case 'perplexity': return v.startsWith('perplexity-');
    default: return false;
  }
}

export interface EngineChoice {
  /** PRIMARY_TEXT_MODEL 에 심을 값 */
  modelValue: string;
  /** 어느 갈래로 정해졌는가 — 로그와 테스트가 읽는다 */
  source: 'provider' | 'model' | 'setting' | 'existing';
  /** 사람이 읽을 한 줄 */
  reason: string;
}

export interface EnginePayload {
  provider?: string;
  primaryGeminiTextModel?: string;
}

/**
 * 무엇으로 부를지 정한다. **환경을 건드리지 않는다** — 정하기만 한다.
 * 심는 것은 applyEngineChoice 가 한다(되돌릴 수 있게).
 */
export function chooseTextModel(
  payload: EnginePayload | undefined,
  options: { currentEnv?: string; resolveDefault?: () => string } = {},
): EngineChoice {
  const provider = String(payload?.provider || '');
  const modelValue = String(payload?.primaryGeminiTextModel || '');

  if (provider && PROVIDER_DEFAULT_MODEL[provider]) {
    const picked = belongsToProvider(provider, modelValue) ? modelValue : PROVIDER_DEFAULT_MODEL[provider]!;
    return { modelValue: picked, source: 'provider', reason: `${provider} → ${picked}` };
  }

  if (modelValue) {
    return { modelValue, source: 'model', reason: `모델 직접 지정: ${modelValue}` };
  }

  const existing = String(options.currentEnv || '');
  if (existing) {
    return { modelValue: existing, source: 'existing', reason: `이미 정해진 값 유지: ${existing}` };
  }

  const fallback = options.resolveDefault
    ? options.resolveDefault()
    : require('../llm/pricing').resolveDefaultTierValue();
  return { modelValue: String(fallback), source: 'setting', reason: `설정값: ${fallback}` };
}

/**
 * 고른 모델을 환경에 심고, **되돌리는 함수**를 준다.
 *
 * 비평처럼 잠깐 부르고 마는 경로가 전역 환경을 바꿔 놓으면, 그다음 발행이
 * 엉뚱한 모델로 나간다. 반드시 되돌린다.
 */
export function applyEngineChoice(choice: EngineChoice): () => void {
  const before = process.env['PRIMARY_TEXT_MODEL'];
  process.env['PRIMARY_TEXT_MODEL'] = choice.modelValue;
  return () => {
    if (before === undefined) delete process.env['PRIMARY_TEXT_MODEL'];
    else process.env['PRIMARY_TEXT_MODEL'] = before;
  };
}
