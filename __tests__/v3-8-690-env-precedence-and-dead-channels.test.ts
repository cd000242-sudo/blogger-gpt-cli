/**
 * v3.8.690 — 설정값이 갈렸을 때 무엇을 읽는가 + 죽어 있던 채널 3개
 *
 * 사장님: "환경설정에 세팅한값이 어딜읽는지보고 다른값은 지워버리면되자나"
 *
 * ## 실측 사고 (2026-09-07)
 * 워드프레스 비밀번호가 두 곳에 서로 다른 값으로 있었다. 실제로 인증해 확인했다:
 *   localStorage(bloggerSettings).wordpressPassword → 401 (옛 값)
 *   userData/.env WORDPRESS_PASSWORD               → 200 (현재 값)
 *
 * 병합부 주석은 "env가 우선"이라 적혀 있었지만 그렇게 동작하지 않았다.
 * `get-env` 가 `.env` 를 대문자_스네이크 그대로 주므로 스프레드에서 충돌이 안 나고,
 * pickSettingValue 가 카멜케이스를 먼저 보기 때문에 **옛 값이 이겼다.**
 *
 * 지금 발행이 되는 건 설정 모달을 안 열어서일 뿐이다. 열고 저장하는 순간
 * 옛 비밀번호가 `.env` 를 덮어써 발행이 멈춘다 — 값을 지우는 것만으로는 원인이 남는다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/**
 * settings.js 는 ESM 모듈이고 브라우저 전역(document 등)에 기대므로 통째로 import 하지 않는다.
 * 판정의 핵심인 두 함수만 소스에서 떼어내 그대로 돌린다 — 코드가 곧 시험 대상이다.
 */
function loadFns() {
  const src = read('electron/ui/modules/settings.js');
  const pick = src.slice(src.indexOf('function pickSettingValue'), src.indexOf('function hasBloggerSettings'));
  const camel = src.slice(src.indexOf('function camelizeEnvKeys'), src.indexOf('function restoreBloggerAliases'));
  // eslint-disable-next-line no-new-func
  return new Function(`${pick}\n${camel}\nreturn { pickSettingValue, camelizeEnvKeys };`)() as {
    pickSettingValue: (s: any, k: string[]) => string;
    camelizeEnvKeys: (e: any) => Record<string, string>;
  };
}

describe('① .env 가 실제로 이긴다 (주석이 늘 그렇게 말했다)', () => {
  const { pickSettingValue, camelizeEnvKeys } = loadFns();

  /** 실측 그대로 — 옛 localStorage 값 vs 현재 .env 값 */
  const saved = { wordpressPassword: 'OLD-stale-bi74' };
  const env = { WORDPRESS_PASSWORD: 'NEW-working-jkR', WORDPRESS_SITE_URL: 'https://leadernam.com' };

  test('⭐ 고친 뒤: .env 의 현재 비밀번호가 뽑힌다', () => {
    const merged = { ...saved, ...env, ...camelizeEnvKeys(env) };
    const picked = pickSettingValue(merged, ['wordpressPassword', 'wpPassword', 'WORDPRESS_PASSWORD']);
    expect(picked).toBe('NEW-working-jkR');
  });

  test('⭐ 고치기 전이었다면 옛 값이 이겼다 (사고 재현)', () => {
    const 예전병합 = { ...saved, ...env };   // 별칭 없음 = v3.8.689 까지의 동작
    const picked = pickSettingValue(예전병합, ['wordpressPassword', 'wpPassword', 'WORDPRESS_PASSWORD']);
    expect(picked).toBe('OLD-stale-bi74');   // ← 이것이 사장님이 겪을 뻔한 일이다
  });

  test('대문자 키도 그대로 남는다 — 그걸 읽는 목록이 따로 있다', () => {
    const merged = { ...saved, ...env, ...camelizeEnvKeys(env) };
    expect(merged.WORDPRESS_PASSWORD).toBe('NEW-working-jkR');
  });
});

describe('② 별칭 규칙은 손으로 나열하지 않는다 (새 설정마다 같은 사고가 나지 않게)', () => {
  const { camelizeEnvKeys } = loadFns();

  test('대문자_스네이크를 카멜로 바꾼다', () => {
    expect(camelizeEnvKeys({ WORDPRESS_SITE_URL: 'x' })).toEqual({ wordpressSiteUrl: 'x' });
    expect(camelizeEnvKeys({ NAVER_API_HUB_KEY_ID: 'x' })).toEqual({ naverApiHubKeyId: 'x' });
    expect(camelizeEnvKeys({ VISIBLE_BROWSER: 'true' })).toEqual({ visibleBrowser: 'true' });
  });

  test('⭐ 빈 값으로는 멀쩡한 저장값을 덮지 않는다 — 없는 것과 지운 것은 다르다', () => {
    expect(camelizeEnvKeys({ WORDPRESS_PASSWORD: '' })).toEqual({});
    expect(camelizeEnvKeys({ WORDPRESS_PASSWORD: '   ' })).toEqual({});
    const merged = { ...{ wordpressPassword: '살아있는값' }, ...camelizeEnvKeys({ WORDPRESS_PASSWORD: '' }) };
    expect(merged.wordpressPassword).toBe('살아있는값');
  });

  test('이미 카멜인 키는 건드리지 않는다', () => {
    expect(camelizeEnvKeys({ wordpressPassword: 'x' })).toEqual({});
  });

  test('배선 — 병합부가 실제로 이 함수를 쓴다', () => {
    const src = read('electron/ui/modules/settings.js');
    expect(src).toContain('...envSettings, ...camelizeEnvKeys(envSettings)');
  });
});

describe('③ 죽어 있던 채널 — src/ 에는 .js 가 없다', () => {
  const main = read('electron/main.ts');

  /**
   * main.ts 는 `electron/main.js` 로 컴파일돼 평범한 node 로 돈다.
   * `require('../src/...')` 는 그 자리에 `.js` 가 있어야 하는데, TS 산출물은 `dist/` 로 간다.
   * 빌드도 타입검사도 이걸 못 잡는다 — require 문자열은 검사 대상이 아니기 때문이다.
   */
  test('⭐ main.ts 의 모든 상대 require 가 실제 파일을 가리킨다', () => {
    const rels = [...new Set([...main.matchAll(/require\('\.\.\/([^']+)'\)/g)].map((m) => m[1]))];
    expect(rels.length).toBeGreaterThan(10);
    const missing = rels.filter((rel) => {
      const base = path.join(root, rel);
      return !fs.existsSync(`${base}.js`) && !fs.existsSync(base) && !fs.existsSync(path.join(base, 'index.js'));
    });
    expect(missing).toEqual([]);
  });

  test('이번에 되살린 셋이 dist 를 가리킨다', () => {
    expect(main).toContain("require('../dist/core/indexing/index-request')");
    expect(main).toContain("require('../dist/core/final/tone-registry')");
    expect(main).toContain("require('../dist/core/spiderweb/hub-backlinks')");
  });

  test('그 셋이 실제로 필요한 것을 내보낸다', () => {
    expect(Object.keys(require('../dist/core/indexing/index-request'))).toContain('requestIndexingForUrl');
    expect(Object.keys(require('../dist/core/final/tone-registry'))).toContain('normalizeTone');
    expect(Object.keys(require('../dist/core/spiderweb/hub-backlinks'))).toContain('applySpiderHubBacklinks');
  });
});
