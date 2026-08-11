/**
 * 🕐 근거 장부와 본문의 시점이 어긋났는지 본다 (v3.8.479 · 4번)
 *
 * ## 잡으려는 사고
 * 실측(2026-08-11): "2026 부산 청년 게임개발자 정착지원사업" 글이
 * **본문은 2026년이라고 말하는데 근거는 전부 2024년 자료**였다.
 *   · "임차보증금 이자와 월세의 최대 50%"  ← 2024 조건 (2026 은 월세만)
 *   · "선정일로부터 2주 이내 임차계약"      ← 2024 조건 (2026 은 협약일 1개월 내 전입)
 *
 * v3.8.479 의 날짜 라벨(1·2번)로 모델에게 시점을 알려줬지만, 그건 **부탁**이다.
 * 모델이 안 지키거나 애초에 최신 자료가 재료에 없으면 그대로 나간다.
 * 여기서는 나간 결과를 **측정**한다 — 부탁이 아니라 확인이다.
 *
 * ## 무엇을 하는가
 * 근거 장부에 박힌 `[YYYY-MM-DD 작성]` 라벨을 다시 읽어,
 *   · 자료가 대부분 오래됐는지
 *   · 본문이 올해 기준이라고 말하면서 올해 자료가 하나도 없는지
 * 를 본다. **발행은 막지 않는다** — 이 앱 원칙이다. 로그로 알린다.
 */

import { monthsBetween, STALE_AFTER_MONTHS } from './source-freshness';

/** 장부에서 날짜 라벨을 다시 읽는다 — 크롤러가 붙인 그 형식이다 */
export function extractSourceDates(ledger: string): string[] {
  const dates: string[] = [];
  const re = /\[(\d{4}-\d{2}-\d{2})\s*작성/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(ledger || ''))) !== null) dates.push(m[1]!);
  return dates;
}

/** 본문이 "올해 기준"이라고 말하고 있는가 */
export function claimsYear(bodyText: string, year: number): boolean {
  return new RegExp(`${year}\\s*년`).test(String(bodyText || ''));
}

export interface FreshnessAudit {
  /** 날짜를 아는 자료 수 */
  datedSources: number;
  /** 그중 오래된(12개월 이상) 자료 수 */
  staleSources: number;
  /** 12개월 이내 자료가 하나라도 있는가 */
  hasRecentSource: boolean;
  warnings: string[];
}

/**
 * 장부와 본문의 시점 정합성을 본다. 절대 던지지 않는다.
 */
export function auditFreshness(
  ledger: string,
  bodyText: string,
  now: Date = new Date(),
): FreshnessAudit {
  const empty: FreshnessAudit = { datedSources: 0, staleSources: 0, hasRecentSource: false, warnings: [] };
  try {
    const dates = extractSourceDates(ledger);
    if (dates.length === 0) return empty;

    const staleSources = dates.filter((d) => monthsBetween(d, now) >= STALE_AFTER_MONTHS).length;
    const hasRecentSource = staleSources < dates.length;
    const warnings: string[] = [];
    const currentYear = now.getUTCFullYear();

    /**
     * 제일 위험한 조합 — 본문은 올해라고 말하는데 올해치 근거가 하나도 없다.
     * 사용자가 겪은 사고가 정확히 이 모양이었다.
     */
    if (!hasRecentSource && claimsYear(bodyText, currentYear)) {
      warnings.push(
        `본문은 ${currentYear}년 기준이라고 말하는데 근거 자료 ${dates.length}건이 모두 1년 이상 된 것입니다 `
        + `— 작년 조건을 올해 것으로 쓰고 있을 수 있습니다. 발행 전에 최신 공고를 확인하세요`,
      );
    } else if (staleSources === dates.length) {
      warnings.push(
        `근거 자료 ${dates.length}건이 모두 1년 이상 된 것입니다 — 제도·금액이 바뀌었을 수 있습니다`,
      );
    } else if (staleSources > 0 && staleSources / dates.length >= 0.7) {
      warnings.push(
        `근거 자료 ${dates.length}건 중 ${staleSources}건이 1년 이상 된 것입니다 — 최신 조건과 섞이지 않았는지 확인하세요`,
      );
    }

    return { datedSources: dates.length, staleSources, hasRecentSource, warnings };
  } catch {
    return empty;
  }
}
