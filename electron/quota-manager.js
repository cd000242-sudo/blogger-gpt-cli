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
exports.refund = refund;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// ── 보안 ──
const _INTERNAL_SALT = Buffer.from('T3JiaXRRdW90YVNhbHQyMDI2', 'base64').toString('utf-8');
function computeSignature(state) {
    const payload = JSON.stringify({
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
const TAMPERED_STATE = (date) => ({
    date,
    publish: 999,
});
const EMPTY_STATE = (date) => ({
    date,
    publish: 0,
});
// ── 읽기 ──
async function readState() {
    const today = getLocalDateKey();
    const storageFile = getStorageFile();
    const backupFile = getBackupFile();
    let raw = null;
    let source = 'main';
    try {
        raw = fs.readFileSync(storageFile, 'utf-8');
    }
    catch {
        try {
            raw = fs.readFileSync(backupFile, 'utf-8');
            source = 'backup';
            console.log('[QuotaManager] ⚠️ 메인 파일 없음 → 백업에서 복구');
        }
        catch {
            return EMPTY_STATE(today);
        }
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.date !== 'string') {
            throw new Error('Invalid state');
        }
        // 시그니처 검증
        if (parsed._sig) {
            if (!verifySignature(parsed)) {
                console.error('[QuotaManager] 🚨 위변조 감지! 시그니처 불일치 → 강제 차단');
                return TAMPERED_STATE(today);
            }
        }
        // 날짜 롤백 감지
        const lastSeen = parsed.lastSeenDate || parsed.date;
        if (today < lastSeen) {
            console.warn(`[QuotaManager] 🚨 날짜 롤백 감지! today=${today}, lastSeen=${lastSeen} → 기존 사용량 유지`);
            return {
                date: today,
                publish: Number(parsed.publish) || 0,
            };
        }
        // 날짜 변경 → 리셋
        if (parsed.date !== today) {
            return EMPTY_STATE(today);
        }
        return {
            date: parsed.date,
            publish: Number(parsed.publish) || 0,
        };
    }
    catch {
        // 메인 파싱 실패 → 백업 시도
        if (source === 'main') {
            try {
                const backupRaw = fs.readFileSync(backupFile, 'utf-8');
                const backupParsed = JSON.parse(backupRaw);
                if (backupParsed._sig && verifySignature(backupParsed)) {
                    console.log('[QuotaManager] ⚠️ 메인 파일 손상 → 백업에서 복구 성공');
                    if (backupParsed.date !== today && today >= (backupParsed.lastSeenDate || backupParsed.date)) {
                        return EMPTY_STATE(today);
                    }
                    return { date: backupParsed.date, publish: Number(backupParsed.publish) || 0 };
                }
            }
            catch { /* 백업도 실패 */ }
        }
        console.error('[QuotaManager] 🚨 파일 손상 + 백업 실패 → 강제 차단');
        return TAMPERED_STATE(today);
    }
}
// ── 쓰기 ──
function writeState(state) {
    const storageFile = getStorageFile();
    const backupFile = getBackupFile();
    const today = getLocalDateKey();
    const secureState = {
        ...state,
        lastSeenDate: today >= state.date ? today : state.date,
        _sig: '',
    };
    secureState._sig = computeSignature(secureState);
    const json = JSON.stringify(secureState, null, 2);
    const dir = path.dirname(storageFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    // 듀얼 저장 — 한쪽 실패해도 다른 쪽 보존
    try {
        fs.writeFileSync(storageFile, json, 'utf-8');
    }
    catch (e) {
        console.error('[QuotaManager] ⚠️ 메인 파일 저장 실패:', e);
    }
    try {
        fs.writeFileSync(backupFile, json, 'utf-8');
    }
    catch (e) {
        console.error('[QuotaManager] ⚠️ 백업 파일 저장 실패:', e);
    }
}
// ── 공개 API ──
/** 오늘의 발행 사용량 조회 */
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
    const today = getLocalDateKey();
    const state = await readState();
    const base = state.date === today ? state : EMPTY_STATE(today);
    const next = {
        ...base,
        publish: base.publish + amount,
    };
    writeState(next);
    console.log(`[QuotaManager] 쿼터 소비: ${base.publish} → ${next.publish}`);
    return next;
}
/** 쿼터 환불 (발행 실패 시) */
async function refund(amount = 1) {
    const state = await readState();
    const next = {
        ...state,
        publish: Math.max(0, state.publish - amount),
    };
    writeState(next);
    console.log(`[QuotaManager] 쿼터 환불: ${state.publish} → ${next.publish}`);
    return next;
}
