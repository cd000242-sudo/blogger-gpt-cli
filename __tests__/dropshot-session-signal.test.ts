/**
 * Dropshot 인증 신호 회귀 테스트 (v3.8.386)
 *
 * 사고 (2026-07-30 실측):
 *   사용자: "리더스 나노바나나프로 무제한이 인식이 안된다"
 *   실제 상태 — 로그인도 생성 연동도 정상이었다. 표기만 죽어 있었다.
 *     verifyDropshotGenerationReady() 반환값:
 *       { loggedIn:true, ready:true, subscription:'unknown',
 *         subscriptionLabel:'연동됨' }   ← userName/email 없음, '무제한' 없음
 *
 *   원인 1 — getDropshotSessionInfo 가 죽은 신호만 봤다.
 *     /api/me                              -> 404
 *     CognitoIdentityServiceProvider 쿠키  -> 현재 사이트가 쓰지 않음 (지금은 ds.session-token.*)
 *     살아있는 신호 /api/auth/session (200, user{id,email,name}) 은 보지 않았다.
 *     아이러니하게도 같은 파일 v3.8.370 주석에 이미 기록돼 있던 사실이다.
 *
 *   원인 2 — 등급 조회를 존재하지 않는 API 로 했다.
 *     실측 404: /api/user/subscription, /api/subscription, /api/user/plan,
 *              /api/billing/subscription, /api/credits, /api/user
 *     api.aistudio.dropshot.io/v1/user/subscription 은 CORS/부재로 항상 TypeError →
 *     catch 에 삼켜져 등급이 영원히 'unknown' 이었다.
 *     참인 신호는 보드의 "무제한 모드" 토글이며, 이는 makeDropshotImage 가 생성 직전
 *     ON 을 강제 확인하는 바로 그 컨트롤이다.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'src', 'core', 'dropshotGenerator.ts'), 'utf8');
const uiScript = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'script.js'), 'utf8');

/** getDropshotSessionInfo 본문만 잘라낸다 — 파일 전체가 아니라 이 함수의 신호를 검사하기 위해. */
function sessionInfoBody(): string {
  const start = src.indexOf('async function getDropshotSessionInfo');
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('\nasync function wait(', start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('getDropshotSessionInfo — 살아있는 신호만 쓴다', () => {
  it('죽은 /api/me 를 인증 신호로 쓰지 않는다', () => {
    expect(sessionInfoBody()).not.toContain("'/api/me'");
  });

  it('현재 쓰이지 않는 Cognito 쿠키에 의존하지 않는다', () => {
    expect(sessionInfoBody()).not.toContain('CognitoIdentityServiceProvider');
  });

  it('실측으로 확인된 세션 API 상수를 쓴다', () => {
    expect(sessionInfoBody()).toContain('DROPSHOT_SESSION_API');
  });

  it('세션 API 상수가 /api/auth/session 을 가리킨다', () => {
    expect(src).toContain("const DROPSHOT_SESSION_API = 'https://aistudio.dropshot.io/api/auth/session'");
  });

  it('user.id 또는 user.email 이 있어야 로그인으로 친다 — 로그아웃 시 빈 객체 오판 방지', () => {
    expect(sessionInfoBody()).toContain('user.id || user.email');
  });

  it('계정 정보(userId/userName/email)를 실제로 채운다', () => {
    const body = sessionInfoBody();
    expect(body).toContain('info.userId');
    expect(body).toContain('info.userName');
    expect(body).toContain('info.email');
  });

  it('API 실패 시 ds.session-token 쿠키로 폴백한다 — 네트워크 문제로 로그아웃 처리하지 않는다', () => {
    expect(sessionInfoBody()).toContain('hasDropshotSessionCookie');
  });

  it('exactOptionalPropertyTypes — 빈 값을 optional 필드에 넣지 않는다', () => {
    const body = sessionInfoBody();
    expect(body).toMatch(/if \(raw\.userId\)\s+info\.userId/);
    expect(body).toMatch(/if \(raw\.email\)\s+info\.email/);
  });
});

describe('파일 전체 — 죽은 엔드포인트가 어디에도 안 남아 있다', () => {
  // 첫 수정 때 getDropshotSessionInfo 만 고쳐서 loginDropshot 안의 같은 호출을 놓쳤다.
  // 함수 단위가 아니라 파일 단위로 막는다.
  it('/api/me 를 fetch 하는 코드가 하나도 없다', () => {
    expect(src).not.toMatch(/fetch\(\s*['"`]\/api\/me['"`]/);
  });

  it('Cognito 쿠키를 파싱하는 코드가 없다', () => {
    // 이름만으로 검사하면 "왜 안 쓰는지" 설명한 주석까지 잡힌다.
    // 실제 파싱 대상인 LastAuthUser 로 판정한다.
    expect(src).not.toContain('LastAuthUser');
    expect(src).not.toMatch(/cookies?\.match\(\s*\/CognitoIdentityServiceProvider/);
  });
});

describe('등급 판정 — 존재하지 않는 API 를 두드리지 않는다', () => {
  it('죽은 구독 API 호출이 남아 있지 않다', () => {
    expect(src).not.toContain('api.aistudio.dropshot.io/v1/user/subscription?lang=ko');
  });

  it('보드의 "무제한 모드" 토글을 실측 신호로 쓴다', () => {
    expect(src).toContain("subscriptionLabel = '무제한 모드 사용 가능'");
    expect(src).toContain('input[role="switch"]');
  });

  it('토글 확인이 실패해도 로그인 상태를 깨지 않는다 — 발행을 막으면 안 된다', () => {
    const i = src.indexOf('let subscriptionLabel');
    const block = src.slice(i, i + 1200);
    expect(block).toContain('try {');
    expect(block).toContain('catch');
  });

  it('라벨이 있을 때만 넘긴다 (빈 문자열로 덮어쓰지 않음)', () => {
    expect(src).toContain('...(subscriptionLabel ? { subscriptionLabel } : {})');
  });
});

describe('UI — 측정한 라벨을 실제로 보여준다', () => {
  it('subscriptionLabel 이 있으면 "연동됨" 대신 그것을 표시한다', () => {
    const i = uiScript.indexOf('window.getDropshotSubscriptionNote');
    expect(i).toBeGreaterThan(-1);
    const block = uiScript.slice(i, i + 900);
    expect(block).toContain("normalized.subscriptionLabel !== '연동됨'");
  });

  it('정규화 함수가 백엔드 라벨을 덮어쓰지 않는다', () => {
    expect(uiScript).toContain('subscriptionLabel: result.subscriptionLabel || subscriptionLabel');
  });
});
