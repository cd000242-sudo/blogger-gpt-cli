/**
 * v3.8.453 — 사용자 요청 3건
 *
 *   ① 네이버 로그인 창 — 성인인증(주류·와인) 상품 크롤용.
 *      "수동입력을 하면 자동화툴을 쓰는 이유가 없자나 … 로그인창을 띄워서
 *       로그인할수있게해줘"
 *   ② 발행 화면에 티스토리 카테고리 선택 — "워드프레스처럼 떠야되는데".
 *      설정 모달의 묵은 값("이슈 관련")이 그대로 실려 발행이 죽었다.
 *   ③ 카테고리 불일치가 발행을 죽이지 않는다 — 글 생성 비용을 전부 쓴 뒤
 *      마지막 단계에서 통째로 실패하던 문제.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const session = read('src/core/affiliate/naver-session.ts');
const crawl = read('src/core/affiliate/crawl.ts');
const main = read('electron/main.ts');
const indexHtml = read('electron/ui/index.html');
const settings = read('electron/ui/modules/settings.js');
const posting = read('electron/ui/modules/posting.js');
const script = read('electron/ui/script.js');
const publisher = read('src/tistory/tistory-publisher.ts');

describe('① 네이버 로그인 세션 — 성인인증 상품 크롤', () => {
  it('⭐⭐ 로그인 판정은 네이버 인증 쿠키로 한다', () => {
    expect(session).toContain("names.has('NID_AUT') && names.has('NID_SES')");
    expect(session).toContain('storageState({ path: SESSION_PATH })');
  });

  it('⭐⭐ 일반 크롤은 계속 비로그인 — 세션은 재시도 1회에만 쓴다', () => {
    // 컨텍스트에 storageState 를 싣는 조건이 _naverSession 재시도일 때뿐이어야 한다
    expect(crawl).toContain("opts._naverSession && require('./naver-session').hasNaverSession()");
    // 로그인/연령확인 화면을 만났을 때만 재시도 플래그를 세운다
    const block = blockBetween(crawl, 'if (isLoginPage) {', 'const ageGated =');
    expect(block).toContain("!opts._naverSession && naverSession.hasNaverSession()");
    expect(block).toContain('_naverSession: true');
  });

  /**
   * v3.8.463 에서 정책이 **둘로 갈렸다.**
   *
   * 원래는 "프로필 잠금이 아니라 storageState" 하나였다. 동시 크롤 3개가 프로필
   * 디렉토리를 공유하면 잠금이 충돌하기 때문이고, 그건 지금도 유효하다.
   * 그런데 로그인 창은 사정이 다르다 — 실측(2026-08-06) 결과 storageState 로는
   * 기기 지문이 매번 새것이 돼서 네이버가 자동화 탐지 캡차를 냈고 로그인이 아예
   * 안 됐다. 로그인 창은 tryClaimLoginPrompt 로 한 번에 하나만 뜨므로 프로필
   * 잠금이 충돌하지 않는다.
   */
  it('⭐⭐ 로그인 창은 영구 프로필, 크롤 재시도는 storageState (섞이면 안 된다)', () => {
    expect(session).toContain('launchPersistentContext(PROFILE_DIR');
    expect(session).toContain('storageState({ path: SESSION_PATH })');
    // 동시성 3으로 도는 크롤은 프로필을 쓰면 안 된다
    expect(crawl).not.toContain('launchPersistentContext');
    expect(crawl).toContain("storageState: require('./naver-session').getNaverSessionPath()");
  });

  it('⭐ 로그인해도 안 되는 경우를 구분해 알린다 (계정에 성인인증이 없을 때)', () => {
    expect(crawl).toContain('로그인했지만 연령확인을 통과하지 못했습니다');
    expect(crawl).toContain('저장된 네이버 로그인이 만료된 것 같습니다');
  });

  it('⭐⭐ IPC 3종이 배선돼 있다', () => {
    expect(main).toContain("ipcMain.handle('naver:open-login-window'");
    expect(main).toContain("ipcMain.handle('naver:session-status'");
    expect(main).toContain("ipcMain.handle('naver:clear-session'");
  });

  it('⭐⭐ 설정 UI 버튼이 실제로 배선돼 있다 (id 만 만들고 안 잇는 실수 방지)', () => {
    expect(indexHtml).toContain('id="naverLoginBtn"');
    expect(indexHtml).toContain('window.openNaverLoginFromSettings');
    expect(settings).toContain('window.openNaverLoginFromSettings = async function');
    expect(settings).toContain("invoke?.('naver:open-login-window')");
  });

  it('⭐ 세션 삭제 버튼도 배선돼 있다', () => {
    expect(indexHtml).toContain('window.clearNaverSessionFromSettings');
    expect(settings).toContain("invoke?.('naver:clear-session')");
  });
});

describe('② 발행 화면의 티스토리 카테고리 선택', () => {
  it('⭐⭐ 카테고리 탭에 티스토리 블록이 있다', () => {
    expect(indexHtml).toContain('id="postingTistoryCategoryBlock"');
    expect(indexHtml).toContain('id="tistoryCategoryPosting"');
    expect(indexHtml).toContain('window.loadTistoryCategoriesForPosting');
  });

  it('⭐⭐ 플랫폼에 따라 맞는 블록만 보인다', () => {
    expect(script).toContain("postingWpBlock.style.display = (!isBlogger && !isTistory) ? 'block' : 'none'");
    expect(script).toContain("postingTistoryBlock.style.display = isTistory ? 'block' : 'none'");
  });

  it('⭐⭐ payload 는 발행 화면의 선택을 1순위로 쓴다', () => {
    const block = blockBetween(posting, 'const tistoryDefaultCategoryValue =', '.trim();');
    const postingIdx = block.indexOf("tistoryCategoryPosting");
    const settingsIdx = block.indexOf("tistoryDefaultCategory')");
    expect(postingIdx).toBeGreaterThan(-1);
    expect(settingsIdx).toBeGreaterThan(-1);
    expect(postingIdx).toBeLessThan(settingsIdx);
  });

  it('⭐ 로더가 실제로 정의돼 있고 두 select 를 함께 채운다', () => {
    expect(settings).toContain('window.loadTistoryCategoriesForPosting = async function');
    expect(settings).toContain("const ids = ['tistoryDefaultCategory', 'tistoryCategoryPosting'];");
  });
});

describe('③ 카테고리 불일치가 발행을 죽이지 않는다', () => {
  it('⭐⭐ 카테고리를 못 찾으면 경고 후 기본 카테고리로 발행한다', () => {
    const fn = blockBetween(publisher, 'async function selectCategory(', 'async function fillTags(');
    expect(fn).not.toContain('throw new Error');
    expect(fn).toContain('기본 카테고리로 발행합니다');
  });

  it('⭐ 열린 드롭다운을 닫아 다음 단계를 가리지 않게 한다', () => {
    const fn = blockBetween(publisher, 'async function selectCategory(', 'async function fillTags(');
    expect(fn).toContain("keyboard.press('Escape')");
  });
});
