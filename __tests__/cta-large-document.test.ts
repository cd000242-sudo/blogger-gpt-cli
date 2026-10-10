/**
 * 큰 문서 CTA 차단 (사장님 승인 2026-10-10).
 *
 * 실측: 청년 월세지원 글의 CTA 가 37MB PDF(찾기쉬운생활법령 가이드북, easylaw FlDownload.laf) 내려받기였다.
 * 독자가 버튼을 누르면 37MB 가 내려받아진다. 그래서 CTA 주소 검사(validateCtaUrl)에서 **문서이고 10MB 를 넘으면** 무효로 돌린다.
 * 무효면 자동 CTA 의 모든 단계(AI 추론·검색·크롤링·매핑)가 이미 다음 후보로 넘어간다.
 * 크기를 모르면 막지 않는다(못 본 것으로 막지 않는다 — 이 저장소의 규칙). 사용자가 직접 넣은 CTA 는 막지 않는다.
 */
import { validateCtaUrl, CTA_MAX_DOCUMENT_BYTES } from '../src/cta/validate-cta-url';
import { classifyCtaLiveness, isHardDead } from '../src/cta/cta-authority';
import * as fs from 'fs';
import * as path from 'path';

const MB = 1024 * 1024;
type Spec = { status?: number; headers?: Record<string, string>; size?: number };
const realFetch = (global as any).fetch;
let calls: Array<{ url: string; method: string; range: string }> = [];
let cancelled = 0;

/** 주소별 응답. body 는 끝없이 흘러나오는 흐름 — 끝까지 읽으면 테스트가 멈춘다(받다 만 것을 확인하려고) */
function serve(routes: Record<string, Spec | ((method: string, range: string) => Spec)>) {
  (global as any).fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = String(init.method || 'GET');
    const range = String((init.headers as Record<string, string> | undefined)?.['Range'] || '');
    calls.push({ url, method, range });
    const r = routes[url];
    const spec = typeof r === 'function' ? r(method, range) : r;
    if (!spec) throw new Error('no route');
    const stream = new ReadableStream<Uint8Array>({
      pull(c) { c.enqueue(new Uint8Array(64 * 1024)); },
      cancel() { cancelled += 1; },
    });
    return new Response(method === 'HEAD' ? null : stream, { status: spec.status ?? 200, headers: spec.headers ?? {} });
  });
}

beforeEach(() => { calls = []; cancelled = 0; });
afterAll(() => { (global as any).fetch = realFetch; });

describe('문서이고 10MB 를 넘으면 CTA 로 쓰지 않는다', () => {
  test('상한은 10MB', () => {
    expect(CTA_MAX_DOCUMENT_BYTES).toBe(10 * MB);
  });

  test('실측 꼴: easylaw FlDownload.laf 가 37MB PDF → 무효(document-too-large), 본문은 받다 만다', async () => {
    const url = 'https://www.easylaw.go.kr/CSP/FlDownload.laf?flSeq=1720078652934';
    serve({ [url]: { headers: { 'content-type': 'application/pdf', 'content-length': String(37 * MB) } } });
    const r = await validateCtaUrl(url, { timeout: 3000 });
    expect(r.isValid).toBe(false);
    expect(r.reason).toBe('document-too-large');
    expect(cancelled).toBeGreaterThan(0);
  });

  test('무효 이유는 "죽은 주소"로 분류된다 — 검색 단계가 다음 결과로 넘어간다', () => {
    const live = classifyCtaLiveness({ isValid: false, reason: 'document-too-large', statusCode: 200 });
    expect(isHardDead(live)).toBe(true);
  });

  test('내려받기(attachment)로 오는 큰 파일도 문서로 본다', async () => {
    const url = 'https://www.example.go.kr/board/fileDown.do?id=big-attach';
    serve({ [url]: { headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="guide.hwp"', 'content-length': String(25 * MB) } } });
    expect((await validateCtaUrl(url, { timeout: 3000 })).reason).toBe('document-too-large');
  });

  test('크기 표시가 없으면 앞 1바이트만 달라고 해서(Range) 전체 크기를 알아낸다', async () => {
    const url = 'https://files.example.com/docs/huge-manual.pdf';   // .go.kr 이 아니라 HEAD 로 먼저 본다
    serve({
      [url]: (method, range) => (method === 'HEAD'
        ? { headers: { 'content-type': 'application/pdf' } }
        : range === 'bytes=0-0'
          ? { status: 206, headers: { 'content-type': 'application/pdf', 'content-range': `bytes 0-0/${39 * MB}` } }
          : { headers: { 'content-type': 'application/pdf' } }),
    });
    const r = await validateCtaUrl(url, { timeout: 3000 });
    expect(r.reason).toBe('document-too-large');
    expect(calls.some((c) => c.range === 'bytes=0-0')).toBe(true);
  });
});

describe('막지 않는 경우', () => {
  test('작은 문서(신청서 PDF 2MB)는 그대로 쓴다 — 본문은 받지 않는다', async () => {
    const url = 'https://www.example.go.kr/files/apply-form-small.pdf';
    serve({ [url]: { headers: { 'content-type': 'application/pdf', 'content-length': String(2 * MB) } } });
    const r = await validateCtaUrl(url, { timeout: 3000 });
    expect(r.isValid).toBe(true);
    expect(cancelled).toBeGreaterThan(0);
  });

  test('크기를 끝내 모르면 막지 않는다(못 본 것으로 막지 않는다)', async () => {
    const url = 'https://files.example.com/docs/unknown-size.pdf';
    serve({ [url]: () => ({ headers: { 'content-type': 'application/pdf' } }) });
    expect((await validateCtaUrl(url, { timeout: 3000 })).isValid).toBe(true);
  });

  test('큰 HTML 페이지는 문서가 아니다 — 예전처럼 통과', async () => {
    const url = 'https://www.example.go.kr/policy/big-page';
    serve({ [url]: { headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': String(600 * 1024) } } });
    expect((await validateCtaUrl(url, { timeout: 3000 })).isValid).toBe(true);
  });

  test('사용자가 직접 넣은 CTA 는 크기로 막지 않는다(maxDocumentBytes: 0)', async () => {
    const url = 'https://www.example.go.kr/files/user-picked-guide.pdf';
    serve({ [url]: { headers: { 'content-type': 'application/pdf', 'content-length': String(37 * MB) } } });
    expect((await validateCtaUrl(url, { timeout: 3000, maxDocumentBytes: 0 })).isValid).toBe(true);
  });

  test('수동 CTA 경로가 실제로 maxDocumentBytes: 0 을 넘긴다', () => {
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toContain('const urlCheck = await validateCtaUrl(ctaData.url, { timeout: 5000, maxDocumentBytes: 0 });');
  });
});
