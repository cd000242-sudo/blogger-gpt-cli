const fs = require('fs');
const path = require('path');

import { summarizeQualityStatus } from '../src/core/final/quality-status';
import { blockBetween, linesAfter } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.752 (감사 F12) — 품질 상태 이름표.
 *
 * 2026-09-29 발행본 4편 전부 QUALITY_LOOP OFF 였는데 `FINAL: QUALITY_CONVERGED` 가 찍혔다.
 * 비평·수정·검증이 한 번도 안 돌았는데 검증 완료처럼 읽혔다. 이름표만 가른다 —
 * publishDecision·발행 창구 동작·루프 호출 수는 그대로다(지시서 §2).
 */
describe('v3.8.752 품질 상태 여섯 개념 분리', () => {
  const base = { loopEligible: true, hardGatesAllPass: true, qualityConverged: true, publishDecision: 'AUTO_PUBLISH' as const, manualReviewReason: '' };

  /** 테스트 1 — 루프 OFF: '미실행' 로 표시하고 수렴·검증 완료라 하지 않는다. 추가 호출 0 (순수 함수 — 호출할 것이 없다) */
  test('루프 OFF 면 미실행이지 수렴이 아니다', () => {
    const s = summarizeQualityStatus({ ...base, qualityLoopOn: false, critiqueReport: null });
    expect(s.qualityLoopExecuted).toBe(false);
    expect(s.qualityLoopOutcome).toBe('NOT_RUN');
    expect(s.finalStage).toBe('GATES_PASSED_LOOP_NOT_RUN');
    expect(s.finalStage).not.toBe('QUALITY_CONVERGED');
    expect(s.label).toContain('추가 품질 검수(비평·수정 루프): 미실행(QUALITY_LOOP OFF)');
    expect(s.label).not.toMatch(/수렴|검증 완료/);
    expect(s.label).toContain('기본 코드 검사: 통과');
    expect(s.label).toContain('발행 상태: 발행 허용(참고 판정 · 루프 OFF');
  });

  /** 테스트 2 — 루프 ON: 실제 결과(수렴/미수렴)를 보인다 */
  test('루프 ON 이면 실제 결과를 보인다', () => {
    const converged = summarizeQualityStatus({ ...base, qualityLoopOn: true, critiqueReport: { converged: true } });
    expect(converged.qualityLoopExecuted).toBe(true);
    expect(converged.qualityLoopOutcome).toBe('CONVERGED');
    expect(converged.finalStage).toBe('QUALITY_CONVERGED');
    expect(converged.publishStatus).toBe('PUBLISH_ALLOWED');

    const notConverged = summarizeQualityStatus({ ...base, qualityLoopOn: true, critiqueReport: { converged: false, manualReviewReason: 'OPEN major 2' }, qualityConverged: false, publishDecision: 'MANUAL_REVIEW', manualReviewReason: 'OPEN major 2' });
    expect(notConverged.qualityLoopOutcome).toBe('NOT_CONVERGED');
    expect(notConverged.finalStage).toBe('MANUAL_REVIEW');
    expect(notConverged.publishStatus).toBe('PUBLISH_HELD');
    expect(notConverged.label).toContain('미수렴');
  });

  /** 테스트 3 — 루프 오류·타임아웃은 PASS 로 바꾸지 않는다 */
  test('루프 오류는 ERROR 이지 PASS 가 아니다', () => {
    const s = summarizeQualityStatus({ ...base, qualityLoopOn: true, critiqueReport: { converged: false, loopError: true, manualReviewReason: '비평 루프 오류: timeout' }, qualityConverged: false, publishDecision: 'MANUAL_REVIEW', manualReviewReason: '비평 루프 오류: timeout' });
    expect(s.qualityLoopOutcome).toBe('ERROR');
    expect(s.finalStage).toBe('MANUAL_REVIEW');
    expect(s.publishStatus).toBe('PUBLISH_HELD');
    expect(s.label).toContain('오류(통과 아님)');
    expect(s.label).not.toMatch(/PASS|수렴\(/);
    // orchestration 의 루프 catch 가 loopError 표식을 단다
    const catchBlock = blockBetween(read('src/core/final/orchestration.ts'), '비평 루프 오류 (초안 그대로 진행', 'void titleRevisedByCritic');
    expect(catchBlock).toContain('loopError: true');
  });

  /** 테스트 4 — 발행 정책 회귀 0: 결정식·발행 창구 인자·OFF 참고 판정은 그대로 */
  test('발행 정책은 손대지 않았다', () => {
    const src = read('src/core/final/orchestration.ts');
    expect(src).toContain("publishDecision = qualityConverged ? 'AUTO_PUBLISH' : 'MANUAL_REVIEW';");
    expect(src).toContain("qualityConverged = runFinalQa\n      ? hardGatesAllPass && !!critiqueReport && critiqueReport.converged === true\n      : hardGatesAllPass;");
    // v3.8.769 — 발행 창구 인자는 publishEnforced(= 루프 ON 또는 현재 상태 모순). 상태 모순이 없으면 qualityLoopOn 과 같다
    expect(src).toContain("recordPublishDecision(html, publishDecision, manualReviewReason, String(h1 || ''), publishEnforced)");
    expect(src).toContain('const publishEnforced = qualityLoopOn || !criticalGate.pass || !titleGate.pass;');
    // 상태 모순으로 막히는 글은 루프 OFF 여도 "보류" 로 표시한다(참고 판정이라고 쓰지 않는다)
    expect(summarizeQualityStatus({ ...base, qualityLoopOn: false, critiqueReport: null, hardGatesAllPass: false, qualityConverged: false, publishDecision: 'MANUAL_REVIEW', manualReviewReason: 'CRITICAL_STATE_PASS', holdEnforced: true }).publishStatus).toBe('PUBLISH_HELD');
    // OFF 는 관문이 실패해도 참고 판정 — 막지 않는다 (v3.8.747 그대로)
    const offFail = summarizeQualityStatus({ ...base, qualityLoopOn: false, critiqueReport: null, hardGatesAllPass: false, qualityConverged: false, publishDecision: 'MANUAL_REVIEW', manualReviewReason: 'EVIDENCE_GATE_PASS' });
    expect(offFail.publishStatus).toBe('PUBLISH_ALLOWED_ADVISORY');
    expect(offFail.codeGatesPassed).toBe(false);
    expect(offFail.finalStage).toBe('MANUAL_REVIEW');
    // 상태 이름표 계산은 summarizeQualityStatus 한 곳 — publishDecision 을 입력으로만 받는다
    expect(src).toContain("require('./quality-status').summarizeQualityStatus({");
    expect(src).toContain("pipelineStatus.mark('FINAL', qualityStatus.finalStage");
  });

  /** 테스트 5 — 점수의 대상 원고를 표시한다: [QUALITY] 는 초안 절, 장부 점수는 최종 HTML. 검사 뒤 바뀐 본문에 옛 점수를 붙이지 않는다 */
  test('점수마다 대상 원고 이름표가 붙는다', () => {
    const src = read('src/core/final/orchestration.ts');
    expect(src).toContain('기본 형식 검사(초안 절 기준 · 발행본 아님): ${qualityReport.score}/100');
    expect(src).toContain("trace.check('validateArticleQuality', { status: 'RUN'");
    expect(src).toContain("target: 'draft-sections', changedAfter: true");
    expect(src).toContain("auditScoreTarget: 'final-html'");
    expect(src).toContain('발행본 형식 점수 ${gatedScore}점(auditArticle · 최종 HTML)');
    // 장부에 여섯 개념이 실린다
    const ledgerBlock = blockBetween(src, 'appendLedgerEntry(ledgerPath(), {', "trace.snapshot('ledger.entry'");
    for (const field of ['runId', 'qualityLoopExecuted', 'qualityLoopOutcome', 'codeGatesPassed', 'qualityStatusLabel']) expect(ledgerBlock).toContain(field);
    // 결과에도 같은 값이 돌아간다
    const ret = linesAfter(src, '// v3.8.752 — 실행 ID · 품질 상태 여섯 개념', 6);
    expect(ret).toContain('qualityLoopOutcome: qualityStatus.qualityLoopOutcome');
  });
});
