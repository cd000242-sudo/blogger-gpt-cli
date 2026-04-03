/**
 * 🔍 팩트체크 모듈 — 할루시네이션 방지
 * 
 * 글 생성 전 키워드를 실시간 검색하여 팩트 기반 컨텍스트를 확보합니다.
 * 
 * 토글 옵션:
 * - 'grounding'  → Gemini Search Grounding (무료)
 * - 'perplexity' → Perplexity Sonar (유료, 더 정확)
 * - 'off'        → 팩트체크 비활성화
 * 
 * @module perplexityFactCheck
 */

import { loadEnvFromFile } from '../env';

export type FactCheckMode = 'grounding' | 'perplexity' | 'off';

export interface FactCheckResult {
  context: string;       // 팩트 기반 컨텍스트 (글 생성 프롬프트에 삽입)
  provider: string;      // 사용된 제공자
  success: boolean;
}

// ── 환경변수 캐시 ──
let _envCache: Record<string, string> | null = null;
let _envCacheTime = 0;

function getCachedEnv(): Record<string, string> {
  const now = Date.now();
  if (!_envCache || now - _envCacheTime > 30000) {
    _envCache = loadEnvFromFile();
    _envCacheTime = now;
  }
  return _envCache;
}

// ══════════════════════════════════════════════════════
// 🎯 PUBLIC API
// ══════════════════════════════════════════════════════

/**
 * 키워드에 대한 팩트 기반 컨텍스트를 수집합니다.
 * 
 * @param keyword - 블로그 키워드
 * @param mode - 팩트체크 모드 ('grounding' | 'perplexity' | 'off')
 * @returns 팩트 컨텍스트 (글 생성 프롬프트에 삽입할 텍스트)
 */
export async function fetchFactContext(
  keyword: string,
  mode: FactCheckMode = 'grounding',
): Promise<FactCheckResult> {
  if (mode === 'off' || !keyword.trim()) {
    return { context: '', provider: 'none', success: true };
  }

  const env = getCachedEnv();

  // ── Perplexity 모드 ──
  if (mode === 'perplexity') {
    const pplxKey = (env['perplexityKey'] || env['PERPLEXITY_API_KEY'] || '').trim();
    if (pplxKey && pplxKey.length >= 10) {
      try {
        const result = await callPerplexityFactCheck(pplxKey, keyword);
        if (result) {
          console.log(`[FACT-CHECK] ✅ Perplexity 팩트체크 완료 (${result.length}자)`);
          return { context: result, provider: 'Perplexity Sonar', success: true };
        }
      } catch (e: any) {
        console.log(`[FACT-CHECK] ⚠️ Perplexity 실패: ${e.message?.slice(0, 80)} → Grounding 폴백`);
      }
    } else {
      console.log(`[FACT-CHECK] ⚠️ Perplexity API 키 없음 → Grounding 폴백`);
    }
    // Perplexity 실패 → Grounding으로 폴백
    mode = 'grounding';
  }

  // ── Gemini Grounding 모드 ──
  if (mode === 'grounding') {
    const geminiKey = (env['geminiKey'] || env['GEMINI_API_KEY'] || '').trim();
    if (geminiKey && geminiKey.length >= 10) {
      try {
        const result = await callGeminiGroundingFactCheck(geminiKey, keyword);
        if (result) {
          console.log(`[FACT-CHECK] ✅ Gemini Grounding 팩트체크 완료 (${result.length}자)`);
          return { context: result, provider: 'Gemini Grounding', success: true };
        }
      } catch (e: any) {
        console.log(`[FACT-CHECK] ⚠️ Gemini Grounding 실패: ${e.message?.slice(0, 80)}`);
      }
    } else {
      console.log(`[FACT-CHECK] ⚠️ Gemini API 키 없음`);
    }
  }

  // 모두 실패
  console.log(`[FACT-CHECK] 📝 팩트체크 건너뜀 (API 연결 불가)`);
  return { context: '', provider: 'none', success: false };
}

/**
 * 팩트 컨텍스트를 글 생성 프롬프트에 삽입합니다.
 */
export function injectFactContext(originalPrompt: string, factContext: string): string {
  if (!factContext || factContext.trim().length < 10) return originalPrompt;

  return `${originalPrompt}

## 📚 팩트 기반 컨텍스트 (실시간 검색 결과 — 반드시 참고하여 정확하게 작성)
아래 내용은 실시간 웹 검색으로 확인된 최신 팩트입니다. 
이 정보를 기반으로 정확한 수치, 최신 동향, 검증된 정보만 포함하세요.
추측이나 불확실한 정보는 작성하지 마세요.

${factContext}

---
위 팩트를 참고하되, 블로그 글의 흐름에 자연스럽게 녹여 작성하세요.`;
}

// ══════════════════════════════════════════════════════
// 🔧 Internal
// ══════════════════════════════════════════════════════

const FACT_CHECK_PROMPT = (keyword: string) => `"${keyword}" 키워드에 대해 블로그 글을 작성하려고 합니다.
다음 정보를 500자 이내로 간결하게 정리해주세요:
1. 핵심 사실과 최신 동향 (2025-2026년 기준)
2. 관련 수치/통계 (있다면)
3. 일반적인 오해나 잘못된 정보 (있다면)
4. 신뢰할 수 있는 출처 기반 정보만 포함
한국어로 답변해주세요. 마크다운 형식은 사용하지 마세요.`;

async function callPerplexityFactCheck(apiKey: string, keyword: string): Promise<string | null> {
  const MODELS = ['sonar', 'sonar-pro'];
  let lastError: any = null;

  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '당신은 한국어 팩트체커입니다. 실시간 웹 검색을 통해 정확한 정보만 제공합니다.' },
            { role: 'user', content: FACT_CHECK_PROMPT(keyword) },
          ],
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 100)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content && content.length > 50) return content;
    } catch (e: any) {
      lastError = e;
      console.log(`[FACT-CHECK] ⚠️ Perplexity ${model} 실패: ${e.message?.slice(0, 60)}`);
    }
  }

  throw lastError || new Error('Perplexity 팩트체크 실패');
}

async function callGeminiGroundingFactCheck(apiKey: string, keyword: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: FACT_CHECK_PROMPT(keyword) }] }],
      tools: [{ googleSearchRetrieval: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini Grounding ${res.status}`);
  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  // Grounding 메타데이터 로깅
  const metadata = data.candidates?.[0]?.groundingMetadata;
  if (metadata?.webSearchQueries?.length) {
    console.log(`[FACT-CHECK] 🔍 Grounding 검색: ${metadata.webSearchQueries.join(', ')}`);
  }

  return content && content.length > 50 ? content : null;
}
