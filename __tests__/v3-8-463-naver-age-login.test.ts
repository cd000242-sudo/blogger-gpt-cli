/**
 * v3.8.463 — 네이버 성인인증: 로그인만 하고 끝내던 문제
 *
 * 사용자 지적: "로그인창 띄우고나서 로그인만하고 끝내는게아니고 성인인증을 해야되
 * … 정상적으로 상품창이뜨면 그때 크롤링이 들어가야되".
 *
 * 실측(2026-08-06, naver.me/GT42MEXe 로 창을 띄워 관찰):
 *   ① 상품 주소로 들어가면 네이버가
 *      nid.naver.com/nidlogin.login?...&url=https%3A%2F%2Fsmartstore.naver.com%2Fmakkaejo…
 *      로 보낸다 — **되돌아갈 상품 주소가 로그인 URL 안에 들어 있다.**
 *      예전 코드는 되돌아갈 곳을 naver.com 으로 지정해서, 로그인해도 상품 페이지로
 *      가지 않았고 성인인증 단계가 아예 나오지 않았다.
 *   ② 번들 Chromium 으로 로그인하니 "네이버 보안을 위해 추가 확인을 해주세요"
 *      (영수증 빈칸 채우기) 자동화 탐지 화면이 떴고, 지나가도 다시 연령확인
 *      로그인 화면으로 되돌아갔다. 실제 Chrome 으로 열자 봇 검사가 없었다.
 *   ③ 8/4 에 저장한 storageState 를 실었는데도 로그인 화면으로 튕겼다 —
 *      쿠키·localStorage 만으로는 기기 지문이 유지되지 않는다.
 *
 * ※ 연령확인 통과 이후 구간은 아직 실측 못 했다(계정 성인인증이 휴대폰을 요구하고
 *   사용자 휴대폰이 정지 상태). 위 ①~③ 은 전부 실측으로 확인된 사실이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const session = fs.readFileSync(path.join(root, 'src/core/affiliate/naver-session.ts'), 'utf-8');
const crawl = fs.readFileSync(path.join(root, 'src/core/affiliate/crawl.ts'), 'utf-8');

describe('① 로그인 창을 상품 주소로 연다', () => {
  it('⭐⭐ openNaverLoginWindow 가 targetUrl 을 받는다', () => {
    expect(session).toMatch(/export async function openNaverLoginWindow\([\s\S]{0,200}targetUrl\?: string/);
  });

  it('⭐⭐ targetUrl 이 있으면 로그인 페이지가 아니라 그 주소로 연다', () => {
    expect(session).toContain('page.goto(targetUrl || LOGIN_URL');
  });

  it('⭐⭐ 크롤러가 실제로 상품 주소를 넘긴다 (안 넘기면 조용히 예전 동작)', () => {
    const call = session.length && crawl.slice(
      crawl.indexOf('naverSession.openNaverLoginWindow('),
      crawl.indexOf('naverSession.openNaverLoginWindow(') + 260,
    );
    expect(call).toContain('url,');
  });
});

describe('② 상품 화면을 확인한 뒤에 수집을 시작한다', () => {
  it('⭐⭐ verified 플래그가 결과에 있다', () => {
    expect(session).toContain('verified?: boolean');
    expect(session).toContain('verified: true');
  });

  it('⭐⭐ 상품 판정은 상품 구조가 실제로 있어야 통과한다', () => {
    const fn = blockBetween(session, 'async function readPageState(', '\n/**');
    // "로그인 화면이 아님" 만으로 통과시키면 연령확인 안내 페이지를 상품으로 오인한다
    expect(fn).toContain('productReady: hasProduct && !ageGate && !loginPage');
    expect(fn).toContain('application/ld+json');
  });

  it('⭐⭐ 연령확인이 남아 있으면 사용자에게 알린다', () => {
    expect(session).toContain('아직 연령확인이 남았습니다');
  });

  it('⭐ 성인인증까지 끝났을 때만 verified 로 재수집한다', () => {
    const block = crawl.slice(crawl.indexOf('const login = await naverSession.openNaverLoginWindow('));
    const verifiedIdx = block.indexOf('login.ok && login.verified');
    const loggedInIdx = block.indexOf('login.ok && login.loggedIn');
    expect(verifiedIdx).toBeGreaterThan(-1);
    expect(loggedInIdx).toBeGreaterThan(-1);
    expect(verifiedIdx).toBeLessThan(loggedInIdx);
  });
});

describe('③ 봇 탐지를 피한다', () => {
  it('⭐⭐ 실제 Chrome 으로 연다 (번들 Chromium 은 캡차에 걸렸다)', () => {
    expect(session).toContain("channel: 'chrome'");
  });

  it('⭐⭐ Chrome 이 없는 PC 에서도 창은 떠야 한다 (폴백)', () => {
    // channel:'chrome' 은 Chrome 이 없으면 실행 자체가 예외 → 창이 아예 안 뜬다
    expect(session).toMatch(/catch \(chromeError[\s\S]{0,400}launchPersistentContext\(PROFILE_DIR, launchOptions\)/);
  });

  it('⭐⭐ 로그인 창은 영구 프로필을 쓴다 (storageState 만으로는 튕겼다)', () => {
    expect(session).toContain('launchPersistentContext(PROFILE_DIR');
    expect(session).toContain("path.join(SESSION_DIR, 'naver-profile')");
  });

  it('⭐ navigator.webdriver 를 지운다', () => {
    expect(session).toContain("Object.defineProperty(navigator, 'webdriver'");
  });

  it('⭐⭐ 동시 크롤 재시도는 여전히 storageState 다 (프로필 잠금 충돌 방지)', () => {
    // 크롤은 동시성 3으로 돈다 — 프로필 디렉토리를 공유하면 잠금이 충돌한다
    expect(crawl).toContain('storageState: require(\'./naver-session\').getNaverSessionPath()');
    expect(crawl).not.toContain('launchPersistentContext');
  });
});
