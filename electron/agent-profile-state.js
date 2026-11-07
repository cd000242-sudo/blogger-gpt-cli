"use strict";
/**
 * Agent profile decisions that must stay testable without Electron (v3.8.766).
 *
 * Background: a Codex refresh token is single use. Copying ~/.codex/auth.json into an app folder
 * leaves a copy that dies as soon as the original is refreshed. So "this PC's login" is not copied;
 * the profile only carries a marker and the CLI uses the system folder directly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.usesSystemHome = usesSystemHome;
exports.applyAgentHomeEnv = applyAgentHomeEnv;
exports.authStampOf = authStampOf;
exports.isAuthRejected = isAuthRejected;
exports.decideRefreshedStatus = decideRefreshedStatus;
exports.pickAgentProfile = pickAgentProfile;
const SYSTEM_HOME_PROVIDERS = new Set(['codex', 'claude']);
function usesSystemHome(profile) {
    return profile.useSystemHome === true && SYSTEM_HOME_PROVIDERS.has(profile.provider);
}
/**
 * Point the CLI at the profile's isolated folder - except for a system-home profile, where the
 * variable is left alone (not set, not removed) so the CLI reads the same folder the terminal does.
 */
function applyAgentHomeEnv(env, profile, envVar, profileDir) {
    if (!usesSystemHome(profile))
        env[envVar] = profileDir;
    return env;
}
/** Cheap fingerprint of the auth files (names, mtimes, sizes) - file contents are never read. */
function authStampOf(entries) {
    return entries
        .map((entry) => `${entry.name}:${Math.round(entry.mtimeMs)}:${entry.size}`)
        .sort()
        .join('|');
}
/** True while the server's "login is dead" verdict still applies to the files on disk. */
function isAuthRejected(profile, currentStamp) {
    return profile.status === 'needs-login'
        && !!profile.rejectedAuthStamp
        && profile.rejectedAuthStamp === currentStamp;
}
/**
 * Status after a refresh pass. "An auth file exists" only proves a file exists; it must not undo a
 * server rejection. A new login rewrites the file, which changes the stamp and lets the evidence win again.
 */
function decideRefreshedStatus(profile, hasEvidence, currentStamp) {
    if (!hasEvidence)
        return 'needs-login';
    if (isAuthRejected(profile, currentStamp))
        return 'needs-login';
    return 'ready';
}
/**
 * Pick the profile to run with:
 *  1. the explicit id,
 *  2. the profile the user chose (preferredId) while it is not known to be dead,
 *  3. the first ready profile of the provider,
 *  4. the chosen / first profile (so the caller reports a clear "log in again" error).
 */
function pickAgentProfile(profiles, query) {
    if (query.profileId) {
        const exact = profiles.find((item) => item.id === query.profileId);
        if (exact)
            return exact;
    }
    const pool = query.provider ? profiles.filter((item) => item.provider === query.provider) : profiles;
    if (!pool.length)
        return null;
    const preferred = query.preferredId ? pool.find((item) => item.id === query.preferredId) : undefined;
    if (preferred && preferred.status !== 'needs-login')
        return preferred;
    return pool.find((item) => item.status === 'ready') || preferred || pool[0];
}
