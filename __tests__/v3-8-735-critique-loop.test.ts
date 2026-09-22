/**
 * v3.8.735 → v3.8.736 — 비평·수정 루프 v2 + 제목 사실 관문 + Hard Gate + 발행 차단
 *
 * live 실측(735)이 수렴하지 못한 원인들을 fixture 로 박는다(유료 호출 0):
 *   · 근거 없는 "4770대" ×5 → 코드 관문이 전부 잡고, 그 절만 고쳐 0으로 (정상 숫자는 안 지운다)
 *   · "IBK 0.5%p 근거 없음 → 지워라" 교착 — REMOVE 가 허용된 지적에서 값이 사라진 것은 정상 수정
 *   · 일반 설명("여력이 빠듯하면 고정형")을 근거 없다고 CRITICAL 로 올리지 못한다
 *   · 지문(issueKey)으로 같은 문제를 다른 문장으로 적어도 새 문제가 되지 않는다
 *   · 편집은 한 번의 호출, 문제 없는 절은 바이트 그대로
 *   · Judge 는 "더 좋아질 수 있다"로 BLOCK 하지 못한다
 */
import * as fs from 'fs';
import * as path from 'path';
import { extractClaims, checkClaims, stripClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { auditTitle, ensureGroundedTitle } from '../src/core/final/title-fact-gate';
import { runCritiqueLoop, runFinalJudge, sectionize, guardRevision, codeGate, readJson, issueKeyOf, stripHtml, type ArticleSections, type Issue } from '../src/core/final/critique-loop';
import { buildKeywordProvenance } from '../src/core/final/keyword-provenance';
import { recordPublishDecision, checkPublishDecision, clearPublishDecisions } from '../src/core/final/publish-gate';
import { snapshotModels, modelsSince } from '../src/core/final/model-use';

process.env['NO_LIVE_LLM'] = '1';   // 이 파일의 어떤 경로도 유료 호출에 닿지 않는다

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const orch = read('src/core/final/orchestration.ts');

const items = [
  { id: 'E01', title: '청년미래적금 2차 가입 신청 안내', cleanedText: '금융위원회는 10월 7일부터 16일까지 청년미래적금 2차 가입 신청을 받는다. 월 납입 한도는 50만원이다. 정부 기여금은 6% 또는 12%다.' },
  { id: 'E02', title: '1차 결과', cleanedText: '1차 최종 가입자는 138만5000명이다.' },
];
const ledger = ledgerFromItems(items.map((i) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })));
const packetText = '[RESEARCH PACKET]\n▸ 확인된 사실\n- 10월 7일부터 16일까지 2차 가입 신청 [E01]\n▸ 수치\n- 50만원 [E01]';
const evidenceText = items.map((i) => `[${i.id}][뉴스] ${i.title}\n${i.cleanedText}`).join('\n\n');
const PASS = JSON.stringify({ status: 'PASS', issues: [], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
const PASS_JUDGE = JSON.stringify({ decision: 'PASS', blockingIssues: [], advisory: [] });
const isEditor = (p: string) => p.startsWith('당신은 교정자입니다');
const isVerify = (p: string) => p.includes('OPEN 지적 각각이 해결됐는가');
const isEditorial = (p: string) => p.startsWith('당신은 편집자입니다');
const isCritic1 = (p: string) => p.startsWith('당신은 검수자입니다. 칭찬하지 않고');

const article = (): ArticleSections => ({
  introduction: '<p>청년미래적금 2차 신청을 앞두고 가구원 동의부터 확인해야 합니다.</p>',
  sections: [
    { h2: '1. 신청 기간', h3Sections: [{ h3: '접수일', content: '<p>2차 가입 신청은 10월 7일부터 16일까지입니다. 출생연도 끝자리로 첫 이틀이 갈립니다.</p>' }] },
    { h2: '2. 납입과 기여금', h3Sections: [{ h3: '한도', content: '<p>월 납입 한도는 50만원이고 정부 기여금은 6% 또는 12%입니다. 3년 만기 자유적립식입니다.</p>' }] },
    { h2: '3. 1차 결과', h3Sections: [{ h3: '가입자', content: '<p>1차 최종 가입자는 138만5000명이었습니다. 이번에는 11월 2일까지 추가 접수를 받는다는 말이 있습니다.</p>' }] },
  ],
  conclusion: '<p>가구원 동의를 먼저 정리한 뒤 접수일에 신청하면 됩니다.</p>',
});

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
  it('연도 하나는 대조하지 않는다 · 쉼표 표기 차이는 같은 값', () => {
    expect(checkClaims('2026년 신청', ledger).unsupported).toEqual([]);
    expect(checkClaims('1,385,000명', ledgerFromItems([{ id: 'X', text: '1385000명 가입' }])).unsupported).toEqual([]);
  });
  it('값 걷어내기', () => {
    expect(stripClaims('경주 APEC 기간 숙소 예약 대릉원 인근 11월 2일 가능 여부', ['11월 2일'])).toBe('경주 APEC 기간 숙소 예약 대릉원 인근 가능 여부');
  });
  it('⭐ live 736-1 재현: 근거는 "200%", 답변 상자는 "200퍼센트" — 같은 값이다 (표기만 다른 비율을 근거 없다고 막았다)', () => {
    const led = ledgerFromItems([{ id: 'E01', text: '가구 중위소득 200% 이하 요건' }]);
    expect(checkClaims('가구 중위소득 200퍼센트 이하', led).unsupported).toEqual([]);
    expect(checkClaims('가구 중위소득 200％ 이하', led).unsupported).toEqual([]);
    expect(checkClaims('가구 중위소득 250퍼센트 이하', led).unsupported).toEqual(['250퍼센트']);
    // 반대 방향(근거가 퍼센트 표기)도 같은 값
    expect(checkClaims('중위소득 200% 이하', ledgerFromItems([{ id: 'E02', text: '중위소득 200퍼센트 이하' }])).unsupported).toEqual([]);
  });
});

describe('② Title Fact Gate', () => {
  it('⭐⭐ 재현: 패킷에 없는 "11월 2일"은 FAIL → 재생성 → 그래도 남으면 걷어냄', async () => {
    const bad = '경주 APEC 기간 숙소 예약 대릉원 인근 11월 2일 가능 여부';
    const travelLedger = ledgerFromItems([{ id: 'E01', text: '경주 APEC 정상회의는 10월 31일부터 11월 1일까지 열린다.' }]);
    expect(auditTitle(bad, travelLedger).status).toBe('FAIL');
    let calls = 0;
    const r = await ensureGroundedTitle(bad, travelLedger, async (d) => { calls += 1; expect(d).toContain('"11월 2일"'); return bad; }, { maxRetries: 2 });
    expect(calls).toBe(2); expect(r.stripped).toBe(true); expect(r.title).not.toContain('11월 2일'); expect(r.audit.status).toBe('PASS');
  });
  it('순서: 패킷 → 제목 → 제목 관문 → 소제목', () => {
    const packetAt = orch.indexOf('let researchPacket: any = await packetMod.buildResearchPacket(');
    const titleAt = orch.indexOf('const firstTitle = await makeTitle(');
    const h2At = orch.indexOf('h2Titles = await generateH2TitlesFinal(');
    expect(packetAt).toBeGreaterThan(0); expect(packetAt).toBeLessThan(titleAt); expect(titleAt).toBeLessThan(h2At);
    expect(read('src/core/final/generation.ts')).toContain('제목의 값 규칙');
  });
});

// ══════════════════════════════════════════════════════════
describe('③ 코드 관문 — 값은 코드가 판정한다', () => {
  it('⭐ 근거 없는 값은 CRITICAL · 절 id · 지문 · REMOVE/REPLACE 허용', () => {
    const issues = codeGate(sectionize(article()), ledger);
    expect(issues.length).toBe(1);
    expect(issues[0]).toMatchObject({ sectionId: 'S03', severity: 'CRITICAL', type: 'UNSUPPORTED_VALUE', exactSpan: '11월 2일', allowedOperations: ['REMOVE', 'REPLACE'] });
    expect(issues[0]!.issueKey).toBe(issueKeyOf('S03', 'UNSUPPORTED_VALUE', '11월 2일'));
  });
  it('같은 문제를 다른 문장으로 적어도 지문이 같다', () => {
    expect(issueKeyOf('S03', 'CONTRADICTION', '11월 2일까지 추가 접수를 받는다는 말이 있습니다')).toBe(issueKeyOf('S03', 'CONTRADICTION', '"11월 2일까지, 추가 접수를 받는다는 말이 있습니다."'));
    expect(issueKeyOf('S03', 'CONTRADICTION', 'a')).not.toBe(issueKeyOf('S02', 'CONTRADICTION', 'a'));
  });
  it('절 사이 되풀이 문장은 MAJOR REDUNDANCY', () => {
    const a = article();
    a.sections[1]!.h3Sections[0]!.content += '<p>2차 가입 신청은 10월 7일부터 16일까지입니다. 출생연도 끝자리로 첫 이틀이 갈립니다.</p>';
    expect(codeGate(sectionize(a), ledger).some((i) => i.type === 'REDUNDANCY' && i.sectionId === 'S02' && i.severity === 'MAJOR')).toBe(true);
  });
  it('JSON 읽기', () => { expect(readJson('```json\n{"a":1,}\n```')).toEqual({ a: 1 }); expect(readJson('x')).toBeNull(); });
});

// ══════════════════════════════════════════════════════════
describe('④ 루프 — 문제 없는 글은 고치지 않고, 문제 절만 한 번의 호출로 고친다', () => {
  const clean = () => { const a = article(); a.sections[2]!.h3Sections[0]!.content = '<p>1차 최종 가입자는 138만5000명이었습니다.</p>'; return a; };

  it('⭐⭐ 문제 없는 글: 수정 0회 · 호출 2회(Critic 1 + 편집 비평) · 절 5/5 그대로', async () => {
    const a = clean(); const before = JSON.stringify(a);
    const kinds: string[] = [];
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: a, packetText, evidenceText, items, callModel: async (p) => { kinds.push(isCritic1(p) ? 'critic1' : isEditorial(p) ? 'editorial' : 'other'); return PASS; } });
    expect(kinds).toEqual(['critic1', 'editorial']);
    expect(r.report.qualityLoopCalls).toBe(2);
    expect(r.report.revisionCycles).toBe(0);
    expect(r.report.converged).toBe(true);
    expect(r.report.unchangedSections).toBe(5);
    expect(JSON.stringify(r.article)).toBe(before);
  });

  it('⭐⭐ 4770대 fixture: 다섯 절의 근거 없는 값을 코드가 전부 잡고, 그 절들만 고쳐 0 이 된다 · 정상 숫자는 남는다', async () => {
    const ev = [{ id: 'E01', title: '전기차 보조금 하반기 추가 공고', cleanedText: '환경부는 하반기 전기차 보조금 추가 공고를 냈다. 국비 보조금은 최대 580만원이다. 수원시는 9월 15일부터 접수한다.' }];
    const a: ArticleSections = {
      introduction: '<p>하반기 전기차 보조금 추가 공고가 나왔습니다. 접수 전에 국비와 지자체 배정을 함께 확인해야 합니다. 잔여 물량은 4770대입니다.</p>',
      sections: [
        { h2: '1. 물량', h3Sections: [{ h3: '잔여', content: '<p>이번 추가 공고의 잔여 물량은 4770대로 집계됩니다. 국비 보조금은 최대 580만원입니다.</p>' }] },
        { h2: '2. 접수', h3Sections: [{ h3: '일정', content: '<p>수원시는 9월 15일부터 접수합니다. 물량 4770대가 소진되면 마감됩니다.</p>' }] },
        { h2: '3. 차종', h3Sections: [{ h3: '대상', content: '<p>승용 전기차가 대상이며 4770대 안에서 선착순입니다.</p>' }] },
        { h2: '4. 준비', h3Sections: [{ h3: '서류', content: '<p>계약서와 신분증을 준비합니다. 4770대 기준으로 지자체 배정이 갈립니다.</p>' }] },
      ],
      conclusion: '<p>580만원 국비와 9월 15일 접수를 기억하면 됩니다.</p>',
    };
    const evText = `[E01][뉴스] ${ev[0]!.title}\n${ev[0]!.cleanedText}`;
    const packet = '[RESEARCH PACKET]\n▸ 수치\n- 580만원 [E01]\n▸ 날짜\n- 9월 15일 [E01]';
    let editorCalls = 0; let editorSections = 0;
    const callModel = async (p: string) => {
      if (isEditor(p)) {
        editorCalls += 1;
        const ids = [...p.matchAll(/===== \[(S\d\d)\]/g)].map((m) => m[1]);
        editorSections = ids.length;
        expect(p).not.toContain('===== [S99]');      // 문제 없는 결론은 편집기에 보이지 않는다
        // 편집기 흉내: 각 절에서 "4770대"가 든 **문장만** 지운다 (최소 변경 — 같은 문단의 다른 문장은 그대로)
        const drop = (html: string) => html.replace(/[^.<>]*4770대[^.<>]*\.\s*/g, '');
        const revisions = ids.map((id) => {
          if (id === 'S00') return { sectionId: id, content: drop(a.introduction), resolvedIssueKeys: [] };
          const s = a.sections[Number(id!.slice(1)) - 1]!;
          return { sectionId: id, h3Sections: s.h3Sections.map((h, i) => ({ index: i, content: stripHtml(drop(h.content)).trim() ? drop(h.content) : '<p>대상 차종과 절차는 공고를 따릅니다.</p>' })), resolvedIssueKeys: [] };
        });
        return JSON.stringify({ revisions });
      }
      if (isVerify(p)) return JSON.stringify({ resolved: [], stillOpen: [], issues: [] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: '2026년 전기차 보조금 하반기 추가 공고', mainKeyword: '전기차 보조금 하반기 추가 공고', article: a, packetText: packet, evidenceText: evText, items: ev, callModel });
    const finalText = sectionize(r.article).map((u) => stripHtml(u.text)).join('\n');
    expect((JSON.stringify(a).match(/4770대/g) || []).length).toBe(5);
    expect(finalText).not.toContain('4770대');
    expect(finalText).toContain('580만원');                 // 정상 숫자는 남는다
    expect(finalText).toContain('9월 15일');
    expect(editorCalls).toBeLessThanOrEqual(2);              // 5절 → 회차당 4절 상한 → 2회
    expect(r.report.revisedSections).toBe(5);
    expect(r.report.unchangedSections).toBe(1);              // S99 결론
    expect(r.article.conclusion).toBe(a.conclusion);
    expect(r.report.converged).toBe(true);
    expect(r.report.qualityLoopCalls).toBeLessThanOrEqual(5);
    expect(r.report.issueLedger.filter((i) => i.type === 'UNSUPPORTED_VALUE').every((i) => i.status === 'RESOLVED')).toBe(true);
  });

  it('⭐⭐ IBK 0.5% 교착 fixture: REMOVE 가 허용된 지적에서 값이 사라진 것은 정상 수정 — 같은 지적이 다음 회차에 OPEN 으로 남지 않는다', async () => {
    const ev = [{ id: 'E01', title: '주담대 금리 동향', cleanedText: '고정형 주담대 금리 상단이 7.17%를 기록했다. 변동형은 6.55%다. 한 은행은 우대금리를 0.5%포인트 늘렸다고 밝혔다.' }];
    const evText = `[E01][뉴스] ${ev[0]!.title}\n${ev[0]!.cleanedText}`;
    const packet = '[RESEARCH PACKET]\n▸ 수치\n- 7.17% [E01]\n- 6.55% [E01]';
    const a: ArticleSections = {
      introduction: '<p>주담대 금리 7% 돌파가 무엇을 뜻하는지 봅니다.</p>',
      sections: [
        { h2: '1. 상단', h3Sections: [{ h3: '수치', content: '<p>고정형 상단은 7.17%, 변동형은 6.55%입니다.</p>' }] },
        { h2: '2. 은행별 특약', h3Sections: [{ h3: 'IBK', content: '<p>IBK기업은행은 5년·10년 주기형 특약 감면 폭을 0.5%포인트 확대했습니다. 그 외 상품은 0.2%포인트 늘렸습니다. 여력이 빠듯하면 고정형을 고려할 수 있습니다.</p>' }] },
      ],
      conclusion: '<p>내 금리부터 확인하는 것이 먼저입니다.</p>',
    };
    let cycle = 0; const editorInputs: string[] = [];
    const key = issueKeyOf('S02', 'MIXED_ENTITY', 'IBK기업은행은 5년·10년 주기형 특약 감면 폭을 0.5%포인트 확대');
    const callModel = async (p: string) => {
      if (isCritic1(p)) { cycle += 1; return JSON.stringify({ status: 'REVISION_REQUIRED', issues: [{ severity: 'CRITICAL', sectionId: 'S02', exactSpan: 'IBK기업은행은 5년·10년 주기형 특약 감면 폭을 0.5%포인트 확대', type: 'MIXED_ENTITY', problem: 'IBK기업은행의 특약 감면 내용은 근거의 어느 기사에도 없는 다른 상품 정보다', evidenceIds: ['E01'], requiredChange: '이 문장을 지운다' }], missingIntentAnswers: [], titleIssues: [], researchQueries: [] }); }
      if (isEditor(p)) { editorInputs.push(p); return JSON.stringify({ revisions: [{ sectionId: 'S02', h3Sections: [{ index: 0, content: '<p>여력이 빠듯하면 고정형을 고려할 수 있습니다. 은행별 특약은 창구에서 확인합니다.</p>' }], resolvedIssueKeys: [key] }] }); }
      if (isVerify(p)) return JSON.stringify({ resolved: [key], stillOpen: [], issues: [] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: '주택담보대출 금리 7% 돌파', mainKeyword: '주택담보대출 금리 7% 돌파', article: a, packetText: packet, evidenceText: evText, items: ev, callModel });
    expect(r.report.revisions[0]!.revised).toEqual(['S02']);           // 되돌리지 않았다
    expect(r.report.revisions[0]!.rejected).toEqual([]);
    expect(r.article.sections[1]!.h3Sections[0]!.content).not.toContain('0.5%');
    expect(r.report.issueLedger.find((i) => i.issueKey === key)!.status).toBe('RESOLVED');
    expect(r.report.revisionCycles).toBe(1);
    expect(r.report.converged).toBe(true);
    expect(cycle).toBe(1);                                              // Critic 1 은 한 번만 — 재비평은 검증 비평이 맡는다
    expect(editorInputs[0]).toContain('허용: REMOVE/REPLACE');
  });

  it('⭐⭐ live 736-1 재현: 되돌려진 절의 지적은 검증 비평이 "풀렸다"고 해도 OPEN 이다 — 바뀌지 않은 절은 풀릴 수 없다', async () => {
    /**
     * 실측 2026-09-22: S05(CRITICAL) 수정이 과수정 관문에서 되돌려졌는데(50만원·6%·12% 손실), 검증 비평은 고친 절(S00)만 보고도
     * S05 지적까지 resolved 로 답했다 → 루프가 "수렴"이라 했고 Final Judge 가 그 모순을 잡아 MANUAL_REVIEW. 가짜 수렴이었다.
     */
    const a: ArticleSections = { ...article(), sections: article().sections.slice(0, 2) };   // S03(근거 없는 11월 2일) 제외 — 이 시험은 모델 지적만 본다
    const keyS02 = issueKeyOf('S02', 'MIXED_ENTITY', '3년 만기 자유적립식입니다');
    const keyS00 = issueKeyOf('S00', 'TITLE_PROMISE_UNMET', '가구원 동의부터 확인해야 합니다');
    let editorCalls = 0; const verifyLists: string[] = [];
    const callModel = async (p: string) => {
      if (isCritic1(p)) return JSON.stringify({ status: 'REVISION_REQUIRED', issues: [
        { severity: 'CRITICAL', sectionId: 'S02', exactSpan: '3년 만기 자유적립식입니다', type: 'MIXED_ENTITY', problem: '1차 안내의 상품 구조를 2차 절차처럼 서술했다', evidenceIds: ['E01'], requiredChange: '2차 기준임을 구분한다' },
        { severity: 'MAJOR', sectionId: 'S00', exactSpan: '가구원 동의부터 확인해야 합니다', type: 'TITLE_PROMISE_UNMET', problem: '제목이 약속한 답(동의가 필요한지)을 도입이 주지 않는다', evidenceIds: [], requiredChange: '필요 여부를 적는다' },
      ], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
      if (isEditor(p)) {
        editorCalls += 1;
        // 편집기가 S02 를 통째로 다시 써서 값이 전부 사라진다(과수정 → 되돌려짐) · S00 은 정상 수정
        return JSON.stringify({ revisions: [
          { sectionId: 'S02', h3Sections: [{ index: 0, content: '<p>2차 모집의 납입 조건은 공식 안내에서 확인해야 합니다.</p>' }], resolvedIssueKeys: [keyS02] },
          { sectionId: 'S00', content: '<p>청년미래적금 2차 신청에서 가구원 동의가 필요한지는 공식 안내에서 확인해야 합니다.</p>', resolvedIssueKeys: [keyS00] },
        ] });
      }
      if (isVerify(p)) { verifyLists.push(p); return JSON.stringify({ resolved: [keyS02, keyS00], stillOpen: [], issues: [] }); }   // 모델이 못 본 절까지 풀렸다고 한다
      return PASS;
    };
    const r = await runCritiqueLoop({ title: '2026년 청년미래적금 2차 신청 가구원 동의 필요한지', mainKeyword: '청년미래적금 2차 신청', article: a, packetText, evidenceText, items, callModel, maxRevisions: 1 });
    expect(r.report.revisions[0]!.rejected.map((x) => x.sectionId)).toEqual(['S02']);
    expect(r.report.issueLedger.find((i) => i.issueKey === keyS00)!.status).toBe('RESOLVED');
    expect(r.report.issueLedger.find((i) => i.issueKey === keyS02)!.status).toBe('OPEN');     // 바뀌지 않은 절은 풀릴 수 없다
    expect(verifyLists[0]).not.toContain(keyS02);                                              // 검증 비평에게 묻지도 않는다
    expect(r.report.converged).toBe(false);
    expect(r.report.open.critical).toBe(1);
    expect(editorCalls).toBe(1);
  });

  it('⭐⭐ live 736-2 재현: 편집기가 content 에 <h3> 를 되돌려줘도 소제목이 겹치지 않는다 (두 회차 뒤 소제목이 세 번 찍혔다)', async () => {
    const a: ArticleSections = { ...article(), sections: article().sections.slice(0, 2) };
    const key = issueKeyOf('S02', 'MIXED_ENTITY', '3년 만기 자유적립식입니다');
    const callModel = async (p: string) => {
      if (isCritic1(p)) return JSON.stringify({ status: 'REVISION_REQUIRED', issues: [{ severity: 'CRITICAL', sectionId: 'S02', exactSpan: '3년 만기 자유적립식입니다', type: 'MIXED_ENTITY', problem: '1차 안내의 상품 구조를 2차 절차처럼 서술했다', evidenceIds: ['E01'], requiredChange: '이 문장을 지운다' }], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
      // 편집기 프롬프트가 "[index 0] <h3>한도</h3>\n본문" 으로 보여 주니 모델이 <h3> 까지 그대로 돌려준다
      if (isEditor(p)) return JSON.stringify({ revisions: [{ sectionId: 'S02', h3Sections: [{ index: 0, content: '<h3>한도</h3>\n<h3>한도</h3>\n<p>월 납입 한도는 50만원이고 정부 기여금은 6% 또는 12%입니다.</p>' }], resolvedIssueKeys: [key] }] });
      if (isVerify(p)) return JSON.stringify({ resolved: [key], stillOpen: [], issues: [] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: a, packetText, evidenceText, items, callModel });
    expect(r.report.revisions[0]!.revised).toEqual(['S02']);
    const content = r.article.sections[1]!.h3Sections[0]!.content;
    expect(content).not.toMatch(/<h3/i);
    expect(content).toContain('50만원');
    expect(r.article.sections[1]!.h3Sections[0]!.h3).toBe('한도');
  });

  it('⭐ 일반 설명("여력이 빠듯하면 고정형")을 근거 없다고 올려도 CRITICAL/MAJOR 가 되지 못한다 · 코드가 뒷받침한 값을 근거 없다고 하면 버린다', async () => {
    const a = clean();
    let n = 0;
    const callModel = async (p: string) => {
      if (isCritic1(p) && n++ === 0) return JSON.stringify({ status: 'REVISION_REQUIRED', issues: [
        { severity: 'CRITICAL', sectionId: 'S02', exactSpan: '3년 만기 자유적립식입니다', type: 'UNSUPPORTED_CLAIM', problem: '3년 만기 자유적립식이라는 설명은 근거 없다', evidenceIds: [], requiredChange: '지워라' },
        { severity: 'CRITICAL', sectionId: 'S02', exactSpan: '월 납입 한도는 50만원', type: 'UNSUPPORTED_CLAIM', problem: '50만원은 근거 없다', evidenceIds: [], requiredChange: '지워라' },
        { severity: 'MAJOR', sectionId: 'S01', exactSpan: '', type: 'OTHER', problem: '문장이 조금 더 자연스러울 수 있다', evidenceIds: [], requiredChange: '다듬어라' },
      ], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: a, packetText, evidenceText, items, callModel });
    expect(r.report.revisionCycles).toBe(0);
    expect(r.report.open.critical + r.report.open.major).toBe(0);
    expect(r.report.critic1!.rejectedIssues.some((x) => /코드가 뒷받침을 확인한 값/.test(x.reason))).toBe(true);
    expect(r.report.converged).toBe(true);
  });

  it('⭐ 근거 없는 "넣어라"·없는 절 id 는 버린다 · 팩트 종류에 근거 id 가 없으면 MINOR', async () => {
    let n = 0;
    const callModel = async (p: string) => {
      if (isCritic1(p) && n++ === 0) return JSON.stringify({ status: 'REVISION_REQUIRED', issues: [
        { severity: 'MAJOR', sectionId: 'S01', exactSpan: '2차 가입 신청은 10월 7일부터', type: 'MISSING_INFORMATION', problem: '기여금 인상 소식이 빠졌다', evidenceIds: ['E99'], requiredChange: '넣어라' },
        { severity: 'CRITICAL', sectionId: 'S77', exactSpan: 'x', type: 'CONTRADICTION', problem: '없는 절에 대한 지적', evidenceIds: ['E01'], requiredChange: '…' },
        { severity: 'CRITICAL', sectionId: 'S01', exactSpan: '출생연도 끝자리로 첫 이틀이 갈립니다', type: 'CONTRADICTION', problem: '근거와 다르게 설명했다고 주장하지만 근거 id 없음', evidenceIds: [], requiredChange: '…' },
      ], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: clean(), packetText, evidenceText, items, callModel });
    expect(r.report.revisionCycles).toBe(0);
    expect(r.report.open.minor).toBe(1);
    expect(r.report.converged).toBe(true);
  });

  it('⭐ 검증 비평은 새 MAJOR 를 발굴하지 못한다 — 수정 때문에 생긴 CRITICAL 만', async () => {
    const callModel = async (p: string) => {
      if (isEditor(p)) return JSON.stringify({ revisions: [{ sectionId: 'S03', h3Sections: [{ index: 0, content: '<p>1차 최종 가입자는 138만5000명이었습니다. 2차 접수 일정은 공식 안내를 따릅니다.</p>' }], resolvedIssueKeys: [] }] });
      if (isVerify(p)) return JSON.stringify({ resolved: [], stillOpen: [], issues: [
        { severity: 'MAJOR', sectionId: 'S01', exactSpan: '출생연도 끝자리로 첫 이틀이 갈립니다', type: 'ANSWER_TOO_LATE', problem: '이 설명은 더 앞에 있어야 읽기 좋다', evidenceIds: [], requiredChange: '…' },
        { severity: 'CRITICAL', sectionId: 'S01', exactSpan: '출생연도 끝자리로 첫 이틀이 갈립니다', type: 'CONTRADICTION', problem: '수정과 무관한 절의 새 지적', evidenceIds: ['E01'], requiredChange: '…', causedByRevision: true },
      ] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: article(), packetText, evidenceText, items, callModel });
    // S01 은 고친 절이 아니므로 "수정 때문에 생겼다"는 CRITICAL 도 참고로 내려간다
    expect(r.report.open.critical + r.report.open.major).toBe(0);
    expect(r.report.revisionCycles).toBe(1);
    expect(r.report.converged).toBe(true);
  });

  it('⭐ 2회 고쳐도 남으면 MANUAL_REVIEW (상한 2)', async () => {
    let n = 0;
    const callModel = async (p: string) => {
      if (isCritic1(p)) return JSON.stringify({ status: 'REVISION_REQUIRED', issues: [{ severity: 'MAJOR', sectionId: 'S01', exactSpan: '2차 가입 신청은 10월 7일부터 16일까지입니다', type: 'TITLE_PROMISE_UNMET', problem: '제목이 약속한 가구원 동의 절차가 본문에 없다', evidenceIds: [], requiredChange: '가구원 동의 절차를 보탠다' }], missingIntentAnswers: [], titleIssues: [], researchQueries: [] });
      if (isEditor(p)) { n += 1; return JSON.stringify({ revisions: [{ sectionId: 'S01', h3Sections: [{ index: 0, content: '<p>2차 가입 신청은 10월 7일부터 16일까지입니다. 출생연도 끝자리로 첫 이틀이 갈립니다. 접수 전 확인할 것이 있습니다.</p>' }], resolvedIssueKeys: [] }] }); }
      if (isVerify(p)) return JSON.stringify({ resolved: [], stillOpen: [{ issueKey: 'x', reason: '아직 없음' }], issues: [] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: '가구원 동의 먼저', mainKeyword: '청년미래적금 2차 신청', article: article(), packetText, evidenceText, items, callModel });
    expect(n).toBe(2);
    expect(r.report.revisionCycles).toBe(2);
    expect(r.report.converged).toBe(false);
    expect(r.report.manualReviewReason).toContain('수정 2회 뒤에도');
  });

  it('NEEDS_MORE_RESEARCH 면 검색으로 되돌아가 Critic 1 을 한 번 더 부른다', async () => {
    let n = 0; let researched: string[] = [];
    const callModel = async (p: string) => {
      if (isCritic1(p) && n++ === 0) return JSON.stringify({ status: 'NEEDS_MORE_RESEARCH', issues: [], missingIntentAnswers: ['가구원 동의 절차'], titleIssues: [], researchQueries: ['청년미래적금 가구원 동의'] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '청년미래적금 2차 신청', article: clean(), packetText, evidenceText, items, callModel, moreResearch: async (q) => { researched = q; return { packetText, evidenceText, items }; } });
    expect(researched).toEqual(['청년미래적금 가구원 동의']);
    expect(r.report.researchRounds).toBe(1);
    expect(r.report.converged).toBe(true);
  });

  it('과수정 관문 — 새 근거 없는 값·REMOVE 없는 값 삭제·다른 절과 같은 문장·지적된 값 잔존은 거부, REMOVE 지적의 값 삭제는 허용', () => {
    const units = sectionize(article());
    const s2 = units[2]!; const others = units.filter((u) => u.id !== 'S02');
    expect(guardRevision(s2.text, '<p>월 납입 한도는 70만원입니다. 정부 기여금은 6% 또는 12%입니다. 3년 만기 자유적립식입니다.</p>', ledger, others)).toContain('새로 근거 없는 값');
    expect(guardRevision(s2.text, '<p>한도가 있습니다. 기여금도 있습니다. 만기도 있습니다. 확인하세요.</p>', ledger, others)).toContain('근거 있는 값이 사라졌다');
    expect(guardRevision(s2.text, '<p>2차 가입 신청은 10월 7일부터 16일까지입니다. 출생연도 끝자리로 첫 이틀이 갈립니다. 월 납입 한도는 50만원이고 정부 기여금은 6% 또는 12%입니다.</p>', ledger, others)).toContain('다른 절과 같은 문장');
    const removeIssue: Issue = { issueKey: 'k', severity: 'CRITICAL', sectionId: 'S02', exactSpan: '월 납입 한도는 50만원이고 정부 기여금은 6% 또는 12%입니다', type: 'MIXED_ENTITY', problem: 'x'.repeat(12), evidenceIds: ['E01'], requiredChange: '지운다', allowedOperations: ['REMOVE', 'REPLACE'], origin: 'critic1', status: 'OPEN' };
    expect(guardRevision(s2.text, '<p>3년 만기 자유적립식입니다. 한도와 기여금은 공식 안내에서 확인합니다.</p>', ledger, others, [removeIssue])).toBeNull();
    const s3 = units[3]!;
    const codeIssue = codeGate(units, ledger)[0]!;
    expect(guardRevision(s3.text, '<p>1차 최종 가입자는 138만5000명이었습니다. 11월 2일까지 접수한다고 합니다.</p>', ledger, units.filter((u) => u.id !== 'S03'), [codeIssue])).toContain('지적된 값이 그대로 남아 있다');
  });
});

describe('⑤ Final Judge — 구체 blocker 없이는 BLOCK 못 한다', () => {
  const clean = () => { const a = article(); a.sections[2]!.h3Sections[0]!.content = '<p>1차 최종 가입자는 138만5000명이었습니다.</p>'; return a; };
  it('⭐⭐ "더 좋아질 수 있다"만 있으면 PASS (advisory 로 남는다)', async () => {
    const j = await runFinalJudge({ title: 't', mainKeyword: 'k', article: clean(), packetText, evidenceText, items, callModel: async () => JSON.stringify({ decision: 'BLOCK', blockingIssues: [{ sectionId: 'S01', exactSpan: '', type: 'OTHER', reason: '조금 더 다듬을 수 있다' }], advisory: ['더 흥미롭게 쓸 수 있다'] }) });
    expect(j.decision).toBe('PASS');
    expect(j.blockingIssues).toEqual([]);
    expect(j.advisory.length).toBe(2);
  });
  it('⭐ FAQ 에 근거 없는 값이 있으면 모델이 PASS 라 해도 BLOCK (코드) · 구체 구절이 있는 모델 blocker 는 인정', async () => {
    const j = await runFinalJudge({ title: 't', mainKeyword: 'k', article: clean(), packetText, evidenceText, items, faqText: 'Q. 언제까지? A. 11월 2일까지 받습니다.', callModel: async () => PASS_JUDGE });
    expect(j.decision).toBe('BLOCK');
    expect(j.blockingIssues[0]).toMatchObject({ sectionId: 'FAQ', exactSpan: '11월 2일', type: 'UNSUPPORTED_VALUE' });
    const j2 = await runFinalJudge({ title: 't', mainKeyword: 'k', article: clean(), packetText, evidenceText, items, callModel: async () => JSON.stringify({ decision: 'BLOCK', blockingIssues: [{ sectionId: 'S01', exactSpan: '출생연도 끝자리로 첫 이틀이 갈립니다', type: 'CONTRADICTION', reason: '근거는 출생연도와 무관하게 접수한다고 한다' }], advisory: [] }) });
    expect(j2.decision).toBe('BLOCK');
    expect(j2.blockingIssues[0]!.type).toBe('CONTRADICTION');
  });
  it('심사 프롬프트는 관문 결과를 받고 "명백한 문제만" 묻는다 · 짧다', async () => {
    let prompt = '';
    await runFinalJudge({ title: 't', mainKeyword: 'k', article: clean(), packetText, evidenceText, items, gateSummary: 'TitleFactGate: PASS', callModel: async (p) => { prompt = p; return PASS_JUDGE; } });
    expect(prompt).toContain('발행을 막아야 할 명백한 문제가 있는가');
    expect(prompt).toContain('TitleFactGate: PASS');
    expect(prompt.length).toBeLessThan(18000);
  });
});

describe('⑥ Hard Gate · 발행 결정 · 장부 · 유료 호출 가드', () => {
  it('⭐⭐ 관문 FAIL 이면 100점 불가 · 수렴 조건에 "한 번 더 고치면 나아진다"가 없다', () => {
    expect(orch).toContain('const gatedScore = hardGatesAllPass ? audited.score : Math.min(audited.score, 89);');
    expect(orch).not.toContain('anotherRevisionWouldMateriallyImprove');
    expect(orch).toContain("? hardGatesAllPass && !!critiqueReport && critiqueReport.converged === true\n      : hardGatesAllPass;");
    expect(orch).toContain('BODY_FACT_PASS: bodyClaimCheck.unsupported.length === 0,');
  });
  it('⭐ 루프·심사·발행 차단은 켜야만 돈다 (기본은 734 와 같다)', () => {
    expect(orch).toContain("const qualityLoopOn = (payload as any).qualityLoop === true || process.env['QUALITY_LOOP'] === '1';");
    expect(orch).toContain('const runFinalQa = qualityLoopOn &&');
    expect(orch).toContain('maxRevisions: 2,');
  });
  it('⭐ 요약표는 행을 지우지 않고 칸의 값만 걷어낸다', () => {
    expect(orch).toContain("return stripped.length >= 4 ? stripped : '공식 자료 확인 필요';");
    expect(orch).not.toContain('요약표 행 제외');
  });
  it('⭐⭐ NO_LIVE_LLM=1 이면 어떤 provider 도 부르지 못한다', async () => {
    const { callLLM } = require('../src/core/llm/llm-caller');
    await expect(callLLM('openai', 'x')).rejects.toThrow('NO_LIVE_LLM');
    const { callGeminiWithRetry, callGeminiWithGrounding } = require('../src/core/final/gemini-engine');
    await expect(callGeminiWithRetry('x')).rejects.toThrow('NO_LIVE_LLM');
    await expect(callGeminiWithGrounding('x')).rejects.toThrow('NO_LIVE_LLM');
    const { fetchFactContext } = require('../src/core/perplexityFactCheck');
    expect((await fetchFactContext('x', 'perplexity')).success).toBe(false);
  });
  it('발행 창구가 MANUAL_REVIEW 본문을 그대로는 발행하지 않는다 · 사람이 고친 본문은 막지 않는다', () => {
    clearPublishDecisions();
    const html = '<p>이 글은 검토가 필요합니다</p>';
    recordPublishDecision(html, 'MANUAL_REVIEW', 'TITLE_FACT_PASS');
    expect(checkPublishDecision(html)!.decision).toBe('MANUAL_REVIEW');
    expect(checkPublishDecision(html + '<p>사람이 한 줄 고쳤다</p>')).toBeNull();
    const idx = read('src/core/index.ts');
    expect(idx).toContain("hold.decision === 'MANUAL_REVIEW' && payload?.forcePublish !== true");
  });
  it('장부에 호출 수·단계별 모델·주기·결정이 남는다', () => {
    const ledgerSrc = read('src/core/final/publish-ledger.ts');
    for (const f of ['qualityLoopCalls', 'totalCalls', 'baseGenerationCalls', 'draftModel', 'critic1Model', 'finalJudgeModel', 'finalDecision', 'qualityConverged', 'hardGates']) expect(ledgerSrc).toContain(`${f}?:`);
    const g: any = globalThis as any;
    g.__llmActualModels = { 'openai/gpt-5.6-terra': 3 };
    const snap = snapshotModels();
    g.__llmActualModels = { 'openai/gpt-5.6-terra': 5, 'openai/gpt-5.6-luna': 1 };
    expect(modelsSince(snap)).toBe('openai/gpt-5.6-terra×2, openai/gpt-5.6-luna');
  });
});

describe('⑦ 키워드 출처 (유지)', () => {
  it('본문에 없는 모델 태그는 버리고, 핵심어가 든 실제 자동완성만 더한다', () => {
    const p = buildKeywordProvenance({
      mainKeyword: '청년미래적금 2차 신청', title: '청년미래적금 2차 신청 가구원 동의',
      bodyText: '청년미래적금 2차 신청은 10월 7일부터입니다. 가구원 동의가 필요합니다.',
      generatedTags: ['청년미래적금', '가구원동의', '청년도약계좌', '재테크꿀팁', '#적금추천'],
      actualSuggestions: ['청년미래적금 2차 신청기간', '청년희망적금 2차 모집', '연말정산 환급'],
    });
    expect(p.articleKeyword).toEqual(['청년미래적금', '가구원동의']);
    expect(p.actualSearchKeyword).toEqual(['청년미래적금 2차 신청기간']);
    expect(p.hashtag).toEqual(['청년미래적금', '가구원동의', '청년미래적금 2차 신청기간']);
    expect(orch).toContain('buildKeywordProvenance({');
  });
});
