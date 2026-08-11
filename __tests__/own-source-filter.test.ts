/**
 * v3.8.481 — 자기가 쓴 글이 다음 글의 근거가 되는 되먹임 차단.
 *
 * 실측 2026-08-11, 사고를 낸 키워드의 최신순 1위:
 *   "부산 청년 게임개발자 정착지원, 소득 무관 월 25만원 받는 조건…"
 * "소득 무관" 은 팩트체크에서 **2024년 표현**이라고 지적된 바로 그 문구다.
 * 이 도구로 쓴 글이 재료로 되돌아오면 틀린 정보가 스스로를 강화한다.
 *
 * v3.8.480(최신순 혼합)이 이 위험을 키웠다 — 방금 쓴 글이 최신순 1위로 들어온다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  collectOwnSources,
  isOwnSource,
  filterOwnSources,
} from '../src/core/crawlers/own-source-filter';

describe('collectOwnSources — 설정에서 "내 것"을 모은다', () => {
  it('워드프레스 주소에서 도메인을 자동으로 얻는다', () => {
    expect(collectOwnSources({ WORDPRESS_SITE_URL: 'https://leadernam.com' })).toEqual(['leadernam.com']);
    expect(collectOwnSources({ WORDPRESS_SITE_URL: 'https://www.leadernam.com/' })).toEqual(['leadernam.com']);
  });

  it('추가 목록을 쉼표로 받는다 (블로그스팟·티스토리·네이버 블로그)', () => {
    const own = collectOwnSources({
      WORDPRESS_SITE_URL: 'https://leadernam.com',
      EXCLUDE_SOURCE_DOMAINS: 'myblog.tistory.com, https://blog.naver.com/myid , foo.blogspot.com/',
    });
    expect(own).toContain('leadernam.com');
    expect(own).toContain('myblog.tistory.com');
    expect(own).toContain('blog.naver.com/myid');
    expect(own).toContain('foo.blogspot.com');
  });

  it('설정이 없으면 빈 배열 — 아무것도 거르지 않는다', () => {
    expect(collectOwnSources({})).toEqual([]);
    expect(collectOwnSources()).toEqual([]);
  });
});

describe('isOwnSource', () => {
  const own = ['leadernam.com', 'blog.naver.com/myid'];

  it('내 도메인과 하위 도메인을 알아본다', () => {
    expect(isOwnSource('https://leadernam.com/post/1', own)).toBe(true);
    expect(isOwnSource('https://www.leadernam.com/post/1', own)).toBe(true);
    expect(isOwnSource('https://blog.leadernam.com/x', own)).toBe(true);
  });

  it('경로까지 지정하면 그 블로그만 거른다 (한 도메인을 여럿이 나눠 쓰는 곳)', () => {
    expect(isOwnSource('https://blog.naver.com/myid/223456789', own)).toBe(true);
    expect(isOwnSource('https://m.blog.naver.com/myid/223456789', own)).toBe(true);
    // 같은 네이버지만 남의 블로그는 살려야 한다
    expect(isOwnSource('https://blog.naver.com/someone_else/223456789', own)).toBe(false);
  });

  it('비슷한 이름의 남의 도메인을 잘못 거르지 않는다', () => {
    expect(isOwnSource('https://notleadernam.com/x', own)).toBe(false);
    expect(isOwnSource('https://leadernam.com.evil.net/x', own)).toBe(false);
  });

  it('설정이 없으면 아무것도 안 거른다', () => {
    expect(isOwnSource('https://leadernam.com/x', [])).toBe(false);
    expect(isOwnSource('', own)).toBe(false);
  });
});

describe('filterOwnSources', () => {
  it('내 글만 빼고 나머지는 그대로 둔다', () => {
    const items = [
      { url: 'https://leadernam.com/2026/08/post' },
      { url: 'https://blog.naver.com/other/1' },
      { url: 'https://www.yna.co.kr/view/AKR1' },
    ];
    const result = filterOwnSources(items, ['leadernam.com']);

    expect(result.removed).toBe(1);
    expect(result.kept).toHaveLength(2);
    expect(result.kept.map(i => i.url)).not.toContain('https://leadernam.com/2026/08/post');
  });

  it('설정이 없으면 원본 그대로 (동작 후퇴 없음)', () => {
    const items = [{ url: 'https://leadernam.com/x' }];
    expect(filterOwnSources(items, []).kept).toBe(items);
    expect(filterOwnSources(items, []).removed).toBe(0);
  });

  it('빈 입력에도 던지지 않는다', () => {
    expect(() => filterOwnSources(null as any, ['leadernam.com'])).not.toThrow();
  });
});

describe('배선', () => {
  const orchestration = readFileSync(join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf8');

  it('크롤링 결과를 재료로 넘기기 전에 거른다', () => {
    const idx = orchestration.indexOf('filterOwnSources');
    expect(idx).toBeGreaterThan(-1);
    // crawledPosts 로 변환하는 루프보다 앞에서 걸러야 한다
    expect(idx).toBeLessThan(orchestration.indexOf('for (const item of crawledFromAPI)'));
  });

  it('필터가 실패해도 수집을 막지 않는다', () => {
    expect(orchestration).toContain('자기 글 필터 스킵');
  });
});
