/**
 * v3.8.619 — CTA 목적지 폴백 사슬이 실제로 배선돼 있는가
 *
 * 사장님 요구: "어떤 주제로 글을 쓰든지 자동으로 완벽하게 버튼이 생기고 링크가 걸려야 돼요"
 * 이어서: "남은 구멍 하나는 방법이 없나"
 *
 * 사슬:
 *   ① 행동 화면(ACTION_DESTINATIONS)
 *   ② 키워드 매핑(OFFICIAL_FALLBACK_SITES)
 *   ③ 이름 사전 230곳  (name-to-url)
 *   ④ 검색으로 주소 확인 (official-site-search)
 *   ⑤ 내 블로그 관련 글  ← 밖에 보낼 곳이 없는 주제(맛집·일상)
 *
 * 이 파일은 **배선**을 지킨다. 인자만 만들고 호출부에서 안 넘기면 조용히 죽는데,
 * 그 사고가 이 저장소에서 여러 번 반복됐다.
 */

import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('배선 — 인자가 실제로 전달되는가', () => {
  const generation = read('src/core/final/generation.ts');
  const orchestration = read('src/core/final/orchestration.ts');

  it('generateCTAsFinal 이 blogUrl 을 받는다', () => {
    expect(/export async function generateCTAsFinal\([\s\S]*?blogUrl\?: string,\s*\): Promise/.test(generation)).toBe(true);
  });

  it('호출부가 blogUrl 을 실제로 넘긴다 — 안 넘기면 폴백이 조용히 죽는다', () => {
    expect(orchestration).toMatch(/generateCTAsFinal\(keyword, crawledPosts, sections, contentMode, officialSources, onLog, ctaBlogUrl\)/);
  });

  it('넘기는 값이 빈 문자열로 굳어 있지 않다', () => {
    expect(orchestration).toMatch(/ctaBlogUrl = String\(/);
    expect(orchestration).toMatch(/wordpressSiteUrl/);
  });
});

describe('사슬의 각 단계가 코드에 존재하는가', () => {
  const generation = read('src/core/final/generation.ts');

  it('③ 이름 사전 해석 단계', () => {
    expect(generation).toContain('resolveOfficialUrlByName');
  });

  it('④ 검색으로 주소 확인 단계', () => {
    expect(generation).toContain('findOfficialUrlBySearch');
  });

  it('⑤ 내 블로그 관련 글 단계', () => {
    expect(generation).toContain('findRelatedPosts');
    expect(generation).toContain('이어서 읽기');
  });

  it('해석한 주소는 살아 있는지 확인한 뒤에만 쓴다', () => {
    expect(generation).toContain('validateCtaUrl');
  });

  it('검색 결과 페이지를 버튼으로 쓰지 않는다 — 자기 트래픽 보호 결정은 유지', () => {
    expect(generation).toContain('구글 검색 URL 은 쓰지 않는다');
  });
});

describe('모듈이 실제로 불러와지는가', () => {
  it('이름 해석기와 검색기가 로드된다', () => {
    const nameToUrl = require('../src/cta/name-to-url');
    const siteSearch = require('../src/cta/official-site-search');
    expect(typeof nameToUrl.resolveOfficialUrlByName).toBe('function');
    expect(typeof siteSearch.findOfficialUrlBySearch).toBe('function');
    expect(typeof siteSearch.pickOfficialSite).toBe('function');
  });
});
