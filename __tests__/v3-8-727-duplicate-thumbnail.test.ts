/**
 * 같은 그림이 두 번 보이던 문제 (v3.8.727)
 *
 * 사장님(실물 검수, 발행글 5714): "썸네일이 따로 있고 핵심요약 위에 썸네일이 하나 더 있다고"
 *
 * ## 내가 만든 문제다
 * v3.8.724 에서 **대표 이미지를 붙이는 길**을 열었다(수정발행 → featured_media).
 * 그런데 발행 경로에는 있던 **본문 맨 위 썸네일 제거**(v3.8.336)를 그 길에는 안 걸었다.
 * 그래서 대표 이미지가 제목 위에 그려지고 본문 첫 그림도 그대로 남아 두 장이 됐다.
 *
 * 기록해 두는 이유: 새 경로를 열 때 **그 경로가 기존 안전장치를 지나는지** 확인해야 한다.
 * 이번 세션에서만 같은 모양의 실수가 네 번 나왔다(wpautop · CTA 판정기 · 빈 블록 · 여기).
 */
import { stripLeadingThumbnail } from '../src/wordpress/wordpress-posts';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 본문 맨 앞 썸네일만 뗀다', () => {
  it('⭐⭐ 발행기가 쓰는 모양(div.separator > img)을 뗀다', () => {
    const html = '<div class="separator" style="text-align:center;"><img src="x.jpg"></div><p>본문</p>';
    expect(stripLeadingThumbnail(html)).toBe('<p>본문</p>');
  });

  it('⭐⭐ 에이전트 글의 모양(figure > img)도 뗀다', () => {
    const html = '<figure class="agent-generated"><img src="x.jpg"></figure><p>본문</p>';
    expect(stripLeadingThumbnail(html)).toBe('<p>본문</p>');
  });

  it('⭐⭐ 본문 중간의 소제목 그림은 건드리지 않는다 (지우면 글이 헐거워진다)', () => {
    const html = '<p>앞</p><div class="separator"><img src="x.jpg"></div><p>뒤</p>';
    expect(stripLeadingThumbnail(html)).toBe(html);
  });

  it('⭐⭐ 맨 앞 한 개만 뗀다 (두 개가 연달아 있어도 하나는 남는다)', () => {
    const html = '<figure><img src="a.jpg"></figure><figure><img src="b.jpg"></figure><p>본문</p>';
    const out = stripLeadingThumbnail(html);
    expect((out.match(/<figure/g) || []).length).toBe(1);
  });

  it('⭐ 그림이 없으면 그대로 둔다', () => {
    const html = '<p>그림 없는 글</p>';
    expect(stripLeadingThumbnail(html)).toBe(html);
  });
});

describe('② 대표 이미지가 생길 때만 지운다', () => {
  const posts = read('src/wordpress/wordpress-posts.ts');

  it('⭐⭐ mediaId 가 있을 때만 본문에서 뗀다 (대표가 없으면 본문 것이 유일한 그림이다)', () => {
    const fn = posts.slice(posts.indexOf('export async function updateWordPressPost'), posts.indexOf('const body: Record<string, any>'));
    expect(fn).toMatch(/if \(mediaId\) \{\s*\n\s*const withoutLead = stripLeadingThumbnail\(finalContent\)/);
  });

  it('⭐⭐ 뗀 본문이 실제로 저장된다 (계산만 하고 안 쓰면 아무 일도 안 일어난다)', () => {
    expect(posts).toContain('finalContent = withoutLead');
    expect(posts).toContain('wrapAsHtmlBlock(finalContent)');
    expect(posts).not.toContain('wrapAsHtmlBlock(content) }');
  });

  it('⭐ 무슨 일을 했는지 로그로 남긴다', () => {
    expect(posts).toContain('두 장으로 보이던 문제');
  });
});
