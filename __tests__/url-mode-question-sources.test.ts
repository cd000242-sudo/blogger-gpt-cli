/**
 * v3.8.750 — URL 모드도 질문 소재(지식iN·자동완성)를 모은다
 *
 * v3.8.749 라이브 1편(실손보험 청구 기사 URL · OpenAI)에서 확인했다. URL 모드가 검색 단계를 통째로
 * 건너뛰어 화면에 이렇게 떴다:
 *   "검색자 질문 데이터 없음 — 경쟁 글 소제목 기준으로 생성합니다"
 *   "겪은 사람 말투 재료 없음 (지식인 0건 · 후기 0건) — 네이버 API 키를 넣으면 지식인 답변을 재료로 씁니다"
 * 네이버 키는 있었다. 키워드 글은 같은 단계에서 지식iN 질문으로 소제목을 세우고 답변에서
 * "실제로 막힌 지점"을 뽑는다 — URL 글만 이 재료가 늘 0이었다.
 *
 * 원칙은 그대로다: 근거는 원문이 맡는다. 질문 소재는 "독자가 무엇을 궁금해하나"만 알려 준다.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { collectUrlModeQuestionPosts } from '../src/core/final/url-mode';
import { describeMissingLivedMaterial, extractLivedSignals } from '../src/core/final/lived-voice';

const kinItem = {
  title: 'Q. 실손 청구 서류 없이 되나요?',
  url: 'https://kin.naver.com/qna/detail.naver?d1id=6&docId=1',
  content: 'Q. 실손 청구 서류 없이 되나요?\nA. 병원이 실손24 연계가 안 돼 있으면 결국 영수증을 따로 떼야 했어요. 저는 두 번 헛걸음했습니다.',
  subheadings: ['실손 청구 서류 없이 되나요?'],
  source: 'naver-kin',
};
const suggestItem = {
  title: '실손보험 청구 — 사람들이 함께 검색한 키워드',
  url: '',
  content: '1. 실손보험 청구 서류\n2. 실손24 병원',
  subheadings: ['실손보험 청구 서류', '실손24 병원'],
  source: 'google-suggest',
};

describe('collectUrlModeQuestionPosts — 주제로 질문 소재를 모은다', () => {
  it('지식iN·자동완성을 주제로 찾아 출처 표시(naver-kin·google-suggest)를 지킨 채 돌려준다', async () => {
    const asked: string[] = [];
    const logs: string[] = [];
    const posts = await collectUrlModeQuestionPosts('실손보험 서류 없이 청구', {
      crawlKin: async (topic) => { asked.push(`kin:${topic}`); return [kinItem]; },
      crawlSuggest: async (topic) => { asked.push(`suggest:${topic}`); return [suggestItem]; },
      onLog: (m) => logs.push(m),
    });
    expect(asked.sort()).toEqual(['kin:실손보험 서류 없이 청구', 'suggest:실손보험 서류 없이 청구']);
    expect(posts.map((p) => p.source)).toEqual(['naver-kin', 'google-suggest']);
    // 키워드 글의 변환(CrawledContent → FinalCrawledPost)과 같은 모양 — 아래 단계가 같은 방식으로 읽는다
    expect(posts[0]).toEqual({
      title: kinItem.title, url: kinItem.url, content: kinItem.content, subheadings: kinItem.subheadings,
      source: 'naver-kin', pubDate: null, originalLink: '', hasBody: false,
    });
    expect(logs.join('\n')).toMatch(/지식iN 1건 · 자동완성 2개/);
  });

  it('한쪽이 실패해도 멈추지 않는다 — 재료가 줄 뿐이다', async () => {
    const posts = await collectUrlModeQuestionPosts('주제', {
      crawlKin: async () => { throw new Error('429 Too Many Requests'); },
      crawlSuggest: async () => [suggestItem],
    });
    expect(posts.map((p) => p.source)).toEqual(['google-suggest']);
  });

  it('검색 키가 없으면(crawlKin 없음) 무료인 자동완성만 모은다', async () => {
    const posts = await collectUrlModeQuestionPosts('주제', { crawlSuggest: async () => [suggestItem] });
    expect(posts.map((p) => p.source)).toEqual(['google-suggest']);
  });

  it('질문 소재가 아닌 것(블로그·뉴스)은 싣지 않는다 — 근거는 원문이 맡는다', async () => {
    const posts = await collectUrlModeQuestionPosts('주제', {
      crawlKin: async () => [{ ...kinItem, source: 'naver-blog' }],
      crawlSuggest: async () => [{ ...suggestItem, source: 'external' }],
    });
    expect(posts).toEqual([]);
  });

  it('모은 지식iN 답변이 겪은 사람 말투 재료로 이어진다', async () => {
    const posts = await collectUrlModeQuestionPosts('주제', { crawlKin: async () => [kinItem], crawlSuggest: async () => [] });
    const signals = extractLivedSignals(posts, []);
    expect(signals.map((s) => s.text)).toContain('저는 두 번 헛걸음했습니다.');
  });
});

describe('describeMissingLivedMaterial — 재료가 없을 때 까닭을 맞게 말한다', () => {
  it('네이버 키가 없을 때만 키를 넣으라고 한다', () => {
    expect(describeMissingLivedMaterial(0, 0, false)).toMatch(/네이버 API 키를 넣으면/);
  });

  it('키가 있는데 0건이면 키 탓을 하지 않는다', () => {
    const text = describeMissingLivedMaterial(0, 0, true);
    expect(text).not.toMatch(/키를 넣으면/);
    expect(text).toMatch(/지식iN 답변을 찾지 못했습니다/);
  });

  it('키가 있는지 모르면 덧붙이지 않는다 · 답변은 있는데 신호만 없으면 덧붙이지 않는다', () => {
    expect(describeMissingLivedMaterial(0, 0, null)).toBe('');
    expect(describeMissingLivedMaterial(3, 0, true)).toBe('');
    expect(describeMissingLivedMaterial(0, 2, false)).toBe('');
  });
});

describe('orchestration 배선 — URL 모드 분기가 수집기를 실제로 넘긴다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
  const declAt = src.indexOf('let crawledPosts: FinalCrawledPost[] = [];');
  const start = src.indexOf('if (urlModeSources) {', declAt);
  const end = src.indexOf('} else if (manualUrls.length > 0) {', start);
  const block = src.slice(start, end);

  it('분기를 찾는다 (못 찾으면 검사기 고장)', () => {
    expect(declAt).toBeGreaterThan(0);
    expect(start).toBeGreaterThan(declAt);
    expect(end).toBeGreaterThan(start);
  });

  it('원문 + 지식iN·자동완성 질문 소재를 함께 crawledPosts 로 넘긴다', () => {
    expect(block).toMatch(/collectUrlModeQuestionPosts\(\s*keyword/);
    expect(block).toMatch(/crawlFromNaverKin/);
    expect(block).toMatch(/crawlGoogleSuggest/);
    expect(block).toMatch(/crawledPosts = \[\.\.\.urlModeSources\.posts, \.\.\.questionPosts\]/);
  });

  it('지식iN 은 검색 키가 있을 때만 부른다 · 호출 기록은 글마다 비운다 (키워드 글과 같게)', () => {
    expect(block).toMatch(/resolveAllNaverCredentials\(payload\)/);
    expect(block).toMatch(/resetNaverCallLog\(\)/);
  });

  it('수집 준비가 실패해도 글을 멈추지 않는다 — 준비부터 수집까지 try 안에서, 원문은 늘 싣는다', () => {
    const tryAt = block.indexOf('try {');
    const catchAt = block.indexOf('} catch (questionErr');
    expect(tryAt).toBeGreaterThan(0);
    expect(catchAt).toBeGreaterThan(tryAt);
    for (const step of ['loadEnvFromFile()', "require('../naver-search-client')", "require('../content-crawler')", 'collectUrlModeQuestionPosts(']) {
      const at = block.indexOf(step);
      expect(at).toBeGreaterThan(tryAt);
      expect(at).toBeLessThan(catchAt);
    }
    expect(block.indexOf('crawledPosts = [...urlModeSources.posts, ...questionPosts]')).toBeGreaterThan(catchAt);
  });

  it('재료 없음 안내가 키 유무를 보고 말한다', () => {
    expect(src).toMatch(/describeMissingLivedMaterial\(kinCount, livedReviews\.length,/);
    expect(src).not.toMatch(/'\s—\s네이버 API 키를 넣으면 지식인 답변을 재료로 씁니다'/);
  });
});
