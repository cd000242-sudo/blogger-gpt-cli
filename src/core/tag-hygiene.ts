/**
 * 태그 위생 (v3.8.384)
 *
 * 배경 — 2026-07-28 GSC 실측:
 *   발행 글 318편인데 태그가 2,563개, 그중 2,396개(93%)가 글 0~1개짜리 고아 태그.
 *   구글이 아는 URL 2,188개 중 대부분이 이 태그 아카이브였고,
 *   "발견됨 – 현재 색인이 생성되지 않음" 1,505건의 정체가 이것이다.
 *   태그 아카이브는 noindex 라 크롤해도 버려지는데, 크롤 예산만 먹는다.
 *
 * 근본 원인 (wordpress-api.ts getTags):
 *   기존 태그 재사용 로직은 있었으나 `/tags?per_page=100` 으로 **첫 100개만** 조회했다.
 *   2,563개 중 96%가 조회 범위 밖이라, 이미 있는 태그도 못 찾고 매번 새로 만들었다.
 *
 * 실제로 쌓인 쓰레기 태그 예:
 *   `"CHATGPT`  `"라면 끓이기`  (따옴표가 이름에 포함 — 파싱 잔해)
 *   `2025 —`  `2025년`  `2025년 최신`  `2025년 최신 비법`  (문장이 조각남)
 *   `SRT`  `SRT 추석`  `SRT 추석 예매`  (같은 말이 3개로 분열)
 *
 * 이 모듈은 순수 함수다 — I/O 없고 throw 하지 않는다.
 */

/** 글 하나에 붙일 수 있는 태그 상한. 많을수록 고아 태그가 늘어난다. */
export const MAX_TAGS_PER_POST = 5;

const MIN_LEN = 2;
const MAX_LEN = 20;

/** 태그가 될 수 없는 것들 */
const REJECT_PATTERNS: Array<[string, RegExp]> = [
  ['연도만', /^20\d{2}\s*년?$/],
  ['숫자만', /^[\d\s.,]+$/],
  ['기호만', /^[^\w가-힣]+$/],
  ['조각 접미', /^(최신|비법|방법|정리|총정리|가이드|안내|추천)$/],
  ['불용어', /^(그리고|하지만|이번|오늘|최근|관련|대한|대해|이런|저런|어떤|위한|통해|경우)$/],
];

/**
 * 태그 이름 하나를 정규화한다. 태그로 쓸 수 없으면 null.
 * 따옴표·대시·괄호가 가장자리에 붙은 파싱 잔해를 걷어낸다.
 */
export function normalizeTagName(raw: unknown): string | null {
  let s = String(raw ?? '')
    .replace(/[​-‍﻿]/g, '')      // 제로폭 문자
    .replace(/[""''"'`]/g, '')                   // 따옴표 (— "CHATGPT 사고)
    .replace(/[[\]()<>{}]/g, ' ')                // 괄호
    .replace(/[—–\-·•|/\\]+$/g, '')              // 끝에 남은 구분자 (— "2025 —" 사고)
    .replace(/^[—–\-·•|/\\]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (s.length < MIN_LEN || s.length > MAX_LEN) return null;
  for (const [, re] of REJECT_PATTERNS) if (re.test(s)) return null;
  // 한글/영문/숫자가 하나도 없으면 버린다
  if (!/[가-힣a-zA-Z0-9]/.test(s)) return null;
  return s;
}

/** 비교용 키 — 대소문자·공백 차이를 흡수한다 */
export function tagKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

/**
 * 태그 목록을 정리한다.
 *  1) 정규화 + 불량 제거
 *  2) 중복 제거 (대소문자·공백 무시)
 *  3) 포함관계 축약 — "SRT" / "SRT 추석" / "SRT 추석 예매" 가 함께 오면
 *     더 짧고 일반적인 "SRT" 만 남긴다. 짧은 태그가 다른 글에서 재사용되어
 *     고아 태그를 만들지 않기 때문이다.
 *  4) 상한 적용
 */
export function sanitizeTagNames(raw: unknown[], max: number = MAX_TAGS_PER_POST): string[] {
  const normalized: string[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const n = normalizeTagName(r);
    if (n) normalized.push(n);
  }

  // 중복 제거 (먼저 온 것 우선)
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const n of normalized) {
    const k = tagKey(n);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(n);
  }

  // 포함관계 축약: 짧은 것이 긴 것의 부분 문자열이면 긴 것을 버린다
  const byLen = [...unique].sort((a, b) => a.length - b.length);
  const kept: string[] = [];
  for (const cand of byLen) {
    const ck = tagKey(cand);
    if (kept.some(k => ck.includes(tagKey(k)))) continue;
    kept.push(cand);
  }

  // 원래 순서 유지 후 상한
  return unique.filter(u => kept.includes(u)).slice(0, Math.max(0, max));
}

/**
 * 후보 이름에 대응하는 기존 태그를 찾는다.
 * WordPress `/tags?search=` 는 부분 일치라, 정확 일치를 여기서 다시 가린다.
 */
export function matchExistingTag<T extends { id: number; name: string }>(
  name: string,
  candidates: T[]
): T | null {
  const k = tagKey(name);
  return (Array.isArray(candidates) ? candidates : []).find(t => tagKey(String(t.name || '')) === k) || null;
}
