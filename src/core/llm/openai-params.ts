/**
 * 🔧 OpenAI 모델별 파라미터 규칙 — 한 곳에서만 정한다 (v3.8.714)
 *
 * 사장님 실측 화면: "블로그 발행 실패 … Unsupported parameter: 'max_tokens' is not
 * supported with this model. Use 'max_completion_tokens' instead. (model=gpt-6-astra)"
 *
 * ## 왜 났나
 * 예전 규칙이 `/^gpt-5/` 하나였다. 그래서 **gpt-6-astra** 는 옛 모델 취급을 받아
 * `max_tokens` 와 `temperature` 를 함께 보냈고, 두 파라미터 다 거부당해 400 이 났다.
 * 같은 규칙이 llm-caller 와 openai 두 파일에 **따로** 적혀 있어서 한쪽만 고치면 또 어긋난다.
 *
 * ## 실측 (2026-09-10, gpt-6-astra 로 직접 호출)
 *   max_tokens             → HTTP 400 "Use 'max_completion_tokens' instead"
 *   max_completion_tokens  → HTTP 200 ✅
 *   temperature: 0.45      → HTTP 400 "Only the default (1) value is supported"
 *   reasoning_effort       → HTTP 200 ✅
 *
 * 새 모델이 나와도 이름만 늘리면 되게, 판정은 **세대 번호**로 한다.
 */

/**
 * 이 모델이 새 파라미터 규칙을 쓰는가.
 * gpt-5·gpt-6… 이후 세대와 o 시리즈(추론 모델)가 여기 해당한다.
 */
export function isModernOpenAiModel(model: unknown): boolean {
  const name = String(model || '').trim().toLowerCase();
  if (!name) return false;
  // gpt-5, gpt-5.6-terra, gpt-6-astra, gpt-10-… / o1, o3-mini …
  return /^gpt-([5-9]|\d{2,})(\D|$)/.test(name) || /^o[1-9]/.test(name);
}

/** reasoning_effort 를 받아 주는 모델인가 (실측: gpt-5.6, gpt-6 계열 모두 200) */
export function supportsReasoningEffort(model: unknown): boolean {
  return isModernOpenAiModel(model);
}

/**
 * 요청 본문에 토큰·온도 파라미터를 **모델에 맞게** 올린다.
 * 새 모델: max_completion_tokens 만. temperature 는 아예 넣지 않는다(기본값 1 외 거부).
 * 옛 모델: max_tokens + temperature (지금까지 하던 그대로).
 */
export function applyOpenAiTokenParams(
  body: Record<string, unknown>,
  model: string,
  maxTokens: number,
  temperature: number,
  opts: { reasoningEffort?: string } = {},
): Record<string, unknown> {
  if (isModernOpenAiModel(model)) {
    body['max_completion_tokens'] = maxTokens;
    delete body['max_tokens'];
    delete body['temperature'];
    if (opts.reasoningEffort && supportsReasoningEffort(model)) {
      body['reasoning_effort'] = opts.reasoningEffort;
    }
  } else {
    body['max_tokens'] = maxTokens;
    body['temperature'] = temperature;
  }
  return body;
}
