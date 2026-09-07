/**
 * v3.8.698 — 발행·재생성 payload 가 낡은 비밀번호를 싣던 문제 (401)
 *
 * 사장님: "❌ 다시 생성 실패: Request failed with status code 401 글다시생성하니까 이렇게뜨네"
 *
 * ## v3.8.690 이 절반만 고쳤다
 * 그때는 **설정 화면 표시**만 `.env` 우선으로 바꿨다. 그런데 발행·재생성이 쓰는 payload 는
 * `loadSettings()` 로 만들어지고, 그 함수는 **localStorage 만 보고 있었다.**
 * wordpress-posts 의 우선순위가 `payload → env` 라서 낡은 값이 이겼다.
 *
 * 실측(2026-09-07, 같은 계정):
 *   .env 비밀번호        → HTTP 200
 *   localStorage 비밀번호 → HTTP 401   ← payload 에 실리던 값
 *
 * 두 저장소가 갈리는 것 자체는 막을 수 없다(설정을 한쪽에만 쓴 경로가 과거에 있었다).
 * 그러니 **읽는 쪽에서 정본을 정한다** — `.env` 가 정본이다(main 프로세스가 그것으로 인증한다).
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const settings = read('electron/ui/modules/settings.js');
const posts = read('electron/ui/modules/published-posts.js');
const wpPosts = read('src/wordpress/wordpress-posts.ts');

/** settings.js 의 두 함수를 소스에서 떼어 그대로 돌린다 — 코드가 곧 시험 대상이다 */
function loadMerge() {
  const camel = blockBetween(settings, 'function camelizeEnvKeys', 'function restoreBloggerAliases');
  // eslint-disable-next-line no-new-func
  return new Function(`${camel}\nreturn camelizeEnvKeys;`)() as (env: any) => Record<string, string>;
}

describe('① .env 가 정본이다', () => {
  const camelizeEnvKeys = loadMerge();

  test('⭐ .env 의 비밀번호가 localStorage 를 이긴다', () => {
    const saved = { wordpressPassword: 'OLD-401-bi74', wordpressUsername: 'u@x.com' };
    const env = { WORDPRESS_PASSWORD: 'NEW-200-gjkR' };
    const merged = { ...saved, ...camelizeEnvKeys(env) };
    expect(merged.wordpressPassword).toBe('NEW-200-gjkR');
    expect(merged.wordpressUsername).toBe('u@x.com');   // .env 에 없는 값은 그대로
  });

  test('⭐ .env 가 비어 있으면 저장값을 지우지 않는다 — 없는 것과 지운 것은 다르다', () => {
    const merged = { ...{ wordpressPassword: '살아있는값' }, ...camelizeEnvKeys({ WORDPRESS_PASSWORD: '' }) };
    expect(merged.wordpressPassword).toBe('살아있는값');
  });
});

describe('② loadSettings 가 실제로 병합한다 (payload 는 여기서 나온다)', () => {
  const fn = blockBetween(settings, 'export async function loadSettings', 'export async function saveSettings');

  test('⭐ 병합이 들어 있다', () => {
    expect(fn).toContain('settings = { ...settings, ...camelizeEnvKeys(envSettings) }');
  });

  test('⭐ 플랫폼은 저장값이 먼저다 — 배지로 고른 선택이 되돌아가면 안 된다', () => {
    // v3.8.534 실사고: "배지로 수정 안 된다". 자격증명만 .env 정본을 따른다.
    expect(fn).toContain('if (originalPlatform) settings.platform = originalPlatform;');
    expect(fn.indexOf('camelizeEnvKeys(envSettings)')).toBeLessThan(fn.indexOf('settings.platform = originalPlatform'));
  });

  test('⭐ 플랫폼 판정보다 앞서 되돌린다 (안 그러면 판정이 .env 값을 본다)', () => {
    expect(fn.indexOf('settings.platform = originalPlatform')).toBeLessThan(fn.indexOf('resolvePlatformValue(settings, envSettings'));
  });
});

describe('③ 왜 payload 가 이기는지 — 그 사실이 코드에 남아 있다', () => {
  test('워드프레스는 payload 를 env 보다 먼저 본다', () => {
    // 이 순서가 바뀌면 이번 수정의 근거가 사라진다 — 바뀌면 알아채야 한다
    const pick = wpPosts.slice(wpPosts.indexOf("payload['password']"));
    expect(pick.indexOf("payload['wordpressPassword']")).toBeLessThan(pick.indexOf("env['WORDPRESS_PASSWORD']"));
  });

  test('편집기·글목록 payload 가 loadSettings 를 거친다', () => {
    expect(posts).toContain('const settings = await loadSettings() || {}');
    expect(posts).toContain('wordpressPassword: settings.wordpressPassword');
  });
});

describe('④ 에이전트 모드도 같은 정본을 본다 (별도 경로 함정)', () => {
  const agent = read('electron/ui/modules/codex-workshop.js');

  test('⭐ .env 를 함께 읽는 래퍼가 있다', () => {
    expect(agent).toContain('async function readAgentSettingsWithEnv()');
    expect(agent).toContain('window.blogger?.getEnv?.()');
  });

  test('⭐ localStorage 직접 읽기는 그 래퍼 안에서만 쓴다', () => {
    // "에이전트 모드는 orchestration 을 안 탄다 — 규칙 고쳐도 그쪽엔 안 걸린다"(기존 교훈)
    // 정의 줄(`function readAgentStoredSettings()`)은 빼고 **호출**만 센다
    const calls = (agent.match(/(?<!function )readAgentStoredSettings\(\)/g) || []).length;
    expect(calls).toBe(1);
  });

  test('⭐ 플랫폼 설정과 API 키 둘 다 .env 를 본다', () => {
    expect(agent).toContain('const settings = await readAgentSettingsWithEnv();');
    expect((agent.match(/await readAgentSettingsWithEnv\(\)/g) || []).length).toBe(2);
  });

  test('⭐ 플랫폼은 저장값 우선을 지킨다 (배지 선택이 되돌아가면 안 된다)', () => {
    const fn = blockBetween(agent, 'async function readAgentSettingsWithEnv', 'async function getAgentPlatformConfig');
    expect(fn).toContain('if (platform) merged.platform = platform;');
  });

  test('.env 를 못 읽어도 예전처럼 동작한다', () => {
    const fn = blockBetween(agent, 'async function readAgentSettingsWithEnv', 'async function getAgentPlatformConfig');
    expect(fn).toContain('return stored;');
  });

  test('⭐ 비동기로 바뀐 호출부에 await 가 빠지지 않았다', () => {
    expect(agent).toContain('const config = await getAgentPlatformConfig();');
    expect(agent).toContain('if (!config) config = await getAgentPlatformConfig();');
    expect(agent).toContain('await readAgentImageApiKey(meta.keyId)');
    // 기본 인자로 Promise 를 넘기면 config 가 Promise 가 된다 — 그 꼴이 남아 있으면 안 된다
    expect(agent).not.toContain('config = getAgentPlatformConfig())');
  });
});
