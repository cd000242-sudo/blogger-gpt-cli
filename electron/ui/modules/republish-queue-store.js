/**
 * 💾 v3.8.779 — 재발행 대기열(localStorage 'pendingRepublishQueue')의 "발행 성공 → 대기열에서 뺀다" 공용 규칙.
 *
 * 전에는 재발행 버튼(preview.js)만 성공 뒤 그 자리에서 filter 로 뺐다. 에이전트 글이 보류돼 대기열에 담긴 뒤
 * "검토 후 강제 발행"으로 성공해도 대기열 항목은 남아, 대기열에서 다시 누르면 같은 글이 두 번 발행될 수 있었다.
 * 두 경로가 같은 함수를 쓴다(대기열 정리를 복사하지 않는다).
 *
 * 규칙:
 *   · 찾는 열쇠는 안정 ID 뿐 — 대기열 항목 id, 에이전트 작업 ID(agentJobId). 제목·본문 문자열로 찾지 않는다
 *   · 발행 성공이 확인된 뒤에만 부른다(부르는 쪽 책임). 실패·취소·불확실하면 부르지 않는다 = 항목 유지
 *   · 뺀 기록은 'republishQueueResolutions' 에 남긴다(최근 50개) — 대기열에서 빠져도 무슨 일이 있었는지 남는다
 *
 * import 없이 쓴다(테스트가 소스를 그대로 실행한다 · preview.js ↔ posting.js 순환을 만들지 않는다).
 */

export const REPUBLISH_QUEUE_KEY = 'pendingRepublishQueue';
export const REPUBLISH_RESOLUTIONS_KEY = 'republishQueueResolutions';
const MAX_RESOLUTIONS = 50;

const storageOf = (storage) => storage || (typeof localStorage !== 'undefined' ? localStorage : null);

export function readRepublishQueue(storage) {
  try {
    const parsed = JSON.parse(storageOf(storage)?.getItem(REPUBLISH_QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * v3.8.780 — 에이전트 글을 대기열에 담을 때의 payload.
 * 기존 발행 payload(userRequest 등)를 그대로 두고, 에이전트 표시 `codexWorkshop`(applyCodexResult 가 붙이는 바로 그 필드)와
 * 작업 ID 를 보존한다. 이 표시가 빠지면 대기열 [재발행] 이 발행 창구의 에이전트 요구 재검사(777)를 건너뛴다.
 * forcePublish 는 싣지 않는다 — 대기열에 남은 값이 나중 재발행에서 쓰이면 안 된다.
 */
export function agentQueuePayload(basePayload, { agentJobId } = {}) {
  const { forcePublish: _droppedForce, ...rest } = basePayload || {};
  return { ...rest, codexWorkshop: true, ...(agentJobId ? { agentJobId } : {}) };
}

/**
 * v3.8.780 — 대기열 항목 → 재발행 요청 payload. 저장된 값을 그대로 쓰되 forcePublish 는 버린다:
 * [🚀 재발행] 은 사람의 강제 발행 승인이 아니다(778 — 승인은 "검토 후 강제 발행" 확인창에서만).
 * 에이전트 표시를 제목·본문으로 추측해 붙이지 않는다(표시 없는 옛 항목은 그대로 둔다).
 */
export function republishPayloadOf(item) {
  const { forcePublish: _droppedForce, ...rest } = item?.payload || {};
  return rest;
}

/** 대기열 항목 id 로 — 재발행 버튼이 쓴다 */
export const byRepublishItemId = (id) => (item) => !!id && item?.id === id;

/** 에이전트 작업 ID 로 — 강제 발행·에이전트 글 발행 성공이 쓴다. 빈 ID 는 아무것도 잡지 않는다 */
export const byAgentJobId = (jobId) => (item) => !!jobId && item?.agentJobId === jobId;

/**
 * 발행 창구(publishToPlatform)가 한 발행의 결과를 받은 뒤 부른다 — 성공이 확인된 에이전트 작업만 대기열에서 뺀다.
 * 성공 판정은 publishToPlatform 과 같다(ok 또는 success). 실패·취소·불확실(결과 없음)·작업 ID 없음이면 아무것도 안 한다.
 */
export function settleRepublishAfterPublish({ result, agentJobId, forced, storage } = {}) {
  const succeeded = !!(result && (result.ok === true || result.success === true));
  if (!succeeded || !agentJobId) return [];
  return resolveRepublishItems(byAgentJobId(agentJobId), {
    resolution: forced === true ? 'PUBLISHED_BY_FORCE_OVERRIDE' : 'PUBLISHED',
    url: result.url || '',
    storage,
  });
}

/**
 * 발행이 끝난 항목을 대기열에서 뺀다. 뺀 항목을 돌려준다(없으면 빈 배열 — 대기열은 그대로).
 * @param {(item: object) => boolean} match 안정 ID 매처(byRepublishItemId · byAgentJobId)
 * @param {{ resolution: string, url?: string, storage?: Storage, at?: string }} info
 */
export function resolveRepublishItems(match, info = {}) {
  const storage = storageOf(info.storage);
  if (!storage || typeof match !== 'function') return [];
  const queue = readRepublishQueue(storage);
  const removed = queue.filter((item) => match(item));
  if (!removed.length) return [];
  try {
    storage.setItem(REPUBLISH_QUEUE_KEY, JSON.stringify(queue.filter((item) => !match(item))));
    const at = info.at || new Date().toISOString();
    let log = [];
    try { const parsed = JSON.parse(storage.getItem(REPUBLISH_RESOLUTIONS_KEY) || '[]'); if (Array.isArray(parsed)) log = parsed; } catch { log = []; }
    const next = [...log, ...removed.map((item) => ({
      itemId: item.id || '',
      ...(item.agentJobId ? { agentJobId: item.agentJobId } : {}),
      ...(item.runId ? { runId: item.runId } : {}),
      resolution: String(info.resolution || 'PUBLISHED'),
      ...(info.url ? { url: String(info.url) } : {}),
      at,
    }))].slice(-MAX_RESOLUTIONS);
    storage.setItem(REPUBLISH_RESOLUTIONS_KEY, JSON.stringify(next));
  } catch {
    return [];
  }
  return removed;
}
