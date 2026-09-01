/**
 * v3.8.619 — CTA 는 남의 블로그로 절대 보내지 않는다
 *
 * 사장님: "내 글 보러 왔는데 다른 블로그로 링크 타고 가버리면
 *          그 블로그 주인한테 광고 수익을 주는 꼴이라고"
 *
 * 트래픽을 잃는 데서 끝나는 게 아니라 **남의 수익을 만들어 주는** 일이다.
 * 예외는 하나 — 내 블로그. 그건 나가는 게 아니라 더 머무는 것이다.
 */

import fs from 'fs';
import path from 'path';
import { isForeignBlogUrl, isUserGeneratedUrl } from '../src/cta/host-trust';

const MY = 'https://leadernam.com';

describe('남의 블로그는 전부 막는다', () => {
  const foreign = [
    'https://blog.naver.com/someone/12345',
    'https://m.blog.naver.com/someone/12345',
    'https://post.naver.com/viewer?volumeNo=1',
    'https://in.naver.com/someone',
    'https://someone.tistory.com/123',
    'https://someone.blogspot.com/2026/09/post.html',
    'https://brunch.co.kr/@someone/1',
    'https://velog.io/@someone/post',
    'https://steemit.com/@someone/post',
    'https://story.kakao.com/someone',
    'https://cafe.naver.com/board/1',
    'https://someone.wordpress.com/2026/09/post',
  ];

  it.each(foreign)('%s 는 차단된다', (url) => {
    expect(isForeignBlogUrl(url, MY)).toBe(true);
  });

  it('실측으로 뚫려 있던 곳들이 이제 블로그로 인식된다', () => {
    // v3.8.619 이전에는 이 셋이 통과했다
    expect(isUserGeneratedUrl('https://post.naver.com/x')).toBe(true);
    expect(isUserGeneratedUrl('https://in.naver.com/x')).toBe(true);
    expect(isUserGeneratedUrl('https://steemit.com/@a/b')).toBe(true);
  });
});

describe('내 블로그만 예외다', () => {
  it('내 글은 통과한다', () => {
    expect(isForeignBlogUrl('https://leadernam.com/finance/loan-fee/abc/', MY)).toBe(false);
    expect(isForeignBlogUrl('https://www.leadernam.com/abc', MY)).toBe(false);
  });

  it('내 블로그가 티스토리여도 내 글만 통과한다', () => {
    const mine = 'https://mine.tistory.com';
    expect(isForeignBlogUrl('https://mine.tistory.com/5', mine)).toBe(false);
    expect(isForeignBlogUrl('https://other.tistory.com/5', mine)).toBe(true);
  });

  it('내 블로그를 모르면 블로그는 모두 막는다 — 모르면 보내지 않는다', () => {
    expect(isForeignBlogUrl('https://mine.tistory.com/5')).toBe(true);
  });

  it('공공기관·일반 사이트는 블로그가 아니므로 영향 없다', () => {
    ['https://www.mpm.go.kr', 'https://www.gov.kr', 'https://www.fsc.go.kr'].forEach((url) => {
      expect(isForeignBlogUrl(url, MY)).toBe(false);
    });
  });
});

describe('배선 — 관문에 실제로 연결돼 있는가', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const orchestration = read('src/core/final/orchestration.ts');
  const generation = read('src/core/final/generation.ts');

  it('CTA 렌더 관문이 남의 블로그를 검사한다', () => {
    expect(orchestration).toContain('isForeignBlogUrl(value, ownBlogUrl)');
  });

  it('관문 호출 3곳 모두에 내 블로그 주소가 넘어간다', () => {
    expect(orchestration).toContain('isRenderableCta(sectionCta, ctaBlogUrl)');
    expect(orchestration).toContain('pickRenderableCta(topCandidates, renderedCtaUrls, ctaBlogUrl)');
    expect(orchestration).toContain('pickRenderableCta(finalCandidates, renderedCtaUrls, ctaBlogUrl)');
  });

  it('내부 관련 글 CTA 는 같은 도메인만 고른다', () => {
    expect(generation).toContain('sameHost');
    expect(generation).toContain('반드시 **내 도메인**이어야 한다');
  });
});
