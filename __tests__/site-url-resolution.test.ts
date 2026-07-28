/**
 * 사이트 URL 해석 회귀 테스트 (v3.8.383)
 *
 * 배경: orchestration.ts 가 .env 에 존재하지 않는 키 `WP_URL` 을 읽어
 *       blogUrl 이 항상 '' 이 되었고, 내부 링크 삽입이 예외 없이 조용히 스킵됐다.
 *       실측 결과 발행 328편 중 인바운드 내부링크가 0인 글이 280편(85.6%)이었다.
 *
 * 조용한 실패였기 때문에 로그도 에러도 남지 않았다. 이 테스트는 두 가지를 고정한다.
 *   1) 소스가 실제 .env 키 이름(WORDPRESS_SITE_URL)을 참조할 것
 *   2) 사이트 URL 해석 순서가 payload 우선일 것 (발행 대상 플랫폼이 payload로 결정되므로)
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts');
const source = fs.readFileSync(SRC, 'utf8');

/** payload → env 순서로 사이트 URL 을 고르는 해석기 (소스와 동일한 우선순위) */
function resolveSiteUrl(
  payload: Record<string, unknown>,
  env: Record<string, string>
): string {
  return String(
    payload['blogUrl'] || payload['wordpressSiteUrl'] || payload['siteUrl'] || payload['url'] ||
    env['WORDPRESS_SITE_URL'] || env['BLOGGER_URL'] || env['TISTORY_URL'] || ''
  ).trim().replace(/\/+$/, '');
}

describe('사이트 URL 해석 — env 키 이름 함정', () => {
  it('실제 .env 키(WORDPRESS_SITE_URL)로 워드프레스 URL을 찾는다', () => {
    const env = { WORDPRESS_SITE_URL: 'https://leadernam.com' };
    expect(resolveSiteUrl({}, env)).toBe('https://leadernam.com');
  });

  it('존재하지 않는 WP_URL 키만 있으면 빈 문자열이 된다 — 이것이 원래 버그였다', () => {
    const env = { WP_URL: 'https://leadernam.com' };
    expect(resolveSiteUrl({}, env)).toBe('');
  });

  it('payload 가 env 보다 우선한다 — 발행 대상 플랫폼은 payload 가 결정한다', () => {
    const env = { WORDPRESS_SITE_URL: 'https://leadernam.com' };
    const payload = { blogUrl: 'https://other.blogspot.com' };
    expect(resolveSiteUrl(payload, env)).toBe('https://other.blogspot.com');
  });

  it('payload.wordpressSiteUrl 과 payload.siteUrl 도 인식한다', () => {
    expect(resolveSiteUrl({ wordpressSiteUrl: 'https://a.com' }, {})).toBe('https://a.com');
    expect(resolveSiteUrl({ siteUrl: 'https://b.com' }, {})).toBe('https://b.com');
  });

  it('뒤따르는 슬래시를 제거한다 — findRelatedPosts 가 경로를 이어붙이므로 //가 되면 404', () => {
    expect(resolveSiteUrl({ blogUrl: 'https://leadernam.com/' }, {})).toBe('https://leadernam.com');
    expect(resolveSiteUrl({ blogUrl: 'https://leadernam.com///' }, {})).toBe('https://leadernam.com');
  });

  it('아무 것도 없으면 빈 문자열 — 내부 링크는 생략되지만 발행은 계속되어야 한다', () => {
    expect(resolveSiteUrl({}, {})).toBe('');
  });
});

describe('orchestration.ts 소스 가드', () => {
  it('내부 링크 블록이 WORDPRESS_SITE_URL 을 참조한다', () => {
    expect(source).toContain("URLData['WORDPRESS_SITE_URL']");
  });

  it('JSON-LD 블록도 WORDPRESS_SITE_URL 을 참조한다', () => {
    expect(source).toContain("env['WORDPRESS_SITE_URL']");
  });

  it("어디에서도 WP_URL 을 단독 폴백으로 쓰지 않는다", () => {
    // WP_URL 을 참조하는 줄이 남아 있다면, 반드시 WORDPRESS_SITE_URL 도 같은 줄 근처에 있어야 한다.
    const offending = source
      .split('\n')
      .map((line, i) => ({ line, no: i + 1 }))
      .filter(({ line }) => /\bWP_URL\b/.test(line) && !line.trimStart().startsWith('//'));
    expect(offending.map(o => `${o.no}: ${o.line.trim()}`)).toEqual([]);
  });

  it('내부 링크 blogUrl 이 payload 를 먼저 본다', () => {
    // 주의: 'payload.blogUrl || payload.wordpressSiteUrl' 문자열은 공유 버튼 URL(2375줄 부근)에도
    // 이미 존재한다. 단순 indexOf 로는 내부 링크 블록이 고쳐졌는지 구분하지 못한다.
    // 내부 링크 블록(loadEnvFromFile → blogUrl) 안에서 payload 가 URLData 보다 앞서는지를 본다.
    const block = source.slice(
      source.indexOf('const URLData = loadEnvFromFile()'),
      source.indexOf('const relatedLinks = await findRelatedPosts')
    );
    expect(block).not.toHaveLength(0);
    const payloadAt = block.indexOf('payload.blogUrl');
    const envAt = block.indexOf("URLData['WORDPRESS_SITE_URL']");
    expect(payloadAt).toBeGreaterThan(-1);
    expect(envAt).toBeGreaterThan(-1);
    expect(payloadAt).toBeLessThan(envAt);
  });
});
