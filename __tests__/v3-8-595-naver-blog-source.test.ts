/**
 * v3.8.595 — 네이버 블로그 글을 네 갈래로 가져온다.
 *
 * 사장님: "추출이 성공하게 수정해. 네이버 허브 api도 있는데 추출을 못한다는 게 말이 안 돼."
 *
 * 실측(2026-08-29, la1826/224394201101) 으로 확인한 네 갈래를 그대로 시험한다.
 * 실제 응답에서 잘라 온 조각을 픽스처로 쓴다 — 테스트는 네트워크를 타지 않는다.
 */

import {
  parseNaverBlogUrl,
  extractPostFromHtml,
  pickRssItem,
  pickSearchItem,
  cleanNaverTitle,
  fetchNaverBlogPost,
} from '../src/core/final/naver-blog-source';

const REAL_TITLE = '혁신성장촉진자금 비즈스캔 총정리! 신청·조건·실사·서류·일반형·혁신형·금리·10월 일정';
const LONG_BODY = '혁신성장촉진자금은 소상공인의 디지털 전환을 지원하는 직접대출 정책자금입니다. '.repeat(8);

/** ① m.blog.naver.com 응답 꼴 */
const MOBILE_HTML = `<html><head>
<meta property="og:title" content="${REAL_TITLE}" />
<title>${REAL_TITLE} : 네이버 블로그</title>
</head><body>
<div class="se-main-container"><p>${LONG_BODY}</p></div>
</div></body></html>`;

/** 데스크톱 프레임 껍데기 — 사고를 낸 응답 */
const DESKTOP_FRAME_HTML = `<html><head>
<title>la1826님의블로그 : 네이버 블로그</title>
<meta property="og:title" content="la1826님의블로그" />
</head><body><iframe src="/PostView.naver?blogId=la1826&logNo=224394201101"></iframe></body></html>`;

/** ③ RSS 응답 꼴 */
const RSS_XML = `<rss><channel><title><![CDATA[la1826님의블로그]]></title>
<item><title><![CDATA[다른 글]]></title>
<link><![CDATA[https://blog.naver.com/la1826/224394189523]]></link>
<description><![CDATA[다른 글 요약]]></description></item>
<item><title><![CDATA[${REAL_TITLE}]]></title>
<link><![CDATA[https://blog.naver.com/la1826/224394201101?fromRss=true]]></link>
<description><![CDATA[${LONG_BODY}<img src="https://blogthumb.pstatic.net/x.png" />]]></description></item>
</channel></rss>`;

/** ④ 검색 API 응답 items — query 를 logNo 로 주면 이 글 하나가 온다 */
const SEARCH_ITEMS = [{
  title: '혁신성장촉진자금 <b>비즈스캔</b> 총정리! 신청·조건·실사·서류·일반형....',
  link: 'https://blog.naver.com/la1826/224394201101',
  description: LONG_BODY,
}];

describe('주소에서 blogId·logNo 를 뽑는다', () => {
  test.each([
    ['https://blog.naver.com/la1826/224394201101', 'la1826', '224394201101'],
    ['https://m.blog.naver.com/la1826/224394201101', 'la1826', '224394201101'],
    ['https://blog.naver.com/la1826/224394201101?fromRss=true', 'la1826', '224394201101'],
    ['https://blog.naver.com/PostView.naver?blogId=la1826&logNo=224394201101', 'la1826', '224394201101'],
    ['https://la1826.blog.me/224394201101', 'la1826', '224394201101'],
  ])('%s', (url, blogId, logNo) => {
    expect(parseNaverBlogUrl(url)).toEqual({ blogId, logNo });
  });

  test('글 번호가 없으면 글 주소가 아니다', () => {
    expect(parseNaverBlogUrl('https://blog.naver.com/la1826')).toBeNull();
    expect(parseNaverBlogUrl('https://leadernam.com/abc')).toBeNull();
  });
});

describe('갈래별 추출', () => {
  test('① 모바일 HTML — 제목과 본문', () => {
    const got = extractPostFromHtml(MOBILE_HTML);
    expect(got.title).toBe(REAL_TITLE);
    expect(got.content.length).toBeGreaterThan(200);
  });

  test('데스크톱 껍데기는 제목을 주지 않는다 (블로그 이름이라 버린다)', () => {
    expect(extractPostFromHtml(DESKTOP_FRAME_HTML).title).toBe('');
  });

  test('③ RSS — logNo 로 그 글을 고른다', () => {
    const got = pickRssItem(RSS_XML, '224394201101');
    expect(got?.title).toBe(REAL_TITLE);
    expect(got?.content).not.toContain('<img');
  });

  test('④ 검색 API — link 로 그 글을 고르고 <b> 를 걷는다', () => {
    const got = pickSearchItem(SEARCH_ITEMS, '224394201101');
    expect(got?.title).toContain('비즈스캔');
    expect(got?.title).not.toContain('<b>');
  });

  test('제목 뒤 " : 네이버 블로그" 를 뗀다', () => {
    expect(cleanNaverTitle(`${REAL_TITLE} : 네이버 블로그`)).toBe(REAL_TITLE);
    expect(cleanNaverTitle('la1826님의블로그 : 네이버 블로그')).toBe('');
  });
});

describe('네 갈래를 차례로 탄다 — 앞이 되면 뒤는 안 부른다', () => {
  test('모바일이 되면 거기서 끝난다', async () => {
    const calls: string[] = [];
    const got = await fetchNaverBlogPost('https://blog.naver.com/la1826/224394201101', {
      fetchHtml: async (u) => { calls.push(u); return MOBILE_HTML; },
      searchBlog: async () => { throw new Error('불려서는 안 된다'); },
    });
    expect(got?.via).toBe('mobile');
    expect(got?.title).toBe(REAL_TITLE);
    expect(calls).toHaveLength(1);
  });

  test('HTML 이 전부 막히면 RSS 로 간다', async () => {
    const got = await fetchNaverBlogPost('https://blog.naver.com/la1826/224394201101', {
      fetchHtml: async (u) => (u.includes('rss.blog') ? RSS_XML : ''),
    });
    expect(got?.via).toBe('rss');
    expect(got?.title).toBe(REAL_TITLE);
  });

  test('RSS 에도 없으면 검색 API 가 받아 준다 (허브·레거시 공통 창구)', async () => {
    const queries: string[] = [];
    const got = await fetchNaverBlogPost('https://blog.naver.com/la1826/224394201101', {
      fetchHtml: async () => '',
      searchBlog: async (q) => { queries.push(q); return SEARCH_ITEMS; },
    });
    expect(got?.via).toBe('search-api');
    // 글 번호로 검색해야 그 글 하나가 나온다 (실측: total 1)
    expect(queries).toEqual(['224394201101']);
  });

  test('데스크톱 껍데기만 돌아와도 다음 갈래로 넘어간다', async () => {
    const got = await fetchNaverBlogPost('https://blog.naver.com/la1826/224394201101', {
      fetchHtml: async (u) => {
        if (u.includes('m.blog')) return DESKTOP_FRAME_HTML;
        if (u.includes('rss.blog')) return RSS_XML;
        return '';
      },
    });
    expect(got?.title).toBe(REAL_TITLE);
  });

  test('전부 실패하면 null — 조용히 별명으로 글을 쓰지 않는다', async () => {
    const got = await fetchNaverBlogPost('https://blog.naver.com/la1826/224394201101', {
      fetchHtml: async () => '',
      searchBlog: async () => [],
    });
    expect(got).toBeNull();
  });

  test('네이버 블로그가 아니면 아무 것도 부르지 않는다', async () => {
    const got = await fetchNaverBlogPost('https://leadernam.com/abc', {
      fetchHtml: async () => { throw new Error('불려서는 안 된다'); },
    });
    expect(got).toBeNull();
  });
});
