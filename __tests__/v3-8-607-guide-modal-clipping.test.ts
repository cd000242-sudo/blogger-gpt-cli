/**
 * v3.8.607 — 사용법 모달이 잘리던 것
 *
 * 사장님: "사용법 여전히 짤리고 이상하게 나오는데요...?"
 *
 * 원인: 본문 높이를 `max-height: calc(90vh - 100px)` 로 **머리말이 100px 이라고 치고** 계산했다.
 * 머리말이 한 줄을 넘거나 창이 좁아지면 그 가정이 깨지는데, 바깥 카드가 overflow:hidden 이라
 * 넘친 만큼이 **잘려서 스크롤로도 닿지 못한다.**
 *
 * 처방: 카드를 flex 기둥으로 두고 본문이 남은 높이를 그대로 먹게 한다 — 계산 자체를 없앤다.
 */
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const html = fs.readFileSync(path.join(__dirname, '..', 'electron/ui/index.html'), 'utf-8');
const $ = cheerio.load(html);

describe.each([
  ['guideModalContent', '사용법'],
  ['externalLinksContent', '외부 링크'],
])('%s (%s) 모달', (id) => {
  const body = $(`#${id}`);
  const bodyStyle = body.attr('style') || '';
  const cardStyle = body.parent().attr('style') || '';

  test('요소가 실제로 있다', () => {
    expect(body.length).toBe(1);
  });

  test('높이를 손으로 계산하지 않는다', () => {
    expect(bodyStyle).not.toMatch(/calc\(\s*\d+vh/);
  });

  test('남은 높이를 flex 로 먹는다', () => {
    expect(bodyStyle).toContain('flex: 1 1 auto');
  });

  test('min-height:0 이 있다 — 없으면 flex 자식이 안 줄어들어 스크롤이 안 생긴다', () => {
    expect(bodyStyle).toContain('min-height: 0');
  });

  test('스스로 세로 스크롤한다', () => {
    expect(bodyStyle).toContain('overflow-y: auto');
  });

  test('바깥 카드가 flex 기둥이다', () => {
    expect(cardStyle).toContain('display: flex');
    expect(cardStyle).toContain('flex-direction: column');
  });

  test('카드는 화면을 넘지 않는다', () => {
    expect(cardStyle).toMatch(/max-height:\s*90vh/);
  });
});

describe('사용법 모달 머리말', () => {
  test('머리말은 줄어들지 않는다 (flex:0 0 auto) — 줄어들면 제목이 눌린다', () => {
    const header = $('#guideModalContent').prev();
    expect(header.attr('style') || '').toContain('flex: 0 0 auto');
  });
});
