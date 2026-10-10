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
  test('1 이면 켜지고 0 이면 꺼진다 — 끄기가 실제로 꺼진다', () => {
    expect(browserReadEnabled({ BROWSER_READ: '1' }, {})).toBe(true);
    expect(browserReadEnabled({ BROWSER_READ: '0' }, {})).toBe(false);
  });
});
