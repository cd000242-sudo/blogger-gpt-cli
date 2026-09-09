const fs = require('fs');
const path = require('path');

export {};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/** 표식 사이만 잘라 본다 — 고정 길이 slice 는 코드가 몇 줄만 밀려도 헛것을 검사한다 */
function blockBetween(source: string, startMarker: string, endMarker: string): string {
  const from = source.indexOf(startMarker);
  if (from === -1) throw new Error('시작 표시를 못 찾음: ' + startMarker);
  const to = source.indexOf(endMarker, from + startMarker.length);
  return to === -1 ? source.slice(from) : source.slice(from, to);
}

/*
 * v3.8.631 — 고CPC 리포트를 메인 탭에 띄우고, 고른 슬롯을 발행 입력으로 옮긴다.
 *
 * v3.8.711 — **카드 UI 삭제.** 사장님: "고단가 CPC 그자리 없애버리고 다른거넣거나 비워두자"
 *   리포트 서식이 회차마다 바뀌어 파서가 운영 섹션을 슬롯으로 오인하는 일이 반복됐다(09-09 실측).
 *   화면(카드·슬롯 렌더·발행 준비 버튼)은 걷어냈고, 백엔드 IPC 와 발행 payload 사슬은 남겼다 —
 *   되살릴 때 화면만 다시 붙이면 되는 구조다. 이 테스트는 이제 그 경계를 지킨다:
 *   ① UI 가 정말 없어졌는가  ② 백엔드·payload 사슬은 다치지 않았는가.
 */
describe('v3.8.631→711 고CPC 리포트 — UI 삭제 후 경계', () => {
  const html = read('electron/ui/index.html');
  const posting = read('electron/ui/modules/posting.js');
  const main = read('electron/main.ts');

  describe('v3.8.711 카드가 정말 없어졌다 — 반쯤 남은 UI 는 조용한 고장이 된다', () => {
    test('카드·슬롯 렌더·발행 준비 배선이 화면에 없다', () => {
      expect(html).not.toContain('id="cpcReportCard"');
      expect(html).not.toContain('function renderCpcSlot(');
      expect(html).not.toContain('function loadCpcReport(');
      expect(html).not.toContain('function useCpcSlot(');
      expect(html).not.toContain('function connectCpcDrive(');
      expect(html).not.toContain('function cpcPublishedDigest(');
    });

    test('앱이 뜰 때 부르지도, 30분 감시도 하지 않는다', () => {
      expect(html).not.toContain('loadCpcReport(false)');
      expect(html).not.toContain('startCpcReportWatch()');
    });
  });

  describe('백엔드 IPC 도 함께 내렸다 — 부르는 곳 없는 채널은 두지 않는다 (v3.8.701 가드)', () => {
    test('네 채널 전부 등록이 없다', () => {
      expect(main).not.toContain("ipcMain.handle('keywords:latest-report'");
      expect(main).not.toContain("ipcMain.handle('keywords:mark-report-used'");
      expect(main).not.toContain("ipcMain.handle('drive:connect'");
      expect(main).not.toContain("ipcMain.handle('drive:report-status'");
    });

    test('헬퍼도 고아로 남지 않았다', () => {
      expect(main).not.toContain('function cpcReportDir()');
      expect(main).not.toContain('function driveCreds()');
      expect(main).not.toContain('function isReportOwner()');
      expect(main).not.toContain('OWNER_KEY_SHA256');
    });
  });

  describe('설계도 payload 사슬도 남아 있다 — UI 만 없을 뿐이다', () => {
    test('payload 가 슬롯을 싣는다 (지금은 항상 undefined — 카드가 없으니 채울 곳이 없다)', () => {
      expect(posting).toContain('cpcReportSlot: window.__cpcReportSlot || undefined');
    });

    test('발행 전 자가 수정이 그 슬롯을 받아 지시 이행을 잰다', () => {
      const orch = read('src/core/final/orchestration.ts');
      expect(orch).toContain('reportSlot: (payload as any)?.cpcReportSlot');
    });

    test('빠진 롱테일은 AI 가 채우고, 확인 항목은 사람에게 알린다', () => {
      const pre = read('src/core/final/pre-publish-fix.ts');
      // 롱테일은 고칠 수 있다 — 구간을 만들면 된다
      expect(pre).toContain("'report-longtail-missing',\n]);");
      // 확인 항목은 원문을 봐야 한다. AI 에게 맡기면 지어낸다
      expect(pre).toContain("kind: 'report-check-missing'");
      const check = blockBetween(pre, "kind: 'report-check-missing'", '} catch');
      expect(check).toContain('지어내면 안 됩니다');
    });
  });
});
