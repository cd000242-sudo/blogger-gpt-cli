/**
 * v3.8.475 — 네이버 뉴스의 실제 기사 본문을 쓰지 않던 문제.
 *
 * crawlFromNaverNews 는 이미 돌면서 검색 API 가 준 originallink(실제 기사 주소)를
 * 버리고 description 150자만 재료로 썼다. 따라가면 본문이 통째로 나온다
 * (실측 2026-08-11: 연합뉴스 4,152자 · 한국경제 26,442자).
 *
 * 고르는 방식이 핵심이다. 실측 한국경제 기사 —
 *   article-body  1,836자 · 껍데기 잡음 0   ← 본문
 *   <article>     3,406자 · 껍데기 잡음 8   ← 페이지 껍데기
 * **길이로 고르면 껍데기를 집는다.**
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { extractArticleBody, DEFAULT_MAX_ARTICLE_CHARS } from '../src/core/crawlers/article-body';

const prose = (n: number) =>
  '전기차 보조금은 국고와 지자체로 나뉩니다. 올해 국고 보조금은 최대 650만원입니다. '.repeat(n);

describe('extractArticleBody — 껍데기 대신 본문을 고른다', () => {
  it('더 긴 껍데기가 있어도 잡음 적은 본문을 고른다 (한국경제 실측 재현)', () => {
    const html = `
      <html><body>
        <article>
          구독하기 로그인 추천 뉴스 팝업 닫기 전체보기 바로가기 공유하기 글자크기
          <div class="article-body">${prose(12)}</div>
          많이 본 뉴스 기사입력
        </article>
      </body></html>`;

    const body = extractArticleBody(html);

    expect(body).not.toBeNull();
    expect(body!.text).toContain('650만원');
    // 껍데기 문구가 섞이면 안 된다 = <article> 후보를 안 골랐다는 뜻
    expect(body!.text).not.toContain('추천 뉴스');
    expect(body!.text).not.toContain('구독하기');
  });

  it('중첩 div 를 넘어 본문 끝까지 가져온다 (비탐욕 매칭 회귀 잠금)', () => {
    // 본문 하한(200자)은 사이드바·기자소개를 거르려고 둔 값이라 픽스처도 기사 길이로 만든다
    const html = `<html><body><div class="article-body">
      <div class="photo"><img src="x.jpg" /></div>
      <p>신청 마감은 3월 31일입니다. ${prose(3)}</p>
      <div class="ad"><span>광고</span></div>
      <p>지원 한도는 5%이고 처리에 14일 이내가 걸립니다. ${prose(3)}</p>
    </div></body></html>`;

    const body = extractArticleBody(html);

    expect(body!.text).toContain('3월 31일');
    expect(body!.text).toContain('14일 이내');   // 첫 중첩 div 에서 안 끊겼다
  });

  it('버튼·캡션 UI 조각을 걷어낸다 (연합뉴스·매일경제 실측)', () => {
    const html = `<html><body><div class="article-body">
      김채린 기자 구독 구독중 이전 다음 이미지 확대 사진 확대 ${prose(8)}
    </div></body></html>`;

    const body = extractArticleBody(html);

    expect(body!.text).not.toContain('구독중');
    expect(body!.text).not.toContain('이미지 확대');
    expect(body!.text).toContain('650만원');
  });

  it('저작권 꼬리를 잘라낸다', () => {
    const html = `<html><body><div class="article-body">${prose(10)}
      무단 전재 및 재배포 금지 저작권자 ⓒ 연합뉴스 reporter@yna.co.kr
    </div></body></html>`;

    expect(extractArticleBody(html)!.text).not.toContain('무단 전재');
  });

  it('제목 나열 목록은 본문이 아니다 (문장 종결 밀도 하한)', () => {
    const list = Array.from({ length: 40 }, (_, i) => `<a href="/n/${i}">전기차 보조금 관련 소식 ${i}</a>`).join(' ');
    expect(extractArticleBody(`<html><body><div class="article-body">${list}</div></body></html>`)).toBeNull();
  });

  it('본문이 없으면 null — 호출부가 description 으로 폴백한다', () => {
    expect(extractArticleBody('<html><body><div class="sidebar">광고</div></body></html>')).toBeNull();
    expect(extractArticleBody('')).toBeNull();
  });

  it('기사당 글자수를 제한해 여러 편의 재료 폭을 지킨다', () => {
    const body = extractArticleBody(`<html><body><div class="article-body">${prose(200)}</div></body></html>`);
    expect(body!.rawLength).toBeGreaterThan(DEFAULT_MAX_ARTICLE_CHARS);
    expect(body!.text.length).toBe(DEFAULT_MAX_ARTICLE_CHARS);
  });
});

describe('crawlFromNaverNews 배선', () => {
  const crawler = readFileSync(join(__dirname, '..', 'src/core/content-crawler.ts'), 'utf8');

  it('originallink 를 보관한다 (예전엔 버렸다)', () => {
    expect(crawler).toContain('originalLink: String(item.originallink || item.link');
  });

  it('상위 3건의 본문을 실제로 가져온다', () => {
    expect(crawler).toContain('await this.enrichNewsWithBodies(contents.slice(0, 3))');
    expect(crawler).toContain('extractArticleBody');
  });

  it('본문 확보 실패가 뉴스 수집을 막지 않는다 (원본 유지 + 타임아웃)', () => {
    const fn = crawler.slice(
      crawler.indexOf('private async enrichNewsWithBodies'),
      crawler.indexOf('private async enrichNewsWithBodies') + 1600,
    );
    expect(fn).toContain('AbortSignal.timeout(8000)');
    expect(fn).toContain('catch');
    // description 보다 짧으면 교체하지 않는다
    expect(fn).toContain('body.text.length <= String(item.content || \'\').length');
  });
});
