"use strict";
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
exports.RETRY_WINDOW_MS = void 0;
exports.readAttempt = readAttempt;
exports.recordAttempt = recordAttempt;
exports.clearAttempt = clearAttempt;
exports.isRepeatAttempt = isRepeatAttempt;
/**
 * 🧾 v3.8.707 — 설치 시도 장부
 *
 * 조용한 설치를 걸었는데 앱이 다시 켜져 보니 **버전이 그대로**라면(권한 확인창에서
 * '아니오', 설치기가 죽음 등) 같은 설치를 말없이 또 걸면 안 된다 — 창이 닫히고
 * 권한 창이 뜨는 일이 되풀이될 뿐이다. 그래서 "어느 버전을 언제 몇 번 걸었는지"를
 * userData 에 적어 두고, 다음 update-downloaded 가 그 장부를 먼저 본다.
 *
 * 설치가 실제로 끝나면 앱 버전이 장부의 버전과 같아지므로 시작 때 지운다.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** 이 시간 안에 같은 버전을 또 깔려 하면 "되풀이"로 본다 */
exports.RETRY_WINDOW_MS = 10 * 60 * 1000;
const FILE_NAME = 'update-attempt.json';
function attemptPath(dir) {
    return path.join(dir, FILE_NAME);
}
function readAttempt(dir) {
    try {
        const raw = fs.readFileSync(attemptPath(dir), 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.version !== 'string' || typeof parsed.at !== 'number')
            return null;
        return { version: parsed.version, at: parsed.at, count: Number(parsed.count) || 1 };
    }
    catch {
        return null;
    }
}
function recordAttempt(dir, version, now = Date.now()) {
    const prev = readAttempt(dir);
    const next = {
        version,
        at: now,
        count: prev && prev.version === version ? prev.count + 1 : 1,
    };
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(attemptPath(dir), JSON.stringify(next), 'utf-8');
    }
    catch (e) {
        // 장부를 못 써도 설치는 막지 않는다 — 되풀이 감지만 잃는다
        console.error('[Updater] 설치 시도 기록 실패:', e?.message);
    }
    return next;
}
function clearAttempt(dir) {
    try {
        fs.unlinkSync(attemptPath(dir));
    }
    catch { /* 없으면 그만 */ }
}
function isRepeatAttempt(prev, version, now = Date.now()) {
    if (!prev || prev.version !== version)
        return false;
    return now - prev.at < exports.RETRY_WINDOW_MS;
}
