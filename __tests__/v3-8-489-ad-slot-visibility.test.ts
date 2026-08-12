/**
 * v3.8.489 — 넣은 광고 자리가 눈에 보이게
 *
 * 사장님: "광고를 커서위치에 넣었다고하는데 발행하기전에 여기서 코드가 못보여주니??
 *          티스토리에 보면 수동광고넣으면 그위치에 보이자나"
 *
 * ## 왜 원문 코드를 그대로 못 넣는가 (설계상 필수)
 * editor.js 의 serializeEditor 는 저장할 때 `<script>` 를 전부 지운다.
 * 애드센스 코드는 script 두 개와 ins 로 이뤄져 있어서, 편집기에 원문을 넣으면
 * 저장하는 순간 사라진다. 그래서 자리표시자를 거치는 구조는 그대로 둔다.
 *
 * ## 대신 고칠 것
 * ① 자리표시자에 **어떤 광고인지 알아볼 정보**(client/slot)를 보여준다.
 *    지금은 "📢 광고 자리 — 수동광고" 뿐이라 무엇이 들어갈지 확인할 방법이 없었다.
 * ② 넣은 직후 **그 자리로 스크롤**한다. 글 중간에 넣으면 화면 밖이라 안 보였다.
 *
 * ## 왜 import 하지 않는가
 * electron/ui/modules/*.js 는 렌더러가 직접 읽는 브라우저 ES 모듈이라 번들·타입이 없다.
 * 저장소 관례대로 소스를 읽어 검사하되, 함수는 실제로 평가해 동작까지 확인한다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const adSlotsSrc = read('electron/ui/modules/ad-slots.js');
const editorSrc = read('electron/ui/modules/editor.js');

/** ES 모듈 소스를 평가해 내보낸 함수를 꺼낸다 (localStorage 등 브라우저 API 는 안 쓰는 함수만 대상) */
function loadAdSlots(): any {
  const body = adSlotsSrc
    .replace(/^\s*export\s+/gm, '')
    .replace(/^\s*import\s.*$/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(`
    const localStorage = { getItem: () => null, setItem: () => {} };
    ${body}
    return { makeAdSlotHtml, describeAdUnit, AD_SLOT_STYLE };
  `)();
}

const { makeAdSlotHtml, describeAdUnit, AD_SLOT_STYLE } = loadAdSlots();

const UNIT = {
  id: 'ad-1',
  name: '수동광고',
  code: '<ins class="adsbygoogle" data-ad-client="ca-pub-1234567890123456" data-ad-slot="9876543210"></ins>',
};

describe('① 무엇이 들어갈지 알아볼 수 있다', () => {
  it('⭐⭐ 광고 코드에서 client·slot 을 읽어낸다', () => {
    const d = describeAdUnit(UNIT);
    expect(d).toContain('ca-pub-1234567890123456');
    expect(d).toContain('9876543210');
  });

  it('⭐⭐ 자리표시자에 그 정보가 들어간다 (이름만으로는 확인이 안 된다)', () => {
    const html = makeAdSlotHtml(UNIT);
    expect(html).toContain('수동광고');
    expect(html).toContain('9876543210');
  });

  it('⭐⭐ 코드에서 못 읽어내도 깨지지 않는다', () => {
    const html = makeAdSlotHtml({ id: 'x', name: '내 광고', code: '<div>알 수 없는 코드</div>' });
    expect(html).toContain('내 광고');
    expect(html).not.toContain('undefined');
  });

  it('⭐⭐ 코드를 HTML 로 풀어 넣지 않는다 (편집기 안에서 실행되면 안 된다)', () => {
    const evil = { id: 'x', name: 'n', code: '<script>alert(1)</script>' };
    expect(makeAdSlotHtml(evil)).not.toContain('<script>');
  });

  it('⭐ 단위가 없어도 던지지 않는다', () => {
    expect(() => makeAdSlotHtml(null)).not.toThrow();
    expect(describeAdUnit(null)).toBe('');
  });
});

describe('② 넣은 자리가 화면에 보인다', () => {
  it('⭐⭐ 삽입 직후 그 자리로 스크롤한다', () => {
    expect(editorSrc).toContain('scrollIntoView');
  });

  it('⭐⭐ 방금 넣은 것만 강조한다 (이전 것이 같이 깜빡이면 헷갈린다)', () => {
    expect(AD_SLOT_STYLE).toContain('bgpt-ad-slot-new');
    expect(makeAdSlotHtml(UNIT)).toContain('bgpt-ad-slot-new');
    expect(editorSrc).toContain("classList.remove('bgpt-ad-slot-new')");
  });

  it('⭐⭐ 자리표시자는 여전히 편집 대상이 아니다 (글자를 건드리면 안 된다)', () => {
    expect(makeAdSlotHtml(UNIT)).toContain('contenteditable="false"');
  });

  it('⭐⭐ 발행 시 실제 코드로 바뀌는 구조는 그대로다 (여길 깨면 광고가 안 나간다)', () => {
    expect(adSlotsSrc).toContain('export function expandAdSlots');
    expect(makeAdSlotHtml(UNIT)).toContain('data-bgpt-ad-unit="ad-1"');
  });
});
