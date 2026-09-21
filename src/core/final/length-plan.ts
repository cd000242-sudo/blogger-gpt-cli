/**
 * 📏 분량은 **근거가 정한다.** (v3.8.734)
 *
 * 예전 규칙: 절마다 "(최소 700~1000자)" × 9개 절, H3 마다 "반드시 600~1000자".
 * 감사 실측: 쓸 만한 근거는 6,500자인데 본문은 8,000자를 채워야 했다 — 모자란 만큼은 같은 말을 늘여 채운다.
 * 밋밋한 글의 절반은 여기서 나온다.
 *
 * 이제 Research Packet 에 담긴 **사실의 개수**로 분량 기대치를 정한다.
 *   근거가 많으면 자세히, 적으면 짧고 정확하게. 숫자는 "이만큼 써라"가 아니라 "이 범위를 넘기지 마라"에 가깝다.
 * 패킷이 없는 경로(쇼핑·페러프레이징 등 상품/초안 기반)는 예전 기준을 그대로 쓴다 — 그쪽 근거는 패킷이 아니라 상품 데이터다.
 */

export type EvidenceTier = 'rich' | 'medium' | 'thin' | 'legacy';

export interface LengthPlan {
  tier: EvidenceTier;
  /** 패킷의 사실 줄 수 */
  factLines: number;
  /** 프롬프트에 넣을 분량 안내 */
  rangeText: string;
  /** 이보다 짧으면 "토막"으로 보고 보강을 검토한다 */
  minChars: number;
  minParagraphs: number;
  /** 글 전체 하한(평문) — 절 수 × 이 값, 상한 있음 */
  perSectionFloor: number;
}

const PACKET_HEAD = '[RESEARCH PACKET';

/** 패킷 안의 사실 줄("- …")을 센다. 질문·자동완성 칸은 사실이 아니라 세지 않는다 */
export function countPacketFacts(reference: string): number {
  const text = String(reference || '');
  const start = text.indexOf(PACKET_HEAD);
  if (start < 0) return -1;
  const tail = text.slice(start);
  const end = tail.indexOf('[FACT EVIDENCE');
  const block = end > 0 ? tail.slice(0, end) : tail.slice(0, 9000);
  let counting = true;
  let n = 0;
  for (const line of block.split('\n')) {
    if (line.startsWith('▸ ')) counting = !/검색자가 실제로 물은 것|자동완성/.test(line);
    else if (counting && line.startsWith('- ')) n += 1;
  }
  return n;
}

export function resolveLengthPlan(reference: string, contentMode: string): LengthPlan {
  const heavy = contentMode === 'shopping' || contentMode === 'adsense' || contentMode === 'paraphrasing';
  const factLines = countPacketFacts(reference);
  if (factLines < 0) {
    return heavy
      ? { tier: 'legacy', factLines, rangeText: '800~1500자', minChars: 500, minParagraphs: 4, perSectionFloor: 800 }
      : { tier: 'legacy', factLines, rangeText: '600~1000자', minChars: 500, minParagraphs: 4, perSectionFloor: 800 };
  }
  if (factLines >= 26) return { tier: 'rich', factLines, rangeText: '근거가 충분합니다 — H3 하나에 보통 500~900자', minChars: 380, minParagraphs: 3, perSectionFloor: 700 };
  if (factLines >= 12) return { tier: 'medium', factLines, rangeText: '근거가 보통입니다 — H3 하나에 보통 350~700자', minChars: 260, minParagraphs: 3, perSectionFloor: 500 };
  return { tier: 'thin', factLines, rangeText: '근거가 적습니다 — H3 하나에 200~450자면 충분합니다. 짧고 정확하게', minChars: 150, minParagraphs: 2, perSectionFloor: 320 };
}

/** 프롬프트에 넣을 분량 규칙 한 덩어리 */
export function lengthRuleText(plan: LengthPlan): string {
  if (plan.tier === 'legacy') return `- **각 H3 본문은 반드시 ${plan.rangeText}** 사이의 알찬 내용으로 채우세요.`;
  return [
    `- **분량은 근거가 정합니다.** ${plan.rangeText}.`,
    '  · Research Packet 에 있는 사실을 다 썼으면 그 절은 거기서 끝냅니다. 분량을 채우려고 같은 말을 바꿔 되풀이하지 마세요.',
    '  · 근거가 없는 절은 억지로 늘리지 말고, 판단 기준·절차·확인 경로를 짧게 주고 끝냅니다.',
  ].join('\n');
}
