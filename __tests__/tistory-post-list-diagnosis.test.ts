/**
 * 회귀 방지: 티스토리 글목록이 "발행된 글이 없습니다"로만 보이던 문제 (v3.8.336)
 *
 * 로그인·세션이 정상인데도 목록이 비면 원인이 두 가지다 — 정말 글이 없거나,
 * 관리 화면 구조/주소가 바뀌어 스크래핑이 실패했거나. 기존 코드는 후자를 ok:true + 빈 배열로
 * 돌려줘서 UI가 "글이 없습니다"로 표시했고, 사용자도 개발자도 원인을 알 수 없었다.
 */
import fs from 'fs';
import path from 'path';
import { TISTORY_URLS } from '../src/tistory/tistory-selectors';

describe('티스토리 관리 화면 주소 후보', () => {
  it('알려진 글목록 경로를 모두 후보로 제공한다', () => {
    const urls = TISTORY_URLS.managePostsCandidates('myblog', 2);
    expect(urls).toEqual([
      'https://myblog.tistory.com/manage/posts?page=2',
      'https://myblog.tistory.com/manage/post?page=2',
      'https://myblog.tistory.com/manage/entry?page=2',
    ]);
  });

  it('페이지 번호를 생략하면 1페이지를 본다', () => {
    expect(TISTORY_URLS.managePostsCandidates('myblog')[0]).toContain('page=1');
  });

  it('기존 글 편집은 /manage/post/{id} 를 연다', () => {
    // /manage/newpost/{id}는 신규 글 경로라 기존 글 편집기가 열리지 않는다 (2026-07 실측)
    expect(TISTORY_URLS.editPost('myblog', '313')).toBe('https://myblog.tistory.com/manage/post/313');
  });
});

describe('티스토리 목록 스크래핑 실패 처리', () => {
  let source = '';

  beforeAll(() => {
    source = fs.readFileSync(path.join(process.cwd(), 'src', 'tistory', 'tistory-posts.ts'), 'utf8');
  });

  it('주소 후보를 순회하며 글이 잡히는 화면을 찾는다', () => {
    expect(source).toContain('TISTORY_URLS.managePostsCandidates(session.config.blogName, pageNo)');
    expect(source).toContain('if (attempt.items.length > 0) break;');
  });

  it('실제 관리 화면 구조(ul.list_post > li)를 행으로 잡는다', () => {
    // 2026-07 실측: 편집 링크는 /manage/newpost/{id}가 아니라 /manage/post/{id} 이고,
    //   글 목록은 <ul class="list_post"><li> 구조다.
    expect(source).toContain("document.querySelectorAll('ul[class*=\"list_post\"] > li')");
    expect(source).toContain('\\/manage\\/(?:newpost|post)\\/(\\d+)');
  });

  it('앵커 자신을 행으로 오인하지 않는다', () => {
    // <a class="btn_post">수정</a> 은 [class*="post"]에 자기 자신이 매칭돼
    // 제목이 "수정"으로 잡히고 전부 버려졌다 → 반드시 부모부터 closest를 시작해야 한다.
    expect(source).toContain('const parent = anchor.parentElement;');
    expect(source).toContain("parent.closest('li, tr, article')");
    expect(source).not.toContain("element.closest('li, tr, article, [class*=\"item\" i], [class*=\"post\" i]')");
  });

  it('글 id를 편집링크·통계링크·체크박스 순으로 찾는다', () => {
    expect(source).toContain('\\/manage\\/statistics\\/entry\\/(\\d+)');
    expect(source).toContain("row.querySelector('input[type=\"checkbox\"][id]')");
    // 글이 아닌 행이 섞이지 않도록 최소 증거를 요구한다
    expect(source).toContain('if (!title && !dateMatch && !entryHref) return;');
  });

  it('0건이면 성공이 아니라 진단 정보를 담은 실패로 알린다', () => {
    expect(source).toContain('if (!scraped || scraped.items.length === 0)');
    expect(source).toContain('티스토리 관리 화면에서 글 목록을 읽지 못했습니다.');
    expect(source).toContain('편집링크 ${diag?.editLinks ?? 0}개');
    // 예전처럼 빈 배열을 ok:true로 돌려주면 "발행된 글이 없습니다"로 오인된다
    expect(source).not.toContain('return {\n      ok: true,\n      items: [],');
  });
});
