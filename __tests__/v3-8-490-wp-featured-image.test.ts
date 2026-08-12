/**
 * v3.8.490 — 워드프레스 목록 썸네일이 또 비어 있던 문제
 *
 * 사장님: "워드프레스로 지금 발행했는데 또 썸네일이 안나오네요 글들어가면 썸네일이 있습니다"
 *
 * ## 무슨 뜻인가
 * 목록 카드가 글자 썸네일("작")로 뜨는 건 테마가 **대표 이미지(featured_media)** 를
 * 못 찾았다는 뜻이다. 본문 안에는 이미지가 있으니 이미지 자체는 만들어졌다.
 *
 * ## 왜 반복되나
 * 발행 코드에 대표 이미지 업로드가 있는데 **실패해도 로그만 남기고 넘어간다.**
 * 그래서 사장님은 발행이 끝난 뒤 목록에서야 알아차린다.
 * (본문 썸네일 블록은 대표 이미지가 붙었을 때만 제거되는데, 이번 글은 본문에
 *  그대로 남아 있었다 — 대표 이미지가 안 붙었다는 증거다.)
 *
 * ## 고침
 * 발행 직후 글을 다시 읽어 확인하고, 비었으면 붙인다. 그래도 안 되면 알린다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { pickFeaturedCandidate, verifyAndRepairFeaturedImage } from '../src/wordpress/featured-image-repair';

const publisher = fs.readFileSync(
  path.join(__dirname, '..', 'src/wordpress/wordpress-publisher.ts'), 'utf-8',
);

const makeApi = (over: any = {}) => ({
  getPost: jest.fn().mockResolvedValue({ featured_media: 0 }),
  setFeaturedMedia: jest.fn().mockResolvedValue(true),
  uploadFromUrl: jest.fn().mockResolvedValue(77),
  ...over,
});

describe('① 본문에서 대표 이미지 후보를 고른다', () => {
  it('⭐⭐ http 이미지를 먼저 쓴다 (이미 올라가 있어 다시 올리기 쉽다)', () => {
    const html = '<p>글</p><img src="https://cdn.test/a.jpg"><img src="data:image/png;base64,AAA">';
    expect(pickFeaturedCandidate(html)).toBe('https://cdn.test/a.jpg');
  });

  it('⭐⭐ http 가 없으면 base64 를 쓴다', () => {
    expect(pickFeaturedCandidate('<img src="data:image/png;base64,AAA">')).toContain('base64');
  });

  it('⭐⭐ SVG 는 고르지 않는다 (워드프레스가 대표 이미지로 잘 처리하지 못한다)', () => {
    const html = '<img src="https://cdn.test/logo.svg"><img src="https://cdn.test/photo.jpg">';
    expect(pickFeaturedCandidate(html)).toBe('https://cdn.test/photo.jpg');
  });

  it('⭐ 이미지가 없으면 빈 문자열', () => {
    expect(pickFeaturedCandidate('<p>글만 있습니다</p>')).toBe('');
    expect(pickFeaturedCandidate('')).toBe('');
  });
});

describe('② 이미 붙어 있으면 건드리지 않는다', () => {
  it('⭐⭐ featured_media 가 있으면 아무 것도 하지 않는다 (멀쩡한 걸 덮어쓰면 안 된다)', async () => {
    const api = makeApi({ getPost: jest.fn().mockResolvedValue({ featured_media: 42 }) });
    const r = await verifyAndRepairFeaturedImage({ api, postId: 1, html: '<img src="https://a.test/x.jpg">' });
    expect(r.action).toBe('already-set');
    expect(api.setFeaturedMedia).not.toHaveBeenCalled();
    expect(api.uploadFromUrl).not.toHaveBeenCalled();
  });
});

describe('③ 비어 있으면 붙인다', () => {
  it('⭐⭐ 이미 올린 미디어가 있으면 다시 지정한다 (또 올리면 미디어가 중복 쌓인다)', async () => {
    const api = makeApi();
    const r = await verifyAndRepairFeaturedImage({
      api, postId: 1, html: '<img src="https://a.test/x.jpg">', knownMediaId: 55,
    });
    expect(r.action).toBe('reattached');
    expect(api.setFeaturedMedia).toHaveBeenCalledWith(1, 55);
    expect(api.uploadFromUrl).not.toHaveBeenCalled();
  });

  it('⭐⭐ 올린 게 없으면 본문 첫 이미지를 올려 붙인다', async () => {
    const api = makeApi();
    const r = await verifyAndRepairFeaturedImage({ api, postId: 1, html: '<img src="https://a.test/x.jpg">' });
    expect(r.action).toBe('uploaded');
    expect(r.mediaId).toBe(77);
    expect(api.setFeaturedMedia).toHaveBeenCalledWith(1, 77);
  });

  it('⭐⭐ 본문에 사진이 없으면 그 사실을 알린다 (조용히 넘어가면 또 목록에서 발견한다)', async () => {
    const api = makeApi();
    const r = await verifyAndRepairFeaturedImage({ api, postId: 1, html: '<p>글만</p>' });
    expect(r.ok).toBe(false);
    expect(r.action).toBe('no-candidate');
    expect(r.message).toContain('목록 썸네일');
  });

  it('⭐⭐ 업로드가 실패하면 원인을 짚어 알린다', async () => {
    const api = makeApi({ uploadFromUrl: jest.fn().mockResolvedValue(null) });
    const r = await verifyAndRepairFeaturedImage({ api, postId: 1, html: '<img src="https://a.test/x.jpg">' });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('미디어 권한');
  });

  it('⭐⭐ 어떤 오류에도 던지지 않는다 (발행은 이미 끝났다)', async () => {
    const api = makeApi({ getPost: jest.fn().mockRejectedValue(new Error('네트워크')) });
    const r = await verifyAndRepairFeaturedImage({ api, postId: 1, html: '<img src="https://a.test/x.jpg">' });
    expect(r.ok).toBe(false);
    expect(r.action).toBe('failed');
  });
});

describe('④ 발행 경로에 배선돼 있다', () => {
  it('⭐⭐ 글을 만든 뒤 확인·복구를 부른다', () => {
    expect(publisher).toContain('verifyAndRepairFeaturedImage');
  });

  it('⭐⭐ 이미 올린 미디어 id 를 넘긴다 (안 넘기면 같은 이미지를 또 올린다)', () => {
    const idx = publisher.indexOf('verifyAndRepairFeaturedImage');
    const block = publisher.slice(idx, publisher.indexOf('});', idx));
    expect(block).toContain('knownMediaId');
  });

  it('⭐⭐ 결과를 사용자에게 알린다 (로그만 남기면 또 목록에서 발견한다)', () => {
    const idx = publisher.indexOf('const repair = await verifyAndRepairFeaturedImage');
    const block = publisher.slice(idx, publisher.indexOf('catch (repairErr', idx));
    expect(block).toContain('options.onLog?.');
  });

  it('⭐ base64 SVG 도 대표 이미지로 고르지 않는다', () => {
    const html = '<img src="data:image/svg+xml;base64,AAA"><img src="data:image/png;base64,BBB">';
    expect(pickFeaturedCandidate(html)).toContain('png');
  });
});

/**
 * ⑤ 편집기 미리보기와 도구 정리
 *
 * 사장님:
 *   "미리보기에서 이미지가 모두 안보입니다 깨져보여요"
 *   "이미지 링크 취소 버튼도 되돌리기 버튼으로 바꿔주시구요 이 도구들을 정리좀해줘"
 */
describe('⑤ 편집기 미리보기·도구', () => {
  const editor = fs.readFileSync(
    path.join(__dirname, '..', 'electron/ui/modules/editor.js'), 'utf-8',
  );

  it('⭐⭐ 미리보기에 기준 주소를 넣는다 (없으면 상대경로 이미지가 전부 깨진다)', () => {
    expect(editor).toContain('<base href=');
    expect(editor).toContain('session.postUrl');
  });

  it('⭐⭐ 원본 주소를 모르면 base 를 넣지 않는다 (엉뚱한 기준을 잡으면 더 나쁘다)', () => {
    const idx = editor.indexOf('const baseHref');
    const block = editor.slice(idx, editor.indexOf('doc.open()', idx));
    expect(block).toContain("return ''");
  });

  it('⭐⭐ "이미지·링크 취소" 를 "되돌리기" 로 바꿨다', () => {
    expect(editor).toContain('↩️ 되돌리기');
    expect(editor).not.toContain('↩️ 이미지·링크 취소');
  });

  it('⭐⭐ 도구를 묶음으로 나눴다', () => {
    expect(editor).toContain('GROUP_LABEL');
    expect(editor).toContain('DIVIDER');
    expect(editor).toContain('>넣기<');
  });

  it('⭐ 버튼 기능은 그대로다 (정리하다 배선이 끊기면 안 된다)', () => {
    for (const id of ['veInsertImageBtn', 'veInsertAdBtn', 'veUndoImageOpBtn', 'veRevertBtn', 'veCopyHtmlBtn', 'veSaveBtn', 'veCancelBtn']) {
      expect(editor).toContain(`id="${id}"`);
      expect(editor).toContain(id);
    }
  });
});
