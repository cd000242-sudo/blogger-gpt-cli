/**
 * 🔁 비평·수정 루프 — 사람이 GPTs 에서 하는 "초안 → 비평 → 고치기 → 다시 비평 → 이제 됐다" 를 프로그램으로. (v3.8.735)
 *
 * ## 역할을 나눈다
 *   Writer(초안)는 이 모듈 밖이다. 여기에는 넷이 있다.
 *   · Critic 1 — 사실·검색 의도·정보 밀도만 공격적으로 본다. 칭찬하지 않는다.
 *   · Editor  — 문제가 있는 **절만** 고친다. 문제 없는 절은 손대지 않는다.
 *   · Critic 2 — 사람이 읽는 글로서의 품질(도입·반복·빈 문장·순서).
 *   · Final Judge — 질문은 하나. "이대로 발행해도 되는가." 새 아이디어를 내지 않는다.
 *
 * ## 지어내지 못하게
 *   · 비평의 모든 지적은 절 id(S01…)와 근거 id(E01…)를 단다. 없는 id 를 달면 그 지적은 버린다.
 *   · "정보 누락" 지적은 근거 id 가 있어야 산다 — 근거에 없는 정보를 넣으라는 지적은 지어내라는 말이다.
 *   · 고친 절은 값 대조(fact-claims)를 다시 지난다. 새로 근거 없는 값이 생기면 그 수정은 버린다.
 *   · 사실이 모자라면 비평이 상상하지 않고 NEEDS_MORE_RESEARCH 를 돌려준다 — 검색으로 되돌아간다.
 *
 * ## 무한 반복하지 않는다
 *   수정은 최대 3회. Critical·Major 가 0 이면 그 자리에서 끝난다(비평 횟수를 채우려고 고치지 않는다).
 *   3회 뒤에도 남으면 MANUAL_REVIEW — 자동 발행하지 않는다.
 */

import { checkClaims, ledgerFromItems, norm, type LedgerItem, type ClaimCheck } from './fact-claims';

// ─── 형 ──────────────────────────────────────────────────────

export interface H3Section { h3: string; content: string; tables?: any[]; [k: string]: any }
export interface ArticleSections {
  introduction: string;
  conclusion: string;
  sections: Array<{ h2: string; h3Sections: H3Section[]; [k: string]: any }>;
  [k: string]: any;
}

export type IssueSeverity = 'critical' | 'major' | 'minor';
export interface CriticIssue {
  id: string;
  sectionId: string;
  severity: IssueSeverity;
  type: string;
  problem: string;
  evidenceIds: string[];
  requiredChange: string;
  origin: 'code' | 'critic1' | 'critic2';
}

export interface CriticResult {
  status: 'PASS' | 'REVISION_REQUIRED' | 'NEEDS_MORE_RESEARCH';
  criticalIssues: CriticIssue[];
  majorIssues: CriticIssue[];
  minorIssues: CriticIssue[];
  unsupportedClaims: Array<{ sectionId: string; claim: string }>;
  missingIntentAnswers: string[];
  titleIssues: Array<{ problem: string; requiredChange: string }>;
  researchQueries: string[];
  revisionRequired: boolean;
  model?: string;
  raw?: string;
}

export interface RevisionOutcome {
  revised: string[];
  rejected: Array<{ sectionId: string; reason: string }>;
  skipped: string[];
  resolvedIssueIds: string[];
  models: string[];
}

export interface JudgeResult {
  decision: 'PASS' | 'FAIL';
  blockingIssues: string[];
  unsupportedClaims: string[];
  llmUnsupportedClaims?: string[];
  searchIntentCovered: boolean;
  titlePromiseResolved: boolean;
  majorRedundancy: boolean;
  anotherRevisionWouldMateriallyImprove: boolean;
  model?: string;
}

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
  /** 사실이 모자랄 때 검색으로 되돌아간다 — 갱신된 패킷·근거를 돌려준다. 없으면 그냥 진행 */
  moreResearch?: (queries: string[]) => Promise<{ packetText: string; evidenceText: string; items: LoopInput['items'] } | null>;
  /** 이번 호출에서 실제로 쓴 모델 이름을 돌려준다(장부용) */
  modelOf?: () => string;
  maxRevisions?: number;
}

export interface LoopReport {
  criticCycles: number;
  revisionCycles: number;
  critic1: CriticResult[];
  critic2: CriticResult | null;
  revisions: RevisionOutcome[];
  titleIssues: Array<{ problem: string; requiredChange: string }>;
  researchRounds: number;
  converged: boolean;
  remaining: { critical: number; major: number; minor: number };
  unchangedSections: number;
  revisedSections: number;
  totalSections: number;
  models: { critic1: string[]; revision: string[]; critic2: string };
  manualReviewReason: string;
}

// ─── 절 나누기 ───────────────────────────────────────────────

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

/** 비평용 원고 — 태그를 걷고 절 id 를 단다 */
export function manuscriptFor(units: Unit[], maxCharsPerUnit = 2600): string {
  return units.map((u) => `[${u.id}] ${u.kind === 'section' ? `## ${u.h2}` : u.h2}\n${stripHtml(u.text).slice(0, maxCharsPerUnit)}`).join('\n\n');
}

const sentencesOf = (text: string): string[] => stripHtml(text).split(/(?<=[.!?。])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 22);

/** 절끼리 같은 문장을 되풀이하는가 — 코드가 먼저 잡는다(모델이 못 보거나 봐주는 종류) */
export function findCrossSectionRepeats(units: Unit[]): Array<{ sentence: string; sectionIds: string[] }> {
  const where = new Map<string, Set<string>>();
  for (const u of units) for (const s of new Set(sentencesOf(u.text))) {
    const key = s.replace(/\s/g, '');
    if (!where.has(key)) where.set(key, new Set());
    where.get(key)!.add(u.id);
  }
  return [...where.entries()].filter(([, ids]) => ids.size >= 2).map(([key, ids]) => ({ sentence: key.slice(0, 60), sectionIds: [...ids] }));
}

// ─── 공통: JSON 읽기 ─────────────────────────────────────────

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

// ─── Critic 1 — 사실·의도·밀도 ────────────────────────────────

const CRITIC1_RULES = `당신은 검수자입니다. 칭찬하지 않습니다. 글을 예쁘게 다듬는 일도 하지 않습니다. 아래 셋만 봅니다.
A. FACT — 근거(Research Packet·FACT EVIDENCE)에 없는 날짜·금액·비율·조건·발언, 옛 회차와 새 회차의 혼합, 패킷과 다른 값, 출처에서 확인 안 되는 단정.
B. SEARCH INTENT — 검색자의 핵심 질문에 답했는가, 가장 중요한 답이 너무 뒤에 있는가, 제목이 약속한 것을 본문이 푸는가, 중요한 조건이 빠졌는가, 다 읽고도 다시 검색해야 할 것이 남는가.
C. INFORMATION DENSITY — 근거에 있는데 빠진 핵심 정보(반드시 그 근거 id 를 적을 것), 덜 중요한 설명이 중요한 정보보다 긴 곳, 같은 사실의 반복.

규칙
- 모든 지적에 sectionId(원고의 [S..])를 답니다. 정보 누락(missing_information)은 evidenceIds 에 그 정보가 있는 근거 id([E..])를 반드시 답니다. 근거에 없는 정보를 넣으라고 하지 마세요 — 그건 지어내라는 말입니다.
- "근거 없음"은 **구체적인 사실**(값·조건·기관 발표·상품 조건·발언)에만 씁니다. 개념 설명·판단 기준·일반적인 권고("여력이 빠듯하면 고정형")는 근거 없이도 쓸 수 있는 글쓴이의 해석이라 지적 대상이 아닙니다.
- 이미 지적해 고쳐진 뒤의 원고라면 남은 문제만 적습니다. 같은 지적을 되풀이하지 마세요.
- severity: critical = 사실 오류·근거 없는 값·정책과 반대·제목 핵심 약속 미해결·다른 대상 혼입 / major = 핵심 정보 누락·의도 일부 미충족·답 위치가 너무 뒤·동일 내용 반복·밀도 낮은 절·제목과 본문 초점 차이 / minor = 문장 다듬기 수준. 취향 차이를 문제로 만들지 마세요.
- 제목 자체의 문제는 titleIssues 에 따로 적습니다(본문 지적으로 섞지 마세요).
- 근거가 모자라 판단할 수 없으면 status 를 NEEDS_MORE_RESEARCH 로 하고 researchQueries 에 찾아야 할 검색어(메인 키워드 포함)를 적습니다. 사실을 상상하지 마세요.
- 문제가 없으면 status PASS 와 빈 배열. 없는 문제를 만들지 마세요.

출력(JSON 객체 하나만):
{"status":"PASS|REVISION_REQUIRED|NEEDS_MORE_RESEARCH",
 "issues":[{"id":"M01","sectionId":"S03","severity":"critical|major|minor","type":"unsupported_claim|missing_information|intent_gap|answer_too_late|redundancy|mixed_timeline|low_density|focus_mismatch|other","problem":"…","evidenceIds":["E02"],"requiredChange":"…"}],
 "unsupportedClaims":[{"sectionId":"S02","claim":"…"}],
 "missingIntentAnswers":["…"],
 "titleIssues":[{"problem":"…","requiredChange":"…"}],
 "researchQueries":[]}`;

function validIssue(x: any, unitIds: Set<string>, itemIds: Set<string>, origin: CriticIssue['origin'], idx: number): CriticIssue | null {
  const sectionId = String(x?.sectionId || '').trim();
  const severity = String(x?.severity || '').toLowerCase() as IssueSeverity;
  if (!unitIds.has(sectionId)) return null;
  if (!['critical', 'major', 'minor'].includes(severity)) return null;
  const evidenceIds = [...new Set((Array.isArray(x?.evidenceIds) ? x.evidenceIds : []).map(String))].filter((id) => itemIds.has(id as string)) as string[];
  const type = String(x?.type || 'other').slice(0, 40);
  if (type === 'missing_information' && evidenceIds.length === 0) return null;   // 근거 없는 "넣어라"는 버린다
  const problem = String(x?.problem || '').trim();
  const requiredChange = String(x?.requiredChange || '').trim();
  if (problem.length < 6) return null;
  /**
   * 모델이 매기는 critical 은 좁게 받는다(실측: 한 회차에 critical 9개, 세 번 고쳐도 남음).
   *   · critical 로 남는 것: 근거 없는 **구체 값**(숫자·%·날짜가 지적문에 있음) · 시점 혼합 · 다른 대상 혼입
   *   · "판단·권고가 근거에 없다" 같은 일반 설명 지적은 major — Writer 는 일반 설명을 써도 된다
   */
  let sev: IssueSeverity = severity;
  if (sev === 'critical') {
    const concrete = /\d/.test(problem) || type === 'mixed_timeline' || type === 'focus_mismatch';
    if (!concrete) sev = 'major';
  }
  return { id: String(x?.id || `${origin === 'critic2' ? 'Q' : 'M'}${String(idx + 1).padStart(2, '0')}`), sectionId, severity: sev, type, problem: problem.slice(0, 300), evidenceIds, requiredChange: requiredChange.slice(0, 300), origin };
}

/** 코드가 먼저 잡는 것: 근거 없는 값(critical) · 절 사이 되풀이 문장(major) */
export function codeCritique(units: Unit[], ledger: LedgerItem[]): { issues: CriticIssue[]; unsupported: Array<{ sectionId: string; claim: string }> } {
  const issues: CriticIssue[] = [];
  const unsupported: Array<{ sectionId: string; claim: string }> = [];
  let n = 0;
  for (const u of units) {
    const check: ClaimCheck = checkClaims(u.text, ledger);
    if (check.unsupported.length) {
      for (const c of check.unsupported) unsupported.push({ sectionId: u.id, claim: c });
      issues.push({ id: `C${String(++n).padStart(2, '0')}`, sectionId: u.id, severity: 'critical', type: 'unsupported_claim', problem: `근거에 없는 값: ${check.unsupported.map((c) => `"${c}"`).join(', ')}`, evidenceIds: [], requiredChange: '이 값을 지우거나 Research Packet 에 있는 값으로 바꾸세요. 새 값을 만들지 마세요.', origin: 'code' });
    }
  }
  const repeats = findCrossSectionRepeats(units);
  const byLater = new Map<string, string[]>();
  for (const r of repeats) { const later = r.sectionIds.sort()[r.sectionIds.length - 1]!; if (!byLater.has(later)) byLater.set(later, []); byLater.get(later)!.push(r.sentence); }
  for (const [sectionId, sentences] of byLater) {
    issues.push({ id: `C${String(++n).padStart(2, '0')}`, sectionId, severity: 'major', type: 'redundancy', problem: `앞 절과 같은 문장 ${sentences.length}개: "${sentences[0]}…"`, evidenceIds: [], requiredChange: '앞 절에서 이미 말한 문장을 지우고, 이 절만의 정보로 채우거나 짧게 끝내세요.', origin: 'code' });
  }
  return { issues, unsupported };
}

export async function runCritic1(input: LoopInput, units: Unit[]): Promise<CriticResult> {
  const ledger = ledgerOf(input.items, input.packetText);
  const unitIds = new Set(units.map((u) => u.id));
  const itemIds = new Set(input.items.map((i) => i.id));
  const code = codeCritique(units, ledger);
  const prompt = [
    CRITIC1_RULES, '',
    `메인 키워드: ${input.mainKeyword}`, `제목: ${input.title}`, '',
    input.packetText.slice(0, 6000), '',
    `===== FACT EVIDENCE =====\n${input.evidenceText.slice(0, 8000)}`, '',
    `===== 원고 =====\n${manuscriptFor(units)}`,
  ].join('\n');
  let parsed: any = null; let raw = '';
  try { raw = await input.callModel(prompt, { json: true }); parsed = readJson(raw); } catch (err: any) { input.onLog?.(`🩺 Critic 1 호출 실패: ${String(err?.message || err).slice(0, 80)}`); if ((err as any)?.canceled) throw err; }
  const llmIssues: CriticIssue[] = (Array.isArray(parsed?.issues) ? parsed.issues : []).map((x: any, i: number) => validIssue(x, unitIds, itemIds, 'critic1', i)).filter(Boolean);
  const all = [...code.issues, ...llmIssues];
  const status = String(parsed?.status || '').toUpperCase();
  const researchQueries = (Array.isArray(parsed?.researchQueries) ? parsed.researchQueries : []).map(String).filter((q: string) => q.trim().length >= 2).slice(0, 3);
  const result: CriticResult = {
    status: all.some((i) => i.severity !== 'minor') ? 'REVISION_REQUIRED' : (status === 'NEEDS_MORE_RESEARCH' && researchQueries.length ? 'NEEDS_MORE_RESEARCH' : 'PASS'),
    criticalIssues: all.filter((i) => i.severity === 'critical'),
    majorIssues: all.filter((i) => i.severity === 'major'),
    minorIssues: all.filter((i) => i.severity === 'minor'),
    unsupportedClaims: [...code.unsupported, ...((Array.isArray(parsed?.unsupportedClaims) ? parsed.unsupportedClaims : []).filter((c: any) => unitIds.has(String(c?.sectionId))).map((c: any) => ({ sectionId: String(c.sectionId), claim: String(c.claim || '').slice(0, 120) })))],
    missingIntentAnswers: (Array.isArray(parsed?.missingIntentAnswers) ? parsed.missingIntentAnswers : []).map(String).slice(0, 8),
    titleIssues: (Array.isArray(parsed?.titleIssues) ? parsed.titleIssues : []).filter((t: any) => t?.problem).map((t: any) => ({ problem: String(t.problem).slice(0, 200), requiredChange: String(t.requiredChange || '').slice(0, 200) })).slice(0, 3),
    researchQueries,
    revisionRequired: all.some((i) => i.severity !== 'minor'),
    ...(input.modelOf ? { model: input.modelOf() } : {}),
    raw: raw.slice(0, 4000),
  };
  if (status === 'NEEDS_MORE_RESEARCH' && researchQueries.length && !result.revisionRequired) result.status = 'NEEDS_MORE_RESEARCH';
  return result;
}

// ─── Critic 2 — 읽는 글로서의 품질 ────────────────────────────

const CRITIC2_RULES = `당신은 편집자입니다. 사실 검사는 이미 끝났습니다. 사람이 읽는 글로서의 품질만 봅니다.
- 첫 2~3문단에서 읽을 이유가 생기는가 · 도입이 검색자의 문제로 바로 들어가는가 · 핵심 답을 일부러 끄는가
- 소제목끼리 같은 이야기를 되풀이하는가 · 추상적인 연결문이 과한가 · "중요합니다·살펴보겠습니다·알아보겠습니다" 같은 빈 문장의 반복
- 문단 길이·구조가 지나치게 똑같은가 · 정보 없이 문장 수만 늘린 구간 · 앞에서 준 숫자를 뒤에서 되풀이 · 결론을 여러 번 반복
- 정보 → 해석 → 독자 행동으로 이어지는가 · 검색자가 궁금한 순서로 읽히는가
규칙: 새로운 사실을 넣으라고 하지 마세요(근거 밖의 정보는 금지). 취향 차이를 문제로 만들지 마세요. "더 자연스럽게" 같은 뭉뚱그린 지적은 쓰지 마세요 — 어느 문장이 왜 문제인지 적으세요.
severity: major = 도입 실패·절 간 반복·정보 없는 구간·순서 문제처럼 읽기 품질을 실제로 떨어뜨리는 것 / minor = 문장 다듬기.
출력(JSON 객체 하나만): {"status":"PASS|REVISION_REQUIRED","issues":[{"id":"Q01","sectionId":"S02","severity":"major|minor","type":"weak_intro|redundancy|empty_phrases|uniform_structure|padding|repeated_numbers|repeated_conclusion|order","problem":"…","evidenceIds":[],"requiredChange":"…"}]}`;

const EMPTY_PHRASES = /(알아보겠습니다|살펴보겠습니다|살펴보도록\s*하겠습니다|중요합니다|도움이\s*되셨길|정리해\s*보겠습니다|확인해\s*보시기\s*바랍니다)/g;

export async function runCritic2(input: LoopInput, units: Unit[]): Promise<CriticResult> {
  const unitIds = new Set(units.map((u) => u.id));
  const itemIds = new Set(input.items.map((i) => i.id));
  const code: CriticIssue[] = [];
  let n = 0;
  for (const u of units) {
    const hits = (stripHtml(u.text).match(EMPTY_PHRASES) || []).length;
    if (hits >= 3) code.push({ id: `Q${String(++n).padStart(2, '0')}`, sectionId: u.id, severity: 'major', type: 'empty_phrases', problem: `빈 문장 ${hits}개 (알아보겠습니다·중요합니다 류)`, evidenceIds: [], requiredChange: '빈 문장을 지우고 정보가 있는 문장만 남기세요. 분량은 줄어도 됩니다.', origin: 'code' });
  }
  const prompt = [CRITIC2_RULES, '', `메인 키워드: ${input.mainKeyword}`, `제목: ${input.title}`, '', `===== 원고 =====\n${manuscriptFor(units, 3000)}`].join('\n');
  let parsed: any = null; let raw = '';
  try { raw = await input.callModel(prompt, { json: true }); parsed = readJson(raw); } catch (err: any) { input.onLog?.(`🩺 Critic 2 호출 실패: ${String(err?.message || err).slice(0, 80)}`); if ((err as any)?.canceled) throw err; }
  const llm: CriticIssue[] = (Array.isArray(parsed?.issues) ? parsed.issues : []).map((x: any, i: number) => validIssue({ ...x, severity: String(x?.severity || 'minor').toLowerCase() === 'critical' ? 'major' : x?.severity }, unitIds, itemIds, 'critic2', i + n)).filter(Boolean);
  const all = [...code, ...llm];
  return {
    status: all.some((i) => i.severity === 'major') ? 'REVISION_REQUIRED' : 'PASS',
    criticalIssues: [], majorIssues: all.filter((i) => i.severity === 'major'), minorIssues: all.filter((i) => i.severity === 'minor'),
    unsupportedClaims: [], missingIntentAnswers: [], titleIssues: [], researchQueries: [],
    revisionRequired: all.some((i) => i.severity === 'major'),
    ...(input.modelOf ? { model: input.modelOf() } : {}),
    raw: raw.slice(0, 3000),
  };
}

// ─── Editor — 문제 있는 절만 ──────────────────────────────────

const EDITOR_RULES = `당신은 교정자입니다. **지적된 절 하나만** 고칩니다. 다른 절은 보이지 않습니다.
- 지적된 문제만 고칩니다. 문제없는 문장은 그대로 둡니다(새로 쓰지 않습니다).
- 값(날짜·금액·비율·조건)은 Research Packet·근거에 글자로 있는 것만 씁니다. 새 값을 만들지 마세요. 근거 없는 값을 지우라는 지적이면 그 값을 지우고 문장을 자연스럽게 잇습니다.
- 앞 절에서 이미 말한 내용을 되풀이하지 않습니다. 분량은 줄어도 됩니다.
- HTML 태그(<p>, <ul>, <table> 등)는 원문 그대로의 방식으로 씁니다. 소제목(h3) 제목은 바꾸지 않습니다. 출처 id·"Research Packet" 같은 말은 본문에 쓰지 않습니다.
출력(JSON 객체 하나만). h3 가 있는 절: {"sectionId":"S03","h3Sections":[{"index":0,"content":"<p>…</p>"}],"resolvedIssueIds":["M01"]}
도입·결론: {"sectionId":"S00","content":"<p>…</p>","resolvedIssueIds":["M01"]}`;

const MAX_SECTIONS_PER_CYCLE = 4;

function issuesText(issues: CriticIssue[]): string {
  return issues.map((i) => `- [${i.id}] (${i.severity}) ${i.problem}\n  고칠 것: ${i.requiredChange}${i.evidenceIds.length ? `\n  근거: ${i.evidenceIds.join(', ')}` : ''}`).join('\n');
}

/** 고친 절이 더 나빠졌는가 — 나빠졌으면 채택하지 않는다 */
/**
 * @param removalRequested 비평이 이 절에서 **근거 없는 내용을 지우라**고 했는가.
 *   실측(2026-09-22, 주담대 글): 비평은 "IBK 0.5%p 감면은 근거에 없다 → 지워라", 편집기는 지웠는데, 이 관문이
 *   "근거 있는 값(0.5%)이 사라졌다"며 되돌렸다 — 같은 지적이 네 번 되풀이되고 글은 한 글자도 안 바뀌었다(교착).
 *   지우라고 한 절에서는 값·분량이 줄어드는 것이 목적이다. 그때는 그 두 규칙을 느슨하게 둔다.
 */
export function guardRevision(before: string, after: string, ledger: LedgerItem[], otherUnits: Unit[], removalRequested = false): string | null {
  const b = stripHtml(before); const a = stripHtml(after);
  if (a.length < 25 || (b.length > 300 && a.length < 80)) return '고친 절이 비었다';
  const cb = checkClaims(before, ledger); const ca = checkClaims(after, ledger);
  const newUnsupported = ca.unsupported.filter((c) => !cb.unsupported.includes(c));
  if (newUnsupported.length) return `새로 근거 없는 값이 생겼다: ${newUnsupported.join(', ')}`;
  const keyOf = (s: { claim: string }) => norm(s.claim);
  const lostSupported = cb.supported.map(keyOf).filter((k) => !ca.supported.map(keyOf).includes(k) && !norm(after).includes(k));
  const lossLimit = removalRequested ? Math.max(3, Math.floor(cb.supported.length * 0.7)) : Math.max(1, Math.floor(cb.supported.length * 0.34));
  if (lostSupported.length > lossLimit) return `근거 있는 값이 사라졌다: ${lostSupported.slice(0, 4).join(', ')}`;
  const shrinkFloor = removalRequested ? 0.25 : 0.45;
  if (a.length < b.length * shrinkFloor && b.length > 400) return `정보량이 크게 줄었다 (${b.length}자 → ${a.length}자)`;
  const others = new Set(otherUnits.flatMap((u) => sentencesOf(u.text)).map((s) => s.replace(/\s/g, '')));
  const newDup = sentencesOf(after).filter((s) => others.has(s.replace(/\s/g, '')) && !sentencesOf(before).some((x) => x.replace(/\s/g, '') === s.replace(/\s/g, '')));
  if (newDup.length) return `다른 절과 같은 문장이 새로 생겼다: "${newDup[0]!.slice(0, 40)}…"`;
  return null;
}

export async function reviseSections(input: LoopInput, units: Unit[], issues: CriticIssue[]): Promise<{ article: ArticleSections; outcome: RevisionOutcome }> {
  const ledger = ledgerOf(input.items, input.packetText);
  const article: ArticleSections = JSON.parse(JSON.stringify(input.article));
  const outcome: RevisionOutcome = { revised: [], rejected: [], skipped: [], resolvedIssueIds: [], models: [] };
  /**
   * 한 번에 고치는 절은 최대 4개 — critical 이 있는 절부터. 열 절을 한꺼번에 고치면 비용이 초안만큼 들고(실측 40호출 $0.96),
   * 고친 절끼리 다시 겹친다. 남은 절은 재비평 뒤 다음 회차에서 본다.
   */
  const weight = (id: string) => issues.filter((i) => i.sectionId === id).reduce((n, i) => n + (i.severity === 'critical' ? 10 : i.severity === 'major' ? 3 : 0), 0);
  const targets = [...new Set(issues.filter((i) => i.severity !== 'minor').map((i) => i.sectionId))]
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, MAX_SECTIONS_PER_CYCLE);
  for (const u of units) if (!targets.includes(u.id)) outcome.skipped.push(u.id);

  for (const sectionId of targets) {
    const u = units.find((x) => x.id === sectionId)!;
    const mine = issues.filter((i) => i.sectionId === sectionId);   // 고치는 김에 그 절의 minor 도 함께
    const idx = units.indexOf(u);
    const prevCtx = idx > 0 ? stripHtml(units[idx - 1]!.text).slice(-300) : '';
    const nextCtx = idx < units.length - 1 ? stripHtml(units[idx + 1]!.text).slice(0, 300) : '';
    const relevantEvidence = input.items.filter((i) => mine.some((m) => m.evidenceIds.includes(i.id))).map((i) => `[${i.id}] ${i.title}\n${i.cleanedText.slice(0, 1500)}`).join('\n\n');
    const prompt = [
      EDITOR_RULES, '', `제목: ${input.title}`, `메인 키워드: ${input.mainKeyword}`, '',
      `===== 이 절의 문제 =====\n${issuesText(mine)}`, '',
      input.packetText.slice(0, 5000), '',
      ...(relevantEvidence ? [`===== 관련 근거 =====\n${relevantEvidence}`, ''] : []),
      `===== 앞 절 끝부분 =====\n${prevCtx}`, `===== 뒤 절 첫부분 =====\n${nextCtx}`, '',
      `===== 고칠 절 [${u.id}] ${u.h2} =====`,
      u.kind === 'section' ? u.h3Sections.map((h, i) => `[index ${i}] <h3>${h.h3}</h3>\n${h.content}`).join('\n\n') : u.text,
    ].join('\n');
    let parsed: any = null;
    try { parsed = readJson(await input.callModel(prompt, { json: true })); } catch (err: any) { if ((err as any)?.canceled) throw err; outcome.rejected.push({ sectionId, reason: `호출 실패: ${String(err?.message || err).slice(0, 60)}` }); continue; }
    if (input.modelOf) outcome.models.push(input.modelOf());
    if (!parsed) { outcome.rejected.push({ sectionId, reason: 'JSON 으로 읽히지 않음' }); continue; }

    let afterText = '';
    let apply: () => void = () => {};
    if (u.kind === 'section') {
      const rows: Array<{ index: number; content: string }> = (Array.isArray(parsed.h3Sections) ? parsed.h3Sections : []).map((r: any) => ({ index: Number(r?.index), content: String(r?.content || '') })).filter((r: any) => Number.isInteger(r.index) && r.index >= 0 && r.index < u.h3Sections.length && r.content.trim());
      if (!rows.length) { outcome.rejected.push({ sectionId, reason: '고친 본문이 없음' }); continue; }
      const merged = u.h3Sections.map((h, i) => ({ ...h, content: rows.find((r) => r.index === i)?.content ?? h.content }));
      afterText = merged.map((h) => `<h3>${h.h3}</h3>${h.content}`).join('\n');
      const sIdx = Number(sectionId.slice(1)) - 1;
      apply = () => { article.sections[sIdx]!.h3Sections = merged; };
    } else {
      const content = String(parsed.content || '').trim();
      if (!content) { outcome.rejected.push({ sectionId, reason: '고친 본문이 없음' }); continue; }
      afterText = content;
      apply = () => { if (u.kind === 'intro') article.introduction = content; else article.conclusion = content; };
    }
    const removalRequested = mine.some((m) => m.type === 'unsupported_claim' || m.type === 'redundancy' || m.type === 'mixed_timeline' || m.type === 'focus_mismatch');
    const reason = guardRevision(u.text, afterText, ledger, units.filter((x) => x.id !== sectionId), removalRequested);
    if (reason) { outcome.rejected.push({ sectionId, reason }); continue; }
    apply();
    outcome.revised.push(sectionId);
    outcome.resolvedIssueIds.push(...(Array.isArray(parsed.resolvedIssueIds) ? parsed.resolvedIssueIds.map(String) : mine.map((m) => m.id)));
  }
  return { article, outcome };
}

// ─── Final Judge ──────────────────────────────────────────────

const JUDGE_RULES = `당신은 최종 심사자입니다. 질문은 하나입니다: **"이 글을 지금 그대로 발행해도 되는가?"**
새로운 개선 아이디어를 내지 마세요. 더 좋게 만들 방법을 찾지 마세요. **발행을 막아야 할 문제만** 찾습니다.
막아야 할 문제: 근거에 없는 값·조건이 남아 있다 / 제목의 핵심 약속을 본문이 풀지 않는다 / 검색자의 핵심 질문에 답이 없다 / 다른 대상·상품·회차의 정보가 섞였다 / 절끼리 같은 내용을 크게 되풀이한다 / FAQ·요약표·CTA 가 본문과 다른 값을 말하거나 주제와 어긋난다.
anotherRevisionWouldMateriallyImprove 는 "한 번 더 고치면 **독자에게 실질적으로** 나아지는가"입니다. 문장 취향은 해당하지 않습니다.
출력(JSON 객체 하나만): {"decision":"PASS|FAIL","blockingIssues":["…"],"unsupportedClaims":["…"],"searchIntentCovered":true,"titlePromiseResolved":true,"majorRedundancy":false,"anotherRevisionWouldMateriallyImprove":false}`;

export async function runFinalJudge(input: {
  title: string; mainKeyword: string; article: ArticleSections; packetText: string; evidenceText: string; items: LoopInput['items'];
  faqText?: string; summaryText?: string; ctaText?: string; callModel: CallModel; modelOf?: () => string; onLog?: (m: string) => void;
}): Promise<JudgeResult> {
  const ledger = ledgerOf(input.items, input.packetText);
  const units = sectionize(input.article);
  // 코드가 먼저 막는다 — 모델이 봐줘도 근거 없는 값은 통과하지 못한다
  const blocking: string[] = [];
  const unsupported: string[] = [];
  const t = checkClaims(input.title, ledger); if (t.unsupported.length) { unsupported.push(...t.unsupported.map((c) => `제목: ${c}`)); }
  for (const u of units) { const c = checkClaims(u.text, ledger); unsupported.push(...c.unsupported.map((x) => `${u.id}: ${x}`)); }
  if (input.faqText) { const c = checkClaims(input.faqText, ledger); unsupported.push(...c.unsupported.map((x) => `FAQ: ${x}`)); }
  if (input.summaryText) { const c = checkClaims(input.summaryText, ledger); unsupported.push(...c.unsupported.map((x) => `요약표: ${x}`)); }
  if (unsupported.length) blocking.push(`근거 없는 값 ${unsupported.length}개`);
  const repeats = findCrossSectionRepeats(units);
  const majorRedundancyCode = repeats.length >= 3;
  if (majorRedundancyCode) blocking.push(`절 사이 되풀이 문장 ${repeats.length}개`);

  const prompt = [
    JUDGE_RULES, '', `메인 키워드: ${input.mainKeyword}`, `제목: ${input.title}`, '',
    input.packetText.slice(0, 5000), '', `===== FACT EVIDENCE(요약) =====\n${input.evidenceText.slice(0, 5000)}`, '',
    `===== 본문 =====\n${manuscriptFor(units, 2200)}`, '',
    ...(input.summaryText ? [`===== 요약표 =====\n${stripHtml(input.summaryText).slice(0, 1500)}`, ''] : []),
    ...(input.faqText ? [`===== FAQ =====\n${stripHtml(input.faqText).slice(0, 2500)}`, ''] : []),
    ...(input.ctaText ? [`===== CTA =====\n${stripHtml(input.ctaText).slice(0, 600)}`, ''] : []),
  ].join('\n');
  let parsed: any = null;
  try { parsed = readJson(await input.callModel(prompt, { json: true })); } catch (err: any) { if ((err as any)?.canceled) throw err; input.onLog?.(`⚖️ Final Judge 호출 실패: ${String(err?.message || err).slice(0, 80)}`); }
  const llmBlocking = (Array.isArray(parsed?.blockingIssues) ? parsed.blockingIssues : []).map(String).filter(Boolean).slice(0, 8);
  const decisionLlm = String(parsed?.decision || '').toUpperCase() === 'PASS';
  const result: JudgeResult = {
    decision: blocking.length === 0 && (parsed ? decisionLlm : true) ? 'PASS' : 'FAIL',
    blockingIssues: [...blocking, ...llmBlocking],
    // 값 대조는 코드가 권위다 — 모델이 "근거에 없다"고 한 것은 blockingIssues 로만 남기고, 값 관문(BODY_FACT)에는 코드 결과만 쓴다
    unsupportedClaims: unsupported,
    llmUnsupportedClaims: (Array.isArray(parsed?.unsupportedClaims) ? parsed.unsupportedClaims : []).map(String).slice(0, 8),
    searchIntentCovered: parsed ? parsed.searchIntentCovered !== false : true,
    titlePromiseResolved: parsed ? parsed.titlePromiseResolved !== false : true,
    majorRedundancy: majorRedundancyCode || parsed?.majorRedundancy === true,
    anotherRevisionWouldMateriallyImprove: parsed?.anotherRevisionWouldMateriallyImprove === true,
    ...(input.modelOf ? { model: input.modelOf() } : {}),
  };
  if (!parsed) result.blockingIssues.push('Final Judge 응답을 읽지 못함');
  if (!parsed) result.decision = 'FAIL';
  return result;
}

// ─── 루프 ─────────────────────────────────────────────────────

/**
 * Draft → Critic 1 → (문제 절만) Revision → Re-Critic 1 … → Critic 2 → (major 만) Revision → 끝.
 * 수정 총 3회 상한. Critical/Major 0 이면 그 자리에서 멈춘다.
 */
export async function runCritiqueLoop(input: LoopInput): Promise<{ article: ArticleSections; report: LoopReport }> {
  const maxRevisions = input.maxRevisions ?? 3;
  let article: ArticleSections = JSON.parse(JSON.stringify(input.article));
  let packetText = input.packetText; let evidenceText = input.evidenceText; let items = input.items;
  const report: LoopReport = {
    criticCycles: 0, revisionCycles: 0, critic1: [], critic2: null, revisions: [], titleIssues: [], researchRounds: 0,
    converged: false, remaining: { critical: 0, major: 0, minor: 0 }, unchangedSections: 0, revisedSections: 0, totalSections: 0,
    models: { critic1: [], revision: [], critic2: '' }, manualReviewReason: '',
  };
  const revisedIds = new Set<string>();
  const log = (m: string) => input.onLog?.(m);
  const ctx = (): LoopInput => ({ ...input, article, packetText, evidenceText, items });

  let lastCritic: CriticResult | null = null;
  let stage: 'fact' | 'editorial' = 'fact';
  const hardHistory: number[] = [];
  while (true) {
    const units = sectionize(article);
    report.totalSections = units.length;
    let critic: CriticResult;
    if (stage === 'fact') {
      critic = await runCritic1(ctx(), units);
      report.critic1.push(critic); report.criticCycles += 1;
      if (critic.model) report.models.critic1.push(critic.model);
      if (critic.titleIssues.length) report.titleIssues.push(...critic.titleIssues);
      log(`🩺 Critic 1 (${report.criticCycles}회차): critical ${critic.criticalIssues.length} · major ${critic.majorIssues.length} · minor ${critic.minorIssues.length}${critic.unsupportedClaims.length ? ` · 근거 없는 값 ${critic.unsupportedClaims.length}` : ''}${critic.missingIntentAnswers.length ? ` · 의도 누락 ${critic.missingIntentAnswers.length}` : ''}`);
      if (critic.status === 'NEEDS_MORE_RESEARCH' && input.moreResearch && report.researchRounds === 0) {
        report.researchRounds += 1;
        log(`🔎 비평이 근거 부족을 알렸습니다 → 검색으로 되돌아갑니다: ${critic.researchQueries.join(' / ')}`);
        const more = await input.moreResearch(critic.researchQueries);
        if (more) { packetText = more.packetText; evidenceText = more.evidenceText; items = more.items; }
        continue;
      }
    } else {
      critic = await runCritic2(ctx(), units);
      report.critic2 = critic; report.criticCycles += 1;
      if (critic.model) report.models.critic2 = critic.model;
      log(`🩺 Critic 2 (편집): major ${critic.majorIssues.length} · minor ${critic.minorIssues.length}`);
    }
    lastCritic = critic;
    const hard = [...critic.criticalIssues, ...critic.majorIssues];
    if (hard.length === 0) {
      if (stage === 'fact') { stage = 'editorial'; continue; }
      break;   // 편집 비평도 통과 — 끝
    }
    if (report.revisionCycles >= maxRevisions) {
      report.manualReviewReason = `수정 ${maxRevisions}회 뒤에도 critical ${critic.criticalIssues.length} · major ${critic.majorIssues.length} 남음`;
      break;
    }
    /**
     * 정체 감지 — 고쳤는데 문제 수가 줄지 않으면(두 회차 연속) 더 고쳐도 같은 지적이 돌아온다. 돈만 든다. 여기서 멈춘다.
     * 실측: 지적 15 → 9 → 10 → 10 처럼 3회차부터 제자리였다.
     */
    hardHistory.push(hard.length);
    if (hardHistory.length >= 3 && hardHistory[hardHistory.length - 1]! >= hardHistory[hardHistory.length - 2]! && hardHistory[hardHistory.length - 2]! >= hardHistory[hardHistory.length - 3]!) {
      report.manualReviewReason = `수정해도 지적이 줄지 않음(${hardHistory.join(' → ')}) — critical ${critic.criticalIssues.length} · major ${critic.majorIssues.length} 남음`;
      break;
    }
    report.revisionCycles += 1;
    const { article: next, outcome } = await reviseSections(ctx(), units, [...hard, ...critic.minorIssues]);
    report.revisions.push(outcome); report.models.revision.push(...outcome.models);
    outcome.revised.forEach((id) => revisedIds.add(id));
    log(`✏️ 수정 ${report.revisionCycles}회차: 고친 절 ${outcome.revised.join(', ') || '없음'}${outcome.rejected.length ? ` · 되돌린 절 ${outcome.rejected.map((r) => `${r.sectionId}(${r.reason})`).join(', ')}` : ''} · 손대지 않은 절 ${outcome.skipped.length}`);
    if (outcome.revised.length === 0 && stage === 'editorial') break;   // 편집 수정이 하나도 안 붙으면 더 돌 이유가 없다
    article = next;
    // 사실 단계에서 고쳤으면 사실 비평을 다시, 편집 단계면 편집 비평을 다시 (같은 단계 재비평)
  }

  report.remaining = { critical: lastCritic?.criticalIssues.length || 0, major: lastCritic?.majorIssues.length || 0, minor: lastCritic?.minorIssues.length || 0 };
  report.revisedSections = revisedIds.size;
  report.unchangedSections = Math.max(0, report.totalSections - revisedIds.size);
  report.converged = report.remaining.critical === 0 && report.remaining.major === 0 && !report.manualReviewReason;
  if (!report.converged && !report.manualReviewReason) report.manualReviewReason = `critical ${report.remaining.critical} · major ${report.remaining.major} 남음`;
  return { article, report };
}
