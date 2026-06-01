// test/external-traffic/golden/golden.test.js
// 채널별 골든 셋 회귀 검증.
// 프롬프트 객체의 구조(필수 필드·임계값·paragraphRule)가 변경되어도 회귀 없는지 확인.
// LLM 응답이 아닌 — 고정 raw input → postFormat 결과의 형식이 채널 규칙을 만족하는지 검증.

'use strict';

const dispatcher = require('../../../src/core/external-traffic');
const { postFormat } = require('../../../src/core/external-traffic/_shared/post-format');
const { validateLength } = require('../../../src/core/external-traffic/_shared/length-guard');

const SAMPLE_INSTAGRAM_RAW = `오늘 진짜 놀라운 정보를 발견했어요

다음 3가지를 챙기면 인생이 바뀝니다

1. 첫 번째는 매일 아침 30분만 투자하면 됩니다
2. 두 번째는 누구나 적용 가능한 패턴이에요
3. 세 번째는 결과가 즉시 나옵니다

이거 진짜 모르고 살면 손해

👉 프로필 링크 클릭 ✨

#정리 #인사이트 #생활팁 #한국블로그 #실용정보 #한국 #자기계발 #습관 #루틴 #생산성`;

const SAMPLE_THREADS_RAW = `솔직히 ~ 한 사람만 좋아요

다음 3가지만 챙기면 됩니다.
1. 첫 번째 인사이트
2. 두 번째 패턴
3. 세 번째 활용법

전체 글: https://example.com/post/1`;

const SAMPLE_X_RAW = `Tweet 1:
이것만 알면 인생이 바뀌는 3가지 패턴.
↓ 댓글에 전체 내용

Tweet 2:
https://example.com/post/1
자세히 정리해뒀어요`;

const SAMPLE_FACEBOOK_RAW = `[개인 계정]
오늘 정말 유용한 정보를 발견했어요.

다음 3가지가 핵심입니다.
1. 첫 번째 인사이트
2. 두 번째 패턴
3. 세 번째 활용법

자세한 내용은 여기에 정리해뒀습니다.
https://example.com/post/1

[그룹 댓글]
오늘 좋은 자료가 있어요. 한 번 보세요!

댓글:
자세한 내용은 https://example.com/post/1 입니다`;

const SAMPLE_PINTEREST_RAW = `Pin Title:
한국 K-Food 트렌드 2026 완벽 정리 가이드

Description:
한국 음식 트렌드 5가지 핵심 패턴.
실제 검증된 데이터 기반으로 정리했습니다.
https://example.com/post/1

Board Suggestion:
한국 음식 트렌드 보드

Image Prompt:
korean food trends 2026 infographic minimal flat design`;

const SAMPLE_NAVER_BLOG_RAW = `오늘은 한국 K-Food 2026 트렌드를 정리해봤습니다. 요즘 시장 변화가 빨라서 트렌드를 놓치면 손해예요.

요즘 트렌드를 놓치면 안되는 이유는 시장이 빠르게 변하기 때문이죠. 한 분기만 늦어도 경쟁사보다 뒤처지게 됩니다. 그래서 매월 데이터를 체크하는 게 중요합니다.

첫 번째 트렌드는 발효 식품의 진화입니다. 단순한 김치를 넘어 다양한 발효 응용 사례가 늘고 있어요. 김치 베이스 소스, 발효 음료, 발효 디저트까지 영역이 확대되고 있어 시장 규모가 매년 두 자릿수 성장 중입니다.

두 번째는 비건 한식의 부상입니다. 두부와 콩으로 만든 다양한 신메뉴가 인기를 끌고 있습니다. 환경 의식과 건강 트렌드가 동시에 작용해 비건 한식 매장 수가 작년 대비 40% 증가했습니다.

세 번째는 K-디저트의 글로벌화입니다. 떡볶이부터 호떡까지 해외 진출이 활발해요. 미국 LA·뉴욕, 일본 도쿄, 베트남 호치민에 K-디저트 매장이 잇따라 오픈 중입니다.

네 번째 트렌드는 한식 밀키트의 확대입니다. 간편하게 즐길 수 있는 한식이 다양해지고 있죠. 1인 가구가 늘면서 한식 밀키트 시장이 빠르게 성장하고 있어요.

다섯 번째는 전통 발효주의 재해석입니다. 막걸리부터 청주까지 프리미엄 라인업이 늘었어요. 와인 페어링처럼 한식과 발효주를 결합한 다이닝 코스도 인기를 얻고 있습니다.

여섯 번째 트렌드는 한식 비건 디저트입니다. 식물성 재료로 만든 한식 디저트가 화제예요. 콩으로 만든 빙수, 곡물 기반 케이크 등이 SNS에서 빠르게 확산되고 있습니다.

📌 더 자세한 내용: https://example.com/post/1`;

describe('Golden — Instagram', () => {
  const channel = dispatcher.getChannel('instagram');
  const result = postFormat(SAMPLE_INSTAGRAM_RAW, channel);

  test('body 정의됨', () => {
    expect(result.body).toBeTruthy();
  });
  test('hashtags 5~30개', () => {
    expect(result.hashtags.length).toBeGreaterThanOrEqual(5);
    expect(result.hashtags.length).toBeLessThanOrEqual(30);
  });
  test('연속 빈 줄 1개 이하', () => {
    expect(result.body).not.toMatch(/\n{3,}/);
  });
  test('이모지 분리 토큰 ✨ 포함', () => {
    expect(result.body).toContain('✨');
  });
  test('CTA 포함', () => {
    expect(result.body).toContain('프로필 링크');
  });
  test('길이 검증 통과', () => {
    expect(validateLength(result, channel)).toEqual([]);
  });
  test('위험 평가 low band', () => {
    const flat = result.body + ' ' + result.hashtags.join(' ');
    const risk = channel.assessRisk(flat);
    expect(risk.band).toBe('low');
  });
});

describe('Golden — Threads', () => {
  const channel = dispatcher.getChannel('threads');
  const result = postFormat(SAMPLE_THREADS_RAW, channel);

  test('body 정의됨', () => {
    expect(result.body).toBeTruthy();
  });
  test('500자 이내', () => {
    expect(result.body.length).toBeLessThanOrEqual(500);
  });
  test('연속 빈 줄 없음 (single break)', () => {
    expect(result.body).not.toMatch(/\n{2,}/);
  });
  test('URL 포함 (CTA)', () => {
    expect(result.body).toContain('example.com');
  });
});

describe('Golden — X', () => {
  const channel = dispatcher.getChannel('x');
  const result = postFormat(SAMPLE_X_RAW, channel);

  test('parts.tweet1 / tweet2 분리', () => {
    expect(result.parts).toBeDefined();
    expect(result.parts.tweet1).toBeTruthy();
    expect(result.parts.tweet2).toBeTruthy();
  });
  test('Tweet 1에는 URL 없음 (도달 보호)', () => {
    expect(result.parts.tweet1).not.toMatch(/https?:\/\//);
  });
  test('Tweet 2에는 URL 포함', () => {
    expect(result.parts.tweet2).toMatch(/https?:\/\//);
  });
  test('각 tweet ≤ 280자', () => {
    expect(result.parts.tweet1.length).toBeLessThanOrEqual(280);
    expect(result.parts.tweet2.length).toBeLessThanOrEqual(280);
  });
  test('길이 검증 통과', () => {
    expect(validateLength(result, channel)).toEqual([]);
  });
});

describe('Golden — Facebook', () => {
  const channel = dispatcher.getChannel('facebook');
  const result = postFormat(SAMPLE_FACEBOOK_RAW, channel);

  test('parts.personal / group-comment 분리', () => {
    expect(result.parts).toBeDefined();
    expect(result.parts.personal).toBeTruthy();
    expect(result.parts['group-comment']).toBeTruthy();
  });
  test('personal에는 URL OK', () => {
    expect(result.parts.personal).toMatch(/https?:\/\//);
  });
  test('길이 검증 통과', () => {
    expect(validateLength(result, channel)).toEqual([]);
  });
});

describe('Golden — Pinterest', () => {
  const channel = dispatcher.getChannel('pinterest');
  const result = postFormat(SAMPLE_PINTEREST_RAW, channel);

  test('4 영역 모두 분리', () => {
    expect(result.parts).toBeDefined();
    expect(result.parts.pinTitle).toBeTruthy();
    expect(result.parts.description).toBeTruthy();
    expect(result.parts.boardSuggestion).toBeTruthy();
    expect(result.parts.imagePrompt).toBeTruthy();
  });
  test('Pin Title ≤ 100자', () => {
    expect(result.parts.pinTitle.length).toBeLessThanOrEqual(100);
  });
  test('Description ≤ 500자', () => {
    expect(result.parts.description.length).toBeLessThanOrEqual(500);
  });
  test('길이 검증 통과', () => {
    expect(validateLength(result, channel)).toEqual([]);
  });
});

describe('Golden — Naver Blog', () => {
  const channel = dispatcher.getChannel('naver-blog');
  const result = postFormat(SAMPLE_NAVER_BLOG_RAW, channel);

  test('[사진 자리] 자동 삽입 (3문단마다)', () => {
    expect(result.body).toContain('[사진 자리]');
    const photoCount = (result.body.match(/\[사진 자리\]/g) || []).length;
    expect(photoCount).toBeGreaterThanOrEqual(1);
  });
  test('CTA 박스 (📌 더 자세한 내용) 포함', () => {
    expect(result.body).toContain('📌');
    expect(result.body).toContain('example.com');
  });
  test('800자 이상 (D.I.A 임계)', () => {
    expect(result.body.length).toBeGreaterThan(800);
  });
});

describe('Golden — 모든 채널 메타 검증', () => {
  test('모든 채널 필수 필드 존재', () => {
    for (const ch of dispatcher.listChannels()) {
      const channel = dispatcher.getChannel(ch.id);
      expect(channel.paragraphRule).toBeDefined();
      expect(channel.bandThresholds).toBeDefined();
      expect(channel.maxOutputTokens).toBeGreaterThan(0);
      expect(typeof channel.buildSystemPrompt).toBe('function');
      expect(typeof channel.buildUserPrompt).toBe('function');
      expect(typeof channel.assessRisk).toBe('function');
      expect(channel.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  test('bandThresholds 단조 증가', () => {
    for (const ch of dispatcher.listChannels()) {
      const t = dispatcher.getChannel(ch.id).bandThresholds;
      expect(t.low).toBeLessThan(t.medium);
      expect(t.medium).toBeLessThan(t.high);
      expect(t.high).toBeLessThanOrEqual(t.critical);
    }
  });
  test('paragraphRule 일관성', () => {
    for (const ch of dispatcher.listChannels()) {
      const rule = dispatcher.getChannel(ch.id).paragraphRule;
      if (rule.splitOutput) {
        expect(Array.isArray(rule.splitOutput)).toBe(true);
        expect(rule.splitOutput.length).toBeGreaterThan(0);
      }
      // multi-output 전용 채널(쇼츠/틱톡 등)은 maxLineChars 미정의 허용.
      if (rule.maxLineChars !== undefined && rule.maxLineChars !== 'no-limit') {
        expect(typeof rule.maxLineChars).toBe('number');
        expect(rule.maxLineChars).toBeGreaterThan(0);
      }
    }
  });
});
