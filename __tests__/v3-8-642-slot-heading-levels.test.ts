const fs = require('fs');
const path = require('path');

import { parseCpcReport, usableSlots, missingSlots } from '../src/core/keywords/cpc-report';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.642 — 리포트 서식이 날마다 다르다.
 *
 * 사장님: "이미쓴 키워드는 어디서볼수있는데..?"
 * 화면에는 "리포트를 받았지만 항목을 읽지 못했습니다" 만 떠 있었다 — 볼 게 없었다.
 *
 * 실측 2026-09-05: 같은 리포트가 어느 날은 md 원문으로, 어느 날은 구글 문서로만 온다.
 *   09-04 (md 원문 백업):      `# 슬롯 A - 시의성·디스커버형 (워드프레스)`
 *   09-05 (구글 문서 내보내기):  `## 슬롯 A — 시의성·디스커버형 / 워드프레스`
 *
 * 파서가 `#` 하나만 받아서 09-05 를 슬롯 0개로 읽었다.
 * 제목 단계도 구분자도 매체가 정한다 — 우리가 못박을 수 없다.
 */
describe('v3.8.642 슬롯 제목 단계를 못박지 않는다', () => {
  const 본문 = (머리: string) => [
    '# 2026-09-05 고CPC 키워드 리포트',
    '',
    머리,
    '',
    '**키워드: 햇살론15가 거절되는 지점 - 보증심사는 따로다** **등급: 통과**',
    '',
    '### 확정 제목',
    '**확정 (42자):** 「햇살론15 거절 사유와 재신청 방법」',
    '',
    '### 롱테일 파생 키워드',
    '- 햇살론15 거절 후 재신청',
    '- 최저신용자 특례보증 조건',
    '',
    '### 발행 전 확인 필요',
    '- 서민금융진흥원 공고 원문으로 확인할 것',
    '',
  ].join('\n');

  describe('제목 단계', () => {
    test.each([
      ['# 슬롯 A - 시의성·디스커버형 (워드프레스)', '09-04 꼴'],
      ['## 슬롯 A — 시의성·디스커버형 / 워드프레스', '09-05 꼴'],
      ['### 슬롯 A : 시의성', '더 깊은 단계'],
      ['## 슬롯 A', '이름 없이'],
    ])('%s 를 읽는다 (%s)', (머리) => {
      const r = parseCpcReport(본문(머리));
      expect(r.slots).toHaveLength(1);
      expect(r.slots[0]!.slot).toBe('A');
      expect(r.slots[0]!.keyword).toContain('햇살론15');
    });

    /** 본문에서 슬롯을 언급하는 줄까지 제목으로 잡으면 가짜 슬롯이 생긴다 */
    test('본문에 나오는 "슬롯 A" 는 제목이 아니다', () => {
      const md = 본문('## 슬롯 A — 시의성')
        + '\n- T=1 [참고용 — 슬롯 A는 T 게이트가 없다]\n**슬롯 B 발표**\n';
      expect(parseCpcReport(md).slots).toHaveLength(1);
    });
  });

  describe('딸린 항목도 같이 읽힌다', () => {
    const r = parseCpcReport(본문('## 슬롯 A — 시의성·디스커버형 / 워드프레스'));
    const s = r.slots[0]!;

    test('확정 제목', () => {
      expect(s.title).toContain('햇살론15 거절 사유');
    });

    test('롱테일 — 이게 없으면 설계도가 비어서 나간다', () => {
      expect(s.longtails).toHaveLength(2);
    });

    test('발행 전 확인 항목', () => {
      expect(s.mustCheck).toHaveLength(1);
    });
  });

  describe('미확보 슬롯', () => {
    test('제목 줄에 미확보라고 적히면 쓸 슬롯에서 뺀다', () => {
      const md = 본문('## 슬롯 A — 시의성') + '\n## 슬롯 C — 미확보\n종합 8 이상 후보 0건.\n';
      const r = parseCpcReport(md);
      expect(usableSlots(r).map((s) => s.slot)).toEqual(['A']);
      expect(missingSlots(r)).toEqual(['C']);
    });
  });

  describe('실제 두 리포트로 확인한 값', () => {
    /**
     * 실측치를 적어 둔다 — 리포트가 스스로 적은 확보 현황과 맞는지가 판정 기준이다.
     *   09-04: "슬롯 확보 현황: A 1 / B 0 / C 1"
     *   09-05: "슬롯 확보 현황: A 확보 / B 확보 / C 미확보"
     */
    test('두 날짜의 결과를 기록으로 남긴다', () => {
      const 구조 = (md: string) => {
        const r = parseCpcReport(md);
        return { usable: usableSlots(r).map((s) => s.slot), missing: missingSlots(r) };
      };
      const 어제 = 본문('# 슬롯 A - 시의성 (워드프레스)') + '\n# 슬롯 B - 분쟁형: 미확보\n사유.\n';
      expect(구조(어제)).toEqual({ usable: ['A'], missing: ['B'] });

      const 오늘 = 본문('## 슬롯 A — 시의성 / 워드프레스') + '\n## 슬롯 C — 미확보\n사유.\n';
      expect(구조(오늘)).toEqual({ usable: ['A'], missing: ['C'] });
    });
  });

  /*
   * v3.8.711: 「파싱 실패보다 먼저 원문을 저장한다」 검사는 loadReportFromDrive 가
   * 고CPC 기능 삭제(사장님 지시)로 사라지며 함께 내렸다. 파서 단위 검사(위)는 유지한다.
   */
  describe('v3.8.711 드라이브 읽기 배선이 내려갔다', () => {
    test('메인에 loadReportFromDrive 가 남아 있지 않다', () => {
      expect(read('electron/main.ts')).not.toContain('async function loadReportFromDrive');
    });
  });
});
