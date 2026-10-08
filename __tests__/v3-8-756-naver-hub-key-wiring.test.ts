/**
 * v3.8.756 — 환경설정에 네이버 API HUB 키가 있는데 글 생성은 "검색 키 없음"
 *
 * 고객 실측(2026-10-08): 환경설정 카드에 HUB Client ID·Secret 이 들어 있었다(초록 점).
 * 그런데 생성 로그는 "⛔ 네이버 검색 API 키가 없습니다(API HUB 키·개발자센터 키 모두 없음)" →
 * 근거 0건 → "검색 혼선 확인법" · "뜻 확인하는 법" 같은 빈 글이 자동 발행됐다.
 *
 * 원인(세 군데 모두 HUB 키가 빠져 있었다 — 칸만 있고 배선이 없는 이 저장소의 단골 사고):
 *   ① 저장 버튼의 envData 에 HUB 키가 없어 `.env` 로 안 갔다(localStorage 에만 저장 → 화면엔 보임)
 *   ② main 의 save-env keyMap 에 HUB 키 이름이 없었다
 *   ③ 발행 payload(getApiKeys)에도 없었다
 *   검색 창구(resolveAllNaverCredentials)는 payload 나 `.env` 만 본다.
 * 덤: 검색 키 칸(naverClientId)보다 "키워드 분석" 카드의 Customer ID 가 먼저라 둘 다 넣으면 검색 키가 덮였다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { resolveAllNaverCredentials } from '../src/core/naver-search-client';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const mainTs = read('electron', 'main.ts');
const settingsJs = read('electron', 'ui', 'modules', 'settings.js');
const postingJs = read('electron', 'ui', 'modules', 'posting.js');

function between(src: string, from: string, to: string): string {
  const at = src.indexOf(from);
  if (at < 0) throw new Error(`표식 없음: ${from}`);
  const end = src.indexOf(to, at + from.length);
  if (end < 0) throw new Error(`표식 없음: ${to}`);
  return src.slice(at, end);
}

/** settings.js 의 실제 함수 본문을 떼어 돌린다(모듈 전체는 브라우저 전용이라 못 불러온다) */
function loadSyncFunction(): (settings: any, env: any, saveEnv: any) => Promise<boolean> {
  const source = between(settingsJs, 'const SEARCH_KEY_ENV_NAMES', '// 설정 로드 (비동기)')
    .replace('export async function', 'async function');
  // eslint-disable-next-line no-new-func
  return new Function('window', 'console', `${source}\nreturn syncMissingSearchKeysToEnv;`)({}, { log() {}, warn() {} });
}

describe('v3.8.756 HUB 키 저장 배선', () => {
  test('main save-env keyMap 이 HUB 키를 로더가 읽는 이름으로 바꾼다', () => {
    const keyMap = between(mainTs, "ipcMain.handle('save-env'", '// 기존 .env 파일 읽기');
    expect(keyMap).toContain("'naverApiHubKeyId': 'NAVER_API_HUB_KEY_ID',");
    expect(keyMap).toContain("'naverApiHubKey': 'NAVER_API_HUB_KEY',");
  });

  test('저장 버튼이 HUB 키를 .env 로 보낸다', () => {
    const envData = between(settingsJs, 'const envData = {', 'const maskEnvValue');
    expect(envData).toContain('naverApiHubKeyId: settings.naverApiHubKeyId,');
    expect(envData).toContain('naverApiHubKey: settings.naverApiHubKey,');
  });

  test('검색 키 칸이 키워드 분석 카드의 Customer ID 보다 먼저다(덮어쓰기 금지)', () => {
    const envData = between(settingsJs, 'const envData = {', 'const maskEnvValue');
    expect(envData).toContain("naverClientId: settings.naverClientId || settings.naverCustomerId || '',");
    expect(envData).toContain("naverClientSecret: settings.naverClientSecret || settings.naverSecretKey || '',");
    expect(envData).not.toContain('settings.naverCustomerId || settings.naverClientId');
  });

  test('발행 payload 에도 검색 키가 실린다', () => {
    const apiKeys = between(postingJs, 'function getApiKeys(savedSettings) {', '\n}');
    for (const field of ['naverApiHubKeyId', 'naverApiHubKey', 'naverClientId', 'naverClientSecret']) {
      expect(apiKeys).toContain(`${field}: savedSettings.${field} || '',`);
    }
  });

  test('payload 에 HUB 키가 있으면 검색 창구가 HUB 로 잡는다', () => {
    const creds = resolveAllNaverCredentials({ naverApiHubKeyId: 'hub-id', naverApiHubKey: 'hub-secret' });
    expect(creds[0]).toEqual({ mode: 'hub', keyId: 'hub-id', keySecret: 'hub-secret' });
  });

  test('불러올 때 동기화를 부른다 — .env 병합 직후', () => {
    const load = between(settingsJs, 'export async function loadSettings()', '// 설정 저장');
    const mergeAt = load.indexOf('settings = { ...settings, ...camelizeEnvKeys(envSettings) };');
    const syncAt = load.indexOf('await syncMissingSearchKeysToEnv(settings, envSettings);');
    expect(mergeAt).toBeGreaterThan(-1);
    expect(syncAt).toBeGreaterThan(mergeAt);
  });
});

describe('v3.8.756 이미 키를 넣어 둔 고객 — 불러올 때 .env 로 옮긴다(실제 함수 실행)', () => {
  const sync = loadSyncFunction();

  test('화면에만 있고 .env 에 없으면 그 둘만 저장한다', async () => {
    const saved: any[] = [];
    const ok = await sync(
      { naverApiHubKeyId: 'tyidqmp1n2', naverApiHubKey: 'secret-value', openaiKey: 'sk-x' },
      { OPENAI_API_KEY: 'sk-x' },
      async (data: any) => { saved.push(data); return { ok: true }; },
    );
    expect(ok).toBe(true);
    expect(saved).toEqual([{ naverApiHubKeyId: 'tyidqmp1n2', naverApiHubKey: 'secret-value' }]);
  });

  test('.env 에 이미 있으면 건드리지 않는다(.env 가 정본)', async () => {
    const saved: any[] = [];
    const ok = await sync(
      { naverApiHubKeyId: 'old-local', naverApiHubKey: 'old-secret' },
      { NAVER_API_HUB_KEY_ID: 'env-id', NAVER_API_HUB_KEY: 'env-secret' },
      async (data: any) => { saved.push(data); return { ok: true }; },
    );
    expect(ok).toBe(false);
    expect(saved).toEqual([]);
  });

  test('화면에도 없으면 아무것도 안 한다', async () => {
    const saved: any[] = [];
    expect(await sync({}, {}, async (d: any) => { saved.push(d); return { ok: true }; })).toBe(false);
    expect(saved).toEqual([]);
  });

  test('저장이 실패해도 불러오기를 깨지 않는다', async () => {
    await expect(sync({ naverApiHubKeyId: 'a', naverApiHubKey: 'b' }, {}, async () => { throw new Error('io'); })).resolves.toBe(false);
  });
});
