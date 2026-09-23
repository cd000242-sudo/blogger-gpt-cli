/**
 * v3.8.749 — URL 로 만든 글도 키워드 글과 **같은 파이프라인**을 탄다
 *
 * 사장님: "URL로 글생성하면 이미지와 표 CTA 등 삽입이 안되고 소제목과 본문만 나오는 버그가 있어"
 *
 * 원인: orchestration 의 URL 전용 블록이 url-content-generator 로 글을 만들고 썸네일만 붙여 **바로 반환**했다.
 *   그 생성기의 HTML 은 h2·h3·p·태그 + 자체 <style>(.url-gen-content) 뿐이라, 본 파이프라인이 넣는
 *   소제목 이미지·표·CTA·FAQ·요약·스킨·Final Judge 가 하나도 없었다. 가장 오래된 커밋부터 그랬다(회귀 아님).
 *   게다가 생성기가 실패하면 "기존 방식으로 전환"이 **빈 키워드**로 본 파이프라인을 돌렸다.
 *
 * 이제:
 *   ① URL 은 지금의 수집기(deepCrawlUrl — 유튜브·네이버 블로그·기사 JSON)로 읽고, 본문이 비면 한 번 더 읽는다.
 *   ② 둘 다 못 읽으면 글을 지어내지 않고 멈춘다 (v3.8.627 의 원래 뜻).
 *   ③ 주제(메인 키워드)는 원문에서 검색어 꼴로 뽑는다 — 못 뽑으면 원문 제목을 다듬어 쓴다.
 *   ④ 원문을 근거 자료로 넣고 **본 파이프라인을 끝까지** 돈다.
 *   ⑤ "원문을 덮고 더 채운다"(v3.8.596) 규칙과 원문 날짜 경고(v3.8.633)는 작가 지시문에 같은 문장으로 싣는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  topicFromTitle,
  collectUrlModeSources,
  buildUrlUpgradeWriterBlock,
  type UrlModeDeps,
} from '../src/core/final/url-mode';
import { URL_UPGRADE_RULES } from '../src/core/final/url-upgrade';
import { blockBetween } from './helpers/source-block';

const BODY = '추석 연휴에 문을 여는 병원과 약국은 응급의료포털 E-Gen 과 129 콜센터에서 확인할 수 있습니다. '.repeat(8);

function deps(over: Partial<UrlModeDeps> = {}): UrlModeDeps {
  return {
    deepCrawl: async (url) => ({ url, title: '2026 추석 연휴 문 여는 병원 찾는 법 | 보건복지부', content: BODY, subheadings: ['응급실 운영', '약국 찾기'], publishDate: '2026-09-20T09:00:00+09:00' }),
    fallbackCrawl: async () => null,
    recoverTopic: async () => '추석 연휴 문 여는 병원 찾기',
    describeFailure: (url) => `이 주소에서 본문을 가져오지 못했습니다\n${url}`,
    minBodyChars: 200,
    ...over,
  };
}

describe('topicFromTitle — 원문 제목을 주제로 다듬는다', () => {
  it('사이트 이름 꼬리를 뗀다', () => {
    expect(topicFromTitle('2026 추석 연휴 문 여는 병원 찾는 법 | 보건복지부')).toBe('2026 추석 연휴 문 여는 병원 찾는 법');
    expect(topicFromTitle('청년 월세 지원 신청 방법 - 네이버 블로그')).toBe('청년 월세 지원 신청 방법');
  });
  it('제목이 없으면 빈 문자열 — 지어내지 않는다', () => {
    expect(topicFromTitle('')).toBe('');
    expect(topicFromTitle('제목 없음')).toBe('');
  });
});

describe('collectUrlModeSources — URL 을 근거 자료로 만든다', () => {
  it('원문을 근거 자료 한 건으로 싣고, 주제는 원문에서 뽑는다', async () => {
    const r = await collectUrlModeSources(['https://example.go.kr/a'], deps());
    expect(r.topic).toBe('추석 연휴 문 여는 병원 찾기');
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0]).toMatchObject({ url: 'https://example.go.kr/a', content: BODY, subheadings: ['응급실 운영', '약국 찾기'], hasBody: true });
    expect(r.posts[0]!.pubDate).toBe('2026-09-20T09:00:00+09:00');
  });

  it('본문이 비면 두 번째 수집기로 한 번 더 읽는다', async () => {
    const r = await collectUrlModeSources(['https://shop.example/p/1'], deps({
      deepCrawl: async (url) => ({ url, title: '제목 없음', content: '짧음', subheadings: [] }),
      fallbackCrawl: async () => ({ title: '무선 청소기 A1', content: BODY, subheadings: [] }),
    }));
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0]!.title).toBe('무선 청소기 A1');
  });

  it('둘 다 못 읽으면 멈춘다 — 제목 한 줄로 글을 지어내지 않는다', async () => {
    await expect(collectUrlModeSources(['https://blocked.example/x'], deps({
      deepCrawl: async (url) => ({ url, title: '막힌 글', content: '', subheadings: [] }),
    }))).rejects.toThrow('본문을 가져오지 못했습니다');
  });

  it('주제를 못 뽑으면 원문 제목을 다듬어 쓴다', async () => {
    const r = await collectUrlModeSources(['https://example.go.kr/a'], deps({ recoverTopic: async () => '' }));
    expect(r.topic).toBe('2026 추석 연휴 문 여는 병원 찾는 법');
  });

  it('주소가 여럿이면 읽힌 것 모두 근거로 쓰고, 주제는 첫 원문에서', async () => {
    const seen: string[] = [];
    const r = await collectUrlModeSources(['https://a.example/1', 'https://b.example/2'], deps({
      recoverTopic: async (text) => { seen.push(text.slice(0, 20)); return '추석 병원'; },
    }));
    expect(r.posts.map((p) => p.url)).toEqual(['https://a.example/1', 'https://b.example/2']);
    expect(seen).toHaveLength(1);
  });

  it('상위호환 지시문 재료(제목·다룬 항목·작성일)를 함께 돌려준다', async () => {
    const r = await collectUrlModeSources(['https://example.go.kr/a'], deps());
    expect(r.upgradeSources[0]).toMatchObject({ title: '2026 추석 연휴 문 여는 병원 찾는 법 | 보건복지부', subheadings: ['응급실 운영', '약국 찾기'], publishDate: '2026-09-20T09:00:00+09:00' });
  });
});

describe('buildUrlUpgradeWriterBlock — 작가 지시문', () => {
  const block = buildUrlUpgradeWriterBlock([{ url: 'https://example.go.kr/a', title: '원문 제목', content: BODY, subheadings: ['응급실 운영'], publishDate: '2026-09-20' }]);

  it('"원문을 덮고 더 채운다" 규칙을 같은 문장으로 싣는다 (URL 생성기와 한 벌)', () => {
    expect(block).toContain(URL_UPGRADE_RULES);
  });
  it('원문이 다룬 항목과 작성일 경고를 싣는다', () => {
    expect(block).toContain('응급실 운영');
    expect(block).toContain('원문 작성일');
    expect(block).toContain('같은 이름의 과거 사건');
  });
  it('원문 본문은 다시 싣지 않는다 — 근거 자료로 이미 들어가 있어 두 번 내면 비용만 는다', () => {
    expect(block).not.toContain(BODY.slice(0, 40));
  });
  it('원문이 없으면 빈 문자열', () => {
    expect(buildUrlUpgradeWriterBlock([])).toBe('');
  });
});

describe('orchestration 배선', () => {
  const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
  const urlBlock = blockBetween(orch, 'const urlOnlyMode', 'let crawledPosts: FinalCrawledPost[] = [];');

  it('URL 전용 생성기로 글을 만들고 바로 반환하던 길이 없다', () => {
    expect(orch).not.toMatch(/generateContentFromUrls?\(/);
    expect(orch).not.toMatch(/html: urlResult\.html/);
  });

  it('URL 원문을 근거로 모으고 주제를 키워드로 쓴다', () => {
    expect(urlBlock).toContain('collectUrlModeSources(');
    expect(urlBlock).toMatch(/keyword = urlModeSources\.topic/);
  });

  it('URL 원문이 근거 자료가 된다 — 검색·재수집을 다시 하지 않는다', () => {
    const crawl = blockBetween(orch, 'let crawledPosts: FinalCrawledPost[] = [];', '🏛️ v3.8.730');
    expect(crawl).toMatch(/if \(urlModeSources\) \{[\s\S]*crawledPosts = urlModeSources\.posts/);
    expect(crawl).toMatch(/\} else if \(manualUrls\.length > 0\) \{/);
  });

  it('작가 지시문에 상위호환 규칙을 싣는다', () => {
    expect(orch).toMatch(/buildUrlUpgradeWriterBlock\(urlModeSources\.upgradeSources\)/);
    expect(orch).toMatch(/scopedSectionBlock \+= urlUpgradeBlock/);
  });

  it('제휴 링크만 넣으면 URL 전용 모드가 켜지지 않는 판정은 그대로다', () => {
    expect(urlBlock).toContain('manualUrls.length > 0');
  });
});
