// test/external-traffic/unit/post-format.test.js
// postFormat — paragraphRule 기반 출력 정리 검증.

'use strict';

const {
  postFormat,
  wrapLines,
  splitMultiOutput,
  extractHashtags,
  computeMaxEmptyLines,
  SEPARATOR_EMOJI,
} = require('../../../src/core/external-traffic/_shared/post-format');

const INSTAGRAM = require('../../../src/core/external-traffic/prompts/sns/instagram');
const THREADS = require('../../../src/core/external-traffic/prompts/sns/threads');
const X = require('../../../src/core/external-traffic/prompts/sns/x');
const FACEBOOK = require('../../../src/core/external-traffic/prompts/sns/facebook');
const PINTEREST = require('../../../src/core/external-traffic/prompts/sns/pinterest');
const NAVER_BLOG = require('../../../src/core/external-traffic/prompts/naver/blog');

describe('computeMaxEmptyLines', () => {
  test('none → 0', () => {
    expect(computeMaxEmptyLines({ paragraphBreak: 'none' })).toBe(0);
  });
  test('single → 0', () => {
    expect(computeMaxEmptyLines({ paragraphBreak: 'single' })).toBe(0);
  });
  test('double → 1', () => {
    expect(computeMaxEmptyLines({ paragraphBreak: 'double' })).toBe(1);
  });
  test('emptyLineMaxConsecutive 명시 시 우선', () => {
    expect(computeMaxEmptyLines({ paragraphBreak: 'double', emptyLineMaxConsecutive: 0 })).toBe(0);
    expect(computeMaxEmptyLines({ paragraphBreak: 'single', emptyLineMaxConsecutive: 2 })).toBe(2);
  });
});

describe('wrapLines', () => {
  test('짧은 줄은 그대로', () => {
    expect(wrapLines('짧음', 10)).toBe('짧음');
  });
  test('한국어 어절 경계로 wrap', () => {
    const result = wrapLines('이것은 아주 긴 문장입니다 그리고 더 깁니다', 10);
    const lines = result.split('\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(12);
    }
  });
  test('maxChars 초과 단어 강제 분할', () => {
    const result = wrapLines('aaaaaaaaaaaaaaaa', 5);
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(5);
    }
  });
  test('빈 줄 보존', () => {
    expect(wrapLines('A\n\nB', 10)).toBe('A\n\nB');
  });
});

describe('extractHashtags', () => {
  test('빈 줄 이후 해시태그 분리', () => {
    const out = extractHashtags('본문 내용입니다\n\n#태그1 #태그2 #태그3');
    expect(out.body).toBe('본문 내용입니다');
    expect(out.hashtags).toEqual(['#태그1', '#태그2', '#태그3']);
  });
  test('해시태그 없으면 빈 배열', () => {
    const out = extractHashtags('본문만 있음');
    expect(out.body).toBe('본문만 있음');
    expect(out.hashtags).toEqual([]);
  });
  test('본문에 섞여 있어도 추출', () => {
    const out = extractHashtags('본문 #중간태그 끝');
    expect(out.hashtags).toContain('#중간태그');
  });
});

describe('splitMultiOutput', () => {
  test('Tweet 1/2 헤더 분리', () => {
    const text = `Tweet 1:
첫 번째 트윗 본문입니다

Tweet 2:
두 번째 트윗 본문입니다`;
    const out = splitMultiOutput(text, ['tweet1', 'tweet2']);
    expect(out.tweet1).toContain('첫 번째');
    expect(out.tweet2).toContain('두 번째');
  });
  test('[개인 계정] / [그룹 댓글] 분리', () => {
    const text = `[개인 계정]
개인 본문

[그룹 댓글]
그룹 본문`;
    const out = splitMultiOutput(text, ['personal', 'group-comment']);
    expect(out.personal).toContain('개인 본문');
    expect(out['group-comment']).toContain('그룹 본문');
  });
  test('헤더 없으면 첫 영역에 전체 할당', () => {
    const out = splitMultiOutput('헤더 없음', ['tweet1', 'tweet2']);
    expect(out.tweet1).toBe('헤더 없음');
    expect(out.tweet2).toBe('');
  });
});

describe('postFormat — Instagram', () => {
  test('뭉텅이 입력 → 줄 wrap + 빈 줄 1줄 + 이모지 분리 + 해시태그 분리', () => {
    const raw = `오늘 진짜 놀라운 정보를 발견했어요 절대 모르면 손해입니다 정보 첫 번째



두 번째 정보는 더 충격적이에요 진짜로 이걸 모르면 안돼요

세 번째는 누구나 적용 가능합니다

👉 프로필 링크 클릭 ✨

#메인태그 #중간태그 #롱테일태그 #추가1 #추가2 #추가3 #추가4 #추가5`;
    const result = postFormat(raw, INSTAGRAM);
    expect(result.body).toBeDefined();
    expect(result.hashtags).toBeDefined();
    expect(result.hashtags.length).toBeGreaterThan(0);
    // 연속 빈 줄 1줄 압축
    expect(result.body).not.toMatch(/\n{3,}/);
    // 이모지 분리 토큰 삽입
    expect(result.body).toContain(SEPARATOR_EMOJI);
    // 줄 길이 ≤ 35 (인스타 카드뉴스 캡션 기준)
    const bodyLines = result.body.split('\n').filter((l) => l.length > 0 && l !== SEPARATOR_EMOJI);
    for (const line of bodyLines) {
      expect(line.length).toBeLessThanOrEqual(35);
    }
  });
});

describe('postFormat — Threads', () => {
  test('빈 줄 1줄 + 줄 wrap + 줄 수 상한', () => {
    const raw = '첫 줄 후킹입니다\n\n\n\n본문 1\n본문 2\n본문 3\n본문 4\n본문 5\n본문 6\n본문 7\n본문 8\n본문 9\n본문 10\n본문 11\n본문 12\n본문 13\n본문 14\n본문 15';
    const result = postFormat(raw, THREADS);
    const totalLines = result.body.split('\n').filter((l) => l.trim().length > 0).length;
    expect(totalLines).toBeLessThanOrEqual(THREADS.paragraphRule.maxLines);
  });
});

describe('postFormat — X', () => {
  test('Tweet 1/2 헤더 자동 분리', () => {
    const raw = `Tweet 1:
이게 본문 미끼입니다 ↓ 댓글에 전체 내용

Tweet 2:
https://example.com/post 자세한 내용 정리`;
    const result = postFormat(raw, X);
    expect(result.parts).toBeDefined();
    expect(result.parts.tweet1).toContain('본문 미끼');
    expect(result.parts.tweet2).toContain('example.com');
  });
});

describe('postFormat — Facebook', () => {
  test('개인 계정 / 그룹 댓글 분리', () => {
    const raw = `[개인 계정]
오늘 진짜 좋은 정보를 발견했어요. 같이 보면 좋겠어요.
링크: https://example.com

[그룹 댓글]
이게 본문 미끼입니다. 좋은 자료가 있어요.
댓글:
자세한 내용은 https://example.com 입니다`;
    const result = postFormat(raw, FACEBOOK);
    expect(result.parts).toBeDefined();
    expect(result.parts.personal).toContain('진짜 좋은');
    expect(result.parts['group-comment']).toContain('미끼');
  });
});

describe('postFormat — Pinterest', () => {
  test('4영역 분리', () => {
    const raw = `Pin Title:
한국 K-Food 트렌드 2026 완벽 정리

Description:
핵심 트렌드 5개를 한 눈에 정리했습니다.
https://example.com

Board Suggestion:
한국 음식 트렌드 보드

Image Prompt:
korean food trends 2026 infographic minimal style`;
    const result = postFormat(raw, PINTEREST);
    expect(result.parts).toBeDefined();
    expect(result.parts.pinTitle).toContain('K-Food');
    expect(result.parts.description).toContain('한 눈에');
    expect(result.parts.boardSuggestion).toContain('보드');
    expect(result.parts.imagePrompt).toContain('infographic');
  });
});

describe('postFormat — Naver Blog', () => {
  test('검색형 미니 포스트는 사진 자리 자동 삽입 없이 본문을 유지', () => {
    const raw = `첫 번째 문단입니다.

두 번째 문단입니다.

세 번째 문단입니다.

네 번째 문단입니다.

다섯 번째 문단입니다.

여섯 번째 문단입니다.

📌 더 자세한 내용: https://example.com`;
    const result = postFormat(raw, NAVER_BLOG);
    expect(result.body).not.toContain('[사진 자리]');
    expect(result.body).toContain('📌');
  });
  test('해시태그가 있으면 본문과 해시태그를 분리', () => {
    const raw = '짧은 본문\n\n두 번째 문단\n\n#태그1 #태그2 #태그3 #태그4 #태그5';
    const result = postFormat(raw, NAVER_BLOG);
    expect(result.body).not.toContain('#태그1');
    expect(result.hashtags).toEqual(['#태그1', '#태그2', '#태그3', '#태그4', '#태그5']);
  });
});

describe('postFormat — null/빈 입력', () => {
  test('null 입력은 body 빈 문자열', () => {
    const out = postFormat(null, INSTAGRAM);
    expect(out.body).toBe('');
  });
  test('빈 문자열', () => {
    const out = postFormat('', INSTAGRAM);
    expect(out.body || '').toBe('');
  });
});
