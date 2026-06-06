/**
 * Process-wide image generation queue.
 *
 * Image engines are often rate-limited by account/session, not by a single
 * article. Keeping this queue at dispatcher level prevents thumbnail, H2 image,
 * batch image, and continuous publishing jobs from overlapping each other.
 */

export type ImageEnginePacingClass = 'browser' | 'slow' | 'general';

export interface ImageGenerationQueueMeta {
  engine: string;
  label?: string | undefined;
  onLog?: ((msg: string) => void) | undefined;
}

const BROWSER_ENGINE_PATTERN = /(dropshot|imagefx|image-fx|\bflow\b|labs-flow|labsflow|googleflow|browser|playwright)/i;
const SLOW_ENGINE_PATTERN = /(nanobanana|nano-banana|gptimage|gpt-image|deepinfra|leonardo|gemini.*image)/i;

const BROWSER_STABILIZATION_MS = 15_000;
const SLOW_STABILIZATION_MS = 8_000;

const GENERAL_PUBLISH_INTERVAL_MS = 5 * 60_000;
const SLOW_PUBLISH_INTERVAL_MS = 7 * 60_000;
const BROWSER_PUBLISH_INTERVAL_MS = 8 * 60_000;

let queueTail: Promise<unknown> = Promise.resolve();
let queuedCount = 0;
let activeEngine: string | null = null;
let lastCompletedEngine: string | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function classifyImageEngineForPacing(engine: string | undefined | null): ImageEnginePacingClass {
  const raw = String(engine || '').trim().toLowerCase();
  if (!raw || raw === 'none' || raw === 'skip' || raw === 'crawled') return 'general';
  if (BROWSER_ENGINE_PATTERN.test(raw)) return 'browser';
  if (SLOW_ENGINE_PATTERN.test(raw)) return 'slow';
  return 'general';
}

export function getImageEngineStabilizationMs(engine: string | undefined | null): number {
  const cls = classifyImageEngineForPacing(engine);
  if (cls === 'browser') return BROWSER_STABILIZATION_MS;
  if (cls === 'slow') return SLOW_STABILIZATION_MS;
  return 0;
}

export function getImageEnginePublishIntervalFloorMs(engine: string | undefined | null): number {
  const cls = classifyImageEngineForPacing(engine);
  if (cls === 'browser') return BROWSER_PUBLISH_INTERVAL_MS;
  if (cls === 'slow') return SLOW_PUBLISH_INTERVAL_MS;
  return GENERAL_PUBLISH_INTERVAL_MS;
}

export function getPublishIntervalFloorMsForEngines(engines: Array<string | undefined | null>): number {
  const floors = (engines || []).map(getImageEnginePublishIntervalFloorMs);
  return Math.max(GENERAL_PUBLISH_INTERVAL_MS, ...floors);
}

export function describeImageEnginePacing(engine: string | undefined | null): string {
  const cls = classifyImageEngineForPacing(engine);
  if (cls === 'browser') return '브라우저 이미지 엔진';
  if (cls === 'slow') return '느린 이미지 엔진';
  return '일반 이미지 엔진';
}

function getBetweenJobsDelayMs(previousEngine: string | null, currentEngine: string): number {
  if (!previousEngine) return 0;
  return Math.max(
    getImageEngineStabilizationMs(previousEngine),
    getImageEngineStabilizationMs(currentEngine),
  );
}

export async function runImageGenerationQueued<T>(
  meta: ImageGenerationQueueMeta,
  task: () => Promise<T>,
): Promise<T> {
  const engine = String(meta.engine || 'unknown').trim().toLowerCase() || 'unknown';
  const label = meta.label || engine;
  const position = ++queuedCount;

  const run = async (): Promise<T> => {
    queuedCount = Math.max(0, queuedCount - 1);

    if (activeEngine || position > 1) {
      meta.onLog?.(`🧵 이미지 생성 공통 큐 대기 — ${label} (남은 대기 ${queuedCount}개)`);
    }

    const delayMs = getBetweenJobsDelayMs(lastCompletedEngine, engine);
    if (delayMs > 0) {
      const seconds = Math.ceil(delayMs / 1000);
      meta.onLog?.(`⏳ ${describeImageEnginePacing(engine)} 안정화 대기 ${seconds}초`);
      await sleep(delayMs);
    }

    activeEngine = engine;
    try {
      meta.onLog?.(`🧵 이미지 생성 공통 큐 실행 — ${label}`);
      return await task();
    } finally {
      lastCompletedEngine = engine;
      activeEngine = null;
    }
  };

  const next = queueTail.then(run, run);
  queueTail = next.catch(() => undefined);
  return next;
}
