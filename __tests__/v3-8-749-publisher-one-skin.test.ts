/**
 * v3.8.749 — 퍼블리셔는 스킨을 다시 칠하지 않는다 (CSS 한 줄 배선)
 *
 * 사장님: "앱에서 입히는 CSS가 1개의 배선으로 되어 있어야 되는데 몇 개 더 있는 것 같고 그게 새는 것 같아"
 *
 * 실측 (2026-09-23, leadernam.com 5814 · Playwright 계산된 스타일):
 *   스킨이 정한 h2   30px · 굵기 700 · 먹색 · 위쪽 놋쇠 가는 선
 *   실제로 그려진 h2 26px · 굵기 800 · 짙은 초록 · 왼쪽 6px 세로줄        ← 퍼블리셔 디자인
 *   스킨이 정한 표 머리 배경 없음 · 놋쇠색 11px 고정폭
 *   실제로 그려진 표 머리 회청 배경 · 검정 13px 굵게                       ← 퍼블리셔 디자인
 * 워드프레스 퍼블리셔가 h2·p·th… 의 style 을 자기 디자인으로 다시 쓰고, 그걸 접은 클래스(.bgpt-sN, 점수 0,4,0)가
 * 스킨을 이겼다. 블로거 퍼블리셔는 스킨 <style> 을 아예 지우고 청록 디자인 + 사이드바 숨김 CSS 로 바꿨다.
 *
 * 이제: 스킨을 실은 글은 퍼블리셔가 본문 정리(H1·캡션·깨진 글자)만 하고 모양은 손대지 않는다.
 * 스킨이 없는 글(가져온 문서·옛 글)만 예전 경로를 탄다 — 그 경로도 테마 틀·사이드바는 건드리지 않는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateCSSFinal } from '../src/core/final/html';
import { carriesOrbitSkin } from '../src/core/final/skin-marker';
import { applyWordPressInlineStyles } from '../src/wordpress/wordpress-publisher';
import { blockBetween } from './helpers/source-block';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const blogger = require('../src/core/blogger-publisher');

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const ARTICLE_BODY = `<div class="bgpt-content"><div class="gradient-frame" id="premium-white-paper-container"><div class="white-paper">
<h1 class="post-title">청년 월세 지원 신청 전에 확인할 것</h1>
<h2 id="section-0">1. 누가 받을 수 있나</h2>
<p>소득&nbsp;기준을 먼저 봅니다. <strong>월 20만원</strong>까지 받습니다.</p>
<div class="table-wrapper"><table class="responsive-table"><thead><tr><th>항목</th><th>값</th></tr></thead><tbody><tr><td data-label="항목">지원액</td><td data-label="값">월 20만원</td></tr></tbody></table></div>
<div class="cta-box"><p>신청은 복지로에서 합니다</p><a class="cta-btn" href="https://www.bokjiro.go.kr">복지로 바로가기</a></div>
</div></div></div>`;
const skinned = (platform: string) => `${generateCSSFinal(platform, 'external')}${ARTICLE_BODY}`;
const styleBlocks = (html: string) => html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [];
const STYLED_TAGS = ['h2', 'p', 'strong', 'table', 'th', 'td'];

describe('스킨을 실었는지 알아보기', () => {
  it('generateCSSFinal 스킨이 있으면 참', () => {
    expect(carriesOrbitSkin(skinned('wordpress'))).toBe(true);
  });
  it('스킨 없는 HTML·다른 CSS 만 있는 HTML 은 거짓', () => {
    expect(carriesOrbitSkin('<h2>제목</h2><p>본문</p>')).toBe(false);
    expect(carriesOrbitSkin('<style>.custom p{color:red}</style><div class="custom"><p>x</p></div>')).toBe(false);
  });
  it('래퍼 클래스 글자만 있고 스킨 <style> 이 없으면 거짓 — 스킨이 실제로 실려야 참', () => {
    expect(carriesOrbitSkin('<div class="bgpt-content"><p>x</p></div>')).toBe(false);
  });
});

describe('워드프레스 — 스킨 글은 다시 칠하지 않는다', () => {
  const input = skinned('wordpress');
  const out = applyWordPressInlineStyles(input);

  it('스킨 <style> 을 한 글자도 바꾸지 않고 그대로 싣는다 — <style> 은 하나', () => {
    expect(styleBlocks(out)).toEqual([styleBlocks(input)[0]]);
  });

  it('퍼블리셔 자체 CSS·접은 클래스·래퍼를 더하지 않는다', () => {
    expect(out).not.toMatch(/wp-styled-content/);
    expect(out).not.toMatch(/\bbgpt-s\d+\b/);
    expect(out).not.toMatch(/수익 최적화 WordPress 레이아웃/);
  });

  it('제목·문단·표에 인라인 style 을 박지 않는다 (스킨을 이기는 덧칠 0)', () => {
    for (const tag of STYLED_TAGS) {
      expect(out).not.toMatch(new RegExp(`<${tag}\\b[^>]*\\sstyle=`, 'i'));
    }
  });

  it('본문 정리는 계속 한다 — 워드프레스 제목과 겹치는 H1 제거 · &nbsp; 정리', () => {
    expect(out).not.toMatch(/<h1\b/i);
    expect(out).not.toMatch(/&nbsp;/);
    expect(out).toContain('누가 받을 수 있나');
  });

  it('스킨 없는 글은 예전 경로 그대로 (워드프레스 레이아웃을 입힌다)', () => {
    expect(applyWordPressInlineStyles('<h2>제목</h2><p>본문</p>')).toMatch(/wp-styled-content/);
  });
});

describe('워드프레스 — 옛 .max-mode-article 전용 "핵 옵션" CSS 를 싣지 않는다', () => {
  const src = read('src/wordpress/wordpress-publisher.ts');
  it('발행 흐름에서 빠졌다 (지금 글에는 효과 없이 모든 글 첫 <style> 에 2KB 씩 붙었다)', () => {
    expect(src).not.toMatch(/wordpressNuclearCSS/);
    expect(src).not.toMatch(/WORDPRESS 핵 옵션/);
  });
});

describe('블로거 — 스킨 글은 지우지도 다시 칠하지도 않는다', () => {
  const input = skinned('blogger');
  const out = blogger.applyInlineStyles(input);

  it('스킨 <style> 을 그대로 싣는다 — 예전엔 지우고 청록 디자인으로 바꿨다', () => {
    expect(styleBlocks(out)).toEqual([styleBlocks(input)[0]]);
  });

  it('제목·문단·표에 인라인 style 을 박지 않는다', () => {
    for (const tag of STYLED_TAGS) {
      expect(out).not.toMatch(new RegExp(`<${tag}\\b[^>]*\\sstyle=`, 'i'));
    }
  });

  it('발행 흐름의 "인라인 스타일 강제 주입" 도 스킨 글은 건너뛴다', () => {
    const src = read('src/core/blogger-publisher.js');
    const guard = blockBetween(src, '🔥 인라인 스타일 강제 주입 - Blogger 템플릿 CSS 무시', "console.log('[PUBLISH] 🔥 인라인 스타일 강제 주입 시작...')");
    expect(guard).toMatch(/if \(!preserveOriginalStyles && !carriesOrbitSkin\(finalHtmlContent\)\)/);
  });
});

describe('블로거 — 어떤 글이든 테마 틀·사이드바를 건드리지 않는다', () => {
  // 블로거 홈처럼 글 여러 편이 한 화면에 나오면, 글 하나의 CSS 가 다른 글과 테마 전체에 걸린다
  const THEME = /#sidebar-wrapper|#outer-wrapper|#main-wrapper|#content-wrapper|#Blog1|\.theiaStickySidebar|\.post-body\b|\.post-outer\b|\.entry-content\b|\.post-content\b|\.item-post-inner|\.blog-posts\b|\.hentry\b|\.separator\b|\.tr-caption-container|(^|[\s,{}])\.(container|row|col|column|content-wrapper|main-wrapper|outer-wrapper)\b|(^|[\s,{}])(html|body)\s*[,{]/;

  // 규칙만 본다 — 지운 선택자를 설명하는 주석은 세지 않는다
  const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('스킨 없는 글에 입히는 CSS 에 테마 틀·사이드바 규칙이 없다', () => {
    const plain = blogger.applyInlineStyles('<h2>제목</h2><p>본문</p><table><tr><td>a</td></tr></table>');
    const css = withoutComments(styleBlocks(plain).join('\n'));
    expect(css.length).toBeGreaterThan(1000);
    expect(css).not.toMatch(THEME);
  });

  it('폴백 스킨(generateBloggerLayoutCSS)에도 없다', () => {
    const src = read('src/core/blogger-publisher.js');
    const body = blockBetween(src, 'function generateBloggerLayoutCSS()', 'function generateBloggerLayoutCSS_LEGACY_UNUSED()');
    expect(withoutComments(body)).not.toMatch(THEME);
  });
});
