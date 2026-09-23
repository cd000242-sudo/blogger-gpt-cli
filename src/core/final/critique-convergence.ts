/**
 * critique-convergence — 「비평 개선」 버튼이 **멈출 줄 알게** 한다. (v3.8.750)
 *
 * ## 원칙
 * "비평 개선 버튼은 더 나은 표현을 끝없이 찾아주는 기능이 아니다.
 *  실제 발행 문제를 찾아 그 문제만 고치고, 해결되면 반드시 멈춰야 한다."
 *
 * ## 감사(2026-09-23)에서 본 되풀이의 원인
 *   · 표현·반복·어미 같은 선택 개선과, 새 근거가 있어야 풀리는 지적이 「반드시」로 떠서 매번 다시 골랐다.
 *     (5543: 7건 → 고침 → 8건 중 3건이 새 지적 · 5515: 17 → 17 → 9 → 8 → 8 → 8)
 *   · 두 번째 비평이 백지에서 AI 비평을 다시 돌려 새 선택 항목을 찾아냈다.
 *   · 지적의 이름이 자리 번호(audit-…-3)라 앞의 한 건이 사라지면 나머지가 "새 지적"이 됐다.
 *
 * ## 그래서
 *   ① 지적을 BLOCKING / OPTIONAL / NEEDS_NEW_EVIDENCE 로 가른다 — 심각도(high·medium·low)와 별개다.
 *   ② 이름표(issueKey)로 OPEN → RESOLVED · REGRESSED 를 기록한다 (체인).
 *   ③ 두 번째 비평부터는 AI 를 부르지 않는다 — 지난 BLOCKING 이 풀렸는지, 수정이 새 BLOCKING 을 만들었는지,
 *      BLOCKING 이 남았는지만 코드로 잰다. BLOCKING 이 0 이면 끝이다. 전체 비평은 사람이 눌렀을 때만.
 *
 * 자동 품질 루프(critique-loop)·발행 전 자가 수정(pre-publish-fix)은 이 모듈을 쓰지 않는다.
 * 이 모듈은 예외를 던지지 않는다 — 체인이 깨져 있으면 없는 것으로 친다.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  diagnosePost, splitSections, issueKey, rewriteAbility, scoreIssues,
  type CritiqueIssue, type CompetitorPost,
} from './post-critique';
import { findProcessLeak } from './article-audit';
import { stripToPlainText } from './substance-gate';
import { sentencesOf, blockSentences } from './leaf-blocks';

export type IssueClass = 'BLOCKING' | 'OPTIONAL' | 'NEEDS_NEW_EVIDENCE';
export type LifecycleState = 'OPEN' | 'RESOLVED' | 'REGRESSED';

/** 체인에 남기는 지적 한 건 — 회차가 바뀌어도 stableIssueId 로 같은 것을 알아본다 */
export interface ChainIssue {
  stableIssueId: string;
  id: string;
  area: CritiqueIssue['area'];
  severity: CritiqueIssue['severity'];
  origin: CritiqueIssue['origin'];
  title: string;
  detail: string;
  evidence: string;
  fix: string;
  sectionIndex: number;
  aiType?: string;
  issueClass: IssueClass;
  state: LifecycleState;
  /** AI 지적의 근거 문장이 본문에 글자 그대로 있는가 — 없으면 코드로 해결 여부를 잴 수 없다 */
  anchored: boolean;
  firstCycle: number;
  lastCycle: number;
  note: string;
}

export interface CritiqueChain {
  version: 1;
  title: string;
  headings: string[];
  /** 마지막으로 잰 본문의 지문 */
  articleFingerprint: string;
  /** 버튼 수정이 만든 본문의 지문 — 다시 잴 때 본문이 그대로면 새 결함은 그 수정이 만든 것이다 */
  lastEditFingerprint: string;
  /** 이 체인에서 버튼 수정을 반영한 횟수 */
  revisionCycle: number;
  /** 이 체인에서 비평(전체·이어서 확인)을 한 횟수 */
  critiqueRound: number;
  lastRevisedSections: number[];
  issues: ChainIssue[];
  converged: boolean;
}

export type DisplayIssue = CritiqueIssue & {
  stableIssueId: string;
  issueClass: IssueClass;
  blocking: boolean;
  state: LifecycleState;
  fixable: boolean;
  fixHint: string;
  fixReason?: string;
  lifecycleNote: string;
  /** 화면이 미리 체크해 둘 것 — 반드시 고칠 것 중 수정 버튼으로 고칠 수 있는 것만 */
  autoSelect: boolean;
};

export interface ConvergenceView {
  converged: boolean;
  headline: string;
  message: string;
  /** 이번에 AI 전체 비평을 돌렸는가 (이어서 확인이면 false) */
  fullCritique: boolean;
  critiqueRound: number;
  revisionCycle: number;
  articleFingerprint: string;
  counts: { blockingOpen: number; regressed: number; resolved: number; optional: number; needsEvidence: number; lockedBlocking: number };
  /** 이어서 확인에서 새로 보였지만 목록에 올리지 않은 선택 항목 수 — 끝없는 새 지적을 막는다 */
  newOptionalIgnored: number;
}

export interface ButtonCritique {
  /** 지금 남은 것 — OPEN·REGRESSED 인 반드시 고칠 것 + 선택 개선 + 근거 필요 */
  issues: DisplayIssue[];
  /** 해결된 반드시 고칠 것 */
  resolvedIssues: DisplayIssue[];
  chain: CritiqueChain;
  convergence: ConvergenceView;
  score: number;
  summary: string;
}

export const PUBLISHABLE_HEADLINE = '발행 가능 — 남은 항목은 선택 개선입니다.';
export const CONVERGED_MESSAGE = '현재 글은 발행 가능한 수준입니다. 남은 항목은 선택 개선이며 추가 자동수정은 필요하지 않습니다.';

/** 발행을 막는 결함 — 코드 진단의 종류(순번 뺀 id) */
const BLOCKING_CODE_KINDS = new Set([
  'answer-missing',               // 핵심 답 누락
  'audit-title-promise-unkept',   // 제목 약속 미회수
  'audit-empty-section',          // 빈 핵심 절
  'audit-replacement-artifact',   // 치환 찌꺼기
  'audit-writing-process-leak',   // 작성 과정 누출
  'audit-meta-leak',              // 작성 과정 누출 — 편집기 말투 (이 모듈이 찾는다)
  'audit-broken-title',           // 잘린 제목
  'audit-asserted-crime',         // 사실 오류 — 판결 전인데 확정형
  'audit-legal-overreach',        // 사실 오류 — 거론한 혐의를 적용된 것처럼
  'audit-money-confusion',        // 사실 오류 — 성격이 다른 금액을 한 문장에
]);

/** AI 가 blocking:true 로 답할 수 있는 종류 — 이 밖의 것은 선택 개선이다 */
export const BLOCKING_AI_TYPES: readonly string[] = [
  'fact-error', 'unsupported-claim', 'title-contradiction', 'entity-mixup', 'answer-missing',
  'misleading-action', 'title-promise', 'empty-section', 'artifact', 'process-leak', 'broken-title',
];

const plain = (html: string): string => stripToPlainText(String(html || ''));
const squash = (text: string): string => String(text || '').replace(/[“”"'‘’「」『』…⏎]/g, '').replace(/\s+/g, '');

/** 순번을 뺀 종류 — audit-cross-section-echo-3 → audit-cross-section-echo */
export function kindOf(issue: Pick<CritiqueIssue, 'id'>): string {
  return String(issue?.id || '').replace(/^(audit-[a-z-]+?)-\d+$/, '$1');
}

/**
 * 수렴에 쓰는 이름표 = 기존 issueKey. AI 지적만 순번(ai-0)을 떼고 잰다 — 순번은 회차마다 바뀐다.
 */
export function stableIssueIdOf(issue: Pick<CritiqueIssue, 'id' | 'title' | 'evidence'>): string {
  const id = String(issue?.id || '');
  return issueKey(/^ai-\d+$/.test(id) ? { ...issue, id: 'ai' } : issue);
}

export function fingerprint(html: string): string {
  return createHash('sha1').update(plain(html)).digest('hex').slice(0, 16);
}

/** 근거 문장이 본문에 **글자 그대로** 있는가 (공백·따옴표 무시) */
export function evidenceInBody(evidence: unknown, bodyText: string): boolean {
  const probe = squash(plain(String(evidence || ''))).slice(0, 40);
  if (probe.length < 8) return false;
  return squash(bodyText).includes(probe);
}

/* ────────────────────────────────────────────────────────────────
 * 작성 과정 누출 — 편집기 말투 (§7)
 *
 * article-audit 의 PROCESS_LEAK 는 생성 단계의 누출("제공된 근거에는 …")을 본다.
 * 버튼 수정이 새로 만든 누출은 말투가 달랐다(5543 수정본 실측): 구간 단위로 받은 흔적,
 * "자료에 없으므로 작성할 수 없습니다" 같은 거절문. 독자에게는 쓸모가 없고 AI 티가 가장 크게 난다.
 * 오탐을 줄이려고 **글쓴이가 자기 자료를 말하는 꼴**만 잡는다 — "보험사의 거절 근거가 부족합니다"는 독자 상황이라 아니다.
 * ──────────────────────────────────────────────────────────────── */
const EDITOR_META_LEAK: RegExp[] = [
  /구간(?:의|에서?)\s*(?:자료|근거|내용)(?:만으로(?:는)?|에는|로는)\s*[^.!?。]{0,24}?(?:확인|판단|단정|알)\s*(?:할|하기)?\s*수\s*없/,
  /자료에\s*(?:는\s*)?(?:나와\s*있지\s*않|없)(?:으므로|어서|기\s*때문에)[^.!?。]{0,24}?(?:작성|기재|서술|적을|쓸)/,
  /(?:해당|이|그)\s*(?:수치|숫자|금액|날짜)(?:는|를|은|을)?\s*임의로\s*(?:적|쓰|기재하|넣)/,
  /이\s*글(?:에서는|에서|로는|만으로는)\s*[^.!?。]{0,16}?(?:확인|단정|판단)(?:할|하기)?\s*수\s*없/,
  /(?:^|[.!?。]\s*|(?:이|그|해당)\s*(?:부분|내용|수치|주장)(?:은|는)\s*)근거가\s*(?:부족|없)(?:합니다|습니다|어|하여|해)/,
  /(?:원문|주신\s*자료|제공(?:된|받은)\s*(?:글|문서))(?:에는|에서는|만으로는)\s*[^.!?。]{0,24}?(?:없|확인할\s*수\s*없)/,
];
/** 앞 40자에 기관·회사 같은 제3자 주어가 있으면 독자 상황이지 누출이 아니다 (article-audit 과 같은 규칙) */
const THIRD_PARTY = /(?:기관|공단|공사|관리원|위원회|법원|은행|회사|보험사|담당자|심사|센터|지자체|시청|구청|주민센터)(?:이|가|은|는|에서|도)\s*[^.。]*$/;

/** 편집기 말투의 누출 문장들 (문장째) */
export function findMetaLeaks(text: string): string[] {
  const src = String(text || '');
  const found: Array<{ at: number; sentence: string }> = [];
  for (const re of EDITOR_META_LEAK) {
    for (const m of src.matchAll(new RegExp(re.source, 'g'))) {
      const lead = m[0].search(/[가-힣]/);
      const at = (m.index ?? 0) + Math.max(0, lead);
      if (THIRD_PARTY.test(src.slice(Math.max(0, at - 40), at))) continue;
      const sentence = sentenceAround(src, at);
      if (!found.some((f) => f.sentence === sentence)) found.push({ at, sentence });
    }
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.sentence);
}

function sentenceAround(text: string, at: number): string {
  const head = text.slice(0, at);
  const cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '), head.lastIndexOf('。'));
  const start = cut >= 0 ? cut + 2 : 0;
  const tail = /[.!?。](?=\s|$)/.exec(text.slice(at));
  const end = tail ? at + tail.index + 1 : text.length;
  return text.slice(start, end).trim();
}

/** 누출 문장 — 생성 단계 누출(PROCESS_LEAK) + 편집기 말투. 문장 단위로 본다 */
export function leakSentences(text: string): string[] {
  return sentencesOf(text).filter((s) => findProcessLeak(s).length > 0 || findMetaLeaks(s).length > 0);
}

/**
 * 누출 지적 — **문장마다 한 건**. diagnosePost 는 무늬마다 첫 문장만 알려서, 한 문장을 지우면
 * 가려져 있던 두 번째 문장이 "새 지적"으로 떴다. 그래서 버튼 비평은 누출을 여기서 문장 단위로 센다.
 * 문장은 문단 안에서 나눈다 — 마침표 없는 소제목이 다음 문단 문장과 붙으면 고칠 문단을 못 찾는다(5515 실측).
 */
export function leakIssues(html: string): CritiqueIssue[] {
  const out: CritiqueIssue[] = [];
  for (const section of splitSections(html)) {
    for (const sentence of blockSentences(section.html)) {
      const processLeak = findProcessLeak(sentence).length > 0;
      if (!processLeak && findMetaLeaks(sentence).length === 0) continue;
      out.push({
        id: `audit-${processLeak ? 'writing-process-leak' : 'meta-leak'}-${out.length}`,
        area: 'substance',
        severity: 'high',
        title: processLeak ? '글 쓰는 과정이 독자에게 새어 나왔습니다' : '작성 과정·자료 한계를 말하는 문장이 본문에 있습니다',
        detail: '자료가 부족하다는 말은 독자에게 쓸모가 없고, AI 가 쓴 티가 가장 크게 나는 자리입니다.',
        evidence: sentence.slice(0, 160),
        fix: '그 문장만 지웁니다. 확인 못 한 내용은 쓰지 않고, 확인된 나머지 문장은 그대로 둡니다.',
        sectionIndex: section.index,
        origin: 'code',
      });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

/**
 * 버튼 비평의 코드 진단 — diagnosePost 에서 누출 지적만 문장 단위(leakIssues)로 바꿔 끼운다. AI 호출 0회.
 */
export function buttonDiagnose(input: { title: string; html: string; competitors?: CompetitorPost[] }): CritiqueIssue[] {
  const base = diagnosePost({ title: input.title, html: input.html, competitors: input.competitors || [] })
    .filter((issue) => kindOf(issue) !== 'audit-writing-process-leak');
  return [...base, ...leakIssues(input.html)];
}

/* ────────────────────────────────────────────────────────────────
 * ① 분류 — BLOCKING / OPTIONAL / NEEDS_NEW_EVIDENCE
 * ──────────────────────────────────────────────────────────────── */

export function classifyIssue(issue: CritiqueIssue, bodyText: string): IssueClass {
  const needs = (): IssueClass => (rewriteAbility(issue, { targeted: true }).reason === 'NEEDS_NEW_EVIDENCE' ? 'NEEDS_NEW_EVIDENCE' : 'OPTIONAL');
  if (issue.origin !== 'ai') return BLOCKING_CODE_KINDS.has(kindOf(issue)) ? 'BLOCKING' : needs();
  // AI 는 "막아야 한다"고만 해서는 안 된다 — 종류가 발행 결함이고, 근거 문장이 본문에 그대로 있어야 한다.
  const type = String(issue.aiType || '').toLowerCase();
  if (issue.blocking === true && BLOCKING_AI_TYPES.includes(type) && evidenceInBody(issue.evidence, bodyText)) return 'BLOCKING';
  return needs();
}

function noteFor(issue: CritiqueIssue, issueClass: IssueClass, state: LifecycleState, bodyText: string): string {
  if (issueClass === 'BLOCKING') {
    return state === 'REGRESSED' ? '해결됐던 결함이 다시 잡혔습니다.' : '발행 전에 고쳐야 하는 결함입니다.';
  }
  if (issueClass === 'NEEDS_NEW_EVIDENCE') return '근거를 추가해 다시 생성해야 하는 항목입니다 — 발행을 막지 않습니다.';
  if (issue.origin === 'ai' && issue.blocking === true && !evidenceInBody(issue.evidence, bodyText)) {
    return 'AI 가 발행 결함이라고 했지만 근거 문장을 본문에서 글자 그대로 찾지 못해 선택 개선으로 둡니다.';
  }
  return '선택 개선입니다 — 발행을 막지 않습니다.';
}

function decorate(issue: CritiqueIssue, issueClass: IssueClass, state: LifecycleState, note: string): DisplayIssue {
  const ability = rewriteAbility(issue, { targeted: true });
  const blocking = issueClass === 'BLOCKING';
  return {
    ...issue,
    stableIssueId: stableIssueIdOf(issue),
    issueClass,
    blocking,
    state,
    fixable: ability.fixable,
    fixHint: ability.hint,
    ...(ability.reason ? { fixReason: ability.reason } : {}),
    lifecycleNote: note,
    autoSelect: blocking && ability.fixable && state !== 'RESOLVED',
  };
}

function chainIssueOf(issue: CritiqueIssue, issueClass: IssueClass, state: LifecycleState, bodyText: string, cycle: number, note: string): ChainIssue {
  return {
    stableIssueId: stableIssueIdOf(issue),
    id: String(issue.id || ''),
    area: issue.area,
    severity: issue.severity,
    origin: issue.origin,
    title: String(issue.title || '').slice(0, 200),
    detail: String(issue.detail || '').slice(0, 600),
    evidence: String(issue.evidence || '').slice(0, 400),
    fix: String(issue.fix || '').slice(0, 600),
    sectionIndex: Number.isInteger(issue.sectionIndex) ? issue.sectionIndex : -1,
    ...(issue.aiType ? { aiType: issue.aiType } : {}),
    issueClass,
    state,
    anchored: issue.origin === 'ai' ? evidenceInBody(issue.evidence, bodyText) : true,
    firstCycle: cycle,
    lastCycle: cycle,
    note,
  };
}

function issueOfChain(ci: ChainIssue, live?: CritiqueIssue): CritiqueIssue {
  const source = live && ci.origin !== 'ai' ? live : null;
  return {
    id: source?.id ?? ci.id,
    area: ci.area,
    severity: ci.severity,
    title: source?.title ?? ci.title,
    detail: source?.detail ?? ci.detail,
    evidence: source?.evidence ?? ci.evidence,
    fix: source?.fix ?? ci.fix,
    sectionIndex: source?.sectionIndex ?? ci.sectionIndex,
    origin: ci.origin,
    ...(ci.aiType ? { aiType: ci.aiType } : {}),
    ...(ci.origin === 'ai' && ci.issueClass === 'BLOCKING' ? { blocking: true } : {}),
  };
}

const isOpenBlocking = (ci: Pick<ChainIssue, 'issueClass' | 'state'>): boolean => ci.issueClass === 'BLOCKING' && ci.state !== 'RESOLVED';
const CLASS_ORDER: Record<IssueClass, number> = { BLOCKING: 0, OPTIONAL: 1, NEEDS_NEW_EVIDENCE: 2 };

/* ────────────────────────────────────────────────────────────────
 * ② 체인 — 같은 글인가, 깨진 체인은 버린다
 * ──────────────────────────────────────────────────────────────── */

const headingsOf = (html: string): string[] => splitSections(html).filter((s) => s.index > 0).map((s) => s.heading.trim()).filter(Boolean);
const normTitle = (t: string): string => String(t || '').replace(/\s+/g, '').toLowerCase();

const AREAS: readonly string[] = ['substance', 'answer', 'quality', 'cta', 'competitor', 'structure', 'style'];
const SEVERITIES: readonly string[] = ['high', 'medium', 'low'];
const CLASSES: readonly string[] = ['BLOCKING', 'OPTIONAL', 'NEEDS_NEW_EVIDENCE'];
const STATES: readonly string[] = ['OPEN', 'RESOLVED', 'REGRESSED'];
const str = (v: unknown, n: number): string => String(v ?? '').slice(0, n);
const int = (v: unknown): number => (Number.isInteger(v) ? Number(v) : 0);
const pick = <T extends string>(v: unknown, allowed: readonly string[], fallback: T): T => (allowed.includes(String(v)) ? String(v) as T : fallback);
type Loose = Record<string, unknown>;
const isLoose = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * 화면(렌더러)·파일에서 온 체인을 믿지 않고 다시 세운다 — 시스템 경계. 모양이 틀리면 null(체인 없음).
 */
export function sanitizeChain(raw: unknown): CritiqueChain | null {
  if (!isLoose(raw)) return null;
  const r = raw;
  if (r['version'] !== 1 || !Array.isArray(r['issues'])) return null;
  const issues: ChainIssue[] = (r['issues'] as unknown[])
    .filter((i): i is Loose => isLoose(i) && typeof i['stableIssueId'] === 'string' && i['stableIssueId'] !== '')
    .slice(0, 200)
    .map((i) => ({
      stableIssueId: str(i['stableIssueId'], 400),
      id: str(i['id'], 120),
      area: pick<ChainIssue['area']>(i['area'], AREAS, 'structure'),
      severity: pick<ChainIssue['severity']>(i['severity'], SEVERITIES, 'medium'),
      origin: i['origin'] === 'ai' ? 'ai' as const : 'code' as const,
      title: str(i['title'], 200),
      detail: str(i['detail'], 600),
      evidence: str(i['evidence'], 400),
      fix: str(i['fix'], 600),
      sectionIndex: Number.isInteger(i['sectionIndex']) ? Number(i['sectionIndex']) : -1,
      ...(i['aiType'] ? { aiType: str(i['aiType'], 40) } : {}),
      issueClass: pick<IssueClass>(i['issueClass'], CLASSES, 'OPTIONAL'),
      state: pick<LifecycleState>(i['state'], STATES, 'OPEN'),
      anchored: i['anchored'] === true,
      firstCycle: int(i['firstCycle']),
      lastCycle: int(i['lastCycle']),
      note: str(i['note'], 200),
    }));
  return {
    version: 1,
    title: str(r['title'], 300),
    headings: Array.isArray(r['headings']) ? (r['headings'] as unknown[]).map((h) => str(h, 200)).slice(0, 60) : [],
    articleFingerprint: str(r['articleFingerprint'], 64),
    lastEditFingerprint: str(r['lastEditFingerprint'], 64),
    revisionCycle: int(r['revisionCycle']),
    critiqueRound: int(r['critiqueRound']),
    lastRevisedSections: Array.isArray(r['lastRevisedSections']) ? (r['lastRevisedSections'] as unknown[]).filter((n) => Number.isInteger(n)).map(Number).slice(0, 60) : [],
    issues,
    converged: !issues.some(isOpenBlocking),
  };
}

/**
 * 이 체인을 이어서 써도 되는 같은 글인가. 지문이 같거나, 제목이 같거나, 소제목이 60% 이상 겹치면 같은 글이다.
 * 버튼 수정은 소제목을 바꾸지 않으므로 수정 뒤에도 이어진다.
 */
export function canContinueChain(raw: unknown, input: { title: string; html: string }): boolean {
  const chain = sanitizeChain(raw);
  if (!chain) return false;
  if (chain.articleFingerprint && chain.articleFingerprint === fingerprint(input.html)) return true;
  if (normTitle(chain.title) && normTitle(chain.title) === normTitle(input.title)) return true;
  const now = headingsOf(input.html);
  if (!now.length || !chain.headings.length) return false;
  const shared = now.filter((h) => chain.headings.includes(h)).length;
  return shared / Math.max(now.length, chain.headings.length) >= 0.6;
}

/* ────────────────────────────────────────────────────────────────
 * ③ 보여줄 것 — 남은 것 · 해결된 것 · 끝났는가
 * ──────────────────────────────────────────────────────────────── */

function viewOf(chain: CritiqueChain, live: Map<string, CritiqueIssue>, opts: { fullCritique: boolean; newOptionalIgnored: number }): ButtonCritique {
  const shown = chain.issues
    .filter((ci) => ci.state !== 'RESOLVED')
    .map((ci) => decorate(issueOfChain(ci, live.get(ci.stableIssueId)), ci.issueClass, ci.state, ci.note))
    .sort((a, b) => CLASS_ORDER[a.issueClass] - CLASS_ORDER[b.issueClass]);
  const resolvedIssues = chain.issues
    .filter((ci) => ci.issueClass === 'BLOCKING' && ci.state === 'RESOLVED')
    .map((ci) => decorate(issueOfChain(ci), ci.issueClass, ci.state, ci.note));
  const blockingOpen = shown.filter((i) => i.blocking);
  const counts = {
    blockingOpen: blockingOpen.length,
    regressed: blockingOpen.filter((i) => i.state === 'REGRESSED').length,
    resolved: resolvedIssues.length,
    optional: shown.filter((i) => i.issueClass === 'OPTIONAL').length,
    needsEvidence: shown.filter((i) => i.issueClass === 'NEEDS_NEW_EVIDENCE').length,
    lockedBlocking: blockingOpen.filter((i) => !i.fixable).length,
  };
  const converged = counts.blockingOpen === 0;
  const rest = [counts.optional ? `선택 개선 ${counts.optional}건` : '', counts.needsEvidence ? `근거 필요 ${counts.needsEvidence}건` : ''].filter(Boolean).join(' · ');
  const headline = converged
    ? PUBLISHABLE_HEADLINE
    : `반드시 고칠 것 ${counts.blockingOpen}건이 남았습니다${counts.lockedBlocking ? ` (그중 ${counts.lockedBlocking}건은 수정 버튼으로 못 고칩니다)` : ''}.`;
  const convergence: ConvergenceView = {
    converged,
    headline,
    message: converged
      ? CONVERGED_MESSAGE
      : '반드시 고칠 것만 미리 골라 두었습니다. 고르면 그 문단만 고칩니다 — 선택 개선은 발행을 막지 않습니다.',
    fullCritique: opts.fullCritique,
    critiqueRound: chain.critiqueRound,
    revisionCycle: chain.revisionCycle,
    articleFingerprint: chain.articleFingerprint,
    counts,
    newOptionalIgnored: opts.newOptionalIgnored,
  };
  return {
    issues: shown,
    resolvedIssues,
    chain,
    convergence,
    // 점수도 발행을 막는 결함만으로 — 선택 개선까지 깎으면 "발행 가능"인데 0점이 나오고, 점수를 올리려 끝없이 고치게 된다
    score: scoreIssues(blockingOpen),
    summary: converged ? `${PUBLISHABLE_HEADLINE}${rest ? ` (${rest})` : ''}` : `반드시 고칠 것 ${counts.blockingOpen}건${rest ? ` · ${rest}` : ''}`,
  };
}

/**
 * 첫 비평(또는 사람이 누른 「전체 다시 비평」) — 코드 진단과 AI 비평은 부르는 쪽이 이미 했다.
 * 여기서는 분류하고 새 체인을 세운다. 같은 글의 앞 체인이 있으면 해결 기록과 수정 횟수를 이어받는다.
 */
export function openChain(input: { title: string; html: string; issues: CritiqueIssue[]; previous?: unknown }): ButtonCritique {
  const title = String(input.title || '').trim();
  const html = String(input.html || '');
  const bodyText = plain(html);
  const previous = canContinueChain(input.previous, { title, html }) ? sanitizeChain(input.previous) : null;
  const cycle = previous?.revisionCycle || 0;
  const live = new Map<string, CritiqueIssue>();
  const fresh: ChainIssue[] = [];
  for (const issue of input.issues || []) {
    const key = stableIssueIdOf(issue);
    if (live.has(key)) continue;
    live.set(key, issue);
    const issueClass = classifyIssue(issue, bodyText);
    const before = previous?.issues.find((p) => p.stableIssueId === key);
    const state: LifecycleState = before && (before.state === 'RESOLVED' || before.state === 'REGRESSED') ? 'REGRESSED' : 'OPEN';
    const made = chainIssueOf(issue, issueClass, state, bodyText, cycle, noteFor(issue, issueClass, state, bodyText));
    fresh.push(before ? { ...made, firstCycle: before.firstCycle } : made);
  }
  // 앞 체인에서 해결된 반드시 고칠 것은 기록으로 남긴다 — 이번 전체 비평에 다시 안 나왔으면
  const carried = (previous?.issues || []).filter((p) => p.issueClass === 'BLOCKING' && p.state === 'RESOLVED' && !live.has(p.stableIssueId));
  const issues = [...fresh, ...carried];
  const chain: CritiqueChain = {
    version: 1,
    title,
    headings: headingsOf(html),
    articleFingerprint: fingerprint(html),
    lastEditFingerprint: previous?.lastEditFingerprint || '',
    revisionCycle: cycle,
    critiqueRound: (previous?.critiqueRound || 0) + 1,
    lastRevisedSections: previous?.lastRevisedSections || [],
    issues,
    converged: !issues.some(isOpenBlocking),
  };
  return viewOf(chain, live, { fullCritique: true, newOptionalIgnored: 0 });
}

/** AI 지적의 수정 결과 — 편집 단계가 알려 준다 (검수 통과 또는 근거 문장 다시 잡기) */
export interface AiUpdate { state?: LifecycleState; evidence?: string; anchored?: boolean }

function reconcile(
  chainIn: CritiqueChain,
  input: { title: string; html: string },
  opts: { countRound: boolean; edited: boolean; revisedSections?: number[]; aiUpdates?: Map<string, AiUpdate> },
): ButtonCritique {
  const title = String(input.title || '').trim() || chainIn.title;
  const html = String(input.html || '');
  const bodyText = plain(html);
  const nowFp = fingerprint(html);
  const live = new Map<string, CritiqueIssue>();
  for (const issue of buttonDiagnose({ title, html })) {
    const key = stableIssueIdOf(issue);
    if (!live.has(key)) live.set(key, issue);
  }
  const cycle = chainIn.revisionCycle + (opts.edited ? 1 : 0);
  const revised = opts.edited ? (opts.revisedSections || []) : chainIn.lastRevisedSections;
  const editFp = opts.edited ? nowFp : chainIn.lastEditFingerprint;
  // 지금 본문이 버튼 수정이 만든 그대로면, 새로 잡힌 반드시 고칠 것은 그 수정이 만든 것이다
  const producedByEdit = cycle > 0 && editFp === nowFp;

  const updated: ChainIssue[] = chainIn.issues.map((ci) => {
    const patch = opts.aiUpdates?.get(ci.stableIssueId);
    const base: ChainIssue = patch ? { ...ci, ...patch } : ci;
    const present = base.origin === 'ai'
      ? (base.anchored && base.evidence ? evidenceInBody(base.evidence, bodyText) : base.state !== 'RESOLVED')
      : live.has(base.stableIssueId);
    const state: LifecycleState = !present ? 'RESOLVED' : (base.state === 'RESOLVED' || base.state === 'REGRESSED') ? 'REGRESSED' : 'OPEN';
    const note = state === base.state ? base.note
      : state === 'RESOLVED' ? '해결됐습니다 — 다시 재 보니 본문에서 사라졌습니다.'
        : state === 'REGRESSED' ? '해결됐던 결함이 다시 잡혔습니다.' : base.note;
    return { ...base, state, note, lastCycle: present ? cycle : base.lastCycle };
  });

  const known = new Set(chainIn.issues.map((ci) => ci.stableIssueId));
  let newOptionalIgnored = 0;
  const added: ChainIssue[] = [];
  for (const [key, issue] of live) {
    if (known.has(key)) continue;
    const issueClass = classifyIssue(issue, bodyText);
    // 이어서 확인은 새 선택 항목을 찾는 자리가 아니다 — 세기만 하고 올리지 않는다
    if (issueClass !== 'BLOCKING') { newOptionalIgnored += 1; continue; }
    const byEdit = producedByEdit || (cycle > 0 && revised.includes(issue.sectionIndex));
    added.push(chainIssueOf(issue, issueClass, byEdit ? 'REGRESSED' : 'OPEN', bodyText, cycle, byEdit
      ? '직전 수정이 새로 만든 반드시 고칠 것입니다.'
      : '이번 확인에서 새로 잡힌 반드시 고칠 것입니다.'));
  }
  const issues = [...updated, ...added];
  const chain: CritiqueChain = {
    ...chainIn,
    title,
    headings: headingsOf(html),
    articleFingerprint: nowFp,
    lastEditFingerprint: editFp,
    revisionCycle: cycle,
    critiqueRound: chainIn.critiqueRound + (opts.countRound ? 1 : 0),
    lastRevisedSections: revised,
    issues,
    converged: !issues.some(isOpenBlocking),
  };
  return viewOf(chain, live, { fullCritique: false, newOptionalIgnored });
}

/**
 * 두 번째 비평부터 — **AI 를 부르지 않는다.** 지난 BLOCKING 이 풀렸는가, 수정이 새 BLOCKING 을 만들었는가,
 * BLOCKING 이 남았는가만 코드로 잰다. 새 선택 항목은 세기만 한다.
 */
export function recheckChain(input: { title: string; html: string; chain: unknown }): ButtonCritique {
  const chain = sanitizeChain(input.chain);
  if (!chain) return openChain({ title: input.title, html: input.html, issues: buttonDiagnose(input) });
  return reconcile(chain, input, { countRound: true, edited: false });
}

/** 버튼 수정 뒤 — 수정 횟수를 올리고, 고친 구간·AI 지적의 결과를 반영해 다시 잰다 */
export function settleAfterEdit(input: {
  title: string;
  html: string;
  chain: CritiqueChain;
  revisedSections: number[];
  aiUpdates?: Map<string, AiUpdate>;
}): ButtonCritique {
  return reconcile(input.chain, input, {
    countRound: false,
    edited: input.revisedSections.length > 0,
    revisedSections: input.revisedSections,
    ...(input.aiUpdates ? { aiUpdates: input.aiUpdates } : {}),
  });
}

/* ────────────────────────────────────────────────────────────────
 * ④ 발행글 체인 파일 — 글마다 하나 (critique-chains.json)
 * ──────────────────────────────────────────────────────────────── */

export type ChainFile = Record<string, CritiqueChain>;
const MAX_CHAINS = 300;

export function loadChainFile(filePath: string): ChainFile {
  try {
    if (!fs.existsSync(filePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ChainFile : {};
  } catch {
    return {};
  }
}

export function saveChainFile(filePath: string, data: ChainFile): boolean {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 1), 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function chainOf(file: ChainFile, key: string): CritiqueChain | null {
  return sanitizeChain(file?.[String(key || '')]);
}

export function withChain(file: ChainFile, key: string, chain: CritiqueChain): ChainFile {
  const k = String(key || '').trim();
  if (!k) return file;
  const rest = Object.entries(file || {}).filter(([name]) => name !== k).slice(-(MAX_CHAINS - 1));
  return { ...Object.fromEntries(rest), [k]: chain };
}
