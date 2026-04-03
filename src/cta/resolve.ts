
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
  const prefer = new Set((input.preferHosts ?? []).map(h => h.toLowerCase()));
  
  // 유사어 확장으로 매칭률 향상
  const expandedQueries = expandWithSynonyms(input.query);
  const categories = detectCategory(input.query);

  let best: CTALink | null = null;
  let bestScore = -1;

  for (const it of CATALOG) {
    if (!it.url.startsWith('https://')) continue;
    const h = host(it.url).toLowerCase();
    if (BLOCKED.has(h)) continue;

    let score = 0;

    // 1) 태그 매칭 강화 (유사어 포함)
    for (const t of it.tags || []) {
      const T = norm(String(t));
      if (!T) continue;
      
      // 원본 쿼리 매칭
      if (q.includes(T)) score += 3;
      
      // 확장 쿼리 매칭 (유사어)
      for (const expQ of expandedQueries) {
        if (norm(expQ).includes(T)) score += 2;
      }
      
      // 정확히 일치
      if (T === q) score += 5;
    }

    // 2) 이름 매칭 강화
    const itemName = norm(it.name || '');
    if (itemName) {
      // 정확히 일치
      if (itemName === q) score += 10;
      // 부분 일치
      if (q.includes(itemName)) score += 5;
      if (itemName.includes(q)) score += 4;
      // 확장 쿼리 매칭
      for (const expQ of expandedQueries) {
        const expQNorm = norm(expQ);
        if (itemName.includes(expQNorm)) score += 3;
      }
    }

    // 3) 의도 단어 가산
    if (input.intent) {
      const I = norm(input.intent);
      if (I && (q.includes(I) || (it.tags||[]).some(t => norm(t) === I))) score += 3;
    }

    // 4) 카테고리 우선순위 (정부/공공 최우선)
    if (h.includes('.go.kr') || h.includes('.or.kr')) score += 8;
    if (categories.includes('government') && (h.includes('.go.kr') || h.includes('.or.kr'))) score += 5;
    if (categories.includes('shopping') && (h.includes('coupang') || h.includes('gmarket') || h.includes('11st'))) score += 4;
    if (categories.includes('booking') && (h.includes('yanolja') || h.includes('yes24') || h.includes('cgv'))) score += 4;

    // 5) 호스트 선호
    if (prefer.has(h)) score += 10;

    // 6) 가중치
    score += (it.weight ?? 1);

    if (score > bestScore) { best = it; bestScore = score; }
  }
  return best ? { name: best.name, url: best.url } : null;
}

// 여러 개 검색해서 상위 N개 반환 (선택지 제공)
export function resolveMultipleOfficialLinks(input: {
  query: string;
  intent?: '예매'|'예약'|'다운로드'|'신청'|'바로가기';
  preferHosts?: string[];
  limit?: number; // 기본 3개
}): { name: string; url: string; score: number }[] {
  const q = norm(input.query);
  const prefer = new Set((input.preferHosts ?? []).map(h => h.toLowerCase()));
  const limit = input.limit ?? 3;
  
  const expandedQueries = expandWithSynonyms(input.query);
  const categories = detectCategory(input.query);

  const scored: { item: CTALink; score: number }[] = [];

  for (const it of CATALOG) {
    if (!it.url.startsWith('https://')) continue;
    const h = host(it.url).toLowerCase();
    if (BLOCKED.has(h)) continue;

    let score = 0;

    // 태그 매칭
    for (const t of it.tags || []) {
      const T = norm(String(t));
      if (!T) continue;
      if (q.includes(T)) score += 3;
      for (const expQ of expandedQueries) {
        if (norm(expQ).includes(T)) score += 2;
      }
      if (T === q) score += 5;
    }

    // 이름 매칭
    const itemName = norm(it.name || '');
    if (itemName) {
      if (itemName === q) score += 10;
      if (q.includes(itemName)) score += 5;
      if (itemName.includes(q)) score += 4;
      for (const expQ of expandedQueries) {
        const expQNorm = norm(expQ);
        if (itemName.includes(expQNorm)) score += 3;
      }
    }

    // 의도 단어
    if (input.intent) {
      const I = norm(input.intent);
      if (I && (q.includes(I) || (it.tags||[]).some(t => norm(t) === I))) score += 3;
    }

    // 카테고리 우선순위
    if (h.includes('.go.kr') || h.includes('.or.kr')) score += 8;
    if (categories.includes('government') && (h.includes('.go.kr') || h.includes('.or.kr'))) score += 5;
    if (categories.includes('shopping') && (h.includes('coupang') || h.includes('gmarket') || h.includes('11st'))) score += 4;

    // 호스트 선호
    if (prefer.has(h)) score += 10;

    // 가중치
    score += (it.weight ?? 1);

    if (score > 0) {
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
