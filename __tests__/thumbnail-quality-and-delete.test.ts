/**
 * 썸네일 화질·상품사진 업로드·글 삭제 (v3.8.412)
 *
 * 사용자 실측(2026-08-02) — 화면 그대로:
 *   글목록과 블로그스팟 관리화면에서 쇼핑 글 2편만 썸네일이 비어 있었다("브", "실" 글자만).
 *   AI 이미지로 만든 글은 멀쩡히 떴다.
 *
 * 원인 — blogger-publisher 의 분기:
 *   data:image 썸네일 → Blogger 에 업로드 → 썸네일 생김
 *   외부 URL 썸네일   → **그대로 통과** → Blogger 가 썸네일을 못 만든다
 *   쇼핑 글 썸네일은 쿠팡 CDN 주소라 통째로 아래쪽 경로를 탔다.
 *
 * 사용자 요구:
 *   "어떤 모드든지 이미지는 최고 화질로 해주고 쇼핑모드로 수집한 이미지도
 *    최고화질로 썸네일이 잘 보이게 해주세요"
 *   "생성된 글목록에서 글 삭제할 수 있는 기능은 못 넣나요?"
 */
import * as fs from 'fs';
import * as path from 'path';
import { upgradeCoupangImageUrl, fetchImageAsDataUrl } from '../src/core/affiliate/product-image';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const thumb = read('src', 'thumbnail.ts');
const orch = read('src', 'core', 'final', 'orchestration.ts');
const postsUi = read('electron', 'ui', 'modules', 'published-posts.js');
const mainTs = read('electron', 'main.ts');

describe('쿠팡 이미지 주소를 최고 화질로 올린다', () => {
  const base = 'https://thumbnail6.coupangcdn.com/thumbnails/remote/{S}/image/vendor/abc.jpg';

  it('⭐ 작은 썸네일 주소를 큰 것으로 바꾼다', () => {
    expect(upgradeCoupangImageUrl(base.replace('{S}', '230x230ex'))).toContain('/1200x1200ex/');
    expect(upgradeCoupangImageUrl(base.replace('{S}', '492x492ex'))).toContain('/1200x1200ex/');
  });

  it('⭐ 이미 더 큰 주소는 낮추지 않는다', () => {
    expect(upgradeCoupangImageUrl(base.replace('{S}', '1600x1600ex'))).toContain('/1600x1600ex/');
  });

  it('크기가 안 박힌 주소는 그대로 둔다 (서명 URL 을 깨뜨리면 안 된다)', () => {
    const signed = 'https://ads-partners.coupang.com/image1/AbCdEf123';
    expect(upgradeCoupangImageUrl(signed)).toBe(signed);
  });

  it('빈 값에 안전하다', () => {
    expect(upgradeCoupangImageUrl('')).toBe('');
    expect(upgradeCoupangImageUrl(null as any)).toBe('');
  });
});

describe('상품 사진을 data URL 로 바꾼다 — 그래야 썸네일이 생긴다', () => {
  it('⭐ http 주소가 아니면 시도하지 않는다', async () => {
    expect(await fetchImageAsDataUrl('')).toBeNull();
    expect(await fetchImageAsDataUrl('data:image/png;base64,AAA')).toBeNull();
    expect(await fetchImageAsDataUrl('ftp://x/y.jpg')).toBeNull();
  });

  it('⭐ 이미지가 아닌 응답은 버린다 (에러 페이지를 썸네일로 쓰면 안 된다)', async () => {
    const orig = global.fetch;
    (global as any).fetch = async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('<html>404</html>').buffer,
    });
    try {
      expect(await fetchImageAsDataUrl('https://example.com/x.jpg')).toBeNull();
    } finally { (global as any).fetch = orig; }
  });

  it('⭐ 진짜 이미지면 data:image 로 준다', async () => {
    // Buffer.from([...]).buffer 는 내부 풀 전체를 가리켜 엉뚱한 바이트가 나온다 — Uint8Array 로 정확히 만든다
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    const orig = global.fetch;
    (global as any).fetch = async () => ({ ok: true, arrayBuffer: async () => png.buffer });
    try {
      const r = await fetchImageAsDataUrl('https://example.com/x.png');
      expect(r).toMatch(/^data:image\/png;base64,/);
    } finally { (global as any).fetch = orig; }
  });

  it('⭐ 너무 크면 포기한다 (글 용량·업로드 시간 보호)', async () => {
    const big = new Uint8Array(2002); big[0] = 0xff; big[1] = 0xd8;
    const orig = global.fetch;
    (global as any).fetch = async () => ({ ok: true, arrayBuffer: async () => big.buffer });
    try {
      expect(await fetchImageAsDataUrl('https://example.com/x.jpg', { maxBytes: 100 })).toBeNull();
    } finally { (global as any).fetch = orig; }
  });

  it('⭐ 네트워크가 터져도 예외를 던지지 않는다 (발행을 막지 않는다)', async () => {
    const orig = global.fetch;
    (global as any).fetch = async () => { throw new Error('네트워크 실패'); };
    try {
      await expect(fetchImageAsDataUrl('https://example.com/x.jpg')).resolves.toBeNull();
    } finally { (global as any).fetch = orig; }
  });
});

describe('배선 — 쇼핑 썸네일이 업로드 경로를 탄다', () => {
  it('⭐ 수집 상품 사진을 data URL 로 바꾼다', () => {
    expect(orch).toContain('fetchImageAsDataUrl');
    expect(orch).toContain('상품 사진을 블로그에 올려 썸네일로 씁니다');
  });

  it('⭐ 변환에 실패해도 발행은 계속된다', () => {
    expect(orch).toContain('외부 주소를 그대로 씁니다');
  });

  it('발행 코드가 data:image 만 업로드한다는 전제가 아직 유효하다', () => {
    // 이 전제가 깨지면 위 변환이 불필요해진다 — 그때 이 테스트가 알려준다
    const pub = read('src', 'core', 'blogger-publisher.js');
    expect(pub).toContain("thumbnailUrl.startsWith('data:image')");
    expect(pub).toContain('uploadDataUrlThumbnail');
  });
});

describe('이미지 화질을 최고로', () => {
  it('⭐ JPEG 품질이 95 이상이다', () => {
    expect(thumb).toContain('quality: 95');
    expect(thumb).not.toContain('.jpeg({ quality: 85 })');
  });

  it('⭐ PNG 품질이 100 이다', () => {
    expect(thumb).toContain('quality: 100');
    expect(thumb).not.toContain('.png({ quality: 90 })');
  });

  it('색 번짐 없는 서브샘플링을 쓴다', () => {
    expect(thumb).toContain("chromaSubsampling: '4:4:4'");
  });
});

describe('글목록에서 글 삭제', () => {
  it('⭐ 블로그스팟·워드프레스 IPC 가 등록돼 있다', () => {
    expect(mainTs).toContain("ipcMain.handle('blogger-delete-post'");
    expect(mainTs).toContain("ipcMain.handle('wordpress-delete-post'");
  });

  it('⭐ 코어에 삭제 함수가 있고 export 된다', () => {
    const pub = read('src', 'core', 'blogger-publisher.js');
    expect(pub).toContain('async function deleteBloggerPost');
    expect(pub).toContain('deleteBloggerPost,');           // module.exports
    expect(read('src', 'wordpress', 'wordpress-posts.ts')).toContain('export async function deleteWordPressPost');
  });

  it('⭐ 워드프레스는 기본이 휴지통이다 — 되돌릴 수 없는 걸 기본값으로 두지 않는다', () => {
    // 시그니처가 여러 줄이라 braceBlock 은 타입 리터럴의 { 를 잡는다 — 본문 시작을 표식으로 쓴다
    const wp = read('src', 'wordpress', 'wordpress-posts.ts');
    expect(braceBlock(wp, "const query = options.permanent")).toContain("'?force=true' : ''");
    expect(wp).toContain('휴지통');
  });

  it('⭐ 지우기 전에 어떤 글인지 제목을 보여주고 확인받는다', () => {
    const block = braceBlock(postsUi, 'async function deletePostAt');
    expect(block).toContain('confirm(');
    expect(block).toContain('item.title');
    expect(block).toContain('되돌릴 수 없습니다');
  });

  it('⭐ postId 가 없으면 지우지 않는다 (엉뚱한 글이 날아가면 안 된다)', () => {
    const block = braceBlock(postsUi, 'async function deletePostAt');
    expect(block).toContain('if (!postId)');
    expect(block).toContain('return;');
  });

  it('⭐ 티스토리는 삭제를 열지 않았다 — 스크래핑이라 위험하다', () => {
    expect(postsUi).toContain('deleteChannel: null');
    expect(postsUi).toContain('엉뚱한 글을 지울 위험');
  });

  it('삭제 버튼은 삭제 채널이 있는 플랫폼에만 나온다', () => {
    expect(postsUi).toContain('getPlatform(state.active).deleteChannel');
  });

  it('⭐ 삭제 버튼을 눌러도 편집기가 열리지 않는다', () => {
    expect(postsUi).toContain("if (e.target.closest('.ppDeleteBtn')) return;");
  });

  it('실패하면 이유를 화면에 남긴다', () => {
    expect(braceBlock(postsUi, 'async function deletePostAt')).toContain('삭제 실패');
  });
});

describe('모르는 모델 값이 조용히 Gemini 로 떨어지지 않는다', () => {
  const engine = read('src', 'core', 'final', 'gemini-engine.ts');

  it('⭐ 등록되지 않은 모델이면 경고한다', () => {
    expect(braceBlock(engine, 'function getPrimaryProvider')).toContain('등록되지 않은 모델 값');
  });

  it('⭐ 제목을 어느 모델이 지었는지 로그로 남긴다', () => {
    expect(orch).toContain('제목 생성 모델:');
  });
});
