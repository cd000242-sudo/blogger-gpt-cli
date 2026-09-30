/**
 * 📏 v3.8.774 — 사양값 단위 목록(한 곳). 제목·소제목 권위 · 본문 사실 필터 · 본문 관문 · 최종 표면 내부 대조가 같은 목록·같은 추출기를 쓴다.
 *
 * 실측(BATCH 2 IT a4fc1b): 블로그 E06 "S26 4000mAh · 45W" 가 근거에 들어왔다. 제목·소제목은 mAh·W 를 읽어 막았지만
 * 본문 필터·본문 관문은 %·원·명 만 읽어 같은 틀린 사양이 본문에 남을 수 있었다.
 *
 * 단위의 뜻은 정하지 않는다 — 속성을 누가 정하는지만 나눈다:
 *   · PROPERTY — 단위가 곧 속성(mAh = 배터리 용량 · 인치 = 화면 · GB/TB = 저장 · mm · kg). 곁 낱말이 없어도 같은 속성이다.
 *   · CONTEXT  — 같은 단위가 여러 속성을 뜻한다(W = 충전기 출력 / 기기 입력 · km = 복합 / 도심 / 고속도로 · kWh = 사용량 / 배터리 · Wh · kW).
 *                곁 낱말(속성 창)이 맞아야 같은 주장이고, 다른 속성의 같은 숫자는 근거가 아니다.
 *   · 그 밖(%·원·명 …)은 예전 값 대조 그대로(LEGACY).
 */
import { isLexicalValue } from './value-boundary';

/** 사양 단위 — 긴 것 먼저(kWh 가 Wh·W 보다, mAh 가 …) */
export const SPEC_UNIT_SOURCE = 'mAh|kWh|Wh|kW|W|km|㎞';
const PROPERTY_UNITS = /^(?:mAh|인치|GB|TB|mm|kg)$/;
const CONTEXT_UNITS = /^(?:kWh|Wh|kW|W|km)$/;
export type UnitClass = 'PROPERTY' | 'CONTEXT' | 'LEGACY';

const SPEC_UNIT = new RegExp(`^(?:${SPEC_UNIT_SOURCE})$`);
/** 사양 단위인가(mAh·kWh·Wh·kW·W·km) — 인치·GB 처럼 선택지(17/19인치 · 256/512GB)로 흔히 나란한 단위는 사양 대조에서 뺀다 */
export const isSpecUnit = (unit: string): boolean => SPEC_UNIT.test(unitKey(unit));
export const unitKey =(u: string): string => String(u || '').replace(/\s+/g, '').replace('퍼센트', '%').replace('㎞', 'km');
export function unitClass(unit: string): UnitClass {
  const u = unitKey(unit);
  if (PROPERTY_UNITS.test(u)) return 'PROPERTY';
  if (CONTEXT_UNITS.test(u)) return 'CONTEXT';
  return 'LEGACY';
}

/**
 * 같은 문장의 같은 단위 두 값의 차이인가("복합 501km와 고속도로 447km의 차이는 54km") — 근거 글자에 없어도 한 단계 검산으로 나온 값(DERIVED)이다.
 * 사실 필터·본문 관문이 같이 쓴다. 두 피연산자 자체는 각자 판정받는다.
 */
export function isSpecDifference(sentence: string, value: SpecValue): boolean {
  const others = specValues(sentence).filter((v) => v.unit === value.unit && v.index !== value.index);
  return others.some((a, i) => others.slice(i + 1).some((b) => Math.abs(Math.abs(a.num - b.num) - value.num) < 1e-9));
}

export interface SpecValue { raw: string; value: string; num: number; unit: string; index: number; length: number }
/** 글의 사양값(mAh·kWh·Wh·kW·W·km) — 낱말 경계를 지킨 것만. value 는 쉼표·공백 없는 표기("4300mAh") */
export function specValues(text: string): SpecValue[] {
  const src = String(text || '');
  const out: SpecValue[] = [];
  for (const m of src.matchAll(new RegExp(`(?<![\\d.,])(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?\\s*(${SPEC_UNIT_SOURCE})(?![A-Za-z])`, 'g'))) {
    const at = m.index || 0;
    if (!isLexicalValue(src, at, m[0])) continue;
    const numText = m[0].slice(0, m[0].length - m[2]!.length).replace(/[\s,]/g, '');
    out.push({ raw: m[0], value: `${numText}${unitKey(m[2]!)}`, num: Number(numText), unit: unitKey(m[2]!), index: at, length: m[0].length });
  }
  return out;
}
