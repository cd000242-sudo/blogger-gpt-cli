/**
 * 🛡️ image-moderation — AI 가 만든 이미지를 글에 넣기 전에 OpenAI moderation 으로 한 번 본다. (사장님 승인 2026-10-10)
 *
 * ## 왜 필요한가
 * v3.8.759: Dropshot 이 "내 작업" 목록의 **남의 썸네일(선정적 사진 포함)** 을 결과로 집어 글에 넣을 뻔했다.
 * 원인은 759 로 막았다. 이건 그래도 뭔가 새어 나올 때를 위한 **두 번째 문**이다 — 엔진이 무엇이든 같은 문을 지난다
 * (`imageDispatcher` 의 tryEngine · pollinations 대체).
 *
 * ## 지키는 것
 * - 걸리면(flagged) 그 그림은 쓰지 않는다. 호출부는 다른 엔진·대체 그림으로 넘어간다 — 글은 멈추지 않는다.
 * - 검사를 **못 하는** 경우(키 없음·시험 모드·HTTP 오류·시간초과·이상한 응답)는 막지 않고 기록만 남긴다.
 *   검사 때문에 발행이 멈추면 안 된다. 키 없음 안내는 한 번만 한다.
 * - 키는 어떤 기록에도 찍지 않는다(응답의 오류 문구도 그대로 옮기지 않는다).
 * - moderation 은 OpenAI 가 무료로 제공한다. 이미지 한 장에 ~1초.
 *   이미지로 판정하는 항목은 sexual · self-harm · violence 계열이다(OpenAI 문서).
 */

export interface ModerationVerdict {
  /** 실제로 검사했는가(false 면 건너뛰었거나 실패 — 이미지는 그대로 쓴다) */
  checked: boolean;
  flagged: boolean;
  /** 걸린 항목 이름(sexual 등) */
  categories: string[];
  /** 건너뛴·실패한 이유(기록용) */
  reason?: string;
}

export interface ModerationOptions {
  env?: Record<string, string | undefined>;
  onLog?: (message: string) => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const ENDPOINT = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';
/** base64 그림은 몇 MB 가 될 수 있다 — 넉넉히, 그래도 글을 오래 붙잡지 않게 */
const DEFAULT_TIMEOUT_MS = 10_000;

let noKeyNoticeShown = false;
/** 테스트용 — 한 번만 하는 안내를 다시 하게 한다 */
export function resetImageModerationNotices(): void { noKeyNoticeShown = false; }

function keyOf(env: Record<string, string | undefined> | undefined): string {
  const k = String(env?.['openaiKey'] || env?.['OPENAI_API_KEY'] || process.env['OPENAI_API_KEY'] || '').trim();
  return k.length >= 10 ? k : '';
}

/** 중지 버튼 신호가 있으면 시간 제한과 묶는다 */
function signalOf(timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cancel = require('./cancel-token').getCancelSignal?.();
    if (cancel && typeof (AbortSignal as unknown as { any?: unknown }).any === 'function') {
      return (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([timeout, cancel]);
    }
  } catch { /* 중지 신호 없음 — 시간 제한만 */ }
  return timeout;
}

/**
 * 걸린 그림을 막을 때 쓰는 오류 문구. `image-error-classifier` 가 **안전 필터**(넘어갈 수 있음)로 읽어야
 * 다른 엔진·대체 그림으로 넘어가고 엄격 모드에서도 발행을 막지 않는다.
 * 숫자를 넣지 않는다 — 점수(0.403 등)가 들어가면 403·429 규칙에 먼저 걸려 엉뚱하게 분류된다.
 */
export function moderationBlockedError(categories: string[]): string {
  const names = categories.map((c) => String(c).replace(/[0-9]/g, '')).filter(Boolean).join(' · ') || 'flagged';
  return `IMAGE_MODERATION_BLOCKED: safety policy — ${names} · 이미지를 넣지 않습니다`;
}

export async function moderateGeneratedImage(imageUrl: string, options: ModerationOptions = {}): Promise<ModerationVerdict> {
  const skip = (reason: string): ModerationVerdict => ({ checked: false, flagged: false, categories: [], reason });
  const url = String(imageUrl || '').trim();
  if (!url) return skip('empty-image');
  if (process.env['NO_LIVE_LLM'] === '1') return skip('no-live-llm');

  const key = keyOf(options.env);
  if (!key) {
    if (!noKeyNoticeShown) {
      noKeyNoticeShown = true;
      const msg = '🛡️ 이미지 안전 검사 생략 — OpenAI 키 없음(설정에 OpenAI 키를 넣으면 AI 이미지를 글에 넣기 전에 선정성 검사를 합니다)';
      options.onLog?.(msg);
      console.log(`[IMG-MODERATION] ${msg}`);
    }
    return skip('no-key');
  }

  const failOpen = (why: string): ModerationVerdict => {
    const msg = `⚠️ 이미지 안전 검사 실패 — 검사 없이 사용 (${why})`;
    options.onLog?.(msg);
    console.warn(`[IMG-MODERATION] ${msg}`);
    return skip(why);
  };

  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let payload: any;
  try {
    const response = await doFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: [{ type: 'image_url', image_url: { url } }] }),
      signal: signalOf(timeoutMs),
    });
    if (!response.ok) {
      // 응답 오류 문구는 옮기지 않는다 — OpenAI 는 잘못된 키를 문구에 일부 되돌려 준다
      await response.body?.cancel().catch(() => undefined);
      return failOpen(`HTTP ${response.status}`);
    }
    try { payload = await response.json(); } catch { return failOpen('응답이 JSON 이 아님'); }
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (/TimeoutError|AbortError/.test(String(err?.name || '')) || /timeout|aborted/i.test(String(err?.message || ''))) return failOpen(`시간초과 ${Math.round(timeoutMs / 1000)}초`);
    return failOpen(`망 오류 ${String(err?.message || e).replace(key, '***').slice(0, 60)}`);
  }

  const first = Array.isArray(payload?.results) ? payload.results[0] : null;
  if (!first || typeof first.flagged !== 'boolean') return failOpen('응답에 판정 없음');
  const categories = Object.entries(first.categories || {}).filter(([, v]) => v === true).map(([k]) => k);
  if (first.flagged) {
    console.warn(`[IMG-MODERATION] 🚫 걸림: ${categories.join(', ') || 'flagged'}`);
    return { checked: true, flagged: true, categories };
  }
  return { checked: true, flagged: false, categories: [] };
}
