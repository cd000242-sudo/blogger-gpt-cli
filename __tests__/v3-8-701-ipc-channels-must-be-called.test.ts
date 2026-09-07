/**
 * v3.8.701 — **등록만 하고 아무도 안 부르는 IPC 채널을 잡는다**
 *
 * 사장님: "IPC는 있는데 UI 버튼이 없다를 자동 검사에 넣을까요?" → "응 넣어줘"
 *
 * ## 왜 필요한가 — 하루에 세 번 나왔다 (2026-09-07)
 *   · `cta-render-block`  🔘 수동 CTA 버튼 — v3.8.570 에 만들고 require 경로가 틀려 죽어 있었다
 *   · `cta-audit-run`     CTA 링크 점검 — v3.8.572 에 만들고 **버튼을 안 달아** 아무도 못 썼다
 *   · 색인 요청·말투 등록·허브 백링크 — 셋 다 로드 실패로 조용히 죽어 있었다
 *
 * 공통점: **코드는 멀쩡한데 부를 방법이 없다.** 빌드도 타입검사도 못 잡는다.
 * 화면에 오류도 안 뜬다 — 그냥 그 기능이 없는 것처럼 조용하다.
 *
 * ## 어떻게 재는가
 * main 쪽의 `ipcMain.handle/on` 채널 이름을 모으고, **UI 전체 + preload** 에서 그 이름이
 * 문자열로 등장하는지 본다. preload 를 포함하는 이유는 그쪽이 이름을 감싸 주는 경우가 많기
 * 때문이다(`window.blogger.getEnv()` → `invoke('get-env')`).
 *
 * ## 기존 16개는 통과시킨다
 * 지금 있는 고아를 전부 실패로 만들면 이 검사가 켜지지도 못한다.
 * **오늘 실측한 16개를 기준선으로 두고, 늘어나면 실패**한다. 줄어드는 것은 언제나 환영이다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');

/** main 프로세스에서 채널을 등록하는 파일들 */
const MAIN_FILES = ['electron/main.ts', 'electron/updater.ts'];

/**
 * 부르는 쪽 — UI 전체와 preload.
 * preload 를 빼면 `window.blogger.*` 로 감싼 채널이 전부 고아로 잡힌다.
 */
const CALLER_DIRS = ['electron/ui'];
const CALLER_FILES = ['electron/preload.ts'];

/**
 * 2026-09-07 실측 기준선 — 등록됐지만 UI·preload 어디서도 안 부르는 채널.
 *
 * 여기 있다고 "괜찮다"는 뜻은 아니다. 살릴지 지울지 아직 안 정했을 뿐이다.
 * **새 채널을 만들면 반드시 부르는 곳도 만든다** — 이 목록에 새로 추가하지 말 것.
 */
const KNOWN_ORPHANS = [
  'blogger-auth-expired',
  'blogger-auth-expiring-soon',
  'check-api-keys',
  'check-feature-access',
  'drive:report-status',
  'generate-internal-consistency-title',
  'get-license-tier',
  'golden-keyword:token-status',
  'license-activate',
  'naver:session-status',
  'save-keyword-settings',
  'save-license-file',
  'start-blogger-auth',
  'sync-license-with-server',
  'updater:check',      // v3.8.692 의 updater:restart-to-latest 로 대체됨(옛 호환용)
  'updater:install',    // 같은 이유
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|html|ts)$/.test(name) && !/\.map$/.test(name)) out.push(full);
  }
  return out;
}

function collectRegistered(): Map<string, string> {
  const registered = new Map<string, string>();
  for (const rel of MAIN_FILES) {
    const src = fs.readFileSync(path.join(root, rel), 'utf-8');
    for (const m of src.matchAll(/ipcMain\.(?:handle|on)\(\s*['"]([^'"]+)['"]/g)) {
      registered.set(m[1]!, rel);
    }
  }
  return registered;
}

function collectCallerText(): string {
  const files: string[] = [];
  for (const rel of CALLER_FILES) {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) files.push(full);
  }
  for (const rel of CALLER_DIRS) {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) walk(full, files);
  }
  return files.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
}

function findOrphans(): string[] {
  const registered = collectRegistered();
  const callers = collectCallerText();
  const orphans: string[] = [];
  for (const channel of registered.keys()) {
    const quoted = [`'${channel}'`, `"${channel}"`, '`' + channel + '`'];
    if (quoted.some((q) => callers.includes(q))) continue;
    orphans.push(channel);
  }
  return orphans.sort();
}

describe('등록만 하고 아무도 안 부르는 IPC 채널', () => {
  const orphans = findOrphans();

  test('검사가 실제로 동작한다 — 채널을 못 찾으면 이 검사는 거짓말이다', () => {
    // 채널이 수백 개다. 0 이 나오면 정규식이 깨진 것이지 코드가 깨끗한 게 아니다.
    expect(collectRegistered().size).toBeGreaterThan(100);
    expect(collectCallerText().length).toBeGreaterThan(100000);
  });

  test('⭐ 새로 만든 채널은 부르는 곳도 있어야 한다', () => {
    const added = orphans.filter((c) => !KNOWN_ORPHANS.includes(c));
    if (added.length) {
      console.error(
        '\n부르는 곳이 없는 IPC 채널이 새로 생겼습니다:\n'
        + added.map((c) => `  · ${c}`).join('\n')
        + '\n\nUI 에서 window.electronAPI.invoke("<채널>") 로 부르거나,'
        + ' preload 에 감싸는 함수를 만드세요.'
        + '\n부르는 곳 없이 두면 코드는 멀쩡한데 기능이 없는 것처럼 조용합니다'
        + ' (2026-09-07 에만 세 번 났습니다).\n',
      );
    }
    expect(added).toEqual([]);
  });

  test('⭐ 고아가 늘지 않는다 (2026-09-07 실측 16개)', () => {
    // 기준선을 손으로 늘려 검사를 무력화하는 것도 막는다
    expect(orphans.length).toBeLessThanOrEqual(KNOWN_ORPHANS.length);
  });

  test('기준선이 썩지 않게 — 이미 배선된 것은 목록에서 빼라', () => {
    const wiredNow = KNOWN_ORPHANS.filter((c) => !orphans.includes(c));
    if (wiredNow.length) {
      console.error(`\n이제 부르는 곳이 생겼습니다 — KNOWN_ORPHANS 에서 지우세요:\n${wiredNow.map((c) => `  · ${c}`).join('\n')}\n`);
    }
    expect(wiredNow).toEqual([]);
  });
});
