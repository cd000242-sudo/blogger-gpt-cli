/**
 * 대표 이미지가 비어 목록 썸네일이 안 보이던 문제 (v3.8.724)
 *
 * 사장님: "썸네일을 넣기로 해서 넣었는데 생성된 글목록에서 썸네일로 안 보이고 썸네일 지정도 안 되네요"
 *
 * ## 실측 (발행글 5714, 2026-09-12)
 *   featured_media: 0  · 본문 이미지는 1장 있음
 *   https://files.catbox.moe/y6kh7t.webp        → 연결 실패 (HTTP 000)
 *   https://i0.wp.com/files.catbox.moe/...      → HTTP 200 (같은 파일)
 *
 * 원인은 그림이 아니라 **호스팅**이었다. 대표 이미지를 만들려고 본문 이미지 주소를 다시 내려받는데
 * 그 한 번이 막히자 **대표 이미지를 통째로 포기**했고, 로그만 남고 사용자는 몰랐다.
 *
 * 두 번째 구멍: 편집기에서 썸네일을 갈아 끼워도 **수정발행이 대표 이미지를 안 건드렸다.**
 * `{ postId, title, content }` 만 보냈기 때문이다 — 워드프레스에서 목록·홈에 뜨는 그림은
 * 본문 이미지가 아니라 featured_media 다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const publisher = read('src/wordpress/wordpress-publisher.ts');
const posts = read('src/wordpress/wordpress-posts.ts');
const editor = read('electron/ui/modules/editor.js');

describe('① 후보 하나가 죽었다고 대표 이미지를 포기하지 않는다', () => {
  it('⭐⭐ 후보를 여러 개 모은다 (지정 썸네일·본문 이미지들·base64)', () => {
    expect(publisher).toContain('featuredCandidates');
    expect(publisher).toMatch(/if \(options\.featuredImageUrl\) push\(options\.featuredImageUrl\)/);
    expect(publisher).toMatch(/matchAll\(\/<img\[\^>\]\+src=\["'\]\(https\?/);
  });

  it('⭐⭐ 원본 호스트가 막히면 이미지 CDN 우회로를 만든다 (실측에서 이 경로로 성공했다)', () => {
    expect(publisher).toContain('https://i0.wp.com/');
    expect(publisher).toMatch(/!\/i0\\\.wp\\\.com\/i\.test\(url\)/);
  });

  it('⭐⭐ 한 후보가 실패해도 다음으로 넘어간다 (예전엔 catch 로 끝났다)', () => {
    expect(publisher).toMatch(/for \(const candidate of featuredCandidates\)/);
    expect(publisher).toContain('다음 후보 시도');
  });

  it('⭐⭐ 응답이 없으면 기다리지 않는다 (한 후보가 발행 전체를 잡으면 안 된다)', () => {
    expect(publisher).toMatch(/AbortSignal\.timeout\(20_000\)/);
  });

  it('⭐⭐ 전부 실패하면 사용자에게 말한다 (조용히 넘어가면 목록이 빈 채로 나간다)', () => {
    expect(publisher).toContain('대표 이미지를 넣지 못했습니다');
    expect(publisher).toContain('글 목록과 홈에 썸네일이 안 보입니다');
  });

  it('⭐ 너무 작은 파일은 그림으로 치지 않는다 (오류 페이지가 내려오면 1KB 도 안 된다)', () => {
    expect(publisher).toMatch(/byteLength < 1024/);
  });
});

describe('② 편집기에서 바꾼 썸네일이 대표 이미지로 올라간다', () => {
  it('⭐⭐ 편집기가 수정발행에 썸네일을 같이 보낸다', () => {
    const save = editor.slice(
      editor.indexOf('const res = await window.electronAPI.invoke(published.updateChannel'),
      editor.indexOf('if (res?.ok) {'),
    );
    expect(save).toContain('thumbnailUrl: computeThumbnailUrl()');
  });

  it('⭐⭐ 수정발행이 그것을 대표 이미지로 올린다', () => {
    expect(posts).toContain('async function uploadFeaturedMedia');
    expect(posts).toContain("body['featured_media'] = mediaId");
    expect(posts).toMatch(/thumbnailUrl\?: string/);
  });

  it('⭐⭐ 그림 업로드가 실패해도 본문 수정은 진행한다', () => {
    const fn = posts.slice(posts.indexOf('async function uploadFeaturedMedia'), posts.indexOf('export async function updateWordPressPost'));
    expect(fn).toContain('본문 수정은 계속');
    expect(fn).toMatch(/return null;/);
  });

  it('⭐ data:image 와 http 주소를 모두 받는다', () => {
    const fn = posts.slice(posts.indexOf('async function uploadFeaturedMedia'), posts.indexOf('export async function updateWordPressPost'));
    expect(fn).toMatch(/\^data:image/);
    expect(fn).toMatch(/\^https\?:\\\/\\\//);
  });
});
