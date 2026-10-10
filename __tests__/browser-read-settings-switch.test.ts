/**
 * 브라우저 정독 리서치 3단계 — 설정 화면 "꼼꼼 리서치" 스위치(기본 꺼짐).
 *
 * 값은 발행 데이터(payload)가 아니라 `.env` 의 BROWSER_READ 로 간다. 글 생성(단일·대기열·예약·에이전트)은 모두
 * main 프로세스 안에서 돌며 process.env 를 보므로, 저장할 때 process.env 까지 바로 바꾸면 세 경로를 따로 배선할 필요가 없다.
 * 이 저장소의 단골 사고("칸만 있고 배선이 없다", 7회 재발)를 막으려고 화면 id → 저장 → main 적용 → 다시 열 때 복원을 전부 본다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import { browserReadEnabled } from '../src/core/crawlers/browser-reader';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const html = read('electron', 'ui', 'index.html');
const settingsJs = read('electron', 'ui', 'modules', 'settings.js');

describe('화면 — 설정 모달 API 키 탭의 네이버 검색 칸 아래', () => {
  test('스위치 id 가 실제로 있고 하나뿐이며, 체크박스이고 기본은 꺼짐', () => {
    expect((html.match(/id="browserReadMode"/g) || []).length).toBe(1);
    const tag = html.match(/<input[^>]*id="browserReadMode"[^>]*>/)![0];
    expect(tag).toContain('type="checkbox"');
    expect(tag).not.toMatch(/\schecked\b/);
  });
  test('API 키 탭(실제로 보이는 탭) 안, 네이버 검색 API 칸 안에 있다', () => {
    const apiTab = blockBetween(html, 'id="tab-api-keys"', 'id="tab-platform"');
    expect(apiTab).toContain('id="browserReadMode"');
    const naverSection = blockBetween(html, 'id="naverSearchApiSection"', '키워드 분석 / 이미지 검색 API');
    expect(naverSection).toContain('id="browserReadMode"');
    expect(naverSection).toContain('꼼꼼 리서치');
  });
});

describe('저장 — settings.js(실제로 도는 모듈) → .env', () => {
  test('저장 버튼이 BROWSER_READ 를 대문자 키·1/0 으로 보낸다(빈 값이면 끄기가 저장되지 않는다)', () => {
    const envData = blockBetween(settingsJs, 'const envData = {', 'const maskEnvValue');
    expect(envData).toContain("BROWSER_READ: document.getElementById('browserReadMode')?.checked ? '1' : '0',");
  });
  test('설정 창을 다시 열면 .env 값으로 스위치를 되살린다(.value 가 아니라 .checked)', () => {
    const load = blockBetween(settingsJs, 'export async function loadSettingsContent', 'applyTextModelRadio(mergedSettings);\n\n      Object.entries(fieldMappings)');
    expect(load).toContain("const browserReadEl = document.getElementById('browserReadMode');");
    expect(load).toContain("browserReadEl.checked = String(mergedSettings.BROWSER_READ ?? mergedSettings.browserRead ?? '0') === '1';");
  });
});

describe('적용 — main 의 save-env 가 process.env 를 바로 바꾼다(다시 켜지 않아도)', () => {
  for (const file of ['electron/main.ts', 'electron/main.js']) {
    test(`${file}: 저장하면 BROWSER_READ 를 1/0 으로 즉시 반영한다`, () => {
      const handler = blockBetween(read(file), "ipcMain.handle('save-env'", '라이센스 파일 핸들러');
      expect(handler).toContain("process.env['BROWSER_READ'] = String(envData['BROWSER_READ']) === '1' ? '1' : '0';");
      expect(handler).toContain("Object.prototype.hasOwnProperty.call(envData, 'BROWSER_READ')");
      expect(handler).toContain('// 기존 .env 파일 읽기');   // 다른 테스트(v3.8.756)가 쓰는 표식 — 지우지 않는다
    });
  }
  test('실제 저장 코드(main.js save-env)를 그대로 돌려 본다 — 켜고 저장 → 켜짐, 끄고 저장 → 바로 꺼짐(.env 도 0)', async () => {
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-env-'));
    const handlers: Record<string, (evt: unknown, data: Record<string, string>) => Promise<{ ok: boolean }>> = {};
    const electron = { ipcMain: { handle: (ch: string, fn: any) => { handlers[ch] = fn; } }, app: { getPath: () => dir } };
    const block = `${blockBetween(read('electron', 'main.js'), "electron_1.ipcMain.handle('save-env'", '\n});')}\n});`;
    // eslint-disable-next-line no-new-func
    new Function('electron_1', 'path', 'fs', 'console', block)(electron, path, fs, { log() {}, error() {} });
    const before = process.env['BROWSER_READ'];
    try {
      fs.writeFileSync(path.join(dir, '.env'), 'OPENAI_API_KEY=keep-me', 'utf-8');
      expect((await handlers['save-env']!(null, { BROWSER_READ: '1' })).ok).toBe(true);
      expect(process.env['BROWSER_READ']).toBe('1');
      expect(browserReadEnabled(process.env, {})).toBe(true);
      expect((await handlers['save-env']!(null, { BROWSER_READ: '0' })).ok).toBe(true);
      expect(process.env['BROWSER_READ']).toBe('0');
      expect(browserReadEnabled(process.env, {})).toBe(false);
      const saved = fs.readFileSync(path.join(dir, '.env'), 'utf-8');
      expect(saved).toContain('BROWSER_READ=0');
      expect(saved).toContain('OPENAI_API_KEY=keep-me');      // 다른 설정은 그대로
    } finally {
      if (before === undefined) delete process.env['BROWSER_READ']; else process.env['BROWSER_READ'] = before;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('실제 화면 코드(settings.js)의 저장 줄과 복원 줄을 돌려 본다 — 스위치 상태 ↔ 1/0', () => {
    const envData = blockBetween(settingsJs, 'const envData = {', 'const maskEnvValue');
    const saveLine = envData.split('\n').find((l: string) => l.includes('BROWSER_READ:'))!.trim().replace(/,$/, '');
    const docWith = (checked: boolean | null) => ({ getElementById: (id: string) => (id === 'browserReadMode' && checked !== null ? { checked } : null) });
    // eslint-disable-next-line no-new-func
    const save = (doc: unknown) => new Function('document', `return ({ ${saveLine} });`)(doc).BROWSER_READ;
    expect(save(docWith(true))).toBe('1');
    expect(save(docWith(false))).toBe('0');
    expect(save(docWith(null))).toBe('0');           // 스위치가 없어도 빈 값이 아니라 0

    const load = blockBetween(settingsJs, "const browserReadEl = document.getElementById('browserReadMode');", '// 라디오 카드 복원');
    const el = { checked: false };
    // eslint-disable-next-line no-new-func
    const restore = (merged: Record<string, unknown>) => new Function('document', 'mergedSettings', `const browserReadEl = document.getElementById('browserReadMode');${load.replace("const browserReadEl = document.getElementById('browserReadMode');", '')}`)({ getElementById: () => el }, merged);
    restore({ BROWSER_READ: '1' }); expect(el.checked).toBe(true);
    restore({ BROWSER_READ: '0' }); expect(el.checked).toBe(false);
    restore({ browserRead: '1' }); expect(el.checked).toBe(true);   // .env 키를 camelCase 로 바꾼 값
    restore({}); expect(el.checked).toBe(false);                   // 기본은 꺼짐
  });

  test('1 이면 켜지고 0 이면 꺼진다 — 끄기가 실제로 꺼진다', () => {
    expect(browserReadEnabled({ BROWSER_READ: '1' }, {})).toBe(true);
    expect(browserReadEnabled({ BROWSER_READ: '0' }, {})).toBe(false);
  });
});
