/**
 * 독자 확보 블록 — 지목해 둔 독자를 만든다 (v3.8.560, 하네스 A2·A4)
 *
 * 근거: 구글 퍼블리셔 트래픽이 1년간 33% 줄었다(미국 -38%). AI 답변이 클릭을 가로챈다.
 *   그 흐름에서 살아남는 건 이 사이트를 **지목해 둔 독자**다.
 *   · Preferred Sources — 지정된 출처는 클릭 확률 2배(구글 조사). 한국어 2026-04-30 개방.
 *   · 디스커버 팔로우 — 크롬 팔로잉 탭. 디스커버가 복권이면 이건 적립식이다.
 *
 * 설계상 위험: 딥링크에 우리 도메인이 들어간다. 티스토리 글에 워드프레스 도메인을 넣으면
 *   독자가 **엉뚱한 사이트를 지정**하게 된다. 그래서 확실할 때만 넣는다 — 이 테스트가 그걸 잠근다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAudienceBlock, resolveSiteDomain, preferredSourceLink } from '../src/core/final/audience-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const WP_ENV = { WORDPRESS_SITE_URL: 'https://leadernam.com' };

describe('① 글이 실릴 곳의 도메인을 쓴다', () => {
  it('⭐⭐ 플랫폼마다 다른 키를 본다', () => {
    expect(resolveSiteDomain('wordpress', WP_ENV)).toBe('leadernam.com');
    expect(resolveSiteDomain('blogspot', { BLOGGER_URL: 'https://ramen.blogspot.com' })).toBe('ramen.blogspot.com');
    expect(resolveSiteDomain('tistory', { TISTORY_BLOG_URL: 'https://abc.tistory.com/' })).toBe('abc.tistory.com');
  });

  it('www 는 뗀다 (지정 대상은 사이트지 호스트 표기가 아니다)', () => {
    expect(resolveSiteDomain('wordpress', { WORDPRESS_SITE_URL: 'https://www.leadernam.com' })).toBe('leadernam.com');
  });

  it('티스토리는 주소 대신 블로그 이름만 있어도 만든다', () => {
    expect(resolveSiteDomain('tistory', { TISTORY_BLOG_NAME: 'myblog' })).toBe('myblog.tistory.com');
  });

  it('⭐⭐ 모르면 빈 문자열 — 추측한 도메인을 쓰지 않는다', () => {
    expect(resolveSiteDomain('wordpress', {})).toBe('');
    expect(resolveSiteDomain('wordpress', null)).toBe('');
    expect(resolveSiteDomain('알수없는플랫폼', WP_ENV)).toBe('');
    expect(resolveSiteDomain('wordpress', { WORDPRESS_SITE_URL: '::깨진주소::' })).toBe('');
  });

  it('⭐⭐ 티스토리 글에 워드프레스 도메인이 새지 않는다', () => {
    // 키가 섞여 있어도 플랫폼이 정한 키만 본다
    expect(resolveSiteDomain('tistory', WP_ENV)).toBe('');
  });
});

describe('② 블록을 만드는 조건', () => {
  it('⭐ 도메인이 있으면 지정 링크와 팔로우 안내가 함께 나온다', () => {
    const html = buildAudienceBlock({ platform: 'wordpress', env: WP_ENV, siteName: 'CLAIMWISE' });
    expect(html).toContain('audience-block');
    expect(html).toContain('google.com/preferences/source?q=leadernam.com');
    expect(html).toContain('CLAIMWISE');
    expect(html).toContain('팔로우');
  });

  it('⭐⭐ 애드센스 모드에는 넣지 않는다 (승인이 목적이다)', () => {
    expect(buildAudienceBlock({ platform: 'wordpress', env: WP_ENV, contentMode: 'adsense' })).toBe('');
  });

  it('⭐⭐ 도메인을 모르면 아무것도 넣지 않는다', () => {
    expect(buildAudienceBlock({ platform: 'wordpress', env: {} })).toBe('');
  });

  it('사이트 이름이 없으면 도메인을 쓴다', () => {
    const html = buildAudienceBlock({ platform: 'wordpress', env: WP_ENV });
    expect(html).toContain('leadernam.com');
  });

  it('⭐ 스크립트를 쓰지 않는다 (WP 가 본문 script 를 지우고, 3개 플랫폼이 같은 HTML 을 쓴다)', () => {
    const html = buildAudienceBlock({ platform: 'wordpress', env: WP_ENV });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('swg/js');
    expect(html).toContain('<a class="audience-block-link"');
  });

  it('⭐ 링크에 rel 이 붙는다 (외부 링크 위생)', () => {
    const html = buildAudienceBlock({ platform: 'wordpress', env: WP_ENV });
    expect(html).toContain('rel="nofollow noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('사이트 이름을 이스케이프한다', () => {
    const html = buildAudienceBlock({ platform: 'wordpress', env: WP_ENV, siteName: '<b>X</b>"Y"' });
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('딥링크 형식은 구글 문서 그대로다', () => {
    expect(preferredSourceLink('leadernam.com')).toBe('https://google.com/preferences/source?q=leadernam.com');
  });
});

describe('③ 발행 경로에 실제로 걸려 있다', () => {
  const orchestration = read('src/core/final/orchestration.ts');
  const wpPublisher = read('src/wordpress/wordpress-publisher.ts');

  it('⭐⭐ orchestration 이 블록을 만들어 본문에 붙인다', () => {
    expect(orchestration).toContain("from './audience-block'");
    expect(orchestration).toContain('const audienceHtml = buildAudienceBlock({');
    expect(orchestration).toContain('html += audienceHtml;');
  });

  it('⭐⭐ 본문 맨 아래 — 컨테이너를 닫기 전이다', () => {
    const addIdx = orchestration.indexOf('html += audienceHtml;');
    const closeIdx = orchestration.indexOf("html += '</div></div></div>';");
    expect(addIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(addIdx);
  });

  it('⭐⭐ 플랫폼을 payload 에서 읽는다 (도메인이 글마다 달라야 한다)', () => {
    expect(orchestration).toContain("platform: String(payload?.platform || 'wordpress')");
  });

  it('⭐ 블록이 실패해도 발행은 계속된다', () => {
    const idx = orchestration.indexOf('const audienceHtml = buildAudienceBlock({');
    const before = orchestration.slice(Math.max(0, idx - 500), idx);
    expect(before).toContain('try {');
  });

  it('⭐⭐ 워드프레스는 style 속성을 지우므로 클래스 CSS 가 있어야 한다', () => {
    expect(wpPublisher).toContain('.wp-styled-content .audience-block {');
    expect(wpPublisher).toContain('.wp-styled-content .audience-block-link {');
  });
});
