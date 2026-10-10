/**
 * 큰 문서 CTA 차단 — 주소 검사(validateCtaUrl)를 거치지 않던 길까지 막는다.
 *
 *   ① 편집기 "CTA 다시 만들기"·일괄 수리·행동 화면 찾기 — 목적지 게이트(gateCtaDestination) + 페이지 열기(fetchCtaPage)
 *   ② 발행 후 CTA 점검(cta-audit) — 큰 문서를 "못 받아옴" 이 아니라 "문서" 로 분류
 *   ③ 목적지 교체·홈 CTA 교체로 들어온 주소 — 붙이기 직전 최종 확인(orchestration)
 *   ④ 에이전트 모드 — 에이전트가 고른 링크 중 큰 문서 링크는 버튼에서 링크를 뗀다(electron/main 후처리)
 */
import * as fs from 'fs';
import * as path from 'path';
import { fetchCtaPage } from '../src/cta/page-fetcher';
import { gateCtaDestination } from '../src/cta/destination-gate';
import { classifyCtaLink } from '../src/cta/cta-audit';
import { dropLargeDocumentLinks } from '../src/cta/large-document-links';
import { blockBetween } from './helpers/source-block';

const MB = 1024 * 1024;
const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const realFetch = (global as any).fetch;
afterAll(() => { (global as any).fetch = realFetch; });

describe('① 페이지 열기·목적지 게이트 — 편집기 다시 만들기·일괄 수리가 지나는 길', () => {
  test('큰 문서면 본문을 받지 않고 DOCUMENT_TOO_LARGE 로 돌려준다', async () => {
    let cancelled = 0;
    (global as any).fetch = jest.fn(async () => new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(65536)); }, cancel() { cancelled += 1; } }), {
      status: 200, headers: { 'content-type': 'application/pdf', 'content-length': String(37 * MB) },
    }));
    const page = await fetchCtaPage('https://www.easylaw.go.kr/CSP/FlDownload.laf?flSeq=gap1', { timeoutMs: 3000 });
    expect(page).toMatchObject({ ok: false, html: '', errorCode: 'DOCUMENT_TOO_LARGE' });
    expect(cancelled).toBeGreaterThan(0);
  });

  test('보통 웹페이지는 예전처럼 본문을 준다', async () => {
    (global as any).fetch = jest.fn(async () => new Response('<html><body>신청 안내</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const page = await fetchCtaPage('https://www.example.go.kr/apply', { timeoutMs: 3000 });
    expect(page.ok).toBe(true);
    expect(page.html).toContain('신청 안내');
  });

  test('게이트는 큰 문서를 거절한다(약한 후보로도 남기지 않는다) — 예전엔 "페이지 확인 불가 → 통과" 였다', async () => {
    const verdict = await gateCtaDestination({
      url: 'https://www.example.go.kr/guide/view?id=big',
      keyword: '청년 월세 지원',
      intent: null,
      fetchPage: async () => ({ ok: false, html: '', errorCode: 'DOCUMENT_TOO_LARGE' }),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ severity: 'reject' });
    expect(verdict.reasons[0]).toContain('큰 문서');
  });
});

describe('② 발행 후 CTA 점검', () => {
  test('큰 문서는 "못 받아옴(unknown)" 이 아니라 "문서" 로 분류한다', () => {
    const r = classifyCtaLink('https://www.example.go.kr/guide/view?id=big', { ok: false, html: '', finalUrl: '', status: 200, errorCode: 'DOCUMENT_TOO_LARGE' } as any);
    expect(r.verdict).toBe('document');
    expect(r.reason).toContain('10MB');
  });
});

describe('③ 붙이기 직전 최종 확인(orchestration)', () => {
  const orch = read('src', 'core', 'final', 'orchestration.ts');
  test('목적지 교체 뒤, CTA 배치 전에 큰 문서만 뺀다 — 수동 CTA·내 블로그는 묻지 않는다', () => {
    const block = blockBetween(orch, '🗂️ 큰 문서 CTA 최종 확인', '// CTA 배치');
    expect(block).toContain("const check = await validateCtaUrl(u, { timeout: 5000 });");
    expect(block).toContain("if (check.reason === 'document-too-large') {");
    expect(block).toContain('manualUrls.has(u)');
    expect(block).toContain('ownSite');
    expect(orch.indexOf('🗂️ 큰 문서 CTA 최종 확인')).toBeGreaterThan(orch.indexOf('authority.enforceCtaDestination'));
  });
});

describe('④ 에이전트 모드 — 큰 문서 링크 떼기', () => {
  const pdfUrl = 'https://www.easylaw.go.kr/CSP/FlDownload.laf?flSeq=agent1';
  const html = `<p>본문 <a href="https://www.bokjiro.go.kr/apply">복지로</a></p>
<div style="text-align:center"><a href="${pdfUrl.replace(/&/g, '&amp;')}" rel="nofollow noopener" target="_blank" style="display:inline-block">가이드북 보기 →</a></div>
<p><a href="https://www.molit.go.kr/files/small-form.pdf">신청서</a></p>`;

  test('큰 문서 링크만 떼고 글자는 남긴다 — 파일처럼 보이는 주소만 확인한다', async () => {
    const checked: string[] = [];
    const out = await dropLargeDocumentLinks(html, {
      validate: async (u: string) => { checked.push(u); return u.includes('FlDownload') ? { isValid: false, reason: 'document-too-large' } : { isValid: true }; },
    });
    expect(out.removed).toEqual([pdfUrl]);
    expect(out.html).not.toContain('FlDownload');
    expect(out.html).toContain('가이드북 보기 →');
    expect(out.html).toContain('href="https://www.bokjiro.go.kr/apply"');
    expect(out.html).toContain('small-form.pdf');
    expect(checked.sort()).toEqual([pdfUrl, 'https://www.molit.go.kr/files/small-form.pdf'].sort());   // 보통 페이지(복지로)는 묻지 않는다
  });

  test('확인이 실패하면 링크를 그대로 둔다(못 본 것으로 떼지 않는다)', async () => {
    const out = await dropLargeDocumentLinks(html, { validate: async () => { throw new Error('network'); } });
    expect(out.removed).toEqual([]);
    expect(out.html).toBe(html);
  });

  test('자기 사이트 링크는 묻지 않는다', async () => {
    const checked: string[] = [];
    await dropLargeDocumentLinks('<a href="https://leadernam.com/wp-content/uploads/a.pdf">x</a>', { validate: async (u: string) => { checked.push(u); return { isValid: true }; } });
    expect(checked).toEqual([]);
  });

  for (const file of ['electron/main.ts', 'electron/main.js']) {
    test(`${file}: 에이전트 작업 후처리에서 큰 문서 링크를 뗀다`, () => {
      const handler = blockBetween(read(file), "ipcMain.handle('agent-mode:run-job'", 'v3.8.630 — 에이전트 글도 발행 전에 자가 수정한다');
      expect(handler).toContain("require('../dist/cta/large-document-links')");
      expect(handler).toContain('dropLargeDocumentLinks(');
    });
  }
});
