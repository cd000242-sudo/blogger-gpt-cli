/**
 * 🧭 스마트 CTA 라우터 — AI 가 "어디로 갈지"를 정한다 (v3.8.538)
 *
 * 사장님 요구: "토지글뿐만아니야 어떤글이던지 cta를 제대로 가져오고 그걸
 * 스마트하게 소제목이나 본문 상황에맞게 그사이트로 가게끔. 이걸 api로
 * 스마트하게못하냐고."
 *
 * ## 역할 분담 — 사고가 안 나는 경계선
 *   · AI(이 모듈): 글의 키워드+본문 맥락을 읽고 **기관/사이트 "이름"과 행동**만 정한다.
 *   · 기존 파이프(CSE 검색 → validateCtaUrl → 하이브리드 검증): 그 이름으로
 *     **실제 살아있는 주소**를 찾고 검증한다.
 *   AI 가 URL 을 직접 뱉게 하면 그럴듯한 죽은 링크를 지어낸다 — 그래서 이름까지만.
 *   (같은 원칙: 딥링크를 코드에 박지 않는다 · CTA 는 살아있는 것만 나간다)
 *
 * ## 실패 = 조용한 후퇴
 *   타임아웃(15초)·파싱 실패·낮은 확신 → null → 기존 경로(행동 의도 정규식 +
 *   카탈로그) 그대로. 발행은 절대 막히지 않고, 비용 상한은 발행당 소형 1콜이다.
 *
 * 배경 사고: "토지거래허가" 글 CTA 가 중고나라로 (v3.8.537) — 정규식·카탈로그
 * 방식은 분야마다 두더지 잡기가 된다. 목적지 결정을 언어 이해로 올린다.
 */

import { callGeminiWithRetry } from '../core/final/gemini-engine';

export interface SmartCtaTarget {
  /** 기관/사이트 이름 — URL 이 아니다 (예: "토지이음", "정부24", "홈택스") */
  site: string;
  /** 독자의 다음 행동 (예: "토지이용계획 조회") */
  action: string;
  /** 버튼 문구 (이모지 없이 — 붙이는 건 호출자) */
  buttonLabel: string;
  /** 기존 CSE 파이프에 넣을 검색어 */
  searchQuery: string;
}

const CACHE = new Map<string, { value: SmartCtaTarget | null; expireAt: number }>();
const TTL_MS = 30 * 60 * 1000;

/** 테스트용 — 캐시를 비운다 */
export function clearSmartCtaCache(): void {
  CACHE.clear();
}

function extractJson(text: string): any | null {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/** 이름 자리에 URL·도메인이 섞여 오면 통째로 불신한다 — 날조 방어선 */
function looksLikeUrl(s: string): boolean {
  return /https?:\/\/|www\.|\.(kr|com|net|org|go|or)\b|\//i.test(s);
}

function cleanText(s: unknown, maxLen: number): string {
  return String(s ?? '').replace(/\s+/g, ' ').replace(/["'`]/g, '').trim().slice(0, maxLen);
}

export async function resolveSmartCtaTarget(input: {
  keyword: string;
  contentMode?: string;
  /** 본문/소제목 요약 — 글이 실제로 다루는 상황을 반영한다 */
  articleHint?: string;
}): Promise<SmartCtaTarget | null> {
  const keyword = String(input.keyword || '').trim();
  if (!keyword) return null;
  // 쇼핑모드는 전용 구매 CTA 로직이 이미 있다 — 여기 끼어들면 상품 링크가 기관으로 바뀐다
  if (String(input.contentMode || '') === 'shopping') return null;

  const cacheKey = keyword.toLowerCase();
  const hit = CACHE.get(cacheKey);
  if (hit && hit.expireAt > Date.now()) return hit.value;

  const hint = cleanText(input.articleHint, 1200);
  const prompt = `한국 블로그 글의 CTA(행동 버튼) 목적지를 정하는 작업이다.

글 키워드: "${keyword}"
${hint ? `글 내용 요약(소제목 포함):\n${hint}\n` : ''}
이 글을 읽은 독자가 바로 다음에 할 행동 1개와, 그 행동을 하는 **대한민국의 공식/대표 사이트 이름**을 정하라.

규칙 (어기면 전체 무효):
1. URL·도메인·주소를 절대 쓰지 마라. 사이트의 **이름만** 쓴다 (예: 토지이음, 정부24, 홈택스, 복지로, 국민건강보험공단).
2. 실존을 확신하는 곳만 말하라. 확신이 없으면 site 에 "없음"이라고 써라 — 지어내는 것이 최악이다.
3. 공공·공식 기관을 우선하라. 특정 사기업은 그 글이 그 회사 이야기일 때만.
4. buttonLabel 은 "○○에서 △△" 꼴 20자 이내, 이모지 금지.
5. 이 글의 실제 내용에 맞춰라 — 키워드 단어 하나에 낚이지 마라 (예: "토지거래허가"는 중고거래가 아니라 토지 행정이다).

JSON 만 출력:
{"site":"기관명","action":"행동(15자 이내)","buttonLabel":"버튼 문구","confidence":0.0~1.0}`;

  let value: SmartCtaTarget | null = null;
  try {
    // v3.8.536 의 짧은 타임아웃 옵션 재사용 — CTA 하나에 본문급 예산을 쓰지 않는다
    const raw = await callGeminiWithRetry(prompt, 1, { timeoutMs: 15_000 });
    const json = extractJson(raw);
    const site = cleanText(json?.site, 30);
    const action = cleanText(json?.action, 20);
    const buttonLabel = cleanText(json?.buttonLabel, 22);
    const confidence = Number(json?.confidence);

    const invalid = !site
      || site === '없음'
      || looksLikeUrl(site)
      || looksLikeUrl(buttonLabel)
      || !(confidence >= 0.6);
    if (!invalid) {
      value = {
        site,
        action: action || '공식 확인',
        buttonLabel: buttonLabel || `${site} 바로가기`,
        searchQuery: action ? `${site} ${action}` : `${site} 공식 사이트`,
      };
      console.log(`[SMART-CTA] 🧭 목적지: ${site} / ${action} (확신 ${confidence})`);
    } else {
      console.log(`[SMART-CTA] 후보 기각 (site="${site}", confidence=${confidence}) — 기존 경로로`);
    }
  } catch (e: any) {
    // 실패는 기능이 아니라 후퇴다 — 발행을 막지 않는다
    console.log(`[SMART-CTA] 조용한 후퇴: ${String(e?.message || e).slice(0, 80)}`);
    value = null;
  }

  CACHE.set(cacheKey, { value, expireAt: Date.now() + TTL_MS });
  return value;
}
