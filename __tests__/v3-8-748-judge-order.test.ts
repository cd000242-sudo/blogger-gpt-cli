/**
 * 748-quality-fix-2 (C) — Final Judge 는 본문을 바꾸는 마지막 단계 뒤에 온다 (fixture H: 낡은 MANUAL_REVIEW 금지).
 * (A)(B) 배선도 여기서 같이 못박는다 — "조용한 미배선" 재발 방지(id 실존·순서 검사).
 */
import * as fs from 'fs';
import * as path from 'path';

const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const at = (s: string) => { const i = orch.indexOf(s); if (i < 0) throw new Error(`앵커 없음: ${s}`); return i; };

describe('748 (C) Judge 순서 — HTML 조립·자가 수정 뒤, 장부·발행 기록 앞', () => {
  test('H-1 runFinalJudge 는 한 곳에서만 부르고, 그 자리는 97% 자가 수정·답변 블록 복구·빈 블록 걷기 뒤다', () => {
    expect(orch.split("runFinalJudge(").length - 1).toBe(1);
    const judge = at("runFinalJudge(");
    expect(judge).toBeGreaterThan(at('fixBeforePublish('));
    expect(judge).toBeGreaterThan(at('restoreAnswerBlockQuestion(html'));
    expect(judge).toBeGreaterThan(at('removeEmptyDecorativeBoxes(html)'));
    expect(judge).toBeGreaterThan(at('dedupeRepeatedClaims(html)'));
    expect(judge).toBeGreaterThan(at('autoRepairBeforePublish(html)'));
    expect(judge).toBeGreaterThan(at('removeEchoedSentences(html)'));
  });

  test('H-2 Judge 뒤에는 본문을 바꾸는 단계가 없다 — 장부·빈 블록 검사·발행 결정 기록·return 만', () => {
    const judge = at("runFinalJudge(");
    const tail = orch.slice(judge);
    // 심사 뒤 html 재대입은 없어야 한다(직렬화·저장·로그·발행만)
    const reassign = tail.match(/^\s*html = /gm) || [];
    expect(reassign).toEqual([]);
    expect(at('appendLedgerEntry(ledgerPath()')).toBeGreaterThan(judge);
    expect(at("recordPublishDecision(html, publishDecision")).toBeGreaterThan(judge);
  });

  test('H-3 Judge 입력은 보이는 글(parseVisibleArticle) — 제목·도입·절·FAQ·CTA·결론·요약 전부 HTML 에서 되읽은 것', () => {
    const judge = at("runFinalJudge(");
    const parse = at("parseVisibleArticle(html)");
    expect(parse).toBeLessThan(judge);
    const call = orch.slice(judge, orch.indexOf('});', judge));   // runFinalJudge({ … }); 호출 인자 블록
    expect(call).toContain('title: judgeTitle');
    expect(call).toContain('article: judgeArticle');
    expect(call).toContain('faqItems: judgeFaqItems');
    expect(call).toContain('summaryText: judgeSummaryText');
    expect(call).toContain('ctaText: judgeCtaText');
    // 하드 게이트의 본문 값 대조도 보이는 글로 한다
    expect(orch).toContain("bodyClaimCheck = (() => { try { return require('./fact-claims').checkClaims(judgeBodyText, claimLedger());");
  });

  test('H-4 발행 결정·하드 게이트는 Judge 뒤에서 채워진다 (앞에서는 자리만)', () => {
    const judge = at("runFinalJudge(");
    expect(at("let publishDecision: 'AUTO_PUBLISH' | 'MANUAL_REVIEW' = 'MANUAL_REVIEW';")).toBeLessThan(judge);
    expect(at("publishDecision = qualityConverged ? 'AUTO_PUBLISH' : 'MANUAL_REVIEW';")).toBeGreaterThan(judge);
    expect(at("hardGates = {")).toBeGreaterThan(judge);
  });

  test('H-5 자가 수정은 없애지 않고 잰다 — 비용·글자 변화·호출이 장부로 간다', () => {
    expect(orch).toContain('preflightCostUsd: Number(pre.costUsd)');
    expect(orch).toContain('finalJudgeInput: String(finalJudge.input)');
    expect(orch).toMatch(/__lastPreflight = \{ revised: outcome\.revised, calls: outcome\.calls, notes: [^}]*costUsd/);
  });
});

describe('748 (A)(B) 배선 — 거른 질문은 어디에도 가지 않고, Writer 만 정제 패킷을 본다', () => {
  test('A-wire 지식iN 질문은 demandSignals 에 들어가기 전에 거른다(1차) · 제목 뒤 소제목 전에 다시 거른다(2차) · 실에도 문맥을 준다', () => {
    const pass1 = at("filterThreadQuestions(rawUserQuestions, { keyword, relatedQueries: bySource('google-suggest') })");
    const pass2 = at("filterThreadQuestions(demandSignals.userQuestions, { keyword, title: String(h1 || ''), relatedQueries: demandSignals.searchQueries, packetText: researchPacketText })");
    expect(pass1).toBeLessThan(at("userQuestions: threadPass1.accepted"));
    expect(pass2).toBeGreaterThan(at("researchPacketText = packetMod.renderPacket(researchPacket);"));
    expect(pass2).toBeLessThan(at('// 3. H2 생성'));
    expect(orch).toContain("relevance: { keyword, title: String(h1 || ''), relatedQueries: demandSignals?.searchQueries, packetText: researchPacketText }");
    // 검색은 키워드만 쓴다 — 질문이 검색어가 되는 경로가 없다
    expect(orch).not.toMatch(/fetchGrounding\([^)]*userQuestions/);
  });

  test('B-wire Writer 근거 블록의 첫 자리는 정제 보기, RAW 패킷은 Critic·Judge·CTA 에 그대로', () => {
    expect(orch).toContain('writerPacketView?.text || researchPacketText,');
    const judge = at("runFinalJudge(");
    expect(orch.slice(judge, orch.indexOf('});', judge))).toContain('packetText: researchPacketText');
    expect(orch).toContain("buildWriterPacketView(researchPacket, { keyword, title: String(h1 || ''), h2Titles, questions: demandSignals?.userQuestions || [] })");
  });
});
