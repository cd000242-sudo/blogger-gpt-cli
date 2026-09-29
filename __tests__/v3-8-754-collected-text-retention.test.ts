const fs = require('fs');
const path = require('path');

import { extractNaverPostBody, DEFAULT_MAX_BODY_CHARS } from '../src/core/crawlers/naver-post-body';
import { extractArticleBody, DEFAULT_MAX_ARTICLE_CHARS } from '../src/core/crawlers/article-body';
import { extractOfficialPageBody, fetchPageDocument, DEFAULT_MAX_PAGE_CHARS } from '../src/core/crawlers/official-page-body';
import { RETAINED_TEXT_CHARS, retainText } from '../src/core/crawlers/evidence-clean';
import { judgeEvidence, assembleEvidence, renderEvidence } from '../src/core/final/evidence';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

/*
 * v3.8.754 — 수집 원문 보존과 모델 전달 발췌를 분리한다.
 *
 * 실제 run 1b7d92 에서 확인한 것(A형): 세 추출기가 정제 본문을 확보한 뒤 `slice(0, maxChars)` 로 잘라 **잘린 문자열만**
 * 돌려줬다(rawLength 숫자만 남음). 블로그 두 편의 무기여 구간·특별중도해지 문장은 1,200자 뒤에 있어 로컬에도 남지 않았다.
 *
 * SYNTHETIC_FIXTURE — 그 실행의 원문 HTML 은 보존돼 있지 않아(스냅샷은 발췌만) 긴 본문은 합성 문장으로 만든다.
 * 실제 누락 문장을 복원한 것이 아니다. 실제 자료로 하는 확인은 v3-8-754-range-condition 에 있다.
 */
const PROSE = (n: number, tag = '') => Array.from({ length: n }, (_, i) => `청년 자산형성 상품의 ${tag}기본 안내 ${i + 1}번째 문장은 가입 절차와 은행 창구 이용 방법을 설명합니다.`).join(' ');
const LATE_CONDITION = '총급여가 6,000만 원을 넘고 7,500만 원 이하라면 정부 기여금은 받지 못하지만 이자소득 비과세 혜택은 받을 수 있습니다.';

describe('v3.8.754 수집 원문 보존 (SYNTHETIC_FIXTURE)', () => {
  test('T21 네이버 본문: text 는 여전히 1,200자 발췌, fullText 에 1,200자 뒤 조건 문장이 남는다', () => {
    const body = `${PROSE(40)} ${LATE_CONDITION} ${PROSE(3, '맺음말 ')}`;
    expect(body.indexOf(LATE_CONDITION)).toBeGreaterThan(DEFAULT_MAX_BODY_CHARS);
    const r = extractNaverPostBody(`<html><body><div class="se-main-container"><p>${body}</p></div></body></html>`)!;
    expect(r.text.length).toBe(DEFAULT_MAX_BODY_CHARS);                 // 발췌 정책은 그대로
    expect(r.text).not.toContain(LATE_CONDITION);
    expect(r.fullText).toContain(LATE_CONDITION);                        // 로컬 보존
    expect(r.fullText!.startsWith(r.text)).toBe(true);                   // 발췌는 보존 본문의 앞부분
    expect(r.truncatedAt).toBeNull();                                    // 상한 안이면 잘리지 않았다고 표시
  });

  test('T21b 보존도 무제한이 아니다 — 상한을 넘으면 잘린 위치를 남긴다', () => {
    const huge = PROSE(200);
    expect(huge.length).toBeGreaterThan(RETAINED_TEXT_CHARS);
    const r = extractNaverPostBody(`<html><body><div class="se-main-container"><p>${huge}</p></div></body></html>`)!;
    expect(r.fullText!.length).toBe(RETAINED_TEXT_CHARS);
    expect(r.truncatedAt).toBe(RETAINED_TEXT_CHARS);
    expect(retainText('짧다')).toEqual({ fullText: '짧다', truncatedAt: null });
    expect(RETAINED_TEXT_CHARS).toBe(6000);                              // 상한 값·근거는 evidence-clean 주석에
  });

  test('T22 기사 본문(1,200)·기관 페이지(900)도 같은 원칙', async () => {
    const body = `${PROSE(40)} ${LATE_CONDITION}`;
    const article = extractArticleBody(`<html><body><div class="article-body"><p>${body}</p></div></body></html>`)!;
    expect(article.text.length).toBe(DEFAULT_MAX_ARTICLE_CHARS);
    expect(article.fullText).toContain(LATE_CONDITION);
    expect(article.truncatedAt).toBeNull();

    const pageHtml = `<html><body><div id="contents"><p>${PROSE(30)} ${LATE_CONDITION}</p></div></body></html>`;
    const page = extractOfficialPageBody(pageHtml)!;
    expect(page.text.length).toBe(DEFAULT_MAX_PAGE_CHARS);
    expect(page.text).not.toContain(LATE_CONDITION);
    expect(page.fullText).toContain(LATE_CONDITION);

    // grounding 이 부르는 fetchPageDocument 도 fullText 를 넘긴다 — 요청은 한 번뿐이다
    const calls: string[] = [];
    const realFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (url: string) => { calls.push(url); return { ok: true, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => pageHtml }; };
    try {
      const doc = (await fetchPageDocument('https://www.example.go.kr/notice/1', DEFAULT_MAX_PAGE_CHARS))!;
      expect(calls).toHaveLength(1);
      expect(doc.text.length).toBe(DEFAULT_MAX_PAGE_CHARS);
      expect(doc.fullText).toContain(LATE_CONDITION);
      expect(doc.truncatedAt).toBeNull();
    } finally { (globalThis as any).fetch = realFetch; }
  });

  test('T23 배선 — 크롤러·grounding 이 보존 본문을 실어 주고, 근거 장부는 그것으로 판정한다. 프롬프트용 발췌는 그대로', () => {
    const crawler = read('src/core/content-crawler.ts');
    expect(crawler).toContain('if (body.fullText) { item.fullText = body.fullText; item.fullTextTruncatedAt = body.truncatedAt ?? null; }');
    expect(crawler).toContain('retainedFull = this.cleanHTMLContent(body.fullText)');
    expect(crawler).toContain('...(retainedFull ? { fullText: retainedFull, fullTextTruncatedAt: retainedTruncatedAt } : {})');
    expect(crawler).toContain('content = body.text;');                    // 발췌(content)는 예전 그대로

    const grounding = read('src/core/final/naver-grounding.ts');
    expect(grounding).toContain('pageFull.set(url, { text: doc.fullText, truncatedAt: doc.truncatedAt ?? null })');
    expect(grounding).toContain('text: (full && full.text) || body || stripTags(it?.description)');
    expect(grounding).toContain('const BODY_CHARS = 900;');                // 발췌 상한 불변
    expect(grounding).toContain('const MAX_SNIPPET_CHARS = 9000;');        // 프롬프트에 실리는 grounding 글 상한 불변
    expect(grounding).toContain('const BODY_FETCH_MAX = 6;');              // 페이지 요청 횟수 불변

    const orch = read('src/core/final/orchestration.ts');
    const judge = blockBetween(orch, 'const judgeCrawledPosts = (): void => {', 'judgeCrawledPosts();');
    // v3.8.755 — 판정 초안은 브리지(crawled-post-bridge)가 만든다: 보존 본문으로 판정, relevantPosts 는 발췌 길이
    expect(judge).toContain('bridgeCrawledPost(post, keyword)');
    const bridge = read('src/core/final/crawled-post-bridge.ts');
    expect(bridge).toContain('cleanEvidenceText(hasFull ? post.fullText : content)');
    expect(bridge).toContain('relevantContent: hasFull ? cleaned.text.slice(0, content.length) : cleaned.text');
    expect(orch).toMatch(/renderEvidence\(evidenceItems, 11000[,)]/);      // LLM 근거 예산 불변(765: 옵션이 붙어도 예산은 11000)
    expect(read('src/core/crawlers/naver-post-body.ts')).toContain('export const DEFAULT_MAX_BODY_CHARS = 1200;');
    expect(read('src/core/crawlers/article-body.ts')).toContain('export const DEFAULT_MAX_ARTICLE_CHARS = 1200;');
  });

  test('T24 보존한 뒤쪽 조건이 근거 장부를 지나 11,000자 예산 안에서 전달된다 — 예산은 늘지 않는다', () => {
    const late = `${PROSE(40)} ${LATE_CONDITION} 우대형은 총급여 3,600만 원 이하 또는 연매출 1억 원 이하인 소상공인이어야 합니다.`;
    const v = judgeEvidence({ title: '청년미래적금 갈아타기 조건 정리', url: 'https://m.blog.naver.com/x/1', tag: '블로그', query: '청년미래적금', text: late, hasBody: true, truncatedAt: null }, '청년미래적금');
    expect(v.item).toBeDefined();
    expect(v.item!.truncatedAt).toBeNull();
    expect(v.item!.cleanedText).toContain(LATE_CONDITION);
    // 잘린 자료는 잘렸다고 남는다
    expect(judgeEvidence({ title: '청년미래적금 안내', url: 'https://m.blog.naver.com/x/2', tag: '블로그', query: '청년미래적금', text: late, hasBody: true, truncatedAt: 6000 }, '청년미래적금').item!.truncatedAt).toBe(6000);

    const noise = Array.from({ length: 12 }, (_, i) => ({ title: `청년미래적금 소식 ${i}`, url: `https://news.example.com/a/${i}`, tag: '뉴스', query: '청년미래적금', text: PROSE(30, `${i}차 `), hasBody: true }));
    const items = assembleEvidence([v.item!, ...noise.map((n) => judgeEvidence(n, '청년미래적금').item!)].map((i) => ({ ...i, mainKeyword: '청년미래적금' })), '2026-09-29');
    const r = renderEvidence(items, 11000);
    expect(r.text.length).toBeLessThanOrEqual(11000);
    expect(r.text).toContain('받지 못하지만 이자소득 비과세 혜택은 받을 수 있습니다');
    const sel = r.selection.find((s) => s.id === items.find((i) => i.url.endsWith('/x/1'))!.id)!;
    expect(sel.delivered).toBe(true);
    expect(sel.chars).toBeLessThan(late.length);                          // 통째로 넣지 않는다
  });
});
