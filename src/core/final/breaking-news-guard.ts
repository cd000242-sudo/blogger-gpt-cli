/**
 * 📰 속보 관문 — 같은 이름의 옛 사건과 헷갈리지 않게 한다 (v3.8.633)
 *
 * ## 왜 만들었나
 * 사장님 실제 사고(2026-09-04): 「티빙 개인정보 유출」이 터진 지 10분 만에
 * 그 키워드로 글을 돌렸더니 **작년 티빙 유출 사건 내용이 나왔다.**
 *
 * 원인은 모델이 아니라 재료다. 같은 이름의 과거 사건이 있으면:
 *   · 옛 글은 색인이 오래 쌓여 **검색에서 더 많이·더 위에 잡힌다**
 *   · 터진 지 10분이면 새 글은 거의 없다 — 블로그·웹 문서는 사실상 전부 옛 사건이다
 *   · 기존 신선도 장치는 STALE_AFTER_MONTHS = 12 라 **11개월 전 사건도 "신선"** 이다
 *
 * 즉 "낡았는가" 를 재는 눈은 있었지만 **"다른 사건인가"** 를 보는 눈이 없었다.
 *
 * ## 무엇을 하나
 *   ① 지금 터진 일인가 — 최근 기사가 몰려 있으면 속보로 본다
 *   ② 사건의 시각을 정한다 — 그 몰린 구간의 시작
 *   ③ 그보다 오래된 근거를 걷어낸다 — 옛 사건 자료다
 *   ④ 남은 옛 자료가 있으면 **경고 문구로 못박는다** —
 *      "같은 이름의 과거 사건이 있다. 그 수치를 쓰지 마라."
 *
 * ## 원칙
 * 판단이 안 서면 아무것도 안 한다. 속보가 아닌 평범한 주제까지 옛 자료를
 * 걷어내면 근거가 텅 비어 오히려 글이 얕아진다.
 */

export interface NewsLike {
  title?: string;
  description?: string;
  /** 네이버 뉴스가 주는 RFC822 문자열 */
  pubDate?: string;
  /** 네이버 블로그가 주는 YYYYMMDD */
  postdate?: string;
  link?: string;
}

/** 속보로 보려면 이 시간 안에 기사가 몰려 있어야 한다 */
const BURST_WINDOW_HOURS = 48;

/** 그 창 안에 이만큼은 있어야 "터진 일" 로 본다 — 한두 건은 우연이다 */
const BURST_MIN_ARTICLES = 3;

/** 사건 시각보다 이만큼 앞선 자료는 옛 사건으로 본다 (취재 선행분을 살릴 여유) */
const PRE_EVENT_MARGIN_HOURS = 72;

const HOUR = 60 * 60 * 1000;

/**
 * 발행 시각을 밀리초로. 못 읽으면 0.
 *
 * 갈래마다 날짜 모양이 다르다:
 *   뉴스   pubDate  = RFC822 ("Thu, 04 Sep 2026 14:01:00 +0900")
 *   블로그 postdate = YYYYMMDD ("20260904")
 * 블로그를 빠뜨리면 정작 문제의 원인을 안 거르게 된다 —
 * 「티빙」 사고에서 옛 사건 글이 잡힌 곳이 바로 블로그였다.
 */
export function pubTime(item: NewsLike): number {
  const rfc = Date.parse(String(item?.pubDate || ''));
  if (Number.isFinite(rfc)) return rfc;

  const compact = String((item as any)?.postdate || '').trim();
  if (/^\d{8}$/.test(compact)) {
    const y = Number(compact.slice(0, 4));
    const m = Number(compact.slice(4, 6));
    const d = Number(compact.slice(6, 8));
    const t = new Date(y, m - 1, d).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

export interface BreakingEvent {
  /** 지금 터진 일인가 */
  isBreaking: boolean;
  /** 사건이 시작된 것으로 보는 시각 (밀리초). 속보가 아니면 0 */
  eventStartMs: number;
  /** 그 창 안의 기사 수 */
  burstCount: number;
  /** 사건보다 오래된 기사 수 — 같은 이름의 옛 사건 신호 */
  olderCount: number;
  /** 사람이 읽을 한 줄 */
  note: string;
}

/**
 * 기사 목록만 보고 "지금 터진 일인가" 를 판정한다.
 *
 * 날짜를 못 읽은 기사는 판정에서 뺀다 — 0 으로 치면 전부 옛것이 되어
 * 멀쩡한 주제가 속보로 오인된다.
 */
/**
 * 몰린 구간과 그 앞 기사 사이에 이만큼 빈 시간이 있어야 **별개의 사건**으로 본다.
 *
 * 이걸 안 보면 매일 기사가 나오는 주제(국민연금·부동산·환율)가 전부 속보가 된다 —
 * 48시간 안에 기사 3건은 그런 주제에서 늘 참이기 때문이다. 그러면 평범한 글에서도
 * 옛 자료를 걷어내 근거가 얕아진다. 터진 일의 특징은 "많다" 가 아니라
 * **"그전에는 조용했다"** 이다.
 */
const QUIET_GAP_DAYS = 5;

export function detectBreakingEvent(items: NewsLike[], now: Date = new Date()): BreakingEvent {
  const times = (items || []).map(pubTime).filter((t) => t > 0).sort((a, b) => b - a);
  if (times.length === 0) {
    return { isBreaking: false, eventStartMs: 0, burstCount: 0, olderCount: 0, note: '기사 날짜를 읽지 못해 판정하지 않았습니다' };
  }

  const nowMs = now.getTime();
  const cutoff = nowMs - BURST_WINDOW_HOURS * HOUR;
  const burst = times.filter((t) => t >= cutoff);

  if (burst.length < BURST_MIN_ARTICLES) {
    return {
      isBreaking: false,
      eventStartMs: 0,
      burstCount: burst.length,
      olderCount: times.length - burst.length,
      note: `최근 ${BURST_WINDOW_HOURS}시간 기사 ${burst.length}건 — 속보로 보지 않습니다`,
    };
  }

  // 몰린 구간의 **가장 이른** 기사를 사건 시작으로 본다
  const eventStartMs = Math.min(...burst);
  const before = times.filter((t) => t < eventStartMs);

  /**
   * 그전이 조용했는가. 앞선 기사가 아예 없으면(전부 최근) 새 주제이므로 속보로 본다.
   */
  const gapDays = before.length === 0
    ? Infinity
    : (eventStartMs - Math.max(...before)) / (24 * HOUR);

  if (gapDays < QUIET_GAP_DAYS) {
    return {
      isBreaking: false,
      eventStartMs: 0,
      burstCount: burst.length,
      olderCount: before.length,
      note: `기사가 꾸준히 나오는 주제입니다 (직전 기사와 ${gapDays.toFixed(1)}일 간격) — 속보로 보지 않습니다`,
    };
  }

  const older = times.filter((t) => t < eventStartMs - PRE_EVENT_MARGIN_HOURS * HOUR).length;

  return {
    isBreaking: true,
    eventStartMs,
    burstCount: burst.length,
    olderCount: older,
    note: older > 0
      ? `속보입니다 (최근 기사 ${burst.length}건, 그전 ${gapDays === Infinity ? '기사 없음' : gapDays.toFixed(0) + '일 조용'}). ⚠️ 같은 이름의 과거 자료가 ${older}건 섞여 있습니다`
      : `속보입니다 (최근 기사 ${burst.length}건)`,
  };
}

/**
 * 사건보다 오래된 자료를 걷어낸다.
 *
 * 날짜를 못 읽은 항목은 **남긴다.** 상시 안내 문서가 대부분이라 낡았다고 볼
 * 근거가 없고, 지워 버리면 근거가 텅 빈다.
 */
/**
 * 이만큼 넘게 걷어내야 한다면 **아무것도 걷어내지 않는다.**
 *
 * 왜 필요한가: 상시 주제(「개인정보 유출 대처법」)를 쓰는데 마침 같은 분야에서
 * 사건이 터져 있으면, 뉴스는 급증하고 그전은 조용해서 속보로 판정된다.
 * 그러면 오래됐지만 쓸모 있는 안내 글이 전부 걸러져 **근거가 텅 빈다** —
 * 옛 사건을 막으려다 글을 더 얕게 만드는 셈이다.
 *
 * 그런 경우에는 걷어내지 않고 **못박음만** 싣는다. 프롬프트로 알려 주는 것이
 * 근거를 굶기는 것보다 안전하다.
 */
const MAX_DROP_RATIO = 0.5;

export function dropPreEventSources<T extends NewsLike>(
  items: T[],
  event: BreakingEvent,
): { kept: T[]; dropped: number; skippedReason?: string } {
  const all = items || [];
  if (!event.isBreaking || !event.eventStartMs) return { kept: all, dropped: 0 };

  const floor = event.eventStartMs - PRE_EVENT_MARGIN_HOURS * HOUR;
  const kept: T[] = [];
  const removed: T[] = [];
  for (const item of all) {
    const t = pubTime(item);
    if (t > 0 && t < floor) { removed.push(item); continue; }
    kept.push(item);
  }

  if (all.length > 0 && removed.length / all.length > MAX_DROP_RATIO) {
    return {
      kept: all,
      dropped: 0,
      skippedReason: `옛 자료가 ${removed.length}/${all.length} 건이라 걷어내면 근거가 비어 그대로 둡니다 (못박음만 싣습니다)`,
    };
  }

  return { kept, dropped: removed.length };
}

/** 사건 날짜를 한국식으로 */
function korDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 프롬프트에 실을 못박음.
 *
 * "최신 정보를 써라" 같은 말로는 안 된다 — 모델은 자기가 최신을 쓰고 있다고
 * 믿는다. **같은 이름의 다른 사건이 있다**는 사실을 알려 줘야 구분한다.
 */
export function buildBreakingDirective(event: BreakingEvent, keyword: string): string {
  if (!event.isBreaking) return '';

  const lines: string[] = [
    '',
    '## ⏱️ 이 글은 지금 터진 일을 다룹니다',
    '',
    `**사건 시점**: ${korDate(event.eventStartMs)} (최근 기사 ${event.burstCount}건 확인)`,
    `**주제**: ${keyword}`,
    '',
  ];

  if (event.olderCount > 0) {
    lines.push(
      `⚠️ **같은 이름의 과거 사건 자료가 ${event.olderCount}건 검색됩니다.**`,
      '',
      '   검색에서는 오래된 글이 색인이 쌓여 더 위에 잡힙니다. 그래서 그대로 쓰면',
      '   **지난 사건을 이번 일인 것처럼** 쓰게 됩니다. 실제로 그런 사고가 있었습니다.',
      '',
      '   지켜야 할 것:',
      `   · 이번 사건은 ${korDate(event.eventStartMs)}에 알려진 건입니다. 그 이전 자료의`,
      '     **피해 규모·발표 내용·수치를 이번 것으로 옮겨 적지 마세요.**',
      '   · 과거에 비슷한 일이 있었다면 "과거에도 ○○년에 유사한 사건이 있었다" 처럼',
      '     **연도를 밝혀 따로** 씁니다. 섞지 않습니다.',
      '   · 어느 사건의 수치인지 확실하지 않으면 **그 수치를 쓰지 않습니다.**',
      '',
    );
  }

  lines.push(
    '📌 **터진 지 얼마 안 된 일이라 확정되지 않은 것이 많습니다.**',
    '   · 조사 중인 사안은 "확인됐다" 가 아니라 "발표했다 · 밝혔다" 로 씁니다.',
    '   · 아직 안 나온 정보는 "현재까지 공개되지 않았다" 고 적습니다. 추측으로 채우지 않습니다.',
    '',
  );

  return lines.join('\n');
}
