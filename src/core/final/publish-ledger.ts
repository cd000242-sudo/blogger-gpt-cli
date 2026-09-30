/**
 * 📒 발행 장부 — 매 발행의 측정값을 남긴다 (v3.8.632)
 *
 * ## 왜 만들었나
 * 사장님: "어떤 키워드가 RPM이 높은지는 글을 써봐야할수있으니까"
 *
 * 맞는 말이라서 문제가 생긴다. RPM 은 애드센스가 나중에 주고(9/21 복구 예정),
 * 그때 받은 수치를 **어느 글의 것인지** 이어붙이려면 지금 기록이 있어야 한다.
 * 지금은 하네스 점수도, 자기중복도도 **로그로 흘려보내고 끝**이다 —
 * 17일 뒤에 "중복도가 어땠나" 물으면 답할 수 없다.
 *
 * ## 무엇을 남기나
 * 재고 나서 사라지는 것들을 붙잡는다:
 *   · 하네스 점수와 잡힌 결함 종류      → 품질이 오르고 있나
 *   · 자기중복 최대 유사도               → 하루 3편 → 10편 으로 올려도 되나
 *   · 발행 전 자가 수정이 몇 번 돌았나   → 첫 생성이 좋아지고 있나
 *   · 리포트 슬롯·등급                   → RPM 이 오면 줄기별로 묶기 위해
 *
 * ## 원칙
 * 기록 실패가 발행을 막지 않는다. 장부는 있으면 좋은 것이지 발행 조건이 아니다.
 * 한 편의 수치는 못 믿는다 — **여러 편을 모아 봐야** 뜻이 생긴다.
 * 그래서 이 파일은 판단하지 않고 쌓기만 한다.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * v3.8.752 — 발행 시도는 장부 줄뿐 아니라 run 캡처 폴더(run-trace)에도 남는다.
 * main.ts 는 dist 경로 하나(publish-ledger)만 부르면 되도록 여기서 함께 내보낸다(run-trace 는 이 모듈에 기대지 않는다 — 순환 없음).
 */
export {
  appendPublishAttempt as appendRunTracePublishAttempt,
  isTraceEnabled as isRunTraceEnabled,
  traceRootDir as runTraceRootDir,
  codeIdentity as runTraceCodeIdentity,
} from './run-trace';

export interface LedgerEntry {
  /** 발행 시각 (ISO) */
  at: string;
  url: string;
  title: string;
  keyword: string;
  /** v3.8.776 — 생성 때의 작성자 요청 원문(없었으면 ''). 칸 자체가 없는 줄은 이 기능 전의 글(요청 여부 모름) */
  userRequest?: string;
  /** v3.8.776 — 요청 계약 지문(정규화 원문 + 구조 요구) */
  userRequestFingerprint?: string;
  /** 하네스 점수 0~100 */
  auditScore?: number;
  /** 잡힌 결함 종류별 개수 */
  auditKinds?: Record<string, number>;
  /** 자기중복 최대 유사도 (0~1) */
  selfOverlapMax?: number;
  /** 임계값을 넘은 기존 글 수 */
  selfOverlapHits?: number;
  /** 발행 전 자가 수정이 다시 쓴 구간 수 */
  preflightRevised?: number;
  /** 그때 AI 를 몇 번 불렀나 */
  preflightCalls?: number;
  /** 748 — 자가 수정에 든 비용(USD)·평문 글자 변화량. Judge 를 그 뒤로 옮긴 뒤 "이 단계가 값을 하는가" 를 장부로 본다 */
  preflightCostUsd?: number;
  preflightChangedChars?: number;
  /** 748 — Final Judge 가 무엇을 봤나: 발행 직전 HTML(visible-html) 인가 초안 객체(draft-object) 인가 */
  finalJudgeInput?: string;
  /**
   * v3.8.731 — 왜 못 고쳤는지(반려 사유)·무엇을 고쳤는지 한 줄씩. 최대 6줄.
   * 33편 중 2편만 고쳐진 것을 장부로는 알 수 없었다 — 로그로만 흘러갔다.
   */
  preflightNotes?: string[];
  /** v3.8.731 — 초안 감사(보강 호출 전) 결함 수 → 보강 뒤 결함 수. 보강이 안 돌았으면 둘 다 같다 */
  draftAuditBefore?: number;
  draftAuditAfter?: number;
  /** 리포트에서 온 것이면 슬롯·등급 */
  reportSlot?: string;
  reportGrade?: string;
  /** 이 글을 만드는 데 든 API 비용 (USD) — v3.8.650 */
  costUsd?: number;
  /**
   * v3.8.734 — 어느 모델이 **실제로** 썼는가.
   * 감사 실측: 시간초과가 나면 terra → luna 로 내려가는데, 그 사실이 console 에만 찍히고 장부엔 모델 칸조차 없었다.
   * 사용자는 고른 모델로 쓴 줄 안다. 이제 고른 것과 실제로 쓴 것을 나란히 남긴다.
   */
  requestedModel?: string;
  actualModel?: string;
  downgraded?: boolean;
  downgradeReason?: string;
  /**
   * v3.8.735 — Hard Gate 와 비평·수정 루프 기록.
   * auditScore 는 관문이 하나라도 FAIL 이면 89 를 넘지 못한다(원점수는 auditScoreRaw).
   */
  auditScoreRaw?: number;
  hardGates?: Record<string, boolean>;
  draftModel?: string;
  critic1Model?: string;
  revisionModels?: string;
  critic2Model?: string;
  finalJudgeModel?: string;
  criticCycles?: number;
  /** v3.8.736 — 품질 루프 호출 / 전체 호출 / 생성 호출 */
  qualityLoopCalls?: number;
  totalCalls?: number;
  baseGenerationCalls?: number;
  revisionCycles?: number;
  revisedSections?: number;
  unchangedSections?: number;
  /** v3.8.746 — Research Recovery(편집보다 검색이 먼저) 기록 */
  researchRecoveryTriggered?: boolean;
  researchQueries?: string;
  researchRecoverySearchCount?: number;
  evidenceAdded?: number;
  criticBeforeRecovery?: string;
  criticAfterRecovery?: string;
  recoveryCost?: number;
  editorCallsSaved?: number;
  finalDecision?: 'AUTO_PUBLISH' | 'MANUAL_REVIEW';
  /** v3.8.747 — 이 판정이 발행을 실제로 막는가(품질 루프 ON) · 루프가 켜져 있었는가 */
  publishHoldEnforced?: boolean;
  qualityLoopEnabled?: boolean;
  qualityConverged?: boolean;
  manualReviewReason?: string;
  /** v3.8.734 — 단계 상태 요약(SEARCH_OK · GROUNDING_WEAK …)과 근거 통계 */
  pipelineStatus?: string;
  evidence?: { total: number; official: number; withDate: number; withUrl: number; rejected: number; packet: string; searchDegraded?: boolean; rateLimited?: number; cacheHits?: number; apiCalls?: number; recovery?: number };
  /** 나중에 애드센스에서 채운다 */
  rpm?: number;
  pageviews?: number;
  /**
   * v3.8.752 — 생성 실행 ID. 발행 시도가 이 값으로 **이 줄**에 이어진다(제목이 같아도 다른 줄에 붙지 않는다).
   * 감사 실측(F13): 블로거 실패 → 워드프레스 재발행 성공이 publish-content 를 타면서 장부 url 이 빈칸으로 남았다.
   */
  runId?: string;
  /** 발행 시도 하나하나 — 실패도 남는다. 성공 url 은 entry.url 에도 올라간다(첫 성공만) */
  publishAttempts?: PublishAttempt[];
  /**
   * v3.8.752 (F12) — 품질 상태를 여섯 개념으로 가른 결과. quality-status.ts 가 만든다.
   * qualityConverged 만 보면 루프 OFF 도 '수렴' 처럼 읽혔다.
   */
  qualityLoopExecuted?: boolean;
  qualityLoopOutcome?: 'NOT_RUN' | 'CONVERGED' | 'NOT_CONVERGED' | 'ERROR';
  codeGatesPassed?: boolean;
  qualityStatusLabel?: string;
  /** auditScore 가 어느 원고를 잰 것인가 — 'final-html' = 자가 수정까지 끝난 발행 직전 HTML */
  auditScoreTarget?: string;
}

export interface PublishAttempt {
  attemptId: string;
  at: string;
  platform: string;
  /** 블로그 ID·사이트 주소 같은 대상 식별(비밀 없음) */
  target?: string;
  ok: boolean;
  url?: string;
  postId?: string;
  error?: string;
  /** 어느 창구에서 왔나 — run-post · publish-content · schedule … */
  source?: string;
}

export interface PublishAttemptInput {
  runId?: string | undefined;
  platform: string;
  target?: string | undefined;
  ok: boolean;
  url?: string | undefined;
  postId?: string | undefined;
  error?: string | undefined;
  source?: string | undefined;
}

export interface PublishAttemptRecord {
  attemptId: string;
  /** runId 로 장부 줄을 찾아 붙였나 */
  linked: boolean;
  /** 같은 성공 url 이 이미 있어 붙이지 않았나(재시도·같은 응답 재처리) */
  duplicate: boolean;
  /** runId 가 없거나 장부에 그 run 이 없어 미연결 파일에 남겼나 */
  unlinked: boolean;
}

/** 장부가 너무 커지지 않게 — 하루 10편이면 100일치 */
const MAX_ENTRIES = 1000;

/**
 * 장부 파일 위치 (v3.8.651).
 *
 * 예전에는 orchestration 안에만 있어서, 다른 파일이 장부를 건드리려면 같은 계산을
 * 한 벌 더 써야 했다 — 한쪽만 바뀌면 **서로 다른 파일**을 보게 된다.
 * 경로는 여기 한 곳에서만 정한다.
 */
export function defaultLedgerPath(): string {
  const injected = process.env['PUBLISH_LEDGER_PATH'];
  if (injected) return injected;
  const home = process.env['APPDATA'] || process.env['HOME'] || process.cwd();
  return path.join(home, 'blogger-gpt-cli', 'publish-ledger.json');
}

export function appendLedgerEntry(ledgerPath: string, entry: LedgerEntry): boolean {
  try {
    let entries: LedgerEntry[] = [];
    if (fs.existsSync(ledgerPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
        if (Array.isArray(parsed)) entries = parsed;
      } catch {
        // 깨진 장부는 버리고 새로 시작한다 — 기록 하나 때문에 발행을 막지 않는다
        entries = [];
      }
    }
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    fs.writeFileSync(ledgerPath, JSON.stringify(entries, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 🔗 발행이 끝난 뒤 그 줄에 주소를 채운다 (v3.8.651).
 *
 * ## 왜 나중에 채우나
 * 장부는 **생성이 끝날 때** 쓰인다. 발행은 그 다음이라 그 시점엔 주소를 모른다.
 * 그래서 url 이 늘 비어 있었다.
 *
 * ## 왜 주소가 필요한가
 * 사장님: "생성된 글목록에 글 rpm 값도 보이게 가능하겠네?"
 * 애드센스는 **페이지 주소별**로 RPM 을 준다. 글목록은 이미 주소를 들고 있으니
 * RPM 표시 자체는 장부 없이도 된다 — 다만 **편당 비용**(costUsd)은 장부에 있다.
 * "250원 써서 얼마 벌었나" 를 보려면 둘을 이어야 하고, 그 열쇠가 주소다.
 * 제목으로 잇는 것도 되지만 제목은 나중에 고쳐진다(오늘 실제로 한 편 고쳤다).
 *
 * 가장 최근 줄부터 거슬러 보며 **주소가 아직 빈 줄** 중 제목이 맞는 것을 채운다.
 * 같은 제목으로 여러 번 발행했어도 방금 것이 잡힌다.
 */
export function attachUrlToLedger(ledgerPath: string, title: string, url: string): boolean {
  const cleanUrl = String(url || '').trim();
  const cleanTitle = String(title || '').trim();
  if (!cleanUrl || !cleanTitle) return false;

  try {
    const entries = readLedger(ledgerPath);
    if (entries.length === 0) return false;
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!;
      if (e.url) continue;                       // 이미 채워진 줄은 건너뛴다
      if (String(e.title || '').trim() !== cleanTitle) continue;
      e.url = cleanUrl;
      fs.writeFileSync(ledgerPath, JSON.stringify(entries, null, 2), 'utf-8');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 미연결 시도가 쌓이는 곳 — 장부 옆 파일. run 이 없는 발행(편집기 새 글·옛 대기열)도 사라지지 않는다 */
export function unlinkedAttemptsPath(ledgerPath: string): string {
  return path.join(path.dirname(ledgerPath), 'publish-attempts-unlinked.json');
}

const MAX_UNLINKED = 500;

function newAttemptId(): string {
  return `pa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function toAttempt(input: PublishAttemptInput, attemptId: string): PublishAttempt {
  return {
    attemptId,
    at: new Date().toISOString(),
    platform: String(input.platform || ''),
    ...(input.target ? { target: String(input.target) } : {}),
    ok: input.ok === true,
    ...(input.url ? { url: String(input.url).trim() } : {}),
    ...(input.postId ? { postId: String(input.postId) } : {}),
    ...(input.error ? { error: String(input.error).slice(0, 300) } : {}),
    ...(input.source ? { source: String(input.source) } : {}),
  };
}

function appendUnlinked(ledgerPath: string, attempt: PublishAttempt, runId: string | undefined, reason: string): void {
  try {
    const file = unlinkedAttemptsPath(ledgerPath);
    let list: unknown[] = [];
    if (fs.existsSync(file)) {
      try { const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')); if (Array.isArray(parsed)) list = parsed; } catch { list = []; }
    }
    const next = [...list, { ...attempt, ...(runId ? { runId } : {}), unlinkedReason: reason }].slice(-MAX_UNLINKED);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf-8');
  } catch { /* 미연결 기록 실패도 발행을 막지 않는다 */ }
}

/**
 * 🔗 v3.8.752 — 발행 시도를 **run ID 로** 장부 줄에 잇는다 (감사 F13).
 *
 * attachUrlToLedger(제목으로 잇기)는 A 글에서 빈칸을 남겼다: 블로거 실패 뒤 워드프레스 재발행이
 * publish-content 를 타는데 거기엔 장부 배선이 없었고, 있었더라도 제목이 같은 다른 글에 붙을 수 있었다.
 *
 * 규칙:
 *   · runId 가 없으면 제목으로 추측하지 않는다 — 미연결 파일에 남긴다
 *   · 실패도 남긴다. 실패가 앞선 성공 url 을 지우지 않는다
 *   · 같은 성공 url 이 이미 붙어 있으면 두 번 붙이지 않는다(재시도·같은 응답 재처리)
 *   · entry.url 은 첫 성공 url 만 — 다른 플랫폼 성공은 publishAttempts 에 남는다
 *   · 지난 글은 손대지 않는다(runId 가 없으니 어차피 못 잇는다)
 */
export function recordPublishAttempt(ledgerPath: string, input: PublishAttemptInput): PublishAttemptRecord {
  const attemptId = newAttemptId();
  const attempt = toAttempt(input, attemptId);
  const runId = String(input.runId || '').trim();
  const none = { attemptId, linked: false, duplicate: false, unlinked: true };
  if (!runId) { appendUnlinked(ledgerPath, attempt, undefined, 'NO_RUN_ID'); return none; }

  try {
    const entries = readLedger(ledgerPath);
    let index = -1;
    for (let i = entries.length - 1; i >= 0; i--) { if (String(entries[i]?.runId || '') === runId) { index = i; break; } }
    if (index < 0) { appendUnlinked(ledgerPath, attempt, runId, 'RUN_NOT_IN_LEDGER'); return none; }

    const entry = entries[index]!;
    const attempts = Array.isArray(entry.publishAttempts) ? entry.publishAttempts : [];
    if (attempt.ok && attempt.url && attempts.some((a) => a.ok && a.url === attempt.url)) {
      return { attemptId, linked: true, duplicate: true, unlinked: false };
    }
    const updated: LedgerEntry = {
      ...entry,
      publishAttempts: [...attempts, attempt],
      ...(attempt.ok && attempt.url && !entry.url ? { url: attempt.url } : {}),
    };
    const next = entries.map((e, i) => (i === index ? updated : e));
    fs.writeFileSync(ledgerPath, JSON.stringify(next, null, 2), 'utf-8');
    return { attemptId, linked: true, duplicate: false, unlinked: false };
  } catch {
    appendUnlinked(ledgerPath, attempt, runId, 'LEDGER_WRITE_FAILED');
    return none;
  }
}

export function readLedger(ledgerPath: string): LedgerEntry[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface LedgerSummary {
  count: number;
  /** 하네스 점수 — 중간값을 쓴다. 한 편이 튀어도 안 흔들리게 */
  medianScore: number | null;
  /** 최근 10편의 중간값 — 좋아지고 있는지 본다 */
  recentMedianScore: number | null;
  /** 자기중복이 임계를 넘은 편수 */
  overlapFlagged: number;
  /** 가장 자주 잡힌 결함 */
  topIssues: { kind: string; count: number }[];
  /** 자가 수정이 돌아간 비율 — 낮아질수록 첫 생성이 좋아진 것이다 */
  revisedRate: number | null;
}

function median(nums: number[]): number | null {
  const xs = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

/** 임계값 0.35 — self-overlap.ts 의 실측 분포에서 나온 값 (322편 51,681쌍) */
export const OVERLAP_THRESHOLD = 0.35;

export function summarizeLedger(entries: LedgerEntry[], recentN = 10): LedgerSummary {
  const scores = entries.map((e) => e.auditScore).filter((n): n is number => typeof n === 'number');
  const recent = entries.slice(-recentN).map((e) => e.auditScore).filter((n): n is number => typeof n === 'number');

  const tally = new Map<string, number>();
  for (const e of entries) {
    for (const [kind, n] of Object.entries(e.auditKinds || {})) {
      tally.set(kind, (tally.get(kind) || 0) + Number(n || 0));
    }
  }

  const revised = entries.filter((e) => typeof e.preflightRevised === 'number');
  return {
    count: entries.length,
    medianScore: median(scores),
    recentMedianScore: median(recent),
    overlapFlagged: entries.filter((e) => (e.selfOverlapMax || 0) > OVERLAP_THRESHOLD).length,
    topIssues: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([kind, count]) => ({ kind, count })),
    revisedRate: revised.length === 0 ? null : revised.filter((e) => (e.preflightRevised || 0) > 0).length / revised.length,
  };
}

/** 사람이 읽을 한 줄 */
export function describeLedger(summary: LedgerSummary): string {
  if (summary.count === 0) return '발행 장부가 비어 있습니다';
  const parts = [`${summary.count}편`];
  if (summary.medianScore !== null) parts.push(`품질 중간값 ${summary.medianScore}점`);
  if (summary.recentMedianScore !== null && summary.count > 10) parts.push(`최근 10편 ${summary.recentMedianScore}점`);
  if (summary.overlapFlagged > 0) parts.push(`중복 경고 ${summary.overlapFlagged}편`);
  if (summary.revisedRate !== null) parts.push(`자가수정 ${Math.round(summary.revisedRate * 100)}%`);
  return parts.join(' · ');
}
