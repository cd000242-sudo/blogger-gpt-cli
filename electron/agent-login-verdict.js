"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_VERIFIED_REUSE_MS = void 0;
exports.classifyLoginProbe = classifyLoginProbe;
exports.createVerifiedLoginMemo = createVerifiedLoginMemo;
exports.settleLoginState = settleLoginState;
exports.delayedLoginMessage = delayedLoginMessage;
exports.credentialTextHasToken = credentialTextHasToken;
exports.requiresTokenEvidence = requiresTokenEvidence;
exports.isolatedProfileHasRealLogin = isolatedProfileHasRealLogin;
/**
 * Login verdict rules that must stay testable without Electron or a CLI.
 *
 * Why this exists: a probe that times out, cannot start, or prints nothing says nothing about the
 * account. It used to be reported as "the CLI did not answer, update it" and drawn as a red
 * "login needed" card, so a healthy login looked broken whenever the PC was busy. Here the outcome
 * of one probe is classified into four states, a recently verified login is reused for 6 hours,
 * and a profile folder only counts as logged in when it holds a real token (not just config files).
 *
 * No CLI is started and no login file content is kept or logged here: token text is only checked
 * for "is there a real-looking token", then dropped.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/** How long a verified login may stand in for a probe that could not answer. */
exports.AGENT_VERIFIED_REUSE_MS = 6 * 60 * 60 * 1000;
/**
 * Only an explicit logout signal is "needs-login". Everything that merely failed to answer
 * (timeout, cannot start, empty output, odd exit code) is "delayed".
 */
function classifyLoginProbe(facts) {
    if (facts.quotaExceeded)
        return 'quota';
    if (facts.authRequired)
        return 'needs-login';
    if (facts.timedOut || facts.launchError)
        return 'delayed';
    if (facts.loginStatus !== true)
        return 'delayed';
    return facts.exitCode === 0 ? 'ready' : 'delayed';
}
/**
 * Remembers when a profile last proved itself logged in. The timestamp is never refreshed by a
 * recall, so repeated slow probes cannot keep an old verification alive forever.
 */
function createVerifiedLoginMemo(options = {}) {
    const now = options.now ?? Date.now;
    const ttlMs = options.ttlMs ?? exports.AGENT_VERIFIED_REUSE_MS;
    const entries = new Map();
    const alive = (verifiedAt) => verifiedAt <= now() && now() - verifiedAt < ttlMs;
    for (const [id, value] of Object.entries(options.initial ?? {})) {
        if (typeof value === 'number' && Number.isFinite(value) && alive(value))
            entries.set(id, value);
    }
    return {
        remember(profileId) {
            if (profileId)
                entries.set(profileId, now());
        },
        recall(profileId) {
            const verifiedAt = entries.get(profileId);
            if (verifiedAt === undefined)
                return null;
            if (!alive(verifiedAt)) {
                entries.delete(profileId);
                return null;
            }
            return { verifiedAt };
        },
        forget(profileId) {
            if (profileId)
                entries.delete(profileId);
            else
                entries.clear();
        },
        serialize() {
            return Object.fromEntries(entries);
        },
    };
}
/** Final answer for the caller: a slow probe is rescued by a recent verification, a logout never is. */
function settleLoginState(state, recalled) {
    if (state === 'delayed' && recalled)
        return { state: 'ready', ready: true, reused: true, delayed: false };
    return { state, ready: state === 'ready', reused: false, delayed: state === 'delayed' };
}
/** User-facing copy for a probe that could not answer. It never says "log in" or "install". */
function delayedLoginMessage(label) {
    return `${label} 확인 지연 — 로그인은 그대로 유지됩니다. [다시 확인]을 눌러 주세요.`;
}
const TOKEN_KEY_RE = /^(?:access_?token|refresh_?token|id_?token|openai_?api_?key|api_?key)$/i;
const MIN_TOKEN_LENGTH = 20;
const MAX_CREDENTIAL_BYTES = 256 * 1024;
function hasTokenValue(node, depth) {
    if (depth > 6 || node === null || typeof node !== 'object')
        return false;
    for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string') {
            if (TOKEN_KEY_RE.test(key) && value.trim().length >= MIN_TOKEN_LENGTH && !/\s/.test(value.trim()))
                return true;
        }
        else if (hasTokenValue(value, depth + 1)) {
            return true;
        }
    }
    return false;
}
/** True when the JSON text carries a real-looking token under a token-named key. The text is not kept. */
function credentialTextHasToken(text) {
    if (!text || text.length > MAX_CREDENTIAL_BYTES)
        return false;
    try {
        return hasTokenValue(JSON.parse(text), 0);
    }
    catch {
        return false;
    }
}
const ISOLATED_CREDENTIAL_FILE = {
    claude: '.credentials.json',
    codex: 'auth.json',
};
/** Providers whose isolated folders are judged by token content (others keep the older file check). */
function requiresTokenEvidence(provider) {
    return Object.prototype.hasOwnProperty.call(ISOLATED_CREDENTIAL_FILE, provider);
}
/**
 * An isolated app folder is logged in only when the CLI's own credential file holds a real token.
 * Config files such as .claude.json (which can mention "oauth" or "claude_ai" without any login)
 * used to make an empty folder look ready.
 */
function isolatedProfileHasRealLogin(profileDir, provider) {
    const fileName = ISOLATED_CREDENTIAL_FILE[provider];
    if (!fileName || !profileDir)
        return false;
    try {
        const file = path_1.default.join(profileDir, fileName);
        if (fs_1.default.statSync(file).size > MAX_CREDENTIAL_BYTES)
            return false;
        return credentialTextHasToken(fs_1.default.readFileSync(file, 'utf8'));
    }
    catch {
        return false;
    }
}
