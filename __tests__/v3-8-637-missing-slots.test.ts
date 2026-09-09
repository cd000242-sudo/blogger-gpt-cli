const fs = require('fs');
const path = require('path');

import { parseCpcReport, usableSlots, missingSlots } from '../src/core/keywords/cpc-report';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.637 — 없는 슬롯을 말없이 빼지 않는다.
 *
 * 사장님: "구글드라이브는 슬롯 A 랑 B는 건너뛰고 C만 나오네....?"
 *
 * 실측해 보니 버그가 아니었다. 2026-09-04 리포트가 스스로 이렇게 적었다:
 *   "슬롯 확보 현황: A 1 / B 0 / C 1 = 오늘 2편"
 *   "# 슬롯 B - 시의성·분쟁형 (티스토리): **미확보**"
 * A 는 이미 발행한 글이라 접혔고, B 는 리포트가 못 채운 것이다.
 *
 * 문제는 **화면이 그 사정을 말하지 않은 것**이다. 조용히 빠지면 앱이 고장 난
 * 것처럼 보이고, 사장님은 있지도 않은 버그를 찾게 된다.
 */
describe('v3.8.637 못 채운 슬롯을 말해 준다', () => {
  const 리포트 = [
    '# 2026-09-04 고CPC 키워드 리포트',
    '',
    '# 슬롯 A - 시의성·디스커버형 (워드프레스)',
    '## 키워드: 성과급 요구 파업이 불법으로 갈리는 선',
    '### 확정 제목',
    '성과급 요구 파업이 불법으로 갈리는 선, 9·3 노동부 지침',
    '',
    '# 슬롯 B - 시의성·분쟁형 (티스토리): **미확보**',
    '오늘 창 안에서 조건을 만족하는 소재를 찾지 못했다.',
    '',
    '# 슬롯 C - 거절·분쟁 상황글 (워드프레스)',
    '## 키워드: 대출 갈아타기 부결',
    '### 확정 제목',
    '대출 갈아타기 부결 사유와 재신청 방법',
    '',
  ].join('\n');

  describe('갈라 보기', () => {
    const report = parseCpcReport(리포트);

    test('내용이 있는 슬롯만 쓸 수 있다', () => {
      expect(usableSlots(report).map((s) => s.slot)).toEqual(['A', 'C']);
    });

    /** 이게 핵심 — 사라진 것이 아니라 리포트가 못 채운 것이다 */
    test('못 채운 슬롯 이름을 돌려준다', () => {
      expect(missingSlots(report)).toEqual(['B']);
    });

    test('다 채워진 날에는 아무것도 말하지 않는다 — 없는 걱정을 만들지 않는다', () => {
      const 꽉찬 = 리포트.replace(
        '# 슬롯 B - 시의성·분쟁형 (티스토리): **미확보**\n오늘 창 안에서 조건을 만족하는 소재를 찾지 못했다.',
        '# 슬롯 B - 시의성·분쟁형\n## 키워드: 실업급여 부정수급\n### 확정 제목\n실업급여 부정수급 기준',
      );
      expect(missingSlots(parseCpcReport(꽉찬))).toEqual([]);
    });

    test('빈 리포트에도 터지지 않는다', () => {
      expect(missingSlots({ slots: [] } as any)).toEqual([]);
      expect(missingSlots(null as any)).toEqual([]);
    });
  });

  /*
   * v3.8.711: 고CPC 카드·IPC 삭제 (사장님 지시) — 「화면까지 이어져 있다」 검사는 화면과 함께 내렸다.
   * 위의 파서(missingSlots) 단위 검사는 모듈이 남아 있는 동안 유지한다. 반쯤 남은 배선만 잡는다.
   */
  describe('v3.8.711 화면·메인 배선이 깨끗이 내려갔다', () => {
    test('메인·화면 어디에도 리포트 카드 배선이 남아 있지 않다', () => {
      const main = read('electron/main.ts');
      const ui = read('electron/ui/index.html');
      expect(main).not.toContain("ipcMain.handle('keywords:latest-report'");
      expect(ui).not.toContain('function renderCpcMissing');
      expect(ui).not.toContain('renderCpcMissing(r.missingSlots)');
    });
  });
});
