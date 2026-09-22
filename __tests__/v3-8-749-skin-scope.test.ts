/**
 * v3.8.749 — 스킨을 글 안에 가둔다
 *
 * 사장님: "내가 앱에 넣은 스킨이 깔끔하게 들어가면 좋겠어"
 *         "앱에서 입히는 CSS가 1개의 배선으로 되어 있어야 되는데 몇 개 더 있고 그게 새는 것 같아"
 *
 * 실측 (2026-09-23, leadernam.com 5814 · GeneratePress):
 *   · 스킨 선택자 267개 중 .bgpt-content 안에 갇힌 것은 39개(15%)뿐이었다.
 *   · #primary·#main·.site-content·.entry-content·article.post 에 width·padding !important 를 걸어
 *     본문 상자가 메뉴 막대보다 40px 튀어나왔다. 사이드바를 쓰는 테마에서는 사이드바를 밀어낸다.
 *   · 제목 글꼴(Gowun Batang)을 부르는 @import 가 규칙 77개 뒤에 있어 브라우저가 버렸다.
 *     승인한 「먹과 놋쇠」 제목 글꼴이 발행 글에 한 번도 나간 적이 없다.
 *   · E-E-A-T 상자 CSS 는 스킨과 따로 두 번째 <style> 로 붙었다.
 *
 * 가두는 방법: 앞에 `:where(.bgpt-content) ` 를 붙인다. `:where()` 는 점수를 더하지 않으므로
 * 「먹과 놋쇠」 층이 "같은 점수면 나중 규칙이 이긴다"로 이기던 순서가 그대로 남는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import postcss from 'postcss';
import { generateCSSFinal } from '../src/core/final/html';

/** 테마가 가진 틀 — 글이 건드리면 안 되는 것들 */
const THEME = /(^|[\s>+~,(])(\.entry-content|\.post-content|\.page-content|\.site-content|\.content-area|\.site-main|#primary|#main\b|#content\b|\.wp-site-blocks|\.wp-block-post-content|\.type-post|\.single-post|\.post-body|\.post-outer|\.blog-posts|\.Blog\b|article\.post|article\.hentry|#sidebar|#outer-wrapper|#main-wrapper|#content-wrapper)/;

function skinOf(platform: string): { out: string; css: string } {
  const out = generateCSSFinal(platform, 'external');
  const m = out.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!m) throw new Error('스킨 <style> 을 찾지 못했습니다');
  return { out, css: m[1]! };
}

function selectorsOf(css: string): string[] {
  const list: string[] = [];
  postcss.parse(css).walkRules((rule) => {
    for (let a = rule.parent; a; a = a.parent) {
      if (a.type === 'atrule' && /keyframes$/i.test((a as postcss.AtRule).name)) return;
    }
    list.push(...rule.selectors);
  });
  return list;
}

describe.each(['wordpress', 'blogger', 'tistory'])('%s 로 나가는 스킨', (platform) => {
  const { out, css } = skinOf(platform);
  const selectors = selectorsOf(css);

  it('스킨 <style> 은 하나다', () => {
    expect((out.match(/<style\b/g) || []).length).toBe(1);
  });

  it('모든 선택자가 .bgpt-content 안을 가리킨다 — 글 밖으로 새는 규칙 0개', () => {
    expect(selectors.length).toBeGreaterThan(100);
    expect(selectors.filter((s) => !/\.bgpt-content\b/.test(s))).toEqual([]);
  });

  it('테마 틀(#primary·.entry-content·article.post 등)을 건드리지 않는다', () => {
    expect(selectors.filter((s) => THEME.test(s))).toEqual([]);
  });

  it('html·body·:root 자체를 꾸미지 않는다 (body.logged-in 은 글 안 광고를 고르는 조건으로만 쓴다)', () => {
    const bad = selectors.filter((s) => /^(html|body|:root)\b/.test(s.trim()) && !/\.bgpt-content\b/.test(s));
    expect(bad).toEqual([]);
  });

  it('@import 는 모든 규칙보다 앞에 있다 — 뒤에 있으면 브라우저가 버린다', () => {
    const late: string[] = [];
    let seenRule = false;
    postcss.parse(css).each((node) => {
      if (node.type === 'atrule' && node.name === 'import') {
        if (seenRule) late.push(node.params);
      } else if (node.type !== 'comment') {
        seenRule = true;
      }
    });
    expect(late).toEqual([]);
    expect(css).toMatch(/@import url\("https:\/\/fonts\.googleapis\.com\/css2\?family=Gowun\+Batang/);
  });

  it('점수를 올리지 않고 가둔다 — 원래 .bgpt-content 로 시작하지 않던 규칙은 :where() 로만 감싼다', () => {
    const wrapped = selectors.filter((s) => !/^\s*\.bgpt-content\b/.test(s) && !/^\s*body\.logged-in\s+\.bgpt-content\b/.test(s));
    expect(wrapped.length).toBeGreaterThan(100);
    expect(wrapped.filter((s) => !s.startsWith(':where(.bgpt-content) '))).toEqual([]);
  });

  it('E-E-A-T 상자 모양도 스킨 안에 있다', () => {
    expect(selectors.some((s) => /\.eeat-meta-box\b/.test(s))).toBe(true);
    expect(selectors.some((s) => /\.eeat-cite\b/.test(s))).toBe(true);
  });
});

describe('스킨 밖에서 CSS 를 더 붙이지 않는다', () => {
  const orchestration = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

  it('orchestration 이 E-E-A-T 용 두 번째 <style> 을 앞에 붙이지 않는다', () => {
    expect(orchestration).not.toMatch(/<style>\$\{EEAT_META_CSS\}<\/style>/);
  });
});
