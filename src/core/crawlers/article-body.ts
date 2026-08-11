/**
 * 📰 뉴스 기사 본문 추출기 (v3.8.475)
 *
 * ## 왜 만들었나
 * `crawlFromNaverNews` 는 이미 돌고 있는데, 검색 API 가 준 `originallink`
 * (실제 언론사 기사 주소)를 **버리고** description 150자만 재료로 썼다.
 * 그 주소를 따라가면 본문이 통째로 나온다 —
 *   실측 2026-08-11: 연합뉴스 4,152자 · 한국경제 26,442자
 * 즉 추가 API 키 0개로 재료를 수십 배 늘릴 수 있는데 안 쓰고 있었다.
 *
 * 구글 뉴스 RSS 로는 이게 안 된다(item 링크가 JS 스텁이라 평문 11자).
 * 네이버 검색 API 만이 실제 기사 주소를 준다.
 *
 * ## 왜 기존 추출기를 못 쓰나
 * content-crawler 의 비네이버 분기는 `([\s\S]*?)</div>` 비탐욕 매칭이라
 * 본문 div 안 첫 중첩에서 끊긴다. v3.8.473 에서 네이버 분기만 고쳤으므로
 * 뉴스는 여전히 잘린다. 같은 균형 매칭을 여기서 쓴다.
 */

import { extractBalancedBlock, toPlainText } from './naver-post-body';

/** 기사 한 편에서 가져올 최대 글자수 — 블로그와 같은 예산 기준 */
export const DEFAULT_MAX_ARTICLE_CHARS = 1200;

/** 이 정도는 나와야 본문으로 본다 (기자 소개·관련기사 목록과 구분) */
const MIN_ACCEPTABLE_CHARS = 200;

/**
 * 본문 컨테이너 — 먼저 오는 것이 우선.
 * 국내 언론사와 네이버 뉴스에서 실제로 쓰이는 것들만 넣는다.
 */
const ARTICLE_CONTAINERS: Array<{ pattern: RegExp; tag: string }> = [
  // 네이버 뉴스 (현행 / 구형)
  { pattern: /<(?:div|article)[^>]*id=["']dic_area["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*id=["']articleBodyContents["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*id=["']newsct_article["'][^>]*>/i, tag: 'div' },
  // 표준 시맨틱 태그
  { pattern: /<article\b[^>]*>/i, tag: 'article' },
  // 언론사 공통 클래스
  { pattern: /<div[^>]*class=["'][^"']*\barticle-body\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\barticle_body\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\barticleBody\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\barticle-view\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\bnews-article\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\bstory-news\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*itemprop=["']articleBody["'][^>]*>/i, tag: 'div' },
];

/**
 * 기사 본문에 섞이면 안 되는 꼬리들.
 * 이걸 안 지우면 "무단전재 금지", "기자 이메일" 이 팩트인 척 프롬프트에 들어간다.
 */
const TAIL_NOISE = [
  /무단\s*전재[\s\S]*$/,
  /저작권자\s*[ⓒ©][\s\S]*$/,
  /Copyright\s*[ⓒ©][\s\S]*$/i,
  /관련\s*기사[\s\S]{0,400}$/,
  /[\w.+-]+@[\w-]+\.[\w.]+[\s\S]{0,200}$/,
];

/**
 * 본문 안에 섞여 들어오는 UI 조각. 문장이 아니라 버튼·캡션 라벨이다.
 * 실측: 연합뉴스 "김채린 기자 구독 구독중 이전 다음 이미지 확대", 매일경제 "사진 확대".
 * 토막만 걷어낸다 — 자르지 않는다(뒤에 진짜 본문이 이어진다).
 */
const UI_FRAGMENTS = /구독\s*구독중|구독중|이미지\s*확대|사진\s*확대|영상\s*확대|이전\s+다음|기사\s*크게|기사\s*작게|글자\s*크기/g;

function stripUiFragments(text: string): string {
  return String(text || '').replace(UI_FRAGMENTS, ' ').replace(/\s{2,}/g, ' ').trim();
}

function trimTailNoise(text: string): string {
  let out = String(text || '');
  for (const pattern of TAIL_NOISE) {
    const cut = out.replace(pattern, '').trim();
    // 꼬리를 지웠는데 본문이 반토막 나면 잘못 잡은 것이다 — 되돌린다
    if (cut.length >= out.length * 0.5) out = cut;
  }
  return out.trim();
}

/**
 * 페이지 껍데기(내비게이션·추천 목록)에만 나오는 말.
 * 실측 2026-08-11 한국경제 기사 —
 *   article-body   1,836자 · 잡음 0   ← 본문
 *   <article>      3,406자 · 잡음 8   ← 껍데기
 * **길이로 고르면 껍데기를 집는다.** 잡음 개수가 훨씬 확실한 신호다.
 */
const SHELL_NOISE = /구독하기|로그인|추천\s?뉴스|팝업|닫기|전체보기|바로가기|공유하기|사진\s?확대|글자크기|기사입력|많이\s?본\s?뉴스/g;

/**
 * 문장 종결 밀도 — 100자당 몇 번 문장이 끝나는가.
 * 실측: 본문 1.09~2.3 · 제목 나열 목록은 0에 가깝다.
 */
const MIN_SENTENCE_DENSITY = 0.5;

function sentenceDensity(text: string): number {
  const endings = (text.match(/(?:다|요|죠|까|음|함)[.!?]/g) || []).length;
  return endings / Math.max(1, text.length / 100);
}

export interface ArticleBody {
  /** 평문 본문 (maxChars 로 자른 뒤) */
  text: string;
  /** 자르기 전 원래 길이 */
  rawLength: number;
}

/**
 * 뉴스 기사 HTML 에서 본문을 뽑는다.
 *
 * 첫 매치를 쓰지 않고 **후보를 전부 모아 점수로 고른다** — 잡음이 가장 적은 것,
 * 동률이면 가장 긴 것. 언론사마다 본문 컨테이너가 제각각이고, `<article>` 이
 * 페이지 전체를 감싸는 곳도 있어서 우선순위만으로는 못 고른다.
 *
 * 쓸 만한 분량이 안 나오면 null — 호출부는 검색 API description 으로 폴백한다.
 */
export function extractArticleBody(
  html: string,
  maxChars: number = DEFAULT_MAX_ARTICLE_CHARS,
): ArticleBody | null {
  const source = String(html || '');
  if (source.length < 100) return null;

  const candidates: Array<{ text: string; noise: number }> = [];

  for (const { pattern, tag } of ARTICLE_CONTAINERS) {
    const inner = extractBalancedBlock(source, pattern, tag);
    if (!inner) continue;

    const text = stripUiFragments(trimTailNoise(toPlainText(inner)));
    if (text.length < MIN_ACCEPTABLE_CHARS) continue;
    if (sentenceDensity(text) < MIN_SENTENCE_DENSITY) continue;   // 제목 나열 목록 배제

    candidates.push({ text, noise: (text.match(SHELL_NOISE) || []).length });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (a.noise - b.noise) || (b.text.length - a.text.length));
  const best = candidates[0]!;
  return { text: best.text.slice(0, Math.max(1, maxChars)), rawLength: best.text.length };
}
