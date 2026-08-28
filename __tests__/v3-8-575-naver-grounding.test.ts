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
  fetchGrounding, fetchGroundingSnippets, describeGrounding,
  checkFreshness, describeFreshness,
} from '../src/core/final/naver-grounding';

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
 * ④ 출처 우선순위 — 사장님: "블로그로 하면 그 블로그가 잘못된 정보면 그대로 통과가 되어버리니까"
 *
 * 근거 장부는 fact-guard 가 "이 수치는 자료에 있다"고 판단하는 근거다.
 * 틀린 블로그가 장부에 들어가면 **틀린 수치를 보증해 주는 꼴**이라 없느니만 못하다.
 */
describe('④ 출처 우선순위 — 블로그를 근거로 쓰지 않는다', () => {
  const NEWS = [{ title: '관리급여 전환 시행', description: '7월부터 적용됩니다.', link: 'https://news.co.kr/1' }];
  const WEB = [
    { title: '기관 안내', description: '공식 안내입니다.', link: 'https://www.nhis.or.kr/a' },
    { title: '블로그 글', description: '제가 겪은 이야기입니다.', link: 'https://blog.naver.com/me/1' },
    { title: '티스토리 글', description: '정리해봤어요.', link: 'https://someone.tistory.com/2' },
    { title: '카페 글', description: '카페 후기입니다.', link: 'https://cafe.naver.com/x/3' },
  ];
  const search = () => jest.fn().mockImplementation((type: string) =>
    Promise.resolve({ ok: true, items: type === 'news' ? NEWS : WEB }));

  test('블로그·티스토리·카페는 근거에서 빠진다', async () => {
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

  test("블로그 검색('blog')은 아예 부르지 않는다", async () => {
    const spy = search();
    await fetchGroundingSnippets('실손보험', spy as any);
    const types = spy.mock.calls.map((c: any[]) => c[0]);
    expect(types).toContain('news');
    expect(types).not.toContain('blog');
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
  const src = (news: any[], web: any[]) => jest.fn().mockImplementation((t: string) =>
    Promise.resolve({ ok: true, items: t === 'news' ? news : web }));

  test('아무것도 못 찾으면 사람이 확인하라고 말한다', async () => {
    const g = await fetchGrounding('아주 희귀한 주제', src([], []) as any);
    expect(g.newsCount + g.webCount).toBe(0);
    expect(describeGrounding(g)).toContain('사람이 확인');
  });

  test('블로그만 있으면 근거로 쓰지 않고, 왜 비었는지 설명한다', async () => {
    const g = await fetchGrounding('틈새 주제', src([], [BLOG, BLOG]) as any);
    expect(g.text).toBe('');
    expect(g.skippedBlogs).toBe(2);
    const msg = describeGrounding(g);
    expect(msg).toContain('블로그');
    expect(msg).toContain('보증');          // 왜 안 쓰는지가 적혀 있어야 한다
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

  test('몇 건을 걸렀는지 세어 둔다 (근거가 얇은 이유를 설명하려고)', async () => {
    const g = await fetchGrounding('주제', src([], [OFFICIAL, BLOG, BLOG, BLOG]) as any);
    expect(g.webCount).toBe(1);
    expect(g.skippedBlogs).toBe(3);
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
