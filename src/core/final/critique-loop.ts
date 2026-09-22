/**
 * 🔁 비평·수정 루프 v2 — "실제로 문제가 있을 때만 최소한으로 고치고, 없으면 빨리 끝난다." (v3.8.736)
 *
 * ## v1(735) 이 수렴하지 못한 이유 (live 3편: 지적 10→8→7→8 · 11→10→8→10 · 15→7→10→6, 비용 3배)
 *   ① Critic 이 회차마다 글 전체를 처음부터 다시 심사했다 — 이전 지적 목록도, 해결/미해결 구분도 없었다.
 *   ② 일반 설명("여력이 빠듯하면 고정형")까지 "근거에 없다"며 critical 로 올렸다.
 *   ③ 같은 문제를 다른 문장으로 적어 새 지적처럼 보였다(지문 없음).
 *   ④ 절마다 편집 호출을 따로 해 호출이 29~40회로 늘었다.
 *   ⑤ "0.5%p 는 근거 없음 → 지워라" 를 편집기가 지웠는데 과수정 관문이 "근거 있는 값이 사라졌다"며 되돌렸다(교착).
 *   ⑥ Final Judge 가 Critic 과 다른 잣대로 새 문제를 만들고, "한 번 더 고치면 나아진다"가 늘 true 였다.
 *
 * ## v2 원칙
 *   · **구체 값(숫자·금액·날짜·기간·비율·인원)은 코드가 판정한다**(fact-claims). 코드가 PASS 한 값을 모델이 근거 없다고 다시 올리지 못한다.
 *   · Critic 1 은 셋만 본다 — 검색 의도 · 제목 약속 · 패킷과의 모순/누락. CRITICAL/MAJOR 는 sectionId·exactSpan·구체 문제가 있어야 산다.
 *   · 지적마다 지문(issueKey = 절 + 종류 + 핵심 구절)을 만들어 OPEN / RESOLVED / REGRESSED 로 관리한다.
 *   · 수정 뒤 검증 비평은 "OPEN 이 풀렸는가 · 수정 때문에 새 CRITICAL 이 생겼는가" 만 본다. 새 MAJOR 발굴 금지.
 *   · 편집은 **한 번의 호출**로 최대 4절. 지적마다 허용 연산(REMOVE/REPLACE/ADD/REORDER)을 달아, REMOVE 로 사라진 값은 손실이 아니다.
 *   · 수정 최대 2회. 남으면 MANUAL_REVIEW. MINOR 는 수렴을 막지 않는다.
 *   · Final Judge 는 이미 나온 관문 결과를 종합하고, 구체 blocker(절·구절·종류) 없이는 BLOCK 하지 못한다.
 */

import { checkClaims, ledgerFromItems, norm, type LedgerItem } from './fact-claims';

// ─── 형 ──────────────────────────────────────────────────────

export interface H3Section { h3: string; content: string; tables?: any[]; [k: string]: any }
export interface ArticleSections {
  introduction: string;
  conclusion: string;
  sections: Array<{ h2: string; h3Sections: H3Section[]; [k: string]: any }>;
  [k: string]: any;
}

export type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type Operation = 'ADD' | 'REMOVE' | 'REPLACE' | 'REORDER';
/**
 * v3.8.738 — PENDING_VERIFICATION: 편집기가 고쳤다고 신고했지만 검증이 아직 확인하지 않은 상태.
 * 편집기는 수정자이지 심판이 아니다 — 편집기 자가 신고만으로 RESOLVED 가 되지 못한다(live 737 3회차: 검증이 stillOpen 이라 했는데 RESOLVED 됐다).
 */
export type IssueStatus = 'OPEN' | 'PENDING_VERIFICATION' | 'RESOLVED' | 'REGRESSED';

export interface Issue {
  issueKey: string;
  severity: Severity;
  sectionId: string;
  exactSpan: string;
  type: string;
  problem: string;
  evidenceIds: string[];
  requiredChange: string;
  allowedOperations: Operation[];
  origin: 'code' | 'critic1' | 'verify' | 'editorial';
  status: IssueStatus;
  /** 검증 비평이 "수정 때문에 새로 생겼다"고 한 것만 true */
  causedByRevision?: boolean;
}

/** 팩트 종류 — evidenceIds 가 없으면 blocking 으로 인정하지 않는다 */
const FACT_TYPES = new Set(['CONTRADICTION', 'MISSING_INFORMATION', 'EXPIRED_AS_CURRENT', 'MIXED_ENTITY']);
/** 모델이 CRITICAL 로 올릴 수 있는 종류 — 나머지는 MAJOR 상한 */
const CRITICAL_TYPES = new Set(['CONTRADICTION', 'MIXED_ENTITY', 'EXPIRED_AS_CURRENT', 'UNSUPPORTED_VALUE']);
/** blocking(CRITICAL/MAJOR) 이 될 수 있는 종류 — 이 밖의 종류는 MINOR 로만 남는다 */
const BLOCKING_TYPES = new Set([
  ...CRITICAL_TYPES, 'SEARCH_INTENT_MISSING', 'TITLE_PROMISE_UNMET', 'MISSING_INFORMATION', 'REDUNDANCY', 'ANSWER_TOO_LATE', 'SECTION_CONFLICT',
  'INTRO_OFFTOPIC', 'HEADING_MISMATCH', 'ANSWER_NEVER_GIVEN', 'STRUCTURE_BROKEN',
]);
/** 종류별 허용 연산 — 편집기와 과수정 관문이 같은 표를 본다 */
const OPS_BY_TYPE: Record<string, Operation[]> = {
  UNSUPPORTED_VALUE: ['REMOVE', 'REPLACE'], REDUNDANCY: ['REMOVE'], CONTRADICTION: ['REPLACE', 'REMOVE'], MIXED_ENTITY: ['REMOVE', 'REPLACE'],
  EXPIRED_AS_CURRENT: ['REPLACE', 'REMOVE'], MISSING_INFORMATION: ['ADD'], SEARCH_INTENT_MISSING: ['ADD'], TITLE_PROMISE_UNMET: ['ADD', 'REPLACE'],
  ANSWER_TOO_LATE: ['REORDER'], SECTION_CONFLICT: ['REPLACE'], INTRO_OFFTOPIC: ['REPLACE'], HEADING_MISMATCH: ['REPLACE'],
  ANSWER_NEVER_GIVEN: ['ADD'], STRUCTURE_BROKEN: ['REPLACE'],
};
const opsFor = (type: string): Operation[] => OPS_BY_TYPE[type] || ['REPLACE'];

export interface CriticResult {
  status: 'PASS' | 'REVISION_REQUIRED' | 'NEEDS_MORE_RESEARCH';
  /** 모델 raw status 가 NEEDS_MORE_RESEARCH 이고 researchQueries 가 있음 — blocking 여부와 무관 */
  researchRequested?: boolean;
  issues: Issue[];
  /** 살아남지 못한 모델 지적(왜 버렸는지) */
  rejectedIssues: Array<{ reason: string; raw: any }>;
  missingIntentAnswers: string[];
  titleIssues: Array<{ problem: string; requiredChange: string }>;
  researchQueries: string[];
  model?: string;
  raw?: string;
}

export interface RevisionOutcome {
  revised: string[];
  rejected: Array<{ sectionId: string; reason: string }>;
  skipped: string[];
  /** 편집기가 "고쳤다"고 신고한 지적 — **시도의 기록일 뿐**, 해결 여부는 검증이 정한다 */
  resolvedIssueKeys: string[];
  calls: number;
  models: string[];
}

/** 검증 비평 직전의 입력 — 최신 제목·최신 절을 봤는지 하네스가 확인한다 */
export interface VerificationContext {
  cycle: number;
  originalTitle: string;
  currentTitle: string;
  issues: Array<{ issueKey: string; sectionId: string; originalSection: string; currentSection: string }>;
}

export interface JudgeBlocker { sectionId: string; exactSpan: string; type: string; reason: string }
export interface JudgeResult { decision: 'PASS' | 'BLOCK'; blockingIssues: JudgeBlocker[]; advisory: string[]; model?: string }

export type CallModel = (prompt: string, opts?: { json?: boolean }) => Promise<string>;

export interface LoopInput {
  title: string;
  mainKeyword: string;
  article: ArticleSections;
  packetText: string;
  evidenceText: string;
  items: Array<{ id: string; title: string; cleanedText: string }>;
  callModel: CallModel;
  onLog?: (m: string) => void;
  moreResearch?: (queries: string[]) => Promise<{ packetText: string; evidenceText: string; items: LoopInput['items'] } | null>;
  modelOf?: () => string;
  /** 수정 상한 — 기본 2 */
  maxRevisions?: number;
  /**
   * v3.8.738 — 제목 수정은 **검증 비평 전에** 끝난다(Critic → 제목 수정 → Title Fact Gate → 본문 편집 → 검증).
   * 호출자가 제목을 다시 짓고 Title Fact Gate 를 지난 결과를 돌려준다. pass 가 아니면 옛 제목을 유지한다.
   */
  reviseTitle?: (titleIssues: Array<{ problem: string; requiredChange: string }>) => Promise<{ title: string; pass: boolean } | null>;
  /** 지금까지 쓴 비용(USD) — Research Recovery 비용을 따로 재는 데 쓴다. 없으면 0 */
  usageUsd?: () => number;
}

/** v3.8.746 — Research Recovery 기록. 편집기보다 검색이 먼저였는지, 그래서 편집 호출을 몇 회 아꼈는지 */
export interface ResearchRecovery {
  triggered: boolean;
  queries: string[];
  searchCount: number;
  evidenceAdded: number;
  criticBefore: { status: string; blocking: number; critical: number; major: number };
  criticAfter: { status: string; blocking: number; critical: number; major: number } | null;
  /** 검색으로 blocking 이 0 이 됐으면 편집 1회(+검증 1회)를 아낀 것 */
  editorCallsSaved: number;
  recoveryCalls: number;
  recoveryCost: number;
  /** 보강 뒤에도 Critic 이 다시 근거를 요구했다(상한 1회라 더 안 간다) */
  stillRequested: boolean;
}

export interface LoopReport {
  criticCycles: number;
  revisionCycles: number;
  qualityLoopCalls: number;
  critic1: CriticResult | null;
  verifications: CriticResult[];
  /** 검증 비평이 받은 입력(최신 제목·절) — 옛 제목으로 판정하는 일이 없는지 하네스가 본다 */
  verificationContexts: VerificationContext[];
  editorial: CriticResult | null;
  revisions: RevisionOutcome[];
  issueLedger: Issue[];
  titleIssues: Array<{ problem: string; requiredChange: string }>;
  /** 루프 안에서 제목이 바뀌었으면 그 기록 */
  titleRevision: { from: string; to: string; pass: boolean } | null;
  researchRounds: number;
  researchRecovery: ResearchRecovery | null;
  converged: boolean;
  open: { critical: number; major: number; minor: number; pending: number };
  unchangedSections: number;
  revisedSections: number;
  totalSections: number;
  models: { critic1: string; revision: string[]; verify: string[]; editorial: string };
  manualReviewReason: string;
}

// ─── 절 나누기 · 공용 ─────────────────────────────────────────

export interface Unit { id: string; kind: 'intro' | 'section' | 'conclusion'; h2: string; text: string; h3Sections: H3Section[] }

export const stripHtml = (s: string): string => String(s || '')
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(p|li|tr|h[1-6]|div|blockquote)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

export function sectionize(a: ArticleSections): Unit[] {
  const units: Unit[] = [{ id: 'S00', kind: 'intro', h2: '(도입)', text: String(a.introduction || ''), h3Sections: [] }];
  (a.sections || []).forEach((s, i) => {
    units.push({ id: `S${String(i + 1).padStart(2, '0')}`, kind: 'section', h2: String(s.h2 || ''), text: (s.h3Sections || []).map((h) => `<h3>${h.h3}</h3>${h.content}`).join('\n'), h3Sections: s.h3Sections || [] });
  });
  units.push({ id: 'S99', kind: 'conclusion', h2: '(결론)', text: String(a.conclusion || ''), h3Sections: [] });
  return units;
}

export function manuscriptFor(units: Unit[], maxCharsPerUnit = 2600): string {
  return units.map((u) => `[${u.id}] ${u.kind === 'section' ? `## ${u.h2}` : u.h2}\n${stripHtml(u.text).slice(0, maxCharsPerUnit)}`).join('\n\n');
}

const sentencesOf = (text: string): string[] => stripHtml(text).split(/(?<=[.!?。])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 22);

export function findCrossSectionRepeats(units: Unit[]): Array<{ sentence: string; sectionIds: string[] }> {
  const where = new Map<string, Set<string>>();
  for (const u of units) for (const s of new Set(sentencesOf(u.text))) {
    const key = s.replace(/\s/g, '');
    if (!where.has(key)) where.set(key, new Set());
    where.get(key)!.add(u.id);
  }
  return [...where.entries()].filter(([, ids]) => ids.size >= 2).map(([key, ids]) => ({ sentence: key.slice(0, 60), sectionIds: [...ids] }));
}

export function readJson(raw: string): any | null {
  const text = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const s = text.indexOf('{'); const e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  const body = text.slice(s, e + 1);
  try { return JSON.parse(body); } catch { /* 한 번 더 */ }
  try { return JSON.parse(body.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' ')); } catch { return null; }
}

function ledgerOf(items: LoopInput['items'], packetText: string): LedgerItem[] {
  return ledgerFromItems([...items.map((i) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), { id: 'PACKET', text: packetText }]);
}

const flat = (s: string) => String(s || '').replace(/\s+/g, '');

/** 지문 — 절 + 종류 + 핵심 구절(정규화 24자). 같은 문제를 다른 문장으로 적어도 같은 지문이다 */
export function issueKeyOf(sectionId: string, type: string, span: string): string {
  return `${sectionId}|${type}|${norm(span).replace(/[^가-힣A-Za-z0-9%~]/g, '').slice(0, 24)}`;
}

// ─── 코드 관문 (deterministic) ────────────────────────────────

export function codeGate(units: Unit[], ledger: LedgerItem[]): Issue[] {
  const issues: Issue[] = [];
  for (const u of units) {
    for (const c of checkClaims(u.text, ledger).unsupported) {
      issues.push({ issueKey: issueKeyOf(u.id, 'UNSUPPORTED_VALUE', c), severity: 'CRITICAL', sectionId: u.id, exactSpan: c, type: 'UNSUPPORTED_VALUE', problem: `근거에 없는 값: "${c}"`, evidenceIds: [], requiredChange: '이 값을 지우거나 Research Packet 에 있는 값으로 바꾸세요. 새 값을 만들지 마세요.', allowedOperations: opsFor('UNSUPPORTED_VALUE'), origin: 'code', status: 'OPEN' });
    }
  }
  const byLater = new Map<string, string[]>();
  for (const r of findCrossSectionRepeats(units)) { const later = [...r.sectionIds].sort().pop()!; if (!byLater.has(later)) byLater.set(later, []); byLater.get(later)!.push(r.sentence); }
  for (const [sectionId, sentences] of byLater) {
    issues.push({ issueKey: issueKeyOf(sectionId, 'REDUNDANCY', sentences[0]!), severity: 'MAJOR', sectionId, exactSpan: sentences[0]!, type: 'REDUNDANCY', problem: `앞 절과 같은 문장 ${sentences.length}개`, evidenceIds: [], requiredChange: '앞 절에서 이미 말한 문장을 지우세요. 이 절만의 정보가 없으면 짧게 끝내세요.', allowedOperations: opsFor('REDUNDANCY'), origin: 'code', status: 'OPEN' });
  }
  return issues;
}

/** 모델 지적을 검증한다 — 절·구절·구체성·근거 id·종류·심각도. 살아남지 못하면 이유를 남긴다 */
function acceptIssue(x: any, units: Unit[], itemIds: Set<string>, ledger: LedgerItem[], origin: Issue['origin'], allowNewBlocking: boolean, revisedIds: Set<string>): { issue?: Issue; reject?: string } {
  const sectionId = String(x?.sectionId || '').trim();
  const unit = units.find((u) => u.id === sectionId);
  if (!unit) return { reject: `없는 절 id: ${sectionId}` };
  const type = String(x?.type || 'OTHER').toUpperCase().replace(/[^A-Z_]/g, '').slice(0, 40) || 'OTHER';
  const problem = String(x?.problem || '').trim();
  const exactSpan = String(x?.exactSpan || '').trim();
  let severity = String(x?.severity || 'MINOR').toUpperCase() as Severity;
  if (!['CRITICAL', 'MAJOR', 'MINOR'].includes(severity)) severity = 'MINOR';
  const evidenceIds = [...new Set((Array.isArray(x?.evidenceIds) ? x.evidenceIds : []).map(String))].filter((id) => itemIds.has(id as string)) as string[];
  if (problem.length < 10) return { reject: '문제 설명이 구체적이지 않음' };

  const spanFound = exactSpan.length >= 6 && flat(stripHtml(unit.text)).includes(flat(exactSpan));
  if (severity !== 'MINOR') {
    if (!spanFound && type !== 'SEARCH_INTENT_MISSING' && type !== 'TITLE_PROMISE_UNMET' && type !== 'ANSWER_NEVER_GIVEN') severity = 'MINOR';   // 구절이 없으면 blocking 아님
    if (FACT_TYPES.has(type) && evidenceIds.length === 0) severity = 'MINOR';                                                                   // 팩트 지적은 근거 id 가 있어야
    if (type === 'MISSING_INFORMATION' && evidenceIds.length === 0) return { reject: '근거 없는 "넣어라" 지적' };
  }
  // 값에 대한 판정은 코드가 권위다 — 코드가 뒷받침된 값을 모델이 "근거 없다"고 하면 버린다
  if (/UNSUPPORTED|근거\s*없/.test(`${type} ${problem}`) && exactSpan) {
    const check = checkClaims(exactSpan, ledger);
    if (check.unsupported.length === 0 && check.supported.length > 0) return { reject: `코드가 뒷받침을 확인한 값(${check.supported.map((s) => s.claim).join(', ')})을 근거 없다고 함` };
    if (check.unsupported.length > 0) return { reject: '근거 없는 값은 코드 관문이 이미 잡음(중복)' };
  }
  if (severity === 'CRITICAL' && !CRITICAL_TYPES.has(type)) severity = 'MAJOR';
  // MAJOR 도 정해진 종류만 — "OTHER"·"UNSUPPORTED_CLAIM(일반 설명이 근거에 없다)" 같은 것은 참고(MINOR)
  if (severity === 'MAJOR' && !BLOCKING_TYPES.has(type)) severity = 'MINOR';
  // 검증 비평에서 새 blocking 은 "수정 때문에 생긴 CRITICAL" 만 — 그 밖은 참고(MINOR)
  if (!allowNewBlocking && severity !== 'MINOR') {
    const caused = x?.causedByRevision === true && revisedIds.has(sectionId) && severity === 'CRITICAL';
    if (!caused) severity = 'MINOR';
  }
  return {
    issue: {
      issueKey: issueKeyOf(sectionId, type, exactSpan || problem), severity, sectionId, exactSpan: exactSpan.slice(0, 200), type,
      problem: problem.slice(0, 300), evidenceIds, requiredChange: String(x?.requiredChange || '').trim().slice(0, 300),
      allowedOperations: opsFor(type), origin, status: 'OPEN', ...(x?.causedByRevision === true ? { causedByRevision: true } : {}),
    },
  };
}

const isBlocking = (i: Issue) => i.status === 'OPEN' && (i.severity === 'CRITICAL' || i.severity === 'MAJOR');

// ─── Critic 1 — 검색 의도 · 제목 약속 · 패킷 모순/누락 ──────────

const CRITIC1_RULES = `당신은 검수자입니다. 칭찬하지 않고, 문장을 다듬지도 않습니다. 딱 셋만 봅니다.
A. SEARCH INTENT — 검색자가 알고 싶은 핵심 답이 빠졌는가. (type: SEARCH_INTENT_MISSING · 근거 id 불필요)
B. TITLE PROMISE — 제목이 약속한 답을 본문이 실제로 주는가. (type: TITLE_PROMISE_UNMET)
C. PACKET — Research Packet 에 있는 중요한 정보가 본문에 빠졌거나(MISSING_INFORMATION, evidenceIds 필수) 반대로 설명됐는가(CONTRADICTION, evidenceIds 필수). 다른 상품·정책·회차·인물의 정보가 섞였는가(MIXED_ENTITY). 마감된 것을 지금 신청 가능한 것처럼 썼는가(EXPIRED_AS_CURRENT).

하지 않는 것
- 숫자·금액·날짜·기간·비율·인원은 **코드가 이미 근거와 대조했습니다.** 값이 근거에 있는지 없는지는 판단하지 마세요.
- 일반적인 설명·선택 기준·상식적인 해석·"~하면 좋다" 수준의 조언·문체·표현은 지적 대상이 아닙니다. ("여력이 빠듯하면 고정형" 같은 문장은 근거가 없어도 괜찮습니다.)
- 없는 문제를 만들지 마세요. 문제가 없으면 status PASS 와 빈 배열.

심각도
- CRITICAL: 근거와 정면으로 다른 사실 · 다른 대상 혼입 · 마감된 것을 현재로 · 대상/자격을 반대로 설명. (이 넷뿐)
- MAJOR: 제목의 핵심 질문에 답이 없음 · 검색 의도의 중요한 질문이 통째로 빠짐 · 패킷 핵심 사실 누락 · 같은 내용의 큰 반복(REDUNDANCY) · 핵심 답이 너무 뒤(ANSWER_TOO_LATE) · 절끼리 논리 충돌(SECTION_CONFLICT).
- MINOR: 그 밖의 참고.
CRITICAL/MAJOR 는 sectionId 와 **본문에 실제로 있는 구절(exactSpan, 원문 그대로 6자 이상)** 이 있어야 합니다. 없으면 MINOR 로 적으세요.
근거가 모자라 판단할 수 없으면 status NEEDS_MORE_RESEARCH 와 researchQueries(메인 키워드 포함).

출력(JSON 객체 하나만):
{"status":"PASS|REVISION_REQUIRED|NEEDS_MORE_RESEARCH",
 "issues":[{"severity":"CRITICAL|MAJOR|MINOR","sectionId":"S03","exactSpan":"본문 원문 구절","type":"SEARCH_INTENT_MISSING|TITLE_PROMISE_UNMET|MISSING_INFORMATION|CONTRADICTION|MIXED_ENTITY|EXPIRED_AS_CURRENT|REDUNDANCY|ANSWER_TOO_LATE|SECTION_CONFLICT|OTHER","problem":"…","evidenceIds":["E02"],"requiredChange":"…"}],
 "missingIntentAnswers":["…"],
 "titleIssues":[{"problem":"…","requiredChange":"…"}],
 "researchQueries":[]}`;

async function callCritic(input: LoopInput, units: Unit[], rules: string, extra: string, origin: Issue['origin'], allowNewBlocking: boolean, revisedIds: Set<string>, manuscriptUnits: Unit[] = units): Promise<CriticResult> {
  const ledger = ledgerOf(input.items, input.packetText);
  const itemIds = new Set(input.items.map((i) => i.id));
  const prompt = [
    rules, '', `메인 키워드: ${input.mainKeyword}`, `제목: ${input.title}`, '',
    ...(extra ? [extra, ''] : []),
    input.packetText.slice(0, 5500), '',
    `===== FACT EVIDENCE(요약) =====\n${input.evidenceText.slice(0, 6000)}`, '',
    `===== 원고 =====\n${manuscriptFor(manuscriptUnits)}`,
  ].join('\n');
  let parsed: any = null; let raw = '';
  try { raw = await input.callModel(prompt, { json: true }); parsed = readJson(raw); } catch (err: any) { if ((err as any)?.canceled) throw err; input.onLog?.(`🩺 비평 호출 실패: ${String(err?.message || err).slice(0, 80)}`); }
  const issues: Issue[] = []; const rejectedIssues: Array<{ reason: string; raw: any }> = [];
  for (const x of Array.isArray(parsed?.issues) ? parsed.issues : []) {
    const r = acceptIssue(x, units, itemIds, ledger, origin, allowNewBlocking, revisedIds);
    if (r.issue) issues.push(r.issue); else rejectedIssues.push({ reason: r.reject || '?', raw: x });
  }
  const status = String(parsed?.status || '').toUpperCase();
  const researchQueries = (Array.isArray(parsed?.researchQueries) ? parsed.researchQueries : []).map(String).filter((q: string) => q.trim().length >= 2).slice(0, 3);
  return {
    status: issues.some(isBlocking) ? 'REVISION_REQUIRED' : (status === 'NEEDS_MORE_RESEARCH' && researchQueries.length ? 'NEEDS_MORE_RESEARCH' : 'PASS'),
    // v3.8.746 — blocking 지적이 있어도 "근거가 모자란다" 는 요청은 따로 남긴다. 검색이 편집보다 먼저다
    researchRequested: status === 'NEEDS_MORE_RESEARCH' && researchQueries.length > 0,
    issues, rejectedIssues,
    missingIntentAnswers: (Array.isArray(parsed?.missingIntentAnswers) ? parsed.missingIntentAnswers : []).map(String).slice(0, 8),
    titleIssues: (Array.isArray(parsed?.titleIssues) ? parsed.titleIssues : []).filter((t: any) => t?.problem).map((t: any) => ({ problem: String(t.problem).slice(0, 200), requiredChange: String(t.requiredChange || '').slice(0, 200) })).slice(0, 3),
    researchQueries,
    ...(input.modelOf ? { model: input.modelOf() } : {}),
    raw: raw.slice(0, 6000),
  };
}

export const runCritic1 = (input: LoopInput, units: Unit[]) => callCritic(input, units, CRITIC1_RULES, '', 'critic1', true, new Set());

// ─── 검증 비평 — OPEN 이 풀렸는가 · 수정이 새 CRITICAL 을 만들었는가 ──

const VERIFY_RULES = `당신은 검수자입니다. 이 원고는 방금 지적된 절만 고쳐졌습니다. 새 개선점을 찾지 마세요. 두 가지만 답합니다.
1) 아래 OPEN 지적 각각이 해결됐는가 — resolved 에 issueKey 를 넣습니다. 안 풀렸으면 stillOpen 에 issueKey 와 짧은 이유.
2) 이번 수정 **때문에** 고친 절에 새로 생긴 CRITICAL(근거와 다른 사실·다른 대상 혼입·마감된 것을 현재로) 이 있는가 — 있으면 issues 에 causedByRevision:true 로. 그 밖의 새 지적은 MINOR 로만.
값(숫자·날짜·금액)은 코드가 대조합니다 — 값의 근거 유무를 판단하지 마세요.
출력(JSON 객체 하나만): {"resolved":["S03|…"],"stillOpen":[{"issueKey":"…","reason":"…"}],"issues":[{"severity":"CRITICAL|MINOR","sectionId":"S03","exactSpan":"…","type":"CONTRADICTION|MIXED_ENTITY|EXPIRED_AS_CURRENT|OTHER","problem":"…","evidenceIds":[],"requiredChange":"…","causedByRevision":true}]}`;

async function runVerification(input: LoopInput, units: Unit[], open: Issue[], revisedIds: Set<string>): Promise<{ result: CriticResult; resolved: Set<string>; stillOpen: Map<string, string> }> {
  const list = open.map((i) => `- ${i.issueKey} [${i.severity}] (${i.sectionId}) ${i.problem}`).join('\n');
  const revisedUnits = units.filter((u) => revisedIds.has(u.id));
  const result = await callCritic(input, units, VERIFY_RULES, `===== OPEN 지적 =====\n${list}`, 'verify', false, revisedIds, revisedUnits.length ? revisedUnits : units);
  const parsed = readJson(result.raw || '') || {};
  const stillOpen = new Map<string, string>();
  for (const s of Array.isArray(parsed.stillOpen) ? parsed.stillOpen : []) stillOpen.set(String(s?.issueKey || ''), String(s?.reason || '').slice(0, 160));
  // 같은 지문이 resolved 와 stillOpen 양쪽에 있으면 stillOpen 이 이긴다 — 보수적으로 OPEN
  const resolved = new Set<string>((Array.isArray(parsed.resolved) ? parsed.resolved : []).map(String).filter((k: string) => !stillOpen.has(k)));
  return { result, resolved, stillOpen };
}

// ─── 편집 비평 — 발행을 막을 편집 문제만 ─────────────────────────

const EDITORIAL_RULES = `당신은 편집자입니다. 사실 검사는 끝났습니다. **발행을 막아야 할 편집 문제만** 봅니다. "더 좋아질 점"을 찾지 마세요.
MAJOR 로 볼 수 있는 것(이 다섯뿐): 도입부가 주제와 무관(INTRO_OFFTOPIC) · 같은 내용의 큰 반복(REDUNDANCY) · 소제목과 본문 불일치(HEADING_MISMATCH) · 핵심 답이 끝까지 안 나옴(ANSWER_NEVER_GIVEN) · 문단 구조가 심각하게 깨짐(STRUCTURE_BROKEN).
MINOR(수정하지 않음): 더 자연스럽게 · 더 흥미롭게 · 표현 다양화 · 문체 · 빈 문장 몇 개.
MAJOR 는 sectionId 와 본문 원문 구절(exactSpan) 이 있어야 합니다. 없으면 MINOR.
출력(JSON 객체 하나만): {"status":"PASS|REVISION_REQUIRED","issues":[{"severity":"MAJOR|MINOR","sectionId":"S02","exactSpan":"…","type":"INTRO_OFFTOPIC|REDUNDANCY|HEADING_MISMATCH|ANSWER_NEVER_GIVEN|STRUCTURE_BROKEN|OTHER","problem":"…","evidenceIds":[],"requiredChange":"…"}]}`;

export const runEditorialCritic = (input: LoopInput, units: Unit[]) => callCritic(input, units, EDITORIAL_RULES, '', 'editorial', true, new Set());

// ─── Editor — 한 번의 호출로 문제 절만 ────────────────────────

const EDITOR_RULES = `당신은 교정자입니다. 아래 절들만 고칩니다. 보이지 않는 절은 없는 것입니다.
- **문제 해결에 필요한 최소 범위만** 바꿉니다. 값 하나가 틀렸으면 그 값/문장만, 반복이면 반복 문장만 지우고, 답이 빠졌으면 필요한 문단 하나만 보탭니다. 절 전체를 다시 쓰지 않습니다.
- 각 지적의 allowedOperations 안에서만 움직입니다. REMOVE 는 지우기, REPLACE 는 그 자리 바꾸기, ADD 는 보태기, REORDER 는 순서 옮기기.
- 값(날짜·금액·비율·조건)은 Research Packet·근거에 글자로 있는 것만. 새 값을 만들지 마세요.
- HTML 태그는 원문 방식 그대로. h3 제목은 바꾸지 않습니다. 출처 id·"Research Packet" 같은 말은 본문에 쓰지 않습니다.
출력(JSON 객체 하나만): {"revisions":[{"sectionId":"S03","h3Sections":[{"index":0,"content":"<p>…</p>"}],"resolvedIssueKeys":["S03|…"]},{"sectionId":"S00","content":"<p>…</p>","resolvedIssueKeys":[]}]}
h3 가 있는 절은 h3Sections 로, 도입·결론은 content 로 돌려줍니다. 고칠 필요가 없는 h3 는 빼도 됩니다(원문이 유지됩니다).`;

export const MAX_SECTIONS_PER_CYCLE = 4;

/**
 * 과수정 관문 — 지적이 요구한 변경(허용 연산·구절)을 이해한 채로 전/후를 비교한다.
 *   · 새 근거 없는 값 → 거부
 *   · REMOVE 대상 구절의 값이 사라진 것은 정상. 그 밖의 근거 있는 값이 많이 사라지면 거부
 *   · REMOVE 가 없는데 분량이 45% 미만으로 줄면 거부(REMOVE 있으면 25%)
 *   · 다른 절과 같은 문장이 새로 생기면 거부
 *   · 코드 지적(UNSUPPORTED_VALUE)이 하나도 안 풀렸으면 거부 — 고친 척은 채택하지 않는다
 */
export function guardRevision(before: string, after: string, ledger: LedgerItem[], otherUnits: Unit[], issues: Issue[] = []): string | null {
  const b = stripHtml(before); const a = stripHtml(after);
  if (a.length < 12 || (b.length > 300 && a.length < 80)) return '고친 절이 비었다';
  const cb = checkClaims(before, ledger); const ca = checkClaims(after, ledger);
  const newUnsupported = ca.unsupported.filter((c) => !cb.unsupported.includes(c));
  if (newUnsupported.length) return `새로 근거 없는 값이 생겼다: ${newUnsupported.join(', ')}`;
  const removal = issues.some((i) => i.allowedOperations.includes('REMOVE'));
  const removeSpans = issues.filter((i) => i.allowedOperations.includes('REMOVE')).map((i) => norm(i.exactSpan));
  const keyOf = (s: { claim: string }) => norm(s.claim);
  const lost = cb.supported.map(keyOf).filter((k) => !ca.supported.map(keyOf).includes(k) && !norm(after).includes(k))
    .filter((k) => !removeSpans.some((sp) => sp.includes(k) || k.includes(sp)));
  const lossLimit = removal ? Math.max(2, Math.floor(cb.supported.length * 0.5)) : Math.max(1, Math.floor(cb.supported.length * 0.34));
  if (lost.length > lossLimit) return `근거 있는 값이 사라졌다: ${lost.slice(0, 4).join(', ')}`;
  if (a.length < b.length * (removal ? 0.25 : 0.45) && b.length > 400) return `정보량이 크게 줄었다 (${b.length}자 → ${a.length}자)`;
  const others = new Set(otherUnits.flatMap((u) => sentencesOf(u.text)).map((s) => s.replace(/\s/g, '')));
  const beforeSet = new Set(sentencesOf(before).map((s) => s.replace(/\s/g, '')));
  const newDup = sentencesOf(after).filter((s) => others.has(s.replace(/\s/g, '')) && !beforeSet.has(s.replace(/\s/g, '')));
  if (newDup.length) return `다른 절과 같은 문장이 새로 생겼다: "${newDup[0]!.slice(0, 40)}…"`;
  const codeTargets = issues.filter((i) => i.type === 'UNSUPPORTED_VALUE');
  if (codeTargets.length && codeTargets.every((i) => ca.unsupported.includes(i.exactSpan))) return `지적된 값이 그대로 남아 있다: ${codeTargets.map((i) => i.exactSpan).join(', ')}`;
  return null;
}

export async function reviseSections(input: LoopInput, units: Unit[], open: Issue[]): Promise<{ article: ArticleSections; outcome: RevisionOutcome }> {
  const ledger = ledgerOf(input.items, input.packetText);
  const article: ArticleSections = JSON.parse(JSON.stringify(input.article));
  const outcome: RevisionOutcome = { revised: [], rejected: [], skipped: [], resolvedIssueKeys: [], calls: 0, models: [] };
  const blocking = open.filter(isBlocking);
  const weight = (id: string) => blocking.filter((i) => i.sectionId === id).reduce((n, i) => n + (i.severity === 'CRITICAL' ? 10 : 3), 0);
  const targets = [...new Set(blocking.map((i) => i.sectionId))].sort((a, b) => weight(b) - weight(a)).slice(0, MAX_SECTIONS_PER_CYCLE);
  for (const u of units) if (!targets.includes(u.id)) outcome.skipped.push(u.id);
  if (targets.length === 0) return { article, outcome };

  const blocks = targets.map((id) => {
    const u = units.find((x) => x.id === id)!;
    const mine = open.filter((i) => i.sectionId === id && i.status === 'OPEN');
    const ev = input.items.filter((it) => mine.some((m) => m.evidenceIds.includes(it.id))).map((it) => `[${it.id}] ${it.title}\n${it.cleanedText.slice(0, 1200)}`).join('\n\n');
    const issuesText = mine.map((i) => `- ${i.issueKey} [${i.severity}] ${i.type} · 허용: ${i.allowedOperations.join('/')}\n  구절: "${i.exactSpan}"\n  문제: ${i.problem}\n  고칠 것: ${i.requiredChange}`).join('\n');
    const body = u.kind === 'section' ? u.h3Sections.map((h, i) => `[index ${i}] <h3>${h.h3}</h3>\n${h.content}`).join('\n\n') : u.text;
    return `===== [${u.id}] ${u.h2} =====\n--- 지적 ---\n${issuesText}\n${ev ? `--- 관련 근거 ---\n${ev}\n` : ''}--- 원문 ---\n${body}`;
  });
  const prompt = [EDITOR_RULES, '', `제목: ${input.title}`, `메인 키워드: ${input.mainKeyword}`, '', input.packetText.slice(0, 4500), '', ...blocks].join('\n');
  let parsed: any = null;
  try { parsed = readJson(await input.callModel(prompt, { json: true })); outcome.calls = 1; } catch (err: any) { if ((err as any)?.canceled) throw err; for (const id of targets) outcome.rejected.push({ sectionId: id, reason: `호출 실패: ${String(err?.message || err).slice(0, 60)}` }); return { article, outcome }; }
  if (input.modelOf) outcome.models.push(input.modelOf());
  const revisions: any[] = Array.isArray(parsed?.revisions) ? parsed.revisions : [];

  for (const sectionId of targets) {
    const u = units.find((x) => x.id === sectionId)!;
    const mine = open.filter((i) => i.sectionId === sectionId && i.status === 'OPEN');
    const rev = revisions.find((r) => String(r?.sectionId) === sectionId);
    if (!rev) { outcome.rejected.push({ sectionId, reason: '편집기가 이 절을 돌려주지 않음' }); continue; }
    let afterText = ''; let apply: () => void = () => {};
    if (u.kind === 'section') {
      /**
       * live 736-2: 프롬프트가 "[index 0] <h3>제목</h3>\n본문" 으로 보여 주니 편집기가 <h3> 까지 content 에 되돌려줬고,
       * 렌더가 소제목을 다시 붙여 두 번 → 다음 회차엔 세 번 찍혔다. h3 는 구조가 따로 들고 있으므로 content 의 <h3> 는 전부 걷어낸다.
       */
      const rows = (Array.isArray(rev.h3Sections) ? rev.h3Sections : []).map((r: any) => ({ index: Number(r?.index), content: String(r?.content || '').replace(/<h3\b[^>]*>[\s\S]*?<\/h3>\s*/gi, '').trim() })).filter((r: any) => Number.isInteger(r.index) && r.index >= 0 && r.index < u.h3Sections.length && r.content.trim());
      if (!rows.length) { outcome.rejected.push({ sectionId, reason: '고친 본문이 없음' }); continue; }
      const merged = u.h3Sections.map((h, i) => ({ ...h, content: rows.find((r: any) => r.index === i)?.content ?? h.content }));
      afterText = merged.map((h) => `<h3>${h.h3}</h3>${h.content}`).join('\n');
      const sIdx = Number(sectionId.slice(1)) - 1;
      apply = () => { article.sections[sIdx]!.h3Sections = merged; };
    } else {
      const content = String(rev.content || '').trim();
      if (!content) { outcome.rejected.push({ sectionId, reason: '고친 본문이 없음' }); continue; }
      afterText = content;
      apply = () => { if (u.kind === 'intro') article.introduction = content; else article.conclusion = content; };
    }
    const reason = guardRevision(u.text, afterText, ledger, units.filter((x) => x.id !== sectionId), mine);
    if (reason) { outcome.rejected.push({ sectionId, reason }); continue; }
    apply();
    outcome.revised.push(sectionId);
    outcome.resolvedIssueKeys.push(...(Array.isArray(rev.resolvedIssueKeys) ? rev.resolvedIssueKeys.map(String) : []));
  }
  return { article, outcome };
}

// ─── Final Judge — 관문 결과를 종합, 구체 blocker 없이는 BLOCK 못 한다 ──

const JUDGE_RULES = `당신은 최종 심사자입니다. 질문은 하나입니다: **"발행을 막아야 할 명백한 문제가 있는가?"**
아래 관문 결과가 이미 있습니다. 값 대조·근거 관문·지적 해결은 다시 판단하지 않습니다. 이 결과를 종합하고, 그 위에 **명백한** 문제가 남았을 때만 BLOCK 합니다.
BLOCK 사유는 각각 sectionId · 본문 원문 구절(exactSpan) · type(CONTRADICTION|MIXED_ENTITY|EXPIRED_AS_CURRENT|TITLE_PROMISE_UNMET|ANSWER_NEVER_GIVEN|REDUNDANCY|CTA_OFFTOPIC|SUMMARY_MISMATCH|FAQ_MISMATCH) · reason 이 있어야 합니다.
"더 좋아질 수 있다", "조금 더 다듬을 수 있다"는 BLOCK 사유가 아닙니다 — advisory 에 적으세요.
출력(JSON 객체 하나만): {"decision":"PASS|BLOCK","blockingIssues":[{"sectionId":"S02","exactSpan":"…","type":"…","reason":"…"}],"advisory":["…"]}`;

export async function runFinalJudge(input: {
  title: string; mainKeyword: string; article: ArticleSections; packetText: string; evidenceText: string; items: LoopInput['items'];
  faqText?: string; summaryText?: string; ctaText?: string; gateSummary?: string; callModel: CallModel; modelOf?: () => string; onLog?: (m: string) => void;
  /** v3.8.742 — 질문/답변을 따로 주면 FAQ 값 검사는 faq-fact-guard 와 같은 규칙(질문 값은 가정, 답변 값만 대조)을 쓴다 */
  faqItems?: Array<{ question: string; answer: string }>;
}): Promise<JudgeResult> {
  const ledger = ledgerOf(input.items, input.packetText);
  const units = sectionize(input.article);
  const blockers: JudgeBlocker[] = [];
  const t = checkClaims(input.title, ledger);
  for (const c of t.unsupported) blockers.push({ sectionId: 'TITLE', exactSpan: c, type: 'UNSUPPORTED_VALUE', reason: '제목의 값이 근거에 없다' });
  for (const u of units) for (const c of checkClaims(u.text, ledger).unsupported) blockers.push({ sectionId: u.id, exactSpan: c, type: 'UNSUPPORTED_VALUE', reason: '본문의 값이 근거에 없다' });
  /**
   * live 741(주담대): FAQ 질문 "주택담보대출 7억원에 금리 7%면 월 상환액은…?" 의 7억원(가정값)을 이 코드 검사가 근거 없다고 막았다 —
   * 68% 관문은 같은 값을 시나리오로 살렸는데 여기서 다른 잣대를 댔다. 항목이 오면 답변 값만 대조한다(faq-fact-guard 와 같은 규칙).
   */
  if (Array.isArray(input.faqItems)) {
    const { unsupportedAnswerValues } = require('./faq-fact-guard');
    for (const f of input.faqItems) for (const c of unsupportedAnswerValues(String(f.question || ''), String(f.answer || ''), ledger)) blockers.push({ sectionId: 'FAQ', exactSpan: c, type: 'UNSUPPORTED_VALUE', reason: 'FAQ 답변의 값이 근거에 없다' });
  } else if (input.faqText) for (const c of checkClaims(input.faqText, ledger).unsupported) blockers.push({ sectionId: 'FAQ', exactSpan: c, type: 'UNSUPPORTED_VALUE', reason: 'FAQ 의 값이 근거에 없다' });
  if (input.summaryText) for (const c of checkClaims(input.summaryText, ledger).unsupported) blockers.push({ sectionId: 'SUMMARY', exactSpan: c, type: 'UNSUPPORTED_VALUE', reason: '요약표의 값이 근거에 없다' });
  const repeats = findCrossSectionRepeats(units);
  if (repeats.length >= 3) blockers.push({ sectionId: repeats[0]!.sectionIds.join('+'), exactSpan: repeats[0]!.sentence, type: 'REDUNDANCY', reason: `절 사이 되풀이 문장 ${repeats.length}개` });

  const prompt = [
    JUDGE_RULES, '', `메인 키워드: ${input.mainKeyword}`, `제목: ${input.title}`, '',
    `===== 관문 결과 =====\n${input.gateSummary || '(없음)'}\n코드 값 대조: 근거 없는 값 ${blockers.filter((b) => b.type === 'UNSUPPORTED_VALUE').length}개`, '',
    input.packetText.slice(0, 4000), '',
    `===== 본문 =====\n${manuscriptFor(units, 2000)}`, '',
    ...(input.summaryText ? [`===== 요약표 =====\n${stripHtml(input.summaryText).slice(0, 1200)}`, ''] : []),
    ...(input.faqText ? [`===== FAQ =====\n${stripHtml(input.faqText).slice(0, 2000)}`, ''] : []),
    ...(input.ctaText ? [`===== CTA =====\n${stripHtml(input.ctaText).slice(0, 500)}`, ''] : []),
  ].join('\n');
  let parsed: any = null;
  try { parsed = readJson(await input.callModel(prompt, { json: true })); } catch (err: any) { if ((err as any)?.canceled) throw err; input.onLog?.(`⚖️ Final Judge 호출 실패: ${String(err?.message || err).slice(0, 80)}`); }
  const advisory: string[] = (Array.isArray(parsed?.advisory) ? parsed.advisory : []).map(String).slice(0, 6);
  const haystack = { TITLE: input.title, FAQ: input.faqText || '', SUMMARY: input.summaryText || '', CTA: input.ctaText || '' } as Record<string, string>;
  for (const b of Array.isArray(parsed?.blockingIssues) ? parsed.blockingIssues : []) {
    const sectionId = String(b?.sectionId || '').trim(); const span = String(b?.exactSpan || '').trim(); const type = String(b?.type || '').toUpperCase();
    const reason = String(b?.reason || '').trim();
    const text = haystack[sectionId] ?? units.find((u) => u.id === sectionId)?.text ?? '';
    const concrete = span.length >= 6 && text && flat(stripHtml(text)).includes(flat(span)) && type && reason.length >= 8 && !/UNSUPPORTED|근거\s*없/.test(`${type} ${reason}`);
    if (concrete) blockers.push({ sectionId, exactSpan: span.slice(0, 200), type, reason: reason.slice(0, 200) });
    else advisory.push(`(구체 구절 없음 · 참고) ${reason || type}`.slice(0, 200));
  }
  return { decision: blockers.length ? 'BLOCK' : 'PASS', blockingIssues: blockers, advisory, ...(input.modelOf ? { model: input.modelOf() } : {}) };
}

// ─── 루프 ─────────────────────────────────────────────────────

export async function runCritiqueLoop(input: LoopInput): Promise<{ article: ArticleSections; title: string; report: LoopReport }> {
  const maxRevisions = input.maxRevisions ?? 2;
  let article: ArticleSections = JSON.parse(JSON.stringify(input.article));
  let title = input.title;
  let packetText = input.packetText; let evidenceText = input.evidenceText; let items = input.items;
  const report: LoopReport = {
    criticCycles: 0, revisionCycles: 0, qualityLoopCalls: 0, critic1: null, verifications: [], verificationContexts: [], editorial: null, revisions: [], issueLedger: [],
    titleIssues: [], titleRevision: null, researchRounds: 0, researchRecovery: null, converged: false, open: { critical: 0, major: 0, minor: 0, pending: 0 }, unchangedSections: 0, revisedSections: 0, totalSections: 0,
    models: { critic1: '', revision: [], verify: [], editorial: '' }, manualReviewReason: '',
  };
  const ledgerIssues = new Map<string, Issue>();
  const revisedIds = new Set<string>();
  const log = (m: string) => input.onLog?.(m);
  const ctx = (): LoopInput => ({ ...input, title, article, packetText, evidenceText, items });
  const upsert = (issues: Issue[]) => { for (const i of issues) { const prev = ledgerIssues.get(i.issueKey); if (prev && prev.status === 'RESOLVED') { ledgerIssues.set(i.issueKey, { ...i, status: 'REGRESSED' }); } else if (!prev) ledgerIssues.set(i.issueKey, i); } };
  const openIssues = () => [...ledgerIssues.values()].filter((i) => i.status === 'OPEN' || i.status === 'REGRESSED');
  const openBlocking = () => openIssues().filter((i) => i.severity !== 'MINOR');
  const pendingIssues = () => [...ledgerIssues.values()].filter((i) => i.status === 'PENDING_VERIFICATION');
  const originalUnits = sectionize(article);
  const sectionText = (units: Unit[], id: string) => stripHtml(units.find((u) => u.id === id)?.text || '');
  /** 코드 지적은 코드가 다시 재서 풀렸는지 정한다 — 모델의 "풀렸다"는 참고일 뿐 */
  const settleCodeIssues = (units: Unit[]) => {
    const ledger = ledgerOf(items, packetText);
    const now = new Set(codeGate(units, ledger).map((i) => i.issueKey));
    for (const i of ledgerIssues.values()) if (i.origin === 'code' && (i.status === 'OPEN' || i.status === 'REGRESSED') && !now.has(i.issueKey)) i.status = 'RESOLVED';
  };

  let units = sectionize(article);
  report.totalSections = units.length;

  // ① 코드 관문 + Critic 1
  upsert(codeGate(units, ledgerOf(items, packetText)));
  let critic1 = await runCritic1(ctx(), units);
  report.qualityLoopCalls += 1; report.criticCycles += 1; report.critic1 = critic1; report.models.critic1 = critic1.model || '';
  /**
   * ①-a Research Recovery — **편집보다 검색이 먼저.** (v3.8.746)
   * live 742(주담대): Critic 이 NEEDS_MORE_RESEARCH + "한국은행 기준금리 2026년 9월" 을 냈는데 blocking 지적이 함께 있어 검색 없이 편집으로 갔다.
   * 편집기는 문장만 두 번 바꿨고 검증은 두 번 다 "근거가 패킷에 없다" → 호출 2회 낭비 뒤 MANUAL_REVIEW. 문제는 문장이 아니라 근거였다.
   * 이제 요청이 있으면 blocking 여부와 무관하게 기존 검색 경로(moreResearch: 검색 → CLEAN → 관련도 관문 → 패킷 갱신)를 한 번 타고 Critic 1 을 다시 돈다.
   * 한 글에 한 번뿐(무한 검색 금지). 보강 뒤에도 요구하면 기존 정책대로 간다(blocking 남으면 편집, 아니면 편집 비평·심사).
   */
  if (critic1.researchRequested && input.moreResearch && report.researchRounds < 1) {
    const blockingOf = (c: CriticResult) => c.issues.filter(isBlocking);
    const summarize = (c: CriticResult) => ({ status: c.researchRequested && c.status !== 'NEEDS_MORE_RESEARCH' ? `${c.status}+RESEARCH` : c.status, blocking: blockingOf(c).length, critical: blockingOf(c).filter((i) => i.severity === 'CRITICAL').length, major: blockingOf(c).filter((i) => i.severity === 'MAJOR').length });
    const usd0 = input.usageUsd ? input.usageUsd() : 0;
    const before = summarize(critic1);
    const itemsBefore = items.length;
    report.researchRounds = 1;
    log(`🔎 비평이 근거 부족을 알렸습니다 (blocking ${before.blocking}) → 편집보다 먼저 검색으로 되돌아갑니다: ${critic1.researchQueries.join(' / ')}`);
    const more = await input.moreResearch(critic1.researchQueries);
    const recovery: ResearchRecovery = { triggered: true, queries: critic1.researchQueries, searchCount: critic1.researchQueries.length, evidenceAdded: 0, criticBefore: before, criticAfter: null, editorCallsSaved: 0, recoveryCalls: 0, recoveryCost: 0, stillRequested: false };
    if (more) {
      packetText = more.packetText; evidenceText = more.evidenceText; items = more.items;
      recovery.evidenceAdded = Math.max(0, items.length - itemsBefore);
      critic1 = await runCritic1(ctx(), units);
      report.qualityLoopCalls += 1; report.criticCycles += 1; report.critic1 = critic1; recovery.recoveryCalls = 1;
      recovery.criticAfter = summarize(critic1);
      recovery.stillRequested = !!critic1.researchRequested;
      recovery.editorCallsSaved = before.blocking > 0 && recovery.criticAfter.blocking === 0 ? 1 : 0;
      log(`🔎 보강 검색 뒤 재비평: 근거 +${recovery.evidenceAdded} · blocking ${before.blocking} → ${recovery.criticAfter.blocking}${recovery.editorCallsSaved ? ' · 편집 호출 1회 절약' : ''}${recovery.stillRequested ? ' · 여전히 근거 부족(상한 1회라 더 검색하지 않음)' : ''}`);
    } else {
      recovery.stillRequested = true;
      log('🔎 보강 검색에서 관련 근거를 더 찾지 못했습니다 — 기존 근거로 계속 갑니다(재검색 없음)');
    }
    recovery.recoveryCost = input.usageUsd ? Number((input.usageUsd() - usd0).toFixed(4)) : 0;
    report.researchRecovery = recovery;
  }
  upsert(critic1.issues);
  report.titleIssues.push(...critic1.titleIssues);
  log(`🩺 Critic 1: 코드 관문 ${[...ledgerIssues.values()].filter((i) => i.origin === 'code').length} · 모델 지적 ${critic1.issues.length}(버림 ${critic1.rejectedIssues.length}) → OPEN critical ${openBlocking().filter((i) => i.severity === 'CRITICAL').length} · major ${openBlocking().filter((i) => i.severity === 'MAJOR').length}`);

  /**
   * ①-b 제목 수정 — **본문 편집·검증보다 먼저.** (v3.8.738)
   * live 737 3회차: 제목 수정이 루프 뒤에 돌아 검증 비평이 옛 제목("공식 확인")을 보고 stillOpen 이라 했다.
   * 호출자가 제목을 다시 짓고 Title Fact Gate 를 지난다(기존 호출을 옮긴 것 — 호출 수 그대로). PASS 가 아니면 옛 제목 유지.
   */
  if (critic1.titleIssues.length > 0 && input.reviseTitle) {
    try {
      const rt = await input.reviseTitle(critic1.titleIssues);
      if (rt && rt.title && rt.title !== title) {
        report.titleRevision = { from: title, to: rt.title, pass: rt.pass };
        if (rt.pass) { log(`✍️ 제목 수정(검증 전): "${title}" → "${rt.title}" (사실 관문 PASS)`); title = rt.title; }
        else log(`✍️ 제목 수정안이 사실 관문을 못 지나 옛 제목을 유지합니다: "${rt.title}"`);
      }
    } catch (err: any) { if ((err as any)?.canceled) throw err; log(`✍️ 제목 수정 실패 — 옛 제목 유지: ${String(err?.message || err).slice(0, 80)}`); }
  }

  // ② 수정 → 검증 (최대 maxRevisions)
  while (openBlocking().length > 0 && report.revisionCycles < maxRevisions) {
    report.revisionCycles += 1;
    const { article: next, outcome } = await reviseSections(ctx(), units, openIssues());
    report.qualityLoopCalls += outcome.calls; report.revisions.push(outcome); report.models.revision.push(...outcome.models);
    outcome.revised.forEach((id) => revisedIds.add(id));
    log(`✏️ 수정 ${report.revisionCycles}회차 (호출 ${outcome.calls}): 고친 절 ${outcome.revised.join(', ') || '없음'}${outcome.rejected.length ? ` · 되돌림 ${outcome.rejected.map((r) => `${r.sectionId}(${r.reason})`).join(', ')}` : ''} · 손대지 않은 절 ${outcome.skipped.length}`);
    if (outcome.revised.length === 0) { report.manualReviewReason = '편집기의 수정이 하나도 채택되지 않음'; break; }
    article = next; units = sectionize(article);
    settleCodeIssues(units);
    /**
     * 검증은 **이번에 실제로 바뀐 절의 지적**만 묻는다. live 736-1: S05 수정이 관문에서 되돌려졌는데 검증 비평이 S00 만 보고도
     * S05 지적을 "풀렸다"고 답해 루프가 수렴이라 했다(가짜 수렴). 바뀌지 않은 절의 지적은 풀릴 수 없다 — OPEN 으로 남겨 다음 회차가 다시 고친다.
     *
     * v3.8.738 — 편집기 자가 신고(resolvedIssueKeys)는 **시도의 기록**일 뿐이다. 고친 절의 모델 지적은 PENDING_VERIFICATION 이 되고,
     * 검증 비평의 resolved 만 RESOLVED 로, stillOpen(또는 언급 없음)은 OPEN 으로 되돌린다. 검증이 안 돌면 PENDING 이 남아 수렴하지 못한다.
     */
    const pendingModel = openIssues().filter((i) => i.origin !== 'code' && outcome.revised.includes(i.sectionId));
    for (const i of pendingModel) i.status = 'PENDING_VERIFICATION';
    if (pendingModel.length) {
      report.verificationContexts.push({
        cycle: report.revisionCycles, originalTitle: input.title, currentTitle: title,
        issues: pendingModel.map((i) => ({ issueKey: i.issueKey, sectionId: i.sectionId, originalSection: sectionText(originalUnits, i.sectionId), currentSection: sectionText(units, i.sectionId) })),
      });
      const v = await runVerification(ctx(), units, pendingModel, revisedIds);
      report.qualityLoopCalls += 1; report.criticCycles += 1; report.verifications.push(v.result); if (v.result.model) report.models.verify.push(v.result.model);
      const verified = !!readJson(v.result.raw || '');   // 호출 실패·깨진 JSON 이면 판정 없음 → PENDING 그대로(수렴 불가)
      if (verified) for (const i of pendingModel) i.status = v.resolved.has(i.issueKey) ? 'RESOLVED' : 'OPEN';
      upsert(v.result.issues);
      log(`🔍 검증 비평: 풀림 ${[...v.resolved].length} · 남음 ${pendingModel.filter((i) => i.status === 'OPEN').length} · 수정이 만든 새 CRITICAL ${v.result.issues.filter((i) => i.severity === 'CRITICAL').length}`);
    }
    // 수정한 절의 코드 지적이 새로 생겼을 수 있다(REGRESSED 포함)
    upsert(codeGate(units, ledgerOf(items, packetText)));
  }
  if (openBlocking().length > 0 && !report.manualReviewReason) {
    report.manualReviewReason = `수정 ${report.revisionCycles}회 뒤에도 OPEN critical ${openBlocking().filter((i) => i.severity === 'CRITICAL').length} · major ${openBlocking().filter((i) => i.severity === 'MAJOR').length}`;
  }

  // ③ 편집 비평 — 사실 쪽이 깨끗할 때만, MAJOR 만 한 번 고친다(수정 상한 안에서)
  if (openBlocking().length === 0) {
    const ed = await runEditorialCritic(ctx(), units);
    report.qualityLoopCalls += 1; report.criticCycles += 1; report.editorial = ed; report.models.editorial = ed.model || '';
    upsert(ed.issues);
    const edBlocking = ed.issues.filter(isBlocking);
    log(`🩺 편집 비평: major ${edBlocking.length} · minor ${ed.issues.length - edBlocking.length}(버림 ${ed.rejectedIssues.length})`);
    if (edBlocking.length && report.revisionCycles < maxRevisions) {
      report.revisionCycles += 1;
      const { article: next, outcome } = await reviseSections(ctx(), units, openIssues());
      report.qualityLoopCalls += outcome.calls; report.revisions.push(outcome); report.models.revision.push(...outcome.models);
      outcome.revised.forEach((id) => revisedIds.add(id));
      log(`✏️ 편집 수정 (호출 ${outcome.calls}): 고친 절 ${outcome.revised.join(', ') || '없음'}${outcome.rejected.length ? ` · 되돌림 ${outcome.rejected.map((r) => r.sectionId).join(', ')}` : ''}`);
      if (outcome.revised.length) {
        article = next; units = sectionize(article);
        /**
         * v3.8.738 — 절이 바뀌었다는 것만으로 풀린 게 아니다. 편집 지적은 검증 호출을 따로 두지 않으므로(호출 수 유지) 코드가 잰다:
         * 지적한 구절이 그 절에서 사라졌으면 RESOLVED, 그대로면 PENDING_VERIFICATION(수렴 불가 → MANUAL_REVIEW).
         */
        for (const i of edBlocking) {
          if (!outcome.revised.includes(i.sectionId)) continue;
          const stillThere = i.exactSpan.length >= 6 && flat(sectionText(units, i.sectionId)).includes(flat(i.exactSpan));
          i.status = stillThere ? 'PENDING_VERIFICATION' : 'RESOLVED';
        }
        settleCodeIssues(units);
        upsert(codeGate(units, ledgerOf(items, packetText)));
      }
    }
    if (openBlocking().length > 0) report.manualReviewReason = `편집 문제 ${openBlocking().length}개가 남음: ${openBlocking().map((i) => i.type).join(', ')}`;
  }

  report.issueLedger = [...ledgerIssues.values()];
  report.open = {
    critical: openBlocking().filter((i) => i.severity === 'CRITICAL').length,
    major: openBlocking().filter((i) => i.severity === 'MAJOR').length,
    minor: openIssues().filter((i) => i.severity === 'MINOR').length,
    pending: pendingIssues().filter((i) => i.severity !== 'MINOR').length,
  };
  report.revisedSections = revisedIds.size;
  report.unchangedSections = Math.max(0, report.totalSections - revisedIds.size);
  // 검증이 확인하지 않은 blocking 지적(PENDING_VERIFICATION)이 하나라도 있으면 수렴이 아니다
  report.converged = report.open.critical === 0 && report.open.major === 0 && report.open.pending === 0;
  if (report.converged) report.manualReviewReason = '';
  else if (!report.manualReviewReason && report.open.pending > 0) report.manualReviewReason = `검증되지 않은 수정 ${report.open.pending}건 (PENDING_VERIFICATION)`;
  return { article, title, report };
}
