/**
 * 🕘 서비스 기준 시각 — **Asia/Seoul 하나로 통일한다.** (v3.8.734)
 *
 * `new Date().toISOString().slice(0, 10)` 은 UTC 날짜다. 한국에서는 매일 00~09시에 **어제**가 나온다.
 * 실측(2026-09-22 06:38 KST): 본문 프롬프트에 "오늘 날짜: 2026-09-21" 이 들어갔다.
 * 그 줄 바로 아래가 "오늘 이전에 마감된 일정은 언급하지 마세요" 라서, 하루가 밀리면 마감 판단이 틀어진다.
 *
 * 서버·PC 의 시간대 설정과 무관해야 하므로 Intl 로 직접 서울 시각을 뽑는다.
 */

const KST = 'Asia/Seoul';

function partsOf(date: Date): Record<string, string> {
  const out: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** 서울 기준 오늘 — YYYY-MM-DD */
export function kstToday(now: Date = new Date()): string {
  const p = partsOf(now);
  return `${p['year']}-${p['month']}-${p['day']}`;
}

/** 서울 기준 연도 */
export function kstYear(now: Date = new Date()): number {
  return Number(partsOf(now)['year']);
}

/** 서울 기준 월(1~12) */
export function kstMonth(now: Date = new Date()): number {
  return Number(partsOf(now)['month']);
}

/** 서울 기준으로 n일 옮긴 날짜 — 어제(-1)·이번 주 판단에 쓴다 */
export function kstShift(days: number, now: Date = new Date()): string {
  return kstToday(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
}

/**
 * 아무 날짜 표기나 서울 기준 YYYY-MM-DD 로. **못 읽으면 null** — 오늘로 메우지 않는다.
 * 네이버 뉴스 pubDate(RFC822) · 블로그 postdate(YYYYMMDD) · ISO · "2026.09.18" 을 받는다.
 */
export function toKstDate(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const compact = value.match(/^(20\d{2})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const dotted = value.match(/^(20\d{2})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/);
  if (dotted && !/[T:]/.test(value)) {
    return `${dotted[1]}-${String(dotted[2]).padStart(2, '0')}-${String(dotted[3]).padStart(2, '0')}`;
  }
  const t = Date.parse(value);
  return Number.isFinite(t) ? kstToday(new Date(t)) : null;
}
