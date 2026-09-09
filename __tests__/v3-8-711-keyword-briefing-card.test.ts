const fs = require('fs');
const path = require('path');

import { braceBlock } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.711 — 사이트(LEWORD) 「오늘의 글감」 카드.
 *
 * 사장님: "내사이트에 내 앱이니까 연동도가능하지않을까" →
 *         "LEWORD를 보면 오늘의 글감이 있어 여기서 3개만 가져오게가능할까
 *          키워드 더보기 누르면 사이트로 이동하게끔"
 *
 * 옛 고CPC 카드 자리에 들어간다. 데이터는 leaderspro.kr GAS 의 content.keywordBriefing —
 * 릴리스 스크립트가 쓰는 것과 같은 공개 읽기 통로다. 조용한 미배선 이력이 있는
 * 저장소라 IPC → 카드 → 클릭 채움 → 더보기까지 배선을 줄 단위로 잰다.
 */
describe('v3.8.711 오늘의 글감 카드 (LEWORD 연동)', () => {
  const main = read('electron/main.ts');
  const ui = read('electron/ui/index.html');

  describe('메인 — 사이트에서 가져온다', () => {
    const handler = braceBlock(main, "ipcMain.handle('site:keyword-briefing'");

    test('같은 GAS 통로를 쓴다 (사이트에 공개된 내용 그대로)', () => {
      expect(main).toContain('LEADERSPRO_GAS_URL');
      expect(handler).toContain('action=site-content');
    });

    test('기회지수로 정렬해 3개만 추린다 — 원본 순서는 완전 정렬이 아니다 (09-09 실측)', () => {
      expect(handler).toContain('.sort((a, b) => b.opportunity - a.opportunity)');
      expect(handler).toContain('.slice(0, 3)');
    });

    test('못 가져온 날은 캐시라도 보여 준다 — 화면이 그냥 비면 고장으로 보인다', () => {
      expect(handler).toContain('keywordBriefingCachePath');
      expect(handler).toContain('stale: true');
    });
  });

  describe('화면 — 카드·클릭·더보기가 전부 실존한다', () => {
    test('카드와 행 컨테이너가 있다', () => {
      expect(ui).toContain('id="keywordBriefingCard"');
      expect(ui).toContain('id="keywordBriefingRows"');
    });

    test('앱이 뜰 때 불러온다 — 함수만 있고 안 부르면 죽은 코드다', () => {
      expect(ui).toContain("if (typeof loadKeywordBriefing === 'function') loadKeywordBriefing(false);");
      expect(ui).toContain("api.invoke('site:keyword-briefing')");
    });

    test('키워드 더보기가 사이트 LEWORD 페이지로 간다', () => {
      expect(ui).toContain("openExternal('https://leaderspro.kr/leword')");
    });

    test('글감을 클릭하면 발행 키워드 칸에 채운다', () => {
      const fn = braceBlock(ui, 'function useBriefingKeyword');
      expect(fn).toContain("getElementById('keywordInput')");
      expect(fn).toContain('input.value = keyword');
      expect(fn).toContain("dispatchEvent(new Event('input'");
    });

    test('사이트 글자를 그대로 넣지 않는다 — HTML 이스케이프', () => {
      const render = braceBlock(ui, 'function renderKeywordBriefingRow');
      expect(render).toContain('esc(row.keyword)');
      expect(render).toMatch(/replace\(\/\[&<>"\]\/g/);
    });
  });
});
