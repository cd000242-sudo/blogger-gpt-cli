const fs = require('fs');
const path = require('path');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/** 표식 사이만 자른다 — 고정 길이 slice 는 코드가 몇 줄만 밀려도 헛것을 검사한다 */
function blockBetween(source: string, startMarker: string, endMarker: string): string {
  const from = source.indexOf(startMarker);
  if (from === -1) throw new Error('시작 표시를 못 찾음: ' + startMarker);
  const to = source.indexOf(endMarker, from + startMarker.length);
  return to === -1 ? source.slice(from) : source.slice(from, to);
}

/*
 * v3.8.636 — 로그인은 사람이 누른다. 새 버전 알림은 인증창에서도 보인다.
 *
 * 사장님: "자동로그인있자나 앱을 시작하면 로그인이 자동으로 되는게아니라
 *          아이디 비밀번호만 자동으로 입력되어있어야지 거기서 자동로그인도
 *          새버전을 감지했습니다가 로그인 인증 창에서도 떠야되고"
 *
 * 자동 진입은 **두 겹**이었다. 메인 프로세스가 로그인 창을 아예 안 띄우고,
 * 창이 떠도 안에서 스스로 들어갔다. 한 겹만 고치면 아무 일도 안 일어난다.
 */
describe('v3.8.636 로그인 채우기와 새 버전 알림', () => {
  const login = read('electron/ui/login-window.html');
  const manager = read('src/utils/auto-login-manager.ts');
  const updater = read('electron/updater.ts');
  const main = read('electron/main.ts');
  const mainLogin = read('electron/main-login.ts');

  describe('① 자동으로 들어가지 않는다', () => {
    /** 메인 프로세스가 창을 건너뛰면 채워 넣을 화면 자체가 없다 */
    test('라이선스가 유효해도 로그인 창을 띄운다', () => {
      expect(manager).not.toContain('shouldShowLoginWindow: false');
      expect(manager).toContain('로그인 창은');
    });

    test('창 안에서도 스스로 들어가지 않는다', () => {
      expect(login).not.toContain('checkAutoLoginOnLoad');
    });

    /** 함수만 남겨 두면 다음에 누가 다시 불러서 되살아난다 */
    test('자동 진입 함수를 남겨 두지 않았다', () => {
      expect(login).not.toContain('async function checkAutoLoginOnLoad');
    });

    test('로그인 자체는 그대로 동작한다 — 검증을 없앤 게 아니다', () => {
      expect(login).toContain("invoke('license-authenticate'");
    });
  });

  describe('② 아이디·비밀번호를 채워 둔다', () => {
    const boot = blockBetween(login, "invoke('load-auto-login-config')", '// 폼 제출');

    test('둘 다 채운다', () => {
      expect(boot).toContain('userIdInput.value = config.userId');
      expect(boot).toContain('passwordInput.value = config.password');
    });

    test('체크 상태도 되살린다 — 껐는데 켜져 보이면 안 된다', () => {
      expect(boot).toContain('autoLoginCheckbox.checked = !!(config && config.enabled)');
    });

    /** 이제 자동 진입이 아니므로 이름이 맞아야 한다 */
    test('라벨이 실제 동작과 맞다', () => {
      expect(login).toContain('아이디·비밀번호 기억');
      expect(login).not.toContain('자동 로그인 유지');
    });
  });

  describe('③ 비밀번호는 OS 금고에 넣는다', () => {
    /** 파일에 그대로 적으면 auto-login.json 을 여는 순간 드러난다 */
    test('평문으로 적지 않는다', () => {
      expect(manager).toContain('safeStorage');
      expect(manager).toContain('encryptString');
      expect(manager).toContain('decryptString');
    });

    test('잠글 수 없는 환경이면 저장하지 않는다 — 약하게 저장하느니 안 채운다', () => {
      const lock = blockBetween(manager, 'function lockPassword', 'function unlockPassword');
      expect(lock).toContain('isEncryptionAvailable');
      expect(lock).toContain("return ''");
    });

    /** 옛 호출부(2인자)가 남아 있어 이걸 안 하면 어느 한 곳이 조용히 지운다 */
    test('비밀번호를 안 넘기면 이미 저장된 것을 지키다', () => {
      const save = blockBetween(manager, 'export function saveAutoLoginConfig', 'export function loadAutoLoginConfig');
      expect(save).toContain('before?.pw');
    });

    test('기억을 끄면 비밀번호도 지운다', () => {
      const save = blockBetween(manager, 'export function saveAutoLoginConfig', 'export function loadAutoLoginConfig');
      expect(save).toContain('if (enabled) {');
      expect(save).toContain("let sealed = ''");
    });

    /** 채널 어느 쪽이든 세 번째 인자를 안 받으면 비밀번호가 사라진다 */
    test('IPC 두 곳 모두 비밀번호를 받는다', () => {
      expect(main).toContain('saveAutoLoginConfig(enabled, userId, password)');
      expect(mainLogin).toContain('saveAutoLoginConfig(enabled, userId, password)');
    });

    test('화면이 비밀번호를 넘긴다', () => {
      expect(login).toContain("'save-auto-login-config', true, userId, password");
    });
  });

  describe('④ 새 버전 알림이 인증창에도 뜬다', () => {
    /** 이게 진짜 원인이었다 — 아무 창에도 안 보내고 인증창을 숨기기만 했다 */
    test('새 버전을 찾으면 창들에 알린다', () => {
      const onAvailable = blockBetween(updater, "updater.on('update-available'", "updater.on('update-not-available'");
      expect(onAvailable).toContain("type: 'available'");
      expect(onAvailable).toContain('getAllWindows');
    });

    test('인증창을 말없이 숨기지 않는다', () => {
      const onAvailable = blockBetween(updater, "updater.on('update-available'", "updater.on('update-not-available'");
      expect(onAvailable).not.toContain('loginWindowRef.hide()');
    });

    /** 업데이트가 먼저 돌고 인증창이 뒤늦게 뜨는 경우도 같은 대접이어야 한다 */
    test('늦게 뜬 인증창에도 알린다', () => {
      const setter = blockBetween(updater, 'export function setUpdaterLoginWindow', '/** 업데이트 진행 중 여부 */');
      expect(setter).not.toContain('loginWindowRef.hide()');
      expect(setter).toContain("type: 'available'");
    });

    test('인증창이 세 단계를 다 그린다', () => {
      const modal = blockBetween(login, 'var ensureUpdateModal', '// 앱 시작 시');
      expect(login).toContain('새 버전 v');
      expect(modal).toContain("data.type === 'available'");
      expect(modal).toContain("data.type === 'progress'");
      expect(modal).toContain("data.type === 'downloaded'");
    });

    /** 화면을 그냥 비우면 앱이 멈춘 것처럼 보인다 */
    test('로그인 카드를 숨기기만 하던 옛 처리를 걷어냈다', () => {
      expect(login).not.toContain("loginCard.style.display = 'none'");
    });
  });
});
