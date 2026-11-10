"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ACCOUNT_FILE_BYTES = void 0;
exports.normalizeAccountEmail = normalizeAccountEmail;
exports.emailFromClaudeConfigText = emailFromClaudeConfigText;
exports.emailFromCodexAuthText = emailFromCodexAuthText;
exports.emailFromAccountText = emailFromAccountText;
exports.agentAccountEmailFiles = agentAccountEmailFiles;
exports.createAccountEmailReader = createAccountEmailReader;
/**
 * Which account is behind a login folder (v3.8.768) - testable without Electron.
 *
 * The account dropdown used to show "Claude Code 구독 계정" for every Claude profile because the Claude login
 * file (.credentials.json) holds opaque tokens and no e-mail. The e-mail is in .claude.json
 * (oauthAccount.emailAddress). For Codex it is in the id_token of auth.json.
 *
 * Rules:
 *  - Only the e-mail string leaves this module. The parsed JSON, the tokens and the raw text are dropped.
 *  - Files are read asynchronously, and the answer is remembered until the file's modification time or size changes.
 *  - Nothing is logged: a JSON parse error message can quote part of the file.
 */
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/** A .claude.json can grow with project history; beyond this size the e-mail is treated as unknown. */
exports.MAX_ACCOUNT_FILE_BYTES = 8 * 1024 * 1024;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseJsonRecord(text) {
    try {
        const parsed = JSON.parse(text);
        return isRecord(parsed) ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
/** A trimmed e-mail, or undefined when the value does not look like one. */
function normalizeAccountEmail(value) {
    if (typeof value !== 'string')
        return undefined;
    const email = value.trim();
    if (!email || email.length > MAX_EMAIL_LENGTH)
        return undefined;
    if (CONTROL_CHARS.test(email) || !EMAIL_SHAPE.test(email))
        return undefined;
    return email;
}
/** .claude.json -> oauthAccount.emailAddress (a top-level field is not trusted). */
function emailFromClaudeConfigText(text) {
    const account = parseJsonRecord(text)?.['oauthAccount'];
    return isRecord(account) ? normalizeAccountEmail(account['emailAddress']) : undefined;
}
/** The payload of a JWT is read for display only; the signature is not checked and is never kept. */
function emailFromJwt(token) {
    if (typeof token !== 'string')
        return undefined;
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1])
        return undefined;
    const payload = parseJsonRecord(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload)
        return undefined;
    const profile = payload['https://api.openai.com/profile'];
    return normalizeAccountEmail(payload['email'])
        ?? (isRecord(profile) ? normalizeAccountEmail(profile['email']) : undefined);
}
/** auth.json -> tokens.id_token payload e-mail (the access_token profile claim is the fallback). */
function emailFromCodexAuthText(text) {
    const tokens = parseJsonRecord(text)?.['tokens'];
    if (!isRecord(tokens))
        return undefined;
    return emailFromJwt(tokens['id_token']) ?? emailFromJwt(tokens['access_token']);
}
function emailFromAccountText(provider, text) {
    if (provider === 'claude')
        return emailFromClaudeConfigText(text);
    if (provider === 'codex')
        return emailFromCodexAuthText(text);
    return undefined;
}
/**
 * The file that names the account. Claude keeps its settings next to the folder (~/.claude.json) when
 * this PC's login is used, and inside CLAUDE_CONFIG_DIR / the profile folder otherwise.
 */
function agentAccountEmailFiles(profile, env) {
    const systemHome = profile.useSystemHome === true;
    if (profile.provider === 'claude') {
        if (!systemHome)
            return [path_1.default.join(profile.profileDir, '.claude.json')];
        return [path_1.default.join(env.claudeConfigDir || env.homeDir, '.claude.json')];
    }
    if (profile.provider === 'codex') {
        const dir = systemHome ? (env.codexHome || path_1.default.join(env.homeDir, '.codex')) : profile.profileDir;
        return [path_1.default.join(dir, 'auth.json')];
    }
    return [];
}
const diskIo = {
    stat: (file) => fs_1.promises.stat(file),
    readFile: (file) => fs_1.promises.readFile(file, 'utf8'),
};
async function stampOf(io, file) {
    try {
        const st = await io.stat(file);
        return { text: `${Math.round(st.mtimeMs)}:${st.size}`, size: st.size };
    }
    catch {
        return { text: 'missing', size: null };
    }
}
/** Reads the account e-mail without blocking, and re-reads only when a file's stamp (mtime + size) changed. */
function createAccountEmailReader(io = diskIo) {
    const memo = new Map();
    return {
        async read(request) {
            const stamps = await Promise.all(request.files.map((file) => stampOf(io, file)));
            const stamp = request.files.map((file, index) => `${file}|${stamps[index].text}`).join('||');
            const memoKey = `${request.provider}:${request.key}`;
            const hit = memo.get(memoKey);
            if (hit && hit.stamp === stamp)
                return hit.email;
            let email;
            let complete = true;
            for (let index = 0; index < request.files.length && !email; index += 1) {
                const size = stamps[index].size;
                if (size === null || size > exports.MAX_ACCOUNT_FILE_BYTES)
                    continue;
                try {
                    email = emailFromAccountText(request.provider, await io.readFile(request.files[index]));
                }
                catch {
                    // The CLI may be writing the file right now: answer "unknown" but do not remember it.
                    complete = false;
                }
            }
            if (complete)
                memo.set(memoKey, { stamp, email });
            return email;
        },
        clear() {
            memo.clear();
        },
    };
}
