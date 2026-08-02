/**
 * 후기에서 '사기 전 걱정거리'를 뽑는다 (v3.8.411)
 *
 * 왜 필요한가 — 사용자 지적(2026-08-02):
 *   생성된 제목: "브리즈 누비아 이동식 에어컨 듀얼덕트 핵심 정리 🔥"
 *   → "핵심 정리"는 어떤 상품에 붙여도 말이 된다. 즉 정보량이 0이다.
 *
 * 상품명을 검색한 사람은 그 상품을 **이미 안다**. 알고 싶은 건 하나다 — "사도 되나?"
 * 그 답은 후기에 있다. 이동식 에어컨이면 소음·전기요금·배수가 반복해서 나온다.
 * 그 걱정을 제목에 박으면 그게 곧 클릭 이유가 된다.
 *
 * 비용: 0원. LLM 을 부르지 않고 수집해둔 후기 텍스트만 센다.
 */

/** 관심사 하나 — 무엇을 걱정하는지와 후기에서 몇 번 나왔는지 */
export interface BuyerConcern {
  /** 사람이 읽는 이름 — 그대로 제목 재료가 된다 */
  label: string;
  /** 이 관심사를 언급한 후기 수 */
  count: number;
  /** 근거가 된 후기 조각 (프롬프트에 실어 구체성을 준다) */
  quotes: string[];
}

/**
 * 관심사 사전.
 *
 * 한국어 후기는 같은 걱정을 여러 말로 쓴다("시끄럽다"/"소음"/"소리가"/"윙윙").
 * 그래서 라벨 하나에 표현을 여러 개 매단다.
 *
 * 순서에 의미는 없다 — 실제 순위는 후기에서 몇 번 나왔는지로 정한다.
 */
const CONCERN_PATTERNS: ReadonlyArray<{ label: string; words: RegExp }> = [
  { label: '소음', words: /소음|시끄|소리가|조용|윙윙|시끌|정숙/ },
  { label: '전기요금', words: /전기\s*요금|전기세|전기료|소비\s*전력|누진/ },
  { label: '크기·설치 공간', words: /크기|사이즈|부피|자리\s*차지|공간|설치\s*(가|를|하)|좁|커요|큽니다|작아/ },
  { label: '배수·물 처리', words: /배수|물\s*빼|물통|응축수|물이\s*차|호스/ },
  { label: '냉방·성능', words: /시원|냉방|안\s*시원|성능|온도가|잘\s*됩|효과가/ },
  { label: '내구성·고장', words: /고장|망가|불량|내구|금방|오래\s*쓰|튼튼|약해/ },
  { label: '배송·포장', words: /배송|포장|파손|도착|늦게|빠르게\s*왔/ },
  { label: '가격·가성비', words: /가성비|가격|비싸|저렴|싸게|돈이\s*아깝|값/ },
  { label: '무게·이동', words: /무게|무거|가벼|옮기|이동이|바퀴/ },
  { label: '냄새', words: /냄새|악취|퀴퀴|플라스틱\s*냄새/ },
  { label: '조립·사용법', words: /조립|설명서|사용법|어렵|간단|복잡/ },
  { label: 'A\/S·고객센터', words: /A\/?S|에이에스|고객\s*센터|교환|환불|반품/ },
  { label: '전원·전선', words: /전원|콘센트|전선|코드|플러그/ },
  { label: '청소·관리', words: /청소|세척|필터|관리가|먼지/ },
  { label: '디자인·마감', words: /디자인|색상|마감|예쁘|이쁘|고급스/ },
];

/** 후기 한 줄에서 근거로 쓸 만한 조각을 뽑는다 — 너무 길면 제목 재료로 못 쓴다 */
function clipQuote(text: string, max = 60): string {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * 후기 묶음에서 관심사를 많이 언급된 순으로 뽑는다.
 *
 * @param reviews 후기 본문 배열 (빈 배열이어도 안전 — 빈 결과를 준다)
 * @param limit   최대 몇 개까지
 */
export function extractBuyerConcerns(reviews: string[], limit = 3): BuyerConcern[] {
  const bodies = (Array.isArray(reviews) ? reviews : [])
    .map((r) => String(r || '').trim())
    .filter(Boolean);
  if (!bodies.length) return [];

  const found = CONCERN_PATTERNS.map(({ label, words }) => {
    const hits = bodies.filter((b) => words.test(b));
    return {
      label,
      count: hits.length,
      // 짧은 후기가 인용으로 쓰기 좋다 — 긴 것보다 핵심이 또렷하다
      quotes: hits.slice().sort((a, b) => a.length - b.length).slice(0, 2).map((q) => clipQuote(q)),
    };
  }).filter((c) => c.count > 0);

  return found
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, limit));
}

/**
 * 제목이 아무 의미 없는 꼬리표로 끝나는지 본다.
 *
 * "핵심 정리"·"총정리"·"꿀팁"은 어떤 상품에 붙여도 말이 된다.
 * 어떤 상품에나 붙는 말은 그 상품에 대해 아무것도 말하지 않는다.
 */
export const FILLER_TAILS: readonly string[] = [
  '핵심 정리', '핵심정리', '총정리', '완벽 가이드', '완벽가이드', '완전 정복', '완전정복',
  '꿀팁', '꿀팁 모음', '한눈에 보기', '알아야 할 모든 것', '모든 것', '정리', '핵심만',
  '가이드', '요약', '핵심 포인트', '한방 정리', '싹 정리',
];

/** 제목 끝의 무의미한 꼬리표를 찾아낸다. 없으면 null. */
export function findFillerTail(title: string): string | null {
  // 이모지·공백·문장부호를 걷어낸 뒤 끝을 본다
  const bare = String(title || '')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/[\s!?.~·|\-–—]+$/g, '')
    .trim();
  if (!bare) return null;
  // 긴 꼬리표부터 본다 — "핵심 정리"가 "정리"보다 먼저 잡혀야 한다
  const sorted = [...FILLER_TAILS].sort((a, b) => b.length - a.length);
  for (const tail of sorted) {
    if (bare.endsWith(tail)) {
      // 꼬리표를 떼고도 제목이 남아야 '꼬리표'다. 제목 전체가 꼬리표면 뗄 수 없다.
      const rest = bare.slice(0, bare.length - tail.length).trim();
      if (rest.length >= 4) return tail;
    }
  }
  return null;
}

/**
 * 제목 생성 프롬프트에 실을 지시문을 만든다.
 *
 * 후기가 없어도 빈 문자열을 주지 않는다 — 꼬리표 금지만이라도 걸어야
 * "OO 핵심 정리"로 되돌아가지 않는다.
 */
export function composeShoppingTitleDirective(
  productName: string,
  concerns: BuyerConcern[],
): string {
  const name = String(productName || '').trim();
  const lines: string[] = [
    '**쇼핑 글 제목 규칙 (다른 모든 스타일 지시보다 우선):**',
    `- 이 상품명을 검색한 사람은 상품을 **이미 압니다.** 궁금한 건 딱 하나 — "사도 되나?"`,
    '- 그러니 제목은 **구매 판단에 직접 닿는 한 가지**를 골라 말하세요.',
    `- 금지: ${FILLER_TAILS.slice(0, 8).join(' · ')} 같은 꼬리표.`,
    '  어떤 상품에 붙여도 말이 되는 말은 그 상품에 대해 아무것도 말하지 않습니다.',
  ];

  if (concerns.length) {
    const ranked = concerns.map((c) => `${c.label}(후기 ${c.count}건)`).join(', ');
    lines.push(
      '',
      `**실제 구매자들이 가장 많이 언급한 것:** ${ranked}`,
      '- 이 중 **하나**를 제목의 축으로 삼으세요. 여러 개를 나열하지 마세요.',
    );
    const quotes = concerns.flatMap((c) => c.quotes).filter(Boolean).slice(0, 4);
    if (quotes.length) {
      lines.push('- 후기 원문(표현 참고용, 그대로 베끼지는 마세요):');
      lines.push(...quotes.map((q) => `  · "${q}"`));
    }
  } else {
    /**
     * v3.8.419 — 후기가 없을 때 "가격 대비 성능 · 크기 · 실제로 쓸 만한지" 3개 중
     *   아무거나 골라 쓰던 게 너무 뭉뚱그려져 있었다는 지적("정확하게 이게 어떤제품이고
     *   왜 지금 사람들이 이제품을 찾을지... 생각하고 제목을 완벽히 생성하게 해줘야지").
     *   실측: "[256GB → 512GB 업그레이드] 삼성전자 갤럭시 Z Flip8 자급제" → 제목
     *   "...지금 살 만할까"(후기 없음의 3개 축 중 아무거나 하나 → 사실상 랜덤 선택).
     *   상품명 자체에 이미 "무엇과 무엇 사이의 선택인지"가 적혀 있는데 그걸 안 읽고
     *   추상적인 3축으로만 갔다. 상품명을 실제로 읽고 그 안의 구체적 신호를 쓰게 한다.
     */
    lines.push(
      '',
      '- 후기 데이터가 없습니다(신상품·사전예약이거나 원래 후기가 드문 상품일 수 있습니다).',
      `- 상품명("${name || '(상품명 없음)'}") 자체를 먼저 읽으세요. 그 안에 이미 "무엇과 무엇 사이의`,
      '  선택인지"가 적혀 있는 경우가 많습니다 — 그 구체적 신호를 제목의 축으로 삼으세요:',
      '  · 용량/등급/구성 표기(예: "256GB → 512GB", "16GB", "Pro/기본") → 그 등급을 고를 가치가',
      '    있는지가 축',
      '  · "자급제"가 있으면 → 통신사 약정 대신 자급제를 고르는 이유·득실이 축',
      '  · 색상·사이즈·버전 표기가 있으면 → 그 옵션 선택 기준이 축',
      '  · 이런 구체적 표기가 전혀 없으면 → 그 상품군에서 사람들이 늘 걱정하는 것',
      '    (가격 대비 성능 · 크기 · 실제로 쓸 만한지) 중 하나를 축으로 삼으세요.',
      '- 상품명에 실제로 적힌 신호만 쓰세요. 할인율·재고·출시일처럼 상품명에 없는',
      '  숫자·시점 정보는 지어내지 마세요.',
    );
  }

  lines.push(
    '',
    '**이런 꼴이면 좋습니다:**',
    `- "${name || '제품'} 전기요금 정말 얼마 나올까"        ← 돈 걱정에 답한다`,
    `- "${name || '제품'} 소음 어느 정도인지 솔직하게"       ← 안 좋은 얘기도 한다는 신호`,
    `- "${name || '제품'}, 원룸에서 쓸 만할까"              ← 상황을 특정한다`,
    '**이런 꼴이면 실패입니다:**',
    `- "${name || '제품'} 핵심 정리" · "${name || '제품'} 총정리" ← 읽기 전과 후가 똑같다`,
  );

  return lines.join('\n');
}
