/**
 * v3.8.485 — 발행한 글이 글목록에 안 뜨던 문제 + 티스토리 썸네일이 들쭉날쭉하던 문제
 *
 * 사장님:
 *   "반자동 발행한건 왜 생성된 글목록에 안뜰까요?? 뜨게해주세요"
 *   "티스토리 생성된 글목록 썸네일은 뜰때도있고 안뜰떄도있고 준구난방이네요"
 *
 * ## ① 목록이 새로고침되지 않았다
 * 글목록은 로컬 기록이 아니라 **플랫폼 API 에서 그때그때 가져온다.**
 * 그런데 새로고침 호출(`__refreshPublishedPosts`)이 "수정발행" 한 곳에만 있었다.
 * 새로 발행한 뒤에는 아무도 부르지 않으니, 탭에는 발행 전에 읽어둔 목록이 그대로 남는다.
 * 글은 블로그에 정상적으로 올라가 있는데 앱에서만 안 보이는 상태였다.
 *
 * ## ② 티스토리 목록은 지연 로딩이다
 * 썸네일을 `img.src` 로만 읽었다. 티스토리 관리 목록은 스크롤해야 이미지를 채우는
 * 지연 로딩이라, 화면에 안 들어온 행은 `src` 가 비어 있거나 placeholder 다.
 * 실제 주소는 `data-src` 계열에 들어 있다. 그래서 "뜰 때도 있고 안 뜰 때도" 있었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import { pickLazyImageUrl } from '../src/tistory/lazy-image';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const posting = read('electron/ui/modules/posting.js');
const tistoryPosts = read('src/tistory/tistory-posts.ts');

describe('① 발행하면 글목록이 새로고침된다', () => {
  it('⭐⭐ 발행 성공 시 목록 새로고침을 부른다', () => {
    const block = blockBetween(posting, 'const setFinalResult = (next = {}) =>', 'setFinalResult();');
    expect(block.length).toBeGreaterThan(100);
    expect(block).toContain('__refreshPublishedPosts');
  });

  it('⭐⭐ 발행이 아닐 때는 부르지 않는다 (매번 API 를 때리면 느려진다)', () => {
    const block = blockBetween(posting, 'const setFinalResult = (next = {}) =>', 'setFinalResult();');
    expect(block).toContain('published');
  });

  it('⭐⭐ 새로고침이 실패해도 발행 결과 처리는 계속된다', () => {
    const block = blockBetween(posting, 'const setFinalResult = (next = {}) =>', 'setFinalResult();');
    expect(block).toContain('try { window.__refreshPublishedPosts');
  });
});

describe('② 지연 로딩된 썸네일도 찾아낸다', () => {
  const el = (attrs: Record<string, string>) => ({
    getAttribute: (k: string) => (k in attrs ? attrs[k]! : null),
    currentSrc: attrs['currentSrc'] || '',
  });

  it('⭐⭐ src 가 있으면 그대로 쓴다', () => {
    expect(pickLazyImageUrl(el({ src: 'https://img.test/a.jpg' }))).toBe('https://img.test/a.jpg');
  });

  it('⭐⭐ src 가 비면 data-src 에서 찾는다 (스크롤 전 행)', () => {
    expect(pickLazyImageUrl(el({ src: '', 'data-src': 'https://img.test/b.jpg' })))
      .toBe('https://img.test/b.jpg');
  });

  it('⭐⭐ 여러 지연 로딩 속성 이름을 모두 본다', () => {
    expect(pickLazyImageUrl(el({ 'data-original': 'https://img.test/c.jpg' }))).toBe('https://img.test/c.jpg');
    expect(pickLazyImageUrl(el({ 'data-lazy-src': 'https://img.test/d.jpg' }))).toBe('https://img.test/d.jpg');
    expect(pickLazyImageUrl(el({ 'data-url': 'https://img.test/e.jpg' }))).toBe('https://img.test/e.jpg');
  });

  it('⭐⭐ placeholder 를 진짜 썸네일로 착각하지 않는다', () => {
    // 1x1 투명 gif 를 넣어두고 스크롤 때 바꿔치는 게 흔한 방식이다
    expect(pickLazyImageUrl(el({
      src: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
      'data-src': 'https://img.test/real.jpg',
    }))).toBe('https://img.test/real.jpg');
  });

  it('⭐⭐ srcset 만 있는 경우 첫 후보를 쓴다', () => {
    expect(pickLazyImageUrl(el({ srcset: 'https://img.test/s1.jpg 1x, https://img.test/s2.jpg 2x' })))
      .toBe('https://img.test/s1.jpg');
  });

  it('⭐ 프로토콜 없는 //주소를 https 로 채운다', () => {
    expect(pickLazyImageUrl(el({ src: '//img.test/f.jpg' }))).toBe('https://img.test/f.jpg');
  });

  it('⭐⭐ 아무것도 없으면 빈 문자열 (없는 주소를 만들지 않는다)', () => {
    expect(pickLazyImageUrl(el({}))).toBe('');
    expect(pickLazyImageUrl(null)).toBe('');
  });

  it('⭐⭐ 티스토리 목록이 이 함수를 실제로 쓴다', () => {
    expect(tistoryPosts).toContain('pickLazyImageUrl');
    const code = tistoryPosts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    // src 만 읽던 옛 코드가 남아 있으면 안 된다
    expect(code).not.toContain("image.currentSrc || image.getAttribute('src') || ''");
  });
});
