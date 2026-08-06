/**
 * action-intent — 키워드에서 "사람이 하려는 행동" 을 읽어 CTA 를 그 화면으로 보낸다.
 *
 * ## 왜 필요한가
 * 예전에는 구글에 `"${keyword} 공식 홈페이지"` 라고 물었다. 홈페이지를 달라고 했으니
 * 홈페이지가 왔다. 독자는 링크를 눌러 코레일 첫 화면에 도착하고, 거기서 예매 메뉴를
 * 다시 찾아야 했다. 대부분은 거기서 이탈한다.
 *
 * ## 무엇을 하지 않는가
 * 딥링크 주소를 코드에 박아 넣지 않는다. 기관 사이트는 개편이 잦아서 박아 둔 경로가
 * 조용히 죽는다. 대신 **검색어를 행동 쪽으로 돌려** 구글이 현재 살아있는 화면을
 * 찾게 하고, 그 결과를 validate-cta-url 로 확인한다.
 */

export const ACTION_INTENTS = ['신청', '예매', '예약', '조회', '발급', '접수', '가입', '납부'] as const;
export type ActionIntent = (typeof ACTION_INTENTS)[number];

/** 키워드에 행동어가 그대로 드러난 경우 — 표기 흔들림을 함께 잡는다 */
const EXPLICIT: Array<{ intent: ActionIntent; words: RegExp }> = [
  { intent: '예매', words: /예매|티켓팅|승차권|좌석\s*예약/ },
  { intent: '예약', words: /예약(?!\s*판매)|숙소\s*잡|진료\s*예약/ },
  { intent: '발급', words: /발급|재발급|출력|프린트/ },
  { intent: '조회', words: /조회|확인서|내역|열람|검색해\s*보/ },
  { intent: '납부', words: /납부|결제\s*방법|고지서|과태료/ },
  { intent: '가입', words: /가입|등록\s*방법|회원가입/ },
  { intent: '접수', words: /접수|원서|응시\s*신청/ },
  { intent: '신청', words: /신청|지원(?:금|사업|받)|모집|공모|청구|환급/ },
];

/**
 * 행동어가 없어도 주제만 보고 추론한다.
 * 사장님 요구: "추론을 해서 사람들이 얻고자 하는 정보에 관련된 링크를 걸어줘야 되"
 *
 * 여기 없는 주제는 억지로 분류하지 않는다 — 엉뚱한 화면으로 보내면 안 하느니만 못하다.
 */
const INFERRED: Array<{ intent: ActionIntent; topics: RegExp }> = [
  {
    intent: '예매',
    topics: /\b(ktx|srt)\b|코레일|무궁화호|고속버스|시외버스|항공권|기차표|공연|콘서트|뮤지컬|영화\s*예매/i,
  },
  {
    intent: '신청',
    topics: /실업급여|구직급여|육아휴직|출산휴가|국민내일배움카드|내일채움|청년내일저축|청년도약|근로장려금|자녀장려금|기초연금|장애인연금|긴급복지|햇살론|디딤돌\s*대출|버팀목|주거급여|생계급여|의료급여|에너지\s*바우처|문화누리|지원금|보조금|장학금/i,
  },
  {
    intent: '발급',
    topics: /주민등록등본|초본|가족관계증명|건강보험자격|소득금액증명|납세증명|인감증명|여권|국제운전면허|범죄경력/i,
  },
  {
    intent: '조회',
    topics: /연말정산|건강보험료|국민연금\s*예상|자동차\s*검사\s*기간|과태료\s*조회|압류|미환급금|휴면계좌/i,
  },
  {
    intent: '예약',
    topics: /국립공원\s*야영|캠핑장|진료\s*예약|건강검진|주차장\s*예약|공공\s*시설/i,
  },
];

/** 상품·리뷰성 키워드에는 행동 CTA 를 붙이지 않는다 (구매 링크는 별도 경로가 있다) */
const SHOPPING_LIKE = /추천|후기|리뷰|비교|최저가|가성비|순위|인기\s*상품|브랜드/;

/**
 * 키워드에서 행동 의도를 읽는다. 못 읽으면 null — 억지로 붙이지 않는다.
 */
export function detectActionIntent(keyword: string): ActionIntent | null {
  try {
    const text = String(keyword || '').trim();
    if (!text) return null;

    for (const { intent, words } of EXPLICIT) {
      if (words.test(text)) return intent;
    }

    // 명시적 행동어가 없을 때만 주제 추론으로 넘어간다
    if (SHOPPING_LIKE.test(text)) return null;
    for (const { intent, topics } of INFERRED) {
      if (topics.test(text)) return intent;
    }

    return null;
  } catch {
    return null;
  }
}

/** 행동별로 실제 그 화면에 붙는 말 — 기관 사이트가 버튼에 쓰는 표현을 따라간다 */
const QUERY_SUFFIX: Record<ActionIntent, string> = {
  신청: '온라인 신청 바로가기',
  예매: '예매 바로가기 승차권 예약',
  예약: '예약 바로가기',
  조회: '조회 바로가기 온라인 확인',
  발급: '인터넷 발급 바로가기',
  접수: '온라인 접수 바로가기',
  가입: '온라인 가입 신청',
  납부: '온라인 납부 바로가기',
};

/**
 * 구글에 던질 검색어를 만든다.
 * 행동을 못 읽었으면 예전과 똑같이 공식 사이트를 찾는다 — 엉뚱한 링크보다 낫다.
 *
 * 키워드에 이미 든 낱말은 접미어에서 뺀다.
 * "코레일 예매" + "예매 바로가기 승차권 예약" → "코레일 예매 바로가기 승차권 예약"
 * 같은 말을 두 번 넣으면 검색 결과가 오히려 엉킨다.
 */
export function buildActionQuery(keyword: string, intent: ActionIntent | null): string {
  const base = String(keyword || '').trim();
  if (!intent) return `${base} 공식 사이트`;

  const suffix = QUERY_SUFFIX[intent]
    .split(' ')
    .filter((word) => word && !base.includes(word))
    .join(' ');

  return suffix ? `${base} ${suffix}` : `${base} 바로가기`;
}
