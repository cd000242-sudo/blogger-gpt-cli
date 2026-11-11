/**
 * 거미줄 종합글 — 마무리 단계(finish)는 발행기가 다시 칠하지 않도록 "표식만" 달고 통과시킨다 (묶음 D 정정)
 *
 * 사고(1차): 종합글은 sw-cornerstone + 인라인 스타일이라 발행기의 옛 경로를 탔다.
 *   WordPress = .wp-styled-content 래퍼 + 860/1000px !important 폭 고정 + h2/h3 덧칠,
 *   Blogger   = 스킨 없는 글의 청록 인라인 덮어쓰기. 종합글 자체의 max-width:760px 도 한 번 더 있었다.
 * 사고(2차, 실측): 통과시키려고 일반 글용 앱 스킨 CSS(44KB)를 입혔더니 종합글 자기 디자인과 충돌했다.
 *   요약 상자 = 짙은 바탕에 짙은 글자 / 모바일 = 흰 바탕에 흰 글자 / 표→카드 규칙에 관련 글 격자 반쪽 / 표 글자 자간.
 * 새 계약: 스킨 CSS 는 넣지 않는다. 통과 표식(WordPress = bgpt-wp-ready, Blogger = bgpt-blogger-ready)만 단다.
 * 이 파일은 발행기 공개 함수(applyWordPressInlineStyles / applyInlineStyles)에 실제로 넣어 돌려 확인한다.
 * 실제 LLM·앱·네트워크는 부르지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';
import { finishSpiderHtml, normalizeSpiderFinishPlatform, carriesSpiderFrame } from '../src/core/spider';
import { carriesOrbitSkin } from '../src/core/final/skin-marker';
import { applyWordPressInlineStyles } from '../src/wordpress/wordpress-publisher';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const blogger = require('../src/core/blogger-publisher');

const MAIN = fs.readFileSync(path.join(process.cwd(), 'electron/main.ts'), 'utf8');
const BLOGGER_SRC = fs.readFileSync(path.join(process.cwd(), 'src/core/blogger-publisher.js'), 'utf8');
const HANDLER = blockBetween(
  MAIN,
  "ipcMain.handle('generate-internal-consistency', async",
  "ipcMain.handle('save-image-as-png'",
);

const SPIDER_STYLE = '<style>.max-mode-article h2{color:#123456 !important;}</style>';
const JSON_LD = '<script type="application/ld+json">{"@type":"Article"}</script>';
// The summary box carries its own background AND text colour inline — the app skin used to repaint only one of them.
const SUMMARY_BOX = '<div class="tldr-answer-box" style="padding:20px 24px;background:linear-gradient(135deg,#f2faf6,#e6f3ee);border-left:5px solid #2f6f61;"><p style="color:#1f2933 !important;font-size:17px;font-weight:700;">💡 한눈에 답변</p><p style="color:#1f2933 !important;">먼저 결론부터 말씀드립니다.</p><ul><li style="color:#1f2933 !important;">첫 줄</li></ul></div>';
const GRID = '<table style="width:100%;"><tr><td colspan="2" style="padding:8px;">관련 글 제목 칸</td></tr><tr><td><a href="https://a.example/1">관련 글 하나</a></td><td><a href="https://a.example/2">관련 글 둘</a></td></tr></table>';
const ROOT = `<div class="sw-cornerstone max-mode-article" style="max-width:760px;margin:0 auto;padding:0 16px;font-family:'Noto Sans KR',sans-serif;line-height:1.8;">
<h1 style="font-size:34px;">종합 제목과 겹치는 본문 제목</h1>
${SUMMARY_BOX}
<h2>첫째 소제목</h2><p>첫째 본문 문단입니다.</p>
<table><thead><tr><th>항목</th><th>설명</th></tr></thead><tbody><tr><td data-label="항목">가</td><td data-label="설명">나</td></tr></tbody></table>
${GRID}
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;"><a href="https://a.example/1">관련 글 하나</a><a href="https://a.example/2">관련 글 둘</a></div>
<div class="cta-box" style="padding:18px;"><p>정확한 조건은 따로 있어요.</p><a href="https://a.example/1" target="_blank" rel="noopener">원본 글 자세히 보기</a></div>
<h2>둘째 소제목</h2><p>둘째 본문 문단입니다.</p>
<h2>셋째 소제목</h2><p>셋째 본문 문단입니다.</p>
<p style="margin:0;">종합글로 돌아가기 링크 자리</p>
</div>`;
const SPIDER_HTML = `${SPIDER_STYLE}\n${JSON_LD}\n${ROOT}`;

const plain = (html: string) => html
  .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, '');
const BODY_TEXT_WITHOUT_H1 = plain(ROOT.replace(/<h1\b[\s\S]*?<\/h1>/i, ''));
const OLD_PATH_MARKS = [/wp-styled-content/, /수익 최적화 WordPress 레이아웃/, /max-width:\s*(?:860|1000)px/];
const styleCount = (html: string) => (html.match(/<style\b/gi) || []).length;
const NO_APP_SKIN = [/PREMIUM WHITE PAPER SKIN/, /1-BILLION-POINT/, /\.bgpt-content\b/, /IBM Plex Mono/];

describe('재현 확인 — 마무리 없이 발행기에 넣으면 옛 경로를 탄다', () => {
  it('WordPress 는 .wp-styled-content 래퍼와 860/1000px 폭 고정을 입힌다', () => {
    const old = applyWordPressInlineStyles(SPIDER_HTML);
    expect(old).toMatch(/wp-styled-content/);
    expect(old).toMatch(/max-width:\s*(?:860|1000)px/);
  });
});

describe('finishSpiderHtml — 플랫폼 이름 정리', () => {
  it('wordpress / blogger(blogspot) 외에는 틀을 입히지 않는 쪽(other)', () => {
    expect(normalizeSpiderFinishPlatform('wordpress')).toBe('wordpress');
    expect(normalizeSpiderFinishPlatform('WordPress')).toBe('wordpress');
    expect(normalizeSpiderFinishPlatform('blogspot')).toBe('blogger');
    expect(normalizeSpiderFinishPlatform('blogger')).toBe('blogger');
    expect(normalizeSpiderFinishPlatform('tistory')).toBe('other');
    expect(normalizeSpiderFinishPlatform(undefined)).toBe('other');
  });
});

describe('finishSpiderHtml — WordPress', () => {
  const out = finishSpiderHtml(SPIDER_HTML, { platform: 'wordpress' }).html;

  it('통과 표식 <article class="bgpt-wp-ready"> 만 달고 앱 스킨(<style>·bgpt-content)은 넣지 않는다', () => {
    expect(out).toMatch(/<article class="bgpt-wp-ready">/);
    expect(out).not.toMatch(/bgpt-content/);
    expect(carriesOrbitSkin(out)).toBe(false);
    for (const mark of NO_APP_SKIN) expect(out).not.toMatch(mark);
    expect(styleCount(out)).toBe(1);
  });
  it('종합글 자기 <style>·JSON-LD 는 글자 그대로 틀 바깥(앞)에 남는다', () => {
    expect(out.startsWith(`${SPIDER_STYLE}\n${JSON_LD}\n`)).toBe(true);
    expect(out.indexOf('<article')).toBeGreaterThan(out.indexOf(JSON_LD));
  });
  it('요약 상자의 배경·글자색 인라인 스타일과 관련 글 격자(colspan 표)가 한 글자도 안 바뀐다', () => {
    expect(out).toContain(SUMMARY_BOX);
    expect(out).toContain(GRID);
  });
  it('본문 H1 은 남지 않고, 나머지 본문은 글자 그대로다', () => {
    expect(out).not.toMatch(/<h1\b/i);
    expect(plain(out)).toBe(BODY_TEXT_WITHOUT_H1);
  });
  it('종합글 뿌리 요소의 max-width 만 빠지고 클래스·나머지 스타일은 그대로다', () => {
    const root = out.match(/<div class="sw-cornerstone max-mode-article"[^>]*>/)![0];
    expect(root).not.toMatch(/max-width/);
    expect(root).toMatch(/margin:0 auto/);
    expect(root).toMatch(/padding:0 16px/);
    expect(root).toMatch(/font-family:'Noto Sans KR',sans-serif/);
  });
  it('요약 상자·표·관련 글 격자·CTA 가 그대로 있다', () => {
    for (const piece of ['class="tldr-answer-box"', '<table>', 'display:grid;grid-template-columns:repeat(2,1fr)', 'class="cta-box"', 'href="https://a.example/2"']) {
      expect(out).toContain(piece);
    }
  });
  it('applyWordPressInlineStyles 에 넣어도 한 글자도 안 바뀌고 옛 경로 흔적이 없다', () => {
    const published = applyWordPressInlineStyles(out);
    expect(published).toBe(out);
    for (const mark of OLD_PATH_MARKS) expect(published).not.toMatch(mark);
    expect(published).not.toMatch(/<h1\b/i);
  });
  it('두 번 돌려도 결과가 같다', () => {
    expect(finishSpiderHtml(out, { platform: 'wordpress' }).html).toBe(out);
  });
  it('이미 앱 스킨(bgpt-content)을 실은 글은 그대로 둔다 (일반 글 동작 불변)', () => {
    const skinned = '<style>.bgpt-content h2{color:#111;}</style><article class="bgpt-wp-ready bgpt-content"><p>가.</p></article>';
    expect(finishSpiderHtml(skinned, { platform: 'wordpress' }).html).toBe(skinned);
  });
});

describe('finishSpiderHtml — Blogger', () => {
  const out = finishSpiderHtml(SPIDER_HTML, { platform: 'blogspot' }).html;

  it('통과 표식 <article class="bgpt-blogger-ready"> 만 달고 앱 스킨은 넣지 않는다', () => {
    expect(out).toMatch(/<article class="bgpt-blogger-ready">/);
    expect(out).not.toMatch(/bgpt-wp-ready|bgpt-content/);
    expect(carriesOrbitSkin(out)).toBe(false);
    for (const mark of NO_APP_SKIN) expect(out).not.toMatch(mark);
    expect(styleCount(out)).toBe(1);
  });
  it('applyInlineStyles 에 넣으면 한 글자도 안 바뀐다 — blogger-gpt-content 래퍼 없음, 종합글 <style> 유지, 청록 덮어쓰기 없음', () => {
    const published: string = blogger.applyInlineStyles(out);
    expect(published).toBe(out);
    expect(published).toContain(SPIDER_STYLE);
    expect(published).toContain(SUMMARY_BOX);
    expect(published).not.toMatch(/<h1\b/i);
    expect(published).not.toMatch(/blogger-gpt-content/);
    for (const mark of OLD_PATH_MARKS) expect(published).not.toMatch(mark);
    expect(plain(published)).toBe(BODY_TEXT_WITHOUT_H1);
  });
  it('발행기의 인라인 스타일 강제 주입 단계가 종합글 표식 글을 건너뛴다 (carriesSpiderFrame)', () => {
    expect(carriesSpiderFrame(out)).toBe(true);
    expect(BLOGGER_SRC).toMatch(/if \(!preserveOriginalStyles && !carriesOrbitSkin\(finalHtmlContent\) && !carriesSpiderFrame\(finalHtmlContent\)\) \{/);
  });
  it('일반 글의 통과·옛 경로 판정은 바뀌지 않는다', () => {
    const skinnedOrdinary = '<style>.bgpt-content h2{color:#111;}</style><article class="bgpt-blogger-ready bgpt-content"><h2>가</h2><p>나</p></article>';
    expect(carriesSpiderFrame(skinnedOrdinary)).toBe(false);
    expect(carriesSpiderFrame('<article class="bgpt-blogger-ready"><h2>가</h2><p>나</p></article>')).toBe(false);
    expect(carriesSpiderFrame(ROOT)).toBe(false);
    expect(carriesSpiderFrame(finishSpiderHtml(SPIDER_HTML, { platform: 'wordpress' }).html)).toBe(false);
    expect(blogger.applyInlineStyles('<h2>제목</h2><p>본문 문단입니다.</p>')).toMatch(/blogger-gpt-content/);
  });
  it('두 번 돌려도 결과가 같다', () => {
    expect(finishSpiderHtml(out, { platform: 'blogspot' }).html).toBe(out);
  });
});

describe('finishSpiderHtml — 티스토리·그 밖', () => {
  const out = finishSpiderHtml(SPIDER_HTML, { platform: 'tistory' }).html;

  it('틀·스킨은 입히지 않고 H1 과 폭 고정만 푼다', () => {
    expect(out).not.toMatch(/<article/);
    expect(carriesOrbitSkin(out)).toBe(false);
    expect(out).not.toMatch(/<h1\b/i);
    expect(out.match(/<div class="sw-cornerstone max-mode-article"[^>]*>/)![0]).not.toMatch(/max-width/);
    expect(plain(out)).toBe(BODY_TEXT_WITHOUT_H1);
    expect(styleCount(out)).toBe(1);
  });
  it('빈 입력은 그대로 돌려준다', () => {
    expect(finishSpiderHtml('', { platform: 'wordpress' }).html).toBe('');
  });
});

describe('핸들러 배선 — 마무리는 응답 직전 한 곳에서만', () => {
  it('finishSpiderHtml 호출은 스킨 CSS 주입 뒤, 성공 응답 앞, finalize 단계 안에 있다', () => {
    const call = HANDLER.indexOf('spider.finishSpiderHtml(');
    expect(call).toBeGreaterThan(0);
    expect((HANDLER.match(/spider\.finishSpiderHtml\(/g) || []).length).toBe(1);
    expect(call).toBeGreaterThan(HANDLER.indexOf('generatedContent = skinCss + generatedContent'));
    expect(call).toBeLessThan(HANDLER.indexOf('success: true'));
    expect(call).toBeGreaterThan(HANDLER.indexOf("spiderStage = 'finalize'"));
  });
  it('화면이 보낸 platform(targetPlatform)을 그대로 넘긴다', () => {
    expect(HANDLER).toMatch(/spider\.finishSpiderHtml\(generatedContent,\s*\{\s*platform:\s*targetPlatform\s*\}\)/);
  });
  it('티스토리 준비 분기는 폭·래퍼를 만들지 않는다 (변경 없음의 근거)', () => {
    const tistory = braceBlock(MAIN, /if \(\/tistory\|티스토리\/i\.test\(platform\)\)/);
    expect(tistory).not.toMatch(/wp-styled-content|max-width|bgpt-content/);
    expect(tistory).toMatch(/<h1\[\^>\]\*>/);
  });
});
