/**
 * ⚖️ 주장과 확정 사실을 가르는 검사 (v3.8.629)
 *
 * ## 왜 만들었나
 * 사장님이 사건·분쟁을 다루는 글에서 지켜야 할 것을 열 가지로 정리해 주었다.
 * 핵심은 하나다 — **수사·판결 전 사건을 확정된 것처럼 쓰면 안 된다.**
 * 이건 글 품질 문제가 아니라 **법적 위험**이다. 확정형으로 쓴 문장 하나가
 * 명예훼손이 된다.
 *
 * ## 이 파일이 보는 것
 *   ① 확정형 범죄 표현      "횡령했다" → "횡령 혐의를 주장했다"
 *   ② 출처 없는 해석        "~로 보인다", "~라는 분석이다"
 *   ③ 작성자 개인 의견      "제 기준으로는", "아무튼"
 *   ④ 법률 용어 확대        "사기죄가 적용됐다" → "사기죄를 거론했다"
 *   ⑤ 합의로 확대 해석      사과 요구를 "합의 가능성" 으로
 *   ⑥ 근거 없는 시간 표현    "최초 폭로" — 과거 기록을 확인했는가
 *   ⑦ 금액 성격 뒤섞임      전체 피해 주장액과 증거 속 금액을 같은 것처럼
 *   ⑧ 같은 사실 되풀이      "법적 판단 전" 을 문단마다
 *   ⑨ 결론이 본문 재탕      마지막 문단이 앞을 통째로 다시 말함
 *
 * ## 원칙
 * AI 를 부르지 않는다. 다만 ⑥⑦ 처럼 **사람이 확인해야 판정되는 것**은
 * "확인하라" 고만 말한다 — 검사기가 단정하면 멀쩡한 문장을 지우게 된다.
 */

import type { AuditIssue } from './article-audit';

/** 문장 하나를 잘라 증거로 보여줄 때의 길이 */
const EVIDENCE_CHARS = 70;

function around(text: string, at: number): string {
  return text.slice(Math.max(0, at - 24), at + EVIDENCE_CHARS).replace(/\n/g, ' ').trim();
}

function collect(text: string, re: RegExp, build: (hit: string, at: number) => AuditIssue): AuditIssue[] {
  const out: AuditIssue[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    const hit = m[0];
    if (seen.has(hit)) continue;   // 같은 표현은 한 번만 지적한다 — 목록이 길면 안 읽는다
    seen.add(hit);
    out.push(build(hit, m.index ?? 0));
  }
  return out;
}

/* ① 확정형 범죄 표현 — 판결 전에 단정하면 명예훼손이 된다 */
const CRIME_ASSERTED = /(횡령|사기|배임|절도|폭행|성추행|성폭행|사기|공갈|협박)(?:을|를)?\s*(?:했|저질렀|범했|한 것으로 드러났)/g;
const HARM_ASSERTED = /피해를\s*(?:입혔|줬|주었|끼쳤)|범죄를\s*저질렀|돈을\s*가로챘/g;

export function findAssertedCrimes(text: string): AuditIssue[] {
  return [
    ...collect(text, CRIME_ASSERTED, (hit, at) => ({
      kind: 'asserted-crime' as const,
      title: `확정형 범죄 표현: "${hit}"`,
      evidence: around(text, at),
      penalty: 15,
    })),
    ...collect(text, HARM_ASSERTED, (hit, at) => ({
      kind: 'asserted-crime' as const,
      title: `확정형 피해 표현: "${hit}"`,
      evidence: around(text, at),
      penalty: 15,
    })),
  ];
}

/* ② 출처 없는 해석 — 누가 그렇게 말했는지가 없으면 글쓴이 추측이다 */
const UNSOURCED_READING = /(?:라는|다는)\s*(?:해석|분석|관측)(?:도)?\s*(?:나온다|있다|이다)|(?:으로|로)\s*(?:보인다|풀이된다|관측된다|분석된다)|(?:라는|다는)\s*분석이다/g;
/** 이 말들이 가까이 있으면 출처를 댄 것으로 본다 */
const SOURCE_NEARBY = /따르면|밝혔|말했|전했|발표|보도|인터뷰|답변|공시|자료에|설명했/;

export function findUnsourcedReadings(text: string): AuditIssue[] {
  const out: AuditIssue[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(UNSOURCED_READING)) {
    const at = m.index ?? 0;
    const 주변 = text.slice(Math.max(0, at - 120), at + 60);
    if (SOURCE_NEARBY.test(주변)) continue;   // 출처를 댔으면 정상이다
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    out.push({
      kind: 'unsourced-reading',
      title: `출처 없는 해석: "${m[0]}"`,
      evidence: around(text, at),
      penalty: 8,
    });
  }
  return out;
}

/* ③ 작성자 개인 의견 — 정보성 글의 문체를 흐린다 */
/*
 * v3.8.664: "제가 보기에는 · 제 생각에는 · 제 기준으로는 · 개인적으로는" 은 뺀다.
 * 660 부터 절마다 필자의 판단을 요구하는데, 이 검사가 그 말머리를 -5 로 깎고 있었다(상생보험 글 실측 59점).
 * 남는 것은 판단이 아니라 군더더기뿐이다.
 */
const PERSONAL_VOICE = /아무튼|솔직히\s*말해/g;

export function findPersonalVoice(text: string): AuditIssue[] {
  return collect(text, PERSONAL_VOICE, (hit, at) => ({
    kind: 'personal-voice' as const,
    title: `작성자 개인 의견: "${hit}"`,
    evidence: around(text, at),
    penalty: 5,
  }));
}

/* ④ 법률 용어 확대 — 거론한 것과 적용된 것은 다르다 */
const LAW_OVERREACH = /(?:사기|횡령|배임|공갈|명예훼손|업무상횡령)죄(?:가|를)?\s*(?:적용|성립|인정)(?:됐|되었|된다|되며)/g;

export function findLegalOverreach(text: string): AuditIssue[] {
  return collect(text, LAW_OVERREACH, (hit, at) => ({
    kind: 'legal-overreach' as const,
    title: `혐의를 확정처럼 씀: "${hit}"`,
    evidence: around(text, at),
    penalty: 12,
  }));
}

/* ⑤ 사과 요구를 합의로 확대 */
const SETTLEMENT_STRETCH = /합의\s*(?:가능성|의\s*여지|를\s*시사)|원만히\s*해결될\s*(?:것|전망)/g;

export function findSettlementStretch(text: string): AuditIssue[] {
  return collect(text, SETTLEMENT_STRETCH, (hit, at) => ({
    kind: 'settlement-stretch' as const,
    title: `합의로 확대 해석: "${hit}"`,
    evidence: around(text, at),
    penalty: 6,
  }));
}

/* ⑥ 과거 기록을 확인해야 쓸 수 있는 시간 표현 */
const FIRST_CLAIM = /최초\s*(?:폭로|공개|제기)|처음\s*(?:나온|제기된)\s*주장|처음으로\s*밝혀진/g;

export function findUnverifiedFirstClaims(text: string): AuditIssue[] {
  return collect(text, FIRST_CLAIM, (hit, at) => ({
    kind: 'unverified-first' as const,
    title: `과거 기록 확인이 필요한 표현: "${hit}"`,
    evidence: around(text, at),
    penalty: 5,
  }));
}

/* ⑦ 금액의 성격이 뒤섞였는지 — 사람이 확인해야 한다 */
/**
 * 금액 표기. "1억5천만 원" 처럼 단위가 이어지는 형태를 통째로 잡아야 한다.
 * 실측 실수: 앞 단위만 보다가 "1억5천만 원" 을 "5천만 원" 으로 읽었다.
 */
const MONEY = /\d+(?:억|조)(?:\s*\d+(?:천만|백만|천|만))?\s*원|\d+(?:천만|백만|천|만)\s*원|\d{1,3}(?:,\d{3})+\s*원/g;
const TOTAL_CLAIM = /전체\s*피해|피해\s*(?:주장)?액|총\s*피해/;
const EVIDENCE_MONEY = /차용증|영수증|계좌\s*이체|입금\s*내역|송금\s*내역/;

export function findMoneyConfusion(text: string): AuditIssue[] {
  const amounts = [...new Set(text.match(MONEY) || [])];
  if (amounts.length < 2) return [];
  if (!TOTAL_CLAIM.test(text) || !EVIDENCE_MONEY.test(text)) return [];
  return [{
    kind: 'money-confusion',
    title: `성격이 다른 금액이 함께 나옵니다 (${amounts.slice(0, 4).join(' · ')})`,
    evidence: '전체 피해 주장액과 증거 자료에 적힌 금액은 다른 것입니다. 두 금액의 관계가 확인되지 않았다면 한 문장에서 잇지 말고, 각각 무엇인지 밝혀야 합니다.',
    penalty: 8,
  }];
}

/* ⑧ 같은 사실을 문단마다 되풀이 */
const HEDGE_PHRASES = [
  '법적 판단 전', '아직 판결', '당사자 주장', '주장에 따르면',
  '수사가 진행', '확정된 사실은 아', '사실관계는 확인되지',
];
const HEDGE_MAX = 2;

export function findHedgeRepeats(text: string): AuditIssue[] {
  const out: AuditIssue[] = [];
  for (const phrase of HEDGE_PHRASES) {
    const n = text.split(phrase).length - 1;
    if (n > HEDGE_MAX) {
      out.push({
        kind: 'hedge-repeat',
        title: `"${phrase}" 가 ${n}번 나옵니다 (최대 ${HEDGE_MAX}회)`,
        evidence: '같은 단서를 문단마다 붙이면 글이 읽히지 않습니다. 한 번 분명히 밝히고 그 뒤로는 서술만 주장형으로 유지하면 됩니다.',
        penalty: 5,
      });
    }
  }
  return out;
}

/* ⑨ 결론이 본문을 다시 말함 — 마지막 문단은 숫자와 현재 상태만 */
const CONCLUSION_MAX_CHARS = 400;

export function findBloatedConclusion(paragraphs: string[]): AuditIssue[] {
  const last = paragraphs.filter((p) => p.trim().length > 0).slice(-1)[0] || '';
  if (last.length <= CONCLUSION_MAX_CHARS) return [];
  return [{
    kind: 'bloated-conclusion',
    title: `마지막 문단이 ${last.length}자입니다 (권장 ${CONCLUSION_MAX_CHARS}자 이하)`,
    evidence: last.slice(0, EVIDENCE_CHARS),
    penalty: 5,
  }];
}

/** 위 검사를 한 번에 — 평문과 문단 목록을 받는다 */
export function auditClaimSafety(text: string, paragraphs: string[]): AuditIssue[] {
  return [
    ...findAssertedCrimes(text),
    ...findLegalOverreach(text),
    ...findUnsourcedReadings(text),
    ...findMoneyConfusion(text),
    ...findSettlementStretch(text),
    ...findUnverifiedFirstClaims(text),
    ...findPersonalVoice(text),
    ...findHedgeRepeats(text),
    ...findBloatedConclusion(paragraphs),
  ];
}
