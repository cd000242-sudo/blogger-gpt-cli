/**
 * Spider post — related-posts grid on a phone.
 *
 * Measured on a real post (2026-11-11): the grid cells carry `width:50% !important` inline, and an inline
 * `!important` beats the post's own mobile rule `.max-mode-article td{width:100% !important}`. On a 390px
 * screen every card stayed half wide. finishSpiderHtml drops only that `!important`, so the cell is 50% on
 * a desktop and the mobile rule can stack it full width.
 */
import { finishSpiderHtml } from '../src/core/spider';

const GRID = [
  '<div class="sw-cornerstone max-mode-article" style="margin:0 auto;padding:0 16px;">',
  '<p>본문 문단입니다.</p>',
  '<table style="width:100% !important;border-collapse:separate !important;" class="sw-mobile-table"><tr>',
  '<td style="width:50% !important;max-width:100% !important;vertical-align:top !important;padding:20px !important;"><p>자격조건</p></td>',
  "<td style='padding:20px !important; width: 50%  !important ;min-width:120px !important'><p>신청방법</p></td>",
  '</tr></table>',
  '</div>',
].join('');

describe('finishSpiderHtml — table cell width lock', () => {
  it.each(['wordpress', 'blogger', 'tistory'])('%s: a cell keeps its percent width but loses the !important', (platform) => {
    const out = finishSpiderHtml(GRID, { platform }).html;
    expect(out).not.toMatch(/<td[^>]*[;"'\s]width\s*:\s*50%\s*!important/i);
    expect(out).toMatch(/<td style="width:50%;max-width:100% !important;vertical-align:top !important;padding:20px !important;">/);
    expect(out).toMatch(/<td style='padding:20px !important; width: 50%;min-width:120px !important'>/);
  });

  it('leaves max-width, min-width and the table width alone', () => {
    const out = finishSpiderHtml(GRID, { platform: 'wordpress' }).html;
    expect(out).toContain('<table style="width:100% !important;border-collapse:separate !important;" class="sw-mobile-table">');
    expect(out).toContain('max-width:100% !important');
    expect(out).toContain('min-width:120px !important');
  });

  it('does not touch a cell whose width is not locked, or text that only looks like a style', () => {
    const html = '<div class="sw-cornerstone"><table><tr><td style="width:40%;padding:4px">a</td><td>width:50% !important 라고 쓰면 됩니다</td></tr></table></div>';
    const out = finishSpiderHtml(html, { platform: 'tistory' }).html;
    expect(out).toContain('<td style="width:40%;padding:4px">a</td>');
    expect(out).toContain('<td>width:50% !important 라고 쓰면 됩니다</td>');
  });

  it('reports the change once and gives the same result when run twice', () => {
    const first = finishSpiderHtml(GRID, { platform: 'wordpress' });
    expect(first.changes.filter((c) => c.includes('표 칸 폭 고정'))).toHaveLength(1);
    const second = finishSpiderHtml(first.html, { platform: 'wordpress' });
    expect(second.html).toBe(first.html);
    expect(second.changes.some((c) => c.includes('표 칸 폭 고정'))).toBe(false);
  });
});
