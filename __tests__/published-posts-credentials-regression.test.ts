const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/**
 * "발행은 되는데 생성된 글목록만 🔒 인증 필요" 재발 방지.
 *
 * 원인: published-posts.js 의 buildPlatformPayload 가 티스토리 외에는 undefined 를
 * 돌려줬다. 그래서 글목록 IPC 는 메인 프로세스의 userData/.env 만 보게 되는데,
 * 설정 화면의 "연동완료" 표시와 발행 경로(posting.js getApiKeys)는 loadSettings() 를
 * 진실 소스로 쓴다. 두 소스가 갈리면 설정은 연동완료인데 목록만 인증 실패로 보인다.
 */
describe('생성된 글목록 자격증명 회귀 가드', () => {
  test('buildPlatformPayload 가 블로그스팟·워드프레스에도 자격증명을 실어 보낸다', () => {
    const source = read('electron/ui/modules/published-posts.js');

    expect(() => acorn.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    })).not.toThrow();

    // 티스토리 외 전부를 undefined 로 끊어버리던 조기 반환이 없어야 한다 (이 버그의 본체)
    expect(source).not.toContain("if (platformKey !== 'tistory') return undefined;");

    // 발행 경로와 같은 소스(loadSettings)에서 값을 가져와야 한다
    expect(source).toContain("import { loadSettings } from './settings.js';");
    expect(source).toContain('const settings = await loadSettings() || {};');

    // 블로그스팟: createBloggerApiClient 가 먼저 보는 키들
    expect(source).toContain('blogId: settings.blogId,');
    expect(source).toContain('googleClientId: settings.googleClientId,');
    expect(source).toContain('googleClientSecret: settings.googleClientSecret,');

    // 워드프레스: resolveWordPressAuth 가 먼저 보는 키들
    expect(source).toContain('wordpressSiteUrl: settings.wordpressSiteUrl,');
    expect(source).toContain('wordpressUsername: settings.wordpressUsername,');
    expect(source).toContain('wordpressPassword: settings.wordpressPassword,');

    // 티스토리 관리화면 URL 조립에 쓰는 블로그 주소는 그대로 유지
    expect(source).toContain('return blogName ? { tistoryBlogName: blogName } : undefined;');
  });

  test('빈 값은 실어 보내지 않아 메인 프로세스의 .env 폴백이 살아 있다', () => {
    const source = read('electron/ui/modules/published-posts.js');

    expect(source).toContain('function compact(obj)');
    // 값이 하나도 없으면 undefined → 기존 .env 폴백 경로를 그대로 탄다
    expect(source).toContain('return entries.length ? Object.fromEntries(entries.map(([k, v]) => [k, String(v).trim()])) : undefined;');
  });

  test('메인 프로세스가 payload 의 자격증명을 .env보다 먼저 읽는다', () => {
    const blogger = read('src/core/blogger-publisher.js');
    const wordpress = read('src/wordpress/wordpress-posts.ts');

    // payload 를 넘겨도 백엔드가 안 읽으면 무의미하다 — 우선순위를 함께 고정한다
    expect(blogger).toContain('payload.googleClientId ||');
    expect(blogger).toContain('payload.googleClientSecret ||');
    expect(blogger).toContain('payload.blogId ||');
    expect(wordpress).toContain("payload['siteUrl'], payload['wordpressSiteUrl'],");
    expect(wordpress).toContain("payload['username'], payload['wordpressUsername'],");
    expect(wordpress).toContain("payload['password'], payload['wordpressPassword'],");
  });

  test('목록·본문·삭제·수정발행 네 경로 모두 payload 를 넘긴다', () => {
    const source = read('electron/ui/modules/published-posts.js');
    const editor = read('electron/ui/modules/editor.js');

    // 한 경로만 빠져도 그 동작에서만 조용히 인증 실패가 난다
    const payloadCalls = source.match(/buildPlatformPayload\(platform\.key\)/g) || [];
    expect(payloadCalls.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('window.__buildPublishedPlatformPayload = (platformKey) => buildPlatformPayload(platformKey);');
    expect(editor).toContain('payload: await window.__buildPublishedPlatformPayload?.(session.kind),');
  });
});
