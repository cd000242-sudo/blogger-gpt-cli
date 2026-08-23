/**
 * v3.8.548 — "설정을 한 번 열어야 이전값이 나온다" + 기본값 WordPress
 *
 * 사장님 보고: "설정이나 꼭 한번 버튼을 건드려야 이전값이 나오던데 이건 어떻게 못하니??
 *              깜빡하고 바로 글생성해버리면 실패되는 경우도 있으니까 말이야."
 *
 * ## 원인 (실측)
 *   · 시작 시 updatePlatformStatus() 는 loadSettings() 로 판정한 플랫폼을 **배지에만** 칠했다.
 *   · 발행 payload 는 `input[name="platform"]:checked` 를 1순위로 읽는다.
 *   · 그 라디오를 채우는 코드는 loadSettingsContent() 안에만 있었다 = 환경설정 모달을 열어야 실행.
 *   → 배지는 WordPress, 라디오는 index.html 하드코딩 checked(blogger).
 *     바로 글을 생성하면 배지와 다른 곳으로 나간다.
 *
 * 같은 함정의 반복이다: v3.8.411(소제목 이미지 엔진)·v3.8.414(텍스트 모델)도
 * "loadSettingsContent 안에만 있어서 모달을 열어야 반영"이었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const main = read('electron/ui/modules/main.js');
const settings = read('electron/ui/modules/settings.js');
const posting = read('electron/ui/modules/posting.js');
const queue = read('electron/ui/modules/publish-queue.js');
const html = read('electron/ui/index.html');

// ══════════════════════════════════════════════════════════
describe('① 시작하자마자 지난번 플랫폼이 라디오에 복원된다', () => {
  it('startup 이 loadSettings() 결과를 selectPlatform 으로 화면에 적용한다', () => {
    // loadSettings() 이후 ~ updatePlatformStatus() 이전 구간에 복원이 있어야 한다
    const startup = blockBetween(main, 'const settings = await loadSettings()', '// 7. 플랫폼 상태 업데이트');
    expect(startup).toContain('window.selectPlatform(restored)');
    expect(startup).toContain("settings.platform === 'blogspot' ? 'blogger' : settings.platform");
  });

  it('복원은 selectPlatform 한 곳에 맡긴다 — 라디오를 직접 켜는 네 번째 경로를 만들지 않는다', () => {
    const startup = blockBetween(main, 'const settings = await loadSettings()', '// 7. 플랫폼 상태 업데이트');
    expect(startup).not.toContain("getElementById('platform-wordpress')");
    expect(startup).not.toContain('.checked = true');
  });

  it('selectPlatform 은 라디오·배지·필드토글·저장을 모두 처리한다 (복원 한 번으로 충분한 근거)', () => {
    const fn = braceBlock(html, 'function selectPlatform(platform)');
    expect(fn).toContain("r.checked = (p === platform)");
    expect(fn).toContain('window.updatePlatformStatus()');
    expect(fn).toContain('window.togglePlatformFields()');
    expect(fn).toContain("localStorage.setItem('bloggerSettings'");
  });
});

// ══════════════════════════════════════════════════════════
describe('② 나머지 저장값도 환경설정을 열지 않고 채워진다', () => {
  it('시작 시 loadSettingsContent 를 유휴 시간에 한 번 부른다', () => {
    const deferred = braceBlock(main, 'function scheduleDeferredStartupModules');
    expect(deferred).toContain('loadSettingsContent({ skipPlatformRadio: true })');
  });

  it('사전 채우기는 플랫폼 라디오를 건드리지 않는다 — 시작 복원값을 되돌리면 안 된다', () => {
    expect(settings).toContain('const skipPlatformRadio = options.skipPlatformRadio === true');
    expect(settings).toContain('if (skipPlatformRadio) {');
  });

  it('근거: 환경설정 모달 HTML 은 index.html 에 이미 있고 loadSettingsContent 는 값만 채운다', () => {
    // 그래서 모달을 열지 않아도 채울 대상이 DOM 에 존재한다
    expect(settings).toContain('모달 내용 생성 (HTML은 index.html에 이미 있으므로 여기서는 값만 채움)');
    expect(html).toContain('id="settingsModalBody"');
  });
});

// ══════════════════════════════════════════════════════════
describe('③ 아무 단서도 없을 때의 기본값은 WordPress', () => {
  it('index.html 의 checked 가 WordPress 로 옮겨졌다', () => {
    expect(html).toContain('id="platform-wordpress" value="wordpress" checked');
    expect(html).not.toContain('id="platform-blogger" value="blogger" checked');
  });

  it('설정 판정기의 기본값이 WordPress 다', () => {
    expect(settings).toContain("function normalizePlatformValue(value, fallback = 'wordpress')");
    expect(settings).toContain("function resolvePlatformValue(saved = {}, env = {}, fallback = 'wordpress')");
    expect(settings).toContain("resolvePlatformValue(settings, envSettings, 'wordpress')");
  });

  it('발행 payload 의 최후 기본값도 WordPress 다 (여기가 실제로 나가는 값)', () => {
    const payload = blockBetween(posting, '// ── 플랫폼 ──', '// ── E-E-A-T 저자 정보 ──');
    expect(payload).not.toContain("'blogspot'");
    expect(payload.match(/\|\| 'wordpress'/g) || []).toHaveLength(2);
  });

  it('연속발행 큐의 기본값도 WordPress 다', () => {
    const fn = braceBlock(queue, 'function getCurrentPublishPlatform');
    expect(fn).toContain("|| 'wordpress'");
  });

  it('⭐ 저장된 선택은 기본값보다 언제나 우선한다 (기본값이 사장님 선택을 덮으면 안 된다)', () => {
    // 기본값 `saved = {}` 때문에 braceBlock 의 첫 중괄호가 인자 자리에 걸린다 — 경계로 자른다
    const fn = blockBetween(settings, 'function resolvePlatformValue', 'async function loadEnvSettingsForRecovery');
    const savedIdx = fn.indexOf('savedRaw');
    const envIdx = fn.indexOf('envRaw');
    const fallbackIdx = fn.indexOf('return fallback');
    expect(savedIdx).toBeGreaterThan(-1);
    expect(envIdx).toBeGreaterThan(savedIdx);      // 저장값 → .env 순
    expect(fallbackIdx).toBeGreaterThan(envIdx);   // 기본값은 맨 마지막
  });
});
