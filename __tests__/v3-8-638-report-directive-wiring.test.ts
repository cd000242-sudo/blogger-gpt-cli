const fs = require('fs');
const path = require('path');

import { parseCpcReport, buildReportDirective } from '../src/core/keywords/cpc-report';

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
 * v3.8.638 — 리포트 설계도를 **글 쓰기 전에** 넣는다.
 *
 * 사장님: "발행전 확인은 굳이볼필요가없자나 자동으로 발행이되는데 개입을 못하는데말이야
 *          발행전 확인을 보더라도 이건 앱이 자동으로 인식하게끔 하는게맞는거아니니?"
 *
 * 맞는 지적이었고 실제로 안 되고 있었다. buildReportDirective 는 v3.8.631 에
 * 만들어졌지만 **아무 데서도 호출되지 않았다.** 리포트의 롱테일·확인 항목은
 * 발행 뒤 pre-publish-fix 가 "안 지켰다" 고 지적할 때만 쓰였다 —
 * 시키지도 않고 나무란 셈이다. (실측: 리포트가 준 9개 중 2개만 글에 들어갔다.)
 *
 * 같은 점검에서 v3.8.633 의 속보 못박음도 에이전트 경로에서
 * **한 번도 안 돌고 있었다**는 것이 드러났다 — 넘겨주는 쪽이 없었다.
 */
describe('v3.8.638 리포트 설계도 배선', () => {
  describe('지시문 자체', () => {
    const report = parseCpcReport([
      '# 2026-09-04 고CPC 키워드 리포트',
      '',
      '# 슬롯 C - 거절·분쟁 상황글',
      '## 키워드: 대출 갈아타기 부결',
      '### 확정 제목',
      '대출 갈아타기 부결 사유와 재신청 방법',
      '### 롱테일 파생 키워드',
      '- 신용대출 갈아타기 부결',
      '- 주담대 갈아타기 부결',
      '### 발행 전 확인 필요',
      '- 금융위 2026-09-01 보도자료 원문 확인',
      '',
    ].join('\n'));

    const slot = report.slots.find((s) => s.slot === 'C')!;

    test('롱테일을 구간으로 못박는다', () => {
      const d = buildReportDirective(slot);
      expect(d).toContain('신용대출 갈아타기 부결');
      expect(d).toContain('주담대 갈아타기 부결');
    });

    test('확인 항목도 지시문에 싣는다 — 사람이 보는 대신 모델이 지킨다', () => {
      expect(buildReportDirective(slot)).toContain('금융위');
    });

    test('빈 슬롯이면 빈 문자열 — 없는 지시를 지어내지 않는다', () => {
      expect(buildReportDirective(null as any)).toBe('');
    });
  });

  describe('API 경로 — 생성 프롬프트에 들어간다', () => {
    const orch = read('src/core/final/orchestration.ts');

    /** 이게 빠져 있어서 리포트가 발행 뒤 지적에만 쓰였다 */
    test('설계도를 만들어 프롬프트에 넣는다', () => {
      expect(orch).toContain('buildReportDirective(slot');
      expect(orch).toContain('...(reportDirective ? [reportDirective] : [])');
    });

    test('payload 의 슬롯에서 읽는다', () => {
      const block = blockBetween(orch, 'let reportDirective', 'factEnrichedContents = [');
      expect(block).toContain('cpcReportSlot');
    });

    /** 발행 뒤 검사만 남으면 "시키지도 않고 나무라는" 옛 상태로 돌아간다 */
    test('발행 전 검사도 그대로 있다 — 지시와 검사 둘 다 필요하다', () => {
      expect(read('src/core/final/pre-publish-fix.ts')).toContain('checkReportCompliance');
    });
  });

  describe('에이전트 경로 — orchestration 을 안 탄다', () => {
    const harness = read('src/core/final/agent-harness.ts');
    const main = read('electron/main.ts');

    test('하네스가 설계도를 받는다', () => {
      expect(harness).toContain('reportSlot?: any;');
      expect(harness).toContain('buildReportDirective');
    });

    /** 하네스 안에만 넣고 넘겨주지 않으면 죽은 코드다 — v3.8.633 이 그랬다 */
    test('앱이 실제로 넘겨준다', () => {
      const call = blockBetween(main, 'return buildAgentHarnessRules({', '});');
      expect(call).toContain('reportSlot:');
      expect(call).toContain('breakingEvent:');
    });

    test('속보 판정을 payload 에 실어 둔다', () => {
      expect(main).toContain('agentBreakingEvent: g.breakingEvent');
      const call = blockBetween(main, 'return buildAgentHarnessRules({', '});');
      expect(call).toContain('agentBreakingEvent');
    });
  });

  describe('화면 — 사람이 못 하는 일을 시키지 않는다', () => {
    const ui = read('electron/ui/index.html');
    const posting = read('electron/ui/modules/posting.js');

    /** 자동 발행이라 사장님이 손댈 수 없다. 펼쳐 볼 수는 있게 남긴다 */
    test('확인 항목을 접어 둔다', () => {
      expect(ui).toContain('앱이 지킬 확인 항목');
      expect(ui).not.toContain('>발행 전 확인</div>');
    });

    test('참고 주소가 발행까지 흘러간다', () => {
      expect(ui).toContain('window.__cpcReportUrls');
      expect(posting).toContain('cpcReportUrls: window.__cpcReportUrls');
    });
  });
});
