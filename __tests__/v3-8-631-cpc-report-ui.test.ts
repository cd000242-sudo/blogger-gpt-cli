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
 * 사장님: "리더남 황금키워드 라고해서 메인탭 달력윗공간에 배치했던거기억나니?
 *         그것처럼 나만볼수있게 거기로 자동으로 불러오게끔"
 *         "키워드랑 확정제목을 들고오고 롱테일 파생 키워드도 같이 보여주면 더욱금상첨화"
 */
describe('v3.8.631 리포트 카드와 발행 연결', () => {
  const html = read('electron/ui/index.html');
  const posting = read('electron/ui/modules/posting.js');
  const main = read('electron/main.ts');

  describe('사장님만 보인다 — 잠글 문이 아니라 방이 없다', () => {
    test('카드는 기본이 숨김이다', () => {
      const card = blockBetween(html, 'id="cpcReportCard"', '</div>');
      expect(card).toContain('display: none');
    });

    test('설정이 없으면 IPC 가 enabled:false 를 준다', () => {
      const handler = blockBetween(main, "ipcMain.handle('keywords:latest-report'", "ipcMain.handle('keywords:mark-report-used'");
      expect(handler).toContain('if (!dir) return { ok: false, enabled: false');
    });

    test('폴더 경로를 코드에 적지 않는다 — 실행파일은 누구나 열 수 있다', () => {
      const handler = blockBetween(main, 'function cpcReportDir()', "ipcMain.handle('keywords:latest-report'");
      // 설정에서만 읽는다
      expect(handler).toContain('config?.cpcReportDir');
      // 경로처럼 보이는 상수가 박혀 있으면 안 된다
      expect(handler).not.toMatch(/["'][A-Z]:[\\/]/);
      expect(handler).not.toMatch(/drive\.google\.com|folders\/[A-Za-z0-9_-]{20,}/);
    });

    test('화면도 enabled 가 아니면 카드를 숨긴 채 둔다', () => {
      const fn = blockBetween(html, 'async function loadCpcReport(', 'function useCpcSlot(');
      expect(fn).toContain("card.style.display = 'none'");
      expect(fn).toContain('!r.enabled');
    });
  });

  describe('카드가 보여주는 것', () => {
    const render = blockBetween(html, 'function renderCpcSlot(', 'async function loadCpcReport(');

    test('키워드와 확정 제목을 따로 보여준다 — 둘은 다른 것이다', () => {
      expect(render).toContain('>키워드<');
      expect(render).toContain('>확정 제목<');
    });

    test('롱테일 파생 키워드를 보여준다', () => {
      expect(render).toContain('롱테일 파생 키워드');
      expect(render).toContain('slot.longtails');
    });

    test('발행 전 확인 항목도 보여준다', () => {
      expect(render).toContain('발행 전 확인');
      expect(render).toContain('slot.mustCheck');
    });

    test('리포트 글자를 그대로 넣지 않는다 — HTML 을 이스케이프한다', () => {
      expect(render).toContain('esc(');
      expect(render).toMatch(/replace\(\/\[&<>"\]\/g/);
    });
  });

  describe('고른 슬롯이 제자리로 들어간다', () => {
    const fn = blockBetween(html, 'function useCpcSlot(', 'window.loadCpcReport =');

    test('키워드는 키워드 칸으로', () => {
      expect(fn).toContain("getElementById('keywordInput')");
      expect(fn).toContain('keywordInput.value = slot.keyword');
    });

    /**
     * 제목을 키워드 칸에 넣으면 앱이 제목을 **다시 지어내면서** 리포트가 고른
     * 제목이 버려진다. 직접입력을 켜야 그 제목 그대로 나간다.
     */
    test('확정 제목은 제목 직접입력 칸으로, 체크까지 켠다', () => {
      expect(fn).toContain("getElementById('useCustomTitle')");
      expect(fn).toContain('customCheck.checked = true');
      expect(fn).toContain('customInput.value = slot.title');
    });

    test('설계도를 payload 가 집어 갈 수 있게 남긴다', () => {
      expect(fn).toContain('window.__cpcReportSlot = slot');
    });

    test('같은 리포트를 두 번 쓰지 않게 기록한다', () => {
      // v3.8.635: 드라이브 파일 id 를 같이 넘긴다 — 어느 리포트를 썼는지로 새 것을 가른다
      expect(fn).toContain("invoke('keywords:mark-report-used'");
    });

    test('무엇을 가져왔는지 로그로 남긴다 — 조용히 채우지 않는다', () => {
      expect(fn).toContain('리포트에서 가져왔습니다');
    });
  });

  describe('설계도가 발행까지 이어진다', () => {
    test('payload 가 슬롯을 싣는다', () => {
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

  describe('황금키워드와 같은 자리에서 자동으로 뜬다', () => {
    test('메인 탭 달력 위 — 황금키워드 배너가 있던 자리', () => {
      const at = html.indexOf('id="cpcReportCard"');
      const banner = html.indexOf('오늘의 리더남 황금키워드" 대형 배너 삭제');
      const calendar = html.indexOf('메인 수평 레이아웃');
      expect(at).toBeGreaterThan(banner);
      expect(at).toBeLessThan(calendar);
    });

    test('앱이 뜰 때 황금키워드와 함께 불러온다', () => {
      expect(html).toContain('if (typeof loadCpcReport === \'function\') loadCpcReport(false);');
    });
  });
});
