/**
 * v3.8.614 — 앱이 굳은 진짜 이유: 숨어 있던 alert() 창
 *
 * 사장님: "지금 앱이 굳었어 멈추고 아무반응이없어" → "창이 안닫혀" → "문구가 뜬건 아무것도없어"
 *
 * ## 실측
 * 프로세스는 멀쩡했다 — Responding=True, CPU 정상, 메모리 정상.
 * 그런데 `#32770` 클래스 창(제목 "lba")이 떠 있었다. Electron 의 alert() 창이다.
 * IDOK 를 보내 닫자마자 앱이 살아났다.
 *
 * ## alert() 가 나쁜 세 가지
 *   · 렌더러를 **완전히 멈춘다** — 클릭·입력·진행 중이던 발행까지 전부
 *   · 창이 뒤로 가면 **보이지도 않는다** → 사용자에겐 "굳었다" 로 보인다
 *   · 문구가 비면 **빈 상자만** 뜬다 (사장님이 본 것이 이것이다)
 *
 * 안내를 지우자는 게 아니다 — "조용한 미배선" 은 여전히 막아야 한다.
 * 다만 수단을 바꾼다: 흐름을 멈추지 않는 토스트 + 로그로.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 내가 이번 세션에 손댄 파일들 — 여기서는 alert 를 쓰지 않는다 */
const MY_FILES = [
  'electron/ui/modules/header-badges.js',
  'electron/ui/modules/published-posts.js',
];

describe('화면을 막지 않는 알림이 있다', () => {
  const core = read('electron/ui/modules/core.js');

  test('notifyUser 가 있고 밖으로 열려 있다', () => {
    expect(core).toContain('export function notifyUser');
    expect(core).toContain('window.notifyUser = notifyUser');
  });

  test('빈 알림은 만들지 않는다 — 빈 상자의 재발 방지', () => {
    expect(core).toMatch(/if \(!text\) return;/);
  });

  test('로그에도 남긴다 — 토스트를 놓쳐도 흔적이 남아야 한다', () => {
    expect(core).toMatch(/notifyUser[\s\S]{0,600}addLog\(text/);
  });

  test('토스트가 실패해도 alert 로 되돌아가지 않는다', () => {
    const fn = core.slice(core.indexOf('export function notifyUser'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).not.toMatch(/\balert\(/);
  });

  test('스스로 사라진다 — 쌓여서 화면을 덮지 않게', () => {
    expect(core).toMatch(/setTimeout\(\(\) => toast\.remove\(\)/);
  });
});

describe.each(MY_FILES)('%s — 흐름을 멈추는 alert 를 쓰지 않는다', (file) => {
  test('alert( 호출이 없다', () => {
    const src = read(file);
    const calls = src.match(/(?<![\w.])alert\(/g) || [];
    expect(calls).toHaveLength(0);
  });

  test('대신 notifyUser 로 알린다 — 안내를 없앤 게 아니다', () => {
    expect(read(file)).toContain('notifyUser');
  });
});

describe('편집기의 다시 생성 실패 안내도 막지 않는다', () => {
  const editor = read('electron/ui/modules/editor.js');

  test('다시 생성 실패는 토스트로 알린다', () => {
    expect(editor).toMatch(/notifyUser\?\.\(`다시 생성하지 못했습니다/);
  });
});
