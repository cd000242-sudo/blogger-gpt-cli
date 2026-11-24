/**
 * WordPress credentials for a multi-account publish.
 *
 * The multi-account handler passes each account's own site URL, username and
 * application password. They are used as a whole set: when any of the three is
 * empty the publish fails instead of silently falling back to the default
 * (.env) account, which is how every post used to land on one account.
 */

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  password: string;
}

export type WordPressCredentialField = keyof WordPressCredentials;

export type AccountCredentialPick =
  | { ok: true; credentials: WordPressCredentials }
  | { ok: false; missing: WordPressCredentialField[] };

const FIELDS: WordPressCredentialField[] = ['siteUrl', 'username', 'password'];

export const WORDPRESS_CREDENTIAL_LABELS: Record<WordPressCredentialField, string> = {
  siteUrl: '사이트 주소',
  username: '아이디',
  password: '앱 비밀번호',
};

export function pickAccountWordPressCredentials(account: Partial<Record<WordPressCredentialField, unknown>>): AccountCredentialPick {
  const credentials = {
    siteUrl: String(account?.siteUrl ?? '').trim(),
    username: String(account?.username ?? '').trim(),
    password: String(account?.password ?? '').trim(),
  };
  const missing = FIELDS.filter((field) => !credentials[field]);
  return missing.length > 0 ? { ok: false, missing } : { ok: true, credentials };
}
