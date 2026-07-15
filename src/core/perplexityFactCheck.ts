/**
 * 🔍 팩트체크 모듈 — 할루시네이션 방지
 *
 * 글 생성 전 키워드를 실시간 검색하여 팩트 기반 컨텍스트를 확보합니다.
 *
 * 토글 옵션:
 * - 'auto'       → 🔥 자동 선택 (Perplexity > Gemini Grounding > Naver 순)
 * - 'naver'      → 네이버 블로그 검색 API (무료, 한국 콘텐츠 최강)
 * - 'perplexity' → Perplexity Sonar (유료, 더 정확)
 * - 'grounding'  → Gemini Search Grounding (무료)
 * - 'off'        → 팩트체크 비활성화
 *
 * @module perplexityFactCheck
 */

import { loadEnvFromFile } from '../env';
import type { FactTrustLevel } from './final/fact-integrity';

export type FactCheckMode = 'auto' | 'naver' | 'grounding' | 'perplexity' | 'off';

export interface FactCheckResult {
  context: string;       // 팩트 기반 컨텍스트 (글 생성 프롬프트에 삽입)
  provider: string;      // 사용된 제공자
  success: boolean;
  trustLevel: FactTrustLevel;
  sourceUrls?: string[];
}

export function getFactCheckProviderPriority(availability: {
  perplexity: boolean;
  grounding: boolean;
  naver: boolean;
}): Array<'perplexity' | 'grounding' | 'naver'> {
  const priority: Array<'perplexity' | 'grounding' | 'naver'> = [];
  if (availability.perplexity) priority.push('perplexity');
  if (availability.grounding) priority.push('grounding');
  if (availability.naver) priority.push('naver');
  return priority;
}

export interface FactCheckReferenceTime {
  currentYear: number;
  nextYear: number;
  currentDateIso: string;
  currentDateKo: string;
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

export function getFactCheckReferenceTime(now: Date = new Date()): FactCheckReferenceTime {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value || String(now.getFullYear());
  const month = parts.find((p) => p.type === 'month')?.value || String(now.getMonth() + 1).padStart(2, '0');
  const day = parts.find((p) => p.type === 'day')?.value || String(now.getDate()).padStart(2, '0');
  const currentYear = Number(year);

  return {
    currentYear,
    nextYear: currentYear + 1,
    currentDateIso: `${year}-${month}-${day}`,
    currentDateKo: `${currentYear}년 ${Number(month)}월 ${Number(day)}일`,
  };
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
    return { context: '', provider: 'none', success: true, trustLevel: 'none' };
  }

  const env = getCachedEnv();
  const hasNaverKey = (
    ((env['naverClientId'] || env['NAVER_CLIENT_ID'] || env['naverCustomerId'] || '').trim().length >= 5) &&
    ((env['naverClientSecret'] || env['NAVER_CLIENT_SECRET'] || env['naverSecretKey'] || '').trim().length >= 5)
  );
  const hasPerplexityKey = ((env['perplexityKey'] || env['PERPLEXITY_API_KEY'] || '').trim().length >= 10);
  const hasGeminiKey = ((env['geminiKey'] || env['GEMINI_API_KEY'] || '').trim().length >= 10);

  if (mode === 'auto') {
    const priority = getFactCheckProviderPriority({
      perplexity: hasPerplexityKey,
      grounding: hasGeminiKey,
      naver: hasNaverKey,
    });
    const selected = priority[0];
    if (!selected) {
      console.log('[FACT-CHECK] ⚠️ 네이버/Perplexity/Gemini 키 모두 없음 → 팩트체크 스킵');
      return { context: '', provider: 'none', success: false, trustLevel: 'none' };
    }
    mode = selected;
    console.log(`[FACT-CHECK] auto → ${selected} (priority: ${priority.join(' > ')})`);
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
          return { context: result, provider: 'Naver Blog Search', success: true, trustLevel: 'weak' };
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
      return { context: '', provider: 'none', success: false, trustLevel: 'none' };
    }
  }

  // ── Perplexity 모드 ──
  if (mode === 'perplexity') {
    const pplxKey = (env['perplexityKey'] || env['PERPLEXITY_API_KEY'] || '').trim();
    if (pplxKey && pplxKey.length >= 10) {
      try {
        const result = await callPerplexityFactCheck(pplxKey, keyword);
        if (result?.context && result.sourceUrls.length > 0) {
          console.log(`[FACT-CHECK] ✅ Perplexity 팩트체크 완료 (${result.context.length}자, sources=${result.sourceUrls.length})`);
          return {
            context: result.context,
            provider: 'Perplexity Sonar',
            success: true,
            trustLevel: result.sourceUrls.length > 0 ? 'strong' : 'weak',
            sourceUrls: result.sourceUrls,
          };
        }
        if (result?.context) {
          console.log('[FACT-CHECK] ⚠️ Perplexity 응답에 출처 URL이 없어 Gemini Grounding으로 재검증합니다.');
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
        if (result?.context && result.sourceUrls.length > 0) {
          console.log(`[FACT-CHECK] ✅ Gemini Grounding 팩트체크 완료 (${result.context.length}자, sources=${result.sourceUrls.length})`);
          return {
            context: result.context,
            provider: 'Gemini Grounding',
            success: true,
            trustLevel: result.sourceUrls.length > 0 ? 'strong' : 'weak',
            sourceUrls: result.sourceUrls,
          };
        }
        if (result?.context) {
          console.log('[FACT-CHECK] ⚠️ Gemini Grounding 응답에 출처 URL이 없어 팩트 장부로 사용하지 않습니다.');
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
  return { context: '', provider: 'none', success: false, trustLevel: 'none' };
}

/**
 * 팩트 컨텍스트를 글 생성 프롬프트에 삽입합니다.
 */
export function injectFactContext(originalPrompt: string, factContext: string): string {
  if (!factContext || factContext.trim().length < 10) return originalPrompt;
  const ref = getFactCheckReferenceTime();

  return `${originalPrompt}

## 📚 팩트 기반 컨텍스트 (실시간 검색 결과 — ${ref.currentDateKo} 현재 기준)
아래 내용은 ${ref.currentDateKo} 현재 실시간 웹 검색으로 확인된 최신 팩트입니다.
출처 URL가 확인된 근거에 있는 정확한 수치, 최신 동향, 검증된 정보만 포함하세요.
정책·지원금·신청기간·가격·모델명처럼 시점이 중요한 정보는 반드시 ${ref.currentYear}년 최신 기준으로 판단하세요.
근거에 없는 수치·날짜·조건·기관명·URL은 조합하거나 추측하지 말고, 공식 안내 확인이 필요하다고 작성하세요.

${factContext}

---
위 팩트를 참고하되, 블로그 글의 흐름에 자연스럽게 녹여 작성하세요.`;
}

// ══════════════════════════════════════════════════════
// 🔧 Internal
// ══════════════════════════════════════════════════════

export const buildFactCheckPrompt = (keyword: string, now: Date = new Date()): string => {
  const ref = getFactCheckReferenceTime(now);
  return `"${keyword}" 키워드에 대해 블로그 글을 작성하려고 합니다.
현재 날짜는 ${ref.currentDateKo}(${ref.currentDateIso})입니다.
반드시 이 날짜를 기준으로 최신 정보를 확인하고, 오래된 ${ref.currentYear - 1}년 이하 자료가 현재와 다르면 현재 기준으로 교정해주세요.
다음 정보를 500자 이내로 간결하게 정리해주세요:
1. 핵심 사실과 최신 동향 (${ref.currentDateKo} 현재, ${ref.currentYear}년 최신 기준)
2. 관련 수치/통계/신청기간/마감일/조건 (있다면)
3. 일반적인 오해나 오래된 정보와 현재 기준의 차이 (있다면)
4. 신뢰할 수 있는 출처 기반 정보만 포함
5. 각 사실은 출처 URL에 실제로 확인되는 내용만 기록하고, 서로 다른 출처의 수치나 조건을 임의로 조합하지 말 것
한국어로 답변해주세요. 마크다운 형식은 사용하지 마세요.`;
};

export function buildLatestNaverFactQuery(keyword: string, now: Date = new Date()): string {
  const ref = getFactCheckReferenceTime(now);
  const compact = keyword.replace(/\s+/g, ' ').trim();
  const hasCurrentYear = new RegExp(`(^|\\D)${ref.currentYear}(\\D|$)`).test(compact);
  const hasNextYear = new RegExp(`(^|\\D)${ref.nextYear}(\\D|$)`).test(compact);
  const freshnessTerms = hasCurrentYear || hasNextYear ? '최신 변경사항 공식' : `${ref.currentYear} 최신 변경사항 공식`;
  return `${compact} ${freshnessTerms}`.trim();
}

async function callPerplexityFactCheck(apiKey: string, keyword: string): Promise<{ context: string; sourceUrls: string[] } | null> {
  const MODELS = ['sonar-pro', 'sonar'];
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
            { role: 'system', content: `당신은 한국어 팩트체커입니다. 현재 날짜는 ${getFactCheckReferenceTime().currentDateKo}입니다. 실시간 웹 검색을 통해 현재 기준 최신 정보만 제공합니다. 각 수치·날짜·조건·기관명은 실제 인용 URL에 있는 경우에만 기록하고, 확인되지 않은 사실이나 출처를 만들지 마세요.` },
            { role: 'user', content: buildFactCheckPrompt(keyword) },
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
      const sourceUrls = Array.from(new Set([
        ...(Array.isArray(data.citations) ? data.citations : []),
        ...(Array.isArray(data.search_results) ? data.search_results.map((item: any) => item?.url) : []),
      ].filter((url: unknown) => typeof url === 'string' && /^https?:\/\//i.test(url))));
      if (content && content.length > 50) {
        const sourceBlock = sourceUrls.length > 0
          ? `\n\n[Verified source URLs]\n${sourceUrls.map((url) => `- ${url}`).join('\n')}`
          : '';
        return { context: `${content}${sourceBlock}`, sourceUrls };
      }
    } catch (e: any) {
      lastError = e;
      console.log(`[FACT-CHECK] ⚠️ Perplexity ${model} 실패: ${e.message?.slice(0, 60)}`);
    }
  }

  throw lastError || new Error('Perplexity 팩트체크 실패');
}

async function callGeminiGroundingFactCheck(_apiKey: string, keyword: string): Promise<{ context: string; sourceUrls: string[] } | null> {
  // 🔥 통합 디스패처 사용 — Gemini면 Grounding, 다른 엔진이면 일반 호출로 자동 폴백
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { callGeminiWithGrounding } = require('./final/gemini-engine');
  let sourceUrls: string[] = [];
  const result = await callGeminiWithGrounding(buildFactCheckPrompt(keyword), 1, true, (urls: string[]) => {
    sourceUrls = urls;
  });
  const content = (typeof result === 'string' ? result : result?.text || '').trim();
  if (!content || content.length <= 50) return null;
  const sourceBlock = sourceUrls.length > 0
    ? `\n\n[Verified source URLs]\n${sourceUrls.map((url) => `- ${url}`).join('\n')}`
    : '';
  return { context: `${content}${sourceBlock}`, sourceUrls };
}

/**
 * 네이버 블로그 검색 API로 팩트 컨텍스트 수집
 * - 무료 (일일 25,000회 한도)
 * - 한국어 콘텐츠에 최적화
 * - 실제 블로그 제목 + 요약(description)을 팩트 소스로 반환
 */
async function callNaverFactCheck(clientId: string, clientSecret: string, keyword: string): Promise<string | null> {
  const ref = getFactCheckReferenceTime();
  const query = buildLatestNaverFactQuery(keyword);
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=10&sort=date`;
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
    lines.push(`[네이버 블로그 최신순 검색 결과 — "${query}"]`);
    lines.push(`기준일: ${ref.currentDateKo} (${ref.currentYear}년 최신 기준)`);
    lines.push(`총 ${items.length}개 블로그 자료 수집됨. 최신순 자료이지만, 정책·지원금·신청기간은 공식 출처와 교차 확인이 필요한 팩트 소스로 활용:`);
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
