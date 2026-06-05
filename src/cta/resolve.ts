
// src/cta/resolve.ts
import type { OfficialLink } from './official-catalog';
import { OFFICIAL_CATALOG } from './official-catalog';
import fs from 'node:fs';
import path from 'node:path';

function loadCtaLinks(): any[] {
  try {
    // 프로젝트 루트 기준: data/cta/cta-links.json
    const p = path.resolve(process.cwd(), 'data/cta/cta-links.json');
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return []; // 파일 없거나 파싱 실패 시 빈 배열
  }
}
const links: any[] = loadCtaLinks();

type CTALink = { name: string; url: string; tags: string[]; weight?: number };

const ACTIVE_JSON: CTALink[] = (links as any[])
  .filter(x => x?.status === 'active')
  .map(x => ({
    name: x.name ?? '',
    url: String(x.url || ''),
    tags: Array.isArray(x.keywords) ? x.keywords : [],
    weight: 1,
  }));

const STATIC_CATALOG: CTALink[] = OFFICIAL_CATALOG.map((x: OfficialLink) => ({
  name: x.txt, url: x.url, tags: x.tags, weight: x.weight ?? 1,
}));

const CATALOG: CTALink[] = [...STATIC_CATALOG, ...ACTIVE_JSON];

const BLOCKED = new Set<string>(["bit.ly","t.co","shorturl.at","tinyurl.com","wa.me"]);

function host(u: string) { try { return new URL(u).host.replace(/^www\./,''); } catch { return ''; } }
function norm(s: string) { return (s||'').toLowerCase().replace(/\s+/g,''); }

const MIN_DIRECT_SCORE = 6;

function detectCategoryV2(query: string): string[] {
  const q = norm(query);
  const categories = new Set<string>();

  if (/(여행|관광|항공|항공권|비행기|숙박|호텔|렌터카|ktx|srt|코레일|철도|기차|여권|비자|입국|출국|해외여행|국내여행)/i.test(q)) categories.add('travel');
  if (/(예약|예매|티켓|공연|영화관|좌석|발권|취소|환불)/i.test(q)) categories.add('booking');
  if (/(쇼핑|구매|가격|최저가|할인|상품|제품|리뷰|후기|비교|배송|쿠폰|공식몰|선물|가전|패션|뷰티)/i.test(q)) categories.add('shopping');
  if (/(정부|공공|민원|증명|발급|신청|접수|등록|지원금|보조금|복지|연금|수당|장려금|바우처|정책)/i.test(q)) categories.add('government');
  if (/(세금|국세|지방세|종소세|종합소득세|부가세|연말정산|홈택스|위택스|환급|신고)/i.test(q)) categories.add('tax');
  if (/(건강|의료|병원|진료|보험료|건강보험|의료보험|요양|검진|약값|질병)/i.test(q)) categories.add('health');
  if (/(고용|취업|구직|채용|실업급여|일자리|이력서|hrd|직업훈련)/i.test(q)) categories.add('jobs');
  if (/(부동산|아파트|청약|주택|전세|월세|매매|실거래|분양|임대)/i.test(q)) categories.add('realestate');
  if (/(교육|학교|대학|입시|강의|수능|학습|자격증|인강|hrd)/i.test(q)) categories.add('education');
  if (/(금융|은행|대출|적금|예금|카드|보험|투자|송금|이체|간편결제)/i.test(q)) categories.add('finance');
  if (/(음식|맛집|배달|레시피|식품|카페|커피|치킨|피자|주문)/i.test(q)) categories.add('food');
  if (/(날씨|기상|예보|태풍|미세먼지|대기질|환경)/i.test(q)) categories.add('weather');

  return [...categories];
}

function hostMatchesCategory(category: string, h: string, url: string): boolean {
  const target = `${h}${url}`.toLowerCase();
  switch (category) {
    case 'travel':
      return /(visitkorea|kto\.visitkorea|letskorail|srail|korail|koreanair|flyasiana|jinair|jejuair|twayair|airbusan|skyscanner|kayak|triple|myrealtrip|yanolja|goodchoice|airbnb|hotelscombined|hotel|flight)/i.test(target);
    case 'booking':
      return /(ticket|interpark|yes24|cgv|megabox|lottecinema|booking\.naver|yanolja|goodchoice|srail|letskorail)/i.test(target);
    case 'shopping':
      return /(coupang|shopping\.naver|smartstore|11st|gmarket|auction|ssg|lotteon|danawa|musinsa|oliveyoung|kurly|wemakeprice|tmon|daiso|emart|homeplus|lottemart)/i.test(target);
    case 'government':
      return h.endsWith('.go.kr') || h.endsWith('.or.kr') || /(gov\.kr|korea\.kr|bokjiro|nps|nhis|mohw|kinfa|work\.go\.kr|ei\.go\.kr|hrd\.go\.kr)/i.test(target);
    case 'tax':
      return /(hometax|wetax|nts\.go\.kr)/i.test(target);
    case 'health':
      return /(nhis|hira|mohw|amc|snuh|samsunghospital|yuhs|longtermcare)/i.test(target);
    case 'jobs':
      return /(work\.go\.kr|ei\.go\.kr|hrd\.go\.kr|saramin|jobkorea|linkedin)/i.test(target);
    case 'realestate':
      return /(molit|rt\.molit|applyhome|r114|zigbang|dabang)/i.test(target);
    case 'education':
      return /(moe\.go\.kr|neis|adiga|ebs|hrd\.go\.kr)/i.test(target);
    case 'finance':
      return /(fss|kbstar|shinhan|wooribank|kebhana|kakaobank|toss|pay\.naver|samsungfire|hi\.co\.kr|idbins)/i.test(target);
    case 'food':
      return /(baemin|coupangeats|yogiyo|map\.kakao|map\.naver|booking\.naver|mcdonalds|kfc|lotteria|starbucks|ediya)/i.test(target);
    case 'weather':
      return /(kma\.go\.kr|me\.go\.kr)/i.test(target);
    default:
      return false;
  }
}

function scoreOfficialCandidate(
  it: CTALink,
  q: string,
  expandedQueries: string[],
  categories: string[],
  input: { intent?: string; preferHosts?: string[] },
): number {
  const h = host(it.url).toLowerCase();
  const prefer = new Set((input.preferHosts ?? []).map(x => x.toLowerCase()));
  let score = 0;
  let hasDirectSignal = false;

  for (const t of it.tags || []) {
    const T = norm(String(t));
    if (!T) continue;

    if (q.includes(T)) { score += 3; hasDirectSignal = true; }
    if (T.length >= 2 && T.includes(q)) { score += 2; hasDirectSignal = true; }
    if (T === q) { score += 5; hasDirectSignal = true; }

    for (const expQ of expandedQueries) {
      const expQNorm = norm(expQ);
      if (expQNorm && expQNorm !== q && expQNorm.includes(T)) {
        score += 2;
        hasDirectSignal = true;
      }
    }
  }

  const itemName = norm(it.name || '');
  if (itemName) {
    if (itemName === q) { score += 10; hasDirectSignal = true; }
    if (q.includes(itemName)) { score += 5; hasDirectSignal = true; }
    if (q.length >= 2 && itemName.includes(q)) { score += 4; hasDirectSignal = true; }

    for (const expQ of expandedQueries) {
      const expQNorm = norm(expQ);
      if (expQNorm && expQNorm !== q && itemName.includes(expQNorm)) {
        score += 3;
        hasDirectSignal = true;
      }
    }
  }

  if (input.intent) {
    const I = norm(input.intent);
    if (I && (q.includes(I) || (it.tags || []).some(t => norm(t) === I))) {
      score += 3;
      hasDirectSignal = true;
    }
  }

  if (prefer.has(h)) {
    score += 10;
    hasDirectSignal = true;
  }

  const categoryMatchCount = categories.filter(c => hostMatchesCategory(c, h, it.url)).length;
  if (categoryMatchCount > 0) {
    score += hasDirectSignal ? categoryMatchCount * 3 : categoryMatchCount * 2;
  }

  if (!hasDirectSignal) return 0;
  score += Math.min(it.weight ?? 1, 3);
  return score;
}

// 유사어/동의어 매핑 (매칭 정확도 향상)
const SYNONYMS: Record<string, string[]> = {
  '예매': ['예약', '티켓', '구매', '발권'],
  '예약': ['예매', '신청', '등록', '접수'],
  '쿠팡': ['coupang', '쿠팡파트너스', 'partners'],
  '배민': ['배달의민족', 'baemin', '배달'],
  '요기요': ['yogiyo', '배달'],
  '무신사': ['musinsa', '패션'],
  '올영': ['올리브영', 'oliveyoung', '뷰티'],
  '컬리': ['마켓컬리', 'kurly', '신선식품'],
  '지마켓': ['gmarket', 'g마켓'],
  '11번가': ['11st', '일일번가'],
  'ssg': ['신세계', 'shinsegae'],
  '롯데': ['lotte', '롯데온', 'lotteon'],
  '토스': ['toss', '간편결제'],
  '카뱅': ['카카오뱅크', 'kakaobank'],
  '야놀자': ['yanolja', '숙박', '호텔'],
  '여기어때': ['goodchoice', '숙박'],
  '직방': ['zigbang', '부동산'],
  '다방': ['dabang', 'dabangapp', '부동산'],
  'hrd': ['hrd-net', '직업훈련', '교육'],
  '워크넷': ['work.go.kr', '취업', '구직'],
};

// 카테고리 자동 판별 (정확도 향상)
function detectCategory(query: string): string[] {
  const q = norm(query);
  const categories: string[] = [];
  
  // 쇼핑 관련
  if (q.match(/쿠팡|배민|요기요|쇼핑|구매|상품|제품|리뷰/)) categories.push('shopping');
  // 예매/예약
  if (q.match(/예매|예약|티켓|영화|공연|호텔|숙박/)) categories.push('booking');
  // 정부/공공
  if (q.match(/정부|공공|민원|신청|등록|발급|접수|지원금|복지/)) categories.push('government');
  // 교육
  if (q.match(/교육|강의|학습|수강|자격증|hrd|워크넷|학원/)) categories.push('education');
  // 금융
  if (q.match(/은행|카드|결제|송금|대출|적금|펀드|투자/)) categories.push('finance');
  // 외식
  if (q.match(/맛집|음식|치킨|피자|버거|커피|카페|배달/)) categories.push('food');
  // 패션/뷰티
  if (q.match(/옷|신발|화장품|뷰티|패션|의류|악세서리/)) categories.push('fashion');
  
  return categories;
}

// 유사어 확장 (매칭률 향상)
function expandWithSynonyms(query: string): string[] {
  const expanded = [query];
  const q = norm(query);
  
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    if (q.includes(norm(key))) {
      expanded.push(...synonyms);
    }
  }
  
  return expanded;
}

export function resolveOfficialLink(input: {
  query: string;                 // 예: "화담숲 예매", "KTX 환불"
  intent?: '예매'|'예약'|'다운로드'|'신청'|'바로가기';
  preferHosts?: string[];        // 예: ["etk.srail.kr","letskorail.com"]
}): { name: string; url: string } | null {
  const q = norm(input.query);
  
  // 유사어 확장으로 매칭률 향상
  const expandedQueries = expandWithSynonyms(input.query);
  const categories = detectCategoryV2(input.query);

  let best: CTALink | null = null;
  let bestScore = 0;

  for (const it of CATALOG) {
    if (!it.url.startsWith('https://')) continue;
    const h = host(it.url).toLowerCase();
    if (BLOCKED.has(h)) continue;

    const score = scoreOfficialCandidate(it, q, expandedQueries, categories, input);

    if (score > bestScore) { best = it; bestScore = score; }
  }
  return best && bestScore >= MIN_DIRECT_SCORE ? { name: best.name, url: best.url } : null;
}

// 여러 개 검색해서 상위 N개 반환 (선택지 제공)
export function resolveMultipleOfficialLinks(input: {
  query: string;
  intent?: '예매'|'예약'|'다운로드'|'신청'|'바로가기';
  preferHosts?: string[];
  limit?: number; // 기본 3개
}): { name: string; url: string; score: number }[] {
  const q = norm(input.query);
  const limit = input.limit ?? 3;
  
  const expandedQueries = expandWithSynonyms(input.query);
  const categories = detectCategoryV2(input.query);

  const scored: { item: CTALink; score: number }[] = [];

  for (const it of CATALOG) {
    if (!it.url.startsWith('https://')) continue;
    const h = host(it.url).toLowerCase();
    if (BLOCKED.has(h)) continue;

    const score = scoreOfficialCandidate(it, q, expandedQueries, categories, input);

    if (score >= MIN_DIRECT_SCORE) {
      scored.push({ item: it, score });
    }
  }

  // 점수 내림차순 정렬
  scored.sort((a, b) => b.score - a.score);

  // 상위 N개 반환
  return scored.slice(0, limit).map(s => ({
    name: s.item.name,
    url: s.item.url,
    score: s.score
  }));
}
