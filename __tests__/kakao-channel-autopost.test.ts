/**
 * v3.8.510 — 카카오톡 채널 소식 자동 발행 하네스
 *
 * 소식(포스트) 공식 API 없음 (2026-08 확인) → business.kakao.com UI 자동화.
 * 원칙: 사장님 손 = 로그인 1회 + 충전뿐. 비밀번호는 절대 저장하지 않는다 (세션 프로필만).
 * 도배 = 채널 제재 리스크 → 하루 2회 하드캡.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const poster = require('../src/kakao-channel/kakao-poster');

describe('① 포스터 모듈 계약', () => {
  it('핵심 함수를 내보낸다', () => {
    expect(typeof poster.checkSession).toBe('function');
    expect(typeof poster.loginInteractive).toBe('function');
    expect(typeof poster.postNews).toBe('function');
    expect(typeof poster.countPostsToday).toBe('function');
  });

  it('세션 프로필은 앱 전용 폴더(.leadernam-orbit) 아래에 산다', () => {
    expect(poster.PROFILE_ROOT).toContain('.leadernam-orbit');
    expect(poster.PROFILE_ROOT).toContain('kakao-channel');
  });

  it('비밀번호를 다루는 코드가 없다 — 세션 쿠키만 (소스 검사)', () => {
    const src = read('src/kakao-channel/kakao-poster.js');
    // "저장하지 않는다" 같은 안내 주석은 허용 — 실제로 비밀번호를 입력/채우는 코드만 금지
    expect(src).not.toMatch(/password/i);
    expect(src).not.toMatch(/비밀번호[^\n]*(입력|채우|fill)/);
  });

  it('하루 상한은 2회 하드캡이다', () => {
    expect(poster.DAILY_CAP).toBe(2);
  });

  it('실측 셀렉터가 박혀 있다 (2026-08-17 소식 작성 화면 실측·드라이런 검증)', () => {
    const sel = require('../src/kakao-channel/kakao-selectors');
    expect(sel.KAKAO_SELECTORS.titleInput).toBe('input[placeholder="제목"]');
    expect(sel.KAKAO_SELECTORS.bodyInput).toBe('textarea[type="creator"]');
    expect(sel.KAKAO_SELECTORS.submitExactText).toBe('등록');
    expect(sel.KAKAO_URLS.posts('_x')).toContain('/posts');
  });

  it('등록 버튼은 정확 일치로 찾는다 — "등록순" 버튼 오클릭 방지 (실측 확인)', () => {
    const src = read('src/kakao-channel/kakao-poster.js');
    expect(src).toContain('exact: true');
  });

  it('로그인 성공 즉시 쿠키를 백업한다 — 카카오 세션은 창 종료 시 증발 (실측 확인)', () => {
    const src = read('src/kakao-channel/kakao-poster.js');
    const login = src.slice(src.indexOf('async function loginInteractive'), src.indexOf('async function postNews'));
    expect(login).toContain('storageState({ path: STATE_FILE })');
  });

  it('발행·세션확인은 백업 쿠키 주입으로 연다 (재로그인 불필요 — 주입 복원 검증됨)', () => {
    const src = read('src/kakao-channel/kakao-poster.js');
    expect(src).toContain('storageState: STATE_FILE');
  });

  it('실제 크롬/엣지를 우선 실행한다 — 번들 크로미움은 카카오에서 빈 화면 스톨 (실측 사고)', () => {
    const src = read('src/kakao-channel/kakao-poster.js');
    expect(src).toContain('findBrowserExecutable');
    expect(src).toContain('chrome.exe');
  });
});

describe('①-2 채널 자동 인식 — 사장님이 ID 를 타이핑할 이유가 없다 (v3.8.512)', () => {
  it('detectChannelId: 루트 → "내 비즈니스" 클릭 → URL 에서 _ID 추출 (실검증 확정 경로)', () => {
    expect(typeof poster.detectChannelId).toBe('function');
    const src = read('src/kakao-channel/kakao-poster.js');
    const fn = src.slice(src.indexOf('async function detectChannelId'));
    expect(fn).toContain("'https://business.kakao.com/'");
    expect(fn).toContain('내 비즈니스');
  });

  it('_guest 자리표시자를 채널로 오인하지 않는다 (실검증에서 잡은 사고)', () => {
    const src = read('src/kakao-channel/kakao-poster.js');
    expect(src).toContain("'_guest'");
    expect(src).toContain('function extractRealChannelId');
  });

  it('로그인도 채널 ID 없이 된다 (루트로 들어가 로그인 후 자동 인식)', () => {
    const src = read('src/kakao-channel/kakao-poster.js');
    const login = src.slice(src.indexOf('async function loginInteractive'), src.indexOf('async function postNews'));
    expect(login).not.toContain('CHANNEL_ID_REQUIRED');
  });

  it('main 에 kakao-channel-detect IPC 가 있다', () => {
    const main = read('electron/main.ts');
    expect(main).toContain("ipcMain.handle('kakao-channel-detect'");
  });

  it('UI 가 렌더 시 자동 인식을 시도하고, 발행 전에도 폴백으로 인식한다', () => {
    const ui = read('electron/ui/modules/external-traffic.js');
    expect(ui).toContain('function extTrafficKakaoDetectChannel');
    expect(ui).toContain("invoke('kakao-channel-detect'");
    const post = ui.slice(ui.indexOf('async function extTrafficKakaoAutoPost'));
    expect(post).toContain('extTrafficKakaoDetectChannel');
  });

  it('사용법이 "자동 인식"을 말한다 — 타이핑 지시 금지', () => {
    const ui = read('electron/ui/modules/external-traffic.js');
    const guide = ui.slice(ui.indexOf('kakaoChannelGuide'), ui.indexOf('function extTrafficKakaoRefreshChip'));
    expect(guide).toContain('자동으로 인식');
  });

  it('버튼 하나 UX: 자동 발행에서 세션이 없으면 로그인 창을 자동으로 띄우고 이어서 발행한다 (v3.8.513)', () => {
    const ui = read('electron/ui/modules/external-traffic.js');
    const post = ui.slice(ui.indexOf('async function extTrafficKakaoAutoPost'));
    // 로그인 폴백이 발행 흐름 안에 있고, 로그인 성공 시 받은 channelId 로 계속 간다
    const loginIdx = post.indexOf("invoke('kakao-channel-login'");
    const publishIdx = post.indexOf("invoke('kakao-channel-autopost'");
    expect(loginIdx).toBeGreaterThan(-1);
    expect(publishIdx).toBeGreaterThan(-1);
    expect(loginIdx).toBeLessThan(publishIdx);
  });
});

describe('② 일일 상한 — 도배 방지', () => {
  const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('오늘 기록만 센다 (어제 것은 안 센다)', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const log = [
      { day: day(now), at: now.toISOString() },
      { day: day(now), at: now.toISOString() },
      { day: day(yesterday), at: yesterday.toISOString() },
    ];
    expect(poster.countPostsToday(now, log)).toBe(2);
  });

  it('상한 도달 시 postNews 가 브라우저를 켜기 전에 거절한다', async () => {
    const now = new Date();
    const log = [{ day: day(now), at: now.toISOString() }, { day: day(now), at: now.toISOString() }];
    const result = await poster.postNews({ channelId: '_test', text: '본문', link: 'https://x.com' }, { logOverride: log });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('상한');
  });

  it('입력 검증: 채널 ID·본문 없으면 즉시 거절', async () => {
    const empty = await poster.postNews({ channelId: '', text: '본문' }, { logOverride: [] });
    expect(empty.ok).toBe(false);
    const noText = await poster.postNews({ channelId: '_test', text: '' }, { logOverride: [] });
    expect(noText.ok).toBe(false);
  });
});

describe('③ main IPC 배선', () => {
  const main = read('electron/main.ts');

  it('세 개의 핸들러가 등록된다', () => {
    expect(main).toContain("ipcMain.handle('kakao-channel-session-check'");
    expect(main).toContain("ipcMain.handle('kakao-channel-login'");
    expect(main).toContain("ipcMain.handle('kakao-channel-autopost'");
  });

  it('자동 발행은 무료 체험 차단을 태운다 (외부유입과 동일 정책)', () => {
    const handler = main.slice(main.indexOf("ipcMain.handle('kakao-channel-autopost'"));
    const gateIdx = handler.indexOf('blockIfFreeTier');
    const postIdx = handler.indexOf('postNews');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(postIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(postIdx);
  });
});

describe('④ UI 배선 — 카카오 채널 카드에만 탑재 (서브탭 없음)', () => {
  const ui = read('electron/ui/modules/external-traffic.js');

  it('자동 발행 줄은 kakao-channel 카드에만 붙는다', () => {
    expect(ui).toContain('function _renderKakaoChannelAutoRow');
    expect(ui).toMatch(/platform\.id === 'kakao-channel'\s*\?\s*_renderKakaoChannelAutoRow/);
  });

  it('세션 상태 칩·연결 버튼·자동 발행 버튼·채널 ID 입력이 있다', () => {
    const row = ui.slice(ui.indexOf('function _renderKakaoChannelAutoRow'), ui.indexOf('function extTrafficKakaoRefreshChip'));
    expect(row).toContain('kakaoChannelSessionChip');
    expect(row).toContain('채널 연결');
    expect(row).toContain('채널에 자동 발행');
    expect(row).toContain('kakaoChannelIdInput');
  });

  it('핸들러 3종이 창에 노출되고 IPC 이름이 main 과 일치한다', () => {
    expect(ui).toContain('window.extTrafficKakaoLogin');
    expect(ui).toContain('window.extTrafficKakaoAutoPost');
    expect(ui).toContain('window.extTrafficKakaoRefreshChip');
    expect(ui).toContain("invoke('kakao-channel-session-check'");
    expect(ui).toContain("invoke('kakao-channel-login'");
    expect(ui).toContain("invoke('kakao-channel-autopost'");
  });

  it('발행 실패 시 몇 단계에서 멈췄는지 사용자에게 보여준다', () => {
    const fn = ui.slice(ui.indexOf('async function extTrafficKakaoAutoPost'));
    expect(fn).toMatch(/step/);
  });
});

describe('⑤ 초보자 사용법 — 보고 바로 따라할 수 있게', () => {
  const ui = read('electron/ui/modules/external-traffic.js');
  const guide = ui.slice(ui.indexOf('kakaoChannelGuide'), ui.indexOf('function extTrafficKakaoRefreshChip'));

  it('5단계가 전부 있고 각 단계에 구체 행동이 적혀 있다', () => {
    expect(guide).toContain('①');
    expect(guide).toContain('②');
    expect(guide).toContain('③');
    expect(guide).toContain('④');
    expect(guide).toContain('⑤');
    // 각 단계의 구체 행동 (버튼 이름이 그대로 들어가야 초보자가 찾는다)
    expect(guide).toContain('채널 연결');       // ① 최초 1회 로그인
    expect(guide).toContain('발행 글에서 고르기'); // ② 원본 글 선택
    expect(guide).toContain('생성');             // ③ 카카오 채널 글 생성
    expect(guide).toContain('자동 발행');        // ④ 버튼 클릭
    expect(guide).toContain('pf.kakao.com');     // ⑤ 결과 확인 위치
  });

  it('하루 2회 상한과 이유가 사용법에 명시된다', () => {
    expect(guide).toContain('하루 2회');
    expect(guide).toMatch(/제재|도배/);
  });

  it('비밀번호를 저장하지 않는다는 안내가 있다', () => {
    expect(guide).toContain('비밀번호는 저장하지 않');
  });
});
