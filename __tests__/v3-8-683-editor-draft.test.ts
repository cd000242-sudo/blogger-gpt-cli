const fs = require('fs');
const path = require('path');

import { normalizePastedContent, looksLikeHtml, critiqueDraft, improveDraft, imageBlockHtml, buildDraftImagePrompt } from '../src/core/final/editor-draft';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.683 — 편집기 초안: 붙여넣기·파일·발행글 어느 것이든 비평→수정, 썸네일·영역 이미지, 플랫폼 골라 발행.
 */
describe('v3.8.683 편집기 초안 — 붙여넣기 서식 · 비평 · 수정 · 이미지 · 배선', () => {
  test('마크다운·텍스트를 앱 서식으로, HTML 은 그대로', () => {
    const md = [
      '# 2026 근로장려금 9월 신청 지급일',
      '',
      '2026년 9월 반기 신청자는 **상반기 소득**을 기준으로 심사를 받습니다.',
      '신청 기간은 9월 1일~15일입니다.',
      '',
      '## 핵심 일정',
      '- 신청: 9월 1일~15일',
      '- 지급: 12월 17일 예정',
      '',
      '| 구분 | 날짜 |',
      '|---|---|',
      '| 신청 | 9월 1일 |',
      '',
      '> 지급액은 개인별 심사 결과에 따라 달라집니다.',
      '',
      '### 확인할 것',
      '1. 홈택스 [바로가기](https://www.hometax.go.kr)',
      '---',
      '마지막 문단입니다.',
    ].join('\n');
    const r = normalizePastedContent(md);
    expect(r.title).toBe('2026 근로장려금 9월 신청 지급일');
    expect(r.html).not.toContain('<h1');
    expect(r.html).toContain('<p>2026년 9월 반기 신청자는 <strong>상반기 소득</strong>을 기준으로 심사를 받습니다. 신청 기간은 9월 1일~15일입니다.</p>');
    expect(r.html).toContain('<h2>핵심 일정</h2>');
    expect(r.html).toContain('<ul><li>신청: 9월 1일~15일</li><li>지급: 12월 17일 예정</li></ul>');
    expect(r.html).toContain('<table><thead><tr><th>구분</th><th>날짜</th></tr></thead><tbody><tr><td>신청</td><td>9월 1일</td></tr></tbody></table>');
    expect(r.html).toContain('<blockquote><p>지급액은 개인별 심사 결과에 따라 달라집니다.</p></blockquote>');
    expect(r.html).toContain('<h3>확인할 것</h3>');
    expect(r.html).toContain('<ol><li>홈택스 <a href="https://www.hometax.go.kr" target="_blank" rel="noopener noreferrer">바로가기</a></li></ol>');
    expect(r.html).toContain('<hr>');
    expect(r.html).toContain('<p>마지막 문단입니다.</p>');
    // HTML 은 그대로, h1 은 제목으로
    const h = normalizePastedContent('<h1>제목</h1><p>본문 <script>x</script></p>');
    expect(h.title).toBe('제목');
    expect(h.html).toBe('<p>본문 <script>x</script></p>');
    expect(looksLikeHtml('그냥 글 <b>굵게</b>')).toBe(false);
    expect(normalizePastedContent('').html).toBe('');
    // 이스케이프
    expect(normalizePastedContent('a < b & c').html).toBe('<p>a &lt; b &amp; c</p>');
  });

  test('비평 — 코드 진단만으로도 리포트가 나오고, AI 는 코드 진단이 있을 때만 부른다', async () => {
    const clean = '<p>' + '이 글은 짧아요. '.repeat(3) + '</p>';
    const calls: string[] = [];
    const r = await critiqueDraft({ title: '짧은 글', html: clean, callModel: async (p) => { calls.push(p); return '[]'; } });
    expect(r.ok).toBe(true);
    expect(typeof r.score).toBe('number');
    expect(Array.isArray(r.issues)).toBe(true);
    expect(r.sections.length).toBeGreaterThanOrEqual(1);
    // callModel 없이도 돈다
    const r2 = await critiqueDraft({ title: '짧은 글', html: clean });
    expect(r2.ok).toBe(true);
    expect(r2.aiSkipped).toBe(true);
  });

  test('수정 — 모델이 엉뚱한 것을 주면 그 구간은 그대로 두고 원본을 돌려준다', async () => {
    const html = '<h2>1. 요건</h2><p>' + '요건 설명이에요. '.repeat(20) + '</p><h2>2. 기한</h2><p>' + '기한 설명이에요. '.repeat(20) + '</p>';
    const issues: any[] = [{ id: 'x', area: 'substance', severity: 'high', title: '얼버무림', detail: '', evidence: '', fix: '고쳐요', sectionIndex: 1, origin: 'code' }];
    const r = await improveDraft({ title: 't', html, issues, callModel: async () => 'garbage' });
    expect(r.ok).toBe(true);
    expect(r.revised).toBe(0);
    expect(r.skipped.length).toBe(1);
    expect(r.html).toBe(html);
  });

  test('이미지 조각 — 발행 코드가 썸네일로 집는 모양(div.separator > img)', () => {
    const h = imageBlockHtml('https://img.example/a.png', '소제목 "따옴표"');
    expect(h).toContain('<div class="separator"');
    expect(h).toContain('src="https://img.example/a.png"');
    expect(h).toContain('alt="소제목 &quot;따옴표&quot;"');
    expect(buildDraftImagePrompt('제목', '소제목')).toContain('소제목');
    expect(buildDraftImagePrompt('제목')).toBeTruthy();
  });

  test('배선 — IPC 넷, 편집기 버튼 셋, 붙여넣기 진입, 파일·붙여넣기의 플랫폼 발행', () => {
    const m = read('electron/main.ts');
    for (const ch of ['normalize-editor-paste', 'critique-editor-html', 'improve-editor-html', 'generate-editor-image']) expect(m).toContain(`ipcMain.handle('${ch}'`);
    expect(m).toContain("require('../dist/core/final/editor-draft')");
    const e = read('electron/ui/modules/editor.js');
    for (const id of ['veCritiqueBtn', 'veThumbBtn', 'veSectionImgBtn']) expect(e).toContain(`id="${id}"`);
    for (const ch of ['critique-editor-html', 'improve-editor-html', 'generate-editor-image', 'publish-content']) expect(e).toContain(`invoke('${ch}'`);
    expect(e).toContain("kind === 'paste'");
    expect(e).toContain("platformPickable: kind === 'republish' || kind === 'file' || kind === 'paste'");
    expect(e).toContain("(session.kind === 'file' || session.kind === 'paste') && !saveAs && selectedEditorPlatform()");
    expect(read('electron/ui/modules/editor-paste.js')).toContain("invoke('normalize-editor-paste'");
    // v3.8.684 — 글목록 탭을 안 열어도 플랫폼 설정을 읽는다 (배선 점검에서 찾은 구멍)
    expect(read('electron/ui/modules/published-posts.js')).toContain('export async function buildPlatformPayload(platformKey)');
    expect(e).toContain('async function platformPayloadFor(target)');
    expect(e).not.toContain('window.__buildPublishedPlatformPayload?.(');
    expect((e.match(/platformPayloadFor\(/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(read('electron/ui/modules/main.js')).toContain('window.openPasteEditor');
    expect(read('electron/ui/index.html')).toContain('window.openPasteEditor && window.openPasteEditor()');
  });
});
