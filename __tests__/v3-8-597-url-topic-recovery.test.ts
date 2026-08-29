/**
 * v3.8.597 — 제목을 못 뽑아도 본문에서 주제를 되찾는다.
 *
 * 사장님: "URL 모드에서 실패할 수가 있니?? 그럼 크롤링이 잘못된 거 아니냐??
 *          글 하나의 주소를 당연히 넣는 건데 뭔 소리야"
 *
 * v3.8.595 에서 넣었던 "글 하나의 주소를 넣어 주세요" 는 사용자 탓으로 돌리는 문구였다.
 */

import {
  buildTopicRecoveryPrompt,
  cleanRecoveredTopic,
  recoverTopicFromContent,
  describeCrawlFailure,
  RECOVERABLE_CONTENT_MIN,
} from '../src/core/final/url-topic-recovery';

const BODY = '혁신성장촉진자금은 소상공인의 디지털 전환을 지원하는 직접대출 정책자금입니다. '.repeat(6);

describe('본문에서 주제를 묻는다', () => {
  test('프롬프트가 주제만 묻고 글쓴이·블로그를 배제한다', () => {
    const prompt = buildTopicRecoveryPrompt(BODY);
    expect(prompt).toContain('무엇에 대한 글인지');
    expect(prompt).toContain('글쓴이·블로그·사이트 이름을 넣지 마세요');
    expect(prompt).toContain('혁신성장촉진자금');
  });

  test('본문은 3000자까지만 싣는다', () => {
    const prompt = buildTopicRecoveryPrompt('가'.repeat(9000));
    expect(prompt.length).toBeLessThan(3400);
  });
});

describe('되찾은 주제를 다듬는다', () => {
  test('번호·따옴표를 걷는다', () => {
    expect(cleanRecoveredTopic('1. "혁신성장촉진자금 신청 조건"')).toBe('혁신성장촉진자금 신청 조건');
  });

  test('여러 줄이면 첫 줄만', () => {
    expect(cleanRecoveredTopic('혁신성장촉진자금 신청 조건\n설명입니다')).toBe('혁신성장촉진자금 신청 조건');
  });

  test('얼버무린 답은 주제로 쓰지 않는다', () => {
    expect(cleanRecoveredTopic('알 수 없습니다')).toBe('');
    expect(cleanRecoveredTopic('확인 불가')).toBe('');
    expect(cleanRecoveredTopic('')).toBe('');
  });

  test('너무 짧거나 긴 답도 버린다', () => {
    expect(cleanRecoveredTopic('돈')).toBe('');
    expect(cleanRecoveredTopic('가'.repeat(80))).toBe('');
  });
});

describe('되찾기', () => {
  test('본문이 있으면 주제를 얻는다', async () => {
    const got = await recoverTopicFromContent(BODY, async () => '혁신성장촉진자금 신청 조건');
    expect(got).toBe('혁신성장촉진자금 신청 조건');
  });

  test('본문이 너무 짧으면 모델을 부르지 않는다', async () => {
    const call = jest.fn(async () => '무엇이든');
    const got = await recoverTopicFromContent('짧은 본문', call);
    expect(got).toBe('');
    expect(call).not.toHaveBeenCalled();
  });

  test('모델이 실패해도 예외를 던지지 않는다', async () => {
    const got = await recoverTopicFromContent(BODY, async () => { throw new Error('모델 오류'); });
    expect(got).toBe('');
  });

  test('되찾기 하한이 본문 인정 하한과 같다', () => {
    expect(RECOVERABLE_CONTENT_MIN).toBe(200);
  });
});

describe('진짜 실패했을 때의 메시지', () => {
  test('사용자에게 주소를 바꾸라고 하지 않는다', () => {
    const message = describeCrawlFailure('https://blog.naver.com/la1826/224394201101', true);
    expect(message).not.toContain('넣어 주세요');
    expect(message).not.toContain('블로그 홈이 아니라');
  });

  test('무엇을 시도했는지 말한다', () => {
    const naver = describeCrawlFailure('https://blog.naver.com/la1826/1', true);
    expect(naver).toContain('모바일 주소 · PostView · RSS · 네이버 검색 API');
    expect(naver).toContain('주소 문제가 아니라 수집 실패입니다');

    const other = describeCrawlFailure('https://example.com/post', false);
    expect(other).toContain('직접 요청 · 브라우저 폴백');
  });
});
