/**
 * 🔍 팩트체크 모듈 — 할루시네이션 방지
 *
 * 글 생성 전 키워드를 실시간 검색하여 팩트 기반 컨텍스트를 확보합니다.
 *
 * 토글 옵션:
 * - 'auto'       → 🔥 자동 선택 (네이버 > Perplexity > Gemini Grounding 순)
 * - 'naver'      → 네이버 블로그 검색 API (무료, 한국 콘텐츠 최강)
 * - 'perplexity' → Perplexity Sonar (유료, 더 정확)
 * - 'grounding'  → Gemini Search Grounding (무료)
 * - 'off'        → 팩트체크 비활성화
 *
 * @module perplexityFactCheck
 */

import { loadEnvFromFile } from '../env';

export type FactCheckMode = 'auto' | 'naver' | 'grounding' | 'perplexity' | 'off';

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
  mode: FactCheckMode = 'auto',
): Promise<FactCheckResult> {
  if (mode === 'off' || !keyword.trim()) {
    return { context: '', provider: 'none', success: true };
  }

  const env = getCachedEnv();
  const hasNaverKey = (
    ((env['naverClientId'] || env['NAVER_CLIENT_ID'] || env['naverCustomerId'] || '').trim().length >= 5) &&
    ((env['naverClientSecret'] || env['NAVER_CLIENT_SECRET'] || env['naverSecretKey'] || '').trim().length >= 5)
  );
  const hasPerplexityKey = ((env['perplexityKey'] || env['PERPLEXITY_API_KEY'] || '').trim().length >= 10);
  const hasGeminiKey = ((env['geminiKey'] || env['GEMINI_API_KEY'] || '').trim().length >= 10);

  // 🔥 'auto' 모드: 사용자가 가진 키에 따라 자동 선택
  //   1순위: 네이버 (무료 + 한국 콘텐츠 최강)
  //   2순위: Perplexity (유료, 가장 정확)
  //   3순위: Gemini Grounding (무료지만 429 이슈 있음)
  //   실패: 건너뜀 + 경고
  if (mode === 'auto') {
    if (hasNaverKey) {
      mode = 'naver';
      console.log('[FACT-CHECK] 🤖 auto → 네이버 블로그 검색 (무료, 한국 콘텐츠)');
    } else if (hasPerplexityKey) {
      mode = 'perplexity';
      console.log('[FACT-CHECK] 🤖 auto → Perplexity (유료, 정확)');
    } else if (hasGeminiKey) {
      mode = 'grounding';
      console.log('[FACT-CHECK] 🤖 auto → Gemini Grounding (무료)');
    } else {
      console.log('[FACT-CHECK] ⚠️ 네이버/Perplexity/Gemini 키 모두 없음 → 팩트체크 스킵');
      return { context: '', provider: 'none', success: false };
    }
  }

  // ── 네이버 블로그 검색 모드 ──
  if (mode === 'naver') {
    const naverClientId = (env['naverClientId'] || env['NAVER_CLIENT_ID'] || env['naverCustomerId'] || '').trim();
    const naverClientSecret = (env['naverClientSecret'] || env['NAVER_CLIENT_SECRET'] || env['naverSecretKey'] || '').trim();
    if (naverClientId && naverClientSecret) {
      try {
        const result = await callNaverFactCheck(naverClientId, naverClientSecret, keyword);
        if (result) {
          console.log(`[FACT-CHECK] ✅ 네이버 팩트체크 완료 (${result.length}자)`);
          return { context: result, provider: 'Naver Blog Search', success: true };
        }
      } catch (e: any) {
        console.log(`[FACT-CHECK] ⚠️ 네이버 실패: ${e.message?.slice(0, 80)} → Perplexity/Grounding 폴백`);
      }
    } else {
      console.log(`[FACT-CHECK] ⚠️ 네이버 API 키 없음 → Perplexity/Grounding 폴백`);
    }
    // 네이버 실패 → 다음 옵션으로 폴백
    if (hasPerplexityKey) {
      mode = 'perplexity';
    } else if (hasGeminiKey) {
      mode = 'grounding';
    } else {
      return { context: '', provider: 'none', success: false };
    }
  }

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

async function callGeminiGroundingFactCheck(_apiKey: string, keyword: string): Promise<string | null> {
  // 🔥 통합 디스패처 사용 — Gemini면 Grounding, 다른 엔진이면 일반 호출로 자동 폴백
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { callGeminiWithGrounding } = require('./final/gemini-engine');
  const result = await callGeminiWithGrounding(FACT_CHECK_PROMPT(keyword));
  const content = (typeof result === 'string' ? result : result?.text || '').trim();
  return content && content.length > 50 ? content : null;
}

/**
 * 네이버 블로그 검색 API로 팩트 컨텍스트 수집
 * - 무료 (일일 25,000회 한도)
 * - 한국어 콘텐츠에 최적화
 * - 실제 블로그 제목 + 요약(description)을 팩트 소스로 반환
 */
async function callNaverFactCheck(clientId: string, clientSecret: string, keyword: string): Promise<string | null> {
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=10&sort=sim`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Naver API ${res.status}: ${body.slice(0, 100)}`);
    }

    const data: any = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) return null;

    // HTML 태그 제거 후 실제 블로그 자료를 팩트 컨텍스트로 포맷
    const stripTags = (s: string) => String(s || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
    const lines: string[] = [];
    lines.push(`[네이버 블로그 실시간 검색 결과 — "${keyword}"]`);
    lines.push(`총 ${items.length}개 블로그 자료 수집됨. 아래 정보를 팩트 소스로 활용:`);
    lines.push('');

    items.slice(0, 10).forEach((it: any, i: number) => {
      const title = stripTags(it.title);
      const desc = stripTags(it.description);
      const bloggerName = it.bloggername || '';
      const postdate = it.postdate || '';
      if (title && desc) {
        lines.push(`${i + 1}. ${title}`);
        if (bloggerName) lines.push(`   작성자: ${bloggerName}${postdate ? ` · ${postdate}` : ''}`);
        lines.push(`   요약: ${desc.slice(0, 200)}`);
        lines.push('');
      }
    });

    const result = lines.join('\n').trim();
    return result.length > 50 ? result : null;
  } catch (e: any) {
    clearTimeout(timeoutId);
    throw e;
  }
}
