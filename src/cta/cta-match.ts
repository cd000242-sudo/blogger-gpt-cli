/**
 * 🎯 CTA 적합성 — 목적지가 이 글의 주체이고, 이 행동을 할 수 있는 곳인가 (v3.8.748)
 *
 * ## 왜
 * Claude live Run 3 실측(경주 APEC 숙소 예약): CTA 가 `gyeongju.museum.go.kr`(국립경주박물관 전시 안내)을
 * **"예약 안내 확인"** 으로 걸었다. 근거 장부에 있던 주소라 기존 검사(ctaCandidateVerdict — 근거 출처의 집인가)는 통과했다.
 * 하지만 독자는 숙소 예약을 기대하고 눌러 박물관 전시 페이지에 떨어진다. Judge 가 CTA_OFFTOPIC·MIXED_ENTITY 로 막았다.
 *
 * 즉 **"근거에 있는 주소"·"공식 도메인" 은 CTA 자격이 아니다.** 사장님 지시:
 *   "`.go.kr`, 공식 홈페이지, 공공기관이라는 이유만으로 CTA 자격을 주지 않는다."
 *   "적합한 CTA 가 없으면 잘못된 링크를 넣지 말고 CTA 링크 생략." — 링크 없는 CTA > 틀린 CTA
 *
 * ## 무엇을 하나 (LLM 호출 0 · 페이지 조회 0)
 * 세 가지만 본다. 새 게이트를 더 만들지 않는다.
 *   CTA_ENTITY_MATCH      목적지가 이 글의 주체(주제 낱말)와 겹치는가 — 지역·일반어는 빼고 센다
 *   CTA_ACTION_MATCH      목적지가 이 CTA 의 행동(예약·신청…)을 할 수 있는 곳인가 — 다른 활동류면 탈락
 *   CTA_DESTINATION_MATCH 목적지가 이 글과 **다른 종류의 시설·기관**이 아닌가 (박물관 vs 숙소)
 *
 * 판단 재료는 이미 가진 것뿐이다: 주소(호스트·경로) · 링크 문구 · 근거 장부에 있는 그 문서의 제목·본문 앞부분.
 */

export type CtaMatchCode = 'CTA_ENTITY_MATCH' | 'CTA_ACTION_MATCH' | 'CTA_DESTINATION_MATCH';

export interface CtaDestinationInfo {
  url: string;
  /** 근거 장부에 있는 그 문서의 제목 */
  title?: string;
  /** 근거 장부 본문 앞부분 */
  text?: string;
  /** Writer 패킷 보기 등급. CORE·SUPPORTING 이면 주제 관련이 이미 확인된 출처다 */
  tier?: 'CORE' | 'SUPPORTING' | 'CONTEXT_ONLY' | 'NONE';
}

export interface CtaMatchVerdict { ok: boolean; failed: CtaMatchCode | null; reason: string }

/** 지역 이름은 "겹침" 으로 세지 않는다 — 경주 글에 경주박물관이 붙는 자리가 여기였다 */
const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '수원', '성남', '고양', '용인', '창원', '청주', '전주', '천안', '포항', '경주', '과천', '양산', '김해', '구미', '제주', '강릉', '춘천', '여수', '순천', '군산', '목포', '안동', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남'];

/** 어느 글에나 있는 말 — 이것만 겹치면 겹친 게 아니다 */
const GENERIC = new Set(['안내', '정보', '확인', '방법', '공식', '홈페이지', '사이트', '페이지', '관련', '대한', '기간', '현황', '목록', '조회', '서비스', '센터', '포털', '시스템', '온라인', '바로', '가기', '최신', '전체', '주요', '기타', '한국', '대한민국', '국립', '시청', '군청', '도청']);

/** 행동 낱말 ↔ 같은 뜻으로 볼 말 */
const ACTION_SYNONYMS: Record<string, string[]> = {
  예약: ['예약', '예매', 'booking', 'reserve', 'reservation', '숙박', '객실'],
  예매: ['예매', '예약', 'ticket', 'booking'],
  신청: ['신청', '접수', '응모', 'apply', 'application', 'regist'],
  접수: ['접수', '신청', 'apply', 'regist'],
  조회: ['조회', '검색', '확인', 'search', 'lookup'],
  구매: ['구매', '주문', '결제', 'buy', 'order', 'shop'],
  가입: ['가입', '등록', 'join', 'signup', 'regist'],
  발급: ['발급', '신청', 'issue'],
  납부: ['납부', '결제', 'pay'],
};

/** 주제 낱말이 달라도 같은 것을 가리키는 말 */
const SUBJECT_SYNONYMS: Array<string[]> = [
  ['숙소', '숙박', '호텔', '객실', '펜션', '게스트하우스', '리조트', '모텔'],
  ['보조금', '지원금', '보급', '지원'],
  ['대출', '금리', '상환'],
  ['공고', '모집', '접수'],
  ['채용', '구인', '공채'],
];

/**
 * 시설·기관 종류. 글과 목적지가 **서로 다른 종류**면 탈락한다.
 * (경주 숙소 예약 글 ↔ 국립경주박물관 전시 페이지가 이 검사에 걸린다)
 */
const FACILITY_CLASSES: Record<string, string[]> = {
  숙박: ['숙소', '숙박', '호텔', '객실', '펜션', '게스트하우스', '리조트', '모텔', '야영', '캠핑'],
  전시관람: ['박물관', '미술관', '전시', '관람', '유물', '소장품', '기획전', 'museum', 'gallery', 'exhibit'],
  공연: ['공연', '극장', '콘서트', '무대', '연극'],
  도서: ['도서관', '열람실', '대출증'],
  체육: ['체육관', '경기장', '구장', '스타디움'],
  의료: ['병원', '의원', '보건소', '진료'],
  교육: ['학교', '대학', '학원', '강의'],
};

const norm = (s: unknown): string => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** 조사 뗀 낱말 — 2글자 이상, 지역·일반어 제외 */
export function subjectTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of norm(text).split(/[^0-9a-z가-힣]+/)) {
    const w = raw.replace(/(의|와|과|을|를|은|는|이|가|에|로|으로|에서|까지|부터|도|만)$/, '');
    if (w.length < 2 || GENERIC.has(w) || REGIONS.includes(w) || /^\d+$/.test(w)) continue;
    out.add(w);
  }
  return out;
}

/** a 의 낱말 중 하나라도 b 에 있는가 — 합성어(숙박시설⊃숙박)도 잡는다 */
function overlaps(a: Set<string>, bFlat: string): { hit: string | null } {
  for (const t of a) if (t.length >= 2 && bFlat.includes(t)) return { hit: t };
  return { hit: null };
}

/** 낱말 하나를 동의어까지 펼친다 */
function expandSubject(token: string): string[] {
  const group = SUBJECT_SYNONYMS.find((g) => g.includes(token));
  return group ? group : [token];
}

function classOf(flat: string): string | null {
  for (const [name, words] of Object.entries(FACILITY_CLASSES)) {
    if (words.some((w) => flat.includes(w))) return name;
  }
  return null;
}

/** CTA 문구에서 행동 낱말을 뽑는다 ("🔗 경주시에서 예약하기" → 예약) */
export function actionOf(text: string): string | null {
  const t = norm(text);
  for (const key of Object.keys(ACTION_SYNONYMS)) if (t.includes(key)) return key;
  return null;
}

/**
 * 목적지가 이 글·이 행동에 맞는가. 맞지 않으면 **링크를 빼라는 뜻**이다(잘못된 링크보다 없는 편이 낫다).
 * 판단 재료가 주소뿐이면(근거 장부에 제목·본문이 없으면) 주소만으로 본다 — 모르면 막지 않는다(회귀 방지).
 */
export function checkCtaMatch(input: {
  keyword: string;
  title?: string;
  /** CTA 가 약속하는 행동 문구(버튼·후크) */
  action?: string;
  destination: CtaDestinationInfo;
}): CtaMatchVerdict {
  const dest = input.destination || ({ url: '' } as CtaDestinationInfo);
  const url = String(dest.url || '');
  if (!url) return { ok: false, failed: 'CTA_DESTINATION_MATCH', reason: '목적지 주소가 없다' };

  // 목적지를 설명하는 글자 — 주소(호스트·경로) + 근거 장부의 제목·본문 앞부분
  const destFlat = norm(`${url} ${dest.title || ''} ${String(dest.text || '').slice(0, 600)}`);
  const articleFlat = norm(`${input.keyword} ${input.title || ''}`);
  const article = subjectTokens(articleFlat);
  const knowsDestination = !!(dest.title || dest.text);

  /* ① CTA_DESTINATION_MATCH — 다른 종류의 시설·기관인가 */
  if (knowsDestination) {
    const articleClass = classOf(articleFlat);
    const destClass = classOf(destFlat);
    if (articleClass && destClass && articleClass !== destClass) {
      return { ok: false, failed: 'CTA_DESTINATION_MATCH', reason: `이 글은 ${articleClass}인데 목적지는 ${destClass} 페이지다 (${dest.title || url})` };
    }
  }

  /* ② CTA_ENTITY_MATCH — 이 글의 주체와 겹치는가 (지역·일반어는 빼고) */
  const expanded = new Set<string>([...article].flatMap(expandSubject));
  const ent = overlaps(expanded, destFlat);
  if (knowsDestination && !ent.hit) {
    return { ok: false, failed: 'CTA_ENTITY_MATCH', reason: `목적지에 이 글의 주제 낱말이 없다 (${[...article].slice(0, 4).join('·')} ↔ ${dest.title || url})` };
  }

  /* ③ CTA_ACTION_MATCH — 이 행동을 할 수 있는 곳인가 */
  const action = actionOf(String(input.action || ''));
  if (action && knowsDestination) {
    const words = ACTION_SYNONYMS[action] || [action];
    const canAct = words.some((w) => destFlat.includes(w));
    if (!canAct) {
      return { ok: false, failed: 'CTA_ACTION_MATCH', reason: `"${action}" 을(를) 할 수 있는 화면이 아니다 (${dest.title || url})` };
    }
  }

  return { ok: true, failed: null, reason: knowsDestination ? `주제·행동 일치 (${ent.hit || '주소만'})` : '목적지 정보 없음 — 주소만으로는 막지 않는다' };
}
