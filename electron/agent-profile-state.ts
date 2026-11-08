/**
 * Agent profile decisions that must stay testable without Electron (v3.8.766).
 *
 * Background: a Codex refresh token is single use. Copying ~/.codex/auth.json into an app folder
 * leaves a copy that dies as soon as the original is refreshed. So "this PC's login" is not copied;
 * the profile only carries a marker and the CLI uses the system folder directly.
 */

export type AgentProfileStatus = 'needs-login' | 'ready' | 'unknown';

export interface AgentProfileLike {
  id: string;
  provider: string;
  status: AgentProfileStatus;
  /** true = use the system login folder (~/.codex, ~/.claude) instead of an app-owned copy */
  useSystemHome?: boolean;
  /** Auth file stamp at the moment the server rejected the login. Same stamp = nothing changed since. */
  rejectedAuthStamp?: string;
}

const SYSTEM_HOME_PROVIDERS = new Set(['codex', 'claude']);

export function usesSystemHome(profile: Pick<AgentProfileLike, 'provider' | 'useSystemHome'>): boolean {
  return profile.useSystemHome === true && SYSTEM_HOME_PROVIDERS.has(profile.provider);
}

/**
 * Point the CLI at the profile's isolated folder - except for a system-home profile, where the
 * variable is left alone (not set, not removed) so the CLI reads the same folder the terminal does.
 */
export function applyAgentHomeEnv<T extends Record<string, string | undefined>>(
  env: T,
  profile: Pick<AgentProfileLike, 'provider' | 'useSystemHome'>,
  envVar: string,
  profileDir: string,
): T {
  if (!usesSystemHome(profile)) (env as Record<string, string | undefined>)[envVar] = profileDir;
  return env;
}

/** Cheap fingerprint of the auth files (names, mtimes, sizes) - file contents are never read. */
export function authStampOf(entries: Array<{ name: string; mtimeMs: number; size: number }>): string {
  return entries
    .map((entry) => `${entry.name}:${Math.round(entry.mtimeMs)}:${entry.size}`)
    .sort()
    .join('|');
}

/** True while the server's "login is dead" verdict still applies to the files on disk. */
export function isAuthRejected(profile: AgentProfileLike, currentStamp: string): boolean {
  return profile.status === 'needs-login'
    && !!profile.rejectedAuthStamp
    && profile.rejectedAuthStamp === currentStamp;
}

/**
 * Status after a refresh pass. "An auth file exists" only proves a file exists; it must not undo a
 * server rejection. A new login rewrites the file, which changes the stamp and lets the evidence win again.
 */
export function decideRefreshedStatus(
  profile: AgentProfileLike,
  hasEvidence: boolean,
  currentStamp: string,
): 'ready' | 'needs-login' {
  if (!hasEvidence) return 'needs-login';
  if (isAuthRejected(profile, currentStamp)) return 'needs-login';
  return 'ready';
}

/**
 * Pick the profile to run with:
 *  1. the explicit id,
 *  2. the profile the user chose (preferredId) while it is not known to be dead,
 *  3. this PC's login (system-home profile) while it is ready - the default,
 *  4. the first ready profile of the provider,
 *  5. the chosen profile, else this PC's login, else the first one (so the caller reports a clear "log in" error).
 *
 * preferredId must only ever hold a choice the user made on purpose. A screen that echoes back
 * whatever it happened to display would pin a stale isolated folder as the "choice" forever.
 */
export function pickAgentProfile<T extends AgentProfileLike>(
  profiles: T[],
  query: { profileId?: string; provider?: string; preferredId?: string },
): T | null {
  if (query.profileId) {
    const exact = profiles.find((item) => item.id === query.profileId);
    if (exact) return exact;
  }
  const pool = query.provider ? profiles.filter((item) => item.provider === query.provider) : profiles;
  if (!pool.length) return null;
  const preferred = query.preferredId ? pool.find((item) => item.id === query.preferredId) : undefined;
  if (preferred && preferred.status !== 'needs-login') return preferred;
  const systemHome = pool.filter((item) => usesSystemHome(item));
  return systemHome.find((item) => item.status === 'ready')
    || pool.find((item) => item.status === 'ready')
    || preferred
    || systemHome[0]
    || pool[0];
}
