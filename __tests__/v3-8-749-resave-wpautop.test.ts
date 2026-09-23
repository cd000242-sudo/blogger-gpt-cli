/**
 * v3.8.749 — 발행 **뒤에** 본문을 다시 저장하는 길도 wpautop 을 막는다
 *
 * 실측 (leadernam.com 5816, 2026-09-20): 발행 8분 뒤 본문이 다시 저장됐다(modified 09:38).
 * 그때 블록 표식 없이 저장돼, 워드프레스가 스킨 CSS 1,304줄 중 95줄에 <p> 를 끼워 넣었다 → 스킨 대부분이 무효.
 * 새 발행(퍼블리셔)과 편집기 저장은 v3.8.726 부터 <!-- wp:html --> 로 감쌌지만,
 * main.ts 의 재저장 어댑터(글 재생성·개선안 적용·CTA 일괄 수리·애드센스 보강 셋)와 거미줄 백링크는 그대로 보냈다.
 *
 * 규칙: 블록 표식(<!-- wp:…)이 하나도 없는 본문만 HTML 블록으로 감싼다.
 *       표식이 있으면 워드프레스가 wpautop 을 돌리지 않으므로 그대로 둔다 — 사용자가 편집기에서 만든
 *       블록 구조(이미지 블록 등)를 한 덩어리로 뭉개지 않기 위해서다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { protectFromWpautop, wrapAsHtmlBlock } from '../src/wordpress/wp-html-block';
import { blockBetween } from './helpers/source-block';

describe('protectFromWpautop', () => {
  const article = '<style>.bgpt-content h2{color:red}\n\n.bgpt-content p{margin:0}</style>\n<div class="bgpt-content"><h2>제목</h2>\n\n<p>본문</p></div>';

  it('블록 표식이 없는 본문은 HTML 블록 하나로 감싼다', () => {
    expect(protectFromWpautop(article)).toBe(wrapAsHtmlBlock(article));
    expect(protectFromWpautop(article).startsWith('<!-- wp:html -->')).toBe(true);
  });

  it('이미 감싼 본문은 두 번 감싸지 않는다', () => {
    const once = protectFromWpautop(article);
    expect(protectFromWpautop(once)).toBe(once);
  });

  it('감싼 뒤에 무엇을 덧붙인 본문도 겹쳐 감싸지 않는다 (예: 끝에 붙인 JSON-LD)', () => {
    const appended = `${wrapAsHtmlBlock(article)}\n<script type="application/ld+json">{}</script>`;
    expect(protectFromWpautop(appended)).toBe(appended);
  });

  it('편집기에서 만든 블록 구조는 그대로 둔다', () => {
    const blocks = '<!-- wp:paragraph --><p>문단</p><!-- /wp:paragraph --><!-- wp:image {"id":5} --><figure class="wp-block-image"><img src="a.png"/></figure><!-- /wp:image -->';
    expect(protectFromWpautop(blocks)).toBe(blocks);
  });

  it('빈 본문은 건드리지 않는다', () => {
    expect(protectFromWpautop('')).toBe('');
  });
});

describe('재저장 경로 배선 (main.ts)', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf8');

  it('워드프레스 어댑터 updatePost 가 본문을 protectFromWpautop 으로 보낸다 — 재저장 기능 여섯 곳이 모두 이 한 곳을 지난다', () => {
    const adapter = blockBetween(main, 'function buildPlatformAdapter(', '// Blogger');
    const update = blockBetween(adapter, 'async updatePost(', 'async deletePost(');
    expect(update).toMatch(/body\.content = protectFromWpautop\(fields\.content\)/);
  });

  it('거미줄 백링크 PUT 도 같은 함수를 지난다', () => {
    const spider = blockBetween(main, 'async function updateWordPressSpiderBacklink(', 'async function getBloggerBacklinkClient(');
    expect(spider).toMatch(/content: protectFromWpautop\(patch\.html\)/);
  });

  it('dist 경로로 불러온다 — src 경로는 패키징 앱에서 조용히 죽는다', () => {
    expect(main).toMatch(/require\('\.\.\/dist\/wordpress\/wp-html-block'\)/);
  });
});
