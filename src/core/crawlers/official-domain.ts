/**
 * 🏛️ 공공·공익 도메인 판별 (v3.8.476)
 *
 * 의존성이 하나도 없는 파일로 따로 둔다 — content-crawler 는 p-limit(ESM) 을
 * 끌고 오기 때문에, 여기 있는 함수 하나를 쓰려고 그 모듈을 import 하면
 * 테스트가 통째로 못 뜬다(실측: "Cannot use import statement outside a module").
 *
 * 기준: 정부(go.kr) · 공공기관/협회(or.kr) · 연구기관(re.kr).
 * 실측 2026-08-11 네이버 웹문서 —
 *   "청년 월세 지원" 10/10 · "기초연금 수급자격" 8/10 · "전기차 보조금" 7/10 ·
 *   "치아교정 비용" 0/10(정부 주제가 아니면 안 잡힌다 — 의도한 동작)
 */
export function isOfficialDomain(url: string): boolean {
  const host = (String(url || '').match(/^https?:\/\/([^/?#]+)/i) || [])[1] || '';
  return /\.(go|or|re)\.kr$/i.test(host.replace(/:\d+$/, ''));
}
