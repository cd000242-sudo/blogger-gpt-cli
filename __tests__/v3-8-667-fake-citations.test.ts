const fs = require('fs');
const path = require('path');

import { findUnkeptTitlePromises } from '../src/core/final/reader-retention';
import { ensureTitlePromiseHeadings } from '../src/core/final/title-promise-headings';
import { buildReportDirective } from '../src/core/keywords/cpc-report';
import { DEPTH_VOICE_RULES } from '../src/core/final/depth-voice';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.667 — 666 뒤 5편(100 · 88 · 100 · 90 · 84)을 읽고.
 *  ① 가짜 인용: 안 읽은 리포트 주소(wp-json·404·무관 기사)가 "출처" 로 적히고 내용까지 지어졌다
 *  ② 같은 약속에 절 둘: 약속 이행 검사가 용언 조각("가도·따로다")까지 세어 맡은 소제목을 못 알아봤다
 *  ③ 특정 회사 사내 제도가 주의 문장으로 들어왔다 (규칙)
 */
describe('v3.8.667 가짜 인용 · 약속 절 중복', () => {
  const TITLE = '햇살론15가 거절되는 지점 - 9·4 서민금융 복합지원센터로 가도 보증심사는 따로다';

  test('② 용언 조각을 빼고 세면 "9·4 복합지원센터도 보증심사는 따로" 가 약속을 맡은 것이다', () => {
    const headings = ['햇살론15가 거절되는 지점과 심사 기준', '9·4 복합지원센터도 보증심사는 따로', '직접보증 재신청 전 판단할 조건', '승인기간과 대환 가능성 확인법'];
    expect(findUnkeptTitlePromises(TITLE, headings, '')).toHaveLength(0);
    const r = ensureTitlePromiseHeadings(TITLE, headings, '햇살론15가 거절되는 지점');
    expect(r.replaced).toHaveLength(0);
    expect(r.h2Titles).toEqual(headings);
    // 정말 안 맡았으면 여전히 잡는다
    const none = ['햇살론15가 거절되는 지점과 심사 기준', '재신청 전 판단할 조건', '승인기간과 대환 가능성 확인법'];
    expect(findUnkeptTitlePromises(TITLE, none, '')).toHaveLength(1);
  });

  test('① 지시문의 출처 줄은 "장부에 실린 주소" 라고 말하고, 지어내지 말라고 못 박는다', () => {
    const slot = { slot: 'A', label: '', keyword: '테스트', title: '', grade: '', longtails: [], mustCheck: [], track: '', empty: false };
    const text = buildReportDirective(slot as any, ['https://www.mt.co.kr/policy/2026/09/06/1']);
    expect(text).toContain('본문은 위 근거 장부에 실려 있습니다');
    expect(text).toContain('읽지 않은 주소의 내용을 지어내지 않습니다');
    expect(text).not.toContain('여기부터 읽고 씁니다');
    expect(buildReportDirective(slot as any, [])).not.toContain('출처');
  });

  test('①' + ' 배선 — 두 경로 모두 실제로 읽은 주소만 지시문으로 넘긴다', () => {
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain('let relevantReportUrls: string[] = [];');
    expect(o).toContain('relevantReportUrls = rs.used.map(');
    expect(o).toContain('buildReportDirective(slot, relevantReportUrls)');
    expect(o).not.toContain("buildReportDirective(slot, (payload as any)?.cpcReportUrls || [])");
    const agent = blockBetween(read('electron/main.ts'), 'v3.8.583 — 에이전트에게도', '[AGENT-GROUNDING] 준비 스킵');
    expect(agent).toContain('cpcReportUrls: rs.used.map(');
  });

  test('③ 규칙 — 사내 제도는 이름조차 쓰지 않는다 · 안 읽은 주소의 내용을 지어내지 않는다', () => {
    expect(DEPTH_VOICE_RULES).toContain('그 이름을 아예 쓰지 않습니다');
    expect(DEPTH_VOICE_RULES).toContain('읽지 않은 주소의 내용을 지어내');
  });
});
