/**
 * 제휴 프로그램 운영정책 — 원문 기반 규칙 정의 (v3.8.395)
 *
 * ⚠️ 이 파일의 문구는 **각 프로그램 공식 문서에서 그대로 옮긴 것**이다. 추측해서 쓰지 않는다.
 *   틀린 고지 문구는 계정 정지·수익금 지급 중단·법적 문제로 직결된다.
 *   수정할 일이 있으면 반드시 policyUrl 원문을 다시 확인하고 verifiedAt 을 갱신할 것.
 *
 * ── 실측 확인 (2026-08-01, 원문 크롤) ──
 *
 * 네이버 쇼핑 커넥트 (브랜드 커넥트)
 *   "「추천·보증 등에 관한 표시·광고 심사 지침」에 따라 반드시 경제적 이해관계가 있음을 표시해야 합니다."
 *   "쇼핑 커넥트 링크를 게재할 때는, [대가성 문구]는 필수로 기재해야 합니다."
 *   "네이버가 활동을 제한한 채널에서 쇼핑 커넥트 링크를 게시하는 것을 금지합니다."
 *   "발급된 링크의 제휴 상태와 수수료율은 판매자 설정에 따라 매월 1일 변경될 수 있습니다."
 *
 * 토스쇼핑 쉐어링크
 *   "토스쇼핑 쉐어링크 활동으로 올리는 모든 게시물에는 경제적 이해관계를 꼭 표시해주세요."
 *   "문구는 되도록 게시물의 제목이나 첫 부분에 표기하는 것을 권장해요."
 *   "경제적 이해관계 표시가 '자세히 보기'와 같이 추가적인 행동으로만 확인되지 않도록 유의해주세요."
 *   "토스에서 제공하지 않은 링크나 로고를 임의로 수정해 사용하는 경우 계약이 해지될 수 있어요."
 *   "무효 클릭, 자동 실행, 과도하게 클릭을 유도하는 등 사용자의 의도에 반하는 방식은 모두 금지돼요."
 *   "본문이나 이미지를 가려 클릭을 유도하는 형태의 광고는 모두 금지돼요." (플로팅 배너 금지)
 *
 * ⚠️ 가장 중요한 함정: **세 제휴사의 고지 문구가 서로 다르다.**
 *   쿠팡·토스 → "이에 따른 일정액의 수수료를 제공받습니다"
 *   네이버     → "판매 발생 시 수수료를 제공받습니다"
 *   기존 쿠팡 코드의 전역 치환(`받을 수 있습니다` → `일정액의 수수료를 제공받습니다`)을
 *   네이버에 적용하면 **공식 문구가 훼손된다.** 교정 규칙은 반드시 제휴사별로 둔다.
 */

export type AffiliateProviderId = 'coupang' | 'naver-shopping-connect' | 'toss-sharelink';

export interface AffiliatePolicy {
  id: AffiliateProviderId;
  /** UI 표기명 */
  label: string;
  /** 공식 대가성 문구 — 원문 그대로. 절대 변형 금지 */
  disclosure: string;
  /** 문구 앞에 붙는 기호 (토스 공식 예시가 ✱ 를 쓴다) */
  disclosurePrefix: string;
  /** 본문에서 이 제휴사 링크를 식별하는 패턴 (단축·최종 도메인 모두) */
  linkHosts: RegExp;
  /**
   * 이 제휴사에 한해 적용하는 조건부→확정형 교정.
   * 다른 제휴사 문구를 건드리지 않도록 반드시 제휴사명을 앵커로 잡는다.
   */
  conditionalFixes: Array<[RegExp, string]>;
  /** 정책 원문 위치 */
  policyUrl: string;
  /** 원문 확인일 — 오래되면 재확인 신호 */
  verifiedAt: string;
  /** 사람이 읽는 주의사항 (UI 안내용) */
  notes: string[];
  /**
   * 제목에도 대가성 표시를 요구하는가.
   * 네이버 #7 가이드: "각 게시글 **제목 앞**, 본문 최상단에 대가성 문구를 삽입해야 합니다."
   */
  requiresTitleMark: boolean;
  /** 제목 앞에 붙일 짧은 표시 (전체 문장을 제목에 넣으면 제목이 못 쓰게 된다) */
  titleMark: string;
  /** 이 제휴사에서 함께 쓰면 안 되는 기능·태그 */
  forbiddenTogether: string[];
  /** 본문 링크 권장 상한 — 초과 시 어뷰징 경고 */
  maxLinksPerPost: number;
}

/** 쿠팡 — 기존 coupang-partners.ts 의 검증된 값을 그대로 옮겼다 */
const COUPANG: AffiliatePolicy = {
  id: 'coupang',
  label: '쿠팡 파트너스',
  disclosure: '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
  disclosurePrefix: '',
  linkHosts: /(?:link\.coupang\.com|coupa\.ng|coupang\.com)/i,
  conditionalFixes: [
    [/[^.。<>]{0,40}쿠팡\s*파트너스[^.。<>]{0,80}?수수료[^.。<>]{0,30}?(?:받을\s*수\s*있습니다|받을\s*수\s*있어요|지급받을\s*수\s*있습니다|제공받을\s*수\s*있습니다)\.?/g,
      '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'],
  ],
  policyUrl: 'https://partners.coupang.com',
  verifiedAt: '2026-07-26',
  notes: ['조건부 표현("받을 수 있습니다") 금지 — 확정형으로만 기재'],
  requiresTitleMark: false,
  titleMark: '',
  forbiddenTogether: [],
  maxLinksPerPost: 10,
};

/** 네이버 쇼핑 커넥트 — blog.naver.com/brandconnect-creator/223763365056 원문 확인 */
const NAVER_SHOPPING_CONNECT: AffiliatePolicy = {
  id: 'naver-shopping-connect',
  label: '네이버 쇼핑 커넥트',
  // ⚠️ 쿠팡·토스와 문구가 다르다. "판매 발생 시" 가 공식이다.
  disclosure: '이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.',
  disclosurePrefix: '',
  linkHosts: /(?:naver\.me|brandconnect\.naver\.com|smartstore\.naver\.com|brand\.naver\.com)/i,
  conditionalFixes: [
    // 네이버 고지문을 조건부로 쓴 경우만 교정한다. "일정액" 으로 바꾸지 않는다(공식 문구가 다르다).
    [/[^.。<>]{0,40}네이버\s*쇼핑\s*커넥트[^.。<>]{0,80}?수수료[^.。<>]{0,30}?(?:받을\s*수\s*있습니다|받을\s*수\s*있어요|지급받을\s*수\s*있습니다|제공받을\s*수\s*있습니다)\.?/g,
      '이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.'],
  ],
  policyUrl: 'https://blog.naver.com/brandconnect-creator/223763365056',
  verifiedAt: '2026-08-01',
  notes: [
    '「추천·보증 등에 관한 표시·광고 심사 지침」(2024-12-01 개정) 준수 필수',
    '네이버가 활동을 제한한 채널에서는 링크 게시 자체가 금지 — 실적 미인정 + 제재 대상',
    '링크의 제휴 상태·수수료율이 매월 1일 변경될 수 있음 (링크 생존 점검 권장)',
    '상품당 1개의 고유 링크만 발급됨',
    // ↓ #7 링크 삽입 가이드: 블로그 편 (blog.naver.com/brandconnect-creator/223763367552)
    '블로그는 "각 게시글 제목 앞, 본문 최상단"에 대가성 문구를 넣어야 함',
    '안내된 문구가 아닌 별도 문구로 쓰거나 누락하면 위반',
    '이미지 안에 넣거나 태그 사이에 숨겨 식별이 어려우면 위반',
    '#내돈내산 기능과 함께 사용 불가',
    '내용과 무관한 링크를 대량 삽입하면 어뷰징으로 불이익',
  ],
  requiresTitleMark: true,
  titleMark: '[제휴]',
  forbiddenTogether: ['#내돈내산', '내돈내산'],
  maxLinksPerPost: 5,
};

/** 토스쇼핑 쉐어링크 — sharelink-docs.toss.im/help/policy 원문 확인 */
const TOSS_SHARELINK: AffiliatePolicy = {
  id: 'toss-sharelink',
  label: '토스쇼핑 쉐어링크',
  disclosure: '이 포스팅은 토스쇼핑 쉐어링크 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
  disclosurePrefix: '✱ ',
  linkHosts: /(?:toss\.im|toss\.shopping|shopping\.toss\.im)/i,
  conditionalFixes: [
    [/[^.。<>]{0,40}토스\s*쇼핑\s*쉐어링크[^.。<>]{0,80}?수수료[^.。<>]{0,30}?(?:받을\s*수\s*있습니다|받을\s*수\s*있어요|지급받을\s*수\s*있습니다|제공받을\s*수\s*있습니다)\.?/g,
      '이 포스팅은 토스쇼핑 쉐어링크 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'],
  ],
  policyUrl: 'https://sharelink-docs.toss.im/help/policy',
  verifiedAt: '2026-08-01',
  notes: [
    '모든 게시물에 빠짐없이 대가성 문구 표시',
    '문구는 제목 또는 첫 부분에 표기 권장',
    '"자세히 보기" 등 추가 행동으로만 보이면 안 됨 — 접기(details) 안에 넣지 말 것',
    '토스가 제공한 링크를 임의 수정 금지 (URL 파라미터 변조 = 계약 해지 사유)',
    '플로팅 배너·본문 가림·자동 실행·과도한 클릭 유도 금지',
    '토스/토스쇼핑 명의 사칭, 키워드 검색광고, 도메인 등록 금지',
  ],
  // 토스 정책은 "제목 또는 첫 부분" 을 권장한다(필수 아님) → 본문 최상단으로 충족한다
  requiresTitleMark: false,
  titleMark: '',
  forbiddenTogether: [],
  maxLinksPerPost: 10,
};

export const AFFILIATE_POLICIES: Record<AffiliateProviderId, AffiliatePolicy> = {
  coupang: COUPANG,
  'naver-shopping-connect': NAVER_SHOPPING_CONNECT,
  'toss-sharelink': TOSS_SHARELINK,
};

export const AFFILIATE_PROVIDER_IDS: AffiliateProviderId[] =
  Object.keys(AFFILIATE_POLICIES) as AffiliateProviderId[];

/** id 로 정책을 찾는다. 모르는 id 면 undefined (임의 폴백 금지 — 잘못된 문구가 나가면 안 된다). */
export function getPolicy(id: string | null | undefined): AffiliatePolicy | undefined {
  if (!id) return undefined;
  return AFFILIATE_POLICIES[String(id).trim() as AffiliateProviderId];
}

/** 본문에 들어있는 링크로 제휴사를 추정한다 (사용자가 선택을 안 했을 때의 보조 수단). */
export function detectProvidersFromHtml(html: string): AffiliateProviderId[] {
  const text = String(html || '');
  if (!text) return [];
  return AFFILIATE_PROVIDER_IDS.filter((id) => {
    const policy = AFFILIATE_POLICIES[id];
    // href 안에 있을 때만 인정한다 — 본문 텍스트에 도메인이 언급된 것만으로는 링크가 아니다
    const re = new RegExp(`href\\s*=\\s*["'][^"']*${policy.linkHosts.source}`, 'i');
    return re.test(text);
  });
}
