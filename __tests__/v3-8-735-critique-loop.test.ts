/**
 * v3.8.735 — 자동 비평·수정 루프 + 제목 사실 관문 + Hard Gate
 *
 * 사장님이 GPTs 에서 하는 "초안 → 비평 → 고치기 → 다시 비평 → 이제 됐다 → 발행" 을 버튼 한 번으로.
 * 실측 사고: 근거에 없는 "11월 2일"이 제목에 들어갔는데 감사 점수 100 — 이 파일이 그 재현 테스트를 품는다.
 * 특정 키워드 예외는 없다. 아래 픽스처의 낱말은 규칙을 보이기 위한 것일 뿐이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { extractClaims, checkClaims, stripClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { auditTitle, ensureGroundedTitle } from '../src/core/final/title-fact-gate';
import { runCritiqueLoop, runFinalJudge, sectionize, guardRevision, codeCritique, readJson, type ArticleSections } from '../src/core/final/critique-loop';
import { buildKeywordProvenance } from '../src/core/final/keyword-provenance';
import { recordPublishDecision, checkPublishDecision, clearPublishDecisions } from '../src/core/final/publish-gate';
import { snapshotModels, modelsSince } from '../src/core/final/model-use';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const orch = read('src/core/final/orchestration.ts');

const items = [
  { id: 'E01', title: '청년미래적금 2차 가입 신청 안내', cleanedText: '금융위원회는 10월 7일부터 16일까지 청년미래적금 2차 가입 신청을 받는다. 월 납입 한도는 50만원이다. 정부 기여금은 6% 또는 12%다.' },
  { id: 'E02', title: '1차 결과', cleanedText: '1차 최종 가입자는 138만5000명이다.' },
];
const ledger = ledgerFromItems(items.map((i) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })));

// ══════════════════════════════════════════════════════════
describe('① 값 주장 추출·대조 (fact-claims)', () => {
  it('날짜·기간·금액·비율·인원을 뽑고, 근거 표기 그대로 있는 것만 뒷받침으로 본다', () => {
    const kinds = extractClaims('10월 7~16일 신청, 월 50만원, 기여금 12%, 138만5000명, 11월 2일 개장').map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining(['range', 'amount', 'percent', 'count', 'date']));
    const r = checkClaims('10월 7~16일 신청, 월 50만원, 기여금 12%, 138만5000명, 11월 2일 개장', ledger);
    expect(r.unsupported).toEqual(['11월 2일']);
    expect(r.supported.find((s) => s.claim.startsWith('10월'))!.sourceIds).toEqual(['E01']);
    expect(r.supported.find((s) => /138만/.test(s.claim))!.sourceIds).toEqual(['E02']);
  });

  it('연도 하나는 낚시 값이 아니라 대조하지 않는다 · 쉼표 표기 차이는 같은 값이다', () => {
    expect(checkClaims('2026년 신청', ledger).unsupported).toEqual([]);
    expect(checkClaims('1,385,000명', ledgerFromItems([{ id: 'X', text: '1385000명 가입' }])).unsupported).toEqual([]);
  });

  it('값 걷어내기 — 제목 재생성이 안 될 때의 마지막 수단', () => {
    expect(stripClaims('경주 APEC 기간 숙소 예약 대릉원 인근 11월 2일 가능 여부', ['11월 2일'])).toBe('경주 APEC 기간 숙소 예약 대릉원 인근 가능 여부');
  });
});

// ══════════════════════════════════════════════════════════
describe('② Title Fact Gate — 근거에 없는 값이 든 제목으로는 본문을 쓰지 않는다', () => {
  it('⭐⭐ 재현: Research Packet 에 없는 "11월 2일"은 FAIL 이고, 다시 만들어도 남으면 걷어낸다', async () => {
    const bad = '경주 APEC 기간 숙소 예약 대릉원 인근 11월 2일 가능 여부';
    const travelLedger = ledgerFromItems([{ id: 'E01', text: '경주 APEC 정상회의는 10월 31일부터 11월 1일까지 열린다. 숙소 예약이 몰린다.' }]);
    expect(auditTitle(bad, travelLedger).status).toBe('FAIL');
    let calls = 0;
    const r = await ensureGroundedTitle(bad, travelLedger, async (directive) => { calls += 1; expect(directive).toContain('"11월 2일"'); return bad; }, { maxRetries: 2 });
    expect(calls).toBe(2);
    expect(r.stripped).toBe(true);
    expect(r.title).not.toContain('11월 2일');
    expect(r.audit.status).toBe('PASS');
  });

  it('근거에 있는 값은 그대로 통과하고 출처 id 를 단다', () => {
    const a = auditTitle('2026년 청년미래적금 2차 신청, 10월 7~16일 가구원 동의 먼저', ledger);
    expect(a.status).toBe('PASS');
    expect(a.supportedClaims[0]!.sourceIds).toEqual(['E01']);
  });

  it('재생성이 고치면 그 제목을 쓴다 (걷어내지 않는다)', async () => {
    const r = await ensureGroundedTitle('청년미래적금 2차 11월 2일 시작', ledger, async () => '청년미래적금 2차 10월 7일 시작', { maxRetries: 2 });
    expect(r.attempts).toBe(1);
    expect(r.stripped).toBe(false);
    expect(r.title).toBe('청년미래적금 2차 10월 7일 시작');
  });

  it('⭐ 순서: 검색 → 근거 → 관문 → 패킷 → 제목 → 제목 관문 → 소제목. 제목 생성이 패킷을 받는다', () => {
    const packetAt = orch.indexOf('let researchPacket: any = await packetMod.buildResearchPacket(');
    const titleAt = orch.indexOf('const firstTitle = await makeTitle(');
    const h2At = orch.indexOf('h2Titles = await generateH2TitlesFinal(');
    expect(packetAt).toBeGreaterThan(0);
    expect(packetAt).toBeLessThan(titleAt);
    expect(titleAt).toBeLessThan(h2At);
    expect(orch).toContain("titleGateResult = await ensureGroundedTitle(firstTitle, claimLedger(), makeTitle, { maxRetries: 2, onLog });");
    expect(orch).toContain('`${researchPacketText.slice(0, 5000)}${directive ?');
    const gen = read('src/core/final/generation.ts');
    expect(gen).toContain('researchBlock?: string');
    expect(gen).toContain('제목의 값 규칙');
  });
});

// ══════════════════════════════════════════════════════════
const article = (): ArticleSections => ({
  introduction: '<p>청년미래적금 2차 신청을 앞두고 가구원 동의부터 확인해야 합니다.</p>',
  sections: [
    { h2: '1. 신청 기간', h3Sections: [{ h3: '접수일', content: '<p>2차 가입 신청은 10월 7일부터 16일까지입니다. 출생연도 끝자리로 첫 이틀이 갈립니다.</p>' }] },
    { h2: '2. 납입과 기여금', h3Sections: [{ h3: '한도', content: '<p>월 납입 한도는 50만원이고 정부 기여금은 6% 또는 12%입니다. 3년 만기 자유적립식입니다.</p>' }] },
    { h2: '3. 1차 결과', h3Sections: [{ h3: '가입자', content: '<p>1차 최종 가입자는 138만5000명이었습니다. 이번에는 11월 2일까지 추가 접수를 받는다는 말이 있습니다.</p>' }] },
  ],
  conclusion: '<p>가구원 동의를 먼저 정리한 뒤 접수일에 신청하면 됩니다.</p>',
});
const packetText = '[RESEARCH PACKET]\n▸ 확인된 사실\n- 10월 7일부터 16일까지 2차 가입 신청 [E01]\n▸ 수치\n- 50만원 [E01]';
const evidenceText = items.map((i) => `[${i.id}][뉴스] ${i.title}\n${i.cleanedText}`).join('\n\n');
const PASS_CRITIC = JSON.stringify({ status: 'PASS', issues: [], unsupportedClaims: [], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
const PASS_JUDGE = JSON.stringify({ decision: 'PASS', blockingIssues: [], unsupportedClaims: [], searchIntentCovered: true, titlePromiseResolved: true, majorRedundancy: false, anotherRevisionWouldMateriallyImprove: false });

describe('③ Critic 1 — 코드가 먼저 잡는 것', () => {
  it('⭐ 근거에 없는 값(11월 2일)은 모델이 봐줘도 critical 이다 · 절 id 가 붙는다', () => {
    const units = sectionize(article());
    expect(units.map((u) => u.id)).toEqual(['S00', 'S01', 'S02', 'S03', 'S99']);
    const c = codeCritique(units, ledger);
    expect(c.issues.length).toBe(1);
    expect(c.issues[0]).toMatchObject({ sectionId: 'S03', severity: 'critical', type: 'unsupported_claim' });
    expect(c.unsupported).toEqual([{ sectionId: 'S03', claim: '11월 2일' }]);
  });

  it('절 사이 되풀이 문장은 major 로 잡힌다', () => {
    const a = article();
    a.sections[1]!.h3Sections[0]!.content += '<p>2차 가입 신청은 10월 7일부터 16일까지입니다. 출생연도 끝자리로 첫 이틀이 갈립니다.</p>';
    const c = codeCritique(sectionize(a), ledger);
    expect(c.issues.some((i) => i.type === 'redundancy' && i.sectionId === 'S02' && i.severity === 'major')).toBe(true);
  });

  it('JSON 읽기 — 코드펜스·꼬리 쉼표를 견딘다', () => {
    expect(readJson('```json\n{"a":1,}\n```')).toEqual({ a: 1 });
    expect(readJson('no json')).toBeNull();
  });
});

describe('④ 루프 — 문제 있는 절만 고치고, 없으면 고치지 않는다', () => {
  it('⭐⭐ 문제 없는 글은 수정 0회로 끝난다 (비평 횟수를 채우려고 고치지 않는다)', async () => {
    const a = article();
    a.sections[2]!.h3Sections[0]!.content = '<p>1차 최종 가입자는 138만5000명이었습니다.</p>';
    const calls: string[] = [];
    const r = await runCritiqueLoop({ title: '청년미래적금 2차 신청', mainKeyword: '청년미래적금 2차 신청', article: a, packetText, evidenceText, items, callModel: async (p) => { calls.push(p.slice(0, 40)); return PASS_CRITIC; } });
    expect(r.report.revisionCycles).toBe(0);
    expect(r.report.criticCycles).toBe(2);          // Critic 1 + Critic 2
    expect(r.report.converged).toBe(true);
    expect(r.report.unchangedSections).toBe(5);
    expect(JSON.stringify(r.article)).toBe(JSON.stringify(a));
  });

  it('⭐⭐ 근거 없는 값이 든 절만 고쳐지고 나머지는 그대로다 · 고친 뒤 재비평이 통과하면 끝', async () => {
    const seen: string[] = [];
    const callModel = async (p: string) => {
      if (p.startsWith('당신은 교정자입니다')) {
        seen.push('editor');
        expect(p).toContain('[S03]');
        expect(p).not.toContain('[S01] ## 1. 신청 기간');   // 다른 절은 보이지 않는다
        return JSON.stringify({ sectionId: 'S03', h3Sections: [{ index: 0, content: '<p>1차 최종 가입자는 138만5000명이었습니다. 2차 접수 일정은 공식 안내를 따릅니다.</p>' }], resolvedIssueIds: ['C01'] });
      }
      seen.push(p.startsWith('당신은 검수자') ? 'critic1' : p.startsWith('당신은 편집자') ? 'critic2' : 'other');
      return PASS_CRITIC;
    };
    const r = await runCritiqueLoop({ title: '청년미래적금 2차 신청', mainKeyword: '청년미래적금 2차 신청', article: article(), packetText, evidenceText, items, callModel });
    expect(seen).toEqual(['critic1', 'editor', 'critic1', 'critic2']);
    expect(r.report.revisionCycles).toBe(1);
    expect(r.report.revisions[0]!.revised).toEqual(['S03']);
    expect(r.report.revisions[0]!.skipped).toEqual(['S00', 'S01', 'S02', 'S99']);
    expect(r.report.revisedSections).toBe(1);
    expect(r.report.unchangedSections).toBe(4);
    expect(r.report.converged).toBe(true);
    expect(r.article.sections[0]!.h3Sections[0]!.content).toBe(article().sections[0]!.h3Sections[0]!.content);
    expect(r.article.sections[2]!.h3Sections[0]!.content).not.toContain('11월 2일');
  });

  it('⭐⭐ 3회 고쳐도 critical 이 남으면 MANUAL_REVIEW 사유를 남기고 멈춘다 (무한 반복 금지)', async () => {
    let editorCalls = 0;
    const callModel = async (p: string) => {
      if (p.startsWith('당신은 교정자입니다')) { editorCalls += 1; return JSON.stringify({ sectionId: 'S03', h3Sections: [{ index: 0, content: '<p>1차 최종 가입자는 138만5000명이었습니다. 11월 2일까지 추가 접수를 받습니다.</p>' }], resolvedIssueIds: [] }); }
      return PASS_CRITIC;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: article(), packetText, evidenceText, items, callModel, maxRevisions: 3 });
    // 같은 지적이 그대로 돌아오면(1 → 1 → 1) 3회를 채우지 않고 멈춘다 — 돈만 드는 반복을 끊는다
    expect(r.report.revisionCycles).toBe(2);
    expect(editorCalls).toBe(2);
    expect(r.report.converged).toBe(false);
    expect(r.report.manualReviewReason).toContain('지적이 줄지 않음');
    expect(r.report.remaining.critical).toBe(1);
  });

  it('⭐ 지적이 줄어들고는 있으면 상한 3회까지 고친 뒤 MANUAL_REVIEW', async () => {
    let cycle = 0;
    const callModel = async (p: string) => {
      if (p.startsWith('당신은 교정자입니다')) return JSON.stringify({ sectionId: 'S03', h3Sections: [{ index: 0, content: '<p>1차 최종 가입자는 138만5000명이었습니다. 11월 2일까지 추가 접수를 받습니다.</p>' }], resolvedIssueIds: [] });
      if (p.startsWith('당신은 검수자')) {
        cycle += 1;   // 모델 지적은 회차마다 줄어든다(3 → 2 → 1 → 0). 코드가 잡는 11월 2일은 그대로 남는다
        const n = Math.max(0, 3 - (cycle - 1));
        return JSON.stringify({ status: n ? 'REVISION_REQUIRED' : 'PASS', issues: Array.from({ length: n }, (_, i) => ({ id: `M0${i}`, sectionId: 'S01', severity: 'major', type: 'intent_gap', problem: `의도 누락 ${i} 번째 항목 설명`, evidenceIds: [], requiredChange: '…' })), unsupportedClaims: [], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
      }
      return PASS_CRITIC;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: article(), packetText, evidenceText, items, callModel, maxRevisions: 3 });
    expect(r.report.revisionCycles).toBe(3);
    expect(r.report.manualReviewReason).toContain('수정 3회 뒤에도');
    expect(r.report.critic1.length).toBe(4);       // 초안 비평 1 + 수정 뒤 재비평 3
  });

  it('과수정 방지 — 고친 절에 **새로** 근거 없는 값이 생기면 그 수정은 버리고 원문을 지킨다', async () => {
    const callModel = async (p: string) => {
      if (p.startsWith('당신은 교정자입니다')) return JSON.stringify({ sectionId: 'S03', h3Sections: [{ index: 0, content: '<p>1차 최종 가입자는 138만5000명이었습니다. 2차는 12월 25일에 결과가 나옵니다.</p>' }], resolvedIssueIds: [] });
      return PASS_CRITIC;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: article(), packetText, evidenceText, items, callModel, maxRevisions: 2 });
    expect(r.report.revisions.every((v) => v.rejected.some((x) => x.sectionId === 'S03' && /새로 근거 없는 값/.test(x.reason)))).toBe(true);
    expect(r.article.sections[2]!.h3Sections[0]!.content).toBe(article().sections[2]!.h3Sections[0]!.content);
    expect(r.report.converged).toBe(false);
  });

  it('⭐ 근거 없는 "넣어라" 지적은 버린다 · 없는 절 id·근거 id 도 버린다', async () => {
    let n = 0;
    const callModel = async (p: string) => {
      if (p.startsWith('당신은 검수자') && n++ === 0) return JSON.stringify({ status: 'REVISION_REQUIRED', issues: [
        { id: 'M01', sectionId: 'S01', severity: 'major', type: 'missing_information', problem: '기여금 인상 소식이 빠졌다', evidenceIds: ['E99'], requiredChange: '넣어라' },
        { id: 'M02', sectionId: 'S77', severity: 'critical', type: 'other', problem: '없는 절', evidenceIds: [], requiredChange: '…' },
      ], unsupportedClaims: [], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
      return PASS_CRITIC;
    };
    const a = article(); a.sections[2]!.h3Sections[0]!.content = '<p>1차 최종 가입자는 138만5000명이었습니다.</p>';
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: a, packetText, evidenceText, items, callModel });
    expect(r.report.revisionCycles).toBe(0);
    expect(r.report.critic1[0]!.majorIssues.length + r.report.critic1[0]!.criticalIssues.length).toBe(0);
  });

  it('NEEDS_MORE_RESEARCH 면 상상하지 않고 검색으로 되돌아간다 (한 번만)', async () => {
    let n = 0; let researched: string[] = [];
    const callModel = async (p: string) => {
      if (p.startsWith('당신은 검수자') && n++ === 0) return JSON.stringify({ status: 'NEEDS_MORE_RESEARCH', issues: [], unsupportedClaims: [], missingIntentAnswers: ['가구원 동의 절차'], titleIssues: [], researchQueries: ['청년미래적금 가구원 동의'] });
      return PASS_CRITIC;
    };
    const a = article(); a.sections[2]!.h3Sections[0]!.content = '<p>1차 최종 가입자는 138만5000명이었습니다.</p>';
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: a, packetText, evidenceText, items, callModel, moreResearch: async (q) => { researched = q; return { packetText, evidenceText, items }; } });
    expect(researched).toEqual(['청년미래적금 가구원 동의']);
    expect(r.report.researchRounds).toBe(1);
    expect(r.report.converged).toBe(true);
  });

  it('과수정 방지 — 새 근거 없는 값·정보량 급감·근거 있는 값 삭제·다른 절과 같은 문장은 채택하지 않는다', () => {
    const units = sectionize(article());
    const s2 = units[2]!;
    expect(guardRevision(s2.text, '<p>월 납입 한도는 70만원입니다. 정부 기여금은 6% 또는 12%입니다. 3년 만기 자유적립식입니다.</p>', ledger, units.filter((u) => u.id !== 'S02'))).toContain('새로 근거 없는 값');
    expect(guardRevision(s2.text, '<p>한도가 있습니다. 기여금도 있습니다. 만기도 있습니다. 확인하세요. 확인하세요.</p>', ledger, units.filter((u) => u.id !== 'S02'))).toContain('근거 있는 값이 사라졌다');
    expect(guardRevision(s2.text, '<p>2차 가입 신청은 10월 7일부터 16일까지입니다. 출생연도 끝자리로 첫 이틀이 갈립니다. 월 납입 한도는 50만원이고 정부 기여금은 6% 또는 12%입니다.</p>', ledger, units.filter((u) => u.id !== 'S02'))).toContain('다른 절과 같은 문장');
    expect(guardRevision(s2.text, '<p>월 납입 한도는 50만원이고 정부 기여금은 6% 또는 12%입니다. 3년 만기 자유적립식이라 중도에 금액을 조절할 수 있습니다.</p>', ledger, units.filter((u) => u.id !== 'S02'))).toBeNull();
  });
});

describe('⑤ Final Judge — 발행을 막아야 할 문제만', () => {
  it('⭐ FAQ 에 근거 없는 값이 있으면 모델이 PASS 라 해도 FAIL', async () => {
    const a = article(); a.sections[2]!.h3Sections[0]!.content = '<p>1차 최종 가입자는 138만5000명이었습니다.</p>';
    const j = await runFinalJudge({ title: 't', mainKeyword: 'k', article: a, packetText, evidenceText, items, faqText: 'Q. 언제까지? A. 11월 2일까지 받습니다.', callModel: async () => PASS_JUDGE });
    expect(j.decision).toBe('FAIL');
    expect(j.unsupportedClaims).toContain('FAQ: 11월 2일');
  });

  it('깨끗하면 PASS · 심사 프롬프트는 "막아야 할 문제만" 을 묻는다', async () => {
    const a = article(); a.sections[2]!.h3Sections[0]!.content = '<p>1차 최종 가입자는 138만5000명이었습니다.</p>';
    let prompt = '';
    const j = await runFinalJudge({ title: 't', mainKeyword: 'k', article: a, packetText, evidenceText, items, callModel: async (p) => { prompt = p; return PASS_JUDGE; } });
    expect(j.decision).toBe('PASS');
    expect(prompt).toContain('발행을 막아야 할 문제만');
    expect(prompt).not.toContain('개선할 수 있는 점을 자유롭게');
    expect(prompt.length).toBeLessThan(20000);   // Writer 규칙 3만 자를 다시 붙이지 않는다
  });
});

describe('⑥ Hard Gate · 발행 결정 · 장부', () => {
  it('⭐⭐ 관문이 하나라도 FAIL 이면 100점이 될 수 없다 (auditScore 상한 89, 원점수는 따로)', () => {
    expect(orch).toContain('const gatedScore = hardGatesAllPass ? audited.score : Math.min(audited.score, 89);');
    expect(orch).toContain('auditScore: gatedScore,');
    expect(orch).toContain('auditScoreRaw: audited.score,');
    for (const g of ['TITLE_FACT_PASS', 'EVIDENCE_GATE_PASS', 'RESEARCH_PACKET_PASS', 'BODY_FACT_PASS', 'SEARCH_INTENT_PASS', 'NO_MAJOR_REDUNDANCY', 'FINAL_JUDGE_PASS']) expect(orch).toContain(`${g}:`);
  });

  it('⭐ 자동 발행 조건은 점수가 아니라 QUALITY_CONVERGED 다', () => {
    expect(orch).toContain("const publishDecision: 'AUTO_PUBLISH' | 'MANUAL_REVIEW' = qualityConverged ? 'AUTO_PUBLISH' : 'MANUAL_REVIEW';");
    expect(orch).toContain("critiqueReport.converged === true && !!finalJudge && finalJudge.anotherRevisionWouldMateriallyImprove !== true");
    expect(orch).toContain("recordPublishDecision(html, publishDecision, manualReviewReason");
  });

  it('⭐⭐ 발행 창구가 MANUAL_REVIEW 본문을 그대로는 발행하지 않는다 · 사람이 고친 본문은 막지 않는다', () => {
    clearPublishDecisions();
    const html = '<p>이 글은 검토가 필요합니다</p>';
    recordPublishDecision(html, 'MANUAL_REVIEW', 'TITLE_FACT_PASS');
    expect(checkPublishDecision(html)!.decision).toBe('MANUAL_REVIEW');
    expect(checkPublishDecision(html + '<p>사람이 한 줄 고쳤다</p>')).toBeNull();
    const idx = read('src/core/index.ts');
    const gate = idx.slice(idx.indexOf('export async function publishGeneratedContent('), idx.indexOf('export async function publishGeneratedContent(') + 2500);
    expect(gate).toContain("hold.decision === 'MANUAL_REVIEW' && payload?.forcePublish !== true");
    expect(gate).toContain("blockedReason: 'MANUAL_REVIEW'");
  });

  it('장부에 단계별 모델·주기·결정이 남는다', () => {
    const ledgerSrc = read('src/core/final/publish-ledger.ts');
    for (const f of ['draftModel', 'critic1Model', 'revisionModels', 'critic2Model', 'finalJudgeModel', 'criticCycles', 'revisionCycles', 'finalDecision', 'qualityConverged', 'manualReviewReason', 'hardGates']) expect(ledgerSrc).toContain(`${f}?:`);
    const g: any = globalThis as any;
    g.__llmActualModels = { 'openai/gpt-5.6-terra': 3 };
    const snap = snapshotModels();
    g.__llmActualModels = { 'openai/gpt-5.6-terra': 5, 'openai/gpt-5.6-luna': 1 };
    expect(modelsSince(snap)).toBe('openai/gpt-5.6-terra×2, openai/gpt-5.6-luna');
  });

  it('FAQ·요약표의 값도 근거와 대조해 근거 없는 것은 뺀다 · 제목 문제는 본문 편집기가 아니라 제목 재생성으로', () => {
    expect(orch).toContain('faqs = faqs.filter((f: any) => {');
    expect(orch).toContain("finalQaNotes.push(`요약표 행 제외:");
    expect(orch).toContain('if (loop.report.titleIssues.length > 0 && titleGateResult) {');
    expect(orch).toContain('ensureGroundedTitle(await makeTitleRef(directive), claimLedger(), makeTitleRef');
  });
});

describe('⑦ 키워드 출처 — 실제 검색어가 아닌 것을 연관검색어라 부르지 않는다', () => {
  it('본문에 없는 모델 태그는 버리고, 핵심어가 든 실제 자동완성만 더한다', () => {
    const p = buildKeywordProvenance({
      mainKeyword: '청년미래적금 2차 신청', title: '청년미래적금 2차 신청 가구원 동의',
      bodyText: '청년미래적금 2차 신청은 10월 7일부터입니다. 가구원 동의가 필요합니다.',
      generatedTags: ['청년미래적금', '가구원동의', '청년도약계좌', '재테크꿀팁', '#적금추천'],
      actualSuggestions: ['청년미래적금 2차 신청기간', '청년희망적금 2차 모집', '연말정산 환급'],
    });
    expect(p.articleKeyword).toEqual(['청년미래적금', '가구원동의']);
    expect(p.semanticKeyword).toEqual(expect.arrayContaining(['청년도약계좌', '재테크꿀팁', '적금추천']));
    expect(p.actualSearchKeyword).toEqual(['청년미래적금 2차 신청기간']);
    expect(p.hashtag).toEqual(['청년미래적금', '가구원동의', '청년미래적금 2차 신청기간']);
    expect(p.hashtag).not.toContain('연말정산 환급');   // 다른 글의 연관어가 섞이지 않는다
  });

  it('orchestration 이 태그를 출처로 거른 뒤 라벨로 내보낸다', () => {
    expect(orch).toContain("const hashtagsRaw = await generateHashtagsFinal(keyword, h2Titles);");
    expect(orch).toContain('buildKeywordProvenance({');
    expect(orch).toContain('if (keywordProvenance.hashtag.length >= 3) hashtags = keywordProvenance.hashtag.join(', ');');
  });
});
