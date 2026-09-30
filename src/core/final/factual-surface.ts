/**
 * 🧾 v3.8.771 — 최종 사실 표면(FINAL FACTUAL SURFACE): 제목 + 사실을 말하는 소제목. 호출 0회·결정론.
 *
 * 실측(BATCH 2 IT run a4fc1b): 2절 소제목 "4000mAh 45W 충전 성능" 이 제목과 같은 블로그 값을 담았다. 770 은 제목만 최종 권위로 검사했고,
 * 소제목은 근거에서 빼기만 해서 틀린 소제목이 그대로 남았다. 독자가 보는 사실 표면은 제목 · 답 상자 · 소제목 · 본문 · 표 · FAQ 전부다.
 *
 * 규칙:
 *   · 소제목(h2·h3)도 제목과 **같은 검사**(title-authority 의 수치·가능/불가 · 대상·속성 묶기)로 최종 권위(소제목·목차를 뺀 본문 + 채택 팩트체크)와 대조한다.
 *   · 정보가 없는 소제목("어떤 차이가 있을까" · "사용 전에 알아둘 점")은 주장이 없어 검사 대상이 아니다 — 추출기가 값·극성을 못 찾으면 그만이다.
 *   · 새 소제목을 짓지 않는다. 모순이면 HEADING_CONTRADICTED 로 기록하고 발행 판단에서 보류한다.
 *   · 제목과 소제목이 같은 틀린 값을 가지면 둘 다 기록하되, 보류 사유는 값 하나에 위치를 모아 한 번만 쓴다(FINAL_FACTUAL_SURFACE_PASS 하나).
 */
import { authorityClaims, authoritySentences, type TitleAuthorityClaim, type TitleAuthorityResult } from './title-authority';

export interface HeadingAuthorityResult { heading: string; level: 'h2' | 'h3'; pass: boolean; claims: TitleAuthorityClaim[] }
export interface SurfaceBlocker { claim: string; locations: string[]; reason: string }
export interface SurfaceGate { pass: boolean; reason: string; blockers: SurfaceBlocker[] }

const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
/** 소제목의 번호 머리("2." · "1-1.")와 장식 기호는 주장이 아니다 */
const stripLabel = (s: string) => plain(s).replace(/^[^\p{L}\p{N}]+/u, '').replace(/^\d+(?:-\d+)*\.\s*/, '').trim();

/** 최종 HTML 의 소제목들 — 사실 주장이 있는 것만 결과에 남는다 */
export function checkHeadingAuthority(finalDocument: string, factcheck: ReadonlyArray<string> = []): HeadingAuthorityResult[] {
  const html = String(finalDocument || '').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ');
  const authority = authoritySentences(html, factcheck);
  const out: HeadingAuthorityResult[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const heading = stripLabel(m[2] || '');
    if (!heading || seen.has(heading)) continue;
    seen.add(heading);
    const claims = authorityClaims(heading, authority);
    if (claims.length) out.push({ heading, level: m[1]!.toLowerCase() as 'h2' | 'h3', pass: !claims.some((c) => c.verdict === 'CONTRADICTED'), claims });
  }
  return out;
}

/** 제목 + 소제목 모순을 하나의 보류로 — 같은 값은 위치를 모아 한 번만 */
export function factualSurfaceGate(title: TitleAuthorityResult | null, headings: ReadonlyArray<HeadingAuthorityResult>): SurfaceGate {
  const byClaim = new Map<string, SurfaceBlocker>();
  const add = (claim: TitleAuthorityClaim, location: string) => {
    const key = claim.claim.replace(/\s+/g, '').replace(/,/g, '');
    const b = byClaim.get(key) || { claim: claim.claim, locations: [], reason: claim.reason };
    if (!b.locations.includes(location)) b.locations.push(location);
    byClaim.set(key, b);
  };
  for (const c of title?.claims || []) if (c.verdict === 'CONTRADICTED') add(c, '제목');
  for (const h of headings) for (const c of h.claims) if (c.verdict === 'CONTRADICTED') add(c, `소제목 "${h.heading}"`);
  const blockers = [...byClaim.values()];
  return { pass: blockers.length === 0, reason: blockers.map((b) => `${b.claim}(${b.locations.join('·')})`).join(' · '), blockers };
}
