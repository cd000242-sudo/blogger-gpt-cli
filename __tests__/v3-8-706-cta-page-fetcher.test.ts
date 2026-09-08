/**
 * v3.8.706 — page-fetcher: 기관 페이지를 여는 한 가지 방법.
 *
 * 실측(2026-09-08): 국토교통부·법무부·경찰청·외교부·이파인·세움터 홈이 쿠키를 심고 같은 주소로 307 을 돌려
 * Node fetch(redirect:'follow')가 "redirect count exceeded" 로 죽었다. 브라우저는 쿠키를 들고 가니 한 번에 열린다.
 * 여기서는 그 서버를 흉내 내 쿠키를 들고 따라가는지 본다.
 */
import * as http from 'http';
import type { AddressInfo } from 'net';
import { fetchCtaPage, createCtaPageFetcher } from '../src/cta/page-fetcher';

function listen(handler: http.RequestListener): Promise<{ server: http.Server; base: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

describe('page-fetcher — 쿠키 리다이렉트 홈을 연다', () => {
  let server: http.Server;
  let base = '';
  let hits: string[] = [];

  beforeAll(async () => {
    const started = await listen((req, res) => {
      hits = [...hits, `${req.method} ${req.url} cookie=${req.headers.cookie || ''}`];
      // 관공서 흉내: 쿠키가 없으면 심고 같은 주소로 307, 있으면 홈
      if (req.url === '/' && !String(req.headers.cookie || '').includes('WMONID=abc')) {
        res.writeHead(307, { Location: '/', 'Set-Cookie': 'WMONID=abc; Path=/; HttpOnly' });
        res.end();
        return;
      }
      if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<title>국토교통부</title><body>홈</body>'); return; }
      if (req.url === '/old') { res.writeHead(301, { Location: '/new' }); res.end(); return; }
      if (req.url === '/new') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<title>새 주소</title>'); return; }
      if (req.url === '/loop') { res.writeHead(302, { Location: '/loop' }); res.end(); return; }
      if (req.url === '/missing') { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('<title>없는 페이지</title>'); return; }
      res.writeHead(500); res.end();
    });
    server = started.server;
    base = started.base;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  beforeEach(() => { hits = []; });

  test('쿠키를 심고 같은 주소로 307 하는 홈 — 두 번째 요청에 쿠키를 들고 가 홈을 받는다', async () => {
    const page = await fetchCtaPage(`${base}/`);
    expect(page.ok).toBe(true);
    expect(page.status).toBe(200);
    expect(page.html).toContain('국토교통부');
    expect(page.finalUrl).toBe(`${base}/`);
    expect(hits).toHaveLength(2);
    expect(hits[1]).toContain('cookie=WMONID=abc');
  });

  test('보통 리다이렉트는 최종 주소를 finalUrl 로 돌려준다', async () => {
    const page = await fetchCtaPage(`${base}/old`);
    expect(page.ok).toBe(true);
    expect(page.finalUrl).toBe(`${base}/new`);
    expect(page.html).toContain('새 주소');
  });

  test('정말 도는 리다이렉트는 던지지 않고 ok:false + errorCode 로 끝난다', async () => {
    const page = await fetchCtaPage(`${base}/loop`);
    expect(page.ok).toBe(false);
    expect(page.status).toBe(0);
    expect(page.errorCode).toContain('redirect count exceeded');
    expect(hits.length).toBeLessThanOrEqual(12);
  });

  test('4xx 는 기본으로 본문을 버리고, keepErrorBody 면 상태와 본문을 함께 준다(링크 검사기용)', async () => {
    const plain = await fetchCtaPage(`${base}/missing`);
    expect(plain).toMatchObject({ ok: false, status: 404, html: '' });
    const kept = await fetchCtaPage(`${base}/missing`, { keepErrorBody: true });
    expect(kept).toMatchObject({ ok: false, status: 404 });
    expect(kept.html).toContain('없는 페이지');
  });

  test('없는 호스트는 errorCode 에 원인을 남긴다 — 링크 검사기가 "죽음"을 가리는 데 쓴다', async () => {
    const page = await fetchCtaPage('http://no-such-host.invalid/');
    expect(page.ok).toBe(false);
    expect(page.errorCode).toBeTruthy();
  });

  test('createCtaPageFetcher 는 PageFetcher 꼴로 싼다 — maxChars 로 자른다', async () => {
    const fetchPage = createCtaPageFetcher({ maxChars: 10 });
    const page = await fetchPage(`${base}/`);
    expect(page.ok).toBe(true);
    expect(page.html.length).toBe(10);
  });
});
