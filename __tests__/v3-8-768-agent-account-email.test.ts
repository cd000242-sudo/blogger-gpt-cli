/**
 * v3.8.768 - the account dropdown shows the real account e-mail.
 *
 * Root cause of "Claude Code 구독 계정 / Claude Code 구독 계정 / ...": the Claude login file
 * (.credentials.json) holds opaque tokens and no e-mail, so the screen fell back to the profile's
 * auto-generated label. The e-mail lives in .claude.json -> oauthAccount.emailAddress.
 *
 * Only fake files in a temp folder are used here. No real login file is touched.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  agentAccountEmailFiles,
  createAccountEmailReader,
  emailFromAccountText,
  emailFromClaudeConfigText,
  emailFromCodexAuthText,
  normalizeAccountEmail,
  MAX_ACCOUNT_FILE_BYTES,
} from '../electron/agent-account-identity';

const jwt = (payload: unknown) => [
  Buffer.from('{"alg":"none"}').toString('base64url'),
  Buffer.from(JSON.stringify(payload)).toString('base64url'),
  'signature-part',
].join('.');

describe('normalizeAccountEmail', () => {
  test.each([
    ['  someone@gmail.com ', 'someone@gmail.com'],
    ['A.B+tag@Example.co.kr', 'A.B+tag@Example.co.kr'],
  ])('accepts %j', (input, expected) => {
    expect(normalizeAccountEmail(input)).toBe(expected);
  });

  test.each([[''], ['not-an-email'], ['a b@c.com'], ['@x.com'], [null], [undefined], [42], [{ a: 1 }], ['a@b.com'.repeat(60)]])(
    'rejects %j',
    (input) => {
      expect(normalizeAccountEmail(input)).toBeUndefined();
    },
  );
});

describe('Claude .claude.json', () => {
  test('reads oauthAccount.emailAddress and nothing else', () => {
    const text = JSON.stringify({ userID: 'u', oauthAccount: { emailAddress: 'me@gmail.com', accountUuid: 'x', displayName: 'N' } });
    expect(emailFromClaudeConfigText(text)).toBe('me@gmail.com');
  });

  test.each([
    ['no oauthAccount', JSON.stringify({ projects: {} })],
    ['oauthAccount without e-mail', JSON.stringify({ oauthAccount: { accountUuid: 'x' } })],
    ['e-mail is not a string', JSON.stringify({ oauthAccount: { emailAddress: 12 } })],
    ['broken JSON', '{"oauthAccount": {"emailAddress": "me@gmail'],
    ['empty file', ''],
    ['an array', '[]'],
    ['a top-level email is not trusted', JSON.stringify({ emailAddress: 'me@gmail.com' })],
  ])('gives nothing for %s', (_name, text) => {
    expect(emailFromClaudeConfigText(text)).toBeUndefined();
  });
});

describe('Codex auth.json', () => {
  test('reads the e-mail from the id_token payload', () => {
    const text = JSON.stringify({ tokens: { id_token: jwt({ email: 'me@gmail.com', sub: 's' }), access_token: 'opaque' } });
    expect(emailFromCodexAuthText(text)).toBe('me@gmail.com');
  });

  test('falls back to the access_token profile claim', () => {
    const text = JSON.stringify({ tokens: { id_token: 'not-a-jwt', access_token: jwt({ 'https://api.openai.com/profile': { email: 'me@gmail.com' } }) } });
    expect(emailFromCodexAuthText(text)).toBe('me@gmail.com');
  });

  test.each([
    ['api key login only', JSON.stringify({ OPENAI_API_KEY: 'sk-secret' })],
    ['id_token without e-mail', JSON.stringify({ tokens: { id_token: jwt({ sub: 's' }) } })],
    ['broken id_token', JSON.stringify({ tokens: { id_token: 'a.b' } })],
    ['payload is not JSON', JSON.stringify({ tokens: { id_token: `h.${Buffer.from('zzz').toString('base64url')}.s` } })],
    ['broken JSON', '{"tokens": '],
    ['empty file', ''],
  ])('gives nothing for %s', (_name, text) => {
    expect(emailFromCodexAuthText(text)).toBeUndefined();
  });

  test('provider dispatch: unknown providers give nothing', () => {
    const claude = JSON.stringify({ oauthAccount: { emailAddress: 'me@gmail.com' } });
    expect(emailFromAccountText('claude', claude)).toBe('me@gmail.com');
    expect(emailFromAccountText('gemini', claude)).toBeUndefined();
  });
});

describe('which file holds the e-mail', () => {
  const env = { homeDir: path.join('C:', 'Users', 'me') };

  test('this PC Claude login: ~/.claude.json (next to the folder, not inside it)', () => {
    const files = agentAccountEmailFiles({ provider: 'claude', useSystemHome: true, profileDir: 'x' }, env);
    expect(files).toEqual([path.join(env.homeDir, '.claude.json')]);
  });

  test('this PC Claude login with CLAUDE_CONFIG_DIR: inside that folder', () => {
    const files = agentAccountEmailFiles({ provider: 'claude', useSystemHome: true, profileDir: 'x' }, { ...env, claudeConfigDir: 'D:\\cfg' });
    expect(files).toEqual([path.join('D:\\cfg', '.claude.json')]);
  });

  test('isolated Claude profile: .claude.json inside its folder', () => {
    const files = agentAccountEmailFiles({ provider: 'claude', profileDir: 'P' }, env);
    expect(files).toEqual([path.join('P', '.claude.json')]);
  });

  test('Codex: auth.json of the system folder or of the isolated folder', () => {
    expect(agentAccountEmailFiles({ provider: 'codex', useSystemHome: true, profileDir: 'P' }, env)).toEqual([path.join(env.homeDir, '.codex', 'auth.json')]);
    expect(agentAccountEmailFiles({ provider: 'codex', useSystemHome: true, profileDir: 'P' }, { ...env, codexHome: 'E:\\c' })).toEqual([path.join('E:\\c', 'auth.json')]);
    expect(agentAccountEmailFiles({ provider: 'codex', profileDir: 'P' }, env)).toEqual([path.join('P', 'auth.json')]);
  });

  test('other providers have no known file', () => {
    expect(agentAccountEmailFiles({ provider: 'gemini', profileDir: 'P' }, env)).toEqual([]);
  });
});

describe('reader: async, cached by file stamp', () => {
  type Entry = { text: string; mtimeMs: number };
  const makeIo = () => {
    const files = new Map<string, Entry>();
    const calls = { stat: 0, read: 0 };
    const failRead = new Set<string>();
    const io = {
      stat: async (file: string) => {
        calls.stat += 1;
        const entry = files.get(file);
        if (!entry) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
        return { mtimeMs: entry.mtimeMs, size: Buffer.byteLength(entry.text) };
      },
      readFile: async (file: string) => {
        calls.read += 1;
        if (failRead.has(file)) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
        return files.get(file)!.text;
      },
    };
    return { files, calls, failRead, io };
  };
  const claudeText = (email: string) => JSON.stringify({ oauthAccount: { emailAddress: email } });
  const request = (files: string[]) => ({ key: 'p1', provider: 'claude', files });

  test('reads once and answers from memory while the stamp is unchanged', async () => {
    const { files, calls, io } = makeIo();
    files.set('f', { text: claudeText('a@x.com'), mtimeMs: 100 });
    const reader = createAccountEmailReader(io);
    expect(await reader.read(request(['f']))).toBe('a@x.com');
    expect(await reader.read(request(['f']))).toBe('a@x.com');
    expect(await reader.read(request(['f']))).toBe('a@x.com');
    expect(calls.read).toBe(1);
  });

  test('reads again when the modification time changes', async () => {
    const { files, calls, io } = makeIo();
    files.set('f', { text: claudeText('a@x.com'), mtimeMs: 100 });
    const reader = createAccountEmailReader(io);
    await reader.read(request(['f']));
    files.set('f', { text: claudeText('b@x.com'), mtimeMs: 200 });
    expect(await reader.read(request(['f']))).toBe('b@x.com');
    expect(calls.read).toBe(2);
  });

  test('reads again when only the size changes', async () => {
    const { files, io } = makeIo();
    files.set('f', { text: claudeText('a@x.com'), mtimeMs: 100 });
    const reader = createAccountEmailReader(io);
    await reader.read(request(['f']));
    files.set('f', { text: claudeText('longer-name@x.com'), mtimeMs: 100 });
    expect(await reader.read(request(['f']))).toBe('longer-name@x.com');
  });

  test('a missing file gives nothing, and the file is picked up when it appears', async () => {
    const { files, io } = makeIo();
    const reader = createAccountEmailReader(io);
    expect(await reader.read(request(['f']))).toBeUndefined();
    files.set('f', { text: claudeText('a@x.com'), mtimeMs: 1 });
    expect(await reader.read(request(['f']))).toBe('a@x.com');
  });

  test('a failed read is not remembered (the CLI may be writing the file)', async () => {
    const { files, failRead, io } = makeIo();
    files.set('f', { text: claudeText('a@x.com'), mtimeMs: 1 });
    failRead.add('f');
    const reader = createAccountEmailReader(io);
    expect(await reader.read(request(['f']))).toBeUndefined();
    failRead.clear();
    expect(await reader.read(request(['f']))).toBe('a@x.com');
  });

  test('a file above the size cap is not read at all', async () => {
    const { files, calls, io } = makeIo();
    files.set('f', { text: 'x'.repeat(MAX_ACCOUNT_FILE_BYTES + 1), mtimeMs: 1 });
    const reader = createAccountEmailReader(io);
    expect(await reader.read(request(['f']))).toBeUndefined();
    expect(calls.read).toBe(0);
  });

  test('the first file that carries an e-mail wins', async () => {
    const { files, io } = makeIo();
    files.set('a', { text: '{}', mtimeMs: 1 });
    files.set('b', { text: claudeText('b@x.com'), mtimeMs: 1 });
    expect(await createAccountEmailReader(io).read(request(['a', 'b']))).toBe('b@x.com');
  });

  test('two profiles never share an answer', async () => {
    const { files, io } = makeIo();
    files.set('f1', { text: claudeText('one@x.com'), mtimeMs: 1 });
    files.set('f2', { text: claudeText('two@x.com'), mtimeMs: 1 });
    const reader = createAccountEmailReader(io);
    const [one, two] = await Promise.all([
      reader.read({ key: 'p1', provider: 'claude', files: ['f1'] }),
      reader.read({ key: 'p2', provider: 'claude', files: ['f2'] }),
    ]);
    expect([one, two]).toEqual(['one@x.com', 'two@x.com']);
  });
});

describe('reader with real temp files (the default disk access)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-email-'));
  afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  test('reads a fake .claude.json and follows a rewrite', async () => {
    const file = path.join(tmp, '.claude.json');
    fs.writeFileSync(file, JSON.stringify({ oauthAccount: { emailAddress: 'first@gmail.com' } }));
    const reader = createAccountEmailReader();
    expect(await reader.read({ key: 'k', provider: 'claude', files: [file] })).toBe('first@gmail.com');
    fs.writeFileSync(file, JSON.stringify({ oauthAccount: { emailAddress: 'second@gmail.com' } }));
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
    expect(await reader.read({ key: 'k', provider: 'claude', files: [file] })).toBe('second@gmail.com');
  });

  test('tokens next to the e-mail never come out: the answer is the e-mail string only', async () => {
    const file = path.join(tmp, 'auth.json');
    const secretId = jwt({ email: 'me@gmail.com', secret_claim: 'TOP-SECRET-CLAIM' });
    fs.writeFileSync(file, JSON.stringify({ tokens: { id_token: secretId, access_token: 'sk-TOP-SECRET', refresh_token: 'rt-TOP-SECRET' } }));
    const answer = await createAccountEmailReader().read({ key: 'c', provider: 'codex', files: [file] });
    expect(answer).toBe('me@gmail.com');
    expect(JSON.stringify(answer)).not.toMatch(/SECRET|eyJ|signature-part/);
  });

  test('a broken file gives nothing instead of throwing', async () => {
    const file = path.join(tmp, 'broken.json');
    fs.writeFileSync(file, '{"oauthAccount": {"emailAddress": "x@y');
    await expect(createAccountEmailReader().read({ key: 'b', provider: 'claude', files: [file] })).resolves.toBeUndefined();
  });
});

describe('source rules for the new module', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'electron', 'agent-account-identity.ts'), 'utf8');

  test('no synchronous file or folder access (the stage-2 speed work removed those on purpose)', () => {
    expect(source).not.toMatch(/readFileSync|readdirSync|statSync|existsSync|execSync|spawnSync/);
  });

  test('nothing is logged (a JSON parse error message can quote the file)', () => {
    expect(source).not.toMatch(/console\./);
  });
});
