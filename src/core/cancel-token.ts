/**
 * 작업 중지 (v3.8.414)
 *
 * 사용자 보고(2026-08-02): "작업중지 버튼 눌렀는데 중지가 안 돼요"
 *
 * 원인 — 취소 기능이 **아예 없었다.**
 *   화면은 cancel-task IPC 를 보내고 "🛑 작업 중지 요청을 보냈습니다" 알림까지 띄운다.
 *   그런데 main 프로세스에 그 메시지를 받는 핸들러가 없다. 메시지가 허공으로 간다.
 *   모달만 사라지고 백엔드는 209초짜리 파이프라인을 끝까지 돈다.
 *   사용자는 "껐는데 왜 계속 돌지?" 를 겪는다.
 *
 * 이 프로젝트에서 '있는 줄 알았는데 배선이 없던' 다섯 번째 사고다.
 *
 * 설계 — 일부러 단순하게:
 *   한 번에 글 하나만 만든다. 그래서 전역 플래그 하나로 충분하다.
 *   대신 **세대 번호(runId)** 를 둬서, 이전 작업의 늦은 취소가
 *   새로 시작한 작업을 죽이지 않게 한다.
 */

/** 취소된 작업임을 알리는 오류 — 일반 실패와 구분해서 다뤄야 한다. */
export class CanceledError extends Error {
  readonly canceled = true;

  constructor(where: string) {
    super(`작업이 중지되었습니다 (${where})`);
    this.name = 'CanceledError';
  }
}

let canceledRunId = 0;
let currentRunId = 0;
// v3.8.536: 즉시 중지용 — run 세대마다 새 컨트롤러. 중지 순간 abort 가 퍼진다.
let abortController: AbortController | null = null;

/** 새 작업을 시작한다. 이전 취소 요청은 여기서 무효가 된다. */
export function beginRun(): number {
  currentRunId += 1;
  abortController = new AbortController(); // v3.8.536: 이 작업 전용 비상 브레이크
  return currentRunId;
}

/**
 * 지금 도는 작업을 중지해달라고 표시한다.
 *
 * 도는 작업이 없으면 아무 일도 하지 않는다 —
 * 그래야 "중지 눌러두면 다음 작업도 안 돈다" 같은 사고가 없다.
 */
export function requestCancel(): boolean {
  if (currentRunId === 0 || canceledRunId === currentRunId) return false;
  canceledRunId = currentRunId;
  // v3.8.536: 검문소 방식만으론 "이미 굴러가는 60~180초 호출"이 안 멈췄다
  // (사장님: "칼같이 바로 중지되게 못하니"). abort 를 쏘면 cancelRace/HTTP signal 이 즉시 반응한다.
  try { abortController?.abort(); } catch { /* abort 실패가 중지 표시를 막으면 안 된다 */ }
  return true;
}

/** 지금 작업이 중지 요청을 받았는가. */
export function isCanceled(): boolean {
  return currentRunId !== 0 && canceledRunId === currentRunId;
}

/** 작업이 끝났음을 알린다(성공·실패 무관). */
export function endRun(): void {
  currentRunId = 0;
  canceledRunId = 0;
  abortController = null;
}

/**
 * 중지 요청이 있으면 여기서 멈춘다.
 *
 * @param where 어디까지 갔다가 멈췄는지 — 로그에 남아 사용자가 상황을 안다.
 */
export function throwIfCanceled(where: string): void {
  if (isCanceled()) throw new CanceledError(where);
}

/** 이 오류가 '사용자가 중지시킨 것'인가 — 실패로 보고하면 안 된다. */
export function isCancellation(error: unknown): boolean {
  return !!error && ((error as any).canceled === true || (error as any).name === 'CanceledError');
}

/**
 * 진행 중 HTTP 요청에 꽂을 취소 신호 (v3.8.536).
 * 도는 작업이 없으면 null — 신호 없이도 요청은 정상 동작해야 한다.
 */
export function getCancelSignal(): AbortSignal | null {
  return currentRunId !== 0 && abortController ? abortController.signal : null;
}

/**
 * 긴 대기(Promise.race)에 끼워 넣는 취소 레이스 (v3.8.536).
 *
 * 중지 버튼을 누르는 순간 CanceledError 로 reject 되어, 이미 굴러가는
 * 60~180초 LLM 대기에서 즉시 탈출한다. 도는 작업이 없으면 영원히
 * 대기하는 프로미스를 준다 — race 의 다른 다리가 이긴다.
 *
 * 레이스가 먼저 끝난 뒤 늦게 취소가 와도 unhandledRejection 이 되지 않게
 * 자체 catch 를 미리 붙여 둔다 (race 쪽 핸들러와 별개로 rejection 을 소화).
 */
export function cancelRace(where: string): Promise<never> {
  if (currentRunId === 0 || !abortController) return new Promise<never>(() => { /* 영원히 대기 */ });
  const signal = abortController.signal;
  const p = new Promise<never>((_, reject) => {
    const fire = () => reject(new CanceledError(where));
    if (signal.aborted) fire();
    else signal.addEventListener('abort', fire, { once: true });
  });
  p.catch(() => { /* 늦은 취소의 unhandledRejection 방지 */ });
  return p;
}
