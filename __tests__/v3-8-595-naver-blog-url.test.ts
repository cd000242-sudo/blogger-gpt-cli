/**
 * v3.8.595 — 네이버 블로그 URL 을 넣으면 글 주제가 블로그 이름이 되던 사고.
 *
 * 실측(2026-08-29): 같은 글인데 주소에 따라 제목이 다르다.
 *   blog.naver.com/la1826/224394201101   → "la1826님의블로그 : 네이버 블로그"  (프레임 껍데기)
 *   m.blog.naver.com/la1826/224394201101 → "혁신성장촉진자금 비즈스캔 총정리! …" (진짜 글)
 * 발행 결과: https://leadernam.com/subsidy/local-business/la1826님의블로그를-찾는-독자를-위한-…
 */

import {
  normalizeNaverBlogUrl,
  isNaverBlogHomeUrl,
  looksLikeBlogNameTitle,
} from '../src/core/final/naver-blog-url';

describe('네이버 블로그 주소를 본문이 보이는 주소로 바꾼다', () => {
  test('사고를 낸 그 주소', () => {
    expect(normalizeNaverBlogUrl('https://blog.naver.com/la1826/224394201101'))
      .toBe('https://m.blog.naver.com/la1826/224394201101');
  });

  test('쿼리가 붙어 있어도 글 번호를 살린다', () => {
    expect(normalizeNaverBlogUrl('https://blog.naver.com/la1826/224394201101?fromRss=true&trackingCode=rss'))
      .toBe('https://m.blog.naver.com/la1826/224394201101');
  });

  test('PostView 형태', () => {
    expect(normalizeNaverBlogUrl('https://blog.naver.com/PostView.naver?blogId=la1826&logNo=224394201101'))
      .toBe('https://m.blog.naver.com/la1826/224394201101');
  });

  test('옛 blog.me 주소', () => {
    expect(normalizeNaverBlogUrl('https://la1826.blog.me/224394201101'))
      .toBe('https://m.blog.naver.com/la1826/224394201101');
  });

  test('이미 모바일이면 그대로', () => {
    expect(normalizeNaverBlogUrl('https://m.blog.naver.com/la1826/224394201101'))
      .toBe('https://m.blog.naver.com/la1826/224394201101');
  });

  test('네이버 블로그가 아니면 손대지 않는다', () => {
    const other = 'https://www.mss.go.kr/site/smba/foffice/ex/bbs/View.do?cbIdx=86&bcIdx=1234';
    expect(normalizeNaverBlogUrl(other)).toBe(other);
    expect(normalizeNaverBlogUrl('https://leadernam.com/subsidy/local-business/abc/'))
      .toBe('https://leadernam.com/subsidy/local-business/abc/');
  });
});

describe('블로그 홈은 글이 아니다', () => {
  test('글 번호가 없으면 홈', () => {
    expect(isNaverBlogHomeUrl('https://blog.naver.com/la1826')).toBe(true);
    expect(isNaverBlogHomeUrl('https://blog.naver.com/la1826/')).toBe(true);
  });

  test('글 주소는 홈이 아니다', () => {
    expect(isNaverBlogHomeUrl('https://blog.naver.com/la1826/224394201101')).toBe(false);
    expect(isNaverBlogHomeUrl('https://blog.naver.com/PostView.naver?blogId=la1826&logNo=1')).toBe(false);
  });
});

describe('제목이 블로그 이름이면 주제로 쓰지 않는다', () => {
  test('실제로 주제가 됐던 그 문자열', () => {
    expect(looksLikeBlogNameTitle('la1826님의블로그')).toBe(true);
    expect(looksLikeBlogNameTitle('la1826님의블로그 : 네이버 블로그')).toBe(true);
  });

  test('다른 블로그 이름 꼴', () => {
    expect(looksLikeBlogNameTitle('네이버 블로그')).toBe(true);
    expect(looksLikeBlogNameTitle('행복한 하루의 블로그')).toBe(true);
    expect(looksLikeBlogNameTitle('티스토리')).toBe(true);
  });

  test('진짜 글 제목은 통과한다', () => {
    expect(looksLikeBlogNameTitle('혁신성장촉진자금 비즈스캔 총정리! 신청·조건·실사·서류')).toBe(false);
    expect(looksLikeBlogNameTitle('블로그 글쓰기 잘하는 법 7가지')).toBe(false);
    expect(looksLikeBlogNameTitle('')).toBe(false);
  });
});
