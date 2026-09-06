const fs = require('fs');
const path = require('path');

import { buildThread, buildThreadBlock, attachTakeaways, threadViolations, THREAD_JSON_FIELDS } from '../src/core/final/thread';
import { buildAgentHarnessRules } from '../src/core/final/agent-harness';
import { inspectBeforePublish } from '../src/core/final/pre-publish-fix';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.672 — 실 설계 2차(P2 + P3 + P6). 코드가 글 쓰기 전에 독자의 문제와 절마다 답할 의문을 정해 넘기고,
 * JSON 에 answersTo·takeaway 칸을 요구하며, 에이전트 경로에도 같은 블록을 싣는다. 호출 0.
 */
const SLOT = {
  slot: '1', label: '', grade: '통과', track: '', empty: false,
  keyword: '양육비 선지급 탈락 사유',
  title: '양육비 선지급 탈락 사유 소득기준 폐지 후에도 남는 신청 요건과 이의신청 기한',
  longtails: ['양육비 선지급 소급 지급 안 되는 기간 - 신청한 달 이전 미지급분 처리', '양육비 선지급 만 18세 이하 자녀 기준', '기초생활수급자 양육비 선지급금 소득 산입 여부'],
  mustCheck: [],
  clickReasons: ['소득기준이 없어져도 탈락하는 나머지 요건 - 집행권원 없으면 신청 자체가 불가', '소급이 안 되는 구간 - 신청한 달 이전 미지급분', '만 18세 판정 기준', '탈락·감액 통지 후 절차 - 이의신청과 서류 보강', '기초생활수급자의 소득 산입 문제'],
  readerReasons: ['대상에서 빠지는 경우 - 집행권원 부재, 미지급 기간 미충족', '신청 방법이 갈리는 지점 - 온라인 신청과 지자체 접수', '기한·소급 제약 - 신청한 달 이전 미지급분 소급 불가', '거절·반려됐을 때의 다음 절차 - 이의신청과 서류 보강'],
  realQuestions: ['"양육비 선지급, 이제 모든 가정에서 신청 가능할까요?" - "무참히 탈락당했습니다."'],
};
const H2S = ['1. 소득기준이 사라져도 남는 요건', '2. 소급이 안 되는 기간', '3. 만 18세 판정', '4. 탈락 통지 뒤 이의신청', '5. 수급자의 소득 산입', '자주 묻는 질문 (FAQ)'];

describe('v3.8.672 실(thread) — 독자의 문제를 코드가 정하고 끝까지 붙잡게 한다', () => {
  test('P2 질문의 우선순위 — 리포트 클릭 이유 → 실물 QnA → 지식iN → 제목 약속 → 키워드', () => {
    const t = buildThread({ title: SLOT.title, keyword: SLOT.keyword, slot: SLOT, h2Titles: H2S });
    expect(t.source).toBe('report-click');
    expect(t.question).toBe('소득기준이 없어져도 탈락하는 나머지 요건');   // " - 설명" 꼬리는 뗀다
    const noClick = buildThread({ title: SLOT.title, keyword: SLOT.keyword, slot: { ...SLOT, clickReasons: [] } });
    expect(noClick.source).toBe('report-kin');
    expect(noClick.question).toContain('신청 가능할까요?');
    const kin = buildThread({ title: SLOT.title, keyword: SLOT.keyword, slot: { ...SLOT, clickReasons: [], realQuestions: [] }, userQuestions: ['Q. 소득기준 없어졌는데 왜 탈락하나요'] });
    expect(kin.source).toBe('kin');
    expect(kin.question).toBe('소득기준 없어졌는데 왜 탈락하나요');
    const titleOnly = buildThread({ title: '환경개선부담금 면제 대상 자동 적용 여부와 신청 방법, 9월 30일 납부기한', keyword: '환경개선부담금' });
    expect(titleOnly.source).toBe('title');
    expect(titleOnly.question).toContain('자동 적용 여부');
    expect(buildThread({ title: '', keyword: '환경개선부담금' }).source).toBe('keyword');
  });

  test('P2 절마다 답할 의문 — 보러 올 이유가 먼저, 같은 뜻은 한 번만, FAQ 절은 비운다', () => {
    const t = buildThread({ title: SLOT.title, keyword: SLOT.keyword, slot: SLOT, h2Titles: H2S });
    expect(t.asks).toHaveLength(6);
    expect(t.asks[0]).toContain('대상에서 빠지는 경우');
    expect(t.asks[3]).toContain('거절·반려됐을 때의 다음 절차');
    expect(t.asks[4]).toContain('소득기준이 없어져도 탈락하는');   // 보러 올 이유 4개 다음은 클릭 이유
    expect(t.asks[5]).toBe('');                                     // FAQ
    expect(t.materials).toBeGreaterThanOrEqual(8);
    // "탈락·감액 통지 후 절차"(클릭 4번) 는 "거절·반려됐을 때의 다음 절차" 와 다른 낱말이라 남지만, 롱테일 "소급 지급 안 되는 기간" 은 앞 10자가 달라 남는다 — 같은 앞머리만 거른다
    const block = buildThreadBlock(t, { title: SLOT.title, h2Titles: H2S });
    expect(block).toContain('📌 [이 글의 제목]');
    expect(block).toContain('· 독자의 문제: 「소득기준이 없어져도 탈락하는 나머지 요건」 (출처: 리포트 클릭 이유)');
    expect(block).toContain('1. 「1. 소득기준이 사라져도 남는 요건」 ← 대상에서 빠지는 경우');
    expect(block).not.toContain('「자주 묻는 질문 (FAQ)」');
    expect(block).toContain('"answersTo"');
    expect(block).toContain('필자의 반응');
    expect(block).toContain('제목의 공감을 본문이 끝까지 이어받습니다');
    // 에이전트용(소제목 없음) — 의문 목록만
    const agentBlock = buildThreadBlock(buildThread({ title: SLOT.title, keyword: SLOT.keyword, slot: SLOT }), { title: SLOT.title });
    expect(agentBlock).toContain('절마다 아래 의문 가운데 하나에 답합니다');
    expect(agentBlock).not.toContain('"answersTo"');
  });

  test('P3 takeaway 를 절 끝 <p> 로 붙인다 — 이미 있으면 안 붙이고, 태그는 걷어낸다', () => {
    const sections = [
      { h2: '1', takeaway: '<strong>집행권원이 없다면</strong> 선지급 신청보다 판결이나 조정부터 받으세요. 신청 자격이 거기서 갈리기 때문이에요', h3Sections: [{ h3: 'a', content: '<p>본문</p>' }, { h3: 'b', content: '<p>둘째</p>' }] },
      { h2: '2', takeaway: '이미 있는 문장이에요.', h3Sections: [{ h3: 'a', content: '<p>이미 있는 문장이에요.</p>' }] },
      { h2: '3', takeaway: '', h3Sections: [{ h3: 'a', content: '<p>없음</p>' }] },
      { h2: '4', takeaway: '짧다', h3Sections: [{ h3: 'a', content: '<p>x</p>' }] },
    ];
    const r = attachTakeaways(sections, (t) => t.replace(/받으세요/, '받아 보세요'));
    expect(r.attached).toBe(1);
    expect(r.sections[0]!.h3Sections[1]!.content).toBe('<p>둘째</p><p>집행권원이 없다면 선지급 신청보다 판결이나 조정부터 받아 보세요. 신청 자격이 거기서 갈리기 때문이에요.</p>');
    expect(r.sections[0]!.h3Sections[0]!.content).toBe('<p>본문</p>');
    expect(r.sections[1]!.h3Sections[0]!.content).toBe('<p>이미 있는 문장이에요.</p>');
    expect(sections[0]!.h3Sections[1]!.content).toBe('<p>둘째</p>');   // 원본은 안 바꾼다
  });

  test('P3 실 위반을 코드가 센다 — 서론 질문 · takeaway 없음/목록형 · 결론 낱말', () => {
    const t = buildThread({ title: SLOT.title, keyword: SLOT.keyword, slot: SLOT, h2Titles: H2S });
    const bad = {
      introduction: '<p>양육비 선지급이 넓어졌어요.</p><p>먼저 요건을 확인하는 것이 출발점이에요.</p>',
      conclusion: '<p>순서대로 정리하면 혼선을 줄일 수 있어요.</p>',
      sections: [
        { h2: H2S[0], answersTo: '', takeaway: '', h3Sections: [{ content: '' }] },
        { h2: H2S[1], answersTo: 'x', takeaway: '신청 전에 서류를 점검하세요.', h3Sections: [{ content: '' }] },
        { h2: H2S[5], answersTo: '', takeaway: '', h3Sections: [{ content: '' }] },
      ],
    };
    const v = threadViolations(bad, t);
    expect(v).toContain('서론이 질문으로 끝나지 않음');
    expect(v).toContain('1절 takeaway 없음');
    expect(v.some((x) => x.startsWith('2절 takeaway 가 점검 목록형'))).toBe(true);
    expect(v).toContain('결론에 도입의 문제 낱말이 없음');
    expect(v.some((x) => x.startsWith('3절'))).toBe(false);   // FAQ 절은 안 센다
    const good = {
      introduction: '<p>양육비 선지급이 넓어졌어요.</p><p>그럼 소득기준이 사라져도 왜 탈락할까요?</p>',
      conclusion: '<p>소득기준이 없어져도 집행권원이 없다면 탈락해요. 있다면 신청하세요.</p>',
      sections: [
        { h2: H2S[0], answersTo: t.asks[0], takeaway: '집행권원이 없다면 판결부터 받으세요. 자격이 거기서 갈리기 때문이에요.', h3Sections: [{ content: '' }] },
        { h2: H2S[5], h3Sections: [{ content: '' }] },
      ],
    };
    expect(threadViolations(good, t)).toEqual([]);
  });

  test('배선 — 본문 JSON 예시에 두 칸, orchestration 이 실을 만들고 위반을 세며, 자가 수정·장부가 질문을 받는다, 에이전트도 같은 블록', () => {
    const g = read('src/core/final/generation.ts');
    expect(g).toContain('${THREAD_JSON_FIELDS}');
    expect(THREAD_JSON_FIELDS).toContain('"answersTo"');
    expect(g).toContain("attachTakeaways(normalized.sections, (t) => applyCasualTransform(t))");
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain('buildThreadBlock(articleThread, { title: String(h1 || \'\'), h2Titles })');
    expect(o).toContain("threadViolations(allSectionsObj, articleThread)");
    expect(o).toContain('question: articleThread?.question },');
    expect(o).toContain("auditArticle(html, [], { title: String(h1 || keyword || ''), question: articleThread?.question })");
    // 실 블록은 660 의 📌 블록을 대신한다 — 두 벌이 아니다 (실패 폴백 한 곳만)
    expect(o.split('📌 [이 글의 제목]').length - 1).toBe(1);
    const p = read('src/core/final/pre-publish-fix.ts');
    expect(p).toContain('question: input.question }).issues');
    const rules = buildAgentHarnessRules({ keyword: SLOT.keyword, currentYear: 2026, reportSlot: SLOT, reportUrls: [] } as any);
    expect(rules).toContain('🧵 [이 글의 실');
    expect(rules).toContain('「소득기준이 없어져도 탈락하는 나머지 요건」');
    expect(rules.indexOf('이 글이 답할 독자의 의문')).toBeLessThan(rules.indexOf('🧵 [이 글의 실'));
  });

  test('자가 검수가 실의 질문으로 결론을 본다 (알리기만)', () => {
    const html = '<h1>t</h1><p>서론이에요. 그럼 언제 탈락할까요?</p>'
      + '<h2>1. 요건</h2><p>' + '이 절의 설명 문장이에요. '.repeat(40) + '집행권원이 없다면 탈락이에요.</p>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>';
    const withQ = inspectBeforePublish({ title: '양육비 선지급 탈락', html, question: '소득기준이 없어져도 탈락하는 나머지 요건' });
    const kinds = [...withQ.fixable, ...withQ.advisory].map((f) => f.kind);
    expect(kinds).not.toContain('conclusion-not-answering');   // 결론 문장에 "탈락" + "이에요" 판단이 있다
    expect(withQ.fixable.map((f) => f.kind)).not.toContain('intro-question-missing');   // 알리기만 — 고치는 대상이 아니다
  });
});
