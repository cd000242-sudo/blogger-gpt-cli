"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentAccountLabel = buildAgentAccountLabel;
exports.arrangeAgentAccounts = arrangeAgentAccounts;
exports.attachAgentAccounts = attachAgentAccounts;
/**
 * The account list the dropdown draws (v3.8.768) - names built from the real e-mail, same account shown once.
 *
 * Display only: no profile is deleted, no folder is touched, and nothing here writes the user's preferred
 * account (that stays with the explicit select-profile channel). A hidden duplicate is reported in the
 * survivor's mergedProfileIds so the screen can move the shown selection to the account that is still listed.
 */
const agent_account_identity_1 = require("./agent-account-identity");
/** "이 PC 로그인 · me@gmail.com" / "Claude Code · me@gmail.com" / "Claude Code (로그인 필요)". Never invents a name. */
function buildAgentAccountLabel(input) {
    const name = input.useSystemHome ? '이 PC 로그인' : input.providerLabel;
    const needsLogin = input.status === 'needs-login';
    if (input.email)
        return needsLogin ? `${name} · ${input.email} (로그인 필요)` : `${name} · ${input.email}`;
    const note = needsLogin ? '로그인 필요' : '이메일 확인 안 됨';
    return `${name} (${note}${input.ordinal ? ` ${input.ordinal}` : ''})`;
}
/** Lower sorts first: a working login, then this PC's login, then the user's choice, then list order. */
function keeperScore(profile, index, preferredIds) {
    return [
        profile.status === 'needs-login' ? 1 : 0,
        profile.useSystemHome === true ? 0 : 1,
        preferredIds[profile.provider] === profile.id ? 0 : 1,
        index,
    ];
}
function isBetter(a, b) {
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i])
            return a[i] < b[i];
    }
    return false;
}
function arrangeAgentAccounts(profiles, options) {
    const preferredIds = options.preferredIds || {};
    const keyOf = (profile) => {
        const email = (0, agent_account_identity_1.normalizeAccountEmail)(profile.accountEmail);
        return email ? `${profile.provider}\u0000${email.toLowerCase()}` : null;
    };
    const keeperIndex = new Map();
    profiles.forEach((profile, index) => {
        const key = keyOf(profile);
        if (!key)
            return;
        const current = keeperIndex.get(key);
        if (current === undefined
            || isBetter(keeperScore(profile, index, preferredIds), keeperScore(profiles[current], current, preferredIds))) {
            keeperIndex.set(key, index);
        }
    });
    const merged = new Map();
    profiles.forEach((profile, index) => {
        const key = keyOf(profile);
        const keeper = key ? keeperIndex.get(key) : undefined;
        if (keeper === undefined || keeper === index)
            return;
        merged.set(keeper, [...(merged.get(keeper) || []), profile.id]);
    });
    const visible = profiles
        .map((profile, index) => ({ profile, index }))
        .filter(({ profile, index }) => {
        const key = keyOf(profile);
        return !key || keeperIndex.get(key) === index;
    });
    const baseLabel = (profile, ordinal) => buildAgentAccountLabel({
        providerLabel: options.providerLabel(profile.provider),
        useSystemHome: profile.useSystemHome === true,
        email: (0, agent_account_identity_1.normalizeAccountEmail)(profile.accountEmail),
        status: profile.status,
        ordinal,
    });
    const sameName = new Map();
    visible.forEach(({ profile }) => {
        const label = `${profile.provider}\u0000${baseLabel(profile)}`;
        sameName.set(label, (sameName.get(label) || 0) + 1);
    });
    const seen = new Map();
    return visible.map(({ profile, index }) => {
        const label = `${profile.provider}\u0000${baseLabel(profile)}`;
        let ordinal;
        if ((sameName.get(label) || 0) > 1) {
            ordinal = (seen.get(label) || 0) + 1;
            seen.set(label, ordinal);
        }
        return { ...profile, displayLabel: baseLabel(profile, ordinal), mergedProfileIds: merged.get(index) || [] };
    });
}
/**
 * Reads every profile's e-mail (in parallel; a failed read means "unknown", never a failed list),
 * fills loginIdentity.email so other screens show it too, then folds same-account duplicates.
 */
async function attachAgentAccounts(views, deps) {
    const emails = await Promise.all(views.map(async (view) => {
        try {
            return (0, agent_account_identity_1.normalizeAccountEmail)(await deps.readEmail(view));
        }
        catch {
            return undefined;
        }
    }));
    const enriched = views.map((view, index) => {
        const email = emails[index] || (0, agent_account_identity_1.normalizeAccountEmail)(view.loginIdentity?.email);
        if (!email)
            return view;
        const identity = view.loginIdentity?.email ? view.loginIdentity : { ...(view.loginIdentity || {}), email };
        return { ...view, accountEmail: email, loginIdentity: identity };
    });
    return arrangeAgentAccounts(enriched, { providerLabel: deps.providerLabel, preferredIds: deps.preferredIds });
}
