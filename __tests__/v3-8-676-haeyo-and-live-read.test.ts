const fs = require('fs');
const path = require('path');

import { toHaeyo, fromBnida, fromSeumnida, fromImnida } from '../src/core/final/haeyo';
import { setActiveToneStyle, applyCasualTransform } from '../src/core/final/generation';
import { findUnkeptTitlePromises } from '../src/core/final/reader-retention';
import { findFlowGaps } from '../src/core/final/narrative-flow';
import { toPlainText } from '../src/core/final/article-audit';
import { buildReportDirective } from '../src/core/keywords/cpc-report';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.676 — 675 빌드로 생성한 라이브 1편(양육비, 78점)을 읽고.
 *  · "편이 낫아요"(ㅅ 불규칙), "페이지이에요"(받침 없는 명사), "뜹니다"(ㅂ니다 꼴 미치환) → 활용 규칙 haeyo.ts
 *  · 제목 조각이 낱말 9개라 소제목 둘이 나눠 맡았는데 불이행(-6) → 긴 조각은 합쳐서 70%
 *  · "최근 3개월", "3개월 평균" 이 절차 반복(-6)으로 → 수치 구절은 기준이지 절차가 아니다
 *  · 리포트가 준 법령 이름을 본문이 안 불러 근거 조항 0건(-10) → 설계도에 "근거 법령" 줄
 */
describe('v3.8.676 해요체 활용 · 라이브 읽기의 오탐 셋', () => {
  test('활용 규칙 — 실측 결함과 흔한 어간', () => {
    expect(toHaeyo('확인하는 편이 낫습니다.')).toBe('확인하는 편이 나아요.');
    expect(toHaeyo('기관이 직접 운영하는 안내 페이지입니다.')).toBe('기관이 직접 운영하는 안내 페이지예요.');
    expect(toHaeyo('대상은 지정된 배우자입니다.')).toBe('대상은 지정된 배우자예요.');
    expect(toHaeyo('그것이 기준입니다.')).toBe('그것이 기준이에요.');
    expect(toHaeyo('대상이 아닙니다.')).toBe('대상이 아니에요.');
    expect(toHaeyo('안내가 뜹니다.')).toBe('안내가 떠요.');
    expect(toHaeyo('부담이 큽니다.')).toBe('부담이 커요.');
    expect(toHaeyo('신청이 됩니다.')).toBe('신청이 돼요.');
    expect(toHaeyo('기준이 다릅니다.')).toBe('기준이 달라요.');
    expect(toHaeyo('먼저 봅니다.')).toBe('먼저 봐요.');
    expect(toHaeyo('서류를 냅니다.')).toBe('서류를 내요.');
    expect(toHaeyo('결과를 기다립니다.')).toBe('결과를 기다려요.');
    expect(toHaeyo('절차가 쉽습니다.')).toBe('절차가 쉬워요.');
    expect(toHaeyo('설명이 어렵습니다.')).toBe('설명이 어려워요.');
    expect(toHaeyo('안내를 듣습니다.')).toBe('안내를 들어요.');
    expect(toHaeyo('그렇습니다.')).toBe('그래요.');
    expect(toHaeyo('자료가 있습니다. 문제가 없습니다. 조건이 좋습니다. 서류를 받습니다.')).toBe('자료가 있어요. 문제가 없어요. 조건이 좋아요. 서류를 받아요.');
    expect(toHaeyo('신청합니다!')).toBe('신청해요!');
    expect(toHaeyo('가능합니까?')).toBe('가능합니까?');   // 의문형은 손대지 않는다
    // 모르는 꼴은 그대로 — 틀린 해요체보다 낫다
    expect(fromBnida('가')).toBeNull();
    expect(fromSeumnida('가')).toBeNull();
    expect(fromImnida('사람')).toBe('이에요');
    expect(fromImnida('배우자')).toBe('예요');
  });

  test('본문 치환이 haeyo 를 쓴다 — 친근한 말투에서만', () => {
    setActiveToneStyle('friendly');
    try {
      expect(applyCasualTransform('확인하는 편이 낫습니다. 안내가 뜹니다.')).toBe('확인하는 편이 나아요. 안내가 떠요.');
    } finally { setActiveToneStyle('professional'); }
    expect(applyCasualTransform('확인하는 편이 낫습니다.')).toBe('확인하는 편이 낫습니다.');
    const g = read('src/core/final/generation.ts');
    expect(g).toContain("return require('./haeyo').toHaeyo(text);");
    expect(g).not.toContain('function politeToCasualEnding');
  });

  test('긴 제목 조각은 소제목들이 합쳐서 맡으면 지킨 것이다', () => {
    const title = '양육비 선지급 탈락 사유 소득기준 폐지 후에도 남는 신청 요건과 이의신청 기한';
    const heads = ['1. 소득기준 폐지 후 남는 신청 요건', '2. 이의신청 기한과 탈락 통지 대응', '3. 양육비 선지급제가 지급되는 흐름', '4. 탈락으로 보는 주요 확인 항목', '5. 한부모 지원금과 선지급제 구분'];
    expect(findUnkeptTitlePromises(title, heads, '')).toHaveLength(0);
    // 짧은 조각은 여전히 한 소제목이 맡아야 한다
    expect(findUnkeptTitlePromises('환경개선부담금 면제 대상 자동 적용 여부와 신청 방법', ['1. 부과 원리', '2. 납부 기한'], '')).toHaveLength(1);
  });

  test('수치 구절은 절차 반복이 아니다', () => {
    const sec = (n: number, extra: string) => `<h2>${n}. 절 ${n}</h2><p>${Array.from({ length: 12 }, (_, i) => `${n}절${i + 1}호 설명문장${n}${i + 1}이에요. `).join('')}${extra}</p>`;
    // 라이브 실측: 절마다 "최근 3개월", "3개월 평균" 이 다른 문장 속에 나왔다 — 같은 문장을 통째로 되풀이한 것이 아니다
    const facts = ['최근 3개월 입금을 봐요.', '3개월 평균으로 따져요.', '최근 3개월 평균이 기준이에요.', '3개월 평균 지급액을 적어요.', '최근 3개월 자료를 내요.'];
    const html = '<h1>양육비 선지급 탈락 사유</h1>' + [1, 2, 3, 4, 5].map((n) => sec(n, facts[n - 1]!)).join('');
    expect(findFlowGaps(html, toPlainText, { title: '양육비 선지급 탈락 사유' }).issues.find((i) => i.kind === 'procedure-repeat')).toBeUndefined();
    const html2 = '<h1>양육비 선지급 탈락 사유</h1>' + [1, 2, 3, 4, 5].map((n) => sec(n, '고지서와 등록원부 대조가 먼저예요. 차량번호와 부과 기간을 확인해요.')).join('');
    expect(findFlowGaps(html2, toPlainText, { title: '양육비 선지급 탈락 사유' }).issues.find((i) => i.kind === 'procedure-repeat')).toBeTruthy();
  });

  test('리포트의 법령 이름이 설계도에 "근거 법령" 으로 실린다', () => {
    const slot: any = { slot: '1', label: '', keyword: 'k', title: '', grade: '', longtails: [], mustCheck: [], track: '', empty: false,
      properNouns: ['양육비 선지급금 (제목에 있음)', '양육비 이행확보 및 지원에 관한 법률 2026년 10월 29일 시행 (easylaw.go.kr)', '양육비이행관리원 (childsupport.or.kr)'] };
    const d = buildReportDirective(slot, []);
    expect(d).toContain('**근거 법령**');
    expect(d).toContain('양육비 이행확보 및 지원에 관한 법률');
    expect(d).not.toContain('· 양육비이행관리원 (childsupport.or.kr)');
    expect(buildReportDirective({ ...slot, properNouns: [] }, [])).not.toContain('근거 법령');
  });
});
