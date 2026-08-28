/**
 * v3.8.575 — 이미 쓰는 네이버 키로 근거를 넓히고 낡음을 본다
 *
 * 사장님: "네이버 api를 쓰게만들면되자나"
 *
 * 그라운딩·퍼플렉시티는 비싸서 못 쓴다. **무료에 가깝게 쓰게 하는 것**이 차별점이고,
 * 네이버 검색 키는 CTA 목적지를 찾을 때 이미 쓰고 있어 추가 비용이 사실상 없다.
 *
 * 두 가지를 한다:
 *   ① 근거 장부를 넓힌다 — 장부가 얇으면 fact-guard 가 **맞는 문장까지 지운다**
 *      (실측: 62자 문단이 24자가 됐다)
 *   ② 낡았는지 본다 — "2026년" 을 제목에 박고 2026년 변경을 확인 안 한 글이 있었다
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  fetchGrounding as fetchGroundingReal,
  fetchGroundingSnippets as fetchGroundingSnippetsReal,
  describeGrounding, checkFreshness, describeFreshness,
} from '../src/core/final/naver-grounding';

/**
 * v3.8.580 부터 앞쪽 몇 건은 **본문을 긁는다.** 테스트가 진짜 주소를 때리면
 * 느려지고 남의 서버에 폐를 끼친다. 그래서 본문 수집기를 꺼 두고 부른다 —
 * 본문 동작 자체는 아래 ⑨ 에서 가짜 수집기를 주입해 따로 검증한다.
 */
const noBody = async () => null;
const fetchGrounding = (keyword: string, search: any, options: any = {}) =>
  fetchGroundingReal(keyword, search, { fetchBody: noBody, ...options });
const fetchGroundingSnippets = (keyword: string, search: any, options: any = {}) =>
  fetchGroundingSnippetsReal(keyword, search, { fetchBody: noBody, ...options });

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 네트워크를 타지 않는다 — 검색 함수를 주입받게 만든 이유다 */
const fakeSearch = (items: any[], ok = true) => jest.fn().mockResolvedValue({ ok, items });
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toUTCString();

/** news 와 webkr 에 각각 다르게 답하는 가짜 검색 */
const splitSearch = (news: any[], web: any[]) =>
  jest.fn().mockImplementation((type: string) =>
    Promise.resolve({ ok: true, items: type === 'news' ? news : web }));

/** 같은 개념어를 n개 문서가 되풀이하게 만든다 */
const repeat = (term: string, n: number, pubDate?: string) =>
  Array.from({ length: n }, (_, i) => ({
    title: `${term} 관련 소식 ${i + 1}`,
    description: `${term} 이 어떻게 달라지는지 살펴봅니다.`,
    ...(pubDate ? { pubDate } : {}),
  }));

describe('① 근거 장부 넓히기', () => {
  test('제목과 요약을 모아 온다', async () => {
    const search = fakeSearch([
      { title: '<b>청년월세</b> 지원', description: '월 최대 20만원씩 24개월 지원합니다.' },
      { title: '신청 기간', description: '2026년 3월 31일까지 접수합니다.' },
    ]);
    const out = await fetchGroundingSnippets('청년월세 지원', search as any);
    expect(out).toContain('월 최대 20만원');
    expect(out).toContain('2026년 3월 31일');
    expect(out).not.toContain('<b>');       // 태그는 지운다
  });

  test('검색이 실패하면 빈 문자열 — 예전과 똑같이 동작한다', async () => {
    expect(await fetchGroundingSnippets('무엇', fakeSearch([], false) as any)).toBe('');
    expect(await fetchGroundingSnippets('무엇', (() => { throw new Error('망함'); }) as any)).toBe('');
  });

  test('키워드가 비면 검색하지 않는다 (헛돈·헛시간 방지)', async () => {
    const search = fakeSearch([]);
    expect(await fetchGroundingSnippets('', search as any)).toBe('');
    expect(search).not.toHaveBeenCalled();
  });
});

/**
 * ② 낡았는지 보기 — **낱말 목록이 아니라 증거로** 판단한다.
 *
 * 처음엔 제목에 `개편|시행|폐지` 가 있는지 봤는데 실제 헤드라인이
 * "22조원 비급여, 관리급여로 잡을 수 있나…국감서 실효성 점검" 이라 그냥 지나갔다.
 * 그래서 "여러 검색 결과가 되풀이하는데 본문엔 한 번도 없는 개념"을 찾는 방식으로 바꿨다.
 */
describe('② 낡았는지 보기', () => {
  const body = '<p>' + '실손보험 세대별 자기부담금과 한도를 정리했습니다. '.repeat(30) + '</p>';

  test('검색이 되풀이하는데 본문에 없는 개념을 잡는다', async () => {
    const search = splitSearch(repeat('관리급여', 3, daysAgo(10)), repeat('관리급여', 3));
    const w = await checkFreshness({ keyword: '실손보험', articleText: body, naverSearch: search as any });
    expect(w).not.toBeNull();
    expect(w!.headlines.join(' ')).toContain('관리급여');
    expect(describeFreshness(w)).toContain('최신성 주의');
  });

  test('본문이 이미 다루면 조용히 넘어간다', async () => {
    const covered = '<p>' + '관리급여 전환과 실손보험 세대별 한도를 정리했습니다. '.repeat(30) + '</p>';
    const search = splitSearch(repeat('관리급여', 3, daysAgo(10)), repeat('관리급여', 3));
    expect(await checkFreshness({ keyword: '실손보험', articleText: covered, naverSearch: search as any })).toBeNull();
  });

  /** 한 문서에만 나온 말로 겁주면 경고가 무시당한다 */
  test('한두 문서에만 나온 말은 세지 않는다', async () => {
    const search = splitSearch([], repeat('관리급여', 2));
    expect(await checkFreshness({ keyword: '실손보험', articleText: body, naverSearch: search as any })).toBeNull();
  });

  test('오래된 뉴스는 세지 않는다 (웹문서가 없으면 근거가 모자란다)', async () => {
    const search = splitSearch(repeat('관리급여', 5, daysAgo(400)), []);
    expect(await checkFreshness({ keyword: '실손보험', articleText: body, naverSearch: search as any })).toBeNull();
  });

  test('검색어 자신은 "놓친 개념"이 아니다', async () => {
    const search = splitSearch([], repeat('실손보험', 5));
    const w = await checkFreshness({ keyword: '실손보험', articleText: body, naverSearch: search as any });
    expect((w?.headlines || []).join(' ')).not.toContain('실손보험');
  });

  test('짧은 글·빈 값·검색 실패에 던지지 않는다', async () => {
    const search = splitSearch(repeat('관리급여', 5, daysAgo(1)), repeat('관리급여', 5));
    expect(await checkFreshness({ keyword: '실손', articleText: '짧음', naverSearch: search as any })).toBeNull();
    expect(await checkFreshness({ keyword: '', articleText: body, naverSearch: search as any })).toBeNull();
    await expect(checkFreshness({
      keyword: '실손', articleText: body, naverSearch: (() => { throw new Error('망함'); }) as any,
    })).resolves.toBeNull();
  });

  test('아무 문제 없으면 그렇게 말한다', () => {
    expect(describeFreshness(null)).toContain('최신성 확인');
  });
});

describe('③ 배선 — 발행 경로에서 실제로 쓴다', () => {
  const orch = read('src/core/final/orchestration.ts');

  test('import 하고 부른다', () => {
    expect(orch).toContain("from './naver-grounding'");
    expect(orch).toContain('fetchGrounding(keyword, naverSearch');
    expect(orch).toContain('checkFreshness({');
  });

  /** 넓힌 근거가 장부에 안 들어가면 만든 의미가 없다 — 이 저장소의 단골 실수 */
  test('넓힌 근거가 장부(buildGroundingReference)에 실제로 들어간다', () => {
    expect(orch).toContain('factContext: [factEvidence.context, naverGrounding].filter(Boolean).join');
  });

  test('근거 넓히기는 fact-guard 보다 먼저다 (뒤면 소용없다)', () => {
    const ground = orch.indexOf('fetchGrounding(');
    const fact = orch.indexOf('await guardFacts(');
    expect(ground).toBeGreaterThan(-1);
    expect(ground).toBeLessThan(fact);
  });

  test('최신성은 본문이 완성된 뒤에 본다', () => {
    expect(orch.indexOf('checkFreshness({')).toBeGreaterThan(orch.indexOf('await guardFacts('));
  });

  test('발행을 막지 않는다', () => {
    for (const marker of ['fetchGrounding(', 'checkFreshness({']) {
      const at = orch.indexOf(marker);
      const block = orch.slice(at - 300, at + 600);
      expect(block).toContain('try');
      expect(block).toContain('catch');
      expect(block).not.toContain('throw new Error');
    }
  });
});

/**
 * ④ 출처 우선순위 — 배제가 아니라 **순서**다
 *
 * 사장님: "블로그로 하면 그 블로그가 잘못된 정보면 그대로 통과가 되어버리니까"
 * → 근거 장부는 fact-guard 가 "이 수치는 자료에 있다"고 판단하는 근거라,
 *   검증 안 된 글이 들어가면 틀린 수치를 보증해 주는 꼴이 된다.
 *
 * v3.8.581 정정 — 사장님: "블로그를 배제하라는 게 아니야. 나보다 먼저 글을 올려서
 *   상위노출이 되어 있는 글이 있어. 그 글들은 정보가 정확하고 신뢰되니 상위노출된 게 아니니"
 * → 맞다. 그래서 블로그는 **정확도순 상위 몇 건만** 따로 받아 맨 뒤에 놓는다.
 *   여기서 확인하는 건 "블로그가 웹문서 갈래에 섞이지 않는다"는 것이다 —
 *   섞이면 순위를 알 수 없어 상위인지 아닌지 구분이 안 되기 때문이다.
 */
describe('④ 출처 우선순위 — 뉴스·기관이 먼저다', () => {
  const NEWS = [{ title: '관리급여 전환 시행', description: '7월부터 적용됩니다.', link: 'https://news.co.kr/1' }];
  const WEB = [
    { title: '기관 안내', description: '공식 안내입니다.', link: 'https://www.nhis.or.kr/a' },
    { title: '블로그 글', description: '제가 겪은 이야기입니다.', link: 'https://blog.naver.com/me/1' },
    { title: '티스토리 글', description: '정리해봤어요.', link: 'https://someone.tistory.com/2' },
    { title: '카페 글', description: '카페 후기입니다.', link: 'https://cafe.naver.com/x/3' },
  ];
  const search = () => jest.fn().mockImplementation((type: string) =>
    Promise.resolve({ ok: true, items: type === 'news' ? NEWS : WEB }));

  test('블로그·티스토리·카페는 웹문서 갈래([웹])에 섞이지 않는다', async () => {
    const out = await fetchGroundingSnippets('실손보험', search() as any);
    expect(out).toContain('기관 안내');
    expect(out).not.toContain('블로그 글');
    expect(out).not.toContain('티스토리 글');
    expect(out).not.toContain('카페 글');
  });

  test('뉴스가 웹문서보다 앞에 온다 (언론사가 먼저다)', async () => {
    const out = await fetchGroundingSnippets('실손보험', search() as any);
    expect(out.indexOf('[뉴스]')).toBeGreaterThan(-1);
    expect(out.indexOf('[뉴스]')).toBeLessThan(out.indexOf('[웹]'));
  });

  test('출처를 표시해 둔다 — 나중에 무엇을 믿었는지 알 수 있게', async () => {
    const out = await fetchGroundingSnippets('실손보험', search() as any);
    expect(out).toMatch(/\[뉴스\]/);
    expect(out).toMatch(/\[웹\]/);
  });

  /**
   * v3.8.581 정정 — 예전엔 "블로그 검색을 아예 부르지 않는다" 였다. 과했다.
   * 사장님: "나보다 먼저 글을 올려서 상위노출이 되어 있는 글이 있어.
   *          그 글들은 정보가 정확하고 신뢰되니 상위노출된 게 아니니"
   * 이제 부른다. 다만 **정확도순**으로 부르고(=상위노출 순), 상위 몇 건만 쓴다.
   */
  test('블로그는 정확도순으로 부른다 (최신순이면 아무 새 글이 1등이 된다)', async () => {
    const spy = search();
    await fetchGroundingSnippets('실손보험', spy as any);
    const blogCall = spy.mock.calls.find((c: any[]) => c[0] === 'blog');
    expect(blogCall).toBeDefined();
    expect(blogCall?.[1]?.sort).toBeUndefined();   // sort 없음 = 정확도순
  });

  test('뉴스는 최신순으로 요청한다', async () => {
    const spy = search();
    await fetchGroundingSnippets('실손보험', spy as any);
    const newsCall = spy.mock.calls.find((c: any[]) => c[0] === 'news');
    expect(newsCall?.[1]).toMatchObject({ sort: 'date' });
  });

  test('한쪽이 실패해도 나머지로 만든다', async () => {
    const half = jest.fn().mockImplementation((type: string) =>
      type === 'news' ? Promise.reject(new Error('망함')) : Promise.resolve({ ok: true, items: WEB }));
    const out = await fetchGroundingSnippets('실손보험', half as any);
    expect(out).toContain('기관 안내');
  });
});

/**
 * ⑤ 본 크롤링도 최신 기사 먼저 — 사장님: "크롤링할 때도 우선순위를 최신 기사를 먼저"
 *
 * 근거 장부는 12,000자에서 **잘린다**. 예전엔 블로그가 맨 앞이라 앞자리를 다 차지하고
 * 뉴스·기관 문서가 잘려나갔다 — 틀린 블로그가 fact-guard 의 근거가 되어 버렸다.
 */
describe('⑤ 크롤 순서 — 뉴스가 블로그보다 앞', () => {
  const orch = read('src/core/final/orchestration.ts');

  test('블로그를 맨 앞에 넣던 코드가 사라졌다', () => {
    expect(orch).not.toContain('crawledFromAPI.push(...blogResults, ...kinResults, ...newsResults');
  });

  test('뉴스 → 웹문서 → 블로그 순으로 담는다', () => {
    expect(orch).toContain('crawledFromAPI.push(...newsResults, ...webResults, ...blogResults, ...kinResults, ...suggestResults)');
  });

  test('왜 그렇게 했는지 코드에 남아 있다 (장부가 잘린다는 사실)', () => {
    const at = orch.indexOf('crawledFromAPI.push(...newsResults');
    const block = orch.slice(at - 900, at);
    expect(block).toContain('잘린');
    expect(block).toContain('우선순위');
  });

  test('수집 자체는 그대로다 — 순서만 바꿨지 소스를 빼지 않았다', () => {
    for (const src of ['blogResults', 'kinResults', 'newsResults', 'webResults', 'suggestResults']) {
      expect(orch).toContain(src);
    }
  });
});

/**
 * ⑥ 기사가 없으면? — 사장님 질문
 *
 * 지역 소식·틈새 주제·오래된 제도는 뉴스가 아예 없을 수 있다.
 * **조용히 넘어가면 안 된다** — 근거 장부가 얇으면 fact-guard 가 맞는 문장까지 지운다.
 * 그렇다고 블로그를 대신 넣지도 않는다 — 틀린 블로그는 틀린 수치를 보증한다.
 * 그래서 **없으면 없다고 말한다.**
 */
describe('⑥ 근거가 없을 때', () => {
  const OFFICIAL = { title: '기관 안내', description: '공식 안내입니다.', link: 'https://www.nhis.or.kr/a' };
  const BLOG = { title: '블로그 글', description: '제가 겪은 이야기입니다.', link: 'https://blog.naver.com/me/1' };
  const NEWS = { title: '제도 변경', description: '7월부터 적용됩니다.', link: 'https://news.co.kr/1' };
  /** v3.8.581: 블로그가 별도 갈래가 됐으므로 갈래를 나눠 답한다 */
  const src = (news: any[], web: any[], blog: any[] = []) =>
    jest.fn().mockImplementation((t: string) => Promise.resolve({
      ok: true,
      items: t === 'news' ? news : t === 'blog' ? blog : web,
    }));

  test('아무것도 못 찾으면 사람이 확인하라고 말한다', async () => {
    const g = await fetchGrounding('아주 희귀한 주제', src([], []) as any);
    expect(g.newsCount + g.webCount).toBe(0);
    expect(describeGrounding(g)).toContain('사람이 확인');
  });

  /**
   * v3.8.581 정정 — 예전엔 "블로그만 있으면 근거가 0" 이었다.
   * 상위노출 글은 그 자체가 검증의 대용물이므로 이제 근거로 쓴다.
   * 다만 웹문서 갈래(`[웹]`)가 아니라 블로그 갈래(`[블로그]`)로, 맨 뒤에 들어간다.
   */
  test('블로그밖에 없어도 상위 글은 근거로 쓴다', async () => {
    // v3.8.581: 주제 일치까지 통과해야 받는다 — 제목이 검색어를 담고 있어야 한다
    const g = await fetchGrounding('틈새 주제', src([], [], [
      { ...BLOG, title: '틈새 주제 정리', link: 'https://blog.naver.com/me/1' },
      { ...BLOG, title: '틈새 주제 후기', link: 'https://blog.naver.com/me/2' },
    ]) as any);
    expect(g.blogCount).toBeGreaterThan(0);
    expect(g.text).toContain('[블로그]');
    expect(describeGrounding(g)).toContain('상위 블로그');
  });

  test('기관 문서만 있으면 최신 기사가 없다고 따로 알린다', async () => {
    const g = await fetchGrounding('오래된 제도', src([], [OFFICIAL]) as any);
    expect(g.newsCount).toBe(0);
    expect(g.webCount).toBe(1);
    expect(describeGrounding(g)).toContain('최신 기사가 없습니다');
  });

  test('뉴스가 있으면 경고 없이 건수만 남긴다', async () => {
    const g = await fetchGrounding('흔한 주제', src([NEWS], [OFFICIAL]) as any);
    const msg = describeGrounding(g);
    expect(msg).toContain('뉴스 1건');
    expect(msg).not.toContain('⚠️');
  });

  /** 순위를 믿는 만큼만 받는다 — 상위 3건까지, 나머지는 세어만 둔다 */
  test('블로그는 상위 몇 건만 쓰고 나머지는 세어 둔다', async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      ...BLOG, title: `블로그 글 ${i}`, link: `https://blog.naver.com/me/${i}`,
    }));
    const g = await fetchGrounding('주제', src([], [OFFICIAL], many) as any);
    expect(g.webCount).toBe(1);                 // 기관 문서는 웹 갈래 그대로
    expect(g.blogCount).toBeLessThanOrEqual(3);
    expect(g.blogCount + g.skippedBlogs).toBe(6);
  });

  test('얇은 껍데기(fetchGroundingSnippets)는 예전처럼 글자만 준다', async () => {
    expect(typeof await fetchGroundingSnippets('주제', src([NEWS], []) as any)).toBe('string');
  });

  test('발행 경로가 근거 상태를 항상 남기고, 부족하면 사용자에게 알린다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain('describeGrounding(g)');
    expect(orch).toContain('[GROUNDING]');
    expect(orch).toContain('g.newsCount + g.webCount === 0 || g.newsCount === 0');
  });
});

/**
 * ⑦ 뉴스가 없으면 공공기관 원문을 찾는다 (v3.8.579)
 *
 * 사장님: "뉴스가없다면 공식사이트의 공식정보를 참고하면되자나 퍼플렉은 비용이드니까"
 *
 * 맞는 말이고, 제도·수수료 주제에서는 오히려 기관 원문이 기사보다 정확하다 —
 * 기사는 요약하다 틀리지만 고시·안내문은 원문이다.
 *
 * 네이버 검색에는 site: 한정이 없어서 **검색어로 유도하고 도메인으로 확정**한다.
 * 말만 그럴듯한 민간 페이지는 도메인에서 걸러진다.
 */
describe('⑦ 뉴스가 없으면 공공기관 원문으로 메운다', () => {


  /** 호출 기록을 남기는 가짜 검색기 */
  function fakeSearch(plan: { news?: any[]; webkr?: (q: string) => any[] }) {
    const calls: Array<{ type: string; query: string }> = [];
    const fn = async (type: string, params: any) => {
      calls.push({ type, query: String(params?.query || '') });
      if (type === 'news') return { ok: true, items: plan.news || [] };
      return { ok: true, items: plan.webkr ? plan.webkr(String(params?.query || '')) : [] };
    };
    return { fn, calls };
  }

  const item = (link: string, title: string) =>
    ({ link, title, description: `${title} 에 대한 상세한 기준과 금액을 안내합니다` });

  test('뉴스가 0건이면 기관 페이지를 따로 찾아 근거로 쓴다', async () => {
    const { fn, calls } = fakeSearch({
      news: [],
      webkr: (q) => (q.includes('공식 안내') || q.includes('제도 기준')
        ? [item('https://www.gov.kr/portal/guide/1', '지원금 신청 기준')]
        : []),
    });
    const g = await fetchGrounding('틈새 제도', fn);
    expect(g.officialCount).toBeGreaterThan(0);
    expect(g.text).toContain('[공식]');
    // 검색어로 유도한다
    expect(calls.some((c) => c.type === 'webkr' && c.query.includes('공식 안내'))).toBe(true);
  });

  test('기관이 아닌 도메인은 검색어가 맞아도 안 받는다 (도메인으로 확정한다)', async () => {
    const { fn } = fakeSearch({
      news: [],
      webkr: (q) => (q.includes('공식 안내')
        ? [item('https://sabotage-law.com/guide', '공식 안내 지원금 기준')]
        : []),
    });
    const g = await fetchGrounding('틈새 제도', fn);
    expect(g.officialCount).toBe(0);
  });

  test('블로그는 여기서도 안 받는다', async () => {
    const { fn } = fakeSearch({
      news: [],
      webkr: (q) => (q.includes('공식 안내')
        ? [item('https://blog.naver.com/x/1', '공식 안내 정리해봤어요')]
        : []),
    });
    expect((await fetchGrounding('틈새 제도', fn)).officialCount).toBe(0);
  });

  test('같은 주소는 두 번 넣지 않는다', async () => {
    const dup = item('https://www.gov.kr/portal/guide/1', '지원금 신청 기준');
    const { fn } = fakeSearch({ news: [], webkr: () => [dup] });
    const g = await fetchGrounding('틈새 제도', fn);
    // 일반 웹문서로 이미 들어왔으므로 공식 단계에서 또 담지 않는다
    expect(g.officialCount).toBe(0);
    expect(g.webCount).toBe(1);
  });

  test('뉴스가 있으면 호출을 늘리지 않는다 (기관 검색을 안 한다)', async () => {
    const { fn, calls } = fakeSearch({
      news: [item('https://n.news.naver.com/1', '수수료 면제 기준 개편')],
      webkr: () => [],
    });
    const g = await fetchGrounding('제도', fn);
    expect(g.newsCount).toBe(1);
    expect(g.officialCount).toBe(0);
    expect(calls.filter((c) => c.type === 'webkr').length).toBe(1); // 기본 1회뿐
  });

  test('기관 원문을 찾았으면 "기사 없음" 경고를 남기지 않는다', () => {
    const withOfficial = describeGrounding({
      text: 'x', newsCount: 0, webCount: 0, officialCount: 3, blogCount: 0, skippedBlogs: 0,
    });
    expect(withOfficial).toContain('공공기관 원문 3건');
    expect(withOfficial).not.toContain('⚠️');

    const without = describeGrounding({
      text: 'x', newsCount: 0, webCount: 2, officialCount: 0, blogCount: 0, skippedBlogs: 0,
    });
    expect(without).toContain('⚠️ 최신 기사가 없습니다');
  });

  test('검색이 통째로 실패해도 던지지 않는다', async () => {
    const boom = async () => { throw new Error('network'); };
    const g = await fetchGrounding('제도', boom as any);
    expect(g.officialCount).toBe(0);
    expect(g.text).toBe('');
  });
});

/**
 * ⑧ 낡은 고시가 장부를 차지하지 않는다 (v3.8.579)
 *
 * 실측(어린이집 보육교직원 겸직)에서 기관 원문 13건 안에 2012·2016·2017년 안내문이
 * 섞여 들어왔다. 그대로 두면 fact-guard 가 낡은 금액·기준을 "자료에 있다"며
 * 보증해 준다 — 블로그를 배제한 이유와 똑같은 병이다.
 *
 * 버리지는 않는다(제도 원문은 오래돼도 유효한 경우가 많고, 버리면 틈새 주제에서
 * 근거가 다시 0이 된다). 최신 것부터 담고 오래된 건 뒤로 민다.
 */
describe('⑧ 기관 원문은 최신부터 담는다', () => {

  const year = new Date().getFullYear();

  function officialSearch(titles: string[]) {
    return async (type: string, params: any) => {
      if (type === 'news') return { ok: true, items: [] };
      const q = String(params?.query || '');
      if (!q.includes('공식 안내')) return { ok: true, items: [] };
      return {
        ok: true,
        items: titles.map((t, i) => ({
          link: `https://www.gov.kr/portal/doc/${i}`,
          title: t,
          description: '지급 기준과 금액을 상세히 안내하는 문서입니다',
        })),
      };
    };
  }

  test('오래된 문서가 최신 문서보다 앞에 오지 않는다', async () => {
    const g = await fetchGrounding('제도', officialSearch([
      '2012년도 보육사업안내',
      `${year}년도 보육사업안내`,
    ]));
    expect(g.text.indexOf(`${year}년도`)).toBeLessThan(g.text.indexOf('2012년도'));
  });

  test('오래됐다고 버리지는 않는다 (틈새 주제에서 근거가 0이 되면 안 된다)', async () => {
    const g = await fetchGrounding('제도', officialSearch(['2012년도 보육사업안내']));
    expect(g.officialCount).toBe(1);
  });

  test('연도 없는 상시 안내는 낡은 문서보다 앞에 온다', async () => {
    const g = await fetchGrounding('제도', officialSearch([
      '2012년도 보육사업안내',
      '보육통합정보시스템 이용 안내',
    ]));
    expect(g.text.indexOf('보육통합정보시스템')).toBeLessThan(g.text.indexOf('2012년도'));
  });

  test('기관 원문이 장부를 독점하지 않는다 (상한이 있다)', async () => {
    const many = Array.from({ length: 25 }, (_, i) => `${year}년도 안내문 ${i}`);
    const g = await fetchGrounding('제도', officialSearch(many));
    expect(g.officialCount).toBeLessThanOrEqual(10);
    expect(g.officialCount).toBeGreaterThan(0);
  });
});

/**
 * ⑨ 스니펫이 아니라 본문을 쓴다 (v3.8.580)
 *
 * 사장님: "결과를 스니펫말고 본문을 긁게해야하는거아니니?"
 *
 * 맞다. 요약 120자에는 표·조건 목록이 통째로 빠진다.
 * 실측(서울시 보육포털): 스니펫 122자 → 본문 2,017자.
 *
 * 다만 전부 긁지는 않는다 — 장부는 그대로 프롬프트에 실려 토큰 값이고,
 * 기관 검색 결과의 대부분은 첨부파일이라 애초에 못 긁는다(실측 18건 중 15건).
 */
describe('⑨ 본문을 긁어 근거를 두껍게 만든다', () => {
  const news = (n: number) => Array.from({ length: n }, (_, i) => ({
    title: `기사 ${i}`,
    description: '요약은 짧습니다 여기까지가 전부입니다',
    link: `https://news.example.com/${i}`,
    originallink: `https://press.example.com/${i}`,
  }));

  const search = (items: any[]) => (async (type: string) =>
    ({ ok: true, items: type === 'news' ? items : [] })) as any;

  test('본문을 구하면 스니펫 대신 본문이 들어간다', async () => {
    const g = await fetchGroundingReal('주제', search(news(1)), {
      fetchBody: async () => '실제 본문입니다. 지원 금액은 월 30만원이고 신청은 3월 31일까지입니다.',
    });
    expect(g.text).toContain('월 30만원');
    expect(g.text).not.toContain('여기까지가 전부입니다');
  });

  test('언론사 원문 주소(originallink)를 먼저 쓴다', async () => {
    const asked: string[] = [];
    await fetchGroundingReal('주제', search(news(1)), {
      fetchBody: async (url: string) => { asked.push(url); return null; },
    });
    expect(asked[0]).toBe('https://press.example.com/0');
  });

  test('본문을 못 구하면 스니펫이 그대로 남는다 (나빠지지 않는다)', async () => {
    const g = await fetchGroundingReal('주제', search(news(1)), { fetchBody: async () => null });
    expect(g.text).toContain('여기까지가 전부입니다');
    expect(g.newsCount).toBe(1);
  });

  test('본문 수집이 던져도 발행을 막지 않는다', async () => {
    const g = await fetchGroundingReal('주제', search(news(2)), {
      fetchBody: async () => { throw new Error('타임아웃'); },
    });
    expect(g.newsCount).toBe(2);
    expect(g.text).toContain('기사 0');
  });

  test('앞쪽 몇 건만 긁는다 (지연·토큰 예산)', async () => {
    let calls = 0;
    const g = await fetchGroundingReal('주제', search(news(10)), {
      fetchBody: async () => { calls += 1; return '본문'; },
    });
    expect(calls).toBeLessThanOrEqual(6);
    expect(g.newsCount).toBe(10);   // 긁지 않은 건도 스니펫으로 남는다
  });

  test('주소가 없으면 요청하지 않는다', async () => {
    let calls = 0;
    const noLink = [{ title: '제목', description: '설명이 충분히 길게 들어 있습니다' }];
    await fetchGroundingReal('주제', search(noLink), {
      fetchBody: async () => { calls += 1; return '본문'; },
    });
    expect(calls).toBe(0);
  });
});

/**
 * ⑩ 첨부파일은 긁지 않는다 — 바이너리가 장부에 들어가면 없느니만 못하다
 *
 * 실측: `moe.go.kr/boardCnts/fileDown.do` 를 그냥 fetch 하면 평문 374만 자가 나온다.
 * 그건 본문이 아니라 hwp/pdf 바이너리다.
 */
describe('⑩ 첨부파일 주소는 요청조차 하지 않는다', () => {
  const { looksLikeFileUrl, extractOfficialPageBody } = require('../src/core/crawlers/official-page-body');

  test('확장자로 거른다', () => {
    for (const u of [
      'https://www.daejeon.go.kr/data/2026_data_02.pdf',
      'https://x.go.kr/a.hwp', 'https://x.go.kr/a.xlsx', 'https://x.go.kr/a.zip',
    ]) expect(looksLikeFileUrl(u)).toBe(true);
  });

  test('확장자가 없는 내려받기 주소도 거른다 (실측한 것들)', () => {
    for (const u of [
      'https://www.moe.go.kr/boardCnts/fileDown.do?fileSeq=3653fe23',
      'https://www.easylaw.go.kr/CSP/FlDownload.laf?flSeq=170880134',
      'https://busan.childcare.go.kr/ccef/community/common/Download.do',
      'https://www.ooh.or.kr/file/down.do?path=info&fseq=6854',
    ]) expect(looksLikeFileUrl(u)).toBe(true);
  });

  test('보통 페이지는 통과시킨다 (과잉 차단 금지)', () => {
    for (const u of [
      'https://iseoul.seoul.go.kr/portal/info/content.do?page=0611',
      'https://www.gov.kr/portal/service/serviceInfo/PTR000050265',
    ]) expect(looksLikeFileUrl(u)).toBe(false);
  });

  test('메뉴만 있는 페이지는 본문으로 치지 않는다', () => {
    const shell = '<div id="contents">본문바로가기 주메뉴바로가기 로그인 회원가입</div>';
    expect(extractOfficialPageBody(shell)).toBeNull();
  });

  test('본문이 있으면 뽑고 껍데기 문구는 지운다', () => {
    const html = `<div id="contents">본문바로가기 주메뉴바로가기 ${'지원 대상과 금액 기준을 안내합니다. '.repeat(20)}</div>`;
    const body = extractOfficialPageBody(html, 500);
    expect(body).not.toBeNull();
    expect(body!.text).not.toContain('본문바로가기');
    expect(body!.text).toContain('지원 대상과 금액 기준');
  });

  test('깨진 값에 던지지 않는다', () => {
    for (const bad of ['', null, undefined, '<div>']) {
      expect(() => extractOfficialPageBody(bad as any)).not.toThrow();
    }
  });
});

/**
 * ⑪ 예산은 긁을 수 있는 것에만 쓴다 (v3.8.580 실측에서 잡은 실수)
 *
 * 처음엔 "앞에서부터 6건"을 긁었다. 그런데 기관 검색의 최신순 상위 10건이
 * 전부 첨부파일(.hwp·fileDown)이라 예산이 그대로 소진됐고, 정작 본문이 2,017자
 * 나오는 서울시 보육포털 페이지는 스니펫으로 남았다.
 * 실측 장부: 기관 케이스가 2,861자 그대로 — 본문 0건.
 */
describe('⑪ 첨부파일에 본문 예산을 낭비하지 않는다', () => {
  const mixed = [
    { title: '안내 1', description: '설명이 충분히 길게 들어 있습니다', link: 'https://a.go.kr/f1.hwp' },
    { title: '안내 2', description: '설명이 충분히 길게 들어 있습니다', link: 'https://a.go.kr/fileDown.do?seq=2' },
    { title: '안내 3', description: '설명이 충분히 길게 들어 있습니다', link: 'https://a.go.kr/f3.pdf' },
    { title: '안내 4', description: '설명이 충분히 길게 들어 있습니다', link: 'https://a.go.kr/info/content.do?p=4' },
  ];
  const search = (async (type: string) =>
    ({ ok: true, items: type === 'news' ? mixed : [] })) as any;

  test('첨부파일은 건너뛰고 웹페이지를 긁는다', async () => {
    const asked: string[] = [];
    const g = await fetchGroundingReal('주제', search, {
      fetchBody: async (url: string) => { asked.push(url); return '본문 2,017자에 해당하는 내용입니다'; },
    });
    expect(asked).toEqual(['https://a.go.kr/info/content.do?p=4']);
    expect(g.text).toContain('본문 2,017자에 해당하는 내용');
  });

  test('전부 첨부파일이면 한 번도 요청하지 않는다', async () => {
    let calls = 0;
    const onlyFiles = (async () => ({ ok: true, items: mixed.slice(0, 3) })) as any;
    const g = await fetchGroundingReal('주제', onlyFiles, {
      fetchBody: async () => { calls += 1; return '본문'; },
    });
    expect(calls).toBe(0);
    expect(g.text).toContain('안내 1');   // 스니펫은 그대로 남는다
  });
});

/**
 * ⑫ 순위 위에 주제 일치를 한 겹 더 (v3.8.581)
 *
 * 사장님 말대로 상위노출 글은 신뢰할 만하다. 그런데 네이버 정확도순은 검색어가 길면
 * 느슨해진다. 실측에서 `해외 항공권 취소 수수료 면제` 의 상위 3건이 이랬다:
 *   · 2018년 7월10일자 조간신문 머릿기사 종합
 *   · KB국민 WE:SH Travel 카드 혜택 정리
 * 항공권 취소 수수료와 아무 상관이 없다. 이런 게 장부에 들어가면 사장님이 처음
 * 걱정한 그 일이 그대로 벌어진다 — 엉뚱한 글이 수치를 보증한다.
 */
describe('⑫ 상위 블로그라도 주제가 어긋나면 안 받는다', () => {
  const KW = '해외 항공권 취소 수수료 면제';
  const blogItem = (title: string, description = '자세히 정리했습니다') =>
    ({ title, description, link: `https://blog.naver.com/x/${encodeURIComponent(title)}` });

  const withBlogs = (items: any[]) => (async (t: string) =>
    ({ ok: true, items: t === 'blog' ? items : [] })) as any;

  test('실측에서 걸린 그 글들을 막는다', async () => {
    const g = await fetchGrounding(KW, withBlogs([
      blogItem('2018년 7월10일자(火) 조간신문 머릿기사 종합'),
      blogItem('[KB국민카드] KB국민 WE:SH Travel 카드 혜택 정리'),
    ]));
    expect(g.blogCount).toBe(0);
    expect(g.text).not.toContain('조간신문');
  });

  test('주제가 맞는 글은 그대로 받는다', async () => {
    const g = await fetchGrounding(KW, withBlogs([
      blogItem('해외 항공권 취소 수수료 면제 조건 총정리', '질병 사유 진단서 기준을 정리했습니다'),
    ]));
    expect(g.blogCount).toBe(1);
    expect(g.text).toContain('[블로그]');
  });

  test('안 쓴 블로그 수는 그대로 세어 둔다 (왜 얇은지 설명하려고)', async () => {
    const g = await fetchGrounding(KW, withBlogs([
      blogItem('2018년 조간신문 머릿기사 종합'),
      blogItem('KB국민카드 혜택 정리'),
    ]));
    expect(g.skippedBlogs).toBe(2);
  });

  test('낱말이 하나뿐인 검색어도 막히지 않는다', async () => {
    const g = await fetchGrounding('실손보험', withBlogs([
      blogItem('실손보험 세대별 자기부담금 정리'),
    ]));
    expect(g.blogCount).toBe(1);
  });
});

/**
 * ⑬ 넓은 낱말만 겹치는 건 주제가 겹친 게 아니다 (v3.8.581 · 2차 실측)
 *
 * 낱말 개수만 세던 1차 필터가 실측에서 그대로 뚫렸다:
 *   · `실손보험 도수치료 보장` → 백내장 수술 글이 통과
 *     ("도수가 조정된 인공수정체" — 도수치료와 아무 상관이 없다)
 * 없어서는 안 될 낱말(도수치료)이 빠졌는데 넓은 말(보장)이 채워 준 것이다.
 * v3.8.573 의 CTA 범용 태그 오배송과 같은 병이다.
 */
describe('⑬ 주제어가 없으면 넓은 낱말이 아무리 겹쳐도 안 받는다', () => {
  const withBlogs = (items: any[]) => (async (t: string) =>
    ({ ok: true, items: t === 'blog' ? items : [] })) as any;
  const post = (title: string, description: string) =>
    ({ title, description, link: `https://blog.naver.com/x/${encodeURIComponent(title)}` });

  test('실측에서 뚫린 백내장 글을 막는다', async () => {
    const g = await fetchGrounding('실손보험 도수치료 보장', withBlogs([
      post('백내장 치료법 및 백내장 수술 실손보험 보장 방법',
        '환자의 상태에 따라 도수가 조정된 인공수정체를 넣습니다. 보장 범위를 정리했습니다'),
    ]));
    expect(g.blogCount).toBe(0);
  });

  test('주제어가 있으면 받는다', async () => {
    const g = await fetchGrounding('실손보험 도수치료 보장', withBlogs([
      post('실손보험 도수치료 보장 한도 정리', '세대별 도수치료 보장 한도와 자기부담금을 정리했습니다'),
    ]));
    expect(g.blogCount).toBe(1);
  });

  test('넓은 낱말만으로 된 검색어는 막히지 않는다 (셀 것이 없으면 다 잃는다)', async () => {
    const g = await fetchGrounding('환불 신청 방법', withBlogs([
      post('환불 신청 방법 총정리', '환불 신청 방법을 단계별로 정리했습니다'),
    ]));
    expect(g.blogCount).toBe(1);
  });
});
