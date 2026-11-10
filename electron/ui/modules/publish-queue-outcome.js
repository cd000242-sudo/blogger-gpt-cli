// publish-queue-outcome.js — pure helpers for the continuous-publish loop (no DOM, no window).
//
// Why this exists (2026-11-10 field case): the queue summary said "중지됨: 완료 0개 · 실패 0개 · 남은 4개 100%"
// with a "일부 실패" label and no reason, because the label came from a /실패/ word test on the message and
// nothing recorded who asked for the stop. These helpers make the status explicit and the reason visible.

/** Plain "N분 M초" text. */
export function formatElapsedKo(ms) {
  const sec = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

const STOP_SOURCE_LABEL = {
  'stop-button': '연속발행 중지 버튼',
  'mini-bar-button': '진행 막대의 ⏹ 버튼',
  api: '프로그램 호출(__publishQueue.stop)',
};

/** Who asked the queue to stop, and how long after it started. Never empty: an unknown origin is said out loud. */
export function describeStopReason(info, startedAt) {
  const label = info && STOP_SOURCE_LABEL[info.source];
  const hasTimes = info && Number.isFinite(info.at) && Number.isFinite(startedAt);
  const when = hasTimes ? ` (시작 ${formatElapsedKo(info.at - startedAt)} 뒤)` : '';
  return label ? `중지 요청: ${label}${when}` : `중지 요청: 출처를 알 수 없는 중지 신호${when}`;
}

/** Final status + message of a queue run. Status is decided from the counts, never from words in the text. */
export function summarizeQueueOutcome({ stopped, stopReason, successCount, failedCount, remainingCount, total }) {
  if (stopped) {
    const reason = stopReason ? ` — ${stopReason}` : '';
    return {
      status: 'stopped',
      message: `중지됨: 완료 ${successCount}개 · 실패 ${failedCount}개 · 남은 ${remainingCount}개${reason}`,
    };
  }
  if (failedCount > 0) {
    return { status: 'error', message: `처리 완료: 성공 ${successCount}개 · 실패 ${failedCount}개` };
  }
  return { status: 'success', message: `전체 ${total}개 순차발행 완료` };
}

/** Mini bar / toast label for a status. */
export function queueStatusLabel(status) {
  if (status === 'error') return '⚠️ 일부 실패';
  if (status === 'stopped') return '⏹ 중지됨';
  if (status === 'success') return '✅ 발행 완료';
  return '연속발행 진행 중…';
}

/** Item error text for the log: already_running means an earlier job was still winding down. */
export function describeItemError(errorText) {
  if (String(errorText || '') === 'already_running') {
    return '앞 작업이 아직 끝나지 않아 시작하지 못했습니다 (already_running)';
  }
  return errorText;
}

/**
 * Wait until an earlier posting job (for example one the user stopped a moment ago) has released its lock, so the
 * next item does not fail instantly with already_running and then burn a whole interval doing nothing.
 * Everything time-related is injected so the loop is testable without real timers.
 * Returns { state: 'free' | 'released' | 'stopped' | 'timeout', waitedMs }.
 */
export async function waitForPreviousRunToFinish({
  isLocked, isStopped, now, sleep, maxMs, pollMs = 1000, logEveryMs = 30000, onWait,
}) {
  if (!isLocked()) return { state: 'free', waitedMs: 0 };
  const startedAt = now();
  let lastLogAt = -Infinity;
  while (isLocked()) {
    if (isStopped()) return { state: 'stopped', waitedMs: now() - startedAt };
    const waited = now() - startedAt;
    if (waited >= maxMs) return { state: 'timeout', waitedMs: waited };
    if (onWait && waited - lastLogAt >= logEveryMs) {
      lastLogAt = waited;
      onWait(waited);
    }
    await sleep(pollMs);
  }
  return { state: 'released', waitedMs: now() - startedAt };
}
