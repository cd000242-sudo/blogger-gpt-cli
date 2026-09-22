/**
 * 748-quality-fix-2 (C) — Final Judge 는 실제로 보이는 글을 본다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseVisibleArticle, visiblePlainText } from '../src/core/final/visible-article';

const LIVE = path.join(__dirname, '..', 'quality-run-output', 'evidence-regression-live-loop', '경주_APEC_기간_숙소_예약', 'L-final-article.html');

const SAMPLE = `
<div class="bgpt-content"><div class="white-paper">
<h1 class="post-title">경주 APEC 기간 숙소 예약, 남은 객실은</h1>
<section class="answer-first"><p class="answer-first-q">언제 예약해야 하나요?</p><p class="answer-first-a">행사 3~6개월 전입니다.</p><p class="answer-first-basis">경주시 12,800객실 기준</p></section>
<div class="content intro-section" style="x"><p>도입 첫 문단입니다.</p><p>도입에서 던지는 질문은 무엇일까요?</p></div>
<div class="summary-container"><h3>핵심 요약</h3><table><tr><td>객실</td><td>12,800</td></tr></table></div>
<div class="toc-grid-container"><h3>목차</h3><div class="toc-grid"><a>1. 예약 시기</a></div></div>
<h2>1. 예약 시기</h2><h3>언제가 좋은가</h3><div class="content"><p class="article-p">행사 3~6개월 전이 기준입니다.</p><ul><li>5월</li></ul></div>
<div class="cta-box"><p class="cta-hook"><strong>남은 객실은 경주시 안내에서 확인</strong></p><a class="cta-btn" href="https://www.gyeongju.go.kr/">경주시 안내 보기</a></div>
<h2>2. 객실 현황</h2><h3>보문단지</h3><div class="content"><p>보문단지 객실은 12,800실 가운데 일부입니다.</p></div><h3>시내</h3><div class="content"><p>시내 숙소는 황리단길 근처입니다.</p></div>
<h2>자주 묻는 질문 (FAQ)</h2>
<details><summary>Q. 취소 규정은 어디서 보나요? ▼</summary><div><p>예약 화면의 취소 규정 칸에서 봅니다.</p></div></details>
<details><summary>Q. 셔틀은 있나요? ▼</summary><div><p>대구역 셔틀 6회입니다.</p></div></details>
<script type="application/ld+json">{"@type":"FAQPage"}</script>
<div class="content conclusion-section" style="y"><p>3~6개월 전이라면 됩니다. 행사 직전이라면 안 됩니다.</p></div>
<div class="disclaimer">※ 본 글은 정보 제공 목적입니다.</div>
</div></div>`;

describe('748 (C) parseVisibleArticle — 조립된 HTML 을 글 구조로 되읽는다', () => {
  test('C-1 제목·도입(답 상자 포함)·절/h3·FAQ·CTA·결론·요약을 나눈다', () => {
    const a = parseVisibleArticle(SAMPLE);
    expect(a.title).toBe('경주 APEC 기간 숙소 예약, 남은 객실은');
    expect(a.introduction).toContain('answer-first-q');
    expect(a.introduction).toContain('도입 첫 문단');
    expect(a.sections.map((s) => s.h2)).toEqual(['1. 예약 시기', '2. 객실 현황']);
    expect(a.sections[1]!.h3Sections.map((h) => h.h3)).toEqual(['보문단지', '시내']);
    expect(a.sections[0]!.h3Sections[0]!.content).toContain('3~6개월 전이 기준');
    expect(a.faqItems).toEqual([
      { question: '취소 규정은 어디서 보나요?', answer: '예약 화면의 취소 규정 칸에서 봅니다.' },
      { question: '셔틀은 있나요?', answer: '대구역 셔틀 6회입니다.' },
    ]);
    expect(a.ctaText).toContain('남은 객실은 경주시 안내에서 확인');
    expect(a.ctaText).toContain('https://www.gyeongju.go.kr/');
    expect(a.conclusion).toContain('행사 직전이라면 안 됩니다');
    expect(a.summaryText).toContain('12,800');
    expect(a.notes).toEqual([]);
  });

  test('C-2 목차·JSON-LD·면책은 절이 되지 않는다 · FAQ h2 는 절 목록에서 빠진다', () => {
    const a = parseVisibleArticle(SAMPLE);
    const text = visiblePlainText(a);
    expect(text).not.toContain('FAQPage');
    expect(text).not.toContain('정보 제공 목적');
    expect(a.sections.some((s) => /자주 묻는/.test(s.h2))).toBe(false);
  });

  test('C-3 CTA 상자가 절 사이에 있어도 절 본문에 그 후크가 섞이지 않게 CTA 는 따로 나온다', () => {
    const a = parseVisibleArticle(SAMPLE);
    // CTA 는 절 1 조각 안에 남아 있을 수 있지만(조립 위치), 심사용 CTA 글자는 ctaText 로 따로 읽힌다
    expect(a.ctaText.split('\n')).toHaveLength(1);
  });

  test('C-4 조립기 class 가 없으면 notes 에 남기고 예외는 없다', () => {
    const a = parseVisibleArticle('<p>hello</p>');
    expect(a.title).toBe('');
    expect(a.sections).toEqual([]);
    expect(a.notes).toEqual(expect.arrayContaining(['h1 없음', 'intro-section 없음', 'conclusion-section 없음', 'h2 절 없음']));
  });

  (fs.existsSync(LIVE) ? test : test.skip)('C-5 live 최종 HTML(경주 APEC): 절 7 · FAQ 5 · 도입에 실제 첫 문장 · 결론 있음', () => {
    const a = parseVisibleArticle(fs.readFileSync(LIVE, 'utf8'));
    expect(a.sections).toHaveLength(7);
    expect(a.faqItems).toHaveLength(5);
    expect(a.introduction).toContain('경주 APEC 기간 숙소 예약을 찾는 경우');
    expect(a.conclusion.length).toBeGreaterThan(100);
    expect(a.notes).toEqual([]);
  });
});
