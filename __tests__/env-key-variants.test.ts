/**
 * 회귀 방지: 설정은 저장했는데 백엔드가 "설정이 없다"고 판단하던 문제 (v3.8.336)
 *
 * 원인 — 설정 저장(main.ts)의 keyMap에 티스토리 키가 없어 `key.toUpperCase()` 폴백이 돌면서
 * `TISTORYBLOGNAME`(언더스코어 없음)으로 저장됐고, 로더는 `TISTORY_BLOG_NAME`만 찾아 빈 값으로 읽었다.
 * 발행은 렌더러 payload로 블로그 주소를 받아 정상 동작했지만 .env만 보는 글목록 조회는 통째로 실패했다.
 */
import { pickEnvValue } from '../src/env';

describe('pickEnvValue — .env 키 표기 흔들림 흡수', () => {
  it('표준 대문자 키를 읽는다', () => {
    expect(pickEnvValue({ TISTORY_BLOG_NAME: 'leadernam' }, 'TISTORY_BLOG_NAME', 'tistoryBlogName'))
      .toBe('leadernam');
  });

  it('camelCase 키를 읽는다', () => {
    expect(pickEnvValue({ tistoryBlogName: 'leadernam' }, 'TISTORY_BLOG_NAME', 'tistoryBlogName'))
      .toBe('leadernam');
  });

  it('언더스코어가 빠진 채 저장된 실제 파일 형식을 읽는다', () => {
    // 사용자의 %APPDATA%/lba/.env에 실제로 저장돼 있던 형태
    expect(pickEnvValue({ TISTORYBLOGNAME: 'https://leadernam.tistory.com' }, 'TISTORY_BLOG_NAME', 'tistoryBlogName'))
      .toBe('https://leadernam.tistory.com');
  });

  it('표준 키가 비어 있으면 변형 키로 넘어간다', () => {
    const env = { TISTORY_BLOG_NAME: '   ', TISTORYBLOGNAME: 'leadernam' };
    expect(pickEnvValue(env, 'TISTORY_BLOG_NAME', 'tistoryBlogName')).toBe('leadernam');
  });

  it('표준 키에 값이 있으면 그것을 우선한다', () => {
    const env = { TISTORY_BLOG_NAME: '정상값', TISTORYBLOGNAME: '옛날값' };
    expect(pickEnvValue(env, 'TISTORY_BLOG_NAME', 'tistoryBlogName')).toBe('정상값');
  });

  it('어디에도 없으면 undefined', () => {
    expect(pickEnvValue({}, 'TISTORY_BLOG_NAME', 'tistoryBlogName')).toBeUndefined();
  });

  it('camelKey 없이도 동작한다', () => {
    expect(pickEnvValue({ MINCHARS: '3000' }, 'MIN_CHARS')).toBe('3000');
  });
});
