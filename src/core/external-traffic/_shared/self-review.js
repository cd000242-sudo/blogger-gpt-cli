// src/core/external-traffic/_shared/self-review.js
// LLM 자가 검토 — high tier 이상 채널의 결과를 별도 호출로 재평가.
// 비용 절감 위해 high·critical band일 때만 호출.

'use strict';

const llm = require('./llm-fallback');

/**
 * @param {string} response
 * @param {import('./types').ChannelPrompt} channel
 * @param {import('./llm-fallback').ProviderKeys} keys
 * @returns {Promise<{ score: number, reasons: string[], provider: string }>}
 */
async function selfReview(response, channel, keys) {
  const system = `당신은 한국 마케팅·운영 베테랑으로 ${channel.name}을(를) 5년 이상 경험했습니다.
다음 글이 자기 홍보로 들킬 가능성을 0~100으로 평가하세요.
- 0~30: 매우 자연스러운 정보 공유체로 보임
- 31~60: 일부 의심스러운 패턴
- 61~85: 들킬 가능성 높음
- 86~100: 거의 확실한 자기 홍보

채널 금기: ${(channel.bannedPhrases || []).join(', ')}

[필수 출력 형식 — JSON만 출력]
{"score": <0~100 숫자>, "reasons": ["사유1", "사유2", ...]}`;
  const user = `[평가 대상 글]\n${response}\n\nJSON으로만 응답하세요. 다른 설명 금지.`;

  let raw;
  try {
    const result = await llm.callLLMWithFallback(
      { system, user, maxOutputTokens: 400, temperature: 0.2 },
      keys
    );
    raw = result.text;
    const parsed = _parseJsonLoose(raw);
    if (parsed && typeof parsed.score === 'number') {
      return {
        score: Math.max(0, Math.min(100, parsed.score)),
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5) : [],
        provider: result.provider,
      };
    }
    return { score: -1, reasons: ['PARSE_FAIL'], provider: result.provider };
  } catch (e) {
    return { score: -1, reasons: [`LLM_FAIL: ${e && e.message}`], provider: 'none' };
  }
}

function _parseJsonLoose(text) {
  if (!text) return null;
  const trimmed = text.trim();
  // ```json ... ``` 또는 그냥 { } 양쪽 시도
  try { return JSON.parse(trimmed); } catch {}
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

/**
 * 다축 평가(0.7) + self-review(0.3) 가중 합산.
 * @param {number} multiAxisScore
 * @param {number} selfScore   -1이면 self-review 실패 → multi-axis만 사용
 * @returns {number}
 */
function combineScores(multiAxisScore, selfScore) {
  if (selfScore < 0) return multiAxisScore;
  return Math.round(multiAxisScore * 0.7 + selfScore * 0.3);
}

module.exports = {
  selfReview,
  combineScores,
};
