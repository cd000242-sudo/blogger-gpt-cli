/**
 * 🏷️ 키워드 출처 구분 (v3.8.735)
 *
 * 감사: 해시태그는 `generateHashtagsFinal(keyword, h2Titles)` — **키워드와 소제목만 보고 모델이 만든다.**
 * 실제 검색어(구글 자동완성)와는 아무 관계가 없고, 본문에 없는 말도 태그가 된다. 그것이 "연관어가 이상하다"의 한 경로다.
 *
 * 이제 넷을 가른다. 실제 검색어가 아닌 것을 "연관검색어"라 부르지 않는다.
 *   actualSearchKeyword — 검색 API 가 준 자동완성·연관어(사람이 실제로 친 말)
 *   articleKeyword      — 제목·본문에 실제로 나오는 주제어
 *   semanticKeyword     — 모델이 만든 말 중 본문에 없는 것(참고만, 태그로 쓰지 않는다)
 *   hashtag             — 최종 태그 = 본문에 있는 태그 + 본문과 맞는 실제 검색어
 */

import { coreEntityOf, distinctiveTokens } from './evidence';

export interface KeywordProvenance {
  actualSearchKeyword: string[];
  articleKeyword: string[];
  semanticKeyword: string[];
  hashtag: string[];
  dropped: string[];
}

const flat = (s: string) => String(s || '').replace(/\s+/g, '').toLowerCase();

/** 태그가 글에 실제로 있는가 — 띄어쓰기를 무시하고 제목·본문에서 찾는다 */
function inArticle(tag: string, articleFlat: string): boolean {
  const t = flat(tag).replace(/^#/, '');
  if (t.length < 2) return false;
  if (articleFlat.includes(t)) return true;
  // "청년미래적금2차" 같은 합성 태그는 조각(2자 이상 주제어)이 전부 있으면 인정한다
  const parts = distinctiveTokens(tag.replace(/^#/, '')).map(flat).filter((p) => p.length >= 2);
  return parts.length >= 2 && parts.every((p) => articleFlat.includes(p));
}

export function buildKeywordProvenance(input: {
  mainKeyword: string;
  title: string;
  bodyText: string;
  generatedTags: string[];
  actualSuggestions: string[];
  max?: number;
}): KeywordProvenance {
  const max = input.max ?? 15;
  const articleFlat = flat(`${input.title} ${input.bodyText}`);
  // 이 글의 정체 = 핵심어 중 가장 긴(숫자로 시작하지 않는) 말. "2차" 같은 조각으로는 다른 상품의 연관어가 들어온다
  const coreTokens = coreEntityOf(input.mainKeyword, 2).split(/\s+/).filter(Boolean).map(flat);
  const head = [...coreTokens].sort((a, b) => ((/^\d/.test(a) ? 0 : 100) + a.length) - ((/^\d/.test(b) ? 0 : 100) + b.length)).pop();
  const core = head ? [head] : coreTokens;
  const clean = (t: string) => String(t || '').replace(/^#/, '').replace(/[^\w가-힣 ]/g, '').trim();
  const seen = new Set<string>();
  const uniq = (t: string) => { const k = flat(t); if (!k || seen.has(k)) return false; seen.add(k); return true; };

  const generated = [...new Set(input.generatedTags.map(clean).filter((t) => t.length >= 2))];
  const articleKeyword = generated.filter((t) => inArticle(t, articleFlat));
  const semanticKeyword = generated.filter((t) => !inArticle(t, articleFlat));
  // 실제 검색어 중 이 글의 정체(핵심어)를 담은 것만 — 다른 글의 연관어가 섞이지 않게
  const actualSearchKeyword = [...new Set(input.actualSuggestions.map(clean).filter((t) => t.length >= 2))]
    .filter((t) => core.some((c) => flat(t).includes(c)));

  const hashtag = [
    ...articleKeyword.filter(uniq),
    ...actualSearchKeyword.filter((t) => inArticle(t, articleFlat) || flat(t).length <= 14).filter(uniq),
  ].slice(0, max);
  const dropped = [...semanticKeyword, ...actualSearchKeyword.filter((t) => !hashtag.includes(t))];
  return { actualSearchKeyword, articleKeyword, semanticKeyword, hashtag, dropped };
}
