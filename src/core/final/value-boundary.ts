/**
 * 🔤 v3.8.770 — 값 토큰의 낱말 경계. 숫자와 단위는 원문에서 **하나의 값 표현**으로 이어져 있을 때만 값이다.
 *
 * 실측(BATCH 2 행정 run 48417f): "정부24 일반용" → "24일" · "정부24 대상" → "24대" · 목차 "6 위임장" → "6위".
 * 사실 필터가 가짜 "24일" 로 정상 문장 1개를 지웠고, 본문 관문이 가짜 "24대"·"6위" 로 MANUAL_REVIEW 를 냈다.
 * 767 은 HTML·표 경계(20:30 | 주차)를 막았다. 여기서는 같은 원칙을 글자 경계까지 넓힌다:
 *   ① 앞 낱말에 붙은 숫자(정부24 · S26 · EV3)는 이름의 일부다 — 값의 시작이 아니다. 단 월·연·약·총·최대 같은 수식어에 붙은 숫자(월50만원)는 값이다.
 *   ② 숫자와 한 글자 단위 사이가 띄어져 있고, 그 단위 뒤에 한글이 이어지면(대상·위임장·일반용·주차) 단위가 아니라 다음 낱말의 첫 음절이다.
 *      뒤가 조사(가·를·에·까지 …)면 단위다("차량 24 대가"). 붙여 쓴 값(24대·6위·30주)은 뒤에 무엇이 오든 값이다.
 * 새 파서를 만들지 않는다 — 정규식 매치 하나를 원문 자리로 검사하는 필터다.
 */

/** 숫자 바로 앞에 붙어 있어도 값의 수식어인 낱말(월50만원 · 연3% · 약30분 · 총2회) */
const GLUED_MODIFIER = /(?:월|연|년|약|총|최대|최소|최고|최저|하루|매월|매년|매일|각|주|일|회|당|만|평균)$/;
/** 단위 뒤에 붙어도 단위를 깨지 않는 조사·접미 */
const PARTICLE = /^(?:이|가|을|를|은|는|의|에|에서|에게|로|으로|와|과|도|만|까지|부터|씩|째|간|이며|이고|이나|인|이다|입니다|이면|이라|라|쯤|께|정도|여|이상|이하|미만|초과|내|안|밖|뒤|전|후|동안)/;
/** 한 글자 단위(다음 낱말의 첫 음절과 헷갈리는 것) */
const SINGLE_SYLLABLE_UNIT = /^(?:일|주|대|위|명|건|개|세|회|곳|석|편|배|분|초|년|원|좌|점|번|차|장|권|병|잔|벌|켤레)$/;

/**
 * match(숫자+단위 문자열)가 text 의 index 자리에서 실제 값 표현인가.
 * @param match 정규식이 잡은 값 문자열(예: "24 일", "6위", "30 주")
 */
export function isLexicalValue(text: string, index: number, match: string): boolean {
  const src = String(text || '');
  const before = src.slice(Math.max(0, index - 6), index);
  // ① 앞 낱말에 붙은 숫자 — 글자(한글·영문)가 바로 앞이면 이름의 일부(정부24 · S26). 수식어면 값
  if (/[가-힣A-Za-z]$/.test(before) && !GLUED_MODIFIER.test(before.replace(/[^가-힣A-Za-z]+/g, ' ').trim())) return false;
  // ② 띄어 쓴 한 글자 단위 + 뒤에 한글이 이어짐(조사 아님) → 다음 낱말의 첫 음절
  const m = String(match).match(/^[\d.,]+(\s+)([가-힣]+)$/);
  if (m && m[1] && SINGLE_SYLLABLE_UNIT.test(m[2]!)) {
    const after = src.slice(index + match.length);
    if (/^[가-힣]/.test(after) && !PARTICLE.test(after)) return false;
  }
  return true;
}

/** 정규식의 모든 매치 중 실제 값만 — 매치 문자열과 위치를 돌려준다 */
export function lexicalMatches(text: string, pattern: RegExp): Array<{ value: string; index: number }> {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const out: Array<{ value: string; index: number }> = [];
  for (const m of String(text || '').matchAll(re)) {
    if (isLexicalValue(text, m.index || 0, m[0])) out.push({ value: m[0], index: m.index || 0 });
  }
  return out;
}
