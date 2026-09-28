/**
 * 🧭 quality-status — "이 글의 품질 상태" 를 여섯 개념으로 갈라 말한다 (v3.8.752, 감사 F12).
 *
 * ## 무엇이 문제였나
 * 2026-09-29 발행본 4편 전부 QUALITY_LOOP OFF 였는데 화면·장부에는 `FINAL: QUALITY_CONVERGED` 가 찍혔다.
 * 코드 관문(SEARCH_INTENT·FINAL_JUDGE·NO_MAJOR_REDUNDANCY)은 루프가 안 돌면 true 라서 "전부 통과" 가 되고,
 * 그 별칭이 '수렴' 이었다. 비평·수정·검증이 **한 번도 안 돌았는데** 검증 완료처럼 읽혔다.
 *
 * ## 갈라야 할 여섯 가지
 *   1. 콘텐츠 생성 완료 여부          — 여기 오면 완료
 *   2. 기본 코드 검사 결과            — codeGatesPassed (hardGates 전부 true)
 *   3. 품질 루프 실행 여부            — qualityLoopExecuted
 *   4. 품질 루프 결과                 — NOT_RUN · CONVERGED · NOT_CONVERGED · ERROR
 *   5. 발행 허용 여부                 — publishStatus (OFF 는 참고 판정이라 막지 않는다 — v3.8.747 그대로)
 *   6. 실제 게시 결과                 — 장부의 publishAttempts (여기서는 모른다)
 *
 * ## 바꾸지 않는 것
 * publishDecision(AUTO_PUBLISH/MANUAL_REVIEW)·qualityConverged 의 계산과 발행 창구의 동작은 그대로다.
 * 바뀌는 것은 **이름표**(FINAL 단계 문자열·로그·장부 필드)뿐이다. 루프를 켜지도, 호출을 늘리지도 않는다.
 * 오류·타임아웃은 PASS 로 바꾸지 않는다 — ERROR 로 남고 발행 결정은 기존대로 MANUAL_REVIEW 다.
 */

export type QualityLoopOutcome = 'NOT_RUN' | 'CONVERGED' | 'NOT_CONVERGED' | 'ERROR';
export type PublishStatus = 'PUBLISH_ALLOWED' | 'PUBLISH_ALLOWED_ADVISORY' | 'PUBLISH_HELD';
export type FinalStage = 'QUALITY_CONVERGED' | 'GATES_PASSED_LOOP_NOT_RUN' | 'MANUAL_REVIEW';

export interface QualityStatusInput {
  /** payload.qualityLoop === true || QUALITY_LOOP=1 */
  qualityLoopOn: boolean;
  /** 루프가 실제로 돌 수 있는 모드였나(쇼핑·패러프레이즈는 켜도 안 돈다) */
  loopEligible: boolean;
  critiqueReport: { converged?: boolean; loopError?: boolean; manualReviewReason?: string } | null;
  hardGatesAllPass: boolean;
  qualityConverged: boolean;
  publishDecision: 'AUTO_PUBLISH' | 'MANUAL_REVIEW';
  manualReviewReason?: string;
}

export interface QualityStatus {
  codeGatesPassed: boolean;
  qualityLoopExecuted: boolean;
  qualityLoopOutcome: QualityLoopOutcome;
  publishStatus: PublishStatus;
  finalStage: FinalStage;
  /** 사람이 읽는 한 줄 — 로그·장부에 같은 문장이 간다 */
  label: string;
}

function loopOutcome(input: QualityStatusInput): { executed: boolean; outcome: QualityLoopOutcome } {
  if (!input.qualityLoopOn || !input.loopEligible) return { executed: false, outcome: 'NOT_RUN' };
  const r = input.critiqueReport;
  if (!r) return { executed: false, outcome: 'NOT_RUN' };
  if (r.loopError === true) return { executed: true, outcome: 'ERROR' };
  return { executed: true, outcome: r.converged === true ? 'CONVERGED' : 'NOT_CONVERGED' };
}

const OUTCOME_KO: Record<QualityLoopOutcome, string> = {
  NOT_RUN: '미실행',
  CONVERGED: '수렴(더 고칠 것 없음)',
  NOT_CONVERGED: '미수렴',
  ERROR: '오류(통과 아님)',
};

export function summarizeQualityStatus(input: QualityStatusInput): QualityStatus {
  const { executed, outcome } = loopOutcome(input);
  const codeGatesPassed = input.hardGatesAllPass === true;
  const publishStatus: PublishStatus = input.publishDecision === 'AUTO_PUBLISH'
    ? (input.qualityLoopOn ? 'PUBLISH_ALLOWED' : 'PUBLISH_ALLOWED_ADVISORY')
    : (input.qualityLoopOn ? 'PUBLISH_HELD' : 'PUBLISH_ALLOWED_ADVISORY');
  const finalStage: FinalStage = !input.qualityConverged
    ? 'MANUAL_REVIEW'
    : (outcome === 'CONVERGED' ? 'QUALITY_CONVERGED' : 'GATES_PASSED_LOOP_NOT_RUN');

  const loopText = executed
    ? `실행 · ${OUTCOME_KO[outcome]}`
    : `미실행(${input.qualityLoopOn ? '이 모드에서는 돌지 않음' : 'QUALITY_LOOP OFF'})`;
  const publishText = publishStatus === 'PUBLISH_ALLOWED'
    ? '발행 허용'
    : publishStatus === 'PUBLISH_HELD'
      ? `발행 보류(MANUAL_REVIEW${input.manualReviewReason ? ` · ${input.manualReviewReason}` : ''})`
      : `발행 허용(참고 판정 · 루프 OFF${input.publishDecision === 'MANUAL_REVIEW' && input.manualReviewReason ? ` · 관문 참고: ${input.manualReviewReason}` : ''})`;

  return {
    codeGatesPassed,
    qualityLoopExecuted: executed,
    qualityLoopOutcome: outcome,
    publishStatus,
    finalStage,
    label: `기본 코드 검사: ${codeGatesPassed ? '통과' : '미통과'} · 추가 품질 검수(비평·수정 루프): ${loopText} · 발행 상태: ${publishText}`,
  };
}
