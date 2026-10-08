/**
 * v3.8.756 — 드롭샷 보드 컨트롤 모양이 바뀌어 무제한 구독자도 매번 실패하던 것
 *
 * 고객 신고(2026-10-08): 무제한 플랜인데 썸네일이 "무제한 모드 토글을 찾지 못했습니다" ×2 →
 *   무료 대체 엔진(Pollinations)으로만 나왔다.
 * 실측(2026-10-08, 실제 보드 DOM):
 *   무제한 모드  <button role="switch" aria-checked="false" data-state="unchecked"> + 숨은 checkbox
 *   수량 줄이기  <button aria-label="생성 개수 줄이기">  옆에 <span>2장</span>
 *   앱은 input[role="switch"] · aria-label="decrease" 만 찾았다 → 둘 다 0개.
 * 고친 코드를 실제 보드에 대고 돌려 둘 다 찾는 것을 확인했다(로그아웃 상태라 켜기는 로그인 화면으로 이동).
 *
 * 여기서는 같은 DOM 을 cheerio 로 만들어, 앱이 페이지에 보내는 선택자·판정식을 그대로 돌린다.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'dropshotGenerator.ts'), 'utf8');
const constant = (name: string) => {
  const m = src.match(new RegExp(`const ${name} = '([^']+)';`));
  if (!m) throw new Error(`${name} 없음`);
  return m[1]!;
};
const SWITCH = constant('DROPSHOT_SWITCH_SELECTOR');
const DECREASE = constant('DROPSHOT_DECREASE_SELECTOR');

/** 실측한 지금의 보드 조각 */
const CURRENT_BOARD = `
  <div class="controls">
    <div class="stepper">
      <button aria-label="생성 개수 줄이기" type="button"></button><span>2장</span><button aria-label="생성 개수 늘리기" type="button"></button>
    </div>
    <label><span>무제한 모드</span>
      <button type="button" role="switch" aria-checked="false" data-state="unchecked" value="on"></button>
      <input type="checkbox" aria-hidden="true" tabindex="-1" value="on">
    </label>
  </div>`;

/** 예전 보드 조각(옛 사용자 화면 — 계속 받는다) */
const OLD_BOARD = `
  <div class="controls">
    <div class="stepper"><button aria-label="decrease"></button><span>2장</span></div>
    <label><span>무제한 모드</span><input type="checkbox" role="switch"></label>
  </div>`;

/** 앱이 페이지 안에서 쓰는 판정식과 같은 것(조상 텍스트에 "무제한 모드" · 형제에 "N장") */
function controls(html: string) {
  const $ = cheerio.load(`<body>${html}</body>`);
  const hasUnlimited = (node: any, limit: number) => {
    let cur = node ? $(node) : null;
    for (let d = 0; d < limit && cur && cur.length; d += 1, cur = cur.parent()) {
      if (/무제한\s*모드|unlimited\s*mode/i.test(cur.text())) return true;
    }
    return false;
  };
  const switches = $(SWITCH).toArray();
  const decrease = $(DECREASE).toArray();
  return {
    unlimitedSwitchIndex: switches.findIndex((sw) => hasUnlimited(sw, 7)),
    imageCountDecreaseIndex: decrease.findIndex((b) => hasUnlimited($(b).parent().get(0), 5) || /\d+\s*장/.test($(b).parent().text())),
    switchTag: switches[0] ? (switches[0] as any).tagName : undefined,
  };
}

describe('v3.8.756 드롭샷 보드 컨트롤 찾기', () => {
  test('지금 보드(버튼형 스위치 · "생성 개수 줄이기")에서 둘 다 찾는다', () => {
    const c = controls(CURRENT_BOARD);
    expect(c.unlimitedSwitchIndex).toBe(0);
    expect(c.imageCountDecreaseIndex).toBe(0);
    expect(c.switchTag).toBe('button');
  });

  test('예전 보드 모양도 계속 찾는다', () => {
    const c = controls(OLD_BOARD);
    expect(c.unlimitedSwitchIndex).toBe(0);
    expect(c.imageCountDecreaseIndex).toBe(0);
  });

  test('예전 선택자로는 지금 보드에서 0개였다(고객 실패의 원인)', () => {
    const $ = cheerio.load(`<body>${CURRENT_BOARD}</body>`);
    expect($('input[role="switch"]').length).toBe(0);
    expect($('button[aria-label="decrease"]').length).toBe(0);
  });

  test('버튼형 스위치의 켜짐은 aria-checked · data-state 로 읽는다', () => {
    const body = src.slice(src.indexOf('const readSwitchState = () =>'), src.indexOf('let unlimitedEnabled = await readSwitchState();'));
    expect(body).toContain("el.getAttribute('aria-checked') === 'true'");
    expect(body).toContain("el.getAttribute('data-state') === 'checked'");
  });

  test('쓰는 곳 네 군데가 모두 공용 선택자를 쓴다 — 옛 선택자는 안 쓰는 구버전 함수에만 남는다', () => {
    const active = src.slice(src.indexOf('export async function inspectDropshotEditorControls('));
    expect(active).not.toContain(`'input[role="switch"]'`);
    expect(active).not.toContain(`'button[aria-label="decrease"]'`);
    expect(active).toContain('page.locator(DROPSHOT_SWITCH_SELECTOR)');
    expect(active).toContain('page.locator(DROPSHOT_DECREASE_SELECTOR)');
    expect(active).toContain('}, DROPSHOT_SWITCH_SELECTOR);');
  });
});
