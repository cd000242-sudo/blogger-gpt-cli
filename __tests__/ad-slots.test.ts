/**
 * v3.8.482 — 커서 위치에 애드센스 수동 광고 넣기.
 *
 * 사용자 요구: "사람들이 내 글을 봤을 때 원하는 정보를 얻고 정보가 바로 보이면
 *   클릭을 하잖아. 그 위치에 애드센스 광고를 수동으로 배치하고 싶어서."
 *   자동 광고는 위치를 못 고른다.
 *
 * ## 자리표시자가 선택이 아니라 필수인 이유
 * editor.js 의 serializeEditor 는 저장할 때 `<script>` 를 **전부 지운다**.
 * 애드센스 코드는 `<script>` 둘 + `<ins>` 라, 편집기에 원문을 그대로 넣으면
 * 저장하는 순간 사라진다. 그래서 편집기에서는 회색 박스로 두고,
 * **스크립트를 지운 뒤에** 실제 코드로 바꾼다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { braceBlock } from './helpers/source-block';

const adSlotsSource = readFileSync(join(__dirname, '..', 'electron/ui/modules/ad-slots.js'), 'utf8');
const editorSource = readFileSync(join(__dirname, '..', 'electron/ui/modules/editor.js'), 'utf8');
const imagesSource = readFileSync(join(__dirname, '..', 'electron/ui/modules/editor-images.js'), 'utf8');

/** ESM 모듈을 테스트에서 쓰기 위해 export 를 걷어내고 평가한다 */
function loadAdSlots(): any {
  const stripped = adSlotsSource.replace(/^export\s+/gm, '');
  const factory = new Function(`${stripped}
    return { loadAdUnits, saveAdUnits, makeAdSlotHtml, expandAdSlots, collapseAdBlocks, AD_SLOT_CLASS, AD_BLOCK_CLASS };`);
  return factory();
}

const AD_CODE = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123"></script>'
  + '<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-123" data-ad-slot="9876543210"></ins>'
  + '<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>';

const UNITS = [
  { id: 'ad-top', name: '본문 상단', code: AD_CODE },
  { id: 'ad-mid', name: '본문 중간', code: AD_CODE.replace('9876543210', '1111111111') },
];

describe('광고 자리 ↔ 실제 코드', () => {
  const mod = loadAdSlots();

  it('자리표시자에는 script 가 없다 — 편집기 저장에서 살아남아야 한다', () => {
    const slot = mod.makeAdSlotHtml(UNITS[0]);
    expect(slot).not.toContain('<script');
    expect(slot).toContain('data-bgpt-ad-unit="ad-top"');
    expect(slot).toContain('본문 상단');
    expect(slot).toContain('contenteditable="false"');
  });

  it('발행 시 자리표시자가 실제 광고 코드로 바뀐다', () => {
    const body = `<p>앞 문단</p>${mod.makeAdSlotHtml(UNITS[0])}<p>뒤 문단</p>`;
    const out = mod.expandAdSlots(body, UNITS);

    expect(out.expanded).toBe(1);
    expect(out.html).toContain('data-ad-slot="9876543210"');
    expect(out.html).toContain('adsbygoogle');
    expect(out.html).toContain('<p>앞 문단</p>');
    expect(out.html).toContain('<p>뒤 문단</p>');
    expect(out.html).not.toContain('광고 자리');
  });

  it('여러 광고를 서로 다른 자리에 넣을 수 있다', () => {
    const body = `<p>A</p>${mod.makeAdSlotHtml(UNITS[0])}<p>B</p>${mod.makeAdSlotHtml(UNITS[1])}<p>C</p>`;
    const out = mod.expandAdSlots(body, UNITS);

    expect(out.expanded).toBe(2);
    expect(out.html).toContain('data-ad-slot="9876543210"');
    expect(out.html).toContain('data-ad-slot="1111111111"');
  });

  it('등록이 삭제된 광고 자리는 안내 문구째 제거한다 (발행물에 남으면 안 된다)', () => {
    const body = `<p>A</p>${mod.makeAdSlotHtml({ id: 'gone', name: '삭제됨' })}<p>B</p>`;
    const out = mod.expandAdSlots(body, UNITS);

    expect(out.missing).toBe(1);
    expect(out.expanded).toBe(0);
    expect(out.html).not.toContain('광고 자리');
    expect(out.html).not.toContain('삭제됨');
    expect(out.html).toContain('<p>A</p>');
  });

  it('다시 열면 광고 코드가 자리표시자로 되돌아온다 (왕복)', () => {
    const original = `<p>A</p>${mod.makeAdSlotHtml(UNITS[1])}<p>B</p>`;
    const published = mod.expandAdSlots(original, UNITS).html;
    const reopened = mod.collapseAdBlocks(published, UNITS);

    expect(reopened).not.toContain('<script');
    expect(reopened).toContain('data-bgpt-ad-unit="ad-mid"');
    expect(reopened).toContain('본문 중간');
    // 왕복 후 다시 발행해도 같은 코드가 나와야 한다
    expect(mod.expandAdSlots(reopened, UNITS).html).toContain('data-ad-slot="1111111111"');
  });

  it('광고가 없는 글은 손대지 않는다', () => {
    const body = '<p>광고 없는 본문</p>';
    expect(mod.expandAdSlots(body, UNITS).html).toBe(body);
    expect(mod.collapseAdBlocks(body, UNITS)).toBe(body);
  });
});

describe('배선', () => {
  it('script 를 지운 **뒤에** 광고 코드를 넣는다 (순서가 뒤집히면 광고가 사라진다)', () => {
    const stripAt = editorSource.indexOf("body.querySelectorAll('script').forEach");
    const expandAt = editorSource.indexOf('expandAdSlots(body.innerHTML)');
    expect(stripAt).toBeGreaterThan(-1);
    expect(expandAt).toBeGreaterThan(-1);
    expect(expandAt).toBeGreaterThan(stripAt);
  });

  it('저장된 글을 열 때 광고 코드를 자리표시자로 되돌린다', () => {
    expect(editorSource).toContain('collapseAdBlocks(rawBodyHtml)');
  });

  it('광고 버튼도 커서 유실 가드를 받는다', () => {
    expect(editorSource).toContain("closest?.('#veInsertImageBtn, #veInsertAdBtn')");
  });

  it('커서 삽입 헬퍼를 이미지와 공유한다 (되돌리기도 함께)', () => {
    expect(imagesSource).toContain('export function insertHtmlAtCaret');
    expect(imagesSource).toContain('export function findCaretBlock');
    const fn = braceBlock(imagesSource, 'export function insertHtmlAtCaret');
    expect(fn).toContain('pushImageOp()');
  });

  it('등록된 광고가 없으면 넣지 않고 알린다', () => {
    expect(editorSource).toContain('등록된 광고가 없습니다');
  });

  /**
   * ⚠️ electron/ui 가 실제로 앱이 읽는 파일이다.
   *   copy-ui.js: "src/ui/ files are NOT used by the app."
   *   src/ui 만 고치면 화면에 안 나온다 — v3.8.478 이 그 실수를 했다.
   */
  it('광고 등록 화면이 **실제 앱이 읽는** UI 파일에 있다', () => {
    const realUi = readFileSync(join(__dirname, '..', 'electron/ui/index.html'), 'utf8');
    expect(realUi).toContain('adUnitAddBtn');
    expect(realUi).toContain('adUnitCodeInput');
    expect(realUi).toContain('adUnitList');
  });

  it('광고 등록 동작 스크립트도 실제 앱 파일에 있다', () => {
    const realScript = readFileSync(join(__dirname, '..', 'electron/ui/script.js'), 'utf8');
    expect(realScript).toContain('bgptAdUnits');
    expect(realScript).toContain('initAdUnitSettings');
    // 편집기 모듈과 저장소 키가 같아야 한다 — 다르면 등록해도 목록이 비어 보인다
    expect(adSlotsSource).toContain("'bgptAdUnits'");
  });
});
