/**
 * 콘텐츠 생성 함수 모음
 * - H1, H2, H3 제목 생성
 * - 전체 본문 일괄 생성
 * - FAQ, CTA, 요약표, 해시태그 생성
 */

import axios from 'axios';
import { loadEnvFromFile } from '../../env';
import { getGeminiApiKey, getPerplexityApiKey } from '../llm';
import { validateCtaUrlWithAi } from '../../cta/validate-cta-ai';
import { resolveOfficialLink } from '../../cta/resolve';
// 실속 규칙은 재생성이 아니라 첫 생성에 넣는다 — 호출 수는 그대로, 결과만 좋아진다.
// (v3.8.376 실측: 자동 재생성은 편당 호출 +1 인데 점수가 되레 하락해 결과가 버려졌다)
import { SUBSTANCE_FIRST_PASS_RULES, FRESHNESS_RULES } from './substance-rules';
import { DECISION_SUPPORT_RULES } from './decision-support';
// v3.8.529: StoryScope(COLM 2026) — 문체가 아니라 구조로 AI 티를 지운다.
//   발행글 실측(2026-08-19)에서 곁가지 0건·지시형 종결이 그대로 새고 있었다.
import { STORYSCOPE_STRUCTURE_RULES, STORYSCOPE_FAQ_ENDING_RULE } from './storyscope-rules';

/**
 * 🔀 하이브리드 CTA 검증 — HTTP 1차 + (옵션) Perplexity AI 2차
 *
 * 동작:
 *  - HTTP 검증 실패 → 즉시 false (LLM 호출 안 함, 비용 절감)
 *  - HTTP 통과 + 엄격 모드(CTA_AI_VALIDATE_STRICT=true) → AI 검증으로 의미 적합성까지 확인
 *  - HTTP 통과 + 자동 모드 + aiRecommended=true(정부 사이트 등) → AI 검증
 *  - HTTP 통과 + 자동 모드 + aiRecommended=false → 즉시 통과
 */
/**
 * v3.7.13 — CTA 텍스트(buttonText/hookingMessage) 정화 helper.
 *
 * 문제: LLM이 buttonText에 `&#8594;`(→) 같은 HTML numeric entity를 문자열로 박으면
 *   워드프레스 KSES sanitizer가 `&` → `&amp;` 다시 escape → raw 텍스트로 표시됨.
 *
 * 해결: numeric/named entity는 실제 유니코드 문자로 변환, 알 수 없는 entity는 제거.
 *   추가로 CJK 한자, 제어 문자, 다중 공백도 정리.
 */
export function sanitizeCtaText(text: string): string {
  if (!text) return '';
  return String(text)
    // numeric entity (&#NNNN;)
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      if (code > 0 && code < 0x110000) {
        try { return String.fromCodePoint(code); } catch { return ''; }
      }
      return '';
    })
    // hex entity (&#xHHHH;)
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => {
      const code = parseInt(h, 16);
      if (code > 0 && code < 0x110000) {
        try { return String.fromCodePoint(code); } catch { return ''; }
      }
      return '';
    })
    // 주요 named entity → 직접 문자
    .replace(/&rarr;/gi, '→')
    .replace(/&larr;/gi, '←')
    .replace(/&uarr;/gi, '↑')
    .replace(/&darr;/gi, '↓')
    .replace(/&hellip;/gi, '…')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    // 그 외 알 수 없는 entity는 제거 (안전)
    .replace(/&#?[a-zA-Z0-9]+;/g, '')
    // CJK 한자 제거 (한글 0xAC00-0xD7AF, 한자 0x4E00-0x9FFF / 0x3400-0x4DBF)
    .replace(/[一-鿿㐀-䶿]/g, '')
    // 제어 문자 제거 (탭/줄바꿈은 공백으로)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type CtaContextCategory =
  | 'travel' | 'welfare' | 'tax' | 'health' | 'jobs' | 'realestate'
  | 'education' | 'finance' | 'shopping' | 'food' | 'entertainment'
  | 'electronics' | 'weather' | 'shipping' | 'public';

const CTA_CONTEXT_RULES: Array<{ id: CtaContextCategory; keyword: RegExp; url: RegExp }> = [
  { id: 'travel', keyword: /여행|관광|항공|항공권|비행기|숙박|호텔|렌터카|ktx|srt|코레일|철도|기차|여권|비자|입국|출국|해외여행|국내여행|휴가|캠핑/i, url: /kto\.visitkorea|visitkorea|letskorail|srail|korail|koreanair|flyasiana|jinair|jejuair|twayair|airbusan|skyscanner|kayak|triple|myrealtrip|yanolja|goodchoice|airbnb|hotelscombined|flight|hotel/i },
  { id: 'welfare', keyword: /지원금|보조금|복지|연금|수당|장려금|바우처|혜택|청년|돌봄|급여/i, url: /bokjiro|mohw|nps\.or\.kr|kinfa|longtermcare/i },
  { id: 'tax', keyword: /세금|국세|지방세|종소세|종합소득세|부가세|연말정산|홈택스|위택스|환급|신고/i, url: /hometax|wetax|nts\.go\.kr/i },
  { id: 'health', keyword: /건강|의료|병원|진료|보험료|건강보험|의료보험|요양|검진|약값|질병/i, url: /nhis|hira|mohw|amc|snuh|samsunghospital|yuhs|longtermcare/i },
  { id: 'jobs', keyword: /고용|취업|구직|채용|실업급여|일자리|이력서|hrd|직업훈련/i, url: /work\.go\.kr|ei\.go\.kr|hrd\.go\.kr|saramin|jobkorea|linkedin/i },
  { id: 'realestate', keyword: /부동산|아파트|청약|주택|전세|월세|매매|실거래|분양|임대/i, url: /molit|rt\.molit|applyhome|r114|zigbang|dabang/i },
  { id: 'education', keyword: /교육|학교|대학|입시|강의|수능|학습|자격증|인강|ebs/i, url: /moe\.go\.kr|neis|adiga|ebs|hrd\.go\.kr/i },
  { id: 'finance', keyword: /금융|은행|대출|적금|예금|카드|보험|투자|송금|이체|간편결제/i, url: /fss|kbstar|shinhan|wooribank|kebhana|kakaobank|toss|pay\.naver|samsungfire|hi\.co\.kr|idbins/i },
  { id: 'shopping', keyword: /쇼핑|구매|가격|최저가|할인|상품|제품|리뷰|후기|비교|배송|쿠폰|공식몰|선물|가전|패션|뷰티/i, url: /coupang|shopping\.naver|smartstore|11st|gmarket|auction|ssg|lotteon|danawa|musinsa|oliveyoung|kurly|wemakeprice|tmon|daiso|emart|homeplus|lottemart/i },
  { id: 'food', keyword: /음식|맛집|배달|레시피|식품|카페|커피|치킨|피자|주문/i, url: /baemin|coupangeats|yogiyo|map\.kakao|map\.naver|booking\.naver|mcdonalds|kfc|lotteria|starbucks|ediya/i },
  { id: 'entertainment', keyword: /영화|드라마|공연|콘서트|뮤지컬|전시|티켓|예매|ott|넷플릭스|디즈니|티빙|웨이브/i, url: /cgv|megabox|lottecinema|ticket|interpark|yes24|netflix|disneyplus|tving|wavve|watcha|movie\.naver/i },
  { id: 'electronics', keyword: /전자|가전|스마트폰|아이폰|갤럭시|맥북|아이패드|컴퓨터|조립pc|냉장고|세탁기|tv|에어컨/i, url: /samsung\.com|lge\.co\.kr|apple\.com|danawa|compuzone|himart|etland/i },
  { id: 'weather', keyword: /날씨|기상|예보|태풍|미세먼지|대기질|환경/i, url: /kma\.go\.kr|me\.go\.kr/i },
  { id: 'shipping', keyword: /택배|배송|운송장|우체국|대한통운|한진|로젠|물류/i, url: /cjlogistics|hanjin|ilogen|epost|lotteglogis/i },
  { id: 'public', keyword: /정부|공공|민원|증명|발급|신청|접수|등록|정책|공고|법령|고시/i, url: /\.go\.kr|\.or\.kr|gov\.kr|korea\.kr|law\.go\.kr/i },
];

function inferCtaKeywordCategories(keyword: string, contentMode?: string): Set<CtaContextCategory> {
  const categories = new Set<CtaContextCategory>();
  const text = `${keyword || ''} ${contentMode || ''}`;
  for (const rule of CTA_CONTEXT_RULES) {
    if (rule.keyword.test(text)) categories.add(rule.id);
  }
  if (contentMode === 'shopping') categories.add('shopping');
  return categories;
}

function inferCtaUrlCategories(url: string): Set<CtaContextCategory> {
  const categories = new Set<CtaContextCategory>();
  try {
    const parsed = new URL(url);
    const target = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
    for (const rule of CTA_CONTEXT_RULES) {
      if (rule.url.test(target)) categories.add(rule.id);
    }
  } catch {
    return categories;
  }
  return categories;
}

function inferCtaIntent(keyword: string): '예매' | '예약' | '다운로드' | '신청' | '바로가기' {
  if (/예매|티켓|공연|영화|ktx|srt|철도|기차/i.test(keyword)) return '예매';
  if (/예약|숙박|호텔|병원|진료|렌터카/i.test(keyword)) return '예약';
  if (/다운로드|자료|양식|서식|pdf|hwp|엑셀/i.test(keyword)) return '다운로드';
  if (/신청|접수|등록|발급|지원금|보조금|복지|청약/i.test(keyword)) return '신청';
  return '바로가기';
}

export function isContextuallySafeCtaUrl(url: string, keyword: string, contentMode?: string): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const full = `${host}${parsed.pathname}${parsed.search}`.toLowerCase();
    if (/google\.com\/search|search\.naver\.com|search\.daum\.net|bing\.com\/search|m\.search/i.test(full)) return false;
    if (/blog\.naver|tistory|brunch|velog|medium\.com|blogspot|wordpress\.com/i.test(full)) return false;
    if (/\/error\/|\/error\.html|notfound|404|err(code|msg|cd)=/i.test(full)) return false;
  } catch {
    return false;
  }

  const urlCategories = inferCtaUrlCategories(url);
  if (urlCategories.size === 0) return true;

  const keywordCategories = inferCtaKeywordCategories(keyword, contentMode);
  const specificUrlCategories = [...urlCategories].filter(c => c !== 'public');
  const categoriesToMatch = specificUrlCategories.length > 0 ? specificUrlCategories : [...urlCategories];

  return categoriesToMatch.some(c => keywordCategories.has(c));
}

async function hybridValidateCta(url: string, keyword: string, timeoutMs = 5000, contentMode?: string): Promise<boolean> {
  if (!isContextuallySafeCtaUrl(url, keyword, contentMode)) {
    console.log(`[CTA] 🚫 주제-링크 불일치로 차단: ${url}`);
    return false;
  }

  const httpResult = await validateCtaUrl(url, { timeout: timeoutMs });
  if (!httpResult.isValid) return false;

  const strictMode = String(process.env['CTA_AI_VALIDATE_STRICT'] || '').toLowerCase() === 'true';
  const shouldAiCheck = strictMode || httpResult.aiRecommended === true;
  if (!shouldAiCheck) return true;

  try {
    const aiResult = await validateCtaUrlWithAi(url, keyword, { strict: strictMode, timeoutMs: 12000 });
    if (aiResult.skipped) return true; // API 키 없거나 호출 실패 시 차단 사유로 삼지 않음
    if (!aiResult.ok) {
      console.log(`[CTA] 🤖 AI 검증 실패 (conf=${aiResult.confidence.toFixed(2)}): ${aiResult.reason}`);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('[CTA] AI 검증 예외(통과 처리):', e?.message);
    return true;
  }
}
import { validateCtaUrl } from '../../cta/validate-cta-url';
import { callGeminiWithGrounding, callGeminiWithRetry, resolveSectionTimeoutMs } from './gemini-engine';
import { detectActionIntent, buildActionQuery } from '../../cta/action-intent';
import { analyzeArticleContext, resolveActionLink } from '../../cta/action-link-harness';
import { judgeCtaHost, describeHostVerdict } from '../../cta/host-trust';
import { buildOfficialCtaCandidates } from '../../cta/inference-candidates';
import { dropEmptyFaqItems } from './empty-block-guard';
import { buildArchetypeGuide } from './title-archetypes';
import { FinalCrawledPost, FinalTableData, FinalCTAData, FAQItem } from './types';
import { getToneInstruction } from '../max-mode/tone-text-utils';

// v3.8.356: toneStyle을 orchestration에서 module-scope로 전달받아 프롬프트/후처리에 반영.
//   과거: final 경로가 toneStyle을 무시하고 모든 존댓말(~습니다)을 강제로 반말(~어요)로 치환 → 사용자가 formal/casual 등을 선택해도 결과는 무조건 friendly.
//   현재: activeToneStyle이 프롬프트에 지시문으로 삽입되고, 강제 치환은 friendly/casual/conversational에서만 적용.
type ToneStyle = 'professional' | 'friendly' | 'casual' | 'formal' | 'conversational';
let activeToneStyle: ToneStyle = 'professional';
export function setActiveToneStyle(tone?: string | null): void {
  const allowed: ToneStyle[] = ['professional', 'friendly', 'casual', 'formal', 'conversational'];
  const normalized = String(tone || '').toLowerCase() as ToneStyle;
  activeToneStyle = allowed.includes(normalized) ? normalized : 'professional';
}
export function getActiveToneStyle(): ToneStyle {
  return activeToneStyle;
}
function toneInstructionBlock(): string {
  return getToneInstruction(activeToneStyle);
}
function shouldApplyCasualTransform(): boolean {
  return activeToneStyle === 'friendly' || activeToneStyle === 'casual' || activeToneStyle === 'conversational';
}
/**
 * 어간의 마지막 모음이 양성(ㅏ/ㅑ/ㅗ/ㅛ)이면 '아요', 아니면 '어요'.
 * v3.8.374: 기존에는 '습니다.' → '어요.' 로 무조건 치환해서 "좋습니다." → "좋어요." 같은
 *   비문이 실제 발행 글에 나갔다 (2026-07-08 발행글에서 "좋어요" 실측 확인).
 */
function politeToCasualEnding(stemChar: string): string {
  const code = stemChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '어요';
  const jungseong = Math.floor(code / 28) % 21;
  // 0=ㅏ, 2=ㅑ, 8=ㅗ, 12=ㅛ → 양성모음
  return (jungseong === 0 || jungseong === 2 || jungseong === 8 || jungseong === 12) ? '아요' : '어요';
}

export function applyCasualTransform(text: string): string {
  if (!shouldApplyCasualTransform()) return text;
  return text
    .replace(/입니다\./g, '이에요.')
    .replace(/합니다\./g, '해요.')
    // '습니다.' 는 어간 모음에 따라 '아요./어요.' 로 갈린다 (있습니다→있어요, 좋습니다→좋아요)
    .replace(/([가-힣])습니다\./g, (_m, stem: string) => `${stem}${politeToCasualEnding(stem)}.`)
    .replace(/습니다\./g, '어요.');
}

// v3.8.361: AI가 결과 본문에 프롬프트 메타 표현을 그대로 뱉는 문제 후처리 sanitize
//   예: "제공된 참고 자료에는~", "본문 근거만으로는~", "자료에는 나와 있지 않아요"
//   원인: 프롬프트가 "참고 데이터 기반만" 지시 → 정보 부족 시 AI가 그대로 회피 답변
//   해결: 유출 표현을 자연스러운 표현으로 치환하거나 삭제
export function sanitizePromptLeaks(html: string): string {
  if (!html) return html;
  let out = String(html);
  // 문장 단위 회피형 유출은 '삭제'한다.
  // v3.8.374: 예전에는 "…관련 공식 사이트에서 확인하시는 것이 정확합니다." 같은 문장으로 치환했는데,
  //   이 문장들은 숫자·기관명이 없어서 뒤따르는 FACT 무결성 필터(fact-integrity.ts)에 절대 걸리지 않는다.
  //   즉 근거 있는 문장만 삭제되고 이 알맹이 없는 대체 문장만 살아남아 "두루뭉실한 글"의 주범이 됐다.
  //   회피 문장은 어차피 독자에게 정보를 주지 않으므로 치환하지 말고 그냥 지운다.
  const replacements: Array<[RegExp, string]> = [
    [/제공된\s*(참고\s*)?(자료|데이터)에는?\s*[^.。<]{0,120}?(제시되지|나와\s*있지|언급되지|확인되지)\s*않(?:아요|았어요|습니다)\.?/g, ''],
    [/본문\s*근거(만으로는|만으론)?\s*[^.。<]{0,120}?(확정하기|단정하기|판단하기)?\s*(어렵|힘드)(?:어요|습니다)\.?/g, ''],
    [/(제공된|위)\s*자료에는?\s*[^.。<]{0,80}?(있지|나와\s*있지)\s*않(?:아요|습니다)\.?/g, ''],
    [/(본문|글)\s*근거(가|는)?\s*(부족|없)(?:어요|습니다)\.?/g, ''],
    [/(위\s*)?참고\s*(자료|데이터)에\s*[^.。<]{0,80}?없(?:어요|습니다)\.?/g, ''],
    [/근거로\s*제시되지\s*않았(?:어요|습니다)\.?/g, ''],
  ];
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  // 빈 <p></p> 제거
  out = out.replace(/<p[^>]*>\s*<\/p>/g, '');
  return out;
}

// 🔥 AI 응답에서 테이블 데이터를 안전하게 파싱
function parseTables(raw: unknown): FinalTableData[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .filter((t) => t && Array.isArray(t['headers']) && Array.isArray(t['rows']) && (t['headers'] as unknown[]).length > 0 && (t['rows'] as unknown[]).length > 0)
    .map((t) => {
      const headers = (t['headers'] as unknown[]).map(String);
      const colCount = headers.length;
      // 🛡️ v3.5.95: row 길이를 headers 길이에 맞춰 정규화
      //   사용자 보고 — AI가 첫 row의 cell을 누락하거나 별도 텍스트로 출력해서 표가 시각적으로 깨짐
      //   ([이벤트명, ''] + 표 밖에 별도 텍스트 같은 패턴)
      //   수정: row가 짧으면 빈 cell 추가, 길면 truncate, 비어있으면 헤더와 동일 길이로 채움
      const rows = (t['rows'] as unknown[]).map((r) => {
        if (!Array.isArray(r)) return new Array(colCount).fill('');
        const cells = r.map(String);
        if (cells.length === colCount) return cells;
        if (cells.length < colCount) {
          // padding — 빈 문자열로 채워서 td 칸 보존
          return [...cells, ...new Array(colCount - cells.length).fill('')];
        }
        // truncate — 헤더 개수 초과한 cell 버림
        return cells.slice(0, colCount);
      });
      return {
        type: (['feature', 'example', 'summary', 'info', 'comparison', 'checklist'].includes(t['type'] as string) ? t['type'] : 'info') as FinalTableData['type'],
        headers,
        rows,
      };
    })
    .slice(0, 3);
}

/**
 * @param productName 쇼핑 글일 때 상품의 **등록명**. (v3.8.404)
 *
 *   실측 사고(2026-08-02): 상품명을 주제로 넘겼더니 제목이 이렇게 나왔다 —
 *     "💡미끄러짐방지 쓰레기유입방지 시티가드 그레이팅안전덮개 대(600x500) 1개 팁"
 *   쿠팡 등록명을 그대로 쓰고 뒤에 "팁"만 붙인 꼴이다.
 *   원인은 프롬프트의 `키워드 "..."를 자연스럽게 포함` 규칙이었다.
 *   키워드가 등록명이면 그 긴 문자열을 통째로 넣으라는 지시가 된다.
 *
 *   쇼핑몰 등록명은 **검색 노출을 노린 키워드 나열**이지 사람이 읽는 제목이 아니다.
 *   그래서 상품일 때는 "그대로 포함"을 끄고 "핵심만 뽑아 다시 지어라"로 바꾼다.
 */
/**
 * 🏷️ v3.8.468 — 제목 상투어. 너무 많은 글이 써서 제목끼리 닮게 만드는 말들.
 *
 * 실측(2026-08-06): 같은 키워드로 뽑은 3편이 "서류부터 만기 해지까지" 12자를
 * 통째로 공유했고, 꼬리가 각각 "완벽 가이드 / 3단계 / 핵심 정리" 였다.
 * 이 말들은 정보를 담지 않는다 — 빼도 제목의 뜻이 그대로다.
 */
const TITLE_CLICHES = [
  '완벽 가이드', '완벽가이드', '완전 정복', '완전정복', '핵심 정리', '핵심정리',
  '핵심만 쏙쏙', '핵심만', '총정리', '한눈에 보는', '한눈에',
  '꿀팁 모음', '꿀팁',
  '알아야 할 모든 것', '모든 것', '파헤치기', '끝판왕', 'A to Z', '에이투지',
  '필수 체크', '완벽 분석', '완벽분석',
];

/**
 * 상투어를 떼고도 제목 구실을 하려면 이만큼은 남아야 한다.
 * 짧은 키워드 하나만 덜렁 남는 것보다 상투어가 붙은 게 낫다.
 */
const MIN_TITLE_AFTER_STRIP = 12;

/** 제목에서 상투어를 떼어낸다. 너무 짧아지면 원래 제목을 그대로 둔다. */
export function stripTitleCliches(title: string): string {
  let out = String(title || '');
  for (const cliche of TITLE_CLICHES) {
    if (!out.includes(cliche)) continue;
    const candidate = out.split(cliche).join(' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
    // 12자 미만으로 쪼그라들면 제목 구실을 못 한다 — 그럴 바엔 상투어를 둔다
    if (candidate.length >= MIN_TITLE_AFTER_STRIP) out = candidate;
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/**
 * 같은 키워드가 제목에 두 번 들어간 것을 한 번으로 줄인다.
 *
 * 실측: "전기요금 절약 꿀팁 1인 가구 에어컨 선풍기 전기요금 절약 방법 💡"
 * — 읽기 나쁘고 검색에도 도움이 안 된다(키워드 스터핑).
 */
export function dedupeKeywordInTitle(title: string, keyword: string): string {
  const kw = String(keyword || '').trim();
  const out = String(title || '');
  if (kw.length < 4 || !out) return out;

  const first = out.indexOf(kw);
  if (first < 0) return out;
  const second = out.indexOf(kw, first + kw.length);
  if (second < 0) return out;

  // 뒤쪽 것을 지운다 — 앞쪽에 있어야 검색 노출에 유리하다
  const candidate = (out.slice(0, second) + out.slice(second + kw.length))
    .replace(/\s{2,}/g, ' ').trim();
  return candidate.length >= MIN_TITLE_AFTER_STRIP ? candidate : out;
}

/**
 * 제목을 검색 결과에 보이는 길이로 맞춘다. 낱말 중간을 자르지 않는다.
 * 말줄임표를 붙이지 않는다 — 미완성으로 보이면 구글이 제목을 다시 쓴다.
 */
export function enforceTitleLength(title: string, max = 40): string {
  const out = String(title || '').trim();
  if (out.length <= max) return out;

  const cut = out.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  // 낱말 경계가 너무 앞이면(제목이 통짜) 그냥 max 에서 끊는다
  const trimmed = lastSpace >= Math.floor(max * 0.6) ? cut.slice(0, lastSpace) : cut;
  return trimmed.replace(/[\s,·\-–—]+$/, '').trim();
}

export async function generateH1TitleFinal(
  keyword: string,
  crawledTitles: string[],
  demandHint?: string,
  productName?: string,
  /**
   * v3.8.411: 쇼핑 글 전용 제목 지시문 (후기에서 뽑은 구매자 관심사).
   *
   * 사용자 지적: "브리즈 누비아 이동식 에어컨 듀얼덕트 핵심 정리 🔥 — 너라면 클릭하니?"
   *   아래 아키타입 목록에 '핵심 정리형'이 통째로 들어 있다. 뽑히면 그 제목이 나온다.
   *   상품 글에서는 그 꼴이 최악이다 — 상품명을 검색한 사람은 상품을 이미 알기 때문이다.
   *   그래서 쇼핑 글이면 아키타입을 통째로 이 지시문으로 갈아끼운다.
   */
  shoppingDirective?: string,
  /**
   * 🔎 v3.8.455 — **검색자가 실제로 올린 질문 / 실제로 친 검색어.**
   *
   * 사용자 지적: "제목은 우리블로거들은 궁금증 해결을 해주는사람이야 그러면 이
   *   궁금증과 상황이 제목이되어야 제품이 잘팔리지않을까?? … 색인되더라도 사람들이
   *   클릭을 해야 하나라도 구매전환이되자나"
   *
   * 맞는 지적이었다. 이 신호는 orchestration 에서 이미 수집해 왔는데(지식인 질문·
   * 자동완성) **소제목(H2) 생성에만** 넘어가고 제목에는 한 번도 전달되지 않았다.
   * 제목이 받던 demandHint 는 DataLab 검색량 판정 문구라 "어떤 말을 앞에 둘까"만
   * 말하지 "검색자가 무엇이 궁금한가"는 말하지 않는다.
   * 사람의 진짜 질문만큼 좋은 제목 재료는 없다.
   */
  demandSignals?: { userQuestions?: string[]; searchQueries?: string[] },
  /**
   * 🔎 v3.8.478 — 디스커버 모드는 제목 규칙이 다르다.
   *
   * 검색은 쿼리가 있어서 키워드를 앞에 두는 게 유리하지만, 디스커버 피드에는
   * 쿼리가 없다. 게다가 공식 정책이 클릭베이트·선정성·핵심 감추기를 감점한다
   * ("Avoid clickbait…by withholding crucial information", "Avoid sensationalism").
   * 기본 아키타입 중 '놓치면 손실'형은 그 경계에 붙어 있어서, 디스커버 모드에서는
   * 아키타입을 통째로 전용 지시문으로 갈아끼운다.
   */
  contentMode?: string,
): Promise<string> {
  // 🔥 현재 날짜 주입
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 🔥 키워드에서 연도 추출 (2025, 2026 등)
  const yearMatch = keyword.match(/20\d{2}/);
  const keywordYear = yearMatch ? yearMatch[0] : null;

  // 🌐 제목 참고 데이터: 크롤링 데이터 있으면 활용, 없으면 검색 지시
  const titleReference = crawledTitles.length > 0
    ? `🔍 참고할 인기 제목들:\n${crawledTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : `🔍 크롤링 제목이 부족합니다. 키워드와 일반적인 검색 의도 패턴을 기준으로 제목을 만들되, 확인되지 않은 숫자/마감일/기관명은 새로 만들지 마세요.`;

  // 🎲 제목 아키타입 랜덤 선택 (매번 다른 패턴으로 다양성 보장)
  /**
   * 🏷️ v3.8.468 — **본보기에서 상투어를 걷어낸다.**
   *
   * 사용자 지적: "제목도 신경써서 나와야할텐데".
   *
   * 실측(2026-08-06, 같은 키워드 3편):
   *   "…신청조건 서류부터 만기 해지까지 완벽 가이드 ✅"
   *   "…신청조건 서류부터 만기해지까지 3단계 ✅"
   *   "…신청조건 서류부터 만기 해지까지 핵심 정리 ✅"
   * 셋이 12자를 통째로 공유했다. 원인은 이 목록이었다 — 모델에게
   * "OO 완벽 가이드" · "OO 핵심 정리" · "OO 총정리" · "OO 꿀팁 모음" 을
   * **본보기로 보여주고** 있었으니 모든 사용자의 제목이 그 몇 개로 수렴한다.
   *
   * 그래서 상투어 예시를 지우고 **무엇을 말할지(형태)** 만 남긴다.
   * 어떤 낱말로 쓸지는 모델이 그 글의 내용에서 뽑게 한다.
   */
  // v3.8.485: 아키타입 목록을 title-archetypes 로 옮겼다.
  //   에이전트 모드가 같은 목록을 쓴다 — 한쪽에만 있으면
  //   엔진을 바꿨을 때 제목 품질이 조용히 달라진다.
  // v3.8.478: 디스커버 모드는 아키타입 대신 전용 지시문을 쓴다 (위 contentMode 주석 참고)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const discoverMode = require('./discover-mode') as typeof import('./discover-mode');
  const archetypeGuide = discoverMode.isDiscoverMode(contentMode)
    ? discoverMode.buildDiscoverTitleDirective(currentYear)
    : buildArchetypeGuide(currentYear);

  const todayH1 = new Date().toISOString().slice(0, 10);
  const prompt = `당신은 대한민국 최고의 바이럴 마케터입니다.
현재: ${currentYear}년 ${currentMonth}월 (오늘: ${todayH1})

키워드: ${keyword}

${titleReference}
${demandHint ? `
**검색 실측 (최우선 규칙 — 아래 스타일보다 우선):**
${demandHint}
` : ''}
${(() => {
    // v3.8.455: 검색자의 실제 질문을 제목 재료로 올린다 (위 demandSignals 주석 참고)
    const clean = (list?: string[]) => [...new Set((list || [])
      .map((s) => String(s || '').replace(/^Q\.\s*/i, '').replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 4 && s.length <= 60))].slice(0, 8);
    const qs = clean(demandSignals?.userQuestions);
    const kw = clean(demandSignals?.searchQueries);
    if (qs.length === 0 && kw.length === 0) return '';
    return `
🔎🔎 **검색자가 실제로 물어본 것 — 다른 어떤 규칙보다 먼저입니다**
${qs.length ? `실제 질문:\n${qs.map((q) => `  · ${q}`).join('\n')}\n` : ''}${kw.length ? `함께 검색한 말:\n  ${kw.join(' / ')}\n` : ''}
- 이 사람들이 **무엇을 몰라서 · 무엇이 막혀서** 검색했는지를 제목에 담으세요.
  그 상황이 제목에 있어야 "내 얘기다" 싶어 누릅니다. 그게 클릭의 이유입니다.
- 질문을 그대로 베끼지 말고, 그 사람이 처한 **상황·조건**으로 바꿔 쓰세요.
    예) 질문 "소득이 300만원인데 신청 되나요?"
        → 제목에 "소득 300만원이면" 같은 조건을 넣는다
- **구체적으로 쓰세요. 두루뭉실할수록 경쟁이 셉니다.**
  넓은 말은 이미 큰 사이트들이 차지하고 있습니다. 검색자가 실제로 친 좁은 말이
  들어가야 그 검색에서 우리 글이 1등이 됩니다.
    예) (X) 신청 방법 안내      (O) 무직이어도 신청되는지
        (X) 조건 정리          (O) 소득 기준 넘으면 어떻게 되는지
- 위 목록에 없는 걱정거리를 지어내지 마세요.
- 아래 "제목 스타일"은 참고일 뿐입니다. **위 질문과 스타일이 부딪히면 질문을 따르세요.**
`;
  })()}
${shoppingDirective || `**이번에 사용할 제목 스타일 (아래 중 하나 선택):**
${archetypeGuide}`}

**작성 규칙:**
${shoppingDirective ? '- 위 쇼핑 글 제목 규칙을 따르세요' : '- 위 스타일 중 하나를 골라 창의적으로 작성'}
- 이모지는 넣어도 되고 안 넣어도 됩니다. 넣는다면 1개만, 내용과 맞는 것으로.
  (모든 글이 같은 자리에 같은 이모지를 달면 기계가 쓴 티가 납니다)

🚫 **아래 표현은 쓰지 마세요** — 너무 많은 글이 쓰는 말이라 제목이 서로 비슷해집니다:
  완벽 가이드 · 핵심 정리 · 핵심만 · 총정리 · 한눈에 · 꿀팁 · 모든 것 ·
  알아야 할 · 파헤치기 · 완전 정복 · A to Z · 끝판왕 · 필수 체크
  → 대신 이 글에만 있는 **구체적인 내용**(숫자·조건·판단)을 넣으세요.
- 키워드는 제목에 **한 번만** 넣으세요. 두 번 들어가면 읽기 나쁘고 검색에도 도움이 안 됩니다.
${productName ? `- ⚠️ 위 문자열은 쇼핑몰 **상품 등록명**입니다. 제목이 아닙니다. **그대로 쓰지 마세요.**
  · 등록명은 검색 노출을 노린 키워드 나열이라 그대로 쓰면 사람이 읽기 힘든 제목이 됩니다.
  · 등록명에서 **핵심 제품 명사**와 **핵심 이점** 하나만 뽑아 새로 지으세요.
    예) "미끄러짐방지 쓰레기유입방지 시티가드 그레이팅안전덮개 대(600x500) 1개"
        → 핵심 제품 = "그레이팅 안전덮개", 핵심 이점 = "미끄럼·이물질 차단"
  · **규격·치수·수량·포장 단위는 제목에서 빼세요.** (예: "대(600x500)", "1개", "2팩", "세트")
  · 브랜드/모델 코드는 사람들이 그 이름으로 검색할 때만 남기세요.
  · 실제로 검색창에 칠 법한 말로 쓰세요.` : `- 키워드 "${keyword}"를 자연스럽게 포함`}
- 연도가 필요한 주제(정책·지원금·세금·트렌드 등)면 "${currentYear}년"을 제목 맨 앞에. 불필요한 주제(맛집·일상 꿀팁 등)면 연도 생략.
- 연도를 쓸 때는 반드시 "2026년" 형태로 제목 맨 앞에. "년 2026" 같은 역순 금지.
- 이미 마감된 사업/이벤트는 제목에 포함 금지. 현재 진행 중이거나 미래 일정만 다루세요.
- 한글과 영문/숫자만 사용. 중국어 한자(漢字) 절대 금지!
- 금지: ~손해, ~후회, ~대박 표현

📏 **길이 — 25~35자.** 40자를 넘기지 마세요.
  · 구글은 제목의 60~76%를 스스로 다시 씁니다. 가장 큰 이유가 **길이**입니다.
  · 검색 결과에 보이는 폭이 정해져 있어 긴 제목은 잘립니다. 잘린 제목은 클릭이 안 됩니다.

🎯 **키워드를 앞쪽에.** 구글도 네이버도 제목 앞부분의 말에 더 큰 가중치를 줍니다.
  · 키워드를 문장 뒤에 숨기지 마세요.
  · 연도를 쓴다면 "${currentYear}년 ${keyword} …" 처럼 연도 바로 뒤에 키워드가 오게 하세요.

🔎 **제목만 보고 "이 글이 내 궁금증을 풀어주겠다" 는 판단이 서야 합니다.**
  · 네이버는 검색 의도와 얼마나 맞는지를 봅니다. 두루뭉실한 제목은 걸러집니다.
  · "무엇을 알려주는 글인지" 가 제목에 구체적으로 들어가야 합니다.
    예) (X) 지원금 정보 정리   (O) 소득 얼마까지 받을 수 있나

- 오직 1개만 출력 (옵션/설명/번호 없이 제목만)
`;

  const response = await callGeminiWithRetry(prompt);
  // 첫 번째 줄만 추출, 특수문자/번호 제거
  const lines = response.trim().split('\n');
  let title = (lines[0] || response.trim())
    // 🛡️ v3.5.83: 기호와 번호를 분리. 기존 통합 패턴이 "2026년..." 시작 제목에서
    //   "2026"을 prefix로 잘못 제거하던 버그 수정. 번호는 구분자(. ) ] :)와 함께 있을 때만 제거.
    .replace(/^[\*\-]+\s*/g, '')           // 기호 prefix 제거 (* -)
    .replace(/^\d+[.\):\]]+\s*/g, '')      // 번호 prefix 제거 (1. 2) 3] 4:) — 구분자 필수
    .replace(/["']/g, '')
    .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')  // 한자 제거
    .trim();

  // v3.8.411: 쇼핑 글이면 무의미한 꼬리표를 떼어낸다.
  //   프롬프트로 금지해도 모델이 습관처럼 붙인다. 마지막에 한 번 더 거른다.
  //   ⚠️ 떼고 남는 게 없으면 그대로 둔다 — 제목을 비우느니 밋밋한 게 낫다.
  if (shoppingDirective) {
    try {
      const { findFillerTail } = require('../affiliate/buyer-concerns');
      const tail = findFillerTail(title);
      if (tail) {
        const stripped = title.replace(new RegExp(`\\s*${tail}\\s*`), ' ').replace(/\s+/g, ' ').trim();
        if (stripped.length >= 8) title = stripped;
      }
    } catch { /* 꼬리표 제거 실패가 제목 생성을 막지 않는다 */ }
  }

  /**
   * 🏷️ v3.8.468 — 프롬프트로 금지해도 모델이 습관처럼 넣는 것을 마지막에 거른다.
   *
   * ⚠️ 지우고 남는 게 너무 짧으면 손대지 않는다 — 제목을 망가뜨리느니 상투어가 낫다.
   */
  title = stripTitleCliches(title);
  title = dedupeKeywordInTitle(title, keyword);

  /**
   * 📏 v3.8.468 — 길이를 검색 결과 폭에 맞춘다.
   *
   * 예전에는 50자에서 자르고 뒤에 "..." 을 붙였다. 두 가지가 잘못됐다.
   *   · 50자는 한글 기준으로 검색 결과에서 잘린다 — 잘린 제목은 클릭이 안 된다.
   *   · "..." 이 붙은 제목은 미완성으로 보여 구글이 더 자주 다시 쓴다.
   *     (구글이 제목을 다시 쓰는 가장 큰 이유가 길이다)
   * 이제 40자를 넘으면 **낱말 경계에서** 끊는다. 말줄임표는 붙이지 않는다.
   */
  title = enforceTitleLength(title, 40);

  return title;
}

/**
 * v3.7.21: 키워드 끝의 한정자(혜택/신청방법/조건/대상 등) 감지 → 스코프 제한 지시 생성.
 *
 * 문제: 사용자가 "2026년 청년내일저축계좌 혜택"으로 단일 발행했더니 AI가 혜택뿐 아니라
 *   신청방법/대상자/조건까지 모두 다룬 종합 글을 출력.
 *
 * 해결: 키워드 우측에 한정자가 붙어 있으면 H2 outline + 본문 sectionPromptBlock + FAQ 생성에
 *   모두 "그 한정자 외 범위는 다루지 말 것" 강제 지시 주입.
 *
 *  - 다중 토픽 구분자: 와/과/및/,/+///그리고/또는 모두 받음 (사용자가 둘 다 원한 경우 스코프 제한 X)
 *  - 한정자가 없으면 종전과 동일하게 종합 글 허용
 *
 * v3.7.21+: orchestration.ts에서도 호출할 수 있도록 export.
 */
export function detectKeywordScope(keyword: string): { qualifier: string; instruction: string } | null {
  const trimmed = String(keyword || '').trim();
  if (!trimmed) return null;
  // 명시적 다중 토픽 요청 → 스코프 제한 X (사용자가 둘 다 원했음)
  //   가드: PRIMARY 한정자끼리 충돌만 검사. PRIMARY = 서로 배타적인 큰 축(혜택 ↔ 신청방법 ↔ 조건 등).
  //   SECONDARY(사례/지원금/일정/추천/주의사항/종류 등)는 PRIMARY의 하위 측면이라
  //   "혜택 사례", "노트북 추천 TOP 5" 같이 같이 쓰여도 충돌이 아니므로 guard 비활성.
  const PRIMARY_SCOPES = '혜택|특혜|이점|메리트|신청|접수|등록|조건|자격|요건|기준|대상|수혜자|해당자|후기|리뷰|경험담|사용기|장점|단점|한계|문제점|아쉬운|방법|효과|결과|차이|비교|대비';
  const multiTopicGuard = new RegExp(`(${PRIMARY_SCOPES})(\\s*[와과및,+/·]\\s*|\\s*(그리고|또는|or|and)\\s+|\\s+)(${PRIMARY_SCOPES})`, 'i');
  if (multiTopicGuard.test(trimmed)) return null;

  const patterns: Array<[RegExp, string, string]> = [
    // 신청방법 변형 — 패턴 우선순위 위로 (단순 "신청"보다 "신청방법"이 더 구체적이므로 먼저 매치)
    [/(신청\s*방법|신청\s*절차|신청\s*하는\s*법|신청\s*과정|접수\s*방법|접수\s*절차|접수\s*하는\s*법|등록\s*방법|등록\s*절차|신청법|접수법)\s*$/, '신청방법', '이 글의 모든 H2/본문/FAQ는 오직 "신청/접수/등록 절차와 방법"만 다룬다. 혜택 내용·금액·종류, 자격 요건·대상자 분류는 본문 주제로 만들지 말고 신청 단계·필요 서류·접수 플랫폼·기간·자주 하는 실수만 다룰 것.'],
    [/(혜택|특혜|이점|메리트|어떤\s*혜택)\s*$/, '혜택', '이 글의 모든 H2/본문/FAQ는 오직 "혜택/이점/메리트/지원 내용" 측면만 다룬다. 신청방법·신청 절차·자격/조건·대상자 분류·접수 일정 같은 "방법/조건" 정보는 절대 본문 주제로 만들지 말 것.'],
    [/(조건|자격|요건|기준|자격\s*요건|적용\s*기준)\s*$/, '조건', '이 글의 모든 H2/본문/FAQ는 오직 "자격/조건/요건/기준"만 다룬다. 혜택 상세, 신청 절차는 주제로 만들지 말 것.'],
    [/(대상|대상자|수혜자|해당자|적용\s*대상)\s*$/, '대상', '이 글의 모든 H2/본문/FAQ는 오직 "대상자/수혜자/적용 범위"만 다룬다. 혜택 액수, 신청 단계는 본문 주제로 만들지 말 것.'],
    [/(후기|리뷰|경험담|사용기|솔직\s*후기|실제\s*후기)\s*$/, '후기', '이 글의 모든 H2/본문/FAQ는 실제 사용자 "후기·경험·평가" 관점만 다룬다. 제품/서비스 스펙·기본 안내는 본문 주제로 만들지 말 것.'],
    [/(장점|단점|한계|문제점|아쉬운\s*점|장단점)\s*$/, '장단점', '이 글의 모든 H2/본문/FAQ는 오직 "장점/단점/한계" 비교 관점만 다룬다.'],
    [/(차이|비교|대비|비교\s*분석|vs\.?)\s*$/, '비교', '이 글의 모든 H2/본문/FAQ는 키워드 안의 두 대상 또는 동종 대안과의 "비교/차이/대비"만 다룬다.'],
    [/(효과|결과|성과)\s*$/, '효과', '이 글의 모든 H2/본문/FAQ는 오직 "효과/결과/성과" 관점만 다룬다. 신청 방법·조건은 본문 주제로 다루지 말 것.'],
    [/(지원금|지원금액|금액|한도|단가|지원\s*한도|월\s*한도|연\s*한도)\s*$/, '지원금', '이 글의 모든 H2/본문/FAQ는 오직 "지원금/금액/한도/단가" 관점만 다룬다. 신청 절차, 자격 조건은 본문 주제로 만들지 말 것.'],
    [/(비용|가격|요금)\s*$/, '비용', '이 글의 모든 H2/본문/FAQ는 오직 "비용/가격/요금" 관점만 다룬다.'],
    [/(일정|시기|기간|마감|마감일|마감일자|접수\s*기간|신청\s*기간)\s*$/, '일정', '이 글의 모든 H2/본문/FAQ는 오직 "일정/시기/기간/마감" 관점만 다룬다. 혜택 상세나 신청 단계 본론은 만들지 말 것.'],
    [/(추천|순위|TOP\s*\d*|베스트|랭킹|TOP10|TOP5|TOP3)\s*$/i, '추천', '이 글의 모든 H2/본문/FAQ는 오직 "추천/순위/베스트 리스트" 관점만 다룬다.'],
    [/(사례|예시|성공\s*사례|활용\s*사례|적용\s*사례)\s*$/, '사례', '이 글의 모든 H2/본문/FAQ는 오직 "실제 사례/예시/성공 사례" 관점만 다룬다. 일반 개요·정의는 본문 주제로 만들지 말 것.'],
    [/(주의\s*사항|유의\s*사항|체크리스트|주의점|유의점|놓치기\s*쉬운)\s*$/, '주의사항', '이 글의 모든 H2/본문/FAQ는 오직 "주의사항/유의점/실수 방지/체크리스트" 관점만 다룬다. 혜택 상세는 본문 주제로 만들지 말 것.'],
    [/(종류|유형|분류|타입)\s*$/, '종류', '이 글의 모든 H2/본문/FAQ는 오직 "종류/유형/분류" 관점만 다룬다.'],
    // "신청" 단독(끝 토큰) — 신청방법 변형이 위에서 안 잡혔을 때 fallback
    [/(?:^|\s)(신청|접수|등록)\s*$/, '신청방법', '이 글의 모든 H2/본문/FAQ는 오직 "신청/접수/등록 절차와 방법"만 다룬다.'],
  ];
  for (const [re, qualifier, instruction] of patterns) {
    if (re.test(trimmed)) return { qualifier, instruction };
  }
  return null;
}

/**
 * v3.7.21: 한정자별 금지 패턴 — H2 제목/FAQ 질문 응답이 한정자를 위반했는지 결정적으로 검사.
 *
 * 예: scope="혜택"인데 H2 제목이 "신청 방법"이면 위반. validateScopeText 가 false 반환 → 호출자가 재시도.
 *
 * 디자인 원칙: false positive 최소화. 단순 단어 매칭이 아니라
 *   "신청 방법" 같이 명확히 다른 측면의 H2 주제로 굳어지는 패턴만 잡는다.
 *   ("혜택 받는 조건" 같이 한정자에 종속된 표현은 잡지 말 것)
 */
export const FORBIDDEN_BY_SCOPE: Record<string, RegExp[]> = {
  '혜택': [
    /신청\s*방법/, /신청\s*절차/, /신청\s*하는/, /신청\s*단계/, /신청\s*과정/,
    /접수\s*방법/, /접수\s*절차/, /등록\s*방법/, /등록\s*절차/,
    /자격\s*요건/, /자격\s*조건/, /자격조건/, /자격요건/,
  ],
  '신청방법': [
    /혜택\s*(?:내용|종류|금액|상세|소개)/, /(?:^|\s)이점(?:\s|$)/, /메리트/,
    /수혜자(?:\s|$)/, /적용\s*대상/, /지원금\s*(?:내용|상세|금액)/,
  ],
  '조건': [
    /신청\s*방법/, /신청\s*절차/, /신청\s*하는/, /신청\s*단계/,
    /혜택\s*(?:내용|금액|상세)/, /대상자\s*분류/,
  ],
  '대상': [
    /신청\s*방법/, /신청\s*절차/, /신청\s*하는/, /신청\s*단계/,
    /혜택\s*(?:금액|종류|상세)/,
  ],
  '후기': [
    /기본\s*(?:설명|안내|소개|개요)/, /^[^?!.]*정의(?:\s|$)/,
    /스펙\s*(?:안내|소개)/,
  ],
  '장단점': [/기본\s*(?:설명|안내|소개|개요)/],
  '비교': [],
  '효과': [/신청\s*방법/, /신청\s*절차/, /자격\s*조건/, /자격\s*요건/],
  '지원금': [/신청\s*방법/, /신청\s*절차/, /자격\s*조건/, /자격\s*요건/],
  '비용': [],
  '일정': [/혜택\s*(?:내용|상세)/, /신청\s*단계/, /신청\s*절차/, /자격\s*요건/],
  '추천': [/기본\s*개요/, /^[^?!.]*정의(?:\s|$)/],
  '사례': [/기본\s*개요/, /^[^?!.]*정의(?:\s|$)/, /기본\s*안내/],
  '주의사항': [/혜택\s*(?:내용|상세)/, /기본\s*사용법/],
  '종류': [/기본\s*개요/, /^[^?!.]*정의(?:\s|$)/],
};

/**
 * 텍스트가 한정자 스코프를 위반하는지 검사.
 * @returns true=위반 없음 (통과), false=위반 (재시도 필요)
 */
export function validateScopeText(text: string, scope: { qualifier: string } | null): boolean {
  if (!scope) return true;
  const forbidden = FORBIDDEN_BY_SCOPE[scope.qualifier];
  if (!forbidden || forbidden.length === 0) return true;
  return !forbidden.some((re) => re.test(text || ''));
}

type H2TopicProfile = {
  id: 'sports_event' | 'public_policy' | 'travel' | 'shopping_product' | 'finance';
  label: string;
  match: RegExp;
  bannedTerms: string[];
  bannedPattern: RegExp;
  promptGuidance: string;
  fallbackTitles: (keyword: string) => string[];
};

const INTERNAL_GENERIC_H2_PATTERNS: RegExp[] = [
  /한눈에\s*보기\s*[—\-]\s*무엇이고\s*왜\s*중요할까/i,
  /자세히\s*알아보기\s*[—\-]\s*자격[·ㆍ\.\s]*조건[·ㆍ\.\s]*핵심\s*정보/i,
  /실전\s*사례와\s*단계별\s*적용법/i,
  /핵심\s*포인트\s*한\s*줄\s*정리/i,
  /함께\s*보면\s*좋은\s*관련\s*정보/i,
  /완전히\s*이해하기/i,
  /핵심\s*개요/i,
  /심층\s*분석/i,
  /체계적\s*정리/i,
  /최신\s*트렌드\s*&?\s*추가\s*정보/i,
];

const H2_TOPIC_PROFILES: H2TopicProfile[] = [
  {
    id: 'sports_event',
    label: '스포츠/대회/경기 정보',
    match: /(월드컵|fifa|올림픽|아시안게임|축구|야구|농구|배구|골프|테니스|e스포츠|조\s*편성|조편성|조별|대진|토너먼트|예선|본선|16강|8강|4강|결승|리그|챔피언스리그|kbo|k리그|epl|프리미어리그|선수|대표팀|감독|중계|스코어|순위)/i,
    bannedTerms: ['자격', '조건', '신청', '접수', '서류', '지원금', '혜택', '대상자', '사용처', '발급', '환급', '보조금'],
    bannedPattern: /(자격|조건|신청|접수|서류|지원금|혜택|대상자|사용처|발급|환급|보조금)/,
    promptGuidance: [
      '조편성·대진·경기 일정·중계·순위·경우의 수·팀 전력·선수 변수처럼 스포츠 독자가 실제로 찾는 축으로 H2를 구성하세요.',
      '정부지원/신청/자격/조건/서류/혜택 같은 행정형 단어를 H2에 절대 넣지 마세요.',
      '"무엇이고 왜 중요할까" 같은 일반론 대신 경기 정보·관전 포인트·확인 경로를 바로 드러내세요.',
    ].join('\n- '),
    fallbackTitles: (keyword) => {
      const isWorldCupGroup = /(월드컵|fifa)/i.test(keyword) && /조\s*편성|조편성|조별/i.test(keyword);
      if (isWorldCupGroup) {
        return [
          '조 편성 결과와 상대팀',
          '경기 일정과 중계 시간',
          '16강 진출 경우의 수',
          '한국 대표팀 관전 포인트',
          '개최지와 최신 확인 경로',
        ];
      }
      return [
        `${keyword} 일정과 대진`,
        '승부를 가를 핵심 변수',
        '주요 팀과 선수 전력',
        '순위와 기록 확인 포인트',
        '중계와 현장 관람 정보',
      ];
    },
  },
  {
    id: 'public_policy',
    label: '정부지원/정책/공공서비스',
    match: /(지원금|보조금|복지|정부24|보조금24|민원|정책|공고|장려금|수당|바우처|청년|근로장려|내일저축|연금|급여|환급|세액공제|공제|신청|접수|자격|대상|서류)/i,
    bannedTerms: ['조편성', '대진', '중계', '선수', '대표팀', '티켓', '토너먼트'],
    bannedPattern: /(조\s*편성|조편성|대진|중계|선수|대표팀|티켓|토너먼트|경기\s*일정)/,
    promptGuidance: [
      '대상·자격·지원 내용·신청 절차·서류·마감·주의사항 중 키워드 범위에 맞는 축으로 구성하세요.',
      '스포츠 경기/대진/중계/선수 같은 단어를 H2에 넣지 마세요.',
    ].join('\n- '),
    fallbackTitles: (keyword) => [
      `${keyword} 핵심 대상`,
      `${keyword} 자격 조건`,
      `${keyword} 신청 절차`,
      `${keyword} 지원 내용`,
      `${keyword} 주의사항`,
    ],
  },
  {
    id: 'travel',
    label: '여행/관광/이동 정보',
    match: /(여행|관광|항공|항공권|숙소|호텔|렌터카|여권|비자|입국|출국|일본|제주|해외여행|국내여행|코레일|ktx|srt|공항)/i,
    bannedTerms: ['지원금', '자격조건', '신청서류', '대상자'],
    bannedPattern: /(지원금|자격\s*조건|신청\s*서류|대상자|보조금)/,
    promptGuidance: [
      '준비물·동선·비용·예약·교통·현지 주의사항처럼 여행자가 바로 쓰는 축으로 H2를 구성하세요.',
      '정책 신청/지원금/자격조건 같은 행정형 제목은 피하세요.',
    ].join('\n- '),
    fallbackTitles: (keyword) => [
      `${keyword} 준비 체크리스트`,
      '일정별 동선 짜는 법',
      '비용과 예약 팁',
      '현지에서 조심할 점',
      '출발 전 최종 확인',
    ],
  },
  {
    id: 'shopping_product',
    label: '제품/구매/리뷰 정보',
    match: /(추천|가격|최저가|구매|후기|리뷰|비교|순위|베스트|노트북|가전|스마트폰|아이폰|갤럭시|화장품|영양제|제품|상품)/i,
    bannedTerms: ['신청방법', '지원금', '대상자', '조편성', '중계'],
    bannedPattern: /(신청\s*방법|지원금|대상자|조\s*편성|조편성|중계)/,
    promptGuidance: [
      '가격·스펙·장단점·실사용 후기·구매 전 체크포인트처럼 구매 판단에 필요한 축으로 H2를 구성하세요.',
      '정책 신청/스포츠 대진 같은 무관한 단어를 H2에 넣지 마세요.',
    ].join('\n- '),
    fallbackTitles: (keyword) => [
      `${keyword} 핵심 스펙`,
      '가격대별 선택 기준',
      '실사용 장단점 비교',
      '구매 전 체크포인트',
      '추천 대상과 비추천 대상',
    ],
  },
  {
    id: 'finance',
    label: '금융/세금/자산 정보',
    match: /(대출|예금|적금|금리|주식|주가|환율|보험|연금|세금|종합소득세|연말정산|환급|카드|투자|재테크|계좌|청약)/i,
    bannedTerms: ['조편성', '대진', '중계', '선수'],
    bannedPattern: /(조\s*편성|조편성|대진|중계|선수|대표팀)/,
    promptGuidance: [
      '금리·수수료·조건·위험·계산 예시·비교 기준처럼 금융 의사결정에 필요한 축으로 H2를 구성하세요.',
      '스포츠 대진/중계/선수 같은 무관한 단어를 H2에 넣지 마세요.',
    ].join('\n- '),
    fallbackTitles: (keyword) => [
      `${keyword} 핵심 조건`,
      '금액과 수수료 계산',
      '비교할 때 볼 기준',
      '놓치기 쉬운 위험',
      '가입 전 확인 사항',
    ],
  },
];

function inferH2TopicProfile(keyword: string): H2TopicProfile | null {
  const text = String(keyword || '').trim();
  if (!text) return null;
  return H2_TOPIC_PROFILES.find((profile) => profile.match.test(text)) || null;
}

function isGenericInternalH2Title(title: string): boolean {
  return INTERNAL_GENERIC_H2_PATTERNS.some((re) => re.test(title || ''));
}

function isH2TopicProfileViolation(title: string, profile: H2TopicProfile | null): boolean {
  if (!title) return true;
  if (isGenericInternalH2Title(title)) return true;
  return !!profile && profile.bannedPattern.test(title);
}

function normalizeH2DedupeKey(title: string): string {
  return String(title || '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
}

function buildScopeFallbackH2Titles(keyword: string, scope: { qualifier: string } | null): string[] {
  if (!scope) return [];
  switch (scope.qualifier) {
    case '혜택':
      return [`${keyword} 지원 내용`, '금액과 한도 핵심 정리', '혜택이 커지는 포인트', '놓치기 쉬운 혜택', '핵심 요약과 확인 포인트'];
    case '신청방법':
      return [`${keyword} 시작 전 준비`, '온라인 신청 순서', '필요 서류 입력 요령', '접수 후 확인 방법', '신청 실수 방지 체크'];
    case '조건':
      return [`${keyword} 자격 기준`, '소득과 기간 조건', '예외와 제외 대상', '조건 확인 순서', '판단 전 체크포인트'];
    case '대상':
      return [`${keyword} 대상자 기준`, '포함되는 경우', '제외되는 경우', '상황별 대상 확인', '대상 판단 체크리스트'];
    case '후기':
      return [`${keyword} 실제 후기`, '좋았던 점과 아쉬운 점', '사용 전후 차이', '후기에서 많이 나온 질문', '경험 기준 최종 정리'];
    case '장단점':
      return [`${keyword} 장점 정리`, '아쉬운 단점', '상황별 체감 차이', '비교할 때 볼 기준', '선택 전 최종 판단'];
    case '비교':
      return [`${keyword} 핵심 차이`, '비용과 조건 비교', '상황별 유리한 선택', '비교표로 보는 장단점', '최종 선택 기준'];
    case '효과':
      return [`${keyword} 기대 효과`, '실제 체감되는 변화', '효과가 갈리는 조건', '주의할 부작용과 한계', '효과 판단 체크포인트'];
    case '지원금':
      return [`${keyword} 금액 기준`, '한도와 지급 방식', '상황별 받을 수 있는 금액', '금액 확인 시 주의점', '지원금 핵심 요약'];
    case '비용':
      return [`${keyword} 비용 구조`, '추가 비용 체크', '가격 비교 기준', '절약 가능한 항목', '비용 판단 요약'];
    case '일정':
      return [`${keyword} 주요 일정`, '접수와 마감 시기', '일정별 준비 항목', '놓치기 쉬운 날짜', '최신 일정 확인 방법'];
    case '추천':
      return [`${keyword} 추천 기준`, '상황별 추천 대상', '비추천하는 경우', '비교표로 보는 선택지', '최종 추천 요약'];
    case '사례':
      return [`${keyword} 대표 사례`, '상황별 적용 예시', '성공과 실패 포인트', '사례로 보는 체크리스트', '실전 적용 요약'];
    case '주의사항':
      return [`${keyword} 핵심 주의사항`, '자주 하는 실수', '확인해야 할 위험 요소', '문제 발생 시 대처', '최종 체크리스트'];
    case '종류':
      return [`${keyword} 주요 종류`, '유형별 차이', '상황별 맞는 유형', '선택 기준 비교', '종류별 핵심 요약'];
    default:
      return [];
  }
}

export function generateIntentAwareFallbackH2Titles(keyword: string, maxCount = 5, scope: { qualifier: string } | null = detectKeywordScope(keyword)): string[] {
  const cleanKeyword = String(keyword || '').trim() || '핵심 주제';
  const profile = inferH2TopicProfile(cleanKeyword);
  const candidates = [
    ...buildScopeFallbackH2Titles(cleanKeyword, scope),
    ...(profile ? profile.fallbackTitles(cleanKeyword) : []),
    `${cleanKeyword} 핵심 맥락`,
    `${cleanKeyword}에서 꼭 볼 포인트`,
    `${cleanKeyword} 실제 사례와 해석`,
    `${cleanKeyword} 체크리스트`,
    `${cleanKeyword} FAQ`,
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    const title = String(candidate || '').trim();
    if (!title) continue;
    if (!validateScopeText(title, scope)) continue;
    if (isH2TopicProfileViolation(title, profile)) continue;
    const key = normalizeH2DedupeKey(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= maxCount) break;
  }
  return out;
}

function finalizeH2TitlesWithIntentGuard(
  keyword: string,
  rawTitles: string[],
  targetCount: number,
  scope: { qualifier: string; instruction?: string } | null,
  profile: H2TopicProfile | null,
): string[] {
  const fallback = generateIntentAwareFallbackH2Titles(keyword, targetCount, scope);
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = [...(rawTitles || []), ...fallback];

  for (const raw of candidates) {
    const title = String(raw || '').trim();
    if (!title) continue;
    if (!validateScopeText(title, scope)) continue;
    if (isH2TopicProfileViolation(title, profile)) continue;
    const key = normalizeH2DedupeKey(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= targetCount) break;
  }

  if (out.length > 0) return out;
  return (rawTitles || []).filter(Boolean).slice(0, targetCount);
}

// v3.8.372: 검색자의 실제 궁금증을 H2에 반영
//   문제: 지식인 질문(source='naver-kin')과 자동완성 키워드(source='google-suggest')를
//         블로그 소제목과 flatMap으로 뭉뚱그려 넘기고 있어, "이건 실제 검색자 질문"이라는
//         신호가 사라졌다. 그 결과 H2가 크롤링 소제목 빈도에만 끌려가 정형화됐다.
//   해결: 질문/검색어를 별도 인자로 받아 프롬프트에 최우선 근거로 주입한다.
/**
 * v3.8.373: 고정 H2 템플릿 모드(애드센스/쇼핑/페러프레이징)의 "제목만" 다시 짓는다.
 *
 * 문제: 이 모드들은 H2가 '[주제] 핵심 스펙 총정리' 같은 고정 문자열이라
 *       키워드가 뭐든 같은 뼈대가 나왔다. (사용자 지적)
 * 해결: 섹션의 '역할(role)'과 '다룰 내용(contentFocus)'은 그대로 유지해 구조 안정성을 지키고,
 *       표기 문자열만 키워드와 실제 검색자 질문에 맞게 AI가 짓게 한다.
 *
 * 실패하면 원래 템플릿 제목을 그대로 돌려주므로 회귀 위험이 없다.
 * 개수와 순서는 반드시 보존한다 (섹션별 본문 지시와 1:1 대응해야 하므로).
 */
export async function generateSectionTitlesFromRoles(
  keyword: string,
  sections: Array<{ title: string; role?: string; contentFocus?: string }>,
  demandSignals?: { userQuestions?: string[]; searchQueries?: string[] },
): Promise<string[]> {
  const fallback = sections.map((s) => String(s?.title || '').replace(/\[주제\]/g, keyword).trim());
  if (!Array.isArray(sections) || sections.length === 0) return fallback;

  const clean = (list?: string[]) => [...new Set((list || [])
    .map((s) => String(s || '').replace(/^Q\.\s*/i, '').trim())
    .filter((s) => s.length >= 4 && s.length <= 80))].slice(0, 12);
  const questions = clean(demandSignals?.userQuestions);
  const queries = clean(demandSignals?.searchQueries);

  const demandBlock = (questions.length || queries.length)
    ? `\n🔥 [검색자가 실제로 알고 싶어하는 것 — 제목에 반영할 것]\n`
      + (questions.length ? `실제 질문:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n` : '')
      + (queries.length ? `함께 검색한 키워드:\n${queries.join(', ')}\n` : '')
    : '';

  const roleList = sections.map((s, i) => {
    const role = String(s?.role || '').trim();
    const focus = String(s?.contentFocus || '').trim();
    return `${i + 1}. [역할] ${role || '(미지정)'}\n   [다룰 내용] ${focus || '(미지정)'}\n   [기존 임시 제목] ${String(s?.title || '').replace(/\[주제\]/g, keyword)}`;
  }).join('\n\n');

  const prompt = `키워드: "${keyword}"
${demandBlock}
아래는 이 글의 섹션 구조다. 각 섹션의 **역할은 절대 바꾸지 말고**, 제목 문자열만 이 키워드에 딱 맞게 새로 지어라.

${roleList}

작성 규칙:
1. 정확히 ${sections.length}개, 위와 **같은 순서**로 출력 (역할과 1:1 대응)
2. "기존 임시 제목"을 그대로 쓰지 마라. 그건 어떤 키워드에도 붙는 껍데기 문구다.
3. "핵심 개요", "심층 분석", "체계적 정리", "완전히 이해하기", "총정리" 같은
   **어느 글에나 붙는 뻔한 표현 금지**. 이 키워드에서만 나올 수 있는 구체적인 제목을 지어라.
4. 검색자 질문이 주어졌다면 그 궁금증이 드러나게 제목을 지어라.
5. 각 15~25자, 번호/접두어 없이 제목 텍스트만
6. 한글/영문/숫자만. 확인되지 않은 수치·마감일을 제목에 만들어 넣지 마라.
7. 띄어쓰기를 반드시 지켜라. 상품명·모델명·숫자가 여러 단어로 이어져도
   "갤럭시Z플립8자급제구매전단점점검" 처럼 단어를 붙여 쓰지 말고 "갤럭시 Z 플립8 자급제 구매 전 단점 점검"
   처럼 띄어 써라.
8. ⚠️ **키워드를 모든 제목에 넣지 마라.** 키워드(또는 상품명) 전체를 넣는 제목은
   ${sections.length}개 중 **최대 2개**까지다. 나머지는 그 키워드를 이미 아는 독자가
   그 다음으로 궁금해할 것을 제목으로 삼아라 — 같은 이름이 소제목마다 반복되면
   기계가 찍어낸 글로 보이고, 검색엔진도 과최적화로 읽는다.
   예) ❌ "랜선식당 연탄불고기 구성", "랜선식당 연탄불고기 후기", "랜선식당 연탄불고기 가격"
       ✅ "250g 4개, 며칠이나 먹을 수 있을까", "냉면에 곁들일 때 생기는 문제", "사고 나서 후회하는 경우"

JSON 배열만 출력 (${sections.length}개 문자열):`;

  try {
    const raw = await callGeminiWithRetry(prompt);
    const json = raw.trim().replace(/```json\n?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return fallback;
    const titles = parsed
      .map((t: any) => String(t || '').replace(/[一-鿿㐀-䶿]/g, '').replace(/^\d+[.):\s]+/, '').trim())
      .filter((t: string) => t.length > 0);
    // 개수가 안 맞으면 구조가 깨지므로 폴백 (섹션별 본문 지시와 1:1 대응 필요)
    if (titles.length !== sections.length) {
      console.warn(`[SECTION-TITLES] 개수 불일치(${titles.length}/${sections.length}) — 템플릿 제목 유지`);
      return fallback;
    }
    /**
     * v3.8.419 — 실측: "갤럭시Z플립8자급제구매전단점점검"(17자, 띄어쓰기 0개)처럼
     *   AI가 가끔 띄어쓰기를 통째로 빼먹는다. 한국어 자동 띄어쓰기 교정은 신뢰할 만한
     *   라이브러리 없이는 위험하니(잘못 끊으면 더 이상해진다) 직접 고치지 않는다 — 대신
     *   "띄어쓰기가 비정상적으로 없다"를 감지해서 **그 제목 하나만** 원래 템플릿 제목으로
     *   되돌린다. 나머지 제대로 된 제목들은 그대로 살아 있다(전체 폴백이 아니다).
     */
    const isSpacingBroken = (t: string): boolean => {
      if (t.length < 12) return false;
      const longestRun = Math.max(...t.split(/\s+/).map((w) => w.length));
      return longestRun >= 12; // 12자 이상 공백 없이 이어지면 비정상으로 본다
    };
    const guarded = titles.map((t, i) => {
      if (isSpacingBroken(t)) {
        console.warn(`[SECTION-TITLES] ⚠️ 띄어쓰기 누락 감지 — 템플릿으로 되돌림: "${t}"`);
        return fallback[i] ?? t;
      }
      return t;
    });
    return guarded;
  } catch (e: any) {
    console.warn('[SECTION-TITLES] 제목 재생성 실패 — 템플릿 제목 유지:', e?.message || e);
    return fallback;
  }
}

export async function generateH2TitlesFinal(
  keyword: string,
  subheadings: string[],
  maxCount?: number,
  demandSignals?: { userQuestions?: string[]; searchQueries?: string[] },
): Promise<string[]> {
  // 빈도 분석
  const freq = new Map<string, number>();
  subheadings.forEach(h => {
    const clean = h
      .replace(/^[hH]2[:\-\s]*/gi, '')  // h2:, H2-, H2 등
      .replace(/^[hH]3[:\-\s]*/gi, '')  // h3:, H3- 등
      .replace(/^H2-?\d+[:\s]*/gi, '')  // H2-1:, H21: 등
      .replace(/^\d+[.\):\s]+/g, '')    // 1., 2), 3: 등
      .replace(/^소제목[:\s]*/gi, '')   // 소제목: 등
      .replace(/^제목[:\s]*/gi, '')     // 제목: 등
      .trim();
    if (clean.length > 3 && clean.length < 50) {
      freq.set(clean, (freq.get(clean) || 0) + 1);
    }
  });

  // 빈도순 정렬
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([h]) => h);

  /**
   * 🔢 v3.8.452 — **재료가 얇으면 억지로 5개를 채우지 않는다.**
   *
   * 사용자 판단: "강제하면 억지로 없는 내용이 나올수있으니까 신뢰와 글품질이
   *   우선이야 유지할필요없어"
   *
   * 예전에는 어떤 경우에도 최소 5개였다. 쓸 내용이 2~3개뿐인 주제에서도
   * 5개를 만들라고 하면 남는 두 칸은 지어내거나 뻔한 소리로 채워진다.
   *
   * ⚠️ 다만 **"크롤이 실패한 것"과 "주제가 얇은 것"은 다르다.**
   *   수집 자체가 0건이면 얇다는 근거가 없다 — 그때는 예전처럼 5개로 둔다.
   *   (크롤 실패 때문에 멀쩡한 주제가 3섹션으로 쪼그라들면 그게 더 나쁘다.)
   * 재료의 양은 크롤 소제목뿐 아니라 **검색자 질문·연관 검색어**도 함께 본다.
   */
  const uniqueCount = sorted.length;
  const rawSignalCount = Array.isArray(subheadings) ? subheadings.length : 0;
  const demandCount = new Set([
    ...(demandSignals?.userQuestions || []),
    ...(demandSignals?.searchQueries || []),
  ].map((s) => String(s || '').trim()).filter((s) => s.length >= 4)).size;

  // 재료의 총량 — 고유 소제목 + 검색자 신호
  const materialCount = uniqueCount + demandCount;
  const noEvidence = rawSignalCount === 0 && demandCount === 0;

  let targetCount = 5;
  if (noEvidence) {
    // 판단 근거가 없다 — 예전 기본값 유지 (회귀 방지)
    targetCount = 5;
  } else if (materialCount <= 2) targetCount = 3;   // 정말 쓸 게 없는 주제
  else if (materialCount <= 4) targetCount = 4;
  else if (materialCount <= 8) targetCount = 5;
  else if (materialCount <= 12) targetCount = 6;
  else if (materialCount <= 18) targetCount = 7;
  else if (materialCount <= 25) targetCount = 8;
  else if (materialCount <= 35) targetCount = 9;
  else targetCount = 10;

  // 크롤링 신호가 많으면 위로만 조정한다 (아래로는 내리지 않는다)
  if (rawSignalCount >= 30) targetCount = Math.max(targetCount, 6);
  if (rawSignalCount >= 50) targetCount = Math.max(targetCount, 8);

  if (typeof maxCount === 'number' && Number.isFinite(maxCount) && maxCount > 0) {
    targetCount = Math.min(targetCount, Math.floor(maxCount));
  }

  // 🔥 현재 날짜 주입
  const currentYear = new Date().getFullYear();

  // 🌐 소제목 참고 데이터: 크롤링 데이터 있으면 활용, 없으면 검색 지시
  // v3.8.372: 검색자가 실제로 물어본 질문 / 실제로 검색한 키워드를 최우선 근거로 제시
  const dedupe = (list?: string[]) => [...new Set((list || [])
    .map((s) => String(s || '').replace(/^Q\.\s*/i, '').trim())
    .filter((s) => s.length >= 4 && s.length <= 80))];
  const userQuestions = dedupe(demandSignals?.userQuestions).slice(0, 15);
  const searchQueries = dedupe(demandSignals?.searchQueries).slice(0, 15);

  const demandBlock = (userQuestions.length > 0 || searchQueries.length > 0)
    ? `\n🔥🔥🔥 [최우선 근거 — 검색자가 실제로 알고 싶어하는 것] 🔥🔥🔥\n`
      + (userQuestions.length > 0
        ? `\n■ 실제 유저가 올린 질문 (네이버 지식인):\n${userQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
        : '')
      + (searchQueries.length > 0
        ? `\n■ 사람들이 실제로 함께 검색한 키워드 (자동완성):\n${searchQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
        : '')
      + `\n🔴 위 질문/검색어는 "이 키워드를 검색한 사람이 진짜 알고 싶은 것"의 직접 증거다.\n`
      + `   H2 소제목은 **이 궁금증들을 실제로 해결해주는 내용**으로 구성하라.\n`
      + `   - 여러 질문이 같은 주제면 하나의 H2로 묶어라.\n`
      + `   - 질문이 다루지 않은 주제를 굳이 넣지 마라 (검색자가 안 궁금해하는 내용).\n`
      + `   - 단, H2 제목을 질문 문장 그대로 복사하지 말고 소제목답게 다듬어라.\n`
    : '';

  const subheadingReference = sorted.length > 0
    ? `${demandBlock}\n🔍 참고할 크롤링 소제목 (경쟁 글 구조 — 보조 자료):\n${sorted.join('\n')}\n\n===== H2 소제목 후보 =====\n${sorted.slice(0, targetCount).map((h, i) => `${i + 1}. ${h}`).join('\n')}\n=====\n\n위 자료를 분석하여 **서로 다른 정보**를 담은 H2 소제목 ${targetCount}개를 만드세요.${userQuestions.length > 0 || searchQueries.length > 0 ? ' 경쟁 글 소제목을 베끼지 말고, 검색자 궁금증(최우선 근거)을 먼저 반영하세요.' : ''}`
    : `${demandBlock}\n🔍 크롤링 소제목이 부족합니다. ${userQuestions.length > 0 || searchQueries.length > 0 ? '위 검색자 질문/검색어를 근거로' : '키워드와 일반적인 검색 의도 패턴을 기준으로'} 핵심 소주제 ${targetCount}개를 만들되, 확인되지 않은 최신 트렌드/수치/마감일은 새로 만들지 마세요.`;

  // 🎯 검색 의도 자동 분류 — 의도별로 다른 H2 아키타입 제시
  const { buildIntentPromptBlock } = require('../search-intent-classifier');
  // v3.8.374: 키워드 정규식만 보던 의도 분류에 실제 수집 질문/검색어를 함께 넘긴다.
  const intentBlock = buildIntentPromptBlock(keyword, { userQuestions, searchQueries });
  const topicProfile = inferH2TopicProfile(keyword);
  const topicProfileBlock = topicProfile
    ? `\n🎯🎯🎯 **키워드 분야 감지: ${topicProfile.label}**\n- ${topicProfile.promptGuidance}\n- H2 금지어: ${topicProfile.bannedTerms.join(', ')}\n`
    : '';

  // v3.7.21: 키워드 우측 한정자(혜택/신청방법/조건 등) 감지 → 강제 스코프 제한 블록
  const scope = detectKeywordScope(keyword);
  const scopeBlock = scope
    ? `\n🎯🎯🎯 **스코프 한정 — 절대 위반 금지!**:\n키워드가 "${scope.qualifier}"으로 끝나므로 ${scope.instruction}\n위 지시를 어기고 다른 주제(예: ${scope.qualifier === '혜택' ? '신청방법/대상/조건' : scope.qualifier === '신청방법' ? '혜택/대상' : '혜택/신청방법'})를 H2에 포함하면 즉시 실격.\n`
    : '';
  if (scope) {
    console.log(`[H2-OUTLINE] 🎯 키워드 한정자 감지: "${scope.qualifier}" → 스코프 제한 적용`);
  }

  const prompt = `
키워드: ${keyword}
${scopeBlock}${topicProfileBlock}${intentBlock}
${subheadingReference}

🔴🔴🔴 **핵심 규칙 - 중복 금지 & 다양성 확보!**:
1. 각 H2는 완전히 다른 주제/관점을 다뤄야 함
2. 같은 내용을 다르게 표현하지 마세요 (예: "방법", "하는 법" 1개만)
3. **단조로운 패턴 피하기**: 모든 제목을 "OO란?", "OO 방법"으로 똑같이 끝내지 마세요.
4. **검색 의도에 맞는 아키타입 우선 사용** (위 "권장 H2 아키타입" 참조). 의도와 무관한 아래 일반 아키타입은 보조 용도:
   - [Q&A형] "사람들이 가장 많이 물어보는 질문 TOP 3"
   - [심층 분석형] "왜 전문가들은 OO를 추천할까?"
   - [체크리스트형] "시작하기 전 반드시 확인해야 할 5가지"
   - [비교 분석형] "OO vs OO, 나에게 맞는 것은?"
   - [핵심 정리형] "한눈에 보는 핵심 포인트 총정리"

요구사항:
1. 각 H2가 위 아키타입처럼 서로 완전히 다르고 흥미로운 정보를 다룰 것!
2. SEO 최적화, 각 15~20자 이내
3. 🔴🔴🔴 번호/접두어 금지! 순수한 제목 텍스트만!
4. 검색자가 당장 클릭하고 싶을 만큼 매력적인 문장형 제목을 활용할 것
5. 🔴 연도: ${currentYear}년 외 과거 연도 금지
6. 이미 마감된 사업/이벤트/일정은 소제목에 포함 금지. 현재 진행 중이거나 미래 일정만!
7. 한글과 영문/숫자만 사용. 중국어 한자(漢字) 절대 금지!
8. 내부일관성 보일러플레이트 금지: "무엇이고 왜 중요할까", "자격·조건·핵심 정보", "실전 사례와 단계별 적용법", "핵심 포인트 한 줄 정리", "함께 보면 좋은 관련 정보" 같은 고정 템플릿을 그대로 쓰지 말 것!

JSON만(${targetCount}개 문자열 배열):
`;

  try {
    const response = await callGeminiWithRetry(prompt);
    const json = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const titles = JSON.parse(json) as string[];
    // 🔥 모든 접두어 공격적으로 제거
    const cleanedTitles = titles.map(t => t
      .replace(/^[hH]2[:\-\s]*/gi, '')
      .replace(/^[hH]3[:\-\s]*/gi, '')
      .replace(/^H2-?\d+[:\s]*/gi, '')
      .replace(/^\d+[.\):\s]+/g, '')
      .replace(/^소제목[:\s]*/gi, '')
      .replace(/^제목[:\s]*/gi, '')
      .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')
      .trim()
    ).filter(t => t.length > 0);

    const scopeViolations = scopedTitlesPostfix(cleanedTitles, scope);
    const profileViolations = cleanedTitles.filter((t) => isH2TopicProfileViolation(t, topicProfile));
    const violations = Array.from(new Set([...scopeViolations, ...profileViolations]));

    if (violations.length > 0) {
      const scopeLabel = scope ? `스코프 "${scope.qualifier}"` : '스코프';
      const profileLabel = topicProfile ? `분야 "${topicProfile.label}"` : '분야';
      console.warn(`[H2-OUTLINE] ⚠️ ${scopeLabel}/${profileLabel} 위반 H2 ${violations.length}/${cleanedTitles.length}개 감지: ${violations.join(' / ')} — 재시도`);
      const retryPrompt = `${prompt}

🚨🚨🚨 **재시도 — 직전 H2가 키워드 의도와 맞지 않습니다**
직전 응답에서 아래 H2는 사용 금지입니다:
${violations.map((v) => `  - ${v}`).join('\n')}

이번에는 "${keyword}" 키워드의 실제 검색 의도에 맞는 H2 ${targetCount}개만 다시 만드세요.
${scope ? `- 모든 H2는 "${scope.qualifier}" 범위만 다뤄야 합니다.` : ''}
${topicProfile ? `- 분야는 "${topicProfile.label}"입니다. 금지어(${topicProfile.bannedTerms.join(', ')})를 쓰지 마세요.` : ''}
- 고정 템플릿("무엇이고 왜 중요할까", "자격·조건·핵심 정보", "함께 보면 좋은 관련 정보") 사용 금지.
JSON만 반환:`;

      try {
        const retryResponse = await callGeminiWithRetry(retryPrompt);
        const retryJson = retryResponse.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
        const retryRaw = JSON.parse(retryJson) as string[];
        const retryCleaned = retryRaw.map(t => t
          .replace(/^[hH]2[:\-\s]*/gi, '')
          .replace(/^[hH]3[:\-\s]*/gi, '')
          .replace(/^H2-?\d+[:\s]*/gi, '')
          .replace(/^\d+[.\):\s]+/g, '')
          .replace(/^소제목[:\s]*/gi, '')
          .replace(/^제목[:\s]*/gi, '')
          .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')
          .trim()
        ).filter(t => t.length > 0);
        return finalizeH2TitlesWithIntentGuard(keyword, retryCleaned, targetCount, scope, topicProfile);
      } catch {
        console.warn(`[H2-OUTLINE] ⚠️ 재시도 실패 — 의도 기반 fallback으로 보완`);
        return finalizeH2TitlesWithIntentGuard(keyword, cleanedTitles, targetCount, scope, topicProfile);
      }
    }

    return finalizeH2TitlesWithIntentGuard(keyword, cleanedTitles, targetCount, scope, topicProfile);
  } catch {
    const sortedFallback = sorted.slice(0, targetCount).map(s => s.split(' (')[0]).filter((h): h is string => !!h);
    return finalizeH2TitlesWithIntentGuard(keyword, sortedFallback, targetCount, scope, topicProfile);
  }
}

// v3.7.21: cleaned titles \uC911 \uC2A4\uCF54\uD504 \uC704\uBC18 \uD56D\uBAA9\uB9CC \uCD94\uCD9C\uD558\uB294 \uD5EC\uD37C (\uC778\uB77C\uC778 \uD074\uB85C\uC800\uBCF4\uB2E4 \uC7AC\uC0AC\uC6A9 \uAC00\uB2A5)
function scopedTitlesPostfix(titles: string[], scope: { qualifier: string } | null): string[] {
  if (!scope) return [];
  return titles.filter((t) => !validateScopeText(t, scope));
}

const h3Cache = new Map<string, string[]>();

export async function generateH3TitlesFinal(h2: string, keyword: string): Promise<string[]> {
  const fallback = [`${h2} 핵심 정리`, `실전 적용 방법`, `주의사항 정리`];
  const cacheKey = `${keyword}||${h2}`;

  if (h3Cache.has(cacheKey)) {
    return h3Cache.get(cacheKey)!;
  }

  const prompt = `키워드: ${keyword}
H2 소제목: ${h2}

위 소제목에 대한 H3 부제목 3개를 만드세요.
- 각 H3는 서로 다른 관점 (개념/실전/주의점 등)
- 10~20자, 순수 텍스트만
- JSON 문자열 배열로만 출력: ["제목1", "제목2", "제목3"]`;

  try {
    const raw = await callGeminiWithRetry(prompt);
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return fallback;

    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length < 3) return fallback;

    const titles = parsed
      .slice(0, 3)
      .map((t) => String(t).replace(/^#+\s*/, '').replace(/^\d+[.\):\s]+/, '').replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '').trim())
      .filter((t) => t.length > 0);

    if (titles.length < 3) return fallback;

    h3Cache.set(cacheKey, titles);
    return titles;
  } catch {
    return fallback;
  }
}

// 🔥🔥🔥 전체 글을 단 1회 API 호출로 생성하는 초고속 함수
export async function generateAllSectionsFinal(
  keyword: string,
  h2Titles: string[],
  crawledContents: string[],
  onLog?: (s: string) => void,
  contentMode?: string,
  draftContent?: string,
  sectionGuideBlock?: string,
  skipQualityBoost?: boolean
): Promise<{
  introduction: string;
  conclusion: string;
  sections: Array<{
    h2: string;
    h3Sections: Array<{
      h3: string;
      content: string;
      tables: FinalTableData[];
      cta?: FinalCTAData;
    }>;
  }>;
}> {
  const reference = crawledContents.join('\n\n').slice(0, 12000);

  const h2List = h2Titles.map((h2, i) => `${i + 1}. ${h2}`).join('\n');

  // 🌐 참고 데이터: 크롤링 데이터 있으면 활용, 없으면 검색 지시
  // v3.8.361: 본문에 "참고 자료/제공된 자료/본문 근거" 같은 메타 표현이 그대로 새어나가던 심각한 문제 fix
  const contentReference = reference.trim().length > 100
    ? `===== 백그라운드 컨텍스트 (독자에게 절대 언급 금지) =====\n${reference}\n=====\n\n위 컨텍스트를 참고해서 자연스럽게 서술하되 다음을 절대 지키세요:\n\n🚫🚫🚫 본문에 절대 쓰지 말 것 (프롬프트 유출):\n- "제공된 참고 자료에는~", "제공된 자료에는~", "본문 근거만으로는~", "제시되지 않았어요", "근거로 확인되지 않아요", "참고 데이터에 없어요"\n- "정확한 산식이 나와 있지 않다", "본문에서 확인되지 않는다" 같은 자기 참조\n- 독자는 이 컨텍스트의 존재를 모릅니다. AI가 자기 프롬프트를 읊는 것처럼 보이면 즉시 신뢰가 무너집니다.\n\n✅ 정보가 부족할 때 올바른 태도 (v3.8.374 — 이걸 어기면 "읽어도 남는 게 없는 글"이 됩니다):\n- 확인 안 된 수치를 지어내는 것도 금지지만, "공식 사이트에서 확인하세요"로 문단을 끝내는 것도 똑같이 금지입니다. 둘 다 독자에게 아무것도 주지 않습니다.\n- 수치를 못 쓰는 상황이면 반드시 아래 중 최소 2개를 대신 제공하세요:\n  ① 판단 기준 — 어떤 조건이면 A이고 어떤 조건이면 B인지 갈림길을 명시\n  ② 절차 — 무엇을, 어디서, 어떤 순서로 하는지 (메뉴 이름·서류 이름 수준까지)\n  ③ 확인 경로 — "공식 사이트"가 아니라 정확한 기관명 + 메뉴 경로 + 준비물/문의처\n  ④ 실패 사례 — 사람들이 여기서 무엇을 놓쳐서 손해를 보는지\n- 위 컨텍스트에 실제 숫자·기간·금액·기관명이 있으면 반드시 본문에 그대로 옮기세요. 숫자를 빼고 두루뭉술하게 요약하지 마세요.\n- 🚫 금지 마무리: "자세한 내용은 공식 사이트에서 확인하세요", "상황에 따라 달라질 수 있습니다", "미리 확인하는 것이 중요합니다" 로 문단/섹션을 끝내기`
    : `🌐 "${keyword}" 주제의 일반 상식과 공식 원칙을 기반으로 서술하세요. 확인되지 않은 수치/마감일/금액은 지어내지 마세요.\n\n✅ 단, 수치를 못 쓴다고 "공식 사이트에서 확인하세요"로 때우지 마세요. 대신 판단 기준(어떤 조건이면 A/B인지), 절차(무엇을 어디서 어떤 순서로), 정확한 기관명·메뉴 경로·준비물, 사람들이 놓쳐서 손해 보는 지점을 구체적으로 서술하세요.\n\n🚫 본문에 절대 쓰지 말 것: "제공된 자료에는~", "본문 근거만으로는~", "참고 데이터에~" 등 프롬프트 메타 표현 (독자는 이 지시의 존재를 모릅니다).`;

  // 📝 내부 일관성 모드 — 단일 글 정보 전달 구조 (시리즈 지시 제거)
  const internalModePromptBlock = contentMode === 'internal' ? `

📝📝📝 [내부 일관성 모드 — 체계적 정보 전달] 📝📝📝

🎯 **"${keyword}" 주제를 체계적으로 전달하는 완결형 글을 작성합니다.**

🔴🔴🔴 **핵심 규칙**:
1. **일관된 톤**: 지식을 나누는 선배 같은 따뜻하고 전문적인 톤
2. **자기 완결성**: 이 한 편의 글만 읽어도 주제를 이해할 수 있게 작성
3. **연결 문구 절대 금지**: "지난번에", "이전 글에서", "다음 편에서", "다음 장" 등 존재하지 않는 글을 언급하는 모든 표현 금지!
4. **현재 시점 집중**: 오직 이 글의 주제만 다루며, 가공의 시리즈 맥락을 만들지 마세요

📝 **섹션 구조 가이드**:
- 각 H2는 핵심 지식을 독립적으로 전달
- 구체적 수치/데이터/사례를 풍부하게 활용
- 불릿 포인트와 표로 가독성 극대화

🔥 **톤 규칙**:
- "~해요", "~거든요" 친근하면서도 전문적인 말투
- 전체 글에서 동일한 깊이와 용어 일관성 유지

` : '';

  // 🛡️ 애드센스 승인 전용 E-E-A-T 프롬프트 블록
  const adsenseModePromptBlock = contentMode === 'adsense' ? `

🛡️🛡️🛡️ [애드센스 승인 전용 E-E-A-T 끝판왕 모드] 🛡️🛡️🛡️

🎯 **이 글은 Google 애드센스 승인을 목표로 합니다!**
2026년 Google 애드센스 승인 기준에 100% 부합하는 최고 품질의 글을 작성해야 합니다.

🔴🔴🔴 **애드센스 승인 핵심 규칙**:
1. **E-E-A-T 극대화**: Experience(경험), Expertise(전문성), Authoritativeness(권위), Trustworthiness(신뢰) 를 매 섹션에 녹여내세요.
2. **CTA/광고성 요소 완전 차단**: "바로가기", "신청하기", "다운로드" 같은 행동 유도 문구나 버튼 HTML 절대 금지!
3. **최소 6,000자 이상**: 전체 본문 순수 텍스트 기준 6,000자 이상으로 풍성하게 작성
4. **중립적/교육적 콘텐츠**: 상업적 의도가 전혀 보이지 않는 순수 정보 제공 글

📝 **7섹션 구조별 작성 가이드**:
- **섹션 1: 주제 소개** (350자+): 이 주제가 왜 중요한지, 독자가 이 글에서 얻을 수 있는 핵심 가치를 설명. "2026년 N월 기준" 날짜 필수. (허위 경력/자격 주장 금지!)
- **섹션 2: [주제] 완전히 이해하기** (1000자+): 핵심 개념 정의(초보자 눈높이) + 중요한 3가지 이유(데이터) + 흔한 오해 바로잡기 + 신뢰 출처 인용
- **섹션 3: 심층 분석** (1500자+): 검색에서 확인한 실제 데이터와 수치, 공식 출처 기반 인사이트, 구체적 팩트
- **섹션 4: 단계별 실행 가이드** (1000자+): Step 1~N 상세 설명, 각 단계 주의점, 문제 해결 방법
- **섹션 5: 비교 분석 및 추천** (1000자+): 장단점 공평 분석, 비교 표 포함, 객관적 추천
- **섹션 6: FAQ** (800자+): 실제 검색되는 질문 6-8개, 각 답변 2-4문장, 간결하고 정확
- **섹션 7: 마무리 및 추가 리소스** (1300자+): 핵심 3줄 요약, 신뢰 외부 출처 3~5개, 마지막 업데이트 날짜

🚫🚫🚫 **애드센스 모드 절대 금지**:
- ❌ CTA 버튼/박스 HTML (button, 바로가기 링크 등)
- ❌ 상업적 문구 ("지금 신청하세요", "무료 다운로드" 등)
- ❌ 외부 서비스 홍보 (앱, 커머스 등)
- ❌ 추측이나 허위 정보 (모든 정보는 검증된 데이터 기반)
- ❌ 애니메이션/인터랙티브 CSS (hover 효과 포함)

` : '';

  // 🛍️ 쇼핑/구매유도 모드 전용 프롬프트 블록
  const shoppingModePromptBlock = contentMode === 'shopping' ? `

🛍️🛍️🛍️ [쇼핑/구매유도 끝판왕 모드 — 7단계 구매 퍼널] 🛍️🛍️🛍️

🎯 **이 글은 구매 전환을 목표로 합니다!** 독자가 자연스럽게 구매를 결심하도록 7단계 퍼널로 구성하세요.

🔴🔴🔴 **쇼핑 모드 핵심 규칙**:
1. **10년 경력 쇼핑몰 MD 페르소나**: 제품의 본질을 꿰뚫는 전문가 시점
2. **구매 심리 자극**: FOMO(놓칠까봐 두려운 심리), 사회적 증거(후기/평점), 가격 앵커링
3. **시각적 비교**: 스펙 비교표, 장단점 표, 별점 바를 적극 활용

📝 **7단계 섹션별 가이드**:
- **① 도입 — 문제 인식 & 후킹** (800자+): 독자의 구매 고민을 정확히 짚어내는 공감 도입
- **② 제품 소개 & 핵심 스펙** (1200자+): 제품 스펙 카드 형태로 핵심 정보 정리, 경쟁 제품과 차별점
- **③ 비교 분석 & 선택 가이드** (1500자+): 비교 테이블 필수! A vs B vs C 구조, 용도별 추천
- **④ 실사용 후기 & 사회적 증거** (1200자+): 실제 사용 시나리오, 장단점 솔직 분석
- **⑤ 가격 & 구매 꿀팁** (1000자+): 할인 정보, 구매 시기, 가성비 분석
- **⑥ FAQ & 구매 저항 해소** (800자+): 실제 구매 전 궁금한 질문 5-7개
- **⑦ 최종 구매 유도 & CTA** (500자+): 명확한 결론과 행동 유도

🎨 **필수 시각 요소** (tables 필드 활용):
- 제품 스펙 비교표 (최소 1개)
- 장단점 정리 표 (최소 1개)
` : '';

  /**
   * 🔎 v3.8.478 — 구글 디스커버 모드.
   *
   * 검색과 최적화 방향이 갈리는 지점이 있어서 별도 모드로 둔다 —
   * 디스커버에는 쿼리가 없으므로 키워드 앞배치가 이득이 없고, 공식 정책이
   * 클릭베이트·선정성·핵심 감추기를 명시적으로 감점한다.
   * 규칙 원문과 근거는 discover-mode.ts 주석에 있다.
   */
  const discoverModePromptBlock = contentMode === 'discover'
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ? (require('./discover-mode') as typeof import('./discover-mode')).buildDiscoverBodyBlock(new Date().getFullYear())
    : '';

  // 🔄 페러프레이징 모드 전용 프롬프트 블록
  const draftReference = contentMode === 'paraphrasing' && draftContent
    ? `\n===== 원본 초안 (페러프레이징 대상) =====\n${draftContent.slice(0, 8000)}\n=====\n`
    : '';

  const paraphrasingModePromptBlock = contentMode === 'paraphrasing' ? `

🔄🔄🔄 [페러프레이징 끝판왕 모드 — 원문 완전 재구성] 🔄🔄🔄

🎯 **목표: 원문 유사도 0% + 검색 순위 더 높게!**
${draftContent ? '위의 ===== 원본 초안 ===== 을 기반으로 완전히 새로운 글을 작성하세요.' : '키워드를 기반으로 기존 글과 중복되지 않는 완전히 새로운 글을 작성하세요.'}

🔴🔴🔴 **페러프레이징 핵심 규칙**:
1. **문장 구조 85%+ 변경**: 원문의 문장 구조를 완전히 뒤집으세요 (능동↔수동, 주어 변경, 문장 합치기/쪼개기)
2. **어휘 75%+ 교체**: 동의어, 유의어로 전면 교체. 전문 용어만 유지
3. **새로운 콘텐츠 25-35% 추가**: 원문에 없는 새로운 인사이트, 데이터, 사례를 추가
4. **구조적 재편성**: 섹션 순서, 논리 흐름을 원문과 완전히 다르게 재배치

📝 **6단계 재구성 가이드** (각 섹션 최소 800자):
- **① 핵심 개요**: 원문과 완전히 다른 도입부. 새로운 앵글에서 주제 접근
- **② 심층 분석**: 원문 내용을 심화하되, 새로운 데이터와 사례 추가
- **③ 다른 관점**: 원문과 다른 관점에서 주제 분석 (반대 의견, 다른 각도)
- **④ 체계적 정리**: 원문의 핵심을 유지하면서 완전히 다른 논리 구조로 재배치
- **⑤ 최신 트렌드 & 추가 정보**: 원문에 없는 최신 트렌드, 통계, 전문가 견해
- **⑥ 종합 결론**: 원문과 다른 결론. 새로운 통찰과 행동 유도

🚫 **절대 금지**: 원문 문장을 그대로 복사, 단순 단어 치환, 문장 순서만 바꾸기
` : '';

  // 🌐 SEO 최적화(외부 크롤링) 모드 — 검색 의도 기반 아키타입
  const externalModePromptBlock = (contentMode === 'external' || !contentMode) ? `

🌐🌐🌐 [SEO 최적화 모드 — 검색 의도 기반 정보 전달] 🌐🌐🌐

🎯 **이 글의 목표: Google 검색 상위 노출 + 검색자의 의도 완벽 충족**

🔴🔴🔴 **SEO 모드 핵심 규칙**:
1. **검색 의도 파악**: "${keyword}"가 정보형(무엇인지 알고 싶다)·탐색형(비교하고 싶다)·거래형(구매/실행하고 싶다) 중 어느 의도인지 판단하여 구조를 맞추세요
2. **두괄식 답변**: 각 H2 첫 문단에서 검색자가 찾는 핵심 답을 즉시 제공 (스크롤 없이 답 노출)
3. **구체성 = 신뢰**: 두루뭉술한 일반론 금지. 숫자·사례·출처를 매 섹션에 주입
4. **다양한 H2 아키타입 혼용**: [정의형] [비교분석형] [가이드형] [체크리스트형] [데이터형] 등을 섞어 단조로움 제거

📝 **검색 의도별 권장 구조**:
- **정보형 (~이란? ~뜻)**: 정의 → 원리 → 적용 → 주의점
- **탐색형 (~추천, ~비교)**: 기준 → 비교표 → 장단점 → 용도별 추천
- **거래형 (~사는 법, ~하는 법)**: 준비 → 절차 → 주의사항 → 대안

🚫 **SEO 모드 금지**: 구매 명령형 CTA ("지금 사세요"), 과장 표현 ("최고", "무조건"), 개인 경험 허위 서술
` : '';

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const prompt = `
🎯 키워드: ${keyword}

📅 오늘 날짜: ${todayStr}
⚠️ 날짜 규칙: 오늘(${todayStr}) 이전에 마감된 사업/이벤트/일정은 언급하지 마세요. 현재 진행 중이거나 미래 일정만 다루세요.
🚫 [v3.8.437] **날짜 꼬리표를 본문에 쓰지 마세요.**
   "8월 3일 기준", "2026년 8월 현재", "○월 ○일 기준으로는" 같은 표현은 신뢰를 주는 게 아니라
   **AI가 쓴 티만 냅니다.** 사람이 쓴 후기·리뷰에는 그런 말이 붙지 않습니다.
   시점이 꼭 필요한 경우(한정 행사 등)에만 자연스럽게 문장 안에 녹이세요.
   예) ❌ "8월 3일 기준 가격은 29,900원입니다."
       ✅ "지금은 29,900원인데, 세일이 끝나면 오를 수 있어요."
⚠️ 언어 규칙: 반드시 한국어 한글과 영문/숫자만 사용하세요. 중국어 한자(漢字), 일본어는 절대 사용 금지!

📌 구성해야 할 요소:
1. 글 전체의 서론 (Introduction)
2. H2 소제목 리스트에 따른 본문 섹션들
${h2List}
3. 글 전체의 결론 (Conclusion)

${contentMode === 'paraphrasing' && draftContent ? draftReference : contentReference}
${contentMode === 'paraphrasing' && draftContent ? '' : draftReference}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴🔴🔴 **[모드별 최우선 지시]** — 아래 모드 규칙이 이후 모든 일반 지시보다 우선입니다
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${externalModePromptBlock}${internalModePromptBlock}${adsenseModePromptBlock}${shoppingModePromptBlock}${paraphrasingModePromptBlock}${discoverModePromptBlock}${sectionGuideBlock || ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${SUBSTANCE_FIRST_PASS_RULES}${FRESHNESS_RULES}${DECISION_SUPPORT_RULES}${STORYSCOPE_STRUCTURE_RULES}

🔴🔴🔴 [10억 점 ${
  contentMode === 'adsense' ? '전문 정보/E-E-A-T'
  : contentMode === 'shopping' ? '쇼핑 전환'
  : contentMode === 'internal' ? '내부 일관성 정보 전달'
  : contentMode === 'paraphrasing' ? '페러프레이징 재구성'
  : contentMode === 'discover' ? '구글 디스커버 피드'
  : '검색 의도 기반 SEO'
} 블로그 완벽 작성 가이드 (일반 규칙)] 🔴🔴🔴

[1. 가독성(Readability)의 극한화 - 체류시간 폭발]
- **초단문 지향**: 모바일 독자를 위해 한 문장은 절대 2~3줄을 넘지 않게 짧게 끊어 치세요. (호흡을 짧게)
- **시각적 여백 (Breathing Space)**: 단락(Paragraph)은 최대 3~4문장 단위로 무조건 줄바꿈(<p>)을 넣어 텍스트 벽(Wall of Text) 현상을 완벽히 방지하세요.
- **소분류 활용**: 글 중간중간 글머리 기호(<ul>, <li>)나 숫자 리스트를 적어도 1회 이상 섞어서 가독성을 극대화하세요.
- **핵심 정보 선배치 (두괄식)**: 각 H3 섹션의 첫 문단에서 가장 중요한 결론/인사이트를 먼저 때리고 시작하세요.

[2. '진짜 사람' 같은 극사실적 어조(Ultra-Human Tone)]
- **완벽한 구어체 전환**: 기계 번역투, AI 특유의 장황한 설명체("중요한 사실입니다", "다양한 이점이 있습니다") 철저히 배제.
- **디테일한 공감**: "많이들 헷갈리시죠?", "여기서 다들 한 번씩 놓치세요" 와 같이 독자와 공감하는 어조를 사용하세요. 단, 직접 경험하지 않은 것을 경험한 것처럼 쓰지 마세요. (v3.8.529: "~가 가장 중요한 포인트예요" 류 예시는 교훈 떠먹이기 — 구조 규칙과 충돌해 교체)
- **결론부 여운 강화 (Conclusion)**: 서론은 300~500자로 매력적인 훅(Hook)을 넣고, 결론은 200~400자로 뻔한 인사말("도움이 되셨길 바랍니다") 대신 ${contentMode === 'adsense' ? '핵심 요약과 추가 학습 리소스 제안으로 교육적으로 클로징하세요. CTA/행동 유도 문구는 절대 금지!' : '명확한 Next Action(다음 행동 유도)이나 꿀팁으로 강력하게 클로징하세요.'}

[3. SEO 정보 밀도(Density)와 신뢰성(Trust) 극대화]
- **밀도 높은 데이터 주입**: 두루뭉술한 표현 -> 구체적인 표현으로 치환. 단, 숫자/통계는 반드시 Google 검색에서 확인한 실제 데이터만 사용! 출처를 알 수 없는 숫자는 절대 만들어내지 마세요.
- **[전문가의 팁] 마이크로 요소**: 각 H2마다 본문 흐름 중 최소 1번은 시선을 확 끄는 인용구 <blockquote> (예: "앗, 여기서 꿀팁 한 가지!" 또는 "실전 주의사항:")를 배치하여 체류시간을 높이세요.
- 🔴 절대금지: 본문에 "20년차", "1억", "전문가" 등 작가의 자격증명/거짓 이력을 언급하지 마세요! E-E-A-T는 글의 구체성에서 나옵니다.

[4. 본문(H3) 구조 및 길이 규칙]
- **각 H3 본문은 반드시 ${contentMode === 'shopping' || contentMode === 'adsense' || contentMode === 'paraphrasing' ? '800~1500자' : '600~1000자'}** 사이의 알찬 내용으로 채우세요.
- 같은 내용 반복 절대 금지. 모든 H3는 독립적이고 100% 새로운 인사이트로 채우세요.
- "결론적으로", "정리하면", "요약하면" 등 기계적인 반복 연결사 금지.

🔥 [표 & 체크리스트 활용 지침 - 스크롤 늦추기]
- 중요한 스펙, 가격, 단계, 장단점 등은 글로만 서술하지 말고 표(Table)나 체크리스트로 정리하세요.
- 각 H3마다 필요하다면 1개 정도의 표를 포함할 수 있습니다. (JSON 구조의 "tables" 필드에 데이터 넣기)
- **독자가 눈으로 멈춰서 한 번 더 읽게 만드는 것이 목표입니다.**

🚨🚨 [절대 규칙 — 표는 본문을 대신하지 못합니다]
- **"content" 는 어떤 경우에도 비워두면 안 됩니다.** 표를 넣기로 한 H3 도 마찬가지입니다.
- 섹션 지시에 "비교표 필수", "가격표 필수" 같은 말이 있어도 그건 **본문에 더해서** 넣으라는 뜻입니다.
  표만 내놓고 content 를 비우면 독자는 제목 아래 빈 화면을 봅니다 — 실제로 그런 사고가 있었습니다.
- 표가 있는 H3 의 content 는 이렇게 구성하세요:
  ① 표를 왜 봐야 하는지 한 문단 (무엇을 비교하는지, 어떤 기준인지)
  ② 표에서 **읽어낼 결론** 한 문단 (숫자만 나열하지 말고 "그래서 어느 쪽인지"를 말한다)
  ③ 예외·주의점 한 문단
  → 표를 빼도 글이 성립해야 합니다. 표는 이해를 돕는 보조입니다.

🔥 [H3 본문 다양화 지침]
- 딱딱한 5단계 구조를 버리고, **섹션의 성격에 맞게 톤과 구조를 다양하게** 섞으세요!
- 예시 아키타입:
  1. [가이드/절차형]: 구체적인 스텝바이스텝.
  2. [비교분석형]: A와 B의 장단점, 나에게 맞는 선택.
  3. [체이스크리스트형]: 확인해야 할 필수 항목들 나열 및 점검.
  4. [스토리텔링형]: 개인적인 공감대에서 시작해 팩트로 넘어가는 자연스러운 구성.
  5. [데이터 전달형]: 정확한 수치와 팩트를 중심으로 한 신뢰감 있는 전개.

🚫🚫🚫 [AI티 제거 - 최우선!] 🚫🚫🚫
⛔ 본문 content에 이모지 사용 절대 금지! (🔥💡📋✅💎👉 등 모든 이모지!)
⛔ 문단 앞에 라벨/접두어 붙이기 금지! ("후킹:", "핵심:", "실전:" 등)
⛔ 번호 이모지 금지! (1️⃣, 2️⃣ 등)
⛔ 글 흐름을 끊는 어떤 마커도 금지!
⛔ h3Sections[].content 안에 <h1>, <h2>, <div>, <img>, <button>, <a href="구매">, <iframe>, <script>, <form>, <input> 태그 출력 절대 금지!
   - H2는 시스템이 자동 삽입함
   - 상품 카드/가격 표시/구매 버튼 HTML 절대 생성 금지 (시스템이 별도 블록으로 렌더)
   - content는 오직 <p>, <ul>, <ol>, <li>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <strong>, <em>, <br> 만 허용!
⛔ 상품 링크 필요 시 <a href="..."> 텍스트 </a> 형태로만 (스타일/버튼/이미지 포함 금지)
⛔ content 첫머리에 "1. ", "2. " 같은 숫자 접두어 금지! H2 번호는 시스템이 자동 부여함.
✅ 순수한 텍스트로만 자연스럽게 작성!

🚫 [금지 사항] - 필수 준수!
- 150자 이하의 빈약한 문단
- "~입니다", "~합니다" 딱딱한 말투 (→ "~해요", "~거든요"로)
- 근거 없는 과장 ("최고", "완벽", "무조건")
- 🔴🔴🔴 절대금지: "다음은", "다음 장에서", "넘어가서", "굳혀볼게요" 등 섹션 연결 문구!
- 각 블록은 독립적으로 완결되어야 함 - 다른 섹션 언급 금지!
- 🚫 [v3.8.423] 뻔한 상투구로 문장 시작 금지! "말할 필요도 없이", "두말할 나위 없이",
  "누구나 다 아는 사실이지만", "생각보다 많은 분들이", "의외로 많은 분들이", "굳이
  설명하지 않아도", "누구에게나 필요한", "이제는 선택이 아니라 필수" — 이런 문장은
  검색해서 이 글을 찾아온 독자에게 정보량이 0입니다. 재생성 단계에서 다시 걸러내는
  게 아니라 **처음부터 쓰지 마세요.**
  예) ❌ "말할 필요도 없이 여름엔 에어컨이 필수죠." → ✅ "실외기 소음 42dB 이하 제품만
      야간 사용이 편해요."

JSON 형식 (이 구조 정확히 따르기!):
{
  "introduction": "<p>서론 내용 1</p><p>서론 내용 2...</p>",
  "conclusion": "<p>결론 내용 1</p><p>행동 유도 등...</p>",
  "sections": [
    {
      "h2": "첫 번째 H2 제목",
      "h3Sections": [
        {"h3": "10~15자 H3 제목", "content": "<p>위 다채로운 본문 포맷 중 하나를 선택해 충분한 분량으로 작성</p>...", "tables": []}
      ]
    },
    ...총 ${h2Titles.length}개의 H2
  ]
}

🚨🚨🚨 최종 체크리스트 (10억 점 기준) 🚨🚨🚨
□ 모바일 가독성을 위해 문장이 짧고 단락 구분이 확실한가? (<p> 떡칠 방지, 여백 최적화)
□ "많이들 헷갈리시죠?" 같은 진짜 사람이 쓴 듯한 구어체가 묻어나는가?
□ 각 H3 본문당 글자 수가 ${contentMode === 'shopping' || contentMode === 'adsense' || contentMode === 'paraphrasing' ? '800자 이상 1500자 이내' : '600자 이상 1000자 이내'}(충분한 분량)인가?
□ 중간중간 독자의 스크롤을 멈출 <blockquote> 꿀팁 박스와 <ul> 리스트가 존재하는가?
□ 서론과 결론이 기계적이지 않고, 매력적인 훅과 네비게이션 역할을 하는가?

🔴🔴🔴 **상단의 [모드별 최우선 지시] 블록이 이 일반 규칙보다 우선합니다.** 섹션별 상세 지시(필수 요소, 역할, 최소 글자수)가 있다면 반드시 해당 H2 섹션에 그대로 적용하세요.

JSON만 출력 (설명/마크다운 금지):
`;

  // v3.5.94 — JSON 추출 강화: brace counting + 문자열 내 escape 처리
  //   기존: indexOf('{') + lastIndexOf('}') → AI가 JSON 끝에 explanation 붙이면 잘못된 } 위치 (position 8383 같은 버그)
  //   변경: 첫 { 부터 시작해 brace depth 추적, 문자열 안의 } 는 무시 → 진짜 JSON 종료 위치 정확히 검출
  //   추가: trailing comma 제거 + 0x00~0x1F 제어문자 제거 (JSON.parse가 거부하는 케이스)
  const extractJsonObject = (text: string): string => {
    let cleaned = (text || '').trim()
      .replace(/```json\s*\n?/g, '')
      .replace(/```\s*\n?/g, '')
      // 제어 문자 제거 (탭/CR/LF는 보존)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    const first = cleaned.indexOf('{');
    if (first === -1) return cleaned;

    // Brace counting — 문자열 내 따옴표/escape 고려
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;

    for (let i = first; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }

    let result = end !== -1 ? cleaned.slice(first, end + 1) : cleaned.slice(first);
    // trailing comma 제거 — JSON spec 위반이지만 AI가 자주 출력
    result = result.replace(/,(\s*[}\]])/g, '$1');
    return result;
  };

  const escapeJsonStringControlChars = (value: string): string => {
    let output = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i] || '';
      if (escaped) {
        output += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        output += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        output += ch;
        continue;
      }
      if (inString) {
        if (ch === '\n' || ch === '\r') {
          output += '\\n';
          continue;
        }
        if (ch === '\t') {
          output += '\\t';
          continue;
        }
        const code = ch.charCodeAt(0);
        if (code >= 0 && code < 0x20) {
          output += `\\u${code.toString(16).padStart(4, '0')}`;
          continue;
        }
      }
      output += ch;
    }

    return output;
  };

  // JSON.parse 실패 시 자동 복구 시도 (best-effort)
  const safeParseJson = (raw: string): any => {
    try { return JSON.parse(raw); } catch (e1) {
      // 1차: 흔한 escape 문제 — 문자열 내 unescaped newline → 공백
      try {
        const fixed = escapeJsonStringControlChars(raw).replace(/("(?:[^"\\]|\\.)*")|(\n)/g, (m, str) => str || ' ');
        return JSON.parse(fixed);
      } catch (e2) {
        // 2차: 마지막 valid 위치까지 자르고 닫는 } 강제 추가 시도
        try {
          const lastValidBrace = raw.lastIndexOf('}');
          if (lastValidBrace > 0) {
            return JSON.parse(raw.substring(0, lastValidBrace + 1));
          }
        } catch {}
        throw e1; // 원본 에러 throw
      }
    }
  };

  const countParagraphs = (html: string): number => {
    const matches = (html || '').match(/<p[\s>]/gi);
    return matches ? matches.length : 0;
  };

  const textLength = (html: string): number => {
    // v3.5.77: script/style 컨테이너 안 텍스트도 제거 (eeat-meta와 동일 정합)
    return (html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length;
  };

  try {
    onLog?.('[PROGRESS] 50% - 🤖 AI 본문 생성 중...');
    // v3.8.536: 본문 통짜 JSON 은 32k 토큰까지 받는다 — 60~75초 상한으론 서버가 조금만 느려도 실패한다 (실사고)
    let response = await callGeminiWithGrounding(prompt, 1, false, undefined, { timeoutMs: resolveSectionTimeoutMs() });
    let json = extractJsonObject(response);

    let allSectionsObj: {
      introduction: string;
      conclusion: string;
      sections: Array<{
        h2: string;
        h3Sections: Array<{ h3: string; content: string; tables: FinalTableData[]; cta?: FinalCTAData }>;
      }>;
    };

    try {
      allSectionsObj = safeParseJson(json);
    } catch (e) {
      onLog?.('[PROGRESS] 50% - 🔁 JSON 파싱 실패, 1회 재시도...');
      const retryPrompt = `${prompt}\n\nIMPORTANT: Return ONLY a valid JSON object starting with { and ending with }. No markdown, no code fences, no extra text. Do not add explanations after the closing brace.`;
      response = await callGeminiWithRetry(retryPrompt, 1, { timeoutMs: resolveSectionTimeoutMs() });
      json = extractJsonObject(response);
      try {
        allSectionsObj = safeParseJson(json);
      } catch (e2) {
        // v3.5.94: 2회 모두 실패 시 디버그를 위해 문제 위치 로깅
        const errMsg = (e2 as Error).message || '';
        const posMatch = errMsg.match(/position (\d+)/i);
        if (posMatch && posMatch[1]) {
          const pos = parseInt(posMatch[1], 10);
          const context = json.substring(Math.max(0, pos - 80), Math.min(json.length, pos + 80));
          console.error(`[generateAllSections] JSON 파싱 실패 위치 ${pos} 주변:`, JSON.stringify(context));
          onLog?.(`[PROGRESS] 50% - ⚠️ JSON 파싱 실패 위치 ${pos} 주변: ${context.substring(0, 100)}`);
        }
        throw e2;
      }
    }

    onLog?.('[PROGRESS] 65% - ✅ AI 본문 생성 완료!');

    const flat = (allSectionsObj.sections || []).flatMap(s => (s.h3Sections || []).map(h => h.content || ''));
    // 🔥 품질 기준 강화: 500자 이상, 4문단 이상
    const lowQualityCount = flat.filter(c => textLength(c) < 500 || countParagraphs(c) < 4).length;
    const totalCount = flat.length || 1;
    const lowQualityRatio = lowQualityCount / totalCount;

    // v3.7.8: 빠른 모드 — skipQualityBoost=true면 보강 스킵 (3~4분 절약)
    //   기본은 보강 ON (품질 유지), 사용자가 메인 폼에서 토글 ON 시 빠른 모드
    const skipBoost = skipQualityBoost === true;
    if (skipBoost) {
      onLog?.('[PROGRESS] 65% - ⚡ 빠른 모드: 본문 품질 보강 스킵');
    }
    // 🔥 30% 이상 저품질이면 보강 (빠른 모드는 스킵)
    if (!skipBoost && lowQualityRatio >= 0.30) {
      onLog?.('[PROGRESS] 65% - 🔁 본문 품질 보강 중 (1회 호출)...');
      const improvePrompt = `
키워드: ${keyword}
아래 JSON은 블로그 본문 초안입니다. **품질이 낮아서 보강이 필요합니다!**

🔴🔴🔴 필수 보강 규칙 🔴🔴🔴
1) JSON 구조(객체/필드명)는 그대로 유지
2) 각 H3의 content를 **600~1000자**로 확장 (현재 너무 짧음!)
3) 각 content는 **<p> 태그 5개** 필수
4) 중복 표현/반복 멘트 완전 제거
5) 숫자/통계는 참고 크롤링 데이터 또는 기존 JSON에 있는 값만 사용! 출처 불명 숫자 만들기 금지!
6) 직접 경험하지 않은 것을 경험한 것처럼 쓰지 마세요
7) 한글과 영문/숫자만 사용. 중국어 한자(漢字) 절대 금지!

🔥 [H3 본문 다양화 지침]
- 딱딱한 5단계 구조를 버리고, **섹션의 성격에 맞게 톤과 구조를 다양하게** 섞으세요!
- 예시 아키타입:
  1. [가이드/절차형]: 구체적인 스텝바이스텝.
  2. [비교분석형]: A와 B의 장단점, 나에게 맞는 선택.
  3. [체크리스트형]: 확인해야 할 필수 항목들 나열 및 점검.
  4. [스토리텔링형]: 개인적인 공감대에서 시작해 팩트로 넘어가는 자연스러운 구성.
  5. [데이터 전달형]: 정확한 수치와 팩트를 중심으로 한 신뢰감 있는 전개.

📝 톤 규칙:
- "~해요", "~거든요" 친근한 말투
- 전문성이 느껴지면서 친근한 톤
- 체류시간 5분 이상 유지할 수 있는 흡인력

===== 참고 크롤링 데이터 =====
${reference.slice(0, 8000)}
=====

===== 보강할 JSON =====
${JSON.stringify(allSectionsObj)}
=====

🚨 주의: 각 H3 content가 600자 미만이면 실패입니다! 중요 문장에 <strong> 및 <mark> 태그를 적극 활용하세요.

JSON만 출력:
`;
      const improved = await callGeminiWithRetry(improvePrompt, 1, { timeoutMs: resolveSectionTimeoutMs() });
      const improvedJson = extractJsonObject(improved);
      try {
        const candidate = safeParseJson(improvedJson);
        /**
         * v3.8.429 — 보강 결과를 **검증하고 나서** 교체한다.
         *
         * 사용자 보고(2026-08-03): "H2·H3 제목은 나오는데 본문 단락이 통째로 비어 있다."
         *
         * 원인: 지금까지는 파싱만 되면 무조건 `allSectionsObj = safeParseJson(...)` 로
         *   원본을 통째로 덮어썼다. 그런데 이 보강 호출은 입력(원본 JSON 전체)도 크고
         *   출력 요구(H3마다 600자 이상)도 커서 출력이 잘리기 쉽다. 잘린 응답이
         *   safeParseJson 의 3차 복구(마지막 '}' 까지 잘라 파싱)를 타면 **"파싱은 됐지만
         *   뒷부분 섹션 content 가 빈" JSON** 이 나온다. 그게 멀쩡한 원본을 덮어써서
         *   제목만 남고 본문이 사라졌다. 조용한 실패라 로그에도 "보강 완료"로 찍혔다.
         *
         * 보강은 어디까지나 **선택적 개선**이다. 개선이 아니면 안 받는다 —
         * 원본보다 나빠질 수는 없어야 한다.
         */
        const totalTextLen = (obj: any): number =>
          (obj?.sections || []).reduce((sum: number, s: any) =>
            sum + (s?.h3Sections || []).reduce((t: number, h: any) => t + textLength(h?.content || ''), 0), 0);
        const sectionCount = (obj: any): number => (obj?.sections || []).length;
        const emptyContentCount = (obj: any): number =>
          (obj?.sections || []).reduce((n: number, s: any) =>
            n + (s?.h3Sections || []).filter((h: any) => textLength(h?.content || '') < 50).length, 0);

        const beforeLen = totalTextLen(allSectionsObj);
        const afterLen = totalTextLen(candidate);
        const reasons: string[] = [];
        if (sectionCount(candidate) < sectionCount(allSectionsObj)) {
          reasons.push(`섹션 수 감소(${sectionCount(allSectionsObj)}→${sectionCount(candidate)})`);
        }
        if (emptyContentCount(candidate) > emptyContentCount(allSectionsObj)) {
          reasons.push(`빈 본문 증가(${emptyContentCount(allSectionsObj)}→${emptyContentCount(candidate)})`);
        }
        // 총 분량이 원본의 80% 미만이면 "보강"이 아니라 손실이다
        if (beforeLen > 0 && afterLen < beforeLen * 0.8) {
          reasons.push(`총 분량 감소(${beforeLen}자→${afterLen}자)`);
        }

        if (reasons.length > 0) {
          console.warn(`[generateAllSections] 보강 결과가 원본보다 나빠 폐기: ${reasons.join(', ')}`);
          onLog?.(`[PROGRESS] 65% - ⚠️ 보강 결과가 원본보다 부실해 폐기하고 원본을 유지합니다 (${reasons.join(', ')})`);
        } else {
          allSectionsObj = candidate;
          onLog?.(`[PROGRESS] 65% - ✅ 본문 보강 반영 (${beforeLen}자 → ${afterLen}자)`);
        }
      } catch (parseErr) {
        // v3.5.94: 보강 단계 JSON 실패 시 원본 유지 (보강 전 데이터로 fallback)
        console.warn('[generateAllSections] 보강 JSON 파싱 실패 — 보강 전 데이터로 유지:', (parseErr as Error).message);
        onLog?.('[PROGRESS] 65% - ⚠️ 본문 보강 JSON 파싱 실패 — 원본 유지');
      }
    }

    /**
     * v3.8.429 — 본문이 빈 채로 조용히 나가지 않게 한다.
     *
     * 발행을 막지는 않는다(이 앱의 원칙: 품질 문제로 발행을 차단하지 않는다).
     * 다만 "제목만 있고 본문이 없는" 상태는 품질 문제가 아니라 **고장**이므로,
     * 지금까지처럼 아무 로그 없이 넘어가면 안 된다. 반드시 눈에 띄게 남긴다.
     */
    {
      const emptyH3s = (allSectionsObj.sections || []).flatMap((s, si) =>
        (s?.h3Sections || [])
          .map((h, hi) => ({ si, hi, len: textLength(h?.content || '') }))
          .filter((x) => x.len < 50));
      if (emptyH3s.length > 0) {
        const where = emptyH3s.map((x) => `${x.si + 1}-${x.hi + 1}`).join(', ');
        console.error(`[generateAllSections] ⚠️ 본문이 비어 있는 소제목 ${emptyH3s.length}개: ${where}`);
        onLog?.(`[PROGRESS] 65% - ⚠️ 본문이 빈 소제목 ${emptyH3s.length}개 발견 (${where}) — 그 부분만 다시 채웁니다`);

        /**
         * v3.8.432 — **빈 곳만** 다시 채운다.
         *
         * 사용자 보고(2026-08-03): "용도별 비교기준의 본문이 또빠져있네요 …
         *   장바구니 가격 확인도 빠져있구요"
         *
         * 이건 품질 보강이 아니라 **고장 수리**다. 제목만 있고 본문이 없는 글은
         * 독자에게도 검색엔진에도 사고다. 그렇다고 글 전체를 다시 만들지는 않는다
         * (사용자 원칙: "비용은 고정되면서 초기부터 글이 완벽하게 생성되어야 정상").
         * 빈 소제목만 골라 **한 번의 작은 호출**로 그 부분만 받아온다 —
         * 프롬프트도 응답도 작아서 전체 재생성과는 비용 차원이 다르다.
         *
         * 근본 대책은 따로 했다: 응답이 잘리지 않도록 출력 토큰 상한을 올렸다
         * (gemini-engine.ts GEMINI_MAX_OUTPUT_TOKENS). 이건 그래도 빈 경우의 안전망이다.
         */
        try {
          const targets = emptyH3s.map((x) => {
            const sec = allSectionsObj.sections[x.si]!;
            return { si: x.si, hi: x.hi, h2: sec.h2 || h2Titles[x.si] || '', h3: sec.h3Sections[x.hi]?.h3 || '' };
          });
          const repairPrompt = [
            `키워드: ${keyword}`,
            '',
            '아래 소제목들의 **본문만** 작성하세요. 다른 소제목은 건드리지 마세요.',
            '',
            ...targets.map((t, i) => `${i}. [대제목] ${t.h2}\n   [소제목] ${t.h3}`),
            '',
            '규칙',
            '- 각 본문은 <p> 태그로 감싼 4문단 이상, 합쳐서 600자 이상.',
            '- 앞뒤 섹션과 중복되지 않게, 이 소제목이 약속한 내용만 구체적으로 쓰세요.',
            '- 숫자·조건·비교가 3개 이상이면 표 대신 <ul><li>로 정리하세요.',
            '- 확인되지 않은 가격·수치는 지어내지 마세요.',
            '',
            '아래 JSON 형식으로만 출력:',
            '{"items":[{"index":0,"content":"<p>…</p>"}]}',
            '',
            '===== 참고 자료 =====',
            reference.slice(0, 6000),
          ].join('\n');

          const repaired = await callGeminiWithRetry(repairPrompt, 1, { timeoutMs: resolveSectionTimeoutMs() });
          const repairedObj = safeParseJson(extractJsonObject(repaired));
          let filled = 0;
          for (const item of (repairedObj?.items || [])) {
            const t = targets[Number(item?.index)];
            const body = String(item?.content || '');
            if (!t || textLength(body) < 50) continue;
            const target = allSectionsObj.sections[t.si]?.h3Sections?.[t.hi];
            if (target) { target.content = body; filled += 1; }
          }
          if (filled > 0) {
            onLog?.(`[PROGRESS] 66% - ✅ 빈 소제목 ${filled}개를 다시 채웠습니다`);
          } else {
            onLog?.('[PROGRESS] 66% - ⚠️ 빈 소제목을 채우지 못했습니다 — 발행은 계속합니다');
          }
        } catch (repairErr: any) {
          // 수리 실패가 발행을 막지 않는다
          onLog?.(`[PROGRESS] 66% - ⚠️ 빈 소제목 보충 실패 (계속 진행): ${String(repairErr?.message || repairErr).slice(0, 60)}`);
        }
      }
    }

    // 결과 정규화 및 에디팅 톤 변환
    return {
      introduction: allSectionsObj.introduction || '',
      conclusion: allSectionsObj.conclusion || '',
      sections: (allSectionsObj.sections || []).map((sec, idx) => ({
        h2: (h2Titles[idx] || sec.h2 || '').replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, ''),
        h3Sections: (sec.h3Sections || []).map((h3Sec, h3Idx) => ({
          h3: ((h3Sec.h3 || '').replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '').trim() || `\uD575\uC2EC \uC815\uB9AC ${h3Idx + 1}`),
          content: sanitizePromptLeaks(h3Sec.content || '')
            // 🛡️ AI가 본문에 H1/H2 태그를 직접 출력하는 경우 강제 제거 (H2 번호 사라짐 버그 방지)
            .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
            .replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, '')
            // v3.8.364: 강제 반말 치환은 friendly/casual/conversational 톤에서만 (v3.8.356 fix 확장)
            .replace(/입니다\./g, shouldApplyCasualTransform() ? '이에요.' : '입니다.')
            .replace(/습니다\./g, shouldApplyCasualTransform() ? '어요.' : '습니다.')
            .replace(/합니다\./g, shouldApplyCasualTransform() ? '해요.' : '합니다.')
            .replace(/있습니다\./g, shouldApplyCasualTransform() ? '있어요.' : '있습니다.')
            .replace(/없습니다\./g, shouldApplyCasualTransform() ? '없어요.' : '없습니다.')
            // 🔥 AI티 나는 이모지 접두어 제거
            .replace(/🔥후킹:\s*/g, '')
            .replace(/💡핵심:\s*/g, '')
            .replace(/📋실전:\s*/g, '')
            .replace(/✅사례:\s*/g, '')
            .replace(/💎마무리:\s*/g, '')
            .replace(/👉브릿지:\s*/g, '')
            .replace(/🔥\s+/g, '')
            .replace(/💡\s+/g, '')
            .replace(/📋\s+/g, '')
            .replace(/✅\s+/g, '')
            .replace(/💎\s+/g, '')
            .replace(/1️⃣\s*/g, '')
            .replace(/2️⃣\s*/g, '')
            .replace(/3️⃣\s*/g, '')
            .replace(/4️⃣\s*/g, '')
            .replace(/5️⃣\s*/g, '')
            // 🔥 다음섹션 안내 문구 완전 제거
            .replace(/👉\s*다음은[^]*?굳혀볼게요\./g, '')
            .replace(/👉\s*다음은[^]*?넘어가서[^]*?\./g, '')
            .replace(/👉[^<]*넘어가[^<]*/g, '')
            .replace(/👉[^<]*굳혀볼게요[^<]*/g, '')
            .replace(/다음은[^<]*넘어가서[^<]*굳혀볼게요\./g, '')
            .replace(/\"어떻게\"를 실제 실행 단계로 굳혀볼게요\./g, '')
            .replace(/체류시간\s*→\s*신뢰\s*→\s*수익/g, '')
            .replace(/노출→클릭→체류→전환/g, '')
            .replace(/<p>\s*<\/p>/g, '')
            // 한자(漢字) → 한글 변환 (AI가 가끔 한자를 출력하는 문제)
            .replace(/解答/g, '해답').replace(/質問/g, '질문').replace(/方法/g, '방법')
            .replace(/完璧/g, '완벽').replace(/説明/g, '설명').replace(/活用/g, '활용')
            .replace(/重要/g, '중요').replace(/必要/g, '필요').replace(/可能/g, '가능')
            .replace(/問題/g, '문제').replace(/結果/g, '결과').replace(/情報/g, '정보')
            .replace(/支援/g, '지원').replace(/申請/g, '신청').replace(/確認/g, '확인')
            .replace(/製造/g, '제조').replace(/導入/g, '도입').replace(/自動/g, '자동')
            // 남은 CJK 한자 일괄 제거 (한글/영문/숫자/기본 기호만 유지)
            .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, ''),
          tables: parseTables((h3Sec as any).tables)
        }))
      }))
    };

  } catch (e) {
    // 🚨 LLM 실패 시 폴백을 사용하면 H2 N개가 모두 동일 보일러플레이트로 채워져
    //    SEO/UX 모두 치명적. 사일런트 페일 대신 명시적으로 throw하여 사용자가
    //    재시도하거나 LLM 키/할당량을 점검하도록 유도.
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[generateAllSectionsFinal] LLM 섹션 생성 실패:', errMsg);
    onLog?.(`[PROGRESS] 50% - ❌ LLM 섹션 생성 실패: ${errMsg.slice(0, 200)}`);
    onLog?.('[PROGRESS] 50% - 💡 가능한 원인: LLM API 키 누락/만료, 할당량 초과, 네트워크 오류, JSON 파싱 실패');
    throw new Error(
      `섹션 콘텐츠 생성 실패: ${errMsg}\n` +
      `폴백 콘텐츠는 모든 H2가 동일 보일러플레이트가 되어 SEO/UX에 치명적이므로 발행을 차단합니다.\n` +
      `대처: ① API 키 확인 (Gemini/OpenAI/Perplexity) ② 할당량 확인 ③ 키워드 단순화 후 재시도`
    );
  }
}

// 🔥 FAQ 생성 함수 -- Schema.org FAQPage 마크업 포함
export async function generateFAQFinal(
  keyword: string,
  h2Titles: string[],
  onLog?: (s: string) => void,
  groundedContent?: string
): Promise<FAQItem[]> {
  const faqToday = new Date().toISOString().slice(0, 10);
  // v3.7.21: 키워드 한정자 감지 — FAQ도 본문과 동일 스코프 유지 (한정자 외 질문 금지)
  const faqScope = detectKeywordScope(keyword);
  const faqScopeBlock = faqScope
    ? `\n🎯🎯🎯 **FAQ 스코프 한정 — 절대 위반 금지!**:\n키워드가 "${faqScope.qualifier}"으로 끝나므로 ${faqScope.instruction}\n위 지시 위반 시(예: "혜택"인데 "신청은 어떻게 하나요?" 질문 생성) 즉시 실격.\n`
    : '';
  if (faqScope) {
    console.log(`[FAQ] 🎯 키워드 한정자 감지: "${faqScope.qualifier}" → FAQ 스코프 제한 적용`);
  }
  const stripFaqGroundingHtml = (html: string) => (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const groundedText = stripFaqGroundingHtml(groundedContent || '').slice(0, 7000);
  // v3.8.361: "본문 근거", "제공된 자료" 같은 메타 표현이 결과에 유출되던 문제 방지
  const faqGroundingBlock = groundedText.length > 200
    ? `\n===== 백그라운드 (독자 앞에서 언급 금지) =====\n${groundedText}\n=====\n\nFAQ는 위 컨텍스트와 H2 제목에서만 파생하세요. 컨텍스트에 없는 숫자/금액/기간/마감일/기관명/URL은 만들지 마세요.\n🚫 답변에 "본문 근거", "제공된 자료", "본문에 나와 있지 않다" 같은 메타 표현 금지 — 독자는 이 컨텍스트를 모릅니다.\n`
    : '\n컨텍스트가 부족합니다. 키워드와 H2 제목에서 자연스럽게 파생되는 질문만 만들고, 확인되지 않은 수치는 쓰지 말고 일반 원칙+공식 확인 안내로 서술하세요.\n🚫 "본문 근거가 없어요" 같은 메타 표현 금지.\n';
  const prompt = `
키워드: ${keyword}
${faqScopeBlock}📅 오늘 날짜: ${faqToday}

H2 섹션 제목:
${h2Titles.map((h, i) => `${i + 1}. ${h}`).join('\n')}
${faqGroundingBlock}

위 블로그 글에 대해 독자가 실제로 궁금해할 자주 묻는 질문(FAQ) 5개를 만들어주세요.

규칙:
1. 질문은 실제 검색어처럼 자연스럽게 (예: "${keyword} 비용이 얼마인가요?")
2. 답변은 3~4줄로 핵심만 간결하게
3. 답변에 구체적인 숫자/기간/금액을 쓸 때는 반드시 위 본문 근거에 있는 값만 사용!
4. 본문에 없는 사실을 추가하지 말고, 본문을 읽은 독자가 이어서 궁금해할 질문 위주
5. "~해요", "~거든요" 친근한 말투
6. 이미 마감된 사업/이벤트/일정은 답변에 포함 금지. 현재 진행 중이거나 미래 일정만!
7. 한글과 영문/숫자만 사용. 중국어 한자(漢字) 절대 금지!
8. 🔴 추측/허위 데이터 절대 금지! 단, 확인할 수 없다고 "공식 사이트에서 확인하세요"로 답을 때우는 것도 금지입니다.
   값을 모르면 → 판단 기준(어떤 경우에 어떻게 되는지) + 확인 절차(정확한 기관명·메뉴 경로)를 대신 구체적으로 답하세요.
   답변 5개 중 최소 3개는 위 컨텍스트의 실제 숫자·기간·금액·기관명을 포함해야 합니다.
9. ${STORYSCOPE_FAQ_ENDING_RULE}

JSON 형식:
[
  {"question": "질문1", "answer": "답변1"},
  {"question": "질문2", "answer": "답변2"},
  ...총 5개
]

JSON만 출력:
`;

  // v3.7.21: FAQ 응답 파싱 헬퍼 — 검증/재시도 흐름에서 재사용
  const parseFaqRespToValid = (resp: string): FAQItem[] => {
    const cleaned = (resp || '').trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const first = cleaned.indexOf('[');
    const last = cleaned.lastIndexOf(']');
    if (first === -1 || last === -1 || last <= first) throw new Error('No JSON array found');
    const items: FAQItem[] = JSON.parse(cleaned.slice(first, last + 1));
    return items
      .map(f => ({
        question: (f.question || '').replace(/[一-鿿㐀-䶿]/g, ''),
        answer: (f.answer || '').replace(/[一-鿿㐀-䶿]/g, ''),
      }))
      .filter(f => typeof f.question === 'string' && typeof f.answer === 'string' && f.question.length > 5 && f.answer.length > 10)
      .slice(0, 7);
  };

  try {
    onLog?.('[PROGRESS] 67% - ❓ FAQ 생성 중...');
    const response = await callGeminiWithRetry(prompt);
    const cleaned = (response || '').trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const first = cleaned.indexOf('[');
    const last = cleaned.lastIndexOf(']');
    if (first === -1 || last === -1 || last <= first) throw new Error('No JSON array found');

    const items: FAQItem[] = JSON.parse(cleaned.slice(first, last + 1));
    const cjkRegex = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;
    const valid = items
      .map(f => ({
        question: (f.question || '').replace(cjkRegex, ''),
        answer: (f.answer || '').replace(cjkRegex, ''),
      }))
      .filter(f => typeof f.question === 'string' && typeof f.answer === 'string' && f.question.length > 5 && f.answer.length > 10)
      .slice(0, 7);

    // v3.7.21: FAQ 스코프 위반 검증 + 1회 재시도 — 질문 + 답변 모두 검사
    if (faqScope && valid.length > 0) {
      const isFaqViolation = (f: FAQItem) =>
        !validateScopeText(f.question, faqScope) || !validateScopeText(f.answer, faqScope);
      const violations = valid.filter(isFaqViolation);
      if (violations.length > 0) {
        console.warn(`[FAQ] ⚠️ 스코프 "${faqScope.qualifier}" 위반 FAQ ${violations.length}/${valid.length}개 감지: ${violations.map(v => v.question).join(' / ')} — 재시도`);
        const retryPrompt = `${prompt}\n\n🚨🚨🚨 **재시도 — 직전 응답 스코프 위반!**\n직전 FAQ에 다음 질문이 들어 있었음 (모두 "${faqScope.qualifier}" 스코프 위반):\n${violations.map(v => `  - ${v.question}`).join('\n')}\n\n이번엔 위 질문을 절대 다시 만들지 말고, "${faqScope.qualifier}" 측면만 묻는 FAQ 5개를 다시 만들어 주세요. 질문 + 답변 모두 신청/조건/방법/대상자 같은 다른 측면 키워드가 등장하면 안 됩니다.\nJSON만 반환:`;
        try {
          const retryResp = await callGeminiWithRetry(retryPrompt);
          const retryValid = parseFaqRespToValid(retryResp);
          const stillBad = retryValid.filter(isFaqViolation);
          if (stillBad.length === 0 && retryValid.length >= 3) {
            console.log(`[FAQ] ✅ 재시도 성공 — 스코프 위반 0건, ${retryValid.length}개 통과`);
            onLog?.(`[PROGRESS] 68% - ✅ FAQ ${retryValid.length}개 생성 완료 (스코프 재시도 성공)`);
            return retryValid;
          }
          const filtered = retryValid.filter(f => !isFaqViolation(f));
          if (filtered.length >= 3) {
            console.warn(`[FAQ] ⚠️ 재시도 후에도 ${stillBad.length}개 위반 잔존 → 위반 FAQ 필터링하여 ${filtered.length}개 반환`);
            onLog?.(`[PROGRESS] 68% - ⚠️ FAQ ${filtered.length}개 (스코프 위반 ${stillBad.length}개 필터링)`);
            return filtered;
          }
          const filteredOriginal = valid.filter(f => !isFaqViolation(f));
          if (filteredOriginal.length >= 3) {
            console.warn(`[FAQ] ⚠️ 재시도 결과 부족 → 1차 결과 필터링하여 ${filteredOriginal.length}개 반환`);
            return filteredOriginal;
          }
          console.warn(`[FAQ] ⚠️ 재시도 + 필터링 모두 부족 → 원본 ${valid.length}개 반환 (일부 위반 포함)`);
          return valid;
        } catch (retryErr) {
          const filteredOriginal = valid.filter(f => !isFaqViolation(f));
          if (filteredOriginal.length >= 3) {
            console.warn(`[FAQ] ⚠️ 재시도 LLM 실패 → 원본에서 위반 필터링하여 ${filteredOriginal.length}개 반환`);
            return filteredOriginal;
          }
          return valid;
        }
      }
    }

    if (valid.length < 3) throw new Error(`Too few valid FAQs: ${valid.length}`);
    onLog?.(`[PROGRESS] 68% - ✅ FAQ ${valid.length}개 생성 완료`);
    return valid;
  } catch (e) {
    console.error('[generateFAQFinal] FAQ 생성 실패:', e);
    onLog?.('[PROGRESS] 68% - ⚠️ FAQ 생성 실패, 기본 FAQ 사용');
    // 폴백: 키워드 기반 기본 FAQ
    return [
      { question: `${keyword}이/가 정확히 무엇인가요?`, answer: `${keyword}에 대한 자세한 내용은 위 본문에 정리해 두었어요. 핵심 개념부터 확인해보시면 이해가 빠를 거예요.` },
      { question: `${keyword} 시작하려면 어떻게 해야 하나요?`, answer: `위 본문의 단계별 가이드를 참고해주세요. 공식 사이트에서 최신 정보를 확인하시는 것도 추천드려요.` },
      { question: `${keyword} 관련해서 주의할 점이 있나요?`, answer: `기본 개념을 먼저 확인한 후 진행하시는 걸 추천드려요. 자세한 주의사항은 위 본문을 참고해주세요.` },
    ];
  }
}

// 🔥 FAQ HTML + Schema.org 마크업 생성
export function buildFAQHtml(faqs: FAQItem[]): string {
  /**
   * v3.8.484 — 질문이나 답변 한쪽이 비면 그 항목을 버린다.
   * 후처리가 근거 없는 문장을 지우면서 답변이 빈 문자열이 될 수 있는데,
   * 그대로 그리면 "Q 만 있고 A 는 없는 아코디언" 이 나가고 구조화 데이터에도 실린다.
   */
  faqs = dropEmptyFaqItems(faqs || []);
  if (!faqs || faqs.length === 0) return '';

  // Schema.org FAQPage 구조화 데이터
  const schemaJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(f => ({
      '@type': 'Question',
      'name': f.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': f.answer
      }
    }))
  });

  const faqItems = faqs.map(f => `
  <details style="margin-bottom:12px !important;border:1px solid #e8e8e8 !important;border-radius:10px !important;overflow:hidden !important;background:#fff !important;">
    <summary style="padding:16px 20px !important;font-size:16px !important;font-weight:700 !important;color:#222 !important;-webkit-text-fill-color:#222 !important;cursor:pointer !important;list-style:none !important;display:flex !important;align-items:center !important;gap:10px !important;">
      <span style="color:#0066FF !important;-webkit-text-fill-color:#0066FF !important;font-size:18px !important;flex-shrink:0 !important;">Q.</span>
      <span style="flex:1 !important;line-height:1.5 !important;">${f.question}</span>
      <span style="color:#999 !important;-webkit-text-fill-color:#999 !important;font-size:12px !important;flex-shrink:0 !important;">▼</span>
    </summary>
    <div style="padding:0 20px 16px 20px !important;font-size:15px !important;line-height:1.8 !important;color:#444 !important;-webkit-text-fill-color:#444 !important;border-top:1px solid #f0f0f0 !important;">
      <p style="margin:12px 0 0 !important;">${f.answer}</p>
    </div>
  </details>`).join('\n');

  return `
<div style="margin:48px 0 32px !important;padding:0 !important;display:block !important;visibility:visible !important;">
  <h2 style="font-size:22px !important;font-weight:800 !important;color:#111 !important;-webkit-text-fill-color:#111 !important;margin:0 0 20px !important;padding:0 0 14px 16px !important;border-bottom:2px solid #111 !important;border-left:5px solid #0066FF !important;line-height:1.4 !important;">자주 묻는 질문 (FAQ)</h2>
  ${faqItems}
</div>
<script type="application/ld+json">${schemaJson}</script>
`;
}

// 🔥 H2 전체 섹션을 한 번에 생성하는 최적화 함수 (호환성 유지)
export async function generateH2SectionFinal(
  h2: string,
  h3s: string[],
  keyword: string,
  crawledContents: string[],
  isFirst: boolean = false,
  isLast: boolean = false
): Promise<Array<{ h3: string; content: string; tables: FinalTableData[] }>> {
  const reference = crawledContents.join('\n\n').slice(0, 4000);

  // 🔥 위치에 따른 스타일
  let styleGuide = '';
  if (isFirst) {
    styleGuide = '첫 섹션: 바로 본론으로 시작. 도입부 멘트 금지.';
  } else if (isLast) {
    styleGuide = '마지막 섹션: 자연스러운 마무리 가능.';
  } else {
    styleGuide = '중간 섹션: 본론만 작성.';
  }

  const h3List = h3s.map((h3, i) => `${i + 1}. ${h3}`).join('\n');

  const prompt = `
키워드: ${keyword}
소제목: ${h2}
스타일: ${styleGuide}

===== 크롤링 데이터 (참고만) =====
${reference}
=====

===== H3 목록 =====
${h3List}
=====

🔴 각 H3마다 400~500자 본문을 작성하세요.

${toneInstructionBlock()}

필수 규칙:
1. 크롤링 데이터의 팩트만 사용 (추측 금지)
2. 위 말투/어투 지시를 일관되게 유지
3. 각 H3는 서로 다른 내용으로 작성
4. 반말체 금지, 존댓말 유지 (~다 어미도 존댓말 문맥에서만 사용)

JSON 형식으로 출력:
[
  {
    "h3": "첫 번째 소제목",
    "content": "<p>첫 문단...</p><p>두 번째 문단...</p>"
  },
  ...
]

JSON만:
`;

  try {
    const response = await callGeminiWithRetry(prompt);
    const json = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const sections = JSON.parse(json) as Array<{ h3: string; content: string }>;

    // v3.8.356: 강제 반말 치환은 friendly/casual/conversational 톤에서만 적용
    return sections.map((sec, idx) => {
      const content = applyCasualTransform(sec.content);
      return {
        h3: h3s[idx] || sec.h3,
        content,
        tables: []
      };
    });
  } catch (e) {
    // 폴백: 기본 콘텐츠 생성
    console.warn('[generateH2SectionFinal] JSON 파싱 실패, 기본 콘텐츠 사용');
    return h3s.map(h3 => ({
      h3,
      content: `<p>${keyword}의 ${h3}에 대해 정리해드릴게요. 자세한 내용은 공식 사이트에서 최신 정보를 확인해주세요.</p>`,
      tables: []
    }));
  }
}

export async function generateH3ContentFinal(
  h2: string,
  h3: string,
  keyword: string,
  crawledContents: string[],
  position: 'first' | 'middle' | 'last' = 'middle',
  previousFirstSentences: string[] = []
): Promise<{ content: string; tables: FinalTableData[] }> {
  // 🔥 배치 생성으로 대체 - 이 함수는 호환성을 위해 유지
  const reference = crawledContents.join('\n\n').slice(0, 2000);

  const h3Today = new Date().toISOString().slice(0, 10);
  const prompt = `
키워드: ${keyword}
소제목: ${h3}
📅 오늘: ${h3Today}
참고: ${reference.slice(0, 1500)}

${h3}에 대해 400자 내외로 작성하세요.
${toneInstructionBlock()}
- p태그 2~3개
- 위 컨텍스트를 참고하되, 컨텍스트가 부족하면 일반 상식+원칙 수준으로 서술하고 확인되지 않은 수치/마감일은 만들지 마세요.
- v3.8.361 필수: 본문에 "참고 자료", "제공된 데이터", "본문 근거", "자료에는 나와 있지 않다" 같은 메타 표현 절대 금지! 독자는 이 지시의 존재를 모릅니다.
- 마감된 사업/이벤트 언급 금지. 현재 진행 중이거나 미래 일정만!
- 한글/영문/숫자만 사용. 중국어 한자 금지!

HTML만:
`;

  let content = await callGeminiWithRetry(prompt);
  content = content.trim()
    .replace(/^```html\n?/gi, '').replace(/```$/gi, '');
  // v3.8.356: 강제 반말 치환은 friendly/casual/conversational 톤에서만 적용
  content = applyCasualTransform(content);

  return { content, tables: [] };
}

// 🔍 Google CSE를 사용해 공식 사이트 찾기
/**
 * CTA 후보 페이지를 받아온다 — 하네스가 "여기서 되는가"를 보려면 본문이 필요하다.
 *
 * 발행 흐름 안에서 도는 일이라 짧게 끊는다. 못 받아오면 그 후보만 버리고 넘어간다
 * (하네스가 알아서 다음 후보를 본다). 앞부분만 읽는 이유는 신청 버튼·제목이
 * 대개 위쪽에 있고, 전체를 받으면 느려지기 때문이다.
 */
const CTA_PAGE_TIMEOUT_MS = 4000;
const CTA_PAGE_MAX_CHARS = 200_000;

async function fetchPageForCta(url: string): Promise<{ ok: boolean; html: string; finalUrl?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CTA_PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // 기관 사이트는 봇 UA 를 막는 곳이 있어 일반 브라우저처럼 요청한다
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });
    if (!res.ok) return { ok: false, html: '' };
    const html = (await res.text()).slice(0, CTA_PAGE_MAX_CHARS);
    return { ok: true, html, finalUrl: res.url || url };
  } catch {
    return { ok: false, html: '' };
  } finally {
    clearTimeout(timer);
  }
}

async function searchOfficialSite(keyword: string, googleCseKey: string, googleCseCx: string, contentMode?: string, skipActionIntent?: boolean, articleText?: string, smartTargetIn?: { site: string; action: string; buttonLabel: string; hookMessage?: string; searchQuery: string } | null): Promise<{ url: string; title: string; smartLabel?: string } | null> {
  if (!googleCseKey || !googleCseCx) return null;

  try {
    /**
     * v3.8.471 — 홈페이지가 아니라 "행동하는 화면" 을 찾는다.
     *
     * 사장님: "코레일사이트에서 예약을 바로할수있는 링크로 걸어줘야되
     *          막상 사이트갓는데 어떻게 하는지 모르자나"
     *
     * 예전 검색어가 `${keyword} 공식 홈페이지` 였다. 홈페이지를 달라고 했으니
     * 홈페이지가 왔다. 독자는 첫 화면에서 메뉴를 다시 찾아야 했고 대개 거기서 이탈한다.
     * 이제 키워드에서 행동(신청·예매·발급…)을 읽어 그 화면을 찾는다.
     */
    const actionIntent = (contentMode === 'shopping' || skipActionIntent) ? null : detectActionIntent(keyword);

    /**
     * 🧭 v3.8.538 — 목적지를 AI 가 먼저 정한다 (사장님: "어떤 글이던지 스마트하게").
     *   정규식·카탈로그는 분야마다 두더지 잡기였다 ('거래'→중고나라 사고).
     *   AI 는 기관 "이름"만 정하고, 주소는 아래 기존 CSE+검증 파이프가 정한다.
     *
     * v3.8.542 — 호출은 호출자(generateCTAsFinal)가 한다. 여기서 부르면
     *   같은 발행에서 여러 번 불릴 수 있고, 무엇보다 이 함수 자체가 폴백이라
     *   "1단계가 성공하면 라우터가 영영 안 도는" 구조가 된다. 결정은 받아만 쓴다.
     *   재귀 폴백(skipActionIntent)에서는 쓰지 않는다 — 같은 검색어를 반복하지 않기 위해.
     */
    const smartTarget = skipActionIntent ? null : (smartTargetIn || null);

    const query = contentMode === 'shopping'
      ? `${keyword} 최저가 구매`
      : (smartTarget?.searchQuery || buildActionQuery(keyword, actionIntent));
    console.log(`[CTA] 🔍 ${contentMode === 'shopping' ? '쇼핑 페이지'
      : smartTarget ? `🧭 ${smartTarget.site}` : actionIntent ? `${actionIntent} 화면` : '공식 사이트'} 검색: "${query}"`);

    const url = `https://www.googleapis.com/customsearch/v1?key=${googleCseKey}&cx=${googleCseCx}&q=${encodeURIComponent(query)}&num=5`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log(`[CTA] ⚠️ 검색 결과 없음`);
      return null;
    }

    // 🎯 모드별 신뢰 도메인
    const trustedDomains = contentMode === 'shopping'
      ? ['coupang.com', 'smartstore.naver.com', 'shopping.naver.com', '11st.co.kr', 'gmarket.co.kr', 'auction.co.kr', 'danawa.com', 'apple.com/kr', 'samsung.com', 'lg.com', 'brand.naver.com']
      : ['.go.kr', '.or.kr', '.ac.kr', '.re.kr', '.edu', '.gov', '.mil'];
    const excludeDomains = ['blog.naver.com', 'tistory.com', 'velog.io', 'brunch.co.kr', 'namu.wiki', 'wikipedia.org', 'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'kin.naver.com'];

    /**
     * v3.8.471 — 살아있는 것만 내보낸다.
     *
     * 사장님: "단, 오류나 없는 페이지는 절대 나오면 안 되고"
     * 행동 화면은 홈보다 깊은 경로라 사이트 개편 때 쉽게 죽는다.
     * 그래서 내보내기 전에 확인하고, 죽었으면 다음 후보로 넣어간다.
     */
    /**
     * v3.8.490 - 검색 결과를 그대로 믿지 않는다.
     *
     * 사장님 보고: 코레일 글의 CTA 가 postmate.waffle-gl.org/link/naver/... 로 나갔다.
     * 예전 규칙은 "제외 목록에만 없으면 통과" 여서, 검색 결과에 섞여 든 낯선 집계·스팸
     * 도메인이 200 만 돌려주면 그대로 실렸다. 게다가 신뢰 목록이 .go.kr 계열뿐이라
     * korail.com 같은 진짜 공식 사이트가 오히려 우선순위를 못 받았다.
     *
     * 이제 **근거를 댈 수 있는 도메인만** 받는다(등록된 공식 사이트·공공기관·브랜드 일치).
     * 근거가 없으면 CTA 를 넣지 않는다 - 남의 링크를 사장님 글에 싣는 것보다 낫다.
     */
    const candidates: { url: string; title: string; trusted: boolean }[] = [];
    for (const item of data.items) {
      const link = item.link;
      if (excludeDomains.some(d => link.includes(d))) continue;
      const verdict = judgeCtaHost(link, keyword);
      if (!verdict.ok) {
        console.warn(`[CTA] 🚫 ${describeHostVerdict(verdict)}: ${link}`);
        continue;
      }
      candidates.push({
        url: link,
        title: item.title,
        // 등록된 공식 사이트를 가장 먼저 본다
        trusted: verdict.reason === 'catalog' || trustedDomains.some(d => link.includes(d)),
      });
    }
    candidates.sort((a, b) => Number(b.trusted) - Number(a.trusted));

    // 살아있는 후보만 남긴다 (죽은 주소는 하네스에 넣어도 소용없다)
    const alive: { url: string; title: string }[] = [];
    for (const c of candidates) {
      const check = await validateCtaUrl(c.url, { timeout: 4000 });
      if (check.isValid) alive.push({ url: c.url, title: c.title });
      else console.warn(`[CTA] ⚠️ 살아있지 않아 건너뜀 (${check.reason}): ${c.url}`);
    }

    /**
     * v3.8.501 — 살아있다고 다 되는 게 아니다.
     *
     * 사장님: "홈으로 가서 다시 찾기 위해서가 아니라 클릭하면 바로 연결되기 위해서야,
     *          광고처럼 말이야"
     *
     * 예전엔 첫 번째 살아있는 후보를 그대로 채택했다. 그게 기관 홈이어도 200 이니
     * 통과했고, 독자는 홈에서 메뉴를 다시 찾아야 했다.
     * 이제 후보를 실제로 열어 "여기서 그 행동이 되는가"를 채점한다.
     * 글이 지목한 기관(본문에 반복해 나오는 이름)을 함께 보므로,
     * 같은 "신청하기" 버튼이 있어도 엉뚱한 기관은 진다.
     */
    if (alive.length) {
      if (actionIntent) {
        try {
          const ctx = analyzeArticleContext({ keyword, content: articleText || '', intent: actionIntent });
          const picked = await resolveActionLink({
            keyword,
            intent: actionIntent,
            agencies: ctx.agencies,
            candidates: alive,
            fetchPage: fetchPageForCta,
            fallbackUrl: alive[0]!.url,
          });
          const chosen = alive.find((a) => a.url === picked.url) || alive[0]!;
          const label = picked.stage === 'action' ? '행동 화면'
            : picked.stage === 'guide' ? '제도 안내' : '기관 홈';
          console.log(`[CTA] ✅ ${label} 채택(${picked.score}점): ${picked.url || chosen.url}`);
          console.log(`[CTA]    근거: ${picked.reasons.join(' · ')}`);
          if (ctx.agencies.length) console.log(`[CTA]    글이 지목한 기관: ${ctx.agencies.join(', ')}`);
          return { url: picked.url || chosen.url, title: chosen.title, ...(smartTarget?.buttonLabel ? { smartLabel: smartTarget.buttonLabel } : {}) };
        } catch (error) {
          // 하네스가 실패해도 발행을 막지 않는다 — 예전 방식으로 돌아간다
          console.warn('[CTA] ⚠️ 행동 화면 판정 실패, 기존 방식으로:', (error as Error)?.message);
        }
      }
      console.log(`[CTA] ✅ ${actionIntent ? `${actionIntent} 화면` : '공식 사이트'} 확인됨: ${alive[0]!.url}`);
      return { ...alive[0]!, ...(smartTarget?.buttonLabel ? { smartLabel: smartTarget.buttonLabel } : {}) };
    }

    /**
     * 후보가 전부 죽었다면 행동 검색어 때문일 수 있다 — 홈페이지로 물러난다.
     * 죽은 딥링크보다 살아있는 홈이 낫다.
     */
    if (actionIntent) {
      console.log('[CTA] ↩️ 행동 화면을 못 찾아 공식 사이트로 폴백합니다');
      return searchOfficialSite(keyword, googleCseKey, googleCseCx, contentMode, true, articleText);
    }

    return null;

  } catch (error) {
    console.error(`[CTA] ❌ 공식 사이트 검색 중 오류:`, error);
    return null;
  }
}

// 🔥 본문에 스마트 링크 삽입 (인라인 링크)
export function applySmartLinkToContent(content: string, keyword: string, officialLink: string): string {
  if (!officialLink || !content) return content;

  console.log(`[LINK] 🔗 본문 인라인 링크 작업 시작 (링크: ${officialLink})`);

  let newContent = content;
  let linkApplied = false;
  let replaceCount = 0;

  // 행위 키워드 목록
  const actionWords = ['신청', '조회', '예약', '접수', '확인', '바로가기', '홈페이지', '사이트', '가입', '다운로드'];

  // 1. "키워드 + 공백(옵션) + 행위" 패턴 우선 치환
  for (const action of actionWords) {
    if (replaceCount >= 3) break;

    const pattern = new RegExp(`(${keyword}\\s*${action}(?:하기|하러\\s*가기|방법)?)`, 'gi');

    newContent = newContent.replace(pattern, (match) => {
      if (replaceCount >= 3) return match;
      if (match.includes('</a>')) return match;

      replaceCount++;
      linkApplied = true;
      return `<a href="${officialLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: bold;">${match}</a>`;
    });
  }

  // 2. 만약 하나도 안 걸렸다면 키워드 단독 치환 (1회만)
  if (!linkApplied) {
    const keywordRegex = new RegExp(`${keyword}`, 'i');
    newContent = newContent.replace(keywordRegex, (match) => {
      linkApplied = true;
      return `<a href="${officialLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: bold;">${match}</a>`;
    });
  }

  if (linkApplied) {
    console.log(`[LINK] ✅ 본문에 공식 링크 인라인 삽입 완료 (${replaceCount}회)`);
  }

  return newContent;
}

// 📥 문서/자료 URL 감지 헬퍼 — 파일 확장자별 버튼/훅 텍스트 자동 결정
// AI가 반환한 버튼 텍스트가 문서 URL인데도 "사이트 바로가기" 같은 오류를 내는 경우를 방지
function detectDocumentCta(url: string): { isDoc: boolean; btnText: string; hookText: string } {
  const match = url.match(/\.(pdf|ppt|pptx|pps|ppsx|key|hwp|hwpx|xlsx|xls|ods|csv|tsv|zip|rar|7z|docx|doc|odt|rtf|txt|pages|numbers)(\?|#|$)/i);
  if (!match) return { isDoc: false, btnText: '', hookText: '' };
  const ext = match[1]!.toLowerCase();
  const typeLabel =
    ext === 'pdf' ? 'PDF 자료' :
    /^(ppt|pps|key)/.test(ext) ? '발표자료' :
    /^doc|^odt|^rtf|^txt|pages/.test(ext) ? '문서' :
    /^xls|^ods|csv|tsv|numbers/.test(ext) ? '엑셀 자료' :
    /^hwp/.test(ext) ? '한글파일' :
    /^(zip|rar|7z)/.test(ext) ? '압축파일' :
    '자료';
  return {
    isDoc: true,
    btnText: `📥 ${typeLabel} 다운받기`,
    hookText: `${typeLabel}를 다운받아 자세히 확인하세요!`,
  };
}

/**
 * 🧾 CTA 문구의 재료 — 글이 실제로 다룬 내용을 뽑아낸다 (v3.8.542)
 *
 * 사장님: "공식 CTA 후킹 문구랑 버튼 문구도 제목 그대로 하지말고
 *          본문에서 추론한 내용을 토대로 생성해야되"
 *
 * 재료를 넘기는 코드가 없던 게 아니다 — v3.8.501 부터 있었는데 **없는 키를 읽고 있었다**.
 *   섹션의 실제 모양 : { h2, h3Sections: [{ h3, content }] }
 *   그런데 읽던 것   : sec.title / sec.content / sec.body → 전부 undefined
 * 그래서 "글 맥락"이라며 넘긴 문자열은 공백뿐이었고, AI 는 키워드 하나만 보고 문구를 지었다.
 * 제목을 그대로 베낀 버튼("🔗 ○○ 공식 사이트")이 나온 진짜 이유가 이것이다.
 *
 * 다른 모양(title/content)으로 들어와도 버리지 않는다 — 세 경로가 payload 를 따로
 * 조립하는 구조라 한쪽만 맞추면 또 조용히 비어버린다.
 */
export function buildCtaArticleContext(
  generatedSections?: any[],
  officialSources?: Array<{ agency?: string; url?: string }>,
): { outline: string; excerpt: string; agencies: string; combined: string } {
  const strip = (html: unknown) =>
    String(html ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const sections = Array.isArray(generatedSections) ? generatedSections : [];
  const outlineParts: string[] = [];
  const excerptParts: string[] = [];

  for (const sec of sections) {
    const h2 = strip(sec?.h2 ?? sec?.title);
    if (h2) outlineParts.push(`## ${h2}`);

    const h3List = Array.isArray(sec?.h3Sections) ? sec.h3Sections : [];
    for (const h3 of h3List) {
      const head = strip(h3?.h3 ?? h3?.title);
      if (head) outlineParts.push(`- ${head}`);
      const body = strip(h3?.content ?? h3?.body);
      if (body) excerptParts.push(body);
    }

    const flat = strip(sec?.content ?? sec?.body);
    if (flat) excerptParts.push(flat);
  }

  const agencies = (Array.isArray(officialSources) ? officialSources : [])
    .map((o) => strip(o?.agency))
    .filter(Boolean)
    .join(', ');

  const outline = outlineParts.join('\n').slice(0, 1200);
  // 문단마다 앞부분만 고르게 걷는다 — 첫 섹션만 길게 읽으면 글 전체를 못 본다
  const excerpt = excerptParts.map((p) => p.slice(0, 400)).join('\n').slice(0, 3000);
  const combined = [outline, excerpt, agencies ? `확인된 기관: ${agencies}` : ''].filter(Boolean).join('\n');

  return { outline, excerpt, agencies, combined };
}

/**
 * 🔁 제목을 되뇐 문구인가 — "키워드 + 범용어" 뿐이면 본문을 안 읽고 지은 문구다 (v3.8.542)
 *
 * "🔗 LH신혼부부전세임대 공식 사이트" 처럼 제목에서 단어만 잘라 붙인 버튼을 걸러낸다.
 * 키워드를 전혀 안 쓴 문구는 검사 대상이 아니다 — 그건 이미 본문에서 나온 말이다.
 */
export function isCtaTextEchoOfTitle(text: string, keyword: string): boolean {
  const clean = (s: string) => String(s || '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const t = clean(text);
  const k = clean(keyword);
  if (!t || !k) return false;

  // 아무 글에나 붙는 말들을 걷어낸다 — 남는 게 이 글만의 정보다
  const rest = t.replace(
    /(더알아보세요|알아보세요|자세히보기|바로가기|보러가기|알아보기|공식사이트|홈페이지|확인하세요|확인하기|바로|공식|사이트|보기|가기|하기|정보|에대해|관련|에서)/g,
    '',
  );

  // 남은 게 없으면 범용어뿐이고, 남은 게 제목 안에 통째로 들어 있으면 제목을 옮겨 적은 것이다
  return rest.length < 2 || k.includes(rest);
}

/** AI 가 정한 목적지 — src/cta/smart-cta.ts 의 결과 (순환 import 을 피해 구조만 적는다) */
type SmartCtaTargetLike = {
  site: string;
  action: string;
  buttonLabel: string;
  hookMessage?: string;
  searchQuery: string;
};

export async function generateCTAsFinal(
  keyword: string,
  crawledPosts: FinalCrawledPost[],
  generatedSections?: any[],
  contentMode?: string,
  /**
   * v3.8.491 - 글을 쓰면서 실제로 확인한 기관 페이지들.
   * 이걸 주면 모델이 기억으로 주소를 짐작하지 않고 확인된 것 중에서 고른다.
   */
  officialSources?: Array<{ agency?: string; url?: string }>,
  /**
   * v3.8.542 - CTA 단계는 그동안 console.log 로만 말했다.
   * 앱 화면에는 "💰 CTA 버튼 생성 중..." 뒤로 아무 말이 없어서, 라우터가 돌았는지
   * 안 돌았는지 사장님이 확인할 방법이 없었다. 조용한 미배선과 구분이 안 된다.
   */
  onLog?: (message: string) => void,
): Promise<FinalCTAData[]> {
  // 🛡️ 애드센스 모드: CTA 완전 차단
  if (contentMode === 'adsense') {
    console.log('[CTA] 🛡️ 애드센스 모드 — CTA 생성 생략 (승인 정책 준수)');
    return [];
  }

  /**
   * v3.8.417 — "심층분석" 하다 찾았다: 쇼핑 글에서 이 함수의 결과가 통째로 버려지고 있었다.
   *
   * 바로 아래 "쇼핑 모드 CTA 특화 지시"를 보면 이 함수는 Gemini Search Grounding 으로
   * "쿠팡/네이버쇼핑/브랜드 공식몰/다나와 등"을 **일부러** 찾아오도록 설계돼 있다.
   * 실측(갤럭시 Z Flip8 발행글)에서 나온 samsung.com·danawa.com CTA 버튼이 바로 이 지시의 결과다.
   *
   * 그런데 orchestration.ts 에서 쇼핑 글은 v3.8.413 이후 sectionCta 를 렌더링하지 않는다
   * (사용자 링크가 아닌 CTA 는 넣지 않는다는 결정) — 즉 이 함수가 Gemini 호출까지 해서
   * 찾아온 CTA 는 section.h3Sections[...].cta 에 저장만 되고 **한 번도 렌더링되지 않는다.**
   * 쇼핑 글마다 안 쓸 걸 알면서 유료 호출(LLM + Search Grounding)을 하고 있었다.
   */
  if (contentMode === 'shopping') {
    console.log('[CTA] 🛒 쇼핑 모드 — 본문 CTA 는 사용자 제휴 링크만 쓴다 (검색 CTA 생성 생략, 비용 절감)');
    return [];
  }

  // 환경변수 로드
  const envData = loadEnvFromFile();
  const googleCseKey = envData['googleCseKey'] || envData['GOOGLE_CSE_KEY'] || (process.env as any)['GOOGLE_CSE_KEY'] || '';
  const googleCseCx = envData['googleCseCx'] || envData['GOOGLE_CSE_CX'] || (process.env as any)['GOOGLE_CSE_CX'] || '';

  const safeCTAs: FinalCTAData[] = [];

  /**
   * 🧾 v3.8.542 — 재료를 맨 앞에서 한 번만 만든다.
   * 예전엔 2단계(CSE 폴백) 안에서만 만들었다. 그런데 실제로 대부분의 글은 1단계에서
   * CTA 가 정해지고 끝난다 — 즉 본문 맥락은 거의 언제나 쓰이지 않았다.
   */
  const articleContext = buildCtaArticleContext(generatedSections, officialSources);
  const articleText = articleContext.combined;

  /**
   * 🧭 v3.8.542 — 스마트 라우터(v3.8.538)는 "필요해질 때 한 번만" 부른다.
   *
   * 예전: searchOfficialSite() 안에 있었고 그 함수는 1단계 실패 시에만 불렸다.
   *       1단계가 성공하는 한 라우터는 영영 돌지 않았다 — 지어놓고 안 쓴 셈이다.
   * 이제: 본문 맥락이 1단계 프롬프트에 들어가므로 대개 1단계가 제대로 된 문구를 만든다.
   *       라우터는 그게 실패했을 때(문구가 제목 복제거나, URL 을 못 찾았을 때)만 부른다.
   *       → 발행당 추가 호출은 "평소 0회, 필요할 때 1회". 그라운딩은 쓰지 않는다.
   * 한 발행 안에서 두 번 부르지 않도록 결과를 기억한다(모듈 캐시는 30분 · 키워드 단위).
   */
  let smartTargetResolved = false;
  let smartTarget: SmartCtaTargetLike | null = null;
  const ensureSmartTarget = async (): Promise<SmartCtaTargetLike | null> => {
    if (smartTargetResolved) return smartTarget;
    smartTargetResolved = true;
    if (contentMode === 'shopping') return null;
    try {
      const { resolveSmartCtaTarget } = require('../../cta/smart-cta');
      smartTarget = await resolveSmartCtaTarget({
        keyword,
        contentMode,
        articleHint: articleContext.combined.slice(0, 2000),
      });
    } catch (e: any) {
      console.log(`[CTA] 🧭 스마트 라우터 후퇴: ${String(e?.message || e).slice(0, 80)}`);
      smartTarget = null;
    }
    onLog?.(
      smartTarget
        ? `[PROGRESS] 70% - 🧭 CTA 목적지 판정: ${smartTarget.site} · ${smartTarget.action}`
        : '[PROGRESS] 70% - 🧭 CTA 목적지 판정 실패 — 기존 검색 경로로',
    );
    return smartTarget;
  };

  onLog?.(`[PROGRESS] 70% - 📖 CTA 문구 재료: 목차 ${articleContext.outline.length}자 · 본문 ${articleContext.excerpt.length}자`);

  /**
   * 🌐 1단계: 본문 맥락 + LLM 추론으로 실질적 CTA URL 찾기
   *
   * ⚠️ 이름에 속지 말 것 — 여기는 v3.8.418 부터 **Search Grounding 을 쓰지 않는다**
   *   (자동 구간 유료 검색 금지). 로그 문구만 "Search Grounding" 으로 남아 있어서
   *   그라운딩을 켠 것처럼 보였다. v3.8.542 에서 문구를 사실대로 고친다.
   *   주소의 생존 여부는 아래 hybridValidateCta() 가 실제 HTTP 로 확인한다.
   */
  console.log(`[CTA] 🌐 본문 맥락 기반 CTA 추론 중 (그라운딩 미사용): "${keyword}"`);

  try {
    // 🎯 모드별 CTA 가이드 — 글 톤과 일치하는 CTA를 유도
    const modeCtaHint = contentMode === 'shopping' ? `
🛍️ **쇼핑 모드 CTA 특화 지시**:
- **우선**: 가격 비교/리뷰/실제 구매 가능한 이커머스 페이지 (쿠팡/네이버쇼핑/브랜드 공식몰/다나와 등)
- 검색어에 "후기/리뷰/비교"가 붙으면 비교 페이지 또는 신뢰도 높은 리뷰 랜딩 우선
- 버튼 예시: "🛒 최저가 비교하기", "💰 가격 확인하기", "⭐ 실구매 후기 보기", "🛍️ 공식몰 바로가기"
- 훅 예시: "실제 구매자들이 선택한 최저가를 확인하세요!", "솔직한 리뷰부터 가격까지 한눈에!"
- actionType 권장: buy 또는 info
` : contentMode === 'internal' ? `
📝 **내부 정보 전달 모드 CTA 특화 지시**:
- **우선**: 주제의 공식 리소스/가이드/정부 사이트 (교육·학습·참고용)
- 구매 명령형 지양. 학습/탐색을 돕는 톤
- 버튼 예시: "📚 공식 가이드 보기", "🔍 자세히 알아보기", "📖 원문 확인하기"
- 훅 예시: "더 깊이 있는 정보는 공식 자료에서 확인하세요"
- actionType 권장: info 또는 check
` : contentMode === 'paraphrasing' ? `
🔄 **페러프레이징 모드 CTA 특화 지시**:
- **우선**: 주제의 원 출처가 아닌 "독자가 실행할 수 있는" 공식 사이트/서비스
- 원문을 재구성했으므로 CTA도 원문과 다른 앵글의 랜딩 제시
- 버튼 예시: "🚀 바로 시작하기", "🔍 실시간 확인하기"
- actionType 권장: apply, check, 또는 info
` : `
🌐 **SEO/정보 제공 모드 CTA 특화 지시**:
- **우선**: 정부·공공·기관 공식 사이트 (신청/조회/예약/등록 가능한 페이지)
- 버튼 예시: "🚀 바로 신청하기", "🔍 실시간 조회하기", "📅 예약하기"
- actionType 권장: apply, check, 또는 reserve
`;

    const ctaPrompt = `
당신은 한국 블로그 독자를 위한 CTA(Call-to-Action) 전문가입니다.

🎯 키워드: "${keyword}"
📌 글 모드: ${contentMode || 'external (SEO)'}
⚠️ 한글/영문만 사용. 중국어 한자 금지! 존재하지 않는 서비스/혜택을 만들어내지 마세요!
${articleContext.outline ? `\n📑 이 글의 목차:\n${articleContext.outline}\n` : ''}${articleContext.excerpt ? `\n📖 이 글이 실제로 다룬 내용(발췌):\n${articleContext.excerpt.slice(0, 2000)}\n` : ''}${articleContext.agencies ? `\n🏛️ 이 글을 쓰며 실제로 확인한 기관: ${articleContext.agencies}\n` : ''}${modeCtaHint}
🔴 **반드시 Google 검색으로** "${keyword}"에 대한 독자가 실제로 필요한 페이지를 찾으세요. (위 모드별 지시에 맞는 유형)

🔥 CTA는 "클릭하면 바로 해당 액션(구매/비교/신청/조회/예약 등)이 가능한 실질적 페이지"이어야 합니다!

❌ 절대 하지 말 것:
- 검색 결과 페이지 (search.naver.com, google.com/search 등) → 절대 금지!
- 블로그 글 (blog.naver.com, tistory.com 등) → 절대 금지!
- 404 에러, 존재하지 않는 페이지 → 절대 금지!
- URL을 추측하거나 만들어내기 → 절대 금지! 검색에서 확인한 것만!

✅ 좋은 CTA 예시 (모드별):
- 쇼핑: "아이폰 16" → https://www.apple.com/kr/iphone-16 또는 쿠팡/네이버쇼핑 상품 페이지
- SEO/정보: "청년도약계좌 신청" → https://www.kinfa.or.kr
- 정보/예약: "KTX 예약" → https://www.korail.com
- 내부/정보: "국민연금 제도" → https://www.nps.or.kr (제도 설명 페이지)

${buildOfficialCtaCandidates(officialSources || [])}
📋 아래 JSON 형식으로 **정확히 1개** 출력:
{
  "url": "검색에서 확인한 실제 URL (존재가 확인된 것만!)",
  "hookingMessage": "독자가 클릭하고 싶게 만드는 한 줄",
  "buttonText": "행동 유발 버튼 텍스트 (모드 톤에 맞게)",
  "actionType": "apply|check|reserve|buy|info 중 하나"
}

✍️ **문구는 제목이 아니라 본문에서 뽑는다** (v3.8.542 — 사장님 지시):
- ❌ 금지: 키워드/제목을 그대로 옮긴 문구 ("${keyword} 공식 사이트", "${keyword} 바로가기", "${keyword}에 대해 더 알아보세요")
- ✅ 필수: 위 "이 글이 실제로 다룬 내용" 에 나온 **구체적인 항목 1개**를 문구에 넣어라
  (그 글에서 다룬 서류·기한·조건·금액·절차 이름 등 — 본문에 없는 건 쓰지 마라)
- hookingMessage: 본문에서 독자가 막혔던 지점을 짚고, 그 페이지에서 무엇이 해결되는지 한 문장
  (예: "전세임대 계약이 남았는지부터 확인해야 퇴거 시점을 계산할 수 있습니다")
- buttonText: "○○에서 △△" 꼴로 20자 이내. 무엇을 하러 가는지가 보여야 한다
  (예: "LH 청약센터에서 계약 조회", "토지이음에서 용도지역 조회")
- 본문 내용을 근거로 문구를 못 만들겠으면 buttonText/hookingMessage 를 빈 문자열로 두어라 — 지어내지 마라

🚫 **buttonText/hookingMessage 작성 규칙** (v3.7.13 — 워드프레스 출력 깨짐 방지):
- HTML entity 절대 금지: &#8594; / &rarr; / &amp; / &nbsp; / &hellip; 등 entity 문자열 사용 X
- 화살표/특수문자가 필요하면 직접 유니코드 문자로 작성: → ← ⚡ 🚀 ✅ 📌 (entity 변환 없이)
- 따옴표·꺾쇠도 직접 사용: ( ) [ ] " ' (entity 변환 없이)
- 한글/영문/숫자/이모지만 사용. 중국어 한자(漢字) 금지.

📥 **파일 URL 처리 규칙** (중요):
- URL 끝이 .pdf/.ppt/.pptx/.hwp/.xlsx/.docx/.zip 등 문서 확장자면:
  - buttonText: "📥 PDF 다운받기", "📥 발표자료 다운받기", "📥 한글파일 다운받기" 등 **다운로드 형식**으로 작성
  - hookingMessage: "자료를 다운받아 자세히 확인하세요" 같은 **다운로드 유도** 문구
  - actionType: "info" 사용
- 절대 문서 URL에 "사이트 바로가기", "홈페이지 바로가기" 같은 웹사이트용 텍스트 사용 금지!

🔴🔴🔴 핵심: URL은 **검색에서 실제로 확인한 것만** 사용! 추측 금지!
JSON만 출력:
`;

    /**
     * v3.8.418 — Gemini Search Grounding 대신 일반 호출을 쓴다.
     *
     * 사용자: "Gemini Search Grounding 유료 호출은 선택형이니까 자동으로 하는구간은
     *   전부다 끊어줘 … 글 5개만 써도 10000원가까이나와서 자동으로 절대안돼"
     *
     * 이 CTA 는 모든 글마다(모드 불문) 자동으로 실행되는데 Grounding(편당 ₩500~1,500)을
     * 붙일 이유가 없다 — 바로 아래에서 hybridValidateCta() 가 실제 HTTP 요청으로
     * URL 생존 여부를 검증한다(160행). Grounding 없이 LLM 이 아는 URL 을 제안해도,
     * 죽은 링크나 지어낸 URL 은 이 실검증 단계에서 걸러진다. CTA 는 있으면 좋고 없어도
     * 되는 보충 기능이라 "가끔 CTA 가 안 잡힌다"는 손해가 "매 글 자동 과금"보다 훨씬 낫다.
     */
    const ctaResponse = await callGeminiWithRetry(ctaPrompt);
    const cleanJson = ctaResponse.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');

    try {
      const ctaData = JSON.parse(cleanJson);
      // v3.7.13: HTML entity decode + CJK \uC81C\uAC70 + \uB2E4\uC911 \uACF5\uBC31 \uC815\uB9AC \uD1B5\uD569 (\uC774\uC804\uC5D4 CJK\uB9CC \uCC98\uB9AC)
      if (ctaData.buttonText) ctaData.buttonText = sanitizeCtaText(ctaData.buttonText);
      if (ctaData.hookingMessage) ctaData.hookingMessage = sanitizeCtaText(ctaData.hookingMessage);

      if (ctaData.url && ctaData.url.startsWith('http')) {
        // 🔴 검색엔진 결과 페이지인지 체크
        const isSearchPage = /search\.(naver|google|daum|bing)\.com|google\.com\/search|m\.search/i.test(ctaData.url);
        const isBlogPage = /blog\.naver|tistory|brunch|velog|medium\.com|blogspot|wordpress\.com/i.test(ctaData.url);

        /**
         * v3.8.491 — 여기가 비어 있던 구멍이었다.
         *
         * v3.8.490 에서 넣은 도메인 검증(judgeCtaHost)이 **CSE 폴백에만** 걸려 있었다.
         * 정작 1순위인 이 AI 추론 경로는 "검색엔진·블로그인가" 와 "살아있는가" 만 봤다.
         * 그래서 낯선 도메인도 살아있기만 하면 통과했다
         * (사장님이 겪은 postmate.waffle-gl.org 가 이 경로로 나왔을 가능성이 크다).
         */
        const aiHostVerdict = judgeCtaHost(ctaData.url, keyword);
        if (!aiHostVerdict.ok) {
          console.warn(`[CTA] 🚫 AI 추론 주소 거절 — ${describeHostVerdict(aiHostVerdict)}: ${ctaData.url}`);
        }

        if (!isSearchPage && !isBlogPage && aiHostVerdict.ok) {
          // 🔀 하이브리드 검증: HTTP 1차 + (의심 시/엄격 모드) Perplexity AI 2차
          const isValid = await hybridValidateCta(ctaData.url, keyword, 5000, contentMode);
          if (isValid) {
            // 📥 파일 다운로드 URL 감지 — AI가 반환한 텍스트보다 우선 (AI가 "사이트 바로가기"로 잘못 생성하는 케이스 방지)
            const doc = detectDocumentCta(ctaData.url);
            // 🎯 모드별 기본 버튼/훅 텍스트
            const modeDefaultButton = contentMode === 'shopping' ? `🛒 ${keyword} 최저가 확인`
              : contentMode === 'internal' ? `📚 ${keyword} 자세히 알아보기`
              : contentMode === 'paraphrasing' ? `🔍 ${keyword} 원문 확인하기`
              : `🔗 ${keyword} 바로가기`;
            const modeDefaultHook = contentMode === 'shopping' ? `실제 구매자들이 선택한 가격과 후기를 확인하세요!`
              : contentMode === 'internal' ? `더 깊이 있는 정보는 공식 자료에서 확인하세요`
              : contentMode === 'paraphrasing' ? `주제의 원 출처와 추가 자료를 살펴보세요`
              : `${keyword}에 대해 더 알아보세요!`;
            /**
             * ✍️ v3.8.542 — 문구 출처 우선순위 (사장님: "제목 그대로 하지말고 본문에서")
             *   1) 문서 URL → 다운로드 문구 (기존 규칙 유지, 최우선)
             *   2) 본문을 읽고 만든 AI 문구 — 단 제목을 되뇐 것이면 탈락시킨다
             *   3) 스마트 라우터가 정한 목적지 문구 (여기서 처음 필요해지면 그때 호출)
             *   4) 키워드 템플릿 (최후의 수단 — 이게 바로 사장님이 지적한 그 문구다)
             */
            const aiButton = String(ctaData.buttonText || '').trim();
            const aiHook = String(ctaData.hookingMessage || '').trim();
            const aiButtonUsable = !!aiButton && !isCtaTextEchoOfTitle(aiButton, keyword);
            const aiHookUsable = !!aiHook && !isCtaTextEchoOfTitle(aiHook, keyword);
            if (aiButton && !aiButtonUsable) {
              console.log(`[CTA] 🔁 제목 복제 버튼 문구 기각: "${aiButton}"`);
            }

            const needFallbackText = !doc.isDoc && (!aiButtonUsable || !aiHookUsable);
            const target = needFallbackText ? await ensureSmartTarget() : null;

            const finalButtonText = doc.isDoc
              ? doc.btnText
              : aiButtonUsable
                ? aiButton
                : target?.buttonLabel
                  ? `🔗 ${target.buttonLabel}`
                  : modeDefaultButton;
            const finalHookMessage = doc.isDoc
              ? doc.hookText
              : aiHookUsable
                ? aiHook
                : target?.hookMessage || (target?.buttonLabel ? `${target.buttonLabel} — 공식 화면에서 바로 확인하세요.` : modeDefaultHook);
            onLog?.(
              `[PROGRESS] 70% - 💰 CTA 문구: ${doc.isDoc ? '문서 다운로드' : aiButtonUsable ? '본문 근거' : target ? `목적지(${target.site})` : '키워드 기본값'} · "${finalButtonText}"`,
            );
            if (doc.isDoc && ctaData.buttonText && ctaData.buttonText !== doc.btnText) {
              console.log(`[CTA] 🔧 문서 URL 감지 → AI 버튼 텍스트("${ctaData.buttonText}") 무시하고 "${doc.btnText}"로 교체`);
            }

            safeCTAs.push({
              hookingMessage: finalHookMessage,
              buttonText: finalButtonText,
              url: ctaData.url,
              position: 1,
              type: 'link',
              design: 'button',
              text: finalButtonText,
              hook: finalHookMessage,
            });
            console.log(`[CTA] ✅ 1단계(추론) CTA 하이브리드 검증 통과: ${ctaData.url}`);
          } else {
            console.log(`[CTA] ❌ 1단계(추론) CTA 검증 실패 (HTTP+AI 하이브리드): ${ctaData.url}`);
          }
        } else {
          console.log(`[CTA] ⚠️ 검색엔진/블로그 URL 감지, 필터링: ${ctaData.url}`);
        }
      }
    } catch (parseErr) {
      console.log(`[CTA] ⚠️ Grounding CTA JSON 파싱 실패, 폴백으로 진행`);
    }
  } catch (groundingErr: any) {
    console.log(`[CTA] ⚠️ 1단계(추론) CTA 실패: ${groundingErr.message?.substring(0, 100)}`);
  }

  // 🔥 2단계: 1단계 추론 실패 시 기존 Google CSE 폴백
  if (safeCTAs.length === 0 && googleCseKey && googleCseCx) {
    console.log('[CTA] 폴백: Google CSE로 공식 사이트 검색...');
    /**
     * v3.8.501 — 글 맥락을 함께 넘긴다.
     * 본문에 "복지로에서 신청합니다" 처럼 어디서 하는 일인지 이미 적혀 있다.
     * 그걸 읽어야 같은 "신청하기" 버튼이 있어도 엉뚱한 기관을 거를 수 있다.
     *
     * v3.8.542 — 여기서 만들던 재료가 없는 키(sec.title/sec.content)를 읽어 늘 비어 있었다.
     * 이제 맨 위에서 실제 키(h2 / h3Sections[].content)로 만든 것을 그대로 쓴다.
     */
    const cseSmartTarget = await ensureSmartTarget();
    const officialLink = await searchOfficialSite(keyword, googleCseKey, googleCseCx, contentMode, false, articleText, cseSmartTarget);
    if (officialLink) {
      const shortKeyword = keyword.length > 15 ? keyword.split(/\s+/).slice(0, 2).join(' ') : keyword;
      let btnText = `🔗 ${shortKeyword} 공식 사이트`;
      let hookText = `${shortKeyword}에 대해 더 알아보세요!`;
      // 🔀 하이브리드 검증
      const isCseValid = await hybridValidateCta(officialLink.url, keyword, 5000, contentMode);
      if (isCseValid) {
        const shortKeyword2 = keyword.length > 15 ? keyword.split(/\s+/).slice(0, 2).join(' ') : keyword;
        const docCse = detectDocumentCta(officialLink.url);
        let btnText2 = docCse.isDoc ? docCse.btnText : `🔗 ${shortKeyword2} 공식 사이트`;
        let hookText2 = docCse.isDoc ? docCse.hookText : `${shortKeyword2}에 대해 더 알아보세요!`;

        // 🧭 v3.8.538: AI 가 정한 목적지면 버튼 문구도 그 상황에 맞게
        //   ("토지이음에서 용도지역 조회" — 키워드 정규식의 범용 문구보다 구체적)
        if (!docCse.isDoc && (officialLink as any).smartLabel) {
          btnText2 = `🔗 ${(officialLink as any).smartLabel}`;
          // v3.8.542: 후킹 문구도 본문을 읽고 지은 것을 먼저 쓴다 (없을 때만 범용 문장)
          hookText2 = cseSmartTarget?.hookMessage
            || `${(officialLink as any).smartLabel} — 공식 화면에서 바로 확인하세요.`;
        } else if (!docCse.isDoc) {
          // 🛍️ 쇼핑 모드 우선 매핑 (모드가 shopping이면 구매/비교 CTA 먼저)
          if (contentMode === 'shopping') {
            if (keyword.match(/최저가|가격|할인|세일/)) {
              btnText2 = '💰 최저가 확인하기';
              hookText2 = '실시간 가격을 비교하고 가장 저렴한 곳을 찾으세요!';
            } else if (keyword.match(/비교|차이|vs|대비/)) {
              btnText2 = '⚖️ 상세 비교하기';
              hookText2 = '스펙과 가격을 한눈에 비교해보세요!';
            } else if (keyword.match(/후기|리뷰|평가|사용기/)) {
              btnText2 = '⭐ 실구매 후기 보기';
              hookText2 = '실제 구매자들의 솔직한 후기를 확인하세요!';
            } else if (keyword.match(/추천|best|베스트|인기/)) {
              btnText2 = '🏆 베스트 상품 보기';
              hookText2 = '실구매자들이 선택한 인기 상품을 확인하세요!';
            } else {
              btnText2 = '🛒 상품 정보 보기';
              hookText2 = '가격·스펙·후기까지 한눈에 확인하세요!';
            }
          } else if (keyword.match(/신청|접수|등록|발급/)) {
            btnText2 = '🚀 바로 신청하기';
            hookText2 = '지금 바로 신청을 진행해보세요!';
          } else if (keyword.match(/조회|확인|검색|계산/)) {
            btnText2 = '🔍 바로 조회하기';
            hookText2 = '간편하게 결과를 확인하세요.';
          } else if (keyword.match(/예약|예매/)) {
            btnText2 = '📅 바로 예약하기';
            hookText2 = '매진되기 전에 빠르게 예약하세요!';
          } else if (keyword.match(/보조금|지원금|지원사업|보조/)) {
            btnText2 = '🚀 지원사업 신청하기';
            hookText2 = '지금 바로 지원사업을 확인하고 신청하세요!';
          }
        }

        safeCTAs.push({
          hookingMessage: hookText2,
          buttonText: btnText2,
          url: officialLink.url,
          position: 1,
          type: 'link',
          design: 'button',
          text: btnText2,
          hook: hookText2,
        });
        console.log(`[CTA] ✅ CSE 폴백 CTA 하이브리드 검증 통과: ${officialLink.url}`);
      } else {
        console.log(`[CTA] ❌ CSE 폴백 CTA 검증 실패 (HTTP+AI 하이브리드): ${officialLink.url}`);
      }
    }
  }

  // 🔥 3단계: 크롤링 데이터에서 공식 링크 탐색 (모드별 도메인 우선순위)
  if (safeCTAs.length === 0 && crawledPosts.length > 0) {
    // 🎯 모드별 신뢰 도메인
    const officialDomains = contentMode === 'shopping'
      ? ['coupang.com', 'smartstore.naver.com', 'shopping.naver.com', '11st.co.kr', 'gmarket.co.kr', 'danawa.com', 'apple.com', 'samsung.com', 'lg.com']
      : ['.go.kr', '.or.kr', '.ac.kr', '.re.kr', '.gov', '.edu', '.org'];
    const blogDomains = ['tistory', 'naver.com/blog', 'blog.naver', 'wordpress', 'blogspot', 'velog', 'brunch', 'medium.com'];

    for (const post of crawledPosts) {
      const url = post.url?.toLowerCase() || '';
      const isOfficial = officialDomains.some(d => url.includes(d));
      const isBlog = blogDomains.some(d => url.includes(d));
      if (isOfficial && !isBlog) {
        const isCrawledValid = await hybridValidateCta(post.url || '', keyword, 5000, contentMode);
        if (isCrawledValid) {
          const docCrawled = detectDocumentCta(post.url || '');
          const dlBtn = docCrawled.isDoc ? docCrawled.btnText
            : contentMode === 'shopping' ? '🛒 상품 페이지 보기'
            : contentMode === 'internal' ? '📚 공식 자료 보기'
            : '🔗 공식 사이트 바로가기';
          const dlHook = docCrawled.isDoc ? docCrawled.hookText
            : contentMode === 'shopping' ? '가격과 실구매 후기를 확인하세요!'
            : contentMode === 'internal' ? '신뢰할 수 있는 공식 자료를 확인하세요'
            : '정확한 정보는 공식 사이트에서 확인하세요!';
          safeCTAs.push({
            hookingMessage: dlHook,
            buttonText: dlBtn,
            url: post.url || '',
            position: 1,
            type: 'link',
            design: 'button',
            text: dlBtn,
            hook: dlHook,
          });
          console.log(`[CTA] ✅ 크롤링 데이터 공식 링크 하이브리드 검증 통과: ${post.url}`);
          break;
        } else {
          console.log(`[CTA] ❌ 크롤링 데이터 공식 링크 검증 실패 (HTTP+AI 하이브리드): ${post.url}`);
        }
      }
    }
  }

  // 🔥 4단계: 키워드 맞춤형 공식 서비스 CTA
  if (safeCTAs.length === 0) {
    console.log(`[CTA] ⚠️ 모든 검색 실패. 키워드 맞춤형 공식 서비스 매핑 시도...`);

    const catalogLink = resolveOfficialLink({
      query: keyword,
      intent: inferCtaIntent(keyword),
    });
    if (catalogLink) {
      const catalogValid = await hybridValidateCta(catalogLink.url, keyword, 5000, contentMode);
      if (catalogValid) {
        const docCatalog = detectDocumentCta(catalogLink.url);
        const btnText = docCatalog.isDoc ? docCatalog.btnText : `🔗 ${catalogLink.name} 바로가기`;
        const hookText = docCatalog.isDoc ? docCatalog.hookText : `${keyword} 관련 공식 정보를 확인하세요.`;
        safeCTAs.push({
          hookingMessage: hookText,
          buttonText: btnText,
          url: catalogLink.url,
          position: 1,
          type: 'link',
          design: 'button',
          text: btnText,
          hook: hookText,
        });
        console.log(`[CTA] ✅ 공식 카탈로그 CTA 검증 통과: ${catalogLink.url}`);
      } else {
        console.log(`[CTA] ❌ 공식 카탈로그 CTA 검증 실패: ${catalogLink.url}`);
      }
    }

    const specificMappings: { pattern: RegExp; url: string; btnText: string; hookText: string }[] = [
      // v3.8.362: 4대보험 관련 매핑을 최상단에 배치 (specificMappings는 첫 매칭 우선)
      //   과거: '보험' 키워드가 finance 카테고리로 매칭돼 삼성화재/현대해상 오매칭
      //   현재: 4대사회보험 정보연계센터 및 각 공단을 우선 매핑
      { pattern: /4대\s*보험|사회\s*보험|4대사회보험/, url: 'https://www.4insure.or.kr/', btnText: '🏛️ 4대사회보험 정보연계센터', hookText: '4대보험 자격·납부·증명 발급을 통합 조회하세요.' },
      { pattern: /육아휴직|출산휴가|육아기\s?근로시간|배우자\s?출산/, url: 'https://www.ei.go.kr/ei/eih/cm/hm/main.do', btnText: '👶 고용노동부 모성보호', hookText: '육아휴직·출산휴가 급여·신청 절차를 공식 안내에서 확인하세요.' },
      { pattern: /국민연금|납부예외|납부유예|노령연금|장애연금|유족연금/, url: 'https://www.nps.or.kr/', btnText: '🏛️ 국민연금공단 바로가기', hookText: '국민연금 가입·납부·수령을 공식 사이트에서 확인하세요.' },
      { pattern: /산재보험|산업재해|근로복지공단/, url: 'https://www.kcomwel.or.kr/', btnText: '🛡️ 근로복지공단', hookText: '산재보험 신청·보상 절차를 공식 사이트에서 확인하세요.' },
      { pattern: /지원금|보조금|연금|수당|청년|장려금|바우처|복지/, url: 'https://www.bokjiro.go.kr/', btnText: '🎁 복지로에서 혜택 찾기', hookText: '나에게 맞는 복지 혜택을 복지로에서 확인하세요!' },
      { pattern: /세금|국세|종소세|부가세|연말정산|원천징수/, url: 'https://www.hometax.go.kr/', btnText: '💰 홈택스 바로가기', hookText: '세금 관련 신고·조회를 홈택스에서 바로 처리하세요.' },
      { pattern: /건강보험|건보|의료보험/, url: 'https://www.nhis.or.kr/', btnText: '🏥 건강보험 조회하기', hookText: '건강보험 자격·보험료를 공식 사이트에서 확인하세요.' },
      { pattern: /고용보험|실업급여|취업|구직/, url: 'https://www.ei.go.kr/', btnText: '💼 고용보험 조회하기', hookText: '고용보험 자격·실업급여를 바로 확인하세요.' },
      { pattern: /부동산|아파트|전세|월세|집값|매매|실거래/, url: 'https://rt.molit.go.kr/', btnText: '🏠 실거래가 조회하기', hookText: '국토교통부 실거래가 공개시스템에서 확인하세요.' },
      // v3.8.327: 자격증·국가시험 매핑 (사용자 보고: "세무사 시험일정" 같은 자격증 CTA 부정확)
      // 한국산업인력공단 Q-net — 대부분 국가전문자격시험 통합 관리
      { pattern: /세무사|변리사|공인노무사|감정평가사|법무사|행정사|관세사|손해사정사|공인중개사|주택관리사|기술사|기능장|기능사|산업기사|기사\s|국가기술자격/, url: 'https://www.q-net.or.kr/', btnText: '📚 Q-net 시험 정보 확인', hookText: '한국산업인력공단 Q-net에서 시험 일정·응시 자격을 정확히 확인하세요.' },
      // 회계사(공인회계사)
      { pattern: /공인회계사|회계사\s?시험|CPA/, url: 'https://cpa.fss.or.kr/', btnText: '📊 금감원 CPA 시험 정보', hookText: '금융감독원 공식 CPA 시험 페이지에서 확인하세요.' },
      // 변호사시험
      { pattern: /변호사시험|로스쿨\s?시험|법조인|사법시험/, url: 'https://www.moj.go.kr/moj/index.do', btnText: '⚖️ 법무부 변호사시험 정보', hookText: '법무부 공식 페이지에서 확인하세요.' },
      // 공무원시험
      { pattern: /공무원\s?시험|9급|7급|국가직|지방직|경찰\s?시험|소방\s?시험/, url: 'https://gosi.kr/', btnText: '👮 사이버국가고시센터', hookText: '공무원시험 원서 접수·일정을 공식 사이트에서 확인하세요.' },
      // 수능·모의고사
      { pattern: /수능|대학수학능력|모의고사|EBS|한국교육과정평가원/, url: 'https://www.suneung.re.kr/', btnText: '🎓 수능 공식 사이트', hookText: '한국교육과정평가원 수능 공식 페이지에서 확인하세요.' },
      // 토익·토플·오픽·JLPT 등 어학시험
      { pattern: /토익|TOEIC|OPIC|오픽|토플|TOEFL|IELTS|아이엘츠|JLPT|일본어능력/, url: 'https://exam.toeic.co.kr/', btnText: '🎧 어학시험 공식 접수', hookText: '어학시험 원서 접수를 공식 사이트에서 확인하세요.' },
      // 자동차·운전면허
      { pattern: /운전면허|면허\s?시험|도로주행|기능시험/, url: 'https://dls.koroad.or.kr/', btnText: '🚗 도로교통공단 안전운전 통합민원', hookText: '운전면허 시험 예약·조회를 공식 사이트에서 하세요.' },
      // 자격증 일반 (fallback)
      { pattern: /자격증|국가시험|시험\s?일정|응시\s?자격|시험\s?접수/, url: 'https://www.q-net.or.kr/', btnText: '📚 Q-net 통합 자격 정보', hookText: '한국산업인력공단 Q-net에서 국가전문자격 정보를 확인하세요.' },
    ];

    if (safeCTAs.length === 0) {
      for (const mapping of specificMappings) {
        if (mapping.pattern.test(keyword)) {
          const mappingValid = await hybridValidateCta(mapping.url, keyword, 5000, contentMode);
          if (mappingValid) {
            safeCTAs.push({
              hookingMessage: mapping.hookText,
              buttonText: mapping.btnText,
              url: mapping.url,
              position: 1,
              type: 'link',
              design: 'button',
              text: mapping.btnText,
              hook: mapping.hookText,
            });
            console.log(`[CTA] ✅ 키워드 매핑 CTA 검증 성공: ${mapping.url}`);
          } else {
            console.log(`[CTA] ❌ 키워드 매핑 CTA 검증 실패: ${mapping.url}`);
          }
          break;
        }
      }
    }

    if (safeCTAs.length === 0) {
      console.log(`[CTA] ℹ️ "${keyword}" — 유효한 CTA를 찾지 못했습니다. CTA 생략.`);
    }
  }

  // 스마트 툴 링크 (Pexels, Pixabay 등)
  if (generatedSections && generatedSections.length > 0) {
    const fullText = generatedSections.flatMap(s => s.h3Sections.map((h: any) => h.content)).join(' ');

    const smartTools = [
      { name: 'Pexels', url: 'https://www.pexels.com/ko-kr/', keywords: ['pexels', '펙셀스', '무료 이미지', '무료 사진', '저작권 없는 이미지'], hook: '저작권 걱정 없는 고화질 이미지가 필요하신가요?', btn: '📸 Pexels에서 이미지 찾기' },
      { name: 'Pixabay', url: 'https://pixabay.com/ko/', keywords: ['pixabay', '픽사베이', '무료 스톡', '고화질 사진'], hook: '상업적 이용이 가능한 무료 이미지를 지금 확인해보세요.', btn: '🖼️ Pixabay 바로가기' },
      { name: 'Unsplash', url: 'https://unsplash.com/', keywords: ['unsplash', '언스플래쉬', '감성 사진', '배경화면'], hook: '감각적인 무료 이미지를 찾고 계신가요?', btn: '🎨 Unsplash 갤러리 구경하기' },
    ];

    for (const tool of smartTools) {
      if (safeCTAs.length > 1) break;

      const hasKeyword = tool.keywords.some(k => fullText.toLowerCase().includes(k) || keyword.toLowerCase().includes(k));
      if (hasKeyword) {
        const toolValid = await hybridValidateCta(tool.url, keyword, 4000, contentMode);
        if (toolValid) {
          safeCTAs.push({
            type: 'link',
            text: tool.btn,
            url: tool.url,
            design: 'button',
            hook: tool.hook,
            hookingMessage: tool.hook,
            buttonText: tool.btn
          });
        } else {
          console.log(`[CTA] ❌ 스마트 툴 CTA 검증 실패: ${tool.url}`);
        }
        break;
      }
    }
  }

  if (safeCTAs.length === 0) {
    // v3.8.175: 구글 검색 fallback 완전 제거
    //   사용자 핵심 지적: '구글 검색으로 연동되버리면 내글을 보는 이유가없자나'
    //   → 자기 트래픽 죽이지 않도록 공식 사이트 매핑 → 매핑 없으면 CTA 자체 안 생성
    //   모든 모드(SEO/internal/paraphrasing/shopping)에 동일 적용
    const OFFICIAL_FALLBACK_SITES: Array<{ keywords: string[]; actionUrl: string; infoUrl?: string }> = [
      // 정부·청원
      { keywords: ['청원24', '국민동의청원', '국회청원'], actionUrl: 'https://petitions.assembly.go.kr/' },
      { keywords: ['국민신문고', '민원'], actionUrl: 'https://www.epeople.go.kr/' },
      { keywords: ['정부24', '주민등록', '인감', '등본', '초본'], actionUrl: 'https://www.gov.kr/portal/main/nologin', infoUrl: 'https://www.gov.kr/' },
      // 세금
      { keywords: ['홈택스', '연말정산', '종합소득세', '부가세'], actionUrl: 'https://www.hometax.go.kr/' },
      { keywords: ['위택스', '재산세', '자동차세', '취득세'], actionUrl: 'https://www.wetax.go.kr/' },
      // 청년·복지
      { keywords: ['청년도약계좌'], actionUrl: 'https://ydak.kinfa.or.kr/' },
      { keywords: ['청년내일저축계좌', '청년적금'], actionUrl: 'https://www.bokjiro.go.kr/' },
      { keywords: ['청년월세'], actionUrl: 'https://www.gov.kr/portal/onestopSvc/youngMonthlyRent' },
      { keywords: ['복지로'], actionUrl: 'https://www.bokjiro.go.kr/' },
      // 금융
      { keywords: ['주택청약', '청약홈'], actionUrl: 'https://www.applyhome.co.kr/' },
      { keywords: ['전세보증보험', 'HUG', '전세사기'], actionUrl: 'https://www.khug.or.kr/' },
      { keywords: ['신용회복', '개인회생'], actionUrl: 'https://www.ccrs.or.kr/' },
      // 보험
      { keywords: ['국민연금'], actionUrl: 'https://www.nps.or.kr/' },
      { keywords: ['건강보험', '4대보험'], actionUrl: 'https://www.nhis.or.kr/' },
      { keywords: ['고용보험', '실업급여'], actionUrl: 'https://www.ei.go.kr/' },
      { keywords: ['산재보험'], actionUrl: 'https://www.kcomwel.or.kr/' },
      // 노동·교육
      { keywords: ['워크넷', '구직', '취업'], actionUrl: 'https://www.work24.go.kr/' },
      { keywords: ['HRD-Net', '국비지원', '내일배움'], actionUrl: 'https://www.hrd.go.kr/' },
      // 부동산
      { keywords: ['LH', '청년임대', '행복주택'], actionUrl: 'https://www.lh.or.kr/' },
      { keywords: ['SH', '서울주택도시공사'], actionUrl: 'https://www.i-sh.co.kr/' },
      { keywords: ['실거래가'], actionUrl: 'https://rt.molit.go.kr/' },
      // 운전·자동차
      { keywords: ['운전면허', '도로교통공단'], actionUrl: 'https://dls.koroad.or.kr/' },
      { keywords: ['자동차등록', '교통민원24'], actionUrl: 'https://www.efine.go.kr/' },
      // 의료
      { keywords: ['건강검진'], actionUrl: 'https://www.nhis.or.kr/' },
      { keywords: ['병원평가', '심평원'], actionUrl: 'https://www.hira.or.kr/' },
      // 교통
      { keywords: ['KTX', '코레일'], actionUrl: 'https://www.korail.com/' },
      { keywords: ['SRT'], actionUrl: 'https://etk.srail.kr/' },
      { keywords: ['고속버스'], actionUrl: 'https://www.kobus.co.kr/' },
      // 채용
      { keywords: ['공무원시험'], actionUrl: 'https://gosi.kr/' },
      { keywords: ['공기업 채용', '나라일터'], actionUrl: 'https://www.gojobs.go.kr/' },
      // v3.8.327: 자격증·국가전문자격시험 (Q-net 통합)
      { keywords: ['세무사', '변리사', '공인노무사', '감정평가사', '법무사', '행정사', '관세사', '손해사정사', '공인중개사', '주택관리사', '기술사', '기능장', '기능사', '산업기사', '국가기술자격', 'Q-net', 'q-net'], actionUrl: 'https://www.q-net.or.kr/' },
      { keywords: ['공인회계사', 'CPA', '회계사시험'], actionUrl: 'https://cpa.fss.or.kr/' },
      { keywords: ['변호사시험', '로스쿨시험'], actionUrl: 'https://www.moj.go.kr/moj/index.do' },
      { keywords: ['수능', '대학수학능력', '수능일정'], actionUrl: 'https://www.suneung.re.kr/' },
      { keywords: ['토익', 'TOEIC', '토플', 'TOEFL', '오픽', 'OPIC', 'JLPT'], actionUrl: 'https://exam.toeic.co.kr/' },
    ];
    const detectIntent = (text: string): 'action' | 'info' => {
      const t = String(text || '').toLowerCase();
      return /(신청|가입|등록|발급|접수|신고|예매|예약|구매|결제|로그인)/.test(t) ? 'action' : 'info';
    };
    const lowerKw = String(keyword || '').toLowerCase();
    const matched = OFFICIAL_FALLBACK_SITES.find((s) => s.keywords.some((kw) => lowerKw.includes(kw.toLowerCase())));
    if (matched) {
      const intent = detectIntent(keyword);
      const fallbackUrl = intent === 'action' ? matched.actionUrl : (matched.infoUrl || matched.actionUrl);
      safeCTAs.push({
        hookingMessage: `${keyword} 관련 공식 사이트에서 정확한 정보를 확인하세요`,
        buttonText: `🔗 ${keyword} 공식 사이트`,
        url: fallbackUrl,
        position: 1,
        type: 'link',
        design: 'button',
        text: `🔗 ${keyword} 공식 사이트`,
        hook: `${keyword} 관련 공식 사이트에서 정확한 정보를 확인하세요`,
        searchFallback: false,
      });
      console.log(`[CTA] 🎯 공식 사이트 매핑 fallback (${intent}): ${fallbackUrl}`);
    } else {
      // 매핑도 없으면 — CTA 자체 안 만듦. 본문 텍스트로만 안내.
      //   구글 검색 URL X (자기 트래픽 보호)
      console.log(`[CTA] ⚠️ 공식 사이트 매핑도 없음 — CTA 생략 (구글 검색 fallback 차단)`);
    }
  }

  return safeCTAs;
}

export async function generateSummaryTableFinal(allContent: string): Promise<FinalTableData> {
  const tableToday = new Date().toISOString().slice(0, 10);
  // 🧹 입력 전처리 — 상품 카드/버튼/이미지 같은 HTML 제거 후 AI에 전달
  //    (그대로 넣으면 AI가 셀 값으로 HTML 조각을 복사해 넣음 → 모바일 레이아웃 깨짐)
  const cleanedContent = String(allContent || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')          // a 태그는 내용만 유지
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    // 광고/CTA/상품 카드로 보이는 div 블록 제거
    .replace(/<div[^>]*class="[^"]*(cta|ad-|product|coupang|affiliate|price|buy)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<[^>]+>/g, ' ')                              // 나머지 태그도 다 벗겨 순수 텍스트로
    .replace(/\s+/g, ' ')
    .trim();

  const prompt = `
📅 오늘: ${tableToday}
전체 내용 (순수 텍스트):

${cleanedContent.slice(0, 2000)}

위 본문 내용을 기반으로 핵심 요약표를 만드세요 (그리드 형식).

🚫🚫🚫 **절대 규칙 — 반드시 지킬 것**:
1. 본문에 실제로 언급된 내용만 요약! 본문에 없는 정보 추가 금지!
2. **셀 값은 오직 평문(plain text)만!** HTML 태그, <div>, <img>, <a>, 버튼 등 절대 금지!
3. 가격/상품명 나열 금지 — 상품 정보는 다른 섹션에 있음. 여기는 "핵심 요약"만.
4. 각 셀은 30자 이내로 간결하게. 쉼표/접속사로 나열식 자제.
5. 숫자/통계는 본문에서 그대로 인용
6. 한글/영문/숫자만 사용. 한자 금지!

✅ 좋은 예:
  ["주요 대상", "30~40대 직장인"]
  ["핵심 혜택", "세액공제 최대 700만원"]

❌ 나쁜 예 (절대 출력 금지):
  ["상품", "<div class='...'>조르쥬 레쉬 자켓 289,000원 <button>구매하기</button></div>"]
  ["추천", "<img src='...'/><br>가격: 49,000원"]

JSON:
{
  "type": "summary",
  "headers": ["항목", "내용"],
  "rows": [
    ["주요 내용", "본문 기반 핵심"],
    ["대상", "본문 기반"],
    ...3~5행
  ]
}

JSON만 (평문 셀):
`;

  try {
    const response = await callGeminiWithRetry(prompt);
    const json = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const parsed = JSON.parse(json);
    // CJK 필터링 + HTML 태그 2차 스트립 (AI가 지시 어기고 HTML 넣은 경우 방어)
    const cjk = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;
    const stripHtml = (cell: string) =>
      String(cell || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (parsed.rows) {
      parsed.rows = parsed.rows
        .map((row: string[]) => row.map((cell: string) => stripHtml((cell || '').replace(cjk, ''))))
        .filter((row: string[]) => row.some((c: string) => c.length > 0));
    }
    if (parsed.headers) {
      parsed.headers = parsed.headers.map((h: string) => stripHtml((h || '').replace(cjk, '')));
    }
    return parsed;
  } catch {
    // 폴백: 본문에서 키워드 추출하여 최소한의 테이블 생성
    const keywordMatch = allContent.match(/<h2[^>]*>([^<]+)<\/h2>/g);
    const h2List = keywordMatch ? keywordMatch.map(h => h.replace(/<[^>]+>/g, '').trim()).slice(0, 3) : [];
    return {
      type: 'summary',
      headers: ['항목', '내용'],
      rows: h2List.length > 0
        ? h2List.map((h, i) => [`핵심 ${i + 1}`, h])
        : [['내용', '위 본문을 참고해주세요']],
    };
  }
}

export async function generateHashtagsFinal(keyword: string, h2s: string[]): Promise<string> {
  const prompt = `
키워드: ${keyword}
H2들: ${h2s.join(', ')}

위 키워드와 소제목을 기반으로 검색에 유리한 해시태그를 10개 이상 만드세요.

요구사항:
1. # 사용 금지
2. , 로만 구분
3. 키워드와 H2에서 파생된 실제 검색어만 사용. 허위/과장 태그 금지!
4. 한글/영문만 사용. 한자 금지!

예: 태그1, 태그2, 태그3, ...

태그만:
`;

  try {
    const response = await callGeminiWithRetry(prompt);
    return response.trim().replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '');
  } catch {
    // 폴백: 키워드 + H2 기반 태그
    const tags = [keyword, ...h2s.slice(0, 5)].join(', ');
    return tags;
  }
}
