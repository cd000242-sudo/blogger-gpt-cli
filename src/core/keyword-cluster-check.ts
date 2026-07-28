// src/core/keyword-cluster-check.ts
// 🔎 클러스터 키워드 분화 검사 (v3.8.383) — **생성 전 경고, 차단하지 않음**
//
// 실측 배경 (2026-07-28, leadernam.com 발행글 분석):
//   같은 날 클러스터로 발행한 17편 중 두 클러스터는 정상 분화됐고 하나만 중복이 됐다.
//     티빙 (조회/보상/탈퇴/공식정보) 4편        → 본문 유사도 0.15~0.18  ✅
//     청년미래적금 (가입조건/신청방법/은행…) 8편  → 본문 유사도 0.12~0.21  ✅
//     청년내일저축계좌 (목돈마법/목돈마련완벽/비법/비밀) → 유사도 0.40~0.47 ❌
//   → 구글이 "중복 페이지, 사용자와 다른 표준 선택"으로 색인 탈락시킴.
//
// 원인: generation.ts의 detectKeywordScope는 키워드 끝 한정자(신청방법/조건/혜택…)로 본문을 좁힌다.
//   하위 키워드가 실제로 다른 측면이면 갈리지만, 수식어(완벽/비법/총정리/마법)만 다르면
//   좁힐 대상이 없어 같은 글이 생성된다. 앱은 정상 동작했고 입력이 문제였다.
//
// 그래서 이 검사는 **토큰을 쓰기 전에** 그 조합을 잡는다.

export interface KeywordGroup {
  /** 공통 주제 (그룹의 기준) */
  base: string;
  keywords: string[];
  /** 하위 키워드가 서로 다른 측면인가 */
  distinct: boolean;
  reason: string;
}

export interface KeywordClusterReport {
  ok: boolean;
  groups: KeywordGroup[];
  warnings: string[];
}

/**
 * 의미를 좁히지 못하는 수식어 — 이것만 다르면 같은 글이 나온다.
 * (반대로 '조회/보상/탈퇴/가입조건/신청방법/은행/이자' 같은 말은 실제 측면이라 남긴다)
 */
const FILLER_WORDS = [
  '완벽', '가이드', '총정리', '정리', '핵심', '비법', '비밀', '마법', '꿀팁', '노하우',
  '전략', '최신', '한눈에', '알아보기', '살펴보기', '파헤치기', '끝내기', '완전정복', '완전',
  '실전', '기본', '입문', '심화', '상세', '자세히', '쉽게', '간단', '빠르게', '한번에',
  '모음', '리스트', '베스트', '추천드림', '보기', '확인', '안내', '소개', '개요',
  '년', '최고', '필독', '주목', '총망라', '올인원', '결정판', '요약',
];

const normalize = (s: unknown): string =>
  String(s ?? '').toLowerCase().replace(/[.,!?~·・\-_/\\()[\]{}'"“”‘’|:;]/g, ' ').replace(/\s+/g, ' ').trim();

const tokenize = (s: unknown): string[] =>
  normalize(s).split(' ').filter(Boolean);

/** 숫자(연도 등)와 수식어를 제거해 '실제 측면'만 남긴다 */
function meaningfulTokens(tokens: string[]): string[] {
  return tokens.filter(t => {
    if (/^\d+$/.test(t)) return false;                     // 2026 같은 연도
    if (FILLER_WORDS.some(f => t === f)) return false;      // 정확히 수식어
    if (FILLER_WORDS.some(f => t.length > f.length && t.endsWith(f) && t.length - f.length <= 2)) return false; // 가이드류 접미
    return true;
  });
}

/** 두 토큰 배열의 공통 접두 길이 */
function commonPrefixLen(a: string[], b: string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * 키워드 묶음이 서로 다른 글을 만들 수 있는지 검사한다.
 * **절대 throw하지 않으며, 결과는 경고일 뿐 차단 지시가 아니다.**
 */
export function analyzeKeywordCluster(keywords: unknown): KeywordClusterReport {
  const empty: KeywordClusterReport = { ok: true, groups: [], warnings: [] };
  try {
    const list = (Array.isArray(keywords) ? keywords : [])
      .map(k => String(k ?? '').trim())
      .filter(k => k.length > 0);
    if (list.length < 2) return empty;

    // 공통 주제(base)로 묶는다 — 첫 토큰이 겹치면 같은 주제 후보
    const items = list.map(k => ({ raw: k, tokens: tokenize(k) }));
    const used = new Set<number>();
    const groups: KeywordGroup[] = [];

    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;
      const group = [i];
      for (let j = i + 1; j < items.length; j++) {
        if (used.has(j)) continue;
        const cp = commonPrefixLen(items[i]!.tokens, items[j]!.tokens);
        // 공통 접두가 1토큰 이상이고, 짧은 쪽의 절반 이상을 차지하면 같은 주제로 본다
        const minLen = Math.min(items[i]!.tokens.length, items[j]!.tokens.length);
        if (cp >= 1 && cp >= Math.ceil(minLen / 2)) { group.push(j); used.add(j); }
      }
      if (group.length < 2) continue;
      group.forEach(g => used.add(g));

      const members = group.map(g => items[g]!);
      // 그룹 공통 접두 = base
      let baseLen = members[0]!.tokens.length;
      for (const m of members) baseLen = Math.min(baseLen, commonPrefixLen(members[0]!.tokens, m.tokens));
      const base = members[0]!.tokens.slice(0, baseLen).join(' ');

      // 각 키워드의 '차별자' = base 제거 후 수식어·숫자 제거
      const diffs = members.map(m => meaningfulTokens(m.tokens.slice(baseLen)).join(' '));

      // 차별자가 비었거나 서로 중복되면 같은 글이 나온다
      const nonEmpty = diffs.filter(d => d.length > 0);
      const uniq = new Set(diffs);
      const emptyCount = diffs.length - nonEmpty.length;
      const distinct = uniq.size === diffs.length && emptyCount === 0;

      let reason: string;
      if (distinct) {
        reason = `하위 측면이 서로 다름 (${diffs.join(' / ')})`;
      } else if (emptyCount > 0) {
        reason = `수식어만 달라 좁힐 측면이 없음 (차별자: ${diffs.map(d => d || '(없음)').join(' / ')})`;
      } else {
        reason = `차별자가 중복됨 (${diffs.join(' / ')})`;
      }

      groups.push({ base, keywords: members.map(m => m.raw), distinct, reason });
    }

    const risky = groups.filter(g => !g.distinct);
    const warnings = risky.map(g =>
      `"${g.base}" 관련 ${g.keywords.length}개가 사실상 같은 글이 됩니다 — ${g.reason}. `
      + `'신청방법 / 조건 / 혜택 / 지원금 / 후기' 처럼 서로 다른 측면을 나타내는 한정자를 키워드 끝에 붙여주세요.`
    );

    return { ok: risky.length === 0, groups, warnings };
  } catch {
    // 검사 실패가 발행을 막으면 안 된다
    return empty;
  }
}
