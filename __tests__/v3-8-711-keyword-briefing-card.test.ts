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

    /*
     * v3.8.714 — 사장님: "오늘의 글감 보이는건 오늘의 글감이 아니라 무료선정 황금키워드에서
     *            상단 3개만 들고온거같은데?" — 맞았다. 소스를 잘못 골랐다.
     *
     * 사이트 실측: GAS 의 keywordBriefing = "부방장 황금키워드" 보드(하루 1~2회),
     * Worker 의 realtime-issues = 실시간 이슈(몇 분 단위). 글감은 후자다.
     */
    /*
     * v3.8.714 — 소스를 두 번 헛짚고 사장님이 두 번 다 잡아 줬다:
     *   1차 GAS keywordBriefing  → "부방장 황금키워드" 보드였다
     *   2차 Worker realtime-issues → "실시간 검색어" 였다
     * 사이트를 직접 열어(Playwright) 확인한 진짜 출처는 정적 파일 하나다:
     *   /data/topic-briefs.json — rounds 가 아침·오후·저녁 회차로 나뉜다.
     */
    test('사이트의 글감 보드가 읽는 그 파일을 쓴다 — 황금키워드도 실시간 검색어도 아니다', () => {
      expect(main).toContain("LEWORD_TOPIC_BRIEFS_URL = 'https://leaderspro.kr/data/topic-briefs.json'");
      expect(handler).toContain('LEWORD_TOPIC_BRIEFS_URL');
      // 옛 소스를 실제로 **부르지** 않는다 (주석에는 왜 틀렸는지 남겨 둔다)
      expect(handler).not.toContain("action: 'realtime-issues'");
      expect(handler).not.toContain('action=site-content');
    });

    test('가장 최근 회차(아침·오후·저녁)에서 고른다', () => {
      expect(handler).toContain('data?.rounds');
      expect(handler).toContain('rounds[rounds.length - 1]');
      expect(handler).toContain("slot: String(latest?.slot || '')");
      expect(ui).toContain('회차 · ');
    });

    test('★ 와 NOW 를 먼저, 3개만 — 70여 건 중에서 고른다', () => {
      expect(handler).toContain("(b?.star ? 2 : 0) + (String(b?.timing) === 'NOW' ? 1 : 0)");
      expect(handler).toContain('.slice(0, 3)');
      expect(ui).toContain('TIMING = { NOW:');
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

    test('키워드 더보기가 사이트의 글감 탭으로 바로 간다', () => {
      expect(ui).toContain("openExternal('https://leaderspro.kr/leword?tab=briefs')");
    });

    /*
     * v3.8.714 — 사장님: "아침이면 아침 오후면 오후 30분 주기로 감시하고 업데이트 반영해줘"
     * 리포트는 아침·오후로 나뉘어 시각이 들쭉날쭉하게 올라온다. 시각을 못박지 않고 주기로 본다.
     * (사이트 번들 실측: leword?tab=briefs 도 같은 GAS site-content → keywordBriefing 을 읽는다)
     */
    // v3.8.714: 소스가 실시간 이슈(몇 분 단위)로 바뀌어 30분은 너무 길다 — 10분으로 줄였다
    test('10분마다 다시 보고, 창을 다시 켤 때도 확인한다', () => {
      expect(ui).toContain('function startKeywordBriefingWatch()');
      expect(ui).toContain('10 * 60 * 1000');
      expect(ui).toContain("addEventListener('visibilitychange'");
      // 함수만 만들고 안 부르면 죽은 코드다
      expect(ui).toContain("if (typeof startKeywordBriefingWatch === 'function') startKeywordBriefingWatch();");
    });

    test('내용이 바뀌면 바뀌었다고 말한다 — 조용히 갈아치우면 어느 회차인지 모른다', () => {
      expect(ui).toContain('__briefingFingerprint');
      expect(ui).toContain('방금 갱신됨');
    });

    /*
     * v3.8.714 — 사장님: "오늘의 글감 하나도 안 바꼇는데?"
     * 그때 앱은 이미 오늘 회차를 받아 그리고 있었다(캐시 실측). 화면에 "언제 확인했는지"가
     * 없어서 감시가 도는지 멈췄는지 알 수 없었던 것이다. 발행 시각과 확인 시각을 같이 적는다.
     */
    test('회차·시각·확인 시각을 같이 적는다 — 안 바뀐 날에도 앱이 봤다는 게 보여야 한다', () => {
      expect(ui).toContain("' 회차 · '");
      expect(ui).toContain("' 확인'");
      expect(ui).toContain('사이트에서 확인 중…');   // 손으로 누르면 반응이 보인다
    });

    /*
     * v3.8.714 실측 — 실제 앱을 띄워 재 보니 GAS 응답이 9.8초였고, 그동안 카드가
     * 통째로 숨어 있었다(display:none). 데이터는 멀쩡한데 **보여줄 게 없던 시간**이
     * 길어서 "하나도 안 바뀐다"로 보였다. 캐시를 먼저 그리니 4초 만에 카드가 뜬다.
     */
    test('저장된 회차를 먼저 그린다 — 네트워크를 기다리는 동안 빈 화면이면 안 바뀐 걸로 보인다', () => {
      expect(main).toContain("ipcMain.handle('site:keyword-briefing-cached'");
      expect(ui).toContain("invoke('site:keyword-briefing-cached')");
      // 캐시 그리기가 라이브 호출보다 먼저 와야 한다
      expect(ui.indexOf("invoke('site:keyword-briefing-cached')"))
        .toBeLessThan(ui.indexOf("invoke('site:keyword-briefing')"));
      expect(ui).toContain('확인 중…');
    });

    /* v3.8.714 — 사장님: "글포스팅으로 안가고 그냥 빈화면으로 가버려" (탭 id 는 'settings' 다) */
    test('글감을 클릭하면 글포스팅(settings 탭)으로 간다 — posting 은 없는 탭이다', () => {
      const fn = braceBlock(ui, 'function useBriefingKeyword');
      expect(fn).toContain("showTab('settings')");
      expect(fn).not.toContain("showTab('posting')");
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
