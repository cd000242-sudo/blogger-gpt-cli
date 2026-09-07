/**
 * v3.8.703 — 공유 버튼이 글이 아니라 **블로그 홈**으로 가던 문제
 *
 * 사장님: "글 마지막에 카카오 네이버 x 페이스북 버튼있자나 이거 연동안되있니??
 *          바로안가진다고 난리네"
 *
 * ## 실측 (2026-09-07)
 *   워드프레스 글 — 버튼 4개 전부 `https://leadernam.com` (홈)
 *   티스토리 글  — 버튼 4개 전부 `https://leadernam.com` … **워드프레스 사이트**다.
 *                  티스토리 글을 공유하면 남의 사이트가 퍼진다.
 *
 * ## 원인 셋
 * ① 워드프레스: v3.8.484 가 치환 코드를 넣었지만 **대상이 틀렸다.**
 *    실제로 발행되는 본문은 `contentForWp`(스타일 + wpautop 처리 후)인데
 *    치환은 `options.content`(가공 전)에 했다.
 * ② 티스토리: 공유 기본 주소가 `blogUrl → wordpressSiteUrl → siteUrl` 순이라
 *    티스토리로 발행해도 워드프레스 주소가 먼저 잡혔다.
 * ③ 정규식이 `data-orbit-share` 가 `href` 보다 **앞에 있다고 가정**했다.
 *    티스토리를 거친 본문은 속성 순서가 바뀌어 안 걸렸다 —
 *    이것 때문에 내가 사장님께 "티스토리는 공유 버튼 0개"라고 **틀리게 보고**했다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { applyShareUrl, needsShareUrlPatch } from '../src/core/final/share-url';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const wpPublisher = read('src/wordpress/wordpress-publisher.ts');
const orchestration = read('src/core/final/orchestration.ts');

const POST = 'https://leadernam.com/subsidy/some-post/';
const share = (attrsFirst: boolean) => (attrsFirst
  ? '<a data-orbit-share="1" href="https://story.kakao.com/share?url=https%3A%2F%2Fleadernam.com" target="_blank">카카오</a>'
  : '<a href="https://story.kakao.com/share?url=https%3A%2F%2Fleadernam.com" data-orbit-share="1" target="_blank">카카오</a>');

describe('① 속성 순서가 달라도 잡는다', () => {
  test('⭐ data-orbit-share 가 앞에 있을 때 (우리가 만드는 모양)', () => {
    const out = applyShareUrl(share(true), POST);
    expect(out).toContain(encodeURIComponent(POST));
  });

  test('⭐⭐ href 가 앞에 있을 때 (티스토리를 거쳐 돌아온 모양)', () => {
    // 이 경우를 놓쳐서 "공유 버튼 0개"라고 잘못 셌다
    const out = applyShareUrl(share(false), POST);
    expect(out).toContain(encodeURIComponent(POST));
  });

  test('⭐ 페이스북의 u= 파라미터도 바꾼다', () => {
    const fb = '<a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fleadernam.com" data-orbit-share="1">FB</a>';
    expect(applyShareUrl(fb, POST)).toContain(encodeURIComponent(POST));
  });

  test('공유 버튼이 아닌 링크는 건드리지 않는다', () => {
    const other = '<a href="https://x.go.kr/go?url=https%3A%2F%2Fexample.com">본문 링크</a>';
    expect(applyShareUrl(other, POST)).toBe(other);
  });

  test('주소가 이상하면 원본을 그대로 둔다 — 링크를 죽이지 않는다', () => {
    expect(applyShareUrl(share(true), 'not-a-url')).toBe(share(true));
    expect(needsShareUrlPatch(share(true), '')).toBe(false);
  });
});

describe('② 워드프레스 — 실제로 올라간 본문에 치환한다', () => {
  const fn = blockBetween(wpPublisher, 'v3.8.703 — **가공 전 본문에 치환하고 있었다.**', '// 🔧 Yoast SEO 필드');

  test('⭐ options.content 가 아니라 contentForWp 에 치환한다', () => {
    expect(fn).toContain('applyShareUrl(contentForWp, postUrl)');
    expect(fn).not.toContain('applyShareUrl(options.content');
  });

  test('⭐ 실패하면 한 번 더 시도한다', () => {
    expect(fn).toContain('if (!shareResult.success) shareResult = await wpApi.updatePostContent(post.id, patched)');
  });

  test('⭐ 끝내 실패하면 조용히 넘어가지 않는다 — 몇 달을 모른 채 지났다', () => {
    expect(fn).toContain('두 번 실패했습니다');
    expect(fn).toContain('바꿀 주소를 찾지 못했습니다');
  });
});

describe('③ 티스토리 — 최소한 자기 블로그를 가리킨다', () => {
  const fn = blockBetween(orchestration, 'v3.8.703 — **자기 블로그를 가리키게 한다.**', 'const shareUrlValue');

  test('⭐ 티스토리면 티스토리 주소를 먼저 본다', () => {
    expect(fn).toContain("/tistory/i.test(String(platform || '')) && tistoryHome");
  });

  test('⭐ 블로그 이름만 있어도 주소를 만든다', () => {
    expect(fn).toContain('.tistory.com`');
    expect(fn).toContain('/^https?:\\/\\//i.test(tistoryBlogName)');
  });

  test('티스토리가 아니면 예전 순서 그대로다', () => {
    expect(fn).toContain('payload.blogUrl || payload.wordpressSiteUrl || payload.siteUrl');
  });
});

describe('④ 세 퍼블리셔가 모두 같은 치환 함수를 쓴다', () => {
  test('⭐ 블로거·워드프레스는 부른다', () => {
    expect(read('src/core/blogger-publisher.js')).toContain('applyShareUrl');
    expect(wpPublisher).toContain('applyShareUrl');
  });

  test('공용 모듈이 한 곳뿐이다 — 퍼블리셔마다 따로 짜면 또 어긋난다', () => {
    expect(read('src/core/final/share-url.ts')).toContain('export function applyShareUrl');
  });
});
