const fs = require('fs');
const path = require('path');

import {
  buildTitlePromiseBlock,
  promiseToHeading,
  ensureTitlePromiseHeadings,
} from '../src/core/final/title-promise-headings';
import { findUnkeptTitlePromises } from '../src/core/final/reader-retention';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.655 — 제목이 약속한 것마다 그것을 맡는 소제목을 둔다.
 *
 * v3.8.654 는 잡기만 했다(100 → 88). 잡기만 하면 88점 딱지를 달고 같은 글이 나간다.
 * 첫 생성에서 지켜야 호출이 안 는다 — 프롬프트 한 겹 + 코드 보증 한 겹, 둘 다 호출 0회.
 */
describe('v3.8.655 제목 약속 → 소제목', () => {
  const 제목 = '환경개선부담금 면제 대상 자동 적용 여부와 신청 방법, 9월 30일 납부기한';
  const 키워드 = '환경개선부담금 면제';
  const 실제소제목 = [
    '환경개선부담금 면제 대상과 부과 기준', '차량 소유 변경 전후 확인 절차',
    '면제 사유에 해당하는 차량과 조건', '경유차 교체와 매각 뒤 달라지는 고지',
    '상품용 차량과 소액 부과금 확인법',
  ];

  describe('① 프롬프트 블록', () => {
    test('약속 조각을 번호 매겨 적어 준다', () => {
      const b = buildTitlePromiseBlock(제목);
      expect(b).toContain('1) 환경개선부담금 면제 대상 자동 적용 여부');
      expect(b).toContain('2) 신청 방법');
      expect(b).toContain('3) 9월 30일 납부기한');
      expect(b).toContain('소제목을 하나씩');
    });

    test('조각이 하나뿐이면 빈 문자열 — 제목 전체가 주제다', () => {
      expect(buildTitlePromiseBlock('환경개선부담금 면제 총정리')).toBe('');
      expect(buildTitlePromiseBlock('')).toBe('');
    });
  });

  describe('② 코드 보증', () => {
    test('못 맡은 약속마다 제목과 가장 동떨어진 소제목을 바꾼다 — 개수는 그대로', () => {
      const r = ensureTitlePromiseHeadings(제목, 실제소제목, 키워드);
      expect(r.h2Titles).toHaveLength(5);
      expect(r.replaced.length).toBeGreaterThanOrEqual(2);
      // 바꾼 뒤에는 검사가 통과해야 한다
      expect(findUnkeptTitlePromises(제목, r.h2Titles, '')).toHaveLength(0);
    });

    test('이미 다 맡았으면 손대지 않는다', () => {
      const 좋은소제목 = ['면제는 자동 적용인가 신청인가', '면제 신청 방법과 서식', '9월 30일 납부기한과 가산금', '면제 대상 차량'];
      const r = ensureTitlePromiseHeadings(제목, 좋은소제목, 키워드);
      expect(r.replaced).toHaveLength(0);
      expect(r.h2Titles).toEqual(좋은소제목);
    });

    test('FAQ·요약 소제목은 바꾸지 않는다', () => {
      const r = ensureTitlePromiseHeadings(제목, ['자주 묻는 질문 (FAQ)', '핵심 요약', '전혀 다른 이야기'], 키워드);
      for (const { from } of r.replaced) expect(from).toBe('전혀 다른 이야기');
    });

    test('한 조각이 방금 넣은 소제목을 다시 덮지 않는다', () => {
      const r = ensureTitlePromiseHeadings(제목, ['딴 이야기 하나', '딴 이야기 둘', '딴 이야기 셋'], 키워드);
      const tos = r.replaced.map((x) => x.to);
      expect(new Set(r.h2Titles).size).toBe(3);
      expect(tos.every((t) => r.h2Titles.includes(t))).toBe(true);
    });

    test('키워드가 조각에 없으면 앞에 붙인다', () => {
      expect(promiseToHeading('신청 방법', 키워드)).toBe('환경개선부담금 면제 신청 방법');
      expect(promiseToHeading('환경개선부담금 면제 대상 자동 적용 여부', 키워드)).toBe('환경개선부담금 면제 대상 자동 적용 여부');
    });
  });

  describe('③ 배선 — 두 경로 + 발행 전 자가 수정', () => {
    test('API 경로: 소제목 프롬프트에 블록이 들어가고, 확정 뒤 코드 보증이 돈다', () => {
      const g = read('src/core/final/generation.ts');
      expect(g).toContain('titlePromiseBlock');
      const o = read('src/core/final/orchestration.ts');
      expect(o).toContain('ensureTitlePromiseHeadings(');
      expect(o).toContain('buildTitlePromiseBlock(');
    });

    /**
     * v3.8.656 — 애드센스 모드는 플러그인 분기(generateSectionTitlesFromRoles)로 온다.
     * 655 는 두 LLM 분기에만 달아서 실측 3편 중 2편이 그대로였다. 세 분기 전부 확인한다.
     */
    test('애드센스(플러그인) 분기에도 블록과 코드 보증이 있다', () => {
      const g = read('src/core/final/generation.ts');
      const sig = g.slice(g.indexOf('export async function generateSectionTitlesFromRoles'));
      expect(sig.slice(0, 600)).toContain('titlePromiseBlock');
      const o = read('src/core/final/orchestration.ts');
      expect(o).toMatch(/generateSectionTitlesFromRoles\(keyword, roles, demandSignals, \w+\(String\(h1/);
      expect((o.match(/ensureTitlePromiseHeadings|ensureForRoles\(/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    test('에이전트 경로: 지시서에 같은 규칙이 있다', () => {
      const a = read('src/core/final/agent-harness.ts');
      expect(a).toContain('buildTitlePromiseBlock(');
      expect(a).toContain('맡는 소제목');
    });

    test('발행 전 자가 수정이 제목 약속 불이행을 고칠 대상으로 본다 — 제목을 넘겨서', () => {
      const p = read('src/core/final/pre-publish-fix.ts');
      expect(p).toContain("'title-promise-unkept',");
      expect(p).toContain("'title-promise-unkept': '");
      expect(p).toMatch(/auditArticle\(html,\s*\[\],\s*\{\s*title/);
    });
  });
});
