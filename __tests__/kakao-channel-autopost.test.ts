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
