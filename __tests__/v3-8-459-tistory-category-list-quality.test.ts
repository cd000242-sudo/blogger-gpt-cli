/**
 * v3.8.459 — 티스토리 카테고리 목록에 관리 화면 버튼이 섞여 오던 문제
 *
 * 사용자 실측: 드롭다운에 "카테고리 관리 · 자세히 보기 · 변경사항 저장 ·
 *   표시합니다 · 표시하지 않습니다 · 3일" 이 진짜 카테고리와 섞여 나왔다
 *   ("이건 내카테고리가 아닌데..??").
 *
 * 원인: 관리 화면(/manage/category)을 1순위로 긁는데 셀렉터가 관리 UI 전체를
 * 쓸어 담았고, 결과가 0건이 아니니 에디터 폴백은 영영 실행되지 않았다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const session = fs.readFileSync(path.join(__dirname, '..', 'src/tistory/tistory-session.ts'), 'utf-8');

describe('① 에디터 드롭다운이 1순위다', () => {
  it('⭐⭐ 에디터 추출이 관리 화면 추출보다 먼저 온다', () => {
    const fn = blockBetween(session, 'export async function loadTistoryCategories(', '\nexport ');
    const editorIdx = fn.indexOf("extractTistoryCategoriesFromPage(page, 'editor')");
    const manageIdx = fn.indexOf("extractTistoryCategoriesFromPage(page, 'manage')");
    expect(editorIdx).toBeGreaterThan(-1);
    expect(manageIdx).toBeGreaterThan(-1);
    expect(editorIdx).toBeLessThan(manageIdx);
  });

  it('⭐ 관리 화면은 에디터가 0건일 때만 (폴백)', () => {
    const fn = blockBetween(session, 'export async function loadTistoryCategories(', '\nexport ');
    const zeroCheck = fn.indexOf('categories.length === 0');
    const manageIdx = fn.indexOf("extractTistoryCategoriesFromPage(page, 'manage')");
    expect(zeroCheck).toBeGreaterThan(-1);
    expect(zeroCheck).toBeLessThan(manageIdx);
  });
});

describe('③ 에디터 메뉴는 TinyMCE 플로팅 패널에서 읽는다 (v3.8.460)', () => {
  /**
   * 실측(2026-08-04, leadernam.tistory.com 에디터 DOM 덤프):
   *   button#category-btn 클릭 → 메뉴가 열리지만 항목은
   *   `.mce-menu-item[role="option"]` 이고 [class*="category"] 컨테이너 **바깥**에 붙는다.
   *   그래서 기존 셀렉터로는 "카테고리 더보기" 버튼 하나만 잡혀 0건 →
   *   관리 화면 폴백 → 엉뚱한 목록(사회·건강·일상다반사…)이 나왔다.
   * 수정 후 실제 코드 경로 검증: 이슈 관련·건강 정보·일상고급정보·지원금관련·
   *   공연, 티켓정보 5건 (source=editor).
   */
  it('⭐⭐ mce-menu-item[role="option"] 셀렉터가 있다', () => {
    expect(session).toContain('\'.mce-menu-item[role="option"]\'');
  });

  it('⭐⭐ role=menuitem(에디터 모드)은 안 잡히도록 role=option 으로 좁혔다', () => {
    // 같은 .mce-menu-item 중 기본모드·마크다운·HTML 은 role="menuitem" 이다
    expect(session).not.toContain("'.mce-menu-item',");
  });

  it('⭐ 에디터 모드 문구는 차단 목록에도 남아 있다 (이중 방어)', () => {
    const m = session.match(/const blocked = (\/\^.*\$\/i);/);
    // eslint-disable-next-line no-eval
    const blocked: RegExp = eval(m![1]!);
    for (const mode of ['기본모드', '마크다운', 'HTML', '카테고리 없음']) {
      expect(blocked.test(mode)).toBe(true);
    }
  });
});

describe('② 실측된 관리 UI 문구가 전부 걸러진다', () => {
  // 소스에서 blocked 정규식을 뽑아 실제로 돌려본다
  const m = session.match(/const blocked = (\/\^.*\$\/i);/);
  expect(m).not.toBeNull();
  // eslint-disable-next-line no-eval
  const blocked: RegExp = eval(m![1]!);

  const periodRe = /^\d+\s*(일|시간|분|주|개월)$/;

  it('⭐⭐ 사용자 스크린샷의 쓰레기 항목 전부 차단', () => {
    for (const junk of ['카테고리 관리', '자세히 보기', '변경사항 저장', '표시하지 않습니다', '표시합니다']) {
      expect(blocked.test(junk)).toBe(true);
    }
    expect(periodRe.test('3일')).toBe(true);
    expect(periodRe.test('7일')).toBe(true);
  });

  it('⭐⭐ 진짜 카테고리는 통과한다', () => {
    for (const real of ['사회', '건강', '일상다반사', '생활정보', '공연·전시·축제', '지원금관련', '이슈 관련']) {
      expect(blocked.test(real)).toBe(false);
      expect(periodRe.test(real)).toBe(false);
    }
  });
});
