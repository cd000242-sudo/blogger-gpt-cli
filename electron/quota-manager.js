"use strict";
/**
 * electron/quota-manager.ts
 * 일일 무료 사용 쿼터 관리 — HMAC 서명 + 변조 감지 + 날짜 롤백 방지
 *
 * 네이버 자동화 앱의 quotaManager.ts를 참고하여 blogger-gpt-cli에 맞게 간소화.
 * publish 카운터 하나만 관리 (content/media/imageApi 불필요).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsageToday = getUsageToday;
exports.getQuotaStatus = getQuotaStatus;
exports.canConsume = canConsume;
exports.consume = consume;
exports.consumeIfAvailable = consumeIfAvailable;
exports.refund = refund;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// ── 보안 ──
const _INTERNAL_SALT = Buffer.from('T3JiaXRRdW90YVNhbHQyMDI2', 'base64').toString('utf-8');
const COMPLETED_PUBLISH_POLICY_VERSION = 2;
/** 날짜별 기록 보관 일수 — 시계 조작 방어에 필요한 만큼만 */
const HISTORY_KEEP_DAYS = 21;
/** history 를 서명에 넣기 위해 안정적인 문자열로 만든다 (키 순서 고정) */
function serializeHistory(history) {
    const entries = Object.entries(history || {})
        .filter(([, v]) => Number.isFinite(Number(v)))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}:${Number(v)}`);
    return entries.join(',');
}
function computeSignature(state) {
    const payload = Number(state.policyVersion || 0) >= COMPLETED_PUBLISH_POLICY_VERSION
        ? JSON.stringify({
            v: COMPLETED_PUBLISH_POLICY_VERSION,
            d: state.date,
            p: state.publish,
            l: state.lastSeenDate || state.date,
            // v3.8.461: history 도 서명 대상 — 아니면 기록만 지워 우회할 수 있다
            h: serializeHistory(state.history),
        })
        : JSON.stringify({
            d: state.date,
            p: state.publish,
            l: state.lastSeenDate || state.date,
        });
    return crypto.createHmac('sha256', _INTERNAL_SALT).update(payload).digest('hex').substring(0, 16);
}
function verifySignature(state) {
    const expected = computeSignature(state);
    return state._sig === expected;
}
// ── 유틸 ──
function getLocalDateKey() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function getStorageFile() {
    try {
        return path.join(electron_1.app.getPath('userData'), 'quota-state.json');
    }
    catch {
        return path.join(process.cwd(), 'quota-state.json');
    }
}
function getBackupFile() {
    return getStorageFile().replace('.json', '.backup.json');
}
/**
 * 🗃️ v3.8.461 — userData 밖의 3번째 사본.
 *
 * 실측 공격: quota-state.json 과 .backup.json 을 지우면 사용량이 0 으로 돌아가
 * 하루 제한이 무의미해졌다. 앱 데이터 폴더를 통째로 지워도 남는 위치에 하나 더
 * 둔다(티스토리 프로필·네이버 세션과 같은 폴더).
 * 읽을 때 세 곳 중 **가장 큰 사용량**을 채택하므로 한 곳만 지워선 초기화되지 않는다.
 * 정상 사용자에게는 영향이 없다 — 새 설치면 세 곳 모두 없으니 0 이다.
 */
function getMirrorFile() {
    let home = '';
    try {
        home = electron_1.app.getPath('home');
    }
    catch { /* 테스트/비-Electron 환경 */ }
    return path.join(home || os.homedir(), '.leadernam-orbit', 'quota-state.json');
}
/**
 * 이 실행 동안 확인된 최소 사용량. 디스크가 실패하거나 앱이 도는 중에 상태
 * 파일이 지워져도 여기 값 아래로는 내려가지 않는다.
 */
let sessionFloor = { date: '', publish: 0 };
const TAMPERED_STATE = (date) => ({
    date,
    publish: 999,
});
const EMPTY_STATE = (date) => ({
    date,
    publish: 0,
    policyVersion: COMPLETED_PUBLISH_POLICY_VERSION,
});
// ── 읽기 ──
/** 파일 하나를 읽어 검증까지 마친 상태로 돌려준다. 못 읽거나 위조면 null. */
function readOneFile(file) {
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    }
    catch {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return { state: null, tampered: true };
    }
    if (!parsed || typeof parsed.date !== 'string')
        return { state: null, tampered: true };
    /**
     * 🔐 v3.8.461 — **서명이 없으면 위조로 본다. 구버전(v1)도 예외가 아니다.**
     *
     * 예전 코드는 `if (parsed._sig) { 검증 }` 이라 _sig 필드를 통째로 지우면
     * 검증이 통째로 건너뛰어졌다. 실측 공격으로 확인: _sig 삭제 + publish=0 →
     * 사용량 0 으로 초기화 성공.
     * v1 을 검증에서 빼면 더 나쁘다 — 서명 없는 `{date, publish:0}` 한 줄로
     * "정책 이관"을 유도해 세 사본을 전부 0 으로 덮을 수 있다. computeSignature 가
     * v1 payload 도 계산하므로 진짜 구버전 파일은 그대로 통과한다.
     */
    if (!parsed._sig || !verifySignature(parsed)) {
        return { state: null, tampered: true };
    }
    return { state: parsed, tampered: false };
}
async function readState() {
    const today = getLocalDateKey();
    const files = [getStorageFile(), getBackupFile(), getMirrorFile()];
    const loaded = files.map(readOneFile);
    const valid = loaded.filter((r) => !!r && !r.tampered && !!r.state);
    const anyTampered = loaded.some((r) => r && r.tampered);
    /** 이번 실행에서 이미 확인된 오늘 사용량 — 파일이 어떻게 되든 이 아래로는 안 내려간다 */
    const floor = sessionFloor.date === today ? sessionFloor.publish : 0;
    // 세 곳 모두 없으면 새 설치이거나 첫 실행 — 정상적으로 0 에서 시작한다
    if (valid.length === 0) {
        if (anyTampered) {
            /**
             * 🩹 v3.8.461 — 오늘은 막되, **영원히 막지는 않는다.**
             *
             * 예전에는 손상 상태를 저장하지 않아서, 세 사본이 모두 깨지면 다음 날에도
             * 그 다음 날에도 계속 999 로 읽혀 **리셋이 영영 안 됐다**. 백신 격리나
             * 동기화 도구가 파일을 건드리기만 해도 정상 사용자가 영구 잠금된다.
             * 한도까지 채운 정상 상태로 갈아 끼우면 오늘은 그대로 차단되고(조작자는
             * 얻는 게 없다) 날짜가 바뀌면 평소처럼 3회가 돌아온다.
             */
            console.error('[QuotaManager] 🚨 상태 파일 위변조/손상 감지 → 오늘 차단 (내일 정상 복귀)');
            const blocked = TAMPERED_STATE(today);
            writeState(blocked);
            return blocked;
        }
        if (floor > 0) {
            // 앱이 도는 중에 세 사본이 전부 사라졌다 — 메모리 값으로 버틴다
            console.warn(`[QuotaManager] 🚨 상태 파일이 모두 사라짐 → 이번 실행 기록(${floor}회) 유지`);
            return { date: today, publish: floor, policyVersion: COMPLETED_PUBLISH_POLICY_VERSION, history: { [today]: floor } };
        }
        return EMPTY_STATE(today);
    }
    /**
     * 🗓️ v3.8.461 — 여러 사본과 날짜별 기록에서 **오늘 사용량의 최댓값**을 취한다.
     *
     * 이렇게 하면 실측으로 확인된 세 가지 우회가 한꺼번에 막힌다:
     *   · 파일 삭제 — 남은 사본에서 살아난다
     *   · 시계를 미래로 → 되돌리기 — history[오늘] 이 원래 값을 되살린다
     *   · 날짜 롤백 — 위와 동일
     * 정상 사용자에게는 영향이 없다. 진짜 새 날짜는 기록이 없으니 0 이다.
     */
    let todayUsage = 0;
    let mergedHistory = {};
    let latestSeen = '';
    let latestSeenPublish = 0;
    for (const { state } of valid) {
        const hist = state.history || {};
        for (const [d, n] of Object.entries(hist)) {
            const v = Number(n) || 0;
            if (v > (mergedHistory[d] || 0))
                mergedHistory[d] = v;
        }
        if (state.date === today) {
            todayUsage = Math.max(todayUsage, Number(state.publish) || 0);
        }
        const seen = state.lastSeenDate || state.date;
        if (seen > latestSeen) {
            latestSeen = seen;
            latestSeenPublish = Number(state.publish) || 0;
        }
    }
    todayUsage = Math.max(todayUsage, Number(mergedHistory[today]) || 0, floor);
    /**
     * 구버전(v1) 이관 — **세 사본이 전부 v1 일 때만.**
     *
     * v1 은 서명 규칙이 달라 검증을 건너뛴다. 예전 코드는 "한 곳이라도 v1 이면"
     * 이관해서 0 으로 초기화했는데, 그러면 메인 파일 하나만 v1 형식(서명 없는
     * `{date, publish:0}`)으로 바꿔 놓는 것만으로 **세 사본이 전부 0 으로 덮여**
     * 하루 제한이 무너진다. 진짜 이관은 v2 를 한 번도 쓴 적 없는 설치이므로
     * 사본 어디에도 v2 가 없다.
     */
    const hasV2 = valid.some((r) => Number(r.state.policyVersion || 0) >= COMPLETED_PUBLISH_POLICY_VERSION);
    if (!hasV2) {
        const migrated = {
            date: today,
            publish: Math.max(Number(mergedHistory[today]) || 0, floor),
            policyVersion: COMPLETED_PUBLISH_POLICY_VERSION,
            history: mergedHistory,
        };
        writeState(migrated);
        console.log(`[QuotaManager] 무료 체험 정책 v2 이관 → 완료 발행 ${migrated.publish}회`);
        return migrated;
    }
    if (latestSeen && today < latestSeen) {
        /**
         * 시계를 되돌렸다. 날짜별 기록이 있으면 그 값이 이미 반영돼 있지만,
         * 기록이 없는 상태(구버전 파일 등)라면 0 으로 풀려 버린다.
         * **마지막으로 본 사용량 아래로는 절대 내려가지 않게** 한다.
         */
        todayUsage = Math.max(todayUsage, latestSeenPublish);
        console.warn(`[QuotaManager] 🚨 날짜 롤백 감지! today=${today}, lastSeen=${latestSeen} → 사용량 ${todayUsage}회 유지`);
    }
    const storedDate = valid[0].state.date;
    if (storedDate !== today) {
        // 날짜가 바뀌었다 — 오늘 기록이 있으면 그 값, 없으면 0 에서 시작
        const rolled = {
            date: today,
            publish: todayUsage,
            policyVersion: COMPLETED_PUBLISH_POLICY_VERSION,
            history: mergedHistory,
        };
        writeState(rolled);
        console.log(`[QuotaManager] 날짜 변경(${storedDate} → ${today}) → 오늘 사용량 ${todayUsage}회`);
        return rolled;
    }
    return {
        date: today,
        publish: todayUsage,
        policyVersion: COMPLETED_PUBLISH_POLICY_VERSION,
        history: mergedHistory,
    };
}
// ── 쓰기 ──
function writeState(state) {
    const today = getLocalDateKey();
    // v3.8.461: 날짜별 기록을 갱신한다 (줄어들지 않게 max, 오래된 것은 정리)
    const history = { ...(state.history || {}) };
    const prev = Number(history[state.date]) || 0;
    history[state.date] = Math.max(prev, Number(state.publish) || 0);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_KEEP_DAYS);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    for (const d of Object.keys(history)) {
        if (d < cutoffKey)
            delete history[d];
    }
    const secureState = {
        ...state,
        history,
        policyVersion: COMPLETED_PUBLISH_POLICY_VERSION,
        lastSeenDate: today >= state.date ? today : state.date,
        _sig: '',
    };
    secureState._sig = computeSignature(secureState);
    const json = JSON.stringify(secureState, null, 2);
    /**
     * 💾 v3.8.461 — 세션 하한선을 먼저 올린다.
     *
     * 디스크 저장이 세 곳 모두 실패해도(디스크 꽉 참·백신 잠금·읽기전용) 앱이
     * 도는 동안에는 사용량이 그대로 유지되게 한다. 예전에는 저장 실패를 조용히
     * 삼켜서 **발행은 되는데 카운트는 0에 머무는** 상태가 됐다.
     */
    if (secureState.date === today) {
        // 쿼터 변경은 전부 withQuotaLock 안에서 일어나므로 이 값이 항상 최신이다.
        // (환불도 여기를 지나므로 하한선이 같이 내려간다)
        sessionFloor = { date: today, publish: Number(secureState.publish) || 0 };
    }
    /**
     * 3중 저장 — 한 곳을 지워도 나머지에서 살아난다 (getMirrorFile 주석 참고).
     * 임시 파일에 먼저 쓰고 rename 으로 갈아끼운다(원자적 쓰기). 쓰는 도중 앱이
     * 죽어도 **반쯤 잘린 JSON 이 남지 않는다** — 그런 파일은 위조로 판정돼
     * 사용량이 999 에 영구히 묶이므로(리셋 불가) 정상 사용자에게 치명적이다.
     */
    let written = 0;
    for (const file of [getStorageFile(), getBackupFile(), getMirrorFile()]) {
        const tmp = `${file}.tmp`;
        try {
            const dir = path.dirname(file);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(tmp, json, 'utf-8');
            fs.renameSync(tmp, file);
            written += 1;
        }
        catch (e) {
            try {
                fs.unlinkSync(tmp);
            }
            catch { /* 남은 임시 파일 정리 */ }
            console.error(`[QuotaManager] ⚠️ 저장 실패(${path.basename(file)}):`, e);
        }
    }
    if (written === 0) {
        console.error('[QuotaManager] 🚨 세 사본 모두 저장 실패 — 이번 실행 동안만 메모리로 사용량을 지킵니다');
    }
}
// ── 공개 API ──
/** 무료 체험 완료 발행 사용량 조회 (기존 호출부 호환용 이름 유지) */
async function getUsageToday() {
    const state = await readState();
    return state.publish;
}
/** 쿼터 상태 조회 (UI 표시용) */
async function getQuotaStatus(limit) {
    const state = await readState();
    return {
        date: state.date,
        limit,
        usage: state.publish,
        isPaywalled: state.publish >= limit,
    };
}
/** 쿼터 소비 가능 여부 확인 */
async function canConsume(limit, amount = 1) {
    const state = await readState();
    return (state.publish + amount) <= limit;
}
/** 쿼터 소비 (선차감) */
async function consume(amount = 1) {
    // v3.8.461: 동시 호출이 서로를 덮어쓰지 않게 직렬화 (consumeIfAvailable 과 같은 락)
    return withQuotaLock(async () => {
        const today = getLocalDateKey();
        const state = await readState();
        const next = {
            date: today,
            publish: state.publish + amount,
            policyVersion: COMPLETED_PUBLISH_POLICY_VERSION,
            history: state.history || {},
        };
        writeState(next);
        console.log(`[QuotaManager] 쿼터 소비: ${state.publish} → ${next.publish}`);
        return next;
    });
}
/**
 * 🔒 v3.8.461 — 쿼터 갱신을 **한 줄로 세운다.**
 *
 * 실측 공격: 동시에 5건을 기록하면 5건 모두 통과하고 최종 사용량이 1 이었다.
 * readState() → writeState() 사이가 비원자적이라 다섯 호출이 모두 "현재 0" 을
 * 읽고 각자 1 을 써 버린 것이다. 조작이 아니라 **대기열·스케줄 발행이 겹치면
 * 그냥 일어나는 일**이라 가장 위험하다.
 * 발행은 전부 메인 프로세스를 지나므로 프로세스 내 직렬화로 충분하다.
 */
let quotaChain = Promise.resolve();
function withQuotaLock(fn) {
    const next = quotaChain.then(fn, fn);
    quotaChain = next.then(() => undefined, () => undefined);
    return next;
}
/** Records a completed publish only when the daily trial limit still allows it. */
async function consumeIfAvailable(limit, amount = 1) {
    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (!Number.isFinite(limit) || limit < 0 || safeAmount <= 0)
        return false;
    return withQuotaLock(async () => {
        const state = await readState();
        if (state.publish + safeAmount > limit)
            return false;
        const next = {
            date: getLocalDateKey(),
            publish: state.publish + safeAmount,
            policyVersion: COMPLETED_PUBLISH_POLICY_VERSION,
            history: state.history || {},
        };
        writeState(next);
        console.log(`[QuotaManager] Completed-publish quota recorded: ${state.publish} -> ${next.publish}`);
        return true;
    });
}
/** 쿼터 환불 (발행 실패 시) */
async function refund(amount = 1) {
    return withQuotaLock(async () => {
        const state = await readState();
        const nextPublish = Math.max(0, state.publish - amount);
        /**
         * v3.8.461 — 환불은 history 도 함께 내려야 한다.
         * 아니면 다음 readState 에서 history[오늘] 의 옛 값이 다시 살아나
         * 환불이 무효가 된다(readState 가 최댓값을 취하기 때문).
         */
        const history = { ...(state.history || {}) };
        history[state.date] = nextPublish;
        const next = {
            date: state.date,
            publish: nextPublish,
            policyVersion: COMPLETED_PUBLISH_POLICY_VERSION,
            history,
        };
        writeState(next);
        console.log(`[QuotaManager] 쿼터 환불: ${state.publish} → ${next.publish}`);
        return next;
    });
}
