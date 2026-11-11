import { updateWordPressPost } from '../src/wordpress/wordpress-posts';
import { buildSeoMetaPayload, WordPressAPI } from '../src/wordpress/wordpress-api';

jest.mock('../src/env', () => ({ loadEnvFromFile: jest.fn(() => ({})) }));

const SITE = 'https://example.invalid';
const PAYLOAD = { siteUrl: SITE, username: 'test-user', password: 'test-secret-pass' };
const BASIC = Buffer.from('test-user:test-secret-pass').toString('base64');

interface Call { url: string; method: string; body: any }

function reply(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data, text: async () => JSON.stringify(data), headers: { get: () => null } } as unknown as Response;
}

/** Routes the mocked fetch by URL; unknown routes answer 404 so a stray request fails loudly. */
function installFetch(route: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init: any = {}) => {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    const call = { url: String(input), method: String(init.method || 'GET'), body };
    calls.push(call);
    return route(call) ?? reply({ message: 'not found' }, false, 404);
  });
  return calls;
}

const isPostUpdate = (c: Call) => c.url.startsWith(`${SITE}/wp-json/wp/v2/posts/42`) && c.method === 'POST';
const isMetaPut = (c: Call) => c.url === `${SITE}/wp-json/wp/v2/posts/42` && c.method === 'PUT';
const isRoot = (c: Call) => c.url === `${SITE}/wp-json/`;

/** A site with Yoast: the root lists its namespace, the meta PUT echoes every key it was given back. */
function yoastSite(extra: (call: Call) => Response | undefined = () => undefined) {
  return (call: Call) => {
    if (isPostUpdate(call)) return reply({ id: 42, link: `${SITE}/p/`, modified_gmt: '2026-11-11T00:00:00' });
    if (isRoot(call)) return reply({ namespaces: ['wp/v2', 'yoast/v1'] });
    if (isMetaPut(call)) return reply({ id: 42, meta: call.body.meta });
    return extra(call);
  };
}

afterEach(() => jest.restoreAllMocks());

describe('수정발행 — 새 인자를 안 넘기면 예전과 같다', () => {
  it('요청 1번, 본문 키는 content·title 뿐, 결과에 warnings·applied 가 없다', async () => {
    const calls = installFetch(yoastSite());
    const result = await updateWordPressPost({ postId: 42, title: '새 제목', content: '<p>본문</p>', payload: PAYLOAD });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0]!.body).sort()).toEqual(['content', 'title']);
    expect(result).not.toHaveProperty('warnings');
    expect(result).not.toHaveProperty('applied');
  });

  it('제목이 바뀌어도 새 인자가 없으면 SEO 제목은 건드리지 않는다 (요청 1번)', async () => {
    const calls = installFetch(yoastSite());
    await updateWordPressPost({ postId: 42, title: '바뀐 제목', content: '<p>본문</p>', payload: PAYLOAD });
    expect(calls.some(isMetaPut)).toBe(false);
    expect(calls.some(isRoot)).toBe(false);
  });
});

describe('수정발행 — 요약(excerpt)', () => {
  it('excerpt 를 넘기면 같은 요청 본문의 excerpt 로 간다', async () => {
    const calls = installFetch(yoastSite());
    const result = await updateWordPressPost({ postId: 42, content: '<p>본문</p>', excerpt: '  새 요약입니다  ', payload: PAYLOAD });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.excerpt).toBe('새 요약입니다');
    expect(result.applied).toEqual(['excerpt']);
  });
});

describe('수정발행 — 태그', () => {
  it('이름 배열을 발행기와 같은 방식(검색 → 정확 일치 재사용 → 없으면 생성)으로 id 로 바꿔 보낸다', async () => {
    const calls = installFetch(yoastSite((call) => {
      if (call.url.includes('/tags?search=')) {
        return reply(decodeURIComponent(call.url).includes('청년도약계좌') ? [{ id: 7, name: '청년도약계좌' }, { id: 8, name: '청년도약계좌 후기' }] : []);
      }
      if (call.url === `${SITE}/wp-json/wp/v2/tags` && call.method === 'POST') return reply({ id: 99, name: call.body.name });
      return undefined;
    }));
    const result = await updateWordPressPost({ postId: 42, content: '<p>본문</p>', tags: ['청년도약계좌', '적금비교'], payload: PAYLOAD });
    expect(result.ok).toBe(true);
    const searches = calls.filter((c) => c.url.includes('/tags?search=')).map((c) => decodeURIComponent(c.url));
    expect(searches).toEqual([
      `${SITE}/wp-json/wp/v2/tags?search=청년도약계좌&per_page=100`,
      `${SITE}/wp-json/wp/v2/tags?search=적금비교&per_page=100`,
    ]);
    const created = calls.filter((c) => c.url.endsWith('/wp-json/wp/v2/tags') && c.method === 'POST');
    expect(created.map((c) => c.body)).toEqual([{ name: '적금비교', description: '' }]);
    expect(calls.find(isPostUpdate)!.body.tags).toEqual([7, 99]);
    expect(result.applied).toEqual(['tags']);
  });

  it('태그를 하나도 못 만들면 글 갱신은 성공, 태그는 건드리지 않고 warnings 로 알린다', async () => {
    const calls = installFetch(yoastSite((call) => {
      if (call.url.includes('/tags?search=')) return reply([]);
      return undefined; // tag creation answers 404
    }));
    const result = await updateWordPressPost({ postId: 42, content: '<p>본문</p>', tags: ['청년도약계좌'], payload: PAYLOAD });
    expect(result.ok).toBe(true);
    expect(calls.find(isPostUpdate)!.body).not.toHaveProperty('tags');
    expect(result.warnings?.join(' ')).toMatch(/태그/);
    expect(result.applied ?? []).not.toContain('tags');
  });

  it('빈 배열은 "태그 전부 지우기" 로 읽지 않는다 (아무것도 안 보냄)', async () => {
    const calls = installFetch(yoastSite());
    await updateWordPressPost({ postId: 42, content: '<p>본문</p>', tags: [], payload: PAYLOAD });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).not.toHaveProperty('tags');
  });
});

describe('수정발행 — SEO 제목·메타 설명', () => {
  it('seoTitle·metaDescription 을 넘기면 발행기와 같은 Yoast 키로, 넘긴 것만 저장한다', async () => {
    const calls = installFetch(yoastSite());
    const result = await updateWordPressPost({ postId: 42, content: '<p>본문</p>', seoTitle: '새 SEO 제목', metaDescription: '새 설명', payload: PAYLOAD });
    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty('warnings');
    const put = calls.find(isMetaPut)!;
    expect(put.body).toEqual({ meta: buildSeoMetaPayload(['yoast'], { title: '새 SEO 제목', description: '새 설명' }, { onlyProvided: true }) });
    expect(put.body.meta).toEqual({ _yoast_wpseo_title: '새 SEO 제목', _yoast_wpseo_metadesc: '새 설명' });
    expect(put.body.meta).not.toHaveProperty('_yoast_wpseo_focuskw');
    expect(result.applied).toEqual(['seoTitle', 'metaDescription']);
  });

  it('제목을 같이 보내고 seoTitle 을 안 주면 SEO 제목은 새 제목(이모지 뺀 것, 발행기와 같음)으로 맞춘다', async () => {
    const calls = installFetch(yoastSite());
    const result = await updateWordPressPost({ postId: 42, title: '🔥 새 제목  입니다', content: '<p>본문</p>', metaDescription: '설명', payload: PAYLOAD });
    expect(calls.find(isPostUpdate)!.body.title).toBe('🔥 새 제목  입니다');
    expect(calls.find(isMetaPut)!.body.meta._yoast_wpseo_title).toBe('새 제목 입니다');
    expect(result.applied).toEqual(['seoTitle', 'metaDescription']);
  });

  it('seoTitle 을 직접 주면 제목에서 만들지 않고 그 값을 쓴다', async () => {
    const calls = installFetch(yoastSite());
    await updateWordPressPost({ postId: 42, title: '글 제목', content: '<p>본문</p>', seoTitle: '검색용 제목', payload: PAYLOAD });
    expect(calls.find(isMetaPut)!.body.meta._yoast_wpseo_title).toBe('검색용 제목');
  });

  it('SEO 플러그인 감지가 실패하면 발행기처럼 모든 플러그인 키를 보낸다', async () => {
    const calls = installFetch((call) => {
      if (isPostUpdate(call)) return reply({ id: 42 });
      if (isRoot(call)) return reply({}, false, 500);
      if (isMetaPut(call)) return reply({ id: 42, meta: call.body.meta });
      return undefined;
    });
    await updateWordPressPost({ postId: 42, content: '<p>본문</p>', seoTitle: 'T', payload: PAYLOAD });
    const keys = Object.keys(calls.find(isMetaPut)!.body.meta).sort();
    expect(keys).toEqual(Object.keys(buildSeoMetaPayload([], { title: 'T' }, { onlyProvided: true })).sort());
    expect(keys).toEqual(expect.arrayContaining(['_yoast_wpseo_title', 'rank_math_title', '_aioseop_title']));
  });

  it('SEO 저장이 응답에 반영되지 않으면 글 갱신은 성공, 무엇이 안 됐는지 warnings 로 돌려준다', async () => {
    installFetch((call) => {
      if (isPostUpdate(call)) return reply({ id: 42, link: `${SITE}/p/` });
      if (isRoot(call)) return reply({ namespaces: ['yoast/v1'] });
      if (isMetaPut(call)) return reply({ id: 42, meta: {} }); // meta not exposed by REST
      return undefined;
    });
    const result = await updateWordPressPost({ postId: 42, content: '<p>본문</p>', seoTitle: '새 SEO 제목', payload: PAYLOAD });
    expect(result.ok).toBe(true);
    expect(result.url).toBe(`${SITE}/p/`);
    expect(result.warnings?.join(' ')).toMatch(/SEO/);
    expect(result.applied ?? []).not.toContain('seoTitle');
  });

  it('SEO 요청이 던져도 글 갱신 결과는 성공으로 남고 warnings 만 붙는다', async () => {
    installFetch((call) => {
      if (isPostUpdate(call)) return reply({ id: 42 });
      if (isRoot(call)) return reply({ namespaces: ['yoast/v1'] });
      if (isMetaPut(call)) throw new Error('socket hang up');
      return undefined;
    });
    const result = await updateWordPressPost({ postId: 42, content: '<p>본문</p>', seoTitle: 'T', payload: PAYLOAD });
    expect(result.ok).toBe(true);
    expect(result.warnings?.join(' ')).toMatch(/SEO/);
  });
});

describe('수정발행 — 자격증명은 결과·로그에 없다', () => {
  it('성공·부분 실패 모두 결과와 콘솔 출력에 비밀번호·Authorization 값이 없다', async () => {
    const logs: string[] = [];
    for (const name of ['log', 'warn', 'error'] as const) {
      jest.spyOn(console, name).mockImplementation((...args: unknown[]) => { logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); });
    }
    installFetch((call) => {
      if (isPostUpdate(call)) return reply({ id: 42 });
      if (isRoot(call)) return reply({ namespaces: ['yoast/v1'] });
      if (isMetaPut(call)) return reply({ id: 42, meta: {} });
      if (call.url.includes('/tags?search=')) return reply([]);
      return undefined;
    });
    const result = await updateWordPressPost({
      postId: 42, title: '제목', content: '<p>본문</p>', excerpt: '요약', tags: ['청년도약계좌'], metaDescription: '설명', payload: PAYLOAD,
    });
    const dump = JSON.stringify(result) + logs.join('\n');
    expect(result.warnings?.length).toBeGreaterThan(0);
    expect(dump).not.toContain('test-secret-pass');
    expect(dump).not.toContain(BASIC);
    expect(dump).not.toMatch(/Basic\s+[A-Za-z0-9+/=]{8,}/);
  });
});

describe('buildSeoMetaPayload — 발행기(updateSeoMeta)와 같은 키', () => {
  it('기본 호출은 예전 updateSeoMeta 가 보내던 그대로(빈 값도 빈 문자열로 보냄)', () => {
    expect(buildSeoMetaPayload(['yoast'], { title: 'T' })).toEqual({ _yoast_wpseo_title: 'T', _yoast_wpseo_metadesc: '', _yoast_wpseo_focuskw: '' });
    expect(Object.keys(buildSeoMetaPayload([], { title: 'T' }))).toHaveLength(9);
  });

  it('WordPressAPI.updateSeoMeta 가 실제로 보내는 meta 와 같다 (리팩터 전후 동일)', async () => {
    const seo = { title: '제목', description: '설명', focusKeyword: '키워드' };
    let sent: any;
    jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init: any = {}) => {
      const url = String(input);
      if (url.endsWith('/wp-json/')) return reply({ namespaces: ['yoast/v1'] });
      sent = JSON.parse(init.body);
      return reply({ meta: sent.meta });
    });
    const api = new WordPressAPI({ siteUrl: 'https://same-as-publisher.invalid', username: 'u', password: 'p' });
    const out = await api.updateSeoMeta(5, seo);
    expect(out.success).toBe(true);
    expect(sent.meta).toEqual(buildSeoMetaPayload(['yoast'], seo));
  });
});
