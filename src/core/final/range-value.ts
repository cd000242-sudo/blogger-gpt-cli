/**
 * 📐 v3.8.760 — 범위 수치 표기(lower~upper unit).
 *
 * 실측(run d7a142): 근거는 "일반형 기준 최대 13.2~14.4%", 원고는 "일반형 최대 13.2%에서 14.4%". 값 검사는 단일 토큰만 봐서
 * "13.2%" 가 근거에 없다고(근거에는 "13.2~" 로 있다) 문장을 지웠다.
 *
 * 범위는 하한·상한·단위의 구조로 비교한다. 하한과 상한이 문서 어딘가에 따로 있다고 범위를 지원하는 것이 아니다 —
 * 같은 문장 안에서 범위 표기(~·∼·-·에서·부터…까지·최소…최대)로 묶여 있어야 한다.
 * 하이픈은 앞뒤가 모두 숫자이고 단위가 따라올 때만 범위다(날짜 2026-09-29 는 단위가 없어 걸리지 않고, 음수 -5% 는 앞에 숫자가 없다).
 */
export interface ValueRange { lower: number; upper: number; unit: string; raw: string }

const NUM = '(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const UNIT = '(%p|퍼센트\\s*포인트|%|퍼센트|만\\s*원|억\\s*원|억|원|개월|시간|일|명|건|회|세|주|km|kg|m|㎡)';
const SEP = '(?:\\s*(?:~|∼|～|〜|-|–|—|에서)\\s*)';
/** 한 문장 안의 범위 표기 — "13.2~14.4%" · "13.2% 에서 14.4%" · "5명부터 10명까지" · "최소 5명 … 최대 10명" */
const RANGE_RES = [
  new RegExp(`(?<![\\d.,])(${NUM})\\s*(?:${UNIT})?${SEP}(${NUM})\\s*${UNIT}`, 'g'),
  new RegExp(`(?<![\\d.,])(${NUM})\\s*${UNIT}\\s*(?:부터|에서)\\s*(${NUM})\\s*${UNIT}\\s*(?:까지|사이)`, 'g'),
  new RegExp(`최소\\s*(${NUM})\\s*${UNIT}[^.。]{0,25}?최대\\s*(${NUM})\\s*${UNIT}`, 'g'),
];

export const normalizeUnit = (u: string): string => String(u || '').replace(/\s+/g, '').replace(/^퍼센트포인트$/, '%p').replace(/^퍼센트$/, '%').replace(/^억$/, '억원');
const num = (s: string) => Number(String(s).replace(/,/g, ''));

/** 문장(태그 없는 글)에서 범위들을 뽑는다. 하한 < 상한 이어야 하고, 두 단위가 다 있으면 같아야 한다 */
export function extractRanges(text: string): ValueRange[] {
  const out: ValueRange[] = [];
  const plain = String(text || '').replace(/<[^>]+>/g, ' ');
  for (const re of RANGE_RES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain)) !== null) {
      // 그룹 배치: [1]=하한 숫자(전체) [2]=하한 정수부 [3]=하한 단위? [4]=상한 숫자 [5]=상한 정수부 [6]=상한 단위  (세 정규식 모두 같은 순서)
      const lowerRaw = m[1]!; const lowerUnit = m[3]; const upperRaw = m[4]!; const upperUnit = m[6]!;
      const unit = normalizeUnit(upperUnit);
      if (lowerUnit && normalizeUnit(lowerUnit) !== unit) continue;
      const lower = num(lowerRaw); const upper = num(upperRaw);
      if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) continue;
      if (/^\d{4}$/.test(lowerRaw) && /^\d{1,2}$/.test(upperRaw) && unit === '일') continue;   // 2026-09-29일 같은 날짜 조각
      out.push({ lower, upper, unit, raw: m[0] });
    }
  }
  return out;
}

export const sameRange = (a: ValueRange, b: ValueRange): boolean => a.unit === b.unit && Math.abs(a.lower - b.lower) < 1e-9 && Math.abs(a.upper - b.upper) < 1e-9;

/** 값 토큰(정규화: "13.2%")이 근거 범위의 하한 또는 상한인가 */
export function isRangeBound(token: string, ranges: ValueRange[]): boolean {
  const m = String(token || '').match(new RegExp(`^(${NUM})\\s*${UNIT}$`));
  if (!m) return false;
  const v = num(m[1]!); const unit = normalizeUnit(m[3]!);
  return ranges.some((r) => r.unit === unit && (Math.abs(r.lower - v) < 1e-9 || Math.abs(r.upper - v) < 1e-9));
}

/** 범위의 두 끝 값을 값 토큰 꼴로 — "13.2%", "14.4%" */
export function boundTokens(r: ValueRange): string[] {
  const fmt = (n: number) => `${n}${r.unit}`;
  return [fmt(r.lower), fmt(r.upper)];
}

const cache = new Map<string, ValueRange[]>();
/** 근거 문맥의 범위 목록 — 같은 문맥은 한 번만 뽑는다(문맥은 검사 내내 같은 문자열이다) */
export function rangesOf(context: string): ValueRange[] {
  const key = `${context.length}:${context.slice(0, 64)}:${context.slice(-64)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ranges = extractRanges(context);
  if (cache.size > 8) cache.clear();
  cache.set(key, ranges);
  return ranges;
}
