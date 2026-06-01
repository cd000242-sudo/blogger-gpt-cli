// test/external-traffic/unit/risk-assess.test.js
// 다축 위험 평가 — 6축 합산, band 경계, 채널별 임계값.

'use strict';

const { assessRiskMultiAxis } = require('../../../src/core/external-traffic/_shared/risk-assess');
const INSTAGRAM = require('../../../src/core/external-traffic/prompts/sns/instagram');
const X = require('../../../src/core/external-traffic/prompts/sns/x');
const NAVER_BLOG = require('../../../src/core/external-traffic/prompts/naver/blog');

describe('assessRiskMultiAxis — 정상 입력', () => {
  test('자연스러운 인스타 글은 low band', () => {
    const text = `오늘 정말 유용한 정보를 찾았어요

다음 3가지를 챙겨두세요

1. 첫 번째 인사이트
2. 두 번째 패턴
3. 세 번째 활용법

👉 프로필 링크 클릭 ✨

#정리 #인사이트 #생활팁 #한국블로그`;
    const result = INSTAGRAM.assessRisk(text);
    expect(result.score).toBeLessThan(40);
    expect(result.band).toBe('low');
  });
});

describe('assessRiskMultiAxis — 위험 입력', () => {
  test('자기 홍보 표현 감지', () => {
    const text = '안녕하세요 제 블로그 방문해주세요 구독 부탁드려요';
    const result = INSTAGRAM.assessRisk(text);
    expect(result.score).toBeGreaterThan(0);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes('제 블로그') || v.includes('방문해'))).toBe(true);
  });
  test('금기어 다수 → score 누적', () => {
    const text = '제 블로그 방문해주세요 구독 부탁드려요 안녕하세요 글쓴이입니다';
    const result = INSTAGRAM.assessRisk(text);
    expect(result.score).toBeGreaterThanOrEqual(15);
  });
  test('X 본문 트윗에 URL 있으면 critical 트리거', () => {
    const text = '본문 트윗인데 https://example.com 박혀 있음';
    const result = X.assessRisk(text);
    expect(result.axes.ctaPattern).toBe(15);
    expect(result.violations.some((v) => v.includes('URL'))).toBe(true);
  });
});

describe('assessRiskMultiAxis — band 경계', () => {
  test('인스타 thresholds: low<40 medium<65 high<85', () => {
    expect(INSTAGRAM.bandThresholds.low).toBe(40);
    expect(INSTAGRAM.bandThresholds.medium).toBe(65);
    expect(INSTAGRAM.bandThresholds.high).toBe(85);
  });
  test('네이버 블로그는 더 안전 채널 → low 컷 50', () => {
    expect(NAVER_BLOG.bandThresholds.low).toBe(50);
  });
});

describe('assessRiskMultiAxis — 축 max 상한', () => {
  test('bannedKeyword 30 상한', () => {
    const text = '제 블로그 방문해주세요 구독 부탁드려요 안녕하세요 글쓴이입니다 ' +
      '제 블로그 방문해주세요 구독 부탁드려요 안녕하세요 글쓴이입니다';
    const result = INSTAGRAM.assessRisk(text);
    expect(result.axes.bannedKeyword).toBeLessThanOrEqual(30);
  });
  test('selfPromotion 10 상한', () => {
    const text = '제 블로그입니다 내 블로그 방문해주세요 구독 부탁드려요 ' +
      '제가 운영하는 저희 블로그입니다 글쓴이입니다';
    const result = INSTAGRAM.assessRisk(text);
    expect(result.axes.selfPromotion).toBeLessThanOrEqual(10);
  });
});

describe('assessRiskMultiAxis — 빈 입력', () => {
  test('빈 문자열은 짧음 구조 페널티', () => {
    const result = INSTAGRAM.assessRisk('');
    expect(result.score).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
