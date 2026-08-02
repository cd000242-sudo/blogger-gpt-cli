/**
 * H3 섹션 카드 · 스킨 (v3.8.413)
 *
 * 사용자 지적(2026-08-02):
 *   "h3랑 본문은 박스로 못 감나요?? 스킨이 깔끔하고 이쁘면서 고급져야 되는데 끝판왕이 아닌데..?"
 *
 * 발행글 화면을 보면 H3 도 본문도 그냥 위에서 아래로 흐른다.
 * 글이 길어지면 한 덩어리가 어디서 끝나는지 눈으로 안 잡힌다.
 *
 * 개발 중 실측 버그(이 테스트가 지키는 것):
 *   CTA 카드 안의 H3 까지 감쌌더니
 *     <div data-orbit-cta><section><h3>…</p></div></section>
 *   처럼 </div> 와 </section> 이 엇갈렸다. 브라우저가 제멋대로 고쳐 레이아웃이 깨진다.
 *   '이미 박스인가'를 H3 **뒤쪽만** 보고 판정한 게 원인이었다 — 마커는 앞쪽 부모에 있었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { wrapH3Sections, H3_IN_CARD_STYLE } from '../src/core/final/section-card';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const publisher = fs.readFileSync(path.join(ROOT, 'src', 'core', 'blogger-publisher.js'), 'utf8');
const orchSrc = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

/** 여닫이 수를 센다 — 정규식 대신 문자열 분할로 센다(이스케이프 실수를 없앤다) */
function tagBalance(html: string, tag: string): { open: number; close: number } {
  const count = (sub: string) => html.split(sub).length - 1;
  return { open: count(`<${tag} `) + count(`<${tag}>`), close: count(`</${tag}>`) };
}

const ARTICLE = [
  '<h2>1. 실외기 없는 냉방</h2>',
  '<p>도입 문단입니다.</p>',
  '<h3>1-1. 실외기없는냉방의조건</h3>',
  '<p>실외기 설치가 어려운 집에서는…</p>',
  '<p>벽에 구멍을 내기 어렵거나…</p>',
  '<img src="a.jpg">',
  '<h3>1-2. 설치 전 점검</h3>',
  '<ul><li>창문 커버</li></ul>',
  '<h2>2. 비교</h2>',
  '<p>다음 장 도입.</p>',
  '<div data-orbit-cta="1"><h3>지금 확인하기</h3><p>버튼</p></div>',
].join('\n');

describe('H3 섹션을 카드로 묶는다', () => {
  const result = wrapH3Sections(ARTICLE);

  it('⭐ 본문 H3 마다 카드가 하나씩 생긴다', () => {
    expect(result.wrapped).toBe(2);                       // CTA 안의 H3 는 제외
    expect(tagBalance(result.html, 'section').open).toBe(2);
  });

  it('⭐ 카드가 H3 와 그 아래 내용을 함께 담는다', () => {
    const first = result.html.slice(
      result.html.indexOf('<section'),
      result.html.indexOf('</section>'),
    );
    expect(first).toContain('1-1. 실외기없는냉방의조건');
    expect(first).toContain('실외기 설치가 어려운 집에서는');
    expect(first).toContain('<img src="a.jpg">');
    expect(first).not.toContain('1-2. 설치 전 점검');       // 다음 H3 는 다른 카드다
  });

  it('⭐ 태그가 교차하지 않는다 — 실측 버그 재발 방지', () => {
    for (const tag of ['div', 'section', 'p', 'h3', 'ul', 'li']) {
      const { open, close } = tagBalance(result.html, tag);
      expect({ tag, open, close }).toEqual({ tag, open, close: open });
    }
    expect(result.html).not.toMatch(/<\/div>\s*<\/section>/);
  });

  it('⭐ 이미 자기 상자를 가진 블록은 건드리지 않는다 (액자 속 액자 금지)', () => {
    expect(result.html).toContain('<div data-orbit-cta="1"><h3>지금 확인하기</h3><p>버튼</p></div>');
  });

  it('⭐ 남의 상자 안에 있는 H3 는 감싸지 않는다 (여닫이가 안 맞으면 건너뛴다)', () => {
    const nested = '<div class="box"><h3>안쪽 소제목</h3><p>내용</p></div>';
    expect(wrapH3Sections(nested).wrapped).toBe(0);
  });

  it('H2 는 카드 밖에 그대로 둔다 — 큰 제목은 덩어리 위에 선다', () => {
    expect(result.html).toContain('<h2>2. 비교</h2>');
    expect(result.html.indexOf('<h2>2. 비교</h2>')).toBeGreaterThan(result.html.indexOf('</section>'));
  });

  it('⭐ 두 번 돌려도 겹쳐 감싸지 않는다 (수정발행 재처리 대비)', () => {
    expect(wrapH3Sections(result.html).wrapped).toBe(0);
    expect(wrapH3Sections(result.html).html).toBe(result.html);
  });

  it('내용이 없는 H3 는 카드로 만들지 않는다', () => {
    expect(wrapH3Sections('<h3></h3>').wrapped).toBe(0);
  });

  it('빈 입력·H3 없는 글에 안전하다', () => {
    expect(wrapH3Sections('')).toEqual({ html: '', wrapped: 0 });
    expect(wrapH3Sections('<p>본문만 있습니다</p>').wrapped).toBe(0);
    expect(wrapH3Sections(null as any).wrapped).toBe(0);
  });

  it('마지막 H3 는 글 끝까지 담는다', () => {
    const tail = wrapH3Sections('<h3>끝 소제목</h3><p>마지막 문단</p>');
    expect(tail.wrapped).toBe(1);
    expect(tail.html).toContain('마지막 문단</p></section>');
  });
});

describe('카드 생김새 — 깔끔하고 고급스럽게', () => {
  const card = wrapH3Sections('<h3>제목</h3><p>내용</p>').html;

  it('흰 바탕에 얇은 테두리와 둥근 모서리', () => {
    expect(card).toContain('background:#ffffff');
    expect(card).toContain('border:1px solid #e8ecf1');
    expect(card).toContain('border-radius:18px');
  });

  it('⭐ 그림자는 은은하게 (요란하면 싸구려로 보인다)', () => {
    expect(card).toMatch(/box-shadow:0 1px 2px rgba\(16,24,40,\.04\)/);
  });

  it('⭐ 카드 안 H3 는 배경 없이 담백하게 — 카드가 이미 테두리를 가진다', () => {
    expect(H3_IN_CARD_STYLE).not.toContain('background');
    expect(H3_IN_CARD_STYLE).toContain('border-bottom:1px solid');
  });

  it('소제목도 모바일에서 커진다 (어르신 가독성 유지)', () => {
    expect(H3_IN_CARD_STYLE).toContain('clamp(19px,4.9vw,22px)');
  });

  it('한글이 어절 단위로 끊긴다', () => {
    expect(H3_IN_CARD_STYLE).toContain('word-break:keep-all');
  });
});

describe('발행 배선', () => {
  it('⭐ 스타일 주입이 끝난 뒤에 감싼다 — 먼저 감싸면 카드가 재치환된다', () => {
    const injectAt = publisher.indexOf('인라인 스타일 강제 주입 완료');
    const wrapAt = publisher.indexOf('wrapH3Sections');
    expect(injectAt).toBeGreaterThan(-1);
    expect(wrapAt).toBeGreaterThan(injectAt);
  });

  it('⭐ 꾸미기 실패가 발행을 막지 않는다', () => {
    expect(publisher).toContain('카드 정리 건너뜀');
  });

  it('H3 스타일이 카드용 상수를 쓴다 — 두 곳이 어긋나지 않게', () => {
    expect(publisher).toContain('H3_IN_CARD_STYLE');
  });

  it('⭐ H2 가 경고문처럼 보이던 빨간 그라데이션을 걷어냈다', () => {
    expect(publisher).not.toContain('linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)');
    expect(publisher).toContain('border-left: 4px solid #4f46e5');
  });

  it('몇 개를 묶었는지 알린다', () => {
    expect(publisher).toContain('구역을 카드로 정리했습니다');
  });
});

/**
 * 모바일 최적화 (v3.8.413)
 * 사용자 요구: "어떤 모드든 모바일 친화적으로 최적화되서 나와야 됩니다"
 */
describe('모바일에서 답답하지 않게', () => {
  const card = wrapH3Sections('<h3>제목</h3><p>내용</p>').html;

  it('⭐ 좁은 화면일수록 카드 안쪽 여백을 줄인다', () => {
    // 고정 24px 이면 모바일에서 본문 폭이 확 줄어 글이 답답해진다
    expect(card).toContain('padding:clamp(16px,4.2vw,26px) clamp(14px,3.8vw,24px)');
    expect(card).not.toContain('padding:26px 24px 8px');
  });

  it('⭐ 카드가 화면을 뚫고 나가지 않는다 (가로 스크롤 방지)', () => {
    expect(card).toContain('max-width:100%');
    expect(card).toContain('box-sizing:border-box');
    expect(card).toContain('overflow-wrap:break-word');
  });

  it('소제목·본문 글자가 화면 폭을 따라 커진다', () => {
    expect(H3_IN_CARD_STYLE).toContain('clamp(');
    expect(publisher).toContain('font-size: clamp(17px, 4.6vw, 20px)');   // 본문
    expect(publisher).toContain('font-size: clamp(23px, 5.8vw, 28px)');   // H2
  });

  it('⭐ 큰 이미지가 모바일에서 튀어나가지 않는다', () => {
    expect(publisher).toContain('<img${attrs || \'\'} style="max-width: 100%; height: auto;');
  });

  it('이미 style 이 있는 이미지는 건드리지 않는다 (썸네일 의도 보존)', () => {
    // 표식에 백슬래시를 쓰면 JS 문자열 이스케이프로 먹힌다('\s' → 's') — 주석을 표식으로 쓴다
    expect(braceBlock(publisher, '// img 태그')).toContain('저자·썸네일 의도 보존');
  });

  it('표는 가로 스크롤 상자 안에 둔다 (표가 화면을 밀어내지 않게)', () => {
    expect(orchSrc).toContain('overflow-x:auto');
  });
});
