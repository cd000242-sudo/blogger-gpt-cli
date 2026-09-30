/**
 * 🤖 v3.8.777 — 에이전트 모드도 같은 작성자 요구 계약(USER REQUIREMENT CONTRACT)을 쓴다. 호출 0회·결정론.
 *
 * 에이전트는 orchestration 을 타지 않는다 — 외부 CLI 가 글을 쓰고 앱은 결과 HTML 만 회수한다. 그래서 776 계약은
 * 지시서 끝의 원문 블록 말고는 하나도 걸리지 않았다(감사 777):
 *   · 지시서 위쪽의 "FAQ + 결론·면책"·FAQPage 스키마 같은 기본 규칙과 에이전트 자신의 계획이 요구보다 앞섰다
 *   · 발행 전 자가 수정·표 상한(3 고정)이 요구를 몰랐다
 *   · 최종 확인도, 발행 보류도 없었다 — 회수한 글이 곧장 발행 창구로 갔다
 *
 * 새 파서를 만들지 않는다. parseUserRequirements·structurePlan·checkUserRequirements·requirementGate 를 그대로 부른다.
 * 여기에는 에이전트 경로에만 필요한 것만 둔다:
 *   1. 지시서 블록 — 776 Writer 정본 블록(원문 1회) + "에이전트 계획보다 우선" + 기본 규칙과 부딪히는 곳(계획에서 만든다)
 *   2. 판정용 보기 — 에이전트 CTA 는 cta-btn 클래스 없는 인라인 버튼이다. 판정할 때만 표시를 붙인다(발행 본문은 그대로)
 *   3. 발행 창구 재검사 — 회수 뒤 화면에서 이미지가 들어가 본문 지문이 바뀐다. 그래서 지문 장부가 아니라
 *      발행 직전의 실제 본문을 같은 판정으로 다시 잰다. 근거(값 단정·공식 출처용)는 회수 시점에 기억해 둔 것을 쓴다.
 */
import { parseUserRequirements, structurePlan, compactRequirementBlock, writerRequirementBlock, describeRequirement, requestKey, type UserRequirementContract, type StructurePlan } from './user-requirement';
import { checkUserRequirements, requirementGate, requirementRegressions, OFFICIAL_HOST, type RequirementResult, type RequirementGate } from './user-requirement-coverage';

export interface AgentRequirementCapture { contract: UserRequirementContract; plan: StructurePlan; compact: string }

/** 입력 시점 — API 경로와 같은 공통 함수로 계약을 만든다. 요청이 없으면 null(예전 동작) */
export function captureAgentRequirements(raw: unknown): AgentRequirementCapture | null {
  const contract = parseUserRequirements(raw);
  if (!contract.rawText) return null;
  return { contract, plan: structurePlan(contract), compact: compactRequirementBlock(contract) };
}

/** 에이전트 지시서의 기본 규칙과 부딪히는 곳 — 계약·계획에서만 만든다(문구를 따로 해석하지 않는다) */
export function agentPlanOverrides(capture: AgentRequirementCapture): string[] {
  const { contract, plan } = capture;
  const reqs = contract.requirements.filter((r) => r.priority !== 'PREFER');
  const comparison = reqs.some((r) => r.directive.kind === 'TABLE' && r.directive.enabled && r.directive.comparison);
  const lines: string[] = [];
  if (plan.faq.explicit && !plan.faq.enabled) lines.push('- FAQ 를 만들지 않는다: 지시서의 "FAQ + 결론·면책", FAQ 박스(S10), FAQPage 스키마(S14), 작업지시서 뼈대의 "자주 묻는 질문" 절을 모두 뺀다. "FAQ 최소화" 가 아니라 0개다.');
  else if (plan.faq.explicit) lines.push(`- FAQ 는 정확히 ${plan.faq.count}개(질문·답 ${plan.faq.count}쌍)만 넣는다.`);
  if (plan.maxTables === 0) lines.push('- 본문 표(<table>)를 만들지 않는다. 요약표·비교표도 목록이나 문장으로 쓴다.');
  else if (plan.minTables > 0) lines.push(`- 본문 표(<table>)를 최소 ${plan.minTables}개${comparison ? ' — 요청한 대상들을 행·열로 나란히 비교하는 표' : ''} 넣는다. 설명만으로 충분하다고 판단해도 뺄 수 없다(최대 ${plan.maxTables}개).`);
  if (plan.steps) lines.push(`- 단계는 정확히 ${plan.steps}개: 번호 목록 <ol> 하나에 <li> ${plan.steps}개(또는 "1단계"~"${plan.steps}단계" 소제목). "단계별로" 로 뭉개거나 ${plan.steps + 1}단계로 늘리지 않는다.`);
  if (plan.cta.explicit && !plan.cta.enabled) lines.push('- CTA 버튼(25번 박스)을 만들지 않는다.');
  else if (plan.cta.explicit) lines.push(`- CTA 버튼(25번 박스)을 1개 이상 넣는다${plan.cta.action ? ` — 버튼 글자에 "${plan.cta.action}" 을 넣는다` : ''}. 목적지는 그 행동을 하는 공식 화면이다(홈 첫 화면·다른 서비스·블로그 X). 확인된 주소가 없으면 지어내지 않는다.`);
  for (const r of reqs) {
    if (r.directive.kind !== 'TOPIC') continue;
    lines.push(r.type === 'EXCLUSION' ? `- "${r.directive.topic}" 은 한 문장도 다루지 않는다.` : `- "${r.directive.topic}" 을 전용 소제목(H2 또는 H3) 아래에서 근거로 구체적으로 설명한다.`);
  }
  return lines;
}

/** 지시서 블록 — Writer 정본 블록(원문 1회) + 에이전트 우선순위. 지시서 맨 끝, 예전 요청 블록 자리에 들어간다 */
export function agentInstructionsBlock(capture: AgentRequirementCapture | null): string {
  if (!capture) return '';
  const overrides = agentPlanOverrides(capture);
  return [
    writerRequirementBlock(capture.contract),
    '## 📌 에이전트 계획보다 작성자 요구가 우선',
    '우선순위: 사실 근거·안전 > 작성자 명시 요구 > 당신(에이전트)의 계획·판단 > 검색 의도 > 이 지시서의 기본 편집 규칙.',
    '계획을 세울 때 요구를 바꿔 적지 않는다. EXCLUDE 는 EXCLUDE 그대로("최소화" 아님), 숫자 조건은 그 숫자 그대로 지킨다.',
    ...(overrides.length ? ['이 지시서의 기본 규칙과 부딪히는 곳 — 아래가 이긴다:', ...overrides] : []),
    '앱이 회수한 글을 같은 계약으로 다시 잰다. 지키지 않은 MUST·어긴 EXCLUDE 가 있으면 자동 발행하지 않는다.',
    '',
  ].join('\n');
}

/** 하위 작업(발행 전 자가 수정 등) 프롬프트 — 원문을 되풀이하지 않고 압축 계약을 앞에 붙인다 */
export function withRequirements(prompt: string, capture: AgentRequirementCapture | null): string {
  return capture?.compact ? `${capture.compact.trim()}\n\n${prompt}` : prompt;
}

/** 본문 표 상한 — 계약이 없으면 예전 값 3 */
export const agentTableCap = (capture: AgentRequirementCapture | null): number => (capture ? capture.plan.maxTables : 3);

/** 전달 확인 — 지시서에 원문과 요구마다 계약 줄이 실렸나 */
export function agentDelivery(instructions: string, capture: AgentRequirementCapture | null): Array<{ id: string; status: 'DELIVERED' | 'MISSING' }> {
  if (!capture) return [];
  const text = String(instructions || '');
  const raw = text.includes(capture.contract.rawText);
  return capture.contract.requirements.map((r) => ({ id: r.id, status: raw && text.includes(`- [${r.priority}] ${describeRequirement(r)}`) ? 'DELIVERED' : 'MISSING' }));
}

/**
 * 판정용 보기 — 발행 본문은 그대로 두고 판정할 때만 쓴다.
 *   · 에이전트 CTA(지시서 25번 박스): 인라인 스타일 display:inline-block + background 인 <a>, 또는 cta·btn 클래스 <a> → cta-btn 표시
 *   · 소제목 안쪽 태그를 걷는다(FAQ 소제목 판정이 <span>·이모지 태그에 막히지 않게)
 */
export function agentEvaluationView(html: string): string {
  const markCta = String(html || '').replace(/<a\b([^>]*)>/gi, (tag: string, attrs: string) => {
    if (/class="[^"]*cta-btn/i.test(attrs)) return tag;
    const style = (attrs.match(/style="([^"]*)"/i) || [])[1] || '';
    const cls = (attrs.match(/class="([^"]*)"/i) || [])[1] || '';
    const isButton = (/display\s*:\s*inline-block/i.test(style) && /background/i.test(style)) || /\b(?:cta|btn|button)\b/i.test(cls);
    if (!isButton) return tag;
    return cls ? tag.replace(/class="([^"]*)"/i, 'class="$1 cta-btn"') : `<a class="cta-btn"${attrs}>`;
  });
  return markCta.replace(/<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_m: string, tag: string, attrs: string, inner: string) => `<${tag}${attrs}>${inner.replace(/<[^>]+>/g, '')}</${tag}>`);
}

/** 근거 안의 공식 출처 수 — 주소의 호스트로 센다 */
export function countOfficialSources(evidenceText: string): number {
  const hosts = new Set<string>();
  for (const m of String(evidenceText || '').matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)) {
    try { const h = new URL(m[0]).hostname.toLowerCase(); if (OFFICIAL_HOST.test(h)) hosts.add(h); } catch { /* 주소가 아니면 건너뛴다 */ }
  }
  return hosts.size;
}

export interface AgentEvaluation { results: RequirementResult[]; gate: RequirementGate; regressions: ReturnType<typeof requirementRegressions>; officialSources: number }

/** 회수 시점 판정 — API 경로와 같은 판정 모듈 · 근거는 에이전트 근거 장부 · 에이전트가 낸 원본과 비교해 회귀를 잰다 */
export function evaluateAgentRequirements(input: { capture: AgentRequirementCapture; html: string; baselineHtml?: string; evidenceText?: string }): AgentEvaluation {
  const evidenceText = String(input.evidenceText || '');
  const officialSources = countOfficialSources(evidenceText);
  const judge = (html: string) => checkUserRequirements(input.capture.contract, { html: agentEvaluationView(html), evidenceText, officialSources });
  const results = judge(input.html);
  const regressions = input.baselineHtml ? requirementRegressions(judge(input.baselineHtml), results, 'agent→final') : [];
  return { results, gate: requirementGate(results), regressions, officialSources };
}

/** 발행 창구가 쓸 근거 — 회수 시점에 기억한다(같은 main 프로세스). 판정은 기억하지 않는다: 발행 직전 실제 본문으로 다시 잰다 */
const evidenceMemo = new Map<string, { evidenceText: string; officialSources: number }>();
const MEMO_MAX = 60;
const memoKey = (fingerprint: string, keyword: unknown) => `${fingerprint}|${requestKey(keyword)}`;
export function rememberAgentEvidence(fingerprint: string, keyword: unknown, evidenceText: string): void {
  evidenceMemo.set(memoKey(fingerprint, keyword), { evidenceText: String(evidenceText || ''), officialSources: countOfficialSources(evidenceText) });
  if (evidenceMemo.size > MEMO_MAX) { const oldest = evidenceMemo.keys().next().value; if (oldest) evidenceMemo.delete(oldest); }
}

/** 에이전트 글 표시 — applyCodexResult 가 payload 에 남긴다(작업실 붙여넣기 포함) */
export const isAgentContent = (payload: unknown): boolean => (payload as { codexWorkshop?: unknown } | null)?.codexWorkshop === true;

export interface AgentPublishCheck { applies: boolean; pass: boolean; reason: string; results: RequirementResult[]; evidence: 'REMEMBERED' | 'NONE' }

/**
 * 발행 창구 재검사 — 에이전트 글 + 작성자 요청이 있을 때만. 일반(API) 글은 손대지 않는다(applies=false).
 * 근거를 기억하지 못했으면(앱 재시작·수동 붙여넣기) 값 단정·공식 출처 요구는 보수적으로 막힌다 — 사실이 요구보다 먼저다.
 */
export function agentPublishCheck(payload: unknown, html: string): AgentPublishCheck {
  const p = (payload || {}) as { userRequest?: unknown; topic?: unknown; keyword?: unknown };
  if (!isAgentContent(payload)) return { applies: false, pass: true, reason: '', results: [], evidence: 'NONE' };
  const capture = captureAgentRequirements(p.userRequest);
  if (!capture) return { applies: false, pass: true, reason: '', results: [], evidence: 'NONE' };
  const memo = evidenceMemo.get(memoKey(capture.contract.fingerprint, p.topic ?? p.keyword));
  const results = checkUserRequirements(capture.contract, { html: agentEvaluationView(html), evidenceText: memo?.evidenceText || '', officialSources: memo?.officialSources || 0 });
  const gate = requirementGate(results);
  return { applies: true, pass: gate.pass, reason: gate.reason, results, evidence: memo ? 'REMEMBERED' : 'NONE' };
}

/** 테스트용 */
export function clearAgentEvidence(): void { evidenceMemo.clear(); }
