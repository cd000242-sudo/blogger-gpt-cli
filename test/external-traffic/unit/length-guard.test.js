// test/external-traffic/unit/length-guard.test.js
// 채널별 길이 검증 + 재시도 힌트.

'use strict';

const {
  validateLength,
  buildRetryHint,
  CHANNEL_LENGTH_LIMITS,
} = require('../../../src/core/external-traffic/_shared/length-guard');

const INSTAGRAM = require('../../../src/core/external-traffic/prompts/sns/instagram');
const X = require('../../../src/core/external-traffic/prompts/sns/x');
const NAVER_BLOG = require('../../../src/core/external-traffic/prompts/naver/blog');

describe('validateLength — Instagram', () => {
  test('정상 길이는 빈 violations', () => {
    const f = { body: 'a'.repeat(1500), hashtags: ['#a', '#b', '#c', '#d', '#e', '#f'] };
    expect(validateLength(f, INSTAGRAM)).toEqual([]);
  });
  test('본문 초과 감지', () => {
    const f = { body: 'a'.repeat(3000), hashtags: ['#a', '#b', '#c', '#d', '#e'] };
    const v = validateLength(f, INSTAGRAM);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0]).toContain('본문');
  });
  test('해시태그 하한 미달 감지', () => {
    const f = { body: 'a'.repeat(1500), hashtags: ['#a'] };
    const v = validateLength(f, INSTAGRAM);
    expect(v.some((s) => s.includes('해시태그'))).toBe(true);
  });
  test('해시태그 상한 초과 감지', () => {
    const f = { body: 'a'.repeat(1500), hashtags: Array(35).fill('#x') };
    const v = validateLength(f, INSTAGRAM);
    expect(v.some((s) => s.includes('해시태그'))).toBe(true);
  });
});

describe('validateLength — X parts', () => {
  test('정상 트윗 1/2 길이', () => {
    const f = { parts: { tweet1: 'a'.repeat(200), tweet2: 'b'.repeat(150) } };
    expect(validateLength(f, X)).toEqual([]);
  });
  test('Tweet 1 280자 초과', () => {
    const f = { parts: { tweet1: 'a'.repeat(300), tweet2: 'b'.repeat(150) } };
    const v = validateLength(f, X);
    expect(v.some((s) => s.includes('tweet1'))).toBe(true);
  });
});

describe('validateLength — Naver Blog', () => {
  test('본문 하한 800자 미만', () => {
    const f = { body: 'a'.repeat(500) };
    const v = validateLength(f, NAVER_BLOG);
    expect(v.some((s) => s.includes('하한'))).toBe(true);
  });
});

describe('buildRetryHint', () => {
  test('위반 없음 → 빈 문자열', () => {
    expect(buildRetryHint([])).toBe('');
  });
  test('위반 있음 → 보강 문구', () => {
    const hint = buildRetryHint(['본문 3000자 (상한 2200)', 'tweet1 300자 (상한 280)']);
    expect(hint).toContain('길이 제약');
    expect(hint).toContain('본문 3000');
    expect(hint).toContain('tweet1 300');
  });
});

describe('CHANNEL_LENGTH_LIMITS', () => {
  test('6채널 모두 정의됨', () => {
    expect(CHANNEL_LENGTH_LIMITS.instagram).toBeDefined();
    expect(CHANNEL_LENGTH_LIMITS.threads).toBeDefined();
    expect(CHANNEL_LENGTH_LIMITS.x).toBeDefined();
    expect(CHANNEL_LENGTH_LIMITS.facebook).toBeDefined();
    expect(CHANNEL_LENGTH_LIMITS.pinterest).toBeDefined();
    expect(CHANNEL_LENGTH_LIMITS['naver-blog']).toBeDefined();
  });
});
