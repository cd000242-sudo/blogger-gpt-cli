/**
 * 앞 문장을 가리키는 말머리 (v3.8.666 — 되풀이 삭제와 근거 없는 문장 삭제가 같은 눈으로 본다).
 *
 * 실측: 앞 문장을 지웠더니 "이 안내에서 읽을 점은…"(v3.8.664), "다만 이 수치는…", "두 내용은…"(v3.8.665) 이
 * 허공을 가리킨 채 남았다. 문장을 지우는 곳이 둘(auto-repair·fact-integrity)이라 규칙을 한 벌로 둔다.
 */
export const REFERS_BACK = /^(?:다만\s*|또한\s*|그리고\s*|따라서\s*)?(?:이|그|위|해당|같은|두|세|이런|그런)\s*(?:안내|자료|기준|내용|구분|문구|조건|수치|숫자|표|목록|절차|방식|판단|사례|보도|발표|지침|규정|문서|사실|점|경우|말|설명|결과|기록|보도자료|항목|금액|비율|기간|날짜|일정)/;

export function startsWithBackReference(sentence: string): boolean {
  return REFERS_BACK.test(String(sentence || '').trim());
}
