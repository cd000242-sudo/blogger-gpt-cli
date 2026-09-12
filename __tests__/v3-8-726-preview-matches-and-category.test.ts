/**
 * 미리보기와 실제가 갈리던 문제 · 상위 카테고리에 넣어 홈에서 빠지던 문제 (v3.8.726)
 *
 * ## ① "미리보기 그대로 나오면 좋겠는데"
 * 편집기는 워드프레스에 **저장된 원본**을 보여주는데, 실제 페이지는 거기에 워드프레스가
 * `wpautop` 을 한 번 더 씌운 결과였다.
 *
 * 실측(발행글 5714):
 *   저장 원본 : <p> 48개 · </p> 48개   ← 짝이 맞는다
 *   실제 화면 : <p> 53개 · </p> 78개   ← 짝 없는 </p> 25개 → 빈 문단으로 그려진다
 *
 * 같은 글을 HTML 블록(<!-- wp:html -->)으로 감싸 저장하고 다시 재 봤다:
 *   짝 없는 </p> **25개 → 0개**. 원본과 화면이 완전히 같아졌다. (실험 뒤 원복)
 *
 * ## ② "그냥 지원금 복지로 해놓고 발행했는데 이건 홈에 안 뜨네요?"
 * 발행은 정상이었다(카테고리 3698 저장 확인). 홈 페이지가 latest-posts 블록 20개로 돼 있고
 * **전부 하위 카테고리**를 가리킨다. 상위 "지원금·복지"에 직접 넣은 38편은 어느 칸에도 안 걸린다.
 * 앱은 사이트 홈 구성을 알 수 없으므로, **상위를 고르는 순간 알려 주는 것**이 할 수 있는 최선이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { wrapAsHtmlBlock, unwrapHtmlBlock, isHtmlBlockWrapped } from '../src/wordpress/wp-html-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 본문을 HTML 블록으로 감싼다 (워드프레스가 못 건드리게)', () => {
  it('⭐⭐ 감싸고 벗기면 원래 글자로 돌아온다', () => {
    const html = '<p>본문입니다.</p><table><tr><td>칸</td></tr></table>';
    const wrapped = wrapAsHtmlBlock(html);
    expect(wrapped.startsWith('<!-- wp:html -->')).toBe(true);
    expect(wrapped.trim().endsWith('<!-- /wp:html -->')).toBe(true);
    expect(unwrapHtmlBlock(wrapped)).toBe(html);
  });

  it('⭐⭐ 두 번 감싸지 않는다 (수정발행을 반복해도 주석이 쌓이면 안 된다)', () => {
    const once = wrapAsHtmlBlock('<p>글</p>');
    expect(wrapAsHtmlBlock(once)).toBe(once);
    expect(isHtmlBlockWrapped(once)).toBe(true);
  });

  it('⭐⭐ 예전 글(안 감싼 것)은 그대로 읽는다', () => {
    const plain = '<p>예전에 발행한 글</p>';
    expect(unwrapHtmlBlock(plain)).toBe(plain);
    expect(isHtmlBlockWrapped(plain)).toBe(false);
  });

  it('⭐ 빈 본문은 감싸지 않는다 (빈 블록만 남으면 편집 화면이 이상해진다)', () => {
    expect(wrapAsHtmlBlock('')).toBe('');
    expect(wrapAsHtmlBlock('   ')).toBe('   ');
  });
});

describe('② 세 경로 모두 배선돼 있다', () => {
  it('⭐⭐ 새 발행이 감싼다', () => {
    const pub = read('src/wordpress/wordpress-publisher.ts');
    expect(pub).toContain("require('./wp-html-block')");
    expect(pub).toContain('wrapAsHtmlBlock(optimizedContent)');
    expect(pub).toContain('content: contentForPost');
  });

  it('⭐⭐ 수정발행도 감싼다 (여기를 빠뜨리면 고칠 때마다 되돌아간다)', () => {
    const posts = read('src/wordpress/wordpress-posts.ts');
    expect(posts).toContain('wrapAsHtmlBlock(content)');
  });

  it('⭐⭐ 읽어 올 때는 벗긴다 (편집기가 주석을 보면 안 된다)', () => {
    const posts = read('src/wordpress/wordpress-posts.ts');
    expect(posts).toContain('unwrapHtmlBlock(readRichField(post?.content))');
  });
});

describe('③ 상위 카테고리를 고르면 알려 준다', () => {
  const main = read('electron/ui/modules/main.js');

  it('⭐⭐ 상위·하위를 계층으로 그린다', () => {
    expect(main).toContain('const addOption = (cat, depth)');
    expect(main).toMatch(/하위 \$\{kids\}개/);
    expect(main).toContain("cats.filter((c) => !Number(c.parent || 0))");
  });

  it('⭐⭐ 하위를 거느린 상위를 고르면 경고가 뜬다', () => {
    expect(main).toContain('wpCategoryParentNotice');
    expect(main).toContain('홈 화면은 보통 하위 카테고리별로 글을 불러오므로');
  });

  it('⭐⭐ 하위를 고르면 경고를 지운다 (틀린 경고가 남아 있으면 더 나쁘다)', () => {
    expect(main).toMatch(/if \(kids === 0\) \{ if \(notice\) notice\.remove\(\); return; \}/);
  });

  it('⭐ 카테고리 타입이 parent 를 싣는다 (없으면 화면이 계층을 못 그린다)', () => {
    expect(read('src/wordpress/wordpress-api.ts')).toMatch(/parent\?: number;/);
  });

  it('⭐ 리스너를 한 번만 단다 (로드할 때마다 붙으면 경고가 여러 번 뜬다)', () => {
    expect(main).toContain('categorySelect.dataset.parentWarnWired');
  });
});
