/**
 * 🧾 run-trace — 한 번의 생성 실행이 지나간 단계별 산출물을 **로컬 폴더에** 보존한다 (v3.8.752).
 *
 * ## 왜 만들었나
 * 2026-09-29 발행본 4편 감사: 답 상자의 조건이 사라지고 목록 항목이 지워졌는데, 그 일이
 * 검색·패킷·Writer·사실 필터 가운데 **어디서** 났는지 아무 데도 남아 있지 않았다.
 * 검색 캐시는 당일 버킷만, 패킷·초안·삭제 전후·publish payload 는 어디에도 없었다.
 * 로그는 "2건 제거" 라고만 말하고 무엇을 제거했는지는 말하지 않았다.
 *
 * ## 원칙 (지시서 §5)
 *   · **관측만 한다.** 켜고 끄는 것이 프롬프트·모델·검색어·호출 순서·생성 결과·품질 판단·호출 수를 바꾸면 안 된다.
 *     그래서 이 모듈은 값을 돌려주지 않는다 — 호출자는 반환값을 흐름에 쓰지 않는다(SnapshotRef 는 기록용 id 일 뿐).
 *   · **절대 던지지 않는다.** 저장 실패가 이미 완성된 글을 버리게 하면 안 된다. 실패는 manifest 의 capture 에 적힌다.
 *   · **로컬만.** 외부 업로드 없음. 키·토큰·쿠키·Authorization·전체 환경변수는 저장하지 않는다(redact).
 *   · **부분 저장을 전체 저장이라 하지 않는다.** 용량 초과·쓰기 실패는 PARTIAL 로 남고 스냅샷 항목에 stored:false 가 붙는다.
 *   · **스냅샷은 그 순간의 값이다.** 쓰는 즉시 파일이라 뒤에서 객체를 고쳐도 파일은 안 바뀐다(해시로 확인 가능).
 *   · 보존 정책은 run-traces/ 아래 run ID 꼴 폴더만 건드린다. 다른 파일·감사 원본·기존 자료는 손대지 않는다. `.keep` 이 있으면 남긴다.
 *
 * ## 켜는 법
 *   환경변수 `RUN_TRACE=1` (앱 .env 에 적으면 main.ts 가 부팅 때 process.env 로 옮긴다) 또는 payload.runTrace === true.
 *   저장 위치: `RUN_TRACE_DIR` 또는 %APPDATA%\blogger-gpt-cli\run-traces\<runId>\
 *   용량 상한 `RUN_TRACE_MAX_MB`(기본 64) · 보존 개수 `RUN_TRACE_KEEP`(기본 30).
 *
 * ## 실행 문맥
 *   orchestration 이 run 을 시작할 때 bindActiveTrace 로 매고 finally 에서 뗀다. 다른 파일(generation 등)은
 *   currentTrace() 로 얻는다 — 함수 서명을 바꾸지 않기 위해서다. 꺼져 있으면 아무것도 안 하는 NOOP 이 돌아온다.
 *   테스트·병렬 실행은 runWithTrace(AsyncLocalStorage)로 격리한다.
 */

import { AsyncLocalStorage } from 'async_hooks';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const RUN_ID_PATTERN = /^\d{8}-\d{6}-[0-9a-f]{6}$/;

export interface SnapshotRef {
  id: string;
  stage: string;
  file: string;
  sha1: string;
  bytes: number;
  at: string;
  stored: boolean;
  reason?: string;
  note?: string;
}

export interface TraceCapture {
  status: 'IN_PROGRESS' | 'COMPLETE' | 'PARTIAL' | 'FAILED';
  failures: string[];
  bytesWritten: number;
  capBytes: number;
}

export interface TraceManifest {
  runId: string;
  startedAt: string;
  startedAtKst: string;
  timezone: string;
  appVersion: string;
  codeIdentity: Record<string, unknown>;
  requested: Record<string, unknown>;
  actual: Record<string, unknown>;
  snapshots: SnapshotRef[];
  counts: { events: number; changes: number; checks: number; publishAttempts: number };
  capture: TraceCapture;
  outcome?: string;
  endedAt?: string;
  endedAtKst?: string;
  [k: string]: unknown;
}

export interface ChangeFields {
  fn?: string;
  before?: SnapshotRef | null;
  after?: SnapshotRef | null;
  beforeText?: string;
  afterText?: string;
  sectionId?: string;
  reason?: string;
  evidenceIds?: string[];
  judgeable?: boolean;
  [k: string]: unknown;
}

export interface CheckFields {
  status: 'RUN' | 'NOT_RUN' | 'FAILED';
  artifact?: SnapshotRef | null;
  result?: unknown;
  changedAfter?: boolean;
  [k: string]: unknown;
}

export interface RunTracer {
  readonly runId: string;
  readonly enabled: boolean;
  readonly dir: string | null;
  meta(partial: Record<string, unknown>): void;
  snapshot(stage: string, data: unknown, opts?: { ext?: 'json' | 'txt' | 'html'; note?: string }): SnapshotRef | null;
  event(stage: string, fields?: Record<string, unknown>): void;
  change(stage: string, fields: ChangeFields): void;
  check(name: string, fields: CheckFields): void;
  finish(outcome: 'OK' | 'FAILED' | 'CANCELED', fields?: Record<string, unknown>): void;
}

// ───────────────────────────── 시각 · ID ─────────────────────────────

/** KST 표기 — 사장님 로그는 "오후 11:46:47" 이고 장부는 UTC ISO 라 둘 다 남긴다 */
export function kstStamp(now: Date = new Date()): { compact: string; text: string } {
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  const ymd = `${k.getUTCFullYear()}${p(k.getUTCMonth() + 1)}${p(k.getUTCDate())}`;
  const hms = `${p(k.getUTCHours())}${p(k.getUTCMinutes())}${p(k.getUTCSeconds())}`;
  return {
    compact: `${ymd}-${hms}`,
    text: `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}:${p(k.getUTCSeconds())} KST`,
  };
}

export function newRunId(now: Date = new Date()): string {
  return `${kstStamp(now).compact}-${crypto.randomBytes(3).toString('hex')}`;
}

// ───────────────────────────── 설정 ─────────────────────────────

export function isTraceEnabled(payload?: { runTrace?: unknown } | null): boolean {
  return process.env['RUN_TRACE'] === '1' || payload?.runTrace === true;
}

export function traceRootDir(): string {
  const injected = process.env['RUN_TRACE_DIR'];
  if (injected) return injected;
  const home = process.env['APPDATA'] || process.env['HOME'] || process.cwd();
  return path.join(home, 'blogger-gpt-cli', 'run-traces');
}

function capBytes(): number {
  const mb = Number(process.env['RUN_TRACE_MAX_MB']);
  return (Number.isFinite(mb) && mb > 0 ? mb : 64) * 1024 * 1024;
}

function keepCount(): number {
  const n = Number(process.env['RUN_TRACE_KEEP']);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 30;
}

// ───────────────────────────── 가리기 ─────────────────────────────

/** 키 이름으로 가린다 — keyword 는 남기고(…word), apiKey·secretKey·accessToken·cookie·authorization 은 가린다 */
const SECRET_KEY = /(api[_-]?key|apikey|secret|token|password|passwd|pwd|cookie|authorization|credential|client[_-]?id|refresh|bearer|session)/i;
const KEY_SUFFIX = /key$/i;
/** 값 꼴로 가린다 — 키 이름이 평범해도 값이 토큰이면 가린다 */
const SECRET_VALUE = /(\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_.-]{20,}|1\/\/0[0-9A-Za-z_-]{20,}|pplx-[A-Za-z0-9]{16,}|xox[abp]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,})\b|Bearer\s+[A-Za-z0-9._-]{16,})/g;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key) || KEY_SUFFIX.test(key);
}

export function redactString(s: string): string {
  return s.replace(SECRET_VALUE, '[REDACTED]');
}

/** 깊은 복사 + 가리기. 순환·함수·심볼은 표식으로 바꾼다. 원본은 손대지 않는다 */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);
    if (Array.isArray(value)) return value.map((v) => redact(v, seen));
    if (Buffer.isBuffer(value)) return `[Buffer ${value.length}B]`;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecretKey(k) && v !== null && v !== undefined && v !== '' ? '[REDACTED]' : redact(v, seen);
    }
    return out;
  }
  return String(value);
}

// ───────────────────────────── 문장 diff ─────────────────────────────

export function stripTags(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentencesOf(text: string): string[] {
  return stripTags(text).split(/(?<=[.!?。])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 6);
}

/** 전후 문장 집합의 차 — "무엇이 지워졌고 무엇이 들어왔나". 순서 변화는 잡지 않는다(그건 diff 의 몫이 아니다) */
export function diffSentences(before: string, after: string): { removed: string[]; added: string[]; beforeChars: number; afterChars: number } {
  const b = sentencesOf(before);
  const a = sentencesOf(after);
  const bs = new Set(b);
  const as = new Set(a);
  return {
    removed: b.filter((s) => !as.has(s)),
    added: a.filter((s) => !bs.has(s)),
    beforeChars: stripTags(before).length,
    afterChars: stripTags(after).length,
  };
}

// ───────────────────────────── 보존 정책 ─────────────────────────────

/** run ID 꼴 폴더만, .keep 없는 것만, 오래된 것부터. 다른 파일·폴더는 절대 건드리지 않는다 */
export function pruneTraceDirs(root: string, keep: number): string[] {
  const removed: string[] = [];
  try {
    if (!fs.existsSync(root)) return removed;
    const runs = fs.readdirSync(root)
      .filter((name) => RUN_ID_PATTERN.test(name))
      .filter((name) => { try { return fs.statSync(path.join(root, name)).isDirectory(); } catch { return false; } })
      .filter((name) => !fs.existsSync(path.join(root, name, '.keep')))
      .sort();
    const excess = runs.slice(0, Math.max(0, runs.length - keep));
    for (const name of excess) {
      try { fs.rmSync(path.join(root, name), { recursive: true, force: true }); removed.push(name); } catch { /* 정리 실패는 무시 */ }
    }
  } catch { /* 정리는 있으면 좋은 것 */ }
  return removed;
}

// ───────────────────────────── 구현 ─────────────────────────────

function sha1(s: string): string {
  return crypto.createHash('sha1').update(s, 'utf8').digest('hex');
}

function safeStringify(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch (e: any) { return JSON.stringify({ __unserializable: String(e?.message || e) }); }
}

function packageVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../../package.json');
    return String(pkg?.version || '');
  } catch { return String(process.env['npm_package_version'] || ''); }
}

class FileTracer implements RunTracer {
  readonly enabled = true;
  readonly runId: string;
  readonly dir: string;
  private manifest: TraceManifest;
  private seq = 0;
  private snapCount = 0;
  private closed = false;

  constructor(runId: string, dir: string, requested: Record<string, unknown>) {
    this.runId = runId;
    this.dir = dir;
    const now = new Date();
    this.manifest = {
      runId,
      startedAt: now.toISOString(),
      startedAtKst: kstStamp(now).text,
      timezone: `local offset ${-now.getTimezoneOffset()} min · 표기는 KST(UTC+9)`,
      appVersion: packageVersion(),
      codeIdentity: { moduleDir: __dirname.replace(/\\/g, '/'), packaged: /app\.asar/i.test(__dirname), gitSha: String(process.env['GIT_SHA'] || '') },
      requested: redact(requested) as Record<string, unknown>,
      actual: {},
      snapshots: [],
      counts: { events: 0, changes: 0, checks: 0, publishAttempts: 0 },
      capture: { status: 'IN_PROGRESS', failures: [], bytesWritten: 0, capBytes: capBytes() },
    };
    this.writeManifest();
  }

  private fail(where: string, err: unknown): void {
    const msg = `${where}: ${String((err as any)?.message || err).slice(0, 160)}`;
    this.manifest.capture.failures.push(msg);
    if (this.manifest.capture.status !== 'FAILED') this.manifest.capture.status = 'PARTIAL';
  }

  private writeManifest(): void {
    try {
      fs.writeFileSync(path.join(this.dir, 'manifest.json'), safeStringify(this.manifest), 'utf8');
    } catch (e) {
      // manifest 조차 못 쓰면 이 실행의 캡처는 FAILED — 하지만 글 생성은 계속 간다
      this.manifest.capture.status = 'FAILED';
      this.manifest.capture.failures.push(`manifest: ${String((e as any)?.message || e).slice(0, 160)}`);
    }
  }

  private appendLine(file: string, record: Record<string, unknown>): boolean {
    try {
      const line = JSON.stringify(redact(record));
      const bytes = Buffer.byteLength(line, 'utf8') + 1;
      if (this.manifest.capture.bytesWritten + bytes > this.manifest.capture.capBytes) {
        this.fail(`${file}#${record['seq']}`, new Error('SIZE_CAP'));
        this.writeManifest();
        return false;
      }
      fs.appendFileSync(path.join(this.dir, file), `${line}\n`, 'utf8');
      this.manifest.capture.bytesWritten += bytes;
      return true;
    } catch (e) {
      this.fail(`${file}#${record['seq']}`, e);
      this.writeManifest();
      return false;
    }
  }

  private nextSeq(): number { this.seq += 1; return this.seq; }

  meta(partial: Record<string, unknown>): void {
    try {
      this.manifest.actual = { ...this.manifest.actual, ...(redact(partial) as Record<string, unknown>) };
      this.writeManifest();
    } catch (e) { this.fail('meta', e); }
  }

  snapshot(stage: string, data: unknown, opts?: { ext?: 'json' | 'txt' | 'html'; note?: string }): SnapshotRef | null {
    if (this.closed) return null;
    const at = new Date().toISOString();
    this.snapCount += 1;
    const ext = opts?.ext || (typeof data === 'string' ? 'txt' : 'json');
    const id = `${String(this.snapCount).padStart(3, '0')}-${stage.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
    const file = `${id}.${ext}`;
    let body = '';
    try {
      body = typeof data === 'string' ? redactString(data) : safeStringify(redact(data));
    } catch (e) {
      this.fail(`snapshot ${stage}`, e);
      const ref: SnapshotRef = { id, stage, file, sha1: '', bytes: 0, at, stored: false, reason: 'SERIALIZE_FAILED', ...(opts?.note ? { note: opts.note } : {}) };
      this.manifest.snapshots.push(ref);
      this.writeManifest();
      return ref;
    }
    const bytes = Buffer.byteLength(body, 'utf8');
    const ref: SnapshotRef = { id, stage, file, sha1: sha1(body), bytes, at, stored: false, ...(opts?.note ? { note: opts.note } : {}) };
    if (this.manifest.capture.bytesWritten + bytes > this.manifest.capture.capBytes) {
      this.fail(`snapshot ${stage}`, new Error('SIZE_CAP'));
      this.manifest.snapshots.push({ ...ref, reason: 'SIZE_CAP' });
      this.writeManifest();
      return { ...ref, reason: 'SIZE_CAP' };
    }
    try {
      fs.writeFileSync(path.join(this.dir, file), body, 'utf8');
      this.manifest.capture.bytesWritten += bytes;
      const stored = { ...ref, stored: true };
      this.manifest.snapshots.push(stored);
      this.writeManifest();
      return stored;
    } catch (e) {
      this.fail(`snapshot ${stage}`, e);
      const failed = { ...ref, reason: 'WRITE_FAILED' };
      this.manifest.snapshots.push(failed);
      this.writeManifest();
      return failed;
    }
  }

  event(stage: string, fields: Record<string, unknown> = {}): void {
    if (this.closed) return;
    const ok = this.appendLine('events.jsonl', { seq: this.nextSeq(), at: new Date().toISOString(), kind: 'event', stage, ...fields });
    if (ok) this.manifest.counts.events += 1;
  }

  change(stage: string, fields: ChangeFields): void {
    if (this.closed) return;
    const { beforeText, afterText, ...rest } = fields;
    const diff = typeof beforeText === 'string' && typeof afterText === 'string' ? diffSentences(beforeText, afterText) : null;
    const record: Record<string, unknown> = {
      seq: this.nextSeq(), at: new Date().toISOString(), kind: 'change', stage,
      ...rest,
      before: rest.before ? { id: rest.before.id, sha1: rest.before.sha1 } : null,
      after: rest.after ? { id: rest.after.id, sha1: rest.after.sha1 } : null,
      ...(diff ? { removed: diff.removed, added: diff.added, beforeChars: diff.beforeChars, afterChars: diff.afterChars } : {}),
      ...(rest.reason ? {} : { reason: '세부 사유 미제공' }),
      judgeable: typeof rest.judgeable === 'boolean' ? rest.judgeable : !!rest.reason,
    };
    const ok = this.appendLine('events.jsonl', record);
    if (ok) this.manifest.counts.changes += 1;
  }

  check(name: string, fields: CheckFields): void {
    if (this.closed) return;
    const ok = this.appendLine('checks.jsonl', {
      seq: this.nextSeq(), at: new Date().toISOString(), kind: 'check', name,
      ...fields,
      artifact: fields.artifact ? { id: fields.artifact.id, sha1: fields.artifact.sha1 } : null,
    });
    if (ok) this.manifest.counts.checks += 1;
  }

  finish(outcome: 'OK' | 'FAILED' | 'CANCELED', fields: Record<string, unknown> = {}): void {
    if (this.closed) return;
    this.closed = true;
    const now = new Date();
    this.manifest = {
      ...this.manifest,
      ...(redact(fields) as Record<string, unknown>),
      outcome,
      endedAt: now.toISOString(),
      endedAtKst: kstStamp(now).text,
      capture: { ...this.manifest.capture, status: this.manifest.capture.status === 'IN_PROGRESS' ? 'COMPLETE' : this.manifest.capture.status },
    };
    this.writeManifest();
  }
}

const NOOP: RunTracer = {
  runId: '',
  enabled: false,
  dir: null,
  meta() { /* 꺼져 있다 */ },
  snapshot() { return null; },
  event() { /* 꺼져 있다 */ },
  change() { /* 꺼져 있다 */ },
  check() { /* 꺼져 있다 */ },
  finish() { /* 꺼져 있다 */ },
};

export function noopTrace(): RunTracer { return NOOP; }

/**
 * run 하나의 캡처를 연다. 꺼져 있거나 폴더를 못 만들면 NOOP — 생성은 그대로 간다.
 * runId 는 호출자가 준다(장부·결과·발행 시도가 같은 ID 를 써야 이어진다).
 */
export function startRunTrace(input: { runId: string; enabled: boolean; requested?: Record<string, unknown>; dir?: string }): RunTracer {
  if (!input.enabled) return NOOP;
  try {
    const root = input.dir || traceRootDir();
    const dir = path.join(root, input.runId);
    fs.mkdirSync(dir, { recursive: true });
    pruneTraceDirs(root, keepCount());
    return new FileTracer(input.runId, dir, input.requested || {});
  } catch (e) {
    console.warn('[RUN-TRACE] 캡처 폴더를 못 만들어 캡처 없이 진행합니다:', String((e as any)?.message || e).slice(0, 120));
    return NOOP;
  }
}

// ───────────────────────────── 실행 문맥 ─────────────────────────────

const als = new AsyncLocalStorage<RunTracer>();
let activeTracer: RunTracer | null = null;

/** orchestration 이 run 시작에 맨다(엔진 락 안이라 한 프로세스에 하나). finally 에서 unbind */
export function bindActiveTrace(tracer: RunTracer): void { activeTracer = tracer; }
export function unbindActiveTrace(tracer: RunTracer): void { if (activeTracer === tracer) activeTracer = null; }

/** 테스트·병렬 실행 격리용 — 이 안에서 currentTrace() 는 이 tracer 다 */
export function runWithTrace<T>(tracer: RunTracer, fn: () => T): T {
  return als.run(tracer, fn);
}

/** 어디서든 — 꺼져 있으면 NOOP. 호출자는 반환값을 흐름에 쓰지 않는다 */
export function currentTrace(): RunTracer {
  return als.getStore() || activeTracer || NOOP;
}

// ───────────────────────────── 발행 시도 (run 문맥 밖에서) ─────────────────────────────

/**
 * 발행은 생성이 끝난 뒤 다른 IPC 에서 일어난다(재발행이면 몇 분 뒤). run 폴더가 있으면 거기에 잇는다.
 * 폴더가 없으면(캡처 OFF 였거나 정리됨) false — 장부의 recordPublishAttempt 가 따로 남긴다.
 */
export function appendPublishAttempt(runId: string, fields: Record<string, unknown>, root: string = traceRootDir()): boolean {
  try {
    if (!runId || !RUN_ID_PATTERN.test(runId)) return false;
    const dir = path.join(root, runId);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return false;
    const now = new Date();
    fs.appendFileSync(path.join(dir, 'publish-attempts.jsonl'), `${JSON.stringify(redact({ at: now.toISOString(), atKst: kstStamp(now).text, kind: 'publish', ...fields }))}\n`, 'utf8');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as TraceManifest;
      const counts = { ...(manifest.counts || { events: 0, changes: 0, checks: 0, publishAttempts: 0 }) };
      counts.publishAttempts = (counts.publishAttempts || 0) + 1;
      fs.writeFileSync(manifestPath, safeStringify({ ...manifest, counts }), 'utf8');
    } catch { /* 계수 갱신 실패는 시도 기록을 무효로 만들지 않는다 */ }
    return true;
  } catch {
    return false;
  }
}
