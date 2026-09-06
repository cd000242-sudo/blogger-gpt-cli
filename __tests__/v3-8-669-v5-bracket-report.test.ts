const fs = require('fs');
const path = require('path');

import { parseCpcReport, usableSlots } from '../src/core/keywords/cpc-report';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.669 — 2026-09-06 리포트(v5 2회차)에서 앱이 "리포트를 받았지만 항목을 읽지 못했습니다" 를 띄웠다.
 * 서식이 또 바뀌었다: "## 채택 N건" 아래 "### [1] 키워드 - 각도", "- 등급: 통과", "**출처 기사** - URL: […](…)",
 * "### 확정 제목" 다음 줄에 「…」. 탈락 후보는 "### (가)" 로 온다 — 항목으로 세면 안 된다.
 * 항목마다 출처 기사 URL 이 있다 — 리포트 전체 URL 은 출처가 아니었지만 이건 출처다.
 */
const REPORT = [
  '# 2026-09-06 네이버 상위노출 키워드 리포트',
  '',
  '운영 방식 v5 (2026-09-05 전면 개편) 2회차 적용.',
  '',
  '## 0-1단계 발행 회수 \\- 42일 만의 첫 발행 확인',
  '',
  '- URL: [https://leadernam.com/wp-json/wp/v2/posts?per\\_page=30\\&orderby=date](https://leadernam.com/wp-json/wp/v2/posts?per\\_page=30\\&orderby=date)',
  '',
  '## 채택 1건',
  '',
  '### \\[1\\] 양육비 선지급 탈락 사유 \\- 10·29 소득기준 폐지 후에도 남는 요건',
  '',
  '- 카테고리: 정부지원금·복지 (고CPC 우선순위 7번)',
  '- 등급: 통과 (3박자 전건 충족)',
  '- 경쟁판정: **\\[확인\\]**',
  '',
  '**출처 기사**',
  '',
  '- 제목: "20만원으로 학원도 못 보내"…양육비 선지급금 현실화 \'시동\'',
  '- 매체: 머니투데이 / pubDate: **2026-09-06 07:00 KST** \\[확인\\]',
  '- URL: [https://www.mt.co.kr/policy/2026/09/06/2026090412572496705](https://www.mt.co.kr/policy/2026/09/06/2026090412572496705)',
  '',
  '### 3박자 채점 근거',
  '',
  '**① 잠재트래픽 \\- 통과**',
  '',
  '### 확정 제목',
  '',
  '**「양육비 선지급 탈락 사유 소득기준 폐지 후에도 남는 신청 요건과 이의신청 기한」 (42자)**',
  '',
  '- 42자로 35-55자 범위 \\- 필수 3번 충족',
  '',
  '**롱테일 파생 3개**',
  '',
  '1. 양육비 선지급 소급 지급 안 되는 기간 \\- 신청한 달 이전 미지급분 처리',
  '2. 양육비 선지급 만 18세 이하 자녀 기준 \\- 학년 아닌 출생연도와 생일 판정',
  '3. 기초생활수급자 양육비 선지급금 소득 산입 여부와 수급 탈락 가능성',
  '',
  '### 발행 전 확인이 필요한 수치 \\- 전건 원문 대조 필수',
  '',
  '1. **소득기준 폐지 시행일 2026년 10월 29일** \\- 법률 개정 부칙 원문으로 확인',
  '2. **월 20만원 / 자녀 1인당 / 만 18세 이하** \\- 원문 고시에서만 인용',
  '3. **이의신청 기한** \\- 조문에서 확인',
  '',
  '---',
  '',
  '## 오늘 탈락시킨 후보',
  '',
  '### (가) ② 게이트 탈락 \\- 최근 24시간 신규 5건 이상',
  '',
  '| 후보 | 판정 |',
  '| :---- | :---- |',
  '| 농어촌 기본소득 (임실형 농어촌 기본소득) | **탈락** |',
  '',
  '### (나) ① 게이트 탈락 \\- 앵커 0.3배 미달',
  '',
  '| 금 투자 세금 | 탈락 |',
].join('\n');

describe('v3.8.669 v5 2회차 리포트 — "### [1]" 항목', () => {
  const report = parseCpcReport(REPORT);

  test('채택 항목 하나를 읽고, 탈락 후보(가·나)는 항목으로 세지 않는다', () => {
    expect(report.slots).toHaveLength(1);
    const s = report.slots[0]!;
    expect(s.slot).toBe('1');
    expect(s.keyword).toBe('양육비 선지급 탈락 사유');
    expect(s.label).toBe('10·29 소득기준 폐지 후에도 남는 요건');
    expect(s.title).toBe('양육비 선지급 탈락 사유 소득기준 폐지 후에도 남는 신청 요건과 이의신청 기한');
    expect(s.grade).toMatch(/^통과/);
    expect(s.empty).toBe(false);
    expect(usableSlots(report)).toHaveLength(1);
  });

  test('롱테일·발행 전 확인 수치·항목별 출처 URL 을 읽는다', () => {
    const s = report.slots[0]!;
    expect(s.longtails).toHaveLength(3);
    expect(s.longtails[0]).toContain('소급');
    expect(s.mustCheck).toHaveLength(3);
    expect(s.mustCheck[0]).toContain('2026년 10월 29일');
    expect(s.urls).toEqual(['https://www.mt.co.kr/policy/2026/09/06/2026090412572496705']);
    // 리포트 전체 주소는 역슬래시가 풀린 채로
    expect(report.urls).toContain('https://leadernam.com/wp-json/wp/v2/posts?per_page=30&orderby=date');
  });

  test('배선 — 두 경로 모두 항목별 출처를 리포트 전체 주소보다 앞에 둔다', () => {
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain('cpcReportSlot?.urls');
    expect(o).toContain('[...slotUrls, ...');
    const agent = blockBetween(read('electron/main.ts'), 'v3.8.583 — 에이전트에게도', '[AGENT-GROUNDING] 준비 스킵');
    expect(agent).toContain('cpcReportSlot?.urls || []), ...((request?.payload as any)?.cpcReportUrls');
  });
});
