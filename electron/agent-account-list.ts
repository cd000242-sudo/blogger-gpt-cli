/**
 * The account list the dropdown draws (v3.8.768) - names built from the real e-mail, same account shown once.
 *
 * Display only: no profile is deleted, no folder is touched, and nothing here writes the user's preferred
 * account (that stays with the explicit select-profile channel). A hidden duplicate is reported in the
 * survivor's mergedProfileIds so the screen can move the shown selection to the account that is still listed.
 */
import { normalizeAccountEmail } from './agent-account-identity';

export interface AgentAccountProfile {
  id: string;
  provider: string;
  status: string;
  useSystemHome?: boolean;
  accountEmail?: string;
}

export interface AgentAccountFields {
  displayLabel: string;
  mergedProfileIds: string[];
}

export interface AgentAccountLabelInput {
  providerLabel: string;
  useSystemHome?: boolean;
  email?: string;
  status: string;
  /** 1-based number, only when several profiles would otherwise get the same name */
  ordinal?: number;
}

/** "이 PC 로그인 · me@gmail.com" / "Claude Code · me@gmail.com" / "Claude Code (로그인 필요)". Never invents a name. */
export function buildAgentAccountLabel(input: AgentAccountLabelInput): string {
  const name = input.useSystemHome ? '이 PC 로그인' : input.providerLabel;
  const needsLogin = input.status === 'needs-login';
  if (input.email) return needsLogin ? `${name} · ${input.email} (로그인 필요)` : `${name} · ${input.email}`;
  const note = needsLogin ? '로그인 필요' : '이메일 확인 안 됨';
  return `${name} (${note}${input.ordinal ? ` ${input.ordinal}` : ''})`;
}

export interface ArrangeOptions {
  providerLabel: (provider: string) => string;
  /** provider -> the profile id the user chose on purpose (read only) */
  preferredIds?: Readonly<Record<string, string>>;
}

/** Lower sorts first: a working login, then this PC's login, then the user's choice, then list order. */
function keeperScore(profile: AgentAccountProfile, index: number, preferredIds: Readonly<Record<string, string>>): number[] {
  return [
    profile.status === 'needs-login' ? 1 : 0,
    profile.useSystemHome === true ? 0 : 1,
    preferredIds[profile.provider] === profile.id ? 0 : 1,
    index,
  ];
}

function isBetter(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i]! < b[i]!;
  }
  return false;
}

export function arrangeAgentAccounts<T extends AgentAccountProfile>(
  profiles: readonly T[],
  options: ArrangeOptions,
): Array<T & AgentAccountFields> {
  const preferredIds = options.preferredIds || {};
  const keyOf = (profile: T): string | null => {
    const email = normalizeAccountEmail(profile.accountEmail);
    return email ? `${profile.provider}\u0000${email.toLowerCase()}` : null;
  };

  const keeperIndex = new Map<string, number>();
  profiles.forEach((profile, index) => {
    const key = keyOf(profile);
    if (!key) return;
    const current = keeperIndex.get(key);
    if (current === undefined
      || isBetter(keeperScore(profile, index, preferredIds), keeperScore(profiles[current]!, current, preferredIds))) {
      keeperIndex.set(key, index);
    }
  });

  const merged = new Map<number, string[]>();
  profiles.forEach((profile, index) => {
    const key = keyOf(profile);
    const keeper = key ? keeperIndex.get(key) : undefined;
    if (keeper === undefined || keeper === index) return;
    merged.set(keeper, [...(merged.get(keeper) || []), profile.id]);
  });

  const visible = profiles
    .map((profile, index) => ({ profile, index }))
    .filter(({ profile, index }) => {
      const key = keyOf(profile);
      return !key || keeperIndex.get(key) === index;
    });

  const baseLabel = (profile: T, ordinal?: number) => buildAgentAccountLabel({
    providerLabel: options.providerLabel(profile.provider),
    useSystemHome: profile.useSystemHome === true,
    email: normalizeAccountEmail(profile.accountEmail),
    status: profile.status,
    ordinal,
  });
  const sameName = new Map<string, number>();
  visible.forEach(({ profile }) => {
    const label = `${profile.provider}\u0000${baseLabel(profile)}`;
    sameName.set(label, (sameName.get(label) || 0) + 1);
  });
  const seen = new Map<string, number>();

  return visible.map(({ profile, index }) => {
    const label = `${profile.provider}\u0000${baseLabel(profile)}`;
    let ordinal: number | undefined;
    if ((sameName.get(label) || 0) > 1) {
      ordinal = (seen.get(label) || 0) + 1;
      seen.set(label, ordinal);
    }
    return { ...profile, displayLabel: baseLabel(profile, ordinal), mergedProfileIds: merged.get(index) || [] };
  });
}

export interface AgentAccountView extends AgentAccountProfile {
  loginIdentity?: { email?: string; provider?: string; tokenFile?: string } | null;
}

export interface AttachDeps<T> {
  readEmail: (view: T) => Promise<string | undefined>;
  providerLabel: (provider: string) => string;
  preferredIds?: Readonly<Record<string, string>>;
}

/**
 * Reads every profile's e-mail (in parallel; a failed read means "unknown", never a failed list),
 * fills loginIdentity.email so other screens show it too, then folds same-account duplicates.
 */
export async function attachAgentAccounts<T extends AgentAccountView>(
  views: readonly T[],
  deps: AttachDeps<T>,
): Promise<Array<T & AgentAccountFields>> {
  const emails = await Promise.all(views.map(async (view) => {
    try {
      return normalizeAccountEmail(await deps.readEmail(view));
    } catch {
      return undefined;
    }
  }));

  const enriched = views.map((view, index) => {
    const email = emails[index] || normalizeAccountEmail(view.loginIdentity?.email);
    if (!email) return view;
    const identity = view.loginIdentity?.email ? view.loginIdentity : { ...(view.loginIdentity || {}), email };
    return { ...view, accountEmail: email, loginIdentity: identity };
  });

  return arrangeAgentAccounts(enriched, { providerLabel: deps.providerLabel, preferredIds: deps.preferredIds });
}
