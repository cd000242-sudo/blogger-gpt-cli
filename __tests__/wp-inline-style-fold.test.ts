/**
 * 인라인 style 접기 테스트 (v3.8.388)
 *
 * 실측 (2026-07-30, leadernam.com 발행글 323편):
 *   글당 HTML 평균 54.7KB / 본문 텍스트 5.7KB → 9.7배
 *   #4950 기준: style="" 245개 = 63KB (HTML 의 55%), <style> 26.9KB (24%), 텍스트 14KB (13%)
 *   같은 값이 그대로 반복된다 — color:#1e293b… 270자 × 61회 = 16.1KB
 *
 * 적용 후 실측 (실제 발행글 7편): 721.2KB → 442.2KB, 38.7% 축소
 *
 * 이 테스트의 목적은 "줄었다"가 아니라 **외관이 안 바뀐다**를 고정하는 것이다.
 *   - 비-!important 인라인은 손대지 않는다 (테마의 #id 규칙에 밀릴 수 있어 위험)
 *   - 셀렉터 클래스 3중복으로 특이도 0,4,0 → 기존 <style> 규칙(최대 ~0,2,2)을 확실히 넘긴다
 *     ("인라인이 이기던 것"이 "클래스가 이기는 것"으로 보존돼야 한다)
 *   - <style>/<script>/주석 내부는 불변
 */
import { foldRepeatedInlineStyles, applyWordPressInlineStyles } from '../src/wordpress/wordpress-publisher';
import { braceBlock } from './helpers/source-block';

/** 60자 넘고 전부 !important 인 값 (접기 대상) */
const BIG = 'color:#1e293b !important;font-size:16px !important;line-height:1.8 !important;margin:0 0 18px 0 !important;';
const BIG2 = 'padding:10px 12px !important;border:1px solid #e2e8f0 !important;background:#f8fafc !important;text-align:left !important;';
/** 전부 !important 지만 짧은 값 */
const SHORT = 'color:red !important;';
/** !important 가 아닌 값 */
const PLAIN = 'display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:4px 8px;border-radius:6px;';

const rep = (n: number, style: string, tag = 'p') =>
  Array.from({ length: n }, (_, i) => `<${tag} style="${style}">문단 ${i + 1}</${tag}>`).join('');

const textOf = (h: string) => h
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

describe('접는 조건', () => {
  it('3회 이상 반복 + 전부 !important 면 접는다', () => {
    const r = foldRepeatedInlineStyles(rep(4, BIG));
    expect(r.folded).toBe(4);
    expect(r.html).not.toContain('style="');
    expect(r.html).toContain('class="bgpt-s1"');
    expect(r.css).toContain('bgpt-s1');
  });

  it('2회 이하는 접지 않는다 — 클래스 도입 비용이 더 크다', () => {
    const html = rep(2, BIG);
    const r = foldRepeatedInlineStyles(html);
    expect(r.folded).toBe(0);
    expect(r.html).toBe(html);
    expect(r.css).toBe('');
  });

  it('!important 가 아닌 인라인은 절대 건드리지 않는다 — 우선순위가 미묘하다', () => {
    const html = rep(10, PLAIN);
    const r = foldRepeatedInlineStyles(html);
    expect(r.folded).toBe(0);
    expect(r.html).toBe(html);
  });

  it('일부만 !important 인 값도 건드리지 않는다', () => {
    const mixed = 'color:#111 !important;font-size:16px;line-height:1.8 !important;margin:0 0 18px 0 !important;';
    const r = foldRepeatedInlineStyles(rep(8, mixed));
    expect(r.folded).toBe(0);
  });

  it('60자 미만은 접지 않는다', () => {
    const r = foldRepeatedInlineStyles(rep(20, SHORT));
    expect(r.folded).toBe(0);
  });

  it('서로 다른 값은 각각 다른 클래스를 받는다', () => {
    const r = foldRepeatedInlineStyles(rep(3, BIG) + rep(3, BIG2, 'td'));
    expect(new Set(r.css.match(/bgpt-s\d+/g)).size).toBe(2);
    expect(r.folded).toBe(6);
  });
});

describe('외관 보존 — 이게 핵심이다', () => {
  it('선언이 하나도 빠지지 않고 CSS 로 옮겨진다', () => {
    const r = foldRepeatedInlineStyles(rep(3, BIG));
    BIG.split(';').map(s => s.trim()).filter(Boolean).forEach(decl => {
      expect(r.css).toContain(decl);
    });
  });

  it('특이도를 클래스 3중복으로 올린다 (기존 <style> 규칙에 밀리지 않게)', () => {
    const r = foldRepeatedInlineStyles(rep(3, BIG));
    expect(r.css).toContain('.wp-styled-content .bgpt-s1.bgpt-s1.bgpt-s1{');
  });

  it('본문 텍스트가 변하지 않는다', () => {
    const html = `<h2 style="${BIG}">제목</h2>${rep(3, BIG)}<p>손대지 않는 문단</p>`;
    const r = foldRepeatedInlineStyles(html);
    expect(textOf(r.html)).toBe(textOf(html));
  });

  it('기존 class 를 잃지 않고 뒤에 덧붙인다', () => {
    const html = Array.from({ length: 3 }, () => `<p class="article-p keep-me" style="${BIG}">x</p>`).join('');
    const r = foldRepeatedInlineStyles(html);
    expect(r.html).toContain('class="article-p keep-me bgpt-s1"');
    expect(r.html).not.toContain('style="');
  });

  it('class 가 없던 요소에는 class 를 새로 만든다', () => {
    const r = foldRepeatedInlineStyles(rep(3, BIG, 'span'));
    expect(r.html).toContain('<span class="bgpt-s1">');
  });

  it('self-closing 태그도 깨지지 않는다', () => {
    const html = Array.from({ length: 3 }, (_, i) => `<img src="a${i}.png" style="${BIG}"/>`).join('');
    const r = foldRepeatedInlineStyles(html);
    expect(r.folded).toBe(3);
    expect(r.html).toMatch(/<img src="a0\.png" class="bgpt-s1"\/>/);
    expect(r.html).not.toContain('style="');
  });

  it('다른 속성(alt/href/data-*)을 보존한다', () => {
    const html = Array.from({ length: 3 }, () =>
      `<a href="https://x.test" data-cta="1" rel="nofollow" style="${BIG}">링크</a>`).join('');
    const r = foldRepeatedInlineStyles(html);
    expect(r.html).toContain('href="https://x.test"');
    expect(r.html).toContain('data-cta="1"');
    expect(r.html).toContain('rel="nofollow"');
  });
});

describe('건드리면 안 되는 구간', () => {
  it('<style> 블록 내부는 변형하지 않는다', () => {
    const styleTag = `<style>.a{color:#1e293b !important;font-size:16px !important;line-height:1.8 !important;margin:0 !important;}</style>`;
    const r = foldRepeatedInlineStyles(styleTag + rep(3, BIG));
    expect(r.html).toContain(styleTag);
  });

  it('<script> 내부는 변형하지 않는다', () => {
    const script = `<script>var s='<p style="${BIG}">가짜</p>';</script>`;
    const r = foldRepeatedInlineStyles(script + rep(3, BIG));
    expect(r.html).toContain(script);
  });

  it('HTML 주석 내부는 변형하지 않는다', () => {
    const comment = `<!-- wp:html <p style="${BIG}">주석</p> -->`;
    const r = foldRepeatedInlineStyles(comment + rep(3, BIG));
    expect(r.html).toContain(comment);
  });

  it('자리표시자가 결과에 새어 나오지 않는다', () => {
    const r = foldRepeatedInlineStyles(`<style>.x{}</style><!-- c --><script>1</script>` + rep(3, BIG));
    expect(r.html).not.toMatch(/BGPTV\d/);
  });
});

describe('안전 기본값', () => {
  it('빈 입력에 안전하다', () => {
    expect(foldRepeatedInlineStyles('').folded).toBe(0);
    expect(foldRepeatedInlineStyles(undefined as any).html).toBe('');
  });

  it('접을 게 없으면 원본을 글자 하나 안 바꾸고 돌려준다', () => {
    const html = '<p>순수 텍스트</p><div class="x">클래스만</div>';
    const r = foldRepeatedInlineStyles(html);
    expect(r.html).toBe(html);
    expect(r.css).toBe('');
    expect(r.savedBytes).toBe(0);
  });

  it('실제로 바이트가 줄어든다', () => {
    const html = rep(30, BIG);
    const r = foldRepeatedInlineStyles(html);
    expect(r.html.length + r.css.length).toBeLessThan(html.length);
    expect(r.savedBytes).toBeGreaterThan(0);
  });
});

describe('발행 경로 배선', () => {
  it('applyWordPressInlineStyles 결과에 접기 CSS 가 들어간다', () => {
    // 실제 발행 본문 모양(반복 문단)을 넣으면 접힌 클래스가 나와야 한다
    const body = Array.from({ length: 8 }, (_, i) => `<p class="article-p">문단 ${i + 1} 내용입니다.</p>`).join('');
    const out = applyWordPressInlineStyles(`<div class="bgpt-content">${body}</div>`);
    expect(out).toContain('bgpt-s1');
    expect(out).toContain('.bgpt-s1.bgpt-s1.bgpt-s1{');
  });

  it('접기 실패가 발행을 막지 않는다 — 호출부가 try/catch 로 감싼다', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src', 'wordpress', 'wordpress-publisher.ts'), 'utf8');
    const i = src.indexOf('let foldedCSS');
    expect(i).toBeGreaterThan(-1);
    const block = braceBlock(src, 'let foldedCSS');
    expect(block).toContain('try {');
    expect(block).toContain('catch');
    expect(block).toContain('원본 유지');
  });
});
