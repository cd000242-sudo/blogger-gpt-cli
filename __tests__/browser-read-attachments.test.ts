/**
 * 브라우저 정독 리서치 2단계 — 공식기관 첨부 PDF 를 끝까지 읽어 근거 장부에 넣는다(10MB 상한, HWP 제외).
 *
 * 내려받기·PDF 해석은 가짜를 주입한다(테스트가 인터넷·pdfjs 를 타면 안 된다). 실제 pdfjs 는 사장님 PC·스모크로 확인한다.
 * 계획서: docs/browser-read-research-plan.md
 */
import { fetchAttachmentDocument, isReadableAttachmentUrl, DEFAULT_MAX_ATTACHMENT_BYTES } from '../src/core/crawlers/attachment-reader';
import { createBrowserReader, type BrowserLike } from '../src/core/crawlers/browser-reader';
import { fetchGrounding } from '../src/core/final/naver-grounding';
import type { PageFetchOutcome } from '../src/core/crawlers/official-page-body';

const PDF_HEAD = new TextEncoder().encode('%PDF-1.7\n');
const HWP_HEAD = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const bytes = (head: Uint8Array, size = 2048) => { const b = new Uint8Array(size); b.set(head, 0); return b; };
const longText = '2026년 청년 월세 특별지원 공고. 지원 대상은 만 19세부터 34세까지 무주택 청년이며 월 최대 20만원을 최장 12개월 지원한다. 신청 기간은 3월 2일부터 3월 16일까지다. '.repeat(20);

const fakeFetch = (spec: { status?: number; headers?: Record<string, string>; body?: Uint8Array | ReadableStream<Uint8Array> }) => {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(String(url));
    return new Response(spec.body as BodyInit ?? null, { status: spec.status ?? 200, headers: spec.headers ?? { 'content-type': 'application/pdf' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
};

describe('어떤 첨부를 읽나 (isReadableAttachmentUrl)', () => {
  test('PDF 주소와 확장자 없는 내려받기 주소는 읽어 본다', () => {
    expect(isReadableAttachmentUrl('https://www.molit.go.kr/files/notice_2026.pdf')).toBe(true);
    expect(isReadableAttachmentUrl('https://www.molit.go.kr/files/notice.PDF?ver=2')).toBe(true);
    expect(isReadableAttachmentUrl('https://www.seoul.go.kr/common/fileDown.do?id=123')).toBe(true);
  });
  test('HWP·엑셀·워드·압축·그림은 읽지 않는다(1차 제외)', () => {
    for (const u of ['https://a.go.kr/x.hwp', 'https://a.go.kr/x.hwpx', 'https://a.go.kr/x.xlsx', 'https://a.go.kr/x.docx', 'https://a.go.kr/x.zip', 'https://a.go.kr/x.png']) {
      expect(isReadableAttachmentUrl(u)).toBe(false);
    }
  });
  test('일반 웹페이지는 첨부가 아니다', () => {
    expect(isReadableAttachmentUrl('https://www.gov.kr/portal/service/serviceInfo/123')).toBe(false);
  });
});

describe('첨부 PDF 읽기 (fetchAttachmentDocument)', () => {
  test('상한은 10MB', () => {
    expect(DEFAULT_MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });

  test('PDF 를 읽어 발췌(maxChars)와 장부용 보존 본문을 돌려준다', async () => {
    const { fn } = fakeFetch({ body: bytes(PDF_HEAD) });
    const pdfText = jest.fn(async () => ({ text: longText, pages: 3 }));
    const out = await fetchAttachmentDocument('https://www.molit.go.kr/notice.pdf', 300, { fetchImpl: fn, pdfText });
    expect(out.doc).not.toBeNull();
    expect(out.doc!.text.length).toBeLessThanOrEqual(300);
    expect(out.doc!.fullText!.length).toBeGreaterThan(300);
    expect(out.doc!.text).toContain('청년 월세');
    expect(pdfText).toHaveBeenCalledTimes(1);
  });

  test('크기 표시(Content-Length)가 10MB 를 넘으면 받지도 해석하지도 않는다 — 37MB 가이드북 같은 것', async () => {
    const { fn } = fakeFetch({ headers: { 'content-type': 'application/pdf', 'content-length': String(37 * 1024 * 1024) }, body: bytes(PDF_HEAD) });
    const pdfText = jest.fn(async () => ({ text: longText, pages: 1 }));
    const out = await fetchAttachmentDocument('https://www.easylaw.go.kr/guide.pdf', 900, { fetchImpl: fn, pdfText });
    expect(out.doc).toBeNull();
    expect(out.failure?.reason).toBe('UNSUPPORTED_CONTENT');
    expect(out.failure?.detail).toContain('10MB');
    expect(pdfText).not.toHaveBeenCalled();
  });

  test('크기 표시가 없어도 받는 도중 상한을 넘으면 멈춘다', async () => {
    const chunk = bytes(PDF_HEAD, 1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { if (sent >= 30) { controller.close(); return; } sent += 1; controller.enqueue(chunk); },
    });
    const { fn } = fakeFetch({ headers: { 'content-type': 'application/octet-stream' }, body: stream });
    const pdfText = jest.fn(async () => ({ text: longText, pages: 1 }));
    const out = await fetchAttachmentDocument('https://www.seoul.go.kr/fileDown.do?id=1', 900, { fetchImpl: fn, pdfText, maxBytes: 5 * 1024 * 1024 });
    expect(out.failure?.reason).toBe('UNSUPPORTED_CONTENT');
    expect(out.failure?.detail).toContain('5MB');
    expect(sent).toBeLessThan(30);           // 끝까지 받지 않았다
    expect(pdfText).not.toHaveBeenCalled();
  });

  test('PDF 가 아니면(HWP 내려받기 등) 해석하지 않는다', async () => {
    const { fn } = fakeFetch({ headers: { 'content-type': 'application/octet-stream' }, body: bytes(HWP_HEAD) });
    const pdfText = jest.fn(async () => ({ text: longText, pages: 1 }));
    const out = await fetchAttachmentDocument('https://www.seoul.go.kr/fileDown.do?id=2', 900, { fetchImpl: fn, pdfText });
    expect(out.failure?.reason).toBe('UNSUPPORTED_CONTENT');
    expect(pdfText).not.toHaveBeenCalled();
  });

  test('글자가 거의 없는 PDF(스캔 이미지)는 본문으로 치지 않는다', async () => {
    const { fn } = fakeFetch({ body: bytes(PDF_HEAD) });
    const out = await fetchAttachmentDocument('https://a.go.kr/scan.pdf', 900, { fetchImpl: fn, pdfText: async () => ({ text: '  1  ', pages: 10 }) });
    expect(out.doc).toBeNull();
    expect(out.failure?.reason).toBe('EXTRACT_FAIL');
  });

  test('404·차단·해석 오류에도 던지지 않고 사유를 남긴다', async () => {
    const gone = await fetchAttachmentDocument('https://a.go.kr/gone.pdf', 900, { fetchImpl: fakeFetch({ status: 404, body: new Uint8Array(0) }).fn, pdfText: async () => ({ text: longText, pages: 1 }) });
    expect(gone.failure).toMatchObject({ reason: 'HTTP_STATUS', status: 404 });
    const blocked = await fetchAttachmentDocument('https://a.go.kr/x.pdf', 900, { fetchImpl: fakeFetch({ status: 403, body: new Uint8Array(0) }).fn, pdfText: async () => ({ text: longText, pages: 1 }) });
    expect(blocked.failure?.reason).toBe('BLOCKED');
    const broken = await fetchAttachmentDocument('https://a.go.kr/broken.pdf', 900, { fetchImpl: fakeFetch({ body: bytes(PDF_HEAD) }).fn, pdfText: async () => { throw new Error('Invalid PDF structure'); } });
    expect(broken.doc).toBeNull();
    expect(broken.failure?.reason).toBe('EXTRACT_FAIL');
    const neterr = await fetchAttachmentDocument('https://a.go.kr/x.pdf', 900, { fetchImpl: (async () => { throw Object.assign(new Error('getaddrinfo ENOTFOUND a.go.kr'), { code: 'ENOTFOUND' }); }) as unknown as typeof fetch, pdfText: async () => ({ text: longText, pages: 1 }) });
    expect(neterr.failure?.reason).toBe('NETWORK');
  });

  test('자기 사이트 첨부는 받지 않는다', async () => {
    const { fn, calls } = fakeFetch({ body: bytes(PDF_HEAD) });
    const out = await fetchAttachmentDocument('https://leadernam.com/wp-content/a.pdf', 900, { fetchImpl: fn, pdfText: async () => ({ text: longText, pages: 1 }) });
    expect(out.failure?.reason).toBe('BLOCKED');
    expect(calls).toEqual([]);
  });
});

describe('근거 수집(fetchGrounding)에 연결 — 첨부는 따로 최대 3건, 공식기관 것만', () => {
  const KEY = '청년 월세 지원';
  const news = (n: number) => Array.from({ length: n }, (_, i) => ({
    title: `청년 월세 지원 신청 기사 ${i + 1}`, description: '청년 월세 지원 신청 조건과 기간 안내',
    link: `https://news.example.com/a/${i + 1}`, originallink: `https://news.example.com/a/${i + 1}`, pubDate: 'Mon, 28 Sep 2026 09:00:00 +0900',
  }));
  const pdfItem = (host: string, i: number) => ({ title: `청년 월세 지원 공고문 ${i}`, description: '청년 월세 지원 대상 조건 신청 기간 공고', link: `https://${host}/files/notice_${i}.pdf` });
  const search = (items: Record<string, any[]>) => async (type: string) => ({ ok: true, items: items[type] || [] });
  const noBrowser: BrowserLike = { newContext: async () => { throw new Error('unused'); }, close: async () => undefined } as unknown as BrowserLike;
  const httpOk = () => {
    const pageBody = require('../src/core/crawlers/official-page-body');
    return jest.spyOn(pageBody, 'fetchPageDocumentDetailed').mockImplementation(async (...args: unknown[]) => ({
      doc: { text: `${String(args[0])} 청년 월세 지원 기사 본문 `.repeat(20).slice(0, 900), publishedAt: null, rawLength: 2000 }, attemptedAt: new Date().toISOString(),
    }));
  };
  const attachmentOk = (calls: string[]) => async (url: string, maxChars: number): Promise<PageFetchOutcome> => {
    calls.push(url);
    const full = `${url} ${longText}`;
    return { doc: { text: full.slice(0, maxChars), publishedAt: null, rawLength: full.length, fullText: full, truncatedAt: null }, attemptedAt: new Date().toISOString() };
  };

  test('켜짐: 공식기관 첨부 PDF 를 읽어 장부에 넣고, 기록에 via=pdf 를 남긴다', async () => {
    const spy = httpOk();
    try {
      const calls: string[] = [];
      const reader = createBrowserReader({ launch: async () => noBrowser, ownSources: [] });
      const g = await fetchGrounding(KEY, search({ news: news(2), webkr: [pdfItem('www.molit.go.kr', 1)], blog: [] }) as any, { mainKeyword: KEY, browserRead: { enabled: true, reader, attachment: attachmentOk(calls) } });
      await reader.close();
      const url = 'https://www.molit.go.kr/files/notice_1.pdf';
      expect(calls).toEqual([url]);
      expect(g.fetchLog!.find((f) => f.url === url)).toMatchObject({ attempted: true, ok: true, reason: 'ok', via: 'pdf' });
      expect(g.items!.some((it) => it.url === url && it.hasBody)).toBe(true);
      expect(g.browserRead).toMatchObject({ attachments: 1 });
    } finally { spy.mockRestore(); }
  });

  test('켜짐: 첨부는 본문 쪽수와 따로 최대 3건 — 넷째부터는 예전처럼 건너뛴다', async () => {
    const spy = httpOk();
    try {
      const calls: string[] = [];
      const reader = createBrowserReader({ launch: async () => noBrowser, ownSources: [] });
      const pdfs = [1, 2, 3, 4, 5].map((i) => pdfItem(`www.gov${i}.go.kr`, i));
      const g = await fetchGrounding(KEY, search({ news: news(3), webkr: pdfs, blog: [] }) as any, { mainKeyword: KEY, browserRead: { enabled: true, reader, attachment: attachmentOk(calls) } });
      await reader.close();
      expect(calls.length).toBe(3);
      expect(g.fetchLog!.filter((f) => f.via === 'http' && f.attempted).length).toBe(3);   // 뉴스 본문 예산은 그대로 쓰였다
      expect(g.fetchLog!.filter((f) => f.reason === 'file-url').length).toBe(2);
    } finally { spy.mockRestore(); }
  });

  test('켜짐: 공식기관이 아닌 곳의 PDF 는 읽지 않는다', async () => {
    const spy = httpOk();
    try {
      const calls: string[] = [];
      const reader = createBrowserReader({ launch: async () => noBrowser, ownSources: [] });
      await fetchGrounding(KEY, search({ news: news(1), webkr: [pdfItem('www.some-company.com', 1)], blog: [] }) as any, { mainKeyword: KEY, browserRead: { enabled: true, reader, attachment: attachmentOk(calls) } });
      await reader.close();
      expect(calls).toEqual([]);
    } finally { spy.mockRestore(); }
  });

  test('꺼짐(기본): 첨부는 예전처럼 건너뛴다', async () => {
    const calls: string[] = [];
    const g = await fetchGrounding(KEY, search({ news: news(1), webkr: [pdfItem('www.molit.go.kr', 1)], blog: [] }) as any, {
      mainKeyword: KEY,
      fetchBody: async (u: string) => `${u} 청년 월세 지원 본문 `.repeat(30),
    });
    expect(calls).toEqual([]);
    expect(g.fetchLog!.find((f) => f.url.endsWith('notice_1.pdf'))).toMatchObject({ attempted: false, reason: 'file-url' });
  });
});
