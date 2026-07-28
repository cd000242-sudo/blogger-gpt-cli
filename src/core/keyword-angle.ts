/**
 * 키워드 각도 분류기 (v3.8.384)
 *
 * 근거 — 2026-07-28 엣지 리서치(SERP 22회 실측, 적대검증 통과):
 *   한국어 금융·지원금 검색에서 개인 사이트가 대기업(토스·뱅크샐러드)·정부(정부24·복지로)를
 *   실제로 이기는 질의는 5가지 문형에 몰려 있다. 그 밖의 문형은 도메인 권위로 밀린다.
 *
 *   ① 지급일·입금·소급    "언제 들어오나"      — 정부 페이지가 구체 날짜를 안 준다
 *   ② 회사명+해지·환급     "해지하면 얼마"      — 회사 공식은 해지를 자세히 안 쓴다
 *   ③ 불이익·단점·후회     "하면 손해인가"      — 판매자는 단점을 안 쓴다
 *   ④ 조회·잔액·절차       "어디서 확인하나"    — 기관은 총론만, 실제 클릭 동선이 없다
 *   ⑤ 제도변경 전환 유불리  "갈아타면 이득인가"  — 개인 상황별로 갈려 한 줄 요약이 불가능
 *
 * 승자 제목 문법 5패턴도 실물 제목 원문 확인으로 검증됐다.
 * 예: moneyroan "2026 5세대 실손보험 출시일 총정리 (보장내용·갈아타기 방법·4세대 비교)"
 *     benefitnow "평균 1~2개월 + 지연되는 5가지 이유"
 *
 * 이 모듈은 순수 함수다 — I/O 없고, 발행을 막지 않는다.
 * keyword-demand.ts 의 수요 실측(어떤 표현을 검색하는가)과 짝을 이룬다:
 *   수요 게이트 = 제목 "머리"를 정하고, 이 모듈 = 제목 "꼴"과 본문 H2 구성을 정한다.
 */

export type QueryArchetype = 'payout' | 'cancel' | 'downside' | 'lookup' | 'transition' | null;

export interface AngleAnalysis {
  keyword: string;
  archetype: QueryArchetype;
  /** 사람이 읽는 문형 이름 */
  label: string;
  /** 판정 근거가 된 단서들 */
  matched: string[];
  /** 승자 제목 문법 이름 */
  titlePattern: string;
  /** 제목 생성 프롬프트에 넣을 지시문. 문형 미해당이면 null */
  titleGuide: string | null;
  /** 본문 H2 구성 지시문. 문형 미해당이면 null */
  bodyGuide: string | null;
  summary: string;
}

interface ArchetypeSpec {
  key: Exclude<QueryArchetype, null>;
  label: string;
  /** 한글은 \b 경계가 작동하지 않으므로 부분 문자열 포함으로 판정한다 */
  cues: string[];
  titlePattern: string;
  titleGuide: string;
  bodyGuide: string;
}

const SPECS: ArchetypeSpec[] = [
  {
    key: 'payout',
    label: '지급일·입금·소급',
    cues: ['지급일', '지급일자', '입금', '언제 들어', '언제나오', '언제 나오', '지급 시기', '지급시기',
      '소급', '언제까지', '지급받', '수령일', '며칠', '지급 순서'],
    titlePattern: '질문+숫자답형',
    titleGuide: [
      '제목 꼴: 질문을 던지고 곧바로 구체 숫자로 답하라.',
      '예) "청년월세지원 언제 들어올까? 매월 25일 + 심사 45~60일"',
      '숫자(날짜·기간·금액)를 제목에 반드시 하나 넣어라. 정부 페이지가 주지 않는 숫자가 이 문형의 무기다.',
      '단, 확인되지 않은 숫자를 지어내면 안 된다 — 근거가 없으면 숫자 없이 질문형으로만 써라.',
    ].join(' '),
    bodyGuide: [
      'H2 구성: ①정확한 지급일/주기 ②심사~입금까지 실제 소요 기간 ③지연되는 경우와 이유',
      '④소급 적용 규칙 ⑤안 들어왔을 때 확인 순서. 각 항목에 기관 공식 출처 링크를 달아라.',
    ].join(' '),
  },
  {
    key: 'cancel',
    label: '해지·환급',
    cues: ['해지', '환급', '해약', '중도해지', '위약금', '취소', '반환', '돌려받', '탈퇴', '철회'],
    titlePattern: '덧셈형',
    titleGuide: [
      '제목 꼴: 핵심 답 + 조건 개수를 더해 붙여라.',
      '예) "후불제 상조 해지하면 얼마 돌려받나 — 위약금 조항 3가지"',
      '"얼마"와 "언제"에 해당하는 값이나 조건 수를 제목에 노출하라.',
    ].join(' '),
    bodyGuide: [
      'H2 구성: ①환급률 계산 기준 ②위약금·공제 항목 ③해지 절차와 필요 서류',
      '④환급까지 걸리는 기간 ⑤해지 대신 쓸 수 있는 선택지(중지·승계 등).',
      '회사·상품별로 갈리는 지점을 명시하고, 계약서에서 확인할 조항명을 알려줘라.',
    ].join(' '),
  },
  {
    key: 'downside',
    label: '불이익·단점·후회',
    // '과태료·벌금·제재'도 "안 하면 무슨 불이익인가" 질의다 —
    // 2026-07-28 리포트의 "직장 건강검진 과태료"(A등급·선점신호 3)가 이 계열이다.
    cues: ['불이익', '단점', '후회', '손해', '문제점', '주의', '함정', '리스크', '위험',
      '안 좋', '나쁜', '손해인', '득실', '실수', '과태료', '벌금', '제재', '거절', '부결', '탈락'],
    titlePattern: '팩트체크 구도',
    titleGuide: [
      '제목 꼴: 통념을 질문으로 세우고 사실 확인 구도를 예고하라.',
      '예) "실손보험 청구 자주 하면 불이익? 세대별 할증 기준으로 확인"',
      '단정("무조건 손해")을 쓰지 마라. 상위 문서들이 서로 다른 결론을 내고 있어',
      '"조건에 따라 갈린다"를 정면으로 다루는 것이 이 문형의 승부처다.',
    ].join(' '),
    bodyGuide: [
      'H2 구성: ①통념이 맞는 경우 ②틀린 경우 ③갈리는 기준(세대·구간·금액 등)',
      '④실제 규정 원문 인용 ⑤내 경우를 판정하는 체크리스트.',
      '상충하는 언론 보도가 있으면 양쪽을 다 제시하고 왜 다른지 설명하라.',
    ].join(' '),
  },
  {
    key: 'lookup',
    label: '조회·잔액·절차',
    // '기산·산정·기준'도 "내 경우 어떻게 계산되나" 확인 질의다 —
    // 2026-07-28 리포트의 "청약 무주택기간"(A등급, 기산일이 만 30세냐 혼인신고일이냐)이 이 계열이다.
    cues: ['조회', '확인', '잔액', '신청 방법', '신청방법', '어디서', '사용처', '검색',
      '발급', '접수', '등록 방법', '보는 법', '보는법', '찾는 법', '찾는법', '결과 확인',
      '기산', '산정', '기준일', '계산법', '판정', '무주택기간', '자격'],
    titlePattern: '괄호 나열형',
    titleGuide: [
      '제목 꼴: 핵심 표현 뒤 괄호에 하위 항목을 나열하라.',
      '예) "서울 온누리상품권 사용처 (자치구별·앱 조회·가맹점 검색)"',
      '괄호 안 항목은 실제 본문 H2와 일치해야 한다 — 없는 내용을 괄호에 넣지 마라.',
    ].join(' '),
    bodyGuide: [
      'H2 구성: ①가장 빠른 조회 동선(클릭 순서) ②대안 경로 ③화면에 뜨는 상태 메시지 해석',
      '④안 될 때 원인별 대응 ⑤공식 문의처.',
      '표를 최소 1개 넣어라 — 이 문형은 도구성 문서가 유리하다.',
    ].join(' '),
  },
  {
    key: 'transition',
    label: '제도변경 전환 유불리',
    cues: ['갈아타', '전환', '변경', '개편', '바뀐', '달라진', '새로', '신규 출시',
      '이득인', '유리한', '비교', '차이', '세대'],
    titlePattern: '조건분기형',
    titleGuide: [
      '제목 꼴: 대상을 둘로 갈라 제시하라.',
      '예) "1·2세대 실손, 5세대로 갈아타면 이득인 사람 / 손해인 사람"',
      '"누구에게 유리한가"를 제목에서 이미 갈라주면 클릭 의도가 살아난다.',
    ].join(' '),
    bodyGuide: [
      'H2 구성: ①무엇이 언제부터 바뀌는가(시행일 명시) ②이득인 조건 ③손해인 조건',
      '④판단에 필요한 내 정보 확인법 ⑤전환 기한과 되돌릴 수 있는지.',
      '조건 비교는 반드시 표로 제시하라.',
    ].join(' '),
  },
];

/** 키워드를 정규화한다 (공백·조사 흔들림 흡수) */
function normalize(kw: string): string {
  return String(kw || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * 키워드가 개인 승산 5문형 중 무엇인지 판정한다.
 * 여러 문형에 걸리면 단서가 가장 많이 맞은 것을 고르고, 동수면 SPECS 정의 순서를 따른다.
 * 순수 함수 — throw 하지 않는다.
 */
export function analyzeKeywordAngle(keyword: string): AngleAnalysis {
  const kw = normalize(keyword);
  // ⚠️ 미해당 = "나쁜 키워드"가 아니다. 5문형은 SERP 실측으로 확인된 목록이지 완전한 분류가 아니다.
  //    실제로 2026-07-28 리포트의 A등급 2건이 초기 cue 목록에서 빠져 있었다(과태료·기산일 계열).
  //    따라서 미해당일 때는 단정하지 말고 판정 보류로 안내한다.
  const base: AngleAnalysis = {
    keyword: String(keyword || ''), archetype: null, label: '판정 보류', matched: [],
    titlePattern: '(문형 미해당)', titleGuide: null, bodyGuide: null,
    summary: '검증된 5문형에 해당하지 않음 — 문형 목록이 완전하지 않으므로 SERP 선점 판정으로 따로 확인하세요',
  };
  if (!kw) return base;

  let best: { spec: ArchetypeSpec; hits: string[] } | null = null;
  for (const spec of SPECS) {
    const hits = spec.cues.filter(c => kw.includes(c));
    if (hits.length === 0) continue;
    if (!best || hits.length > best.hits.length) best = { spec, hits };
  }
  if (!best) return base;

  const { spec, hits } = best;
  return {
    keyword: String(keyword || ''),
    archetype: spec.key,
    label: spec.label,
    matched: hits,
    titlePattern: spec.titlePattern,
    titleGuide: `개인 승산 문형 판정: "${spec.label}" (단서: ${hits.join(', ')}).\n${spec.titleGuide}`,
    bodyGuide: spec.bodyGuide,
    summary: `${spec.label} 문형 → ${spec.titlePattern} (단서: ${hits.join(', ')})`,
  };
}

/**
 * 수요 실측 힌트와 각도 지시를 하나의 제목 프롬프트 지시문으로 합친다.
 * 둘 다 없으면 null (제목 프롬프트에 아무것도 추가하지 않는다).
 */
export function composeTitleDirective(
  demandHint: string | null | undefined,
  angle: AngleAnalysis | null | undefined
): string | null {
  const parts: string[] = [];
  if (demandHint) parts.push(demandHint);
  if (angle && angle.titleGuide) parts.push(angle.titleGuide);
  return parts.length ? parts.join('\n\n') : null;
}
