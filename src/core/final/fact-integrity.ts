import { containsValueToken, normalizeForMatch } from './number-token';
import { resolveDerivedDifferences, resolveHypotheticalValues, type DerivedCheck } from './derived-difference';
import { resolveEvidenceArithmetic } from './derived-arithmetic';
import { extractRanges, rangesOf, sameRange, isRangeBound, boundTokens } from './range-value';

export type FactTrustLevel = 'strong' | 'weak' | 'none';

export interface FactEvidence {
  context: string;
  provider: string;
  trustLevel: FactTrustLevel;
  sourceUrls?: string[];
  topic?: string;
  /**
   * v3.8.753 — 이 값이 가리키는 **대상**(표의 행 이름표 등). 우대형·일반형·1차·2차 같은 유형 낱말이 있으면
   * 근거에서 그 낱말 곁에 있는 값만 인정한다 — 다른 상품·다른 유형의 같은 숫자로 통과시키지 않는다.
   * 유형 낱말이 없는 이름표는 예전과 같다(값 존재만 본다).
   */
  subjectHint?: string;
  /**
   * v3.8.757 — 문장이 속한 블록(h3 content 등)의 HTML. "20만 원 차이" 같은 파생 차액은 같은 블록의 표에서
   * 두 피연산자를 찾아 검산한다. 없으면 검사 대상 HTML 자체를 블록으로 본다.
   */
  blockHtml?: string;
}

export type FactIntegrityViolationKind =
  | 'unsupported_exact_value'
  | 'unsupported_range'
  | 'unsupported_institution';

export interface FactIntegrityViolation {
  kind: FactIntegrityViolationKind;
  sentence: string;
  detail: string;
  location?: string;
}

export interface FactIntegrityReport {
  status: 'passed' | 'blocked';
  checkedClaims: number;
  violations: FactIntegrityViolation[];
  /** v3.8.757 — 파생 차액 검산 기록(검증·불일치·확인 불가). 캡처용 */
  derived?: DerivedCheck[];
}

export interface FactIntegrityArticle {
  introduction: string;
  conclusion: string;
  sections: Array<{
    h2: string;
    h3Sections: Array<{
      h3: string;
      content: string;
      tables?: Array<{ headers?: string[]; rows?: string[][]; [key: string]: any }>;
      cta?: { hookingMessage?: string; buttonText?: string; text?: string; hook?: string; [key: string]: any };
      [key: string]: any;
    }>;
    [key: string]: any;
  }>;
  [key: string]: any;
}

const FACT_META_BOILERPLATE_PATTERN = /(?:세부\s*기준은\s*)?(?:발행\s*시점의\s*)?공식\s*안내(?:를)?\s*확인(?:해\s*주세요|하세요|이\s*필요합니다)?[.!]?/gi;
const FACT_SENSITIVE_PATTERN = /(신청|접수|마감|지원|지급|대상|자격|요건|조건|기간|일정|발표|공고|모집|혜택|할인|가격|금액|수령|가능|받을|시행|개정|기준|출처|통계|조사|자료|안내|밝혔)/;
// v3.8.368: 기관명 오탐으로 본문이 과도하게 삭제되던 문제 fix
//   과거: 접미사에 단일 글자(부|청|원|도|시|군|구)가 포함돼 있어 일반 명사를 기관명으로 오인했다.
//         "육아휴직제도", "만족도", "육아지원", "정확도", "온라인신청" 등이 전부 "근거 미확인 기관명"으로
//         잡혀 문장째 삭제됐고, 이것이 "[FACT] 25건 제거"의 큰 몫이었다.
//   현재: 실제 기관 접미사(2글자 이상)와 중앙부처 고유명만 매칭한다.
//   주의: 뒤에 (?![가-힣]) 같은 경계를 붙이면 "고용노동부가", "국민연금공단에서"처럼 조사가 붙은
//         실제 문장에서 기관명을 전부 놓치므로 경계를 두지 않는다. (실측 검증 완료)
const INSTITUTION_PATTERN = /(?:[가-힣]{2,}(?:특별자치도|특별자치시|특별시|광역시|자치시|위원회|대학교|공단|공사|재단|센터|은행|공제회|진흥원|연구원|시청|군청|구청|도청|교육청)|(?:국세청|관세청|경찰청|소방청|병무청|기상청|산림청|조달청|통계청|특허청|검찰청|질병관리청)|[가-힣]{2,}(?:노동부|복지부|가족부|재정부|안전부|통신부|관광부|식품부|자원부|교통부|수산부|기업부|보훈부)|(?:교육부|통일부|외교부|법무부|국방부|환경부)|(?:경기|강원|충청북|충청남|전라북|전라남|경상북|경상남|제주)도)/g;
const VALUE_PATTERNS = [
  /20\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g,
  /20\d{2}\s*년/g,
  /\d{1,2}\s*월\s*\d{1,2}\s*일/g,
  /\d{4}-\d{1,2}-\d{1,2}/g,
  // v3.8.594: 긴 단위를 먼저 놓는다. `개|개월` 순서라 "120개월"에서 "120개"가 뽑혔고,
  //   그 잘린 값이 다른 글의 "20개"를 확인해 주는 근거로 쓰였다 (number-token 머리말 참고).
  // v3.8.753 — %p·퍼센트포인트는 % 보다 앞에(긴 단위 먼저). "12%p" 에서 "12%" 만 뽑히면 비율과 포인트가 섞인다
  // v3.8.756 — "90만 원"(단위 띄어쓰기)도 값이다. 실측(run f607bc 재생): "90만원" 은 추출·대조됐지만 "90만 원" 은 토큰이 안 뽑혀
  //   대조 없이 지나갔다(억 은 이미 `억(?:\s*원)?` 로 허용돼 있었다). 숫자와 단위 사이 공백만 허용한다(셀은 태그로 갈려 toPlainText 가 공백 하나로 바꾸므로 경계를 넘지 않는다).
  //   숫자부: 예전 `\d{1,3}(?:,\d{3})*` 는 쉼표 없는 4자리 이상("3600만 원")에서 뒤 세 자리("600만 원")만 뽑았다(재생에서 000만원·600만원 위반으로 드러남).
  //   쉼표 묶음이거나 통째 숫자, 그리고 앞이 숫자·쉼표·소수점이 아니어야 한다.
  // v3.8.767 — 시각의 분(20:30 의 30)은 값의 시작이 아니다(앞이 콜론) · 숫자와 단위 사이 공백은 줄바꿈(칸·블록 경계)을 넘지 않는다
  /(?<![\d.,:])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[^\S\n]*(?:만\s*원|원|억(?:\s*원)?|%p|퍼센트\s*포인트|%|퍼센트|명|건|개월|개|주|시간|일|세|회)/g,
];

/**
 * v3.8.767 — 칸·블록 경계를 지운 채 이어 붙이지 않는다.
 * 실측(run 69f928): `<td>20:30</td></tr></tbody></table><blockquote>주차 요금은…` 이 "20:30 주차 요금은" 이 되어
 * "30주"(기간)라는 없는 값이 뽑혔고, 그 한 값 때문에 주차 절 970자가 통째로 지워졌다.
 * 칸 끝은 " | ", 줄·문단·표·목록·인용 끝과 <br> 은 줄바꿈으로 남긴다 — 문장 분리기는 줄바꿈에서 끊고, 값 패턴은 줄바꿈을 넘지 않는다.
 */
function toPlainText(value: string): string {
  return String(value || '')
    .replace(/<\/(?:td|th)\s*>/gi, ' | ')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|tr|table|thead|tbody|tfoot|caption|blockquote|h[1-6]|ul|ol|dl|dt|dd|section|article|figure|figcaption)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[^\S\n]*\|[^\S\n]*(?=\n|$)/g, '')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function normalize(value: string): string {
  return toPlainText(value)
    .replace(/퍼센트\s*포인트/g, '%p')   // v3.8.753 — number-token 과 같은 단위 정규화
    .replace(/퍼센트/g, '%')
    .replace(/[\s,]/g, '')
    .replace(/[()\[\]{}]/g, '')
    .toLowerCase();
}

/** 유형을 가르는 낱말 — 이름표에 이게 있으면 값은 근거에서 이 낱말 곁에 있어야 한다 */
const SUBJECT_QUALIFIER = /(우대형|일반형|신규|기존|1차|2차|3차|지방|수도권|특별|가입자|재직자|취업자|소상공인|청년형|일반)/g;
const SUBJECT_WINDOW = 160;
/** 같은 축에서 서로를 가르는 낱말 — 이름표가 한쪽이면 다른 쪽이 값 앞에 선 문장은 이 행의 근거가 아니다 (v3.8.754) */
const QUALIFIER_GROUPS: string[][] = [['우대형', '일반형'], ['신규', '기존'], ['1차', '2차', '3차'], ['지방', '수도권']];
/** 값 앞의 "주어 조각"은 같은 문장에서 직전 값 뒤부터다 — "일반형 6% 우대형 12%" 에서 12% 의 조각은 " 우대형 " */
const PRIOR_VALUE = /\d[\d.]*\s*(?:%p|%|만\s*원|원|억|만)/g;
const SENTENCE_BREAK = /[.!?。]/;
/** 값 바로 뒤(12자 안)의 부정 — "12%가 적용되지 않는다"·"12%를 받지 못한다"·"12%가 아니라" */
const NEGATION_AFTER = /^.{0,12}?(?:않|못|아니|제외|미적용)/;
/** 값 바로 뒤 괄호의 이름표 — "6%(일반형) 또는 12%(우대형)". 이 꼴은 괄호 안 낱말이 그 값의 주어다 (v3.8.755, 실측 run f607bc E24) */
const POSTFIX_LABEL = /^\s*\(\s*(우대형|일반형|신규|기존|1차|2차|3차|지방|수도권|특별|가입자|재직자|취업자|소상공인|청년형|일반)/;
/** 직전 값에 붙은 괄호 이름표 — 다음 값의 주어 조각에서 뺀다 */
const PRIOR_POSTFIX = /^\s*\([^)]{0,12}\)/;

/**
 * 주어 대조용 정규화 — normalizeForMatch 와 달리 **괄호·쉼표를 남긴다.**
 * "6%(일반형) 또는 12%(우대형)" 와 "일반형 6%, 우대형 12%" 는 괄호를 지우면 같은 글자가 되어 가를 수 없다.
 * 숫자 안의 쉼표(3,600)만 지워 값 토큰(3600만)과 맞춘다.
 */
function normalizeForSubject(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/퍼센트\s*포인트/g, '%p')
    .replace(/퍼센트/g, '%')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * v3.8.753 — 값이 이름표의 유형 낱말 곁에 있는가. 이름표에 유형 낱말이 없으면 판단하지 않는다(null).
 * 실측(run 1b7d92 표): "우대형 기여금 | 납입액의 12퍼센트" — 근거의 "우대형에는 12%" 곁에 있어야 통과.
 * 근거에 "청년도약계좌 12%" 만 있고 "우대형" 이 없으면 숫자가 같아도 그 행의 값이 아니다.
 *
 * v3.8.754 — "160자 안에 있다" 만으로는 "일반형 6%, 우대형 12%" 한 문장에서 일반형 행의 12% 도 통과한다(반례).
 * 값마다 **같은 문장에서 직전 값 뒤의 주어 조각**을 보고, 거기 선 낱말이 이름표와 같은 축의 반대편이면 그 값은 세지 않는다.
 * 값 바로 뒤가 부정("적용되지 않는다")이면 세지 않는다. 문장에 유형 낱말이 없으면 표처럼 줄이 갈린 경우로 보고
 * 가장 가까운 앞 낱말 하나만 본다. 그래도 못 찾으면 false(미확인) — 오답보다 못 찾음이 낫다.
 * contextText 는 normalizeForMatch 를 지난 글이다(쉼표·줄바꿈 없음, 괄호는 공백).
 */
function nearSubject(normalizedValue: string, contextText: string, subjectHint: string | undefined): boolean | null {
  const hinted = new Set<string>(String(subjectHint || '').match(SUBJECT_QUALIFIER) || []);
  if (hinted.size === 0) return null;
  const rivals = new Set<string>(QUALIFIER_GROUPS.filter((g) => g.some((q) => hinted.has(q))).flat().filter((q) => !hinted.has(q)));
  const spaced = normalizedValue.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
  const re = new RegExp(`(?<![\\d.])${spaced}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(contextText)) !== null) {
    if (m[0].length === 0) { re.lastIndex += 1; continue; }
    const before = contextText.slice(Math.max(0, m.index - SUBJECT_WINDOW), m.index);
    const after = contextText.slice(m.index + m[0].length, m.index + m[0].length + SUBJECT_WINDOW);
    const sentenceAfter = after.split(SENTENCE_BREAK)[0] || '';
    if (NEGATION_AFTER.test(sentenceAfter)) continue;
    // "12%(우대형)" — 값 뒤 괄호의 이름표가 곧 주어. 앞쪽 조각은 보지 않는다
    const postfix = sentenceAfter.match(POSTFIX_LABEL);
    if (postfix) {
      if (rivals.has(postfix[1]!)) continue;
      if (hinted.has(postfix[1]!)) return true;
      continue;
    }
    let cut = 0;
    for (let i = before.length - 1; i >= 0; i -= 1) if (SENTENCE_BREAK.test(before[i]!)) { cut = i + 1; break; }
    const sentenceBefore = before.slice(cut);
    let segment = sentenceBefore;
    PRIOR_VALUE.lastIndex = 0;
    let pv: RegExpExecArray | null;
    while ((pv = PRIOR_VALUE.exec(sentenceBefore)) !== null) segment = sentenceBefore.slice(pv.index + pv[0].length).replace(PRIOR_POSTFIX, '');
    let qualifiers = segment.match(SUBJECT_QUALIFIER) || [];
    if (qualifiers.length === 0) {
      const tail = sentenceAfter.slice(0, 12).match(SUBJECT_QUALIFIER);          // "12% 우대형" 처럼 바로 뒤에 붙은 이름표
      const prev = before.match(SUBJECT_QUALIFIER);                              // 표처럼 줄이 갈렸으면 가장 가까운 앞 낱말 하나
      qualifiers = tail ? tail : prev ? [prev[prev.length - 1]!] : [];
    }
    if (qualifiers.length === 0 || qualifiers.some((q) => rivals.has(q))) continue;
    if (qualifiers.some((q) => hinted.has(q))) return true;
  }
  return false;
}

/**
 * 🔢 v3.8.619 — 마침표라고 다 문장 끝이 아니다.
 *
 * ## 실사고 (leadernam.com 발행글, 2026-09-01)
 * 발행된 본문에 이런 문장이 그대로 나갔다:
 *   · "인상률은 3. 봉급표상 기존 봉급액에 1. 039를 곱하는 방식"
 *   · "한국은행의 … 평균인 연 4."
 *
 * 원인은 여기였다. `split(/[.!?]+/)` 이 **소수점을 문장 끝으로** 봤다.
 *   "연 4.35%였습니다" → ["연 4", "35%였습니다"]
 * 앞조각 "연 4" 는 수치가 없어 통과하고, 뒷조각의 "35%" 는 근거 장부에 없어
 * 문장째 삭제된다. 그래서 **반토막 "연 4." 만 남았다.**
 *
 * 숫자를 지키자는 검사가 숫자를 부순 셈이다. 근거가 없으면 그 값이 든 문장을
 * **통째로** 지워야지, 소수점 뒤만 잘라 "연 4." 를 남기면 그건 틀린 정보다.
 *
 * ## 판정 규칙
 * 마침표 앞뒤가 모두 숫자면 문장 끝이 아니다 — 소수점(4.35)·배수(1.039)·
 * 날짜(2026. 8. 30.)가 모두 여기 걸린다. 그 외에는 예전대로 문장 끝이다.
 */
function isSentenceEndingDot(source: string, index: number): boolean {
  const before = source.slice(0, index).replace(/\s+$/, '').slice(-1);
  const after = source.slice(index + 1).replace(/^\s+/, '').slice(0, 1);
  return !(/\d/.test(before) && /\d/.test(after));
}

/** 문장 단위로 자른다 — 종결부호를 문장에 붙인 채로 돌려준다 */
export function splitSentencesForFactCheck(value: string): string[] {
  const source = toPlainText(value);
  const out: string[] = [];
  let buffer = '';

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    buffer += ch;
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '\n') continue;
    if (ch === '.' && !isSentenceEndingDot(source, i)) continue;

    // "?!" 처럼 이어진 종결부호는 같은 문장에 붙인다
    while (i + 1 < source.length && /[.!?]/.test(source[i + 1]!)) {
      buffer += source[i + 1]!;
      i += 1;
    }
    out.push(buffer);
    buffer = '';
  }
  if (buffer) out.push(buffer);

  return out.map((sentence) => sentence.trim()).filter(Boolean);
}

function splitSentences(value: string): string[] {
  return splitSentencesForFactCheck(value)
    .map((sentence) => sentence.replace(/[.!?]+$/, '').trim())
    .filter((sentence) => sentence.length >= 4);
}

/** v3.8.761 — 문단의 값 토큰(정규화)을 밖에서도 쓴다(final-authority · fact-guard 보호 대상 계산) */
export function extractValueTokens(value: string): string[] { return extractExactValues(value); }

function extractExactValues(value: string): string[] {
  const values = new Set<string>();
  // v3.8.767 — 태그가 남은 글도 칸·블록 경계를 살린 평문으로 읽는다(경계 너머 글자와 붙은 값을 만들지 않는다)
  const text = /<[a-z/][^>]*>/i.test(String(value || '')) ? toPlainText(value) : String(value || '');
  for (const pattern of VALUE_PATTERNS) {
    const matches = text.match(pattern) || [];
    for (const match of matches) values.add(normalize(match));
  }
  return [...values].filter(Boolean);
}

function extractInstitutions(value: string): string[] {
  const values = new Set<string>();
  const matches = toPlainText(value).match(INSTITUTION_PATTERN) || [];
  for (const match of matches) {
    const normalized = normalize(match);
    if (normalized.length >= 3) values.add(normalized);
  }
  return [...values];
}

function hasStrongEvidence(evidence: FactEvidence): boolean {
  return evidence.trustLevel === 'strong' && toPlainText(evidence.context).length >= 20;
}

function hasCitableEvidence(evidence: FactEvidence): boolean {
  if (!hasStrongEvidence(evidence)) return false;
  return Array.isArray(evidence.sourceUrls)
    && evidence.sourceUrls.some((url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim()));
}

// v3.8.368: 현재/내년 연도 "단독" 토큰은 시스템이 프롬프트에 직접 주입하는 값이므로 근거가 필요 없다.
//   배경: generateH1TitleFinal이 "정책·지원금 주제면 ${currentYear}년을 제목 맨 앞에" 라고 지시해놓고,
//         FACT 검사가 그 연도를 "근거 장부에 없음"으로 판정해 제목을 통째로 버리던 자기모순이 있었다.
//   안전성: "2026년 3월 15일" 같은 구체 날짜는 VALUE_PATTERNS의 전체 날짜 패턴으로 별도 매칭되므로
//           여기서 통과시켜도 여전히 검증 대상으로 남는다. 통과하는 것은 오직 "20XX년" 단독 토큰뿐이다.
function isSystemKnownYearToken(normalizedValue: string): boolean {
  const matched = /^(20\d{2})년$/.exec(normalizedValue);
  if (!matched) return false;
  const year = Number(matched[1]);
  const currentYear = new Date().getFullYear();
  return year === currentYear || year === currentYear + 1;
}

// v3.8.369: 출처 URL이 없다는 이유로 근거 본문 전체가 무시되던 문제 fix
//   과거: evidenceIsStrong(= trustLevel 'strong' + sourceUrls 보유)이 false면
//         isSupportedToken이 무조건 false를 반환해 본문의 모든 수치·기관명이 "미확인"이 됐다.
//         팩트체크 Naver 폴백은 trustLevel='weak' + sourceUrls 없음으로 반환되므로,
//         2,000자 넘는 근거를 확보하고도 본문 25건이 통째로 삭제되어 글이 회피성으로 남았다.
//         (사용자 보고: "4장 전체가 '고용24 화면 안내를 기준으로'로만 끝난다")
//   현재: 근거 본문이 충분히 길면 그 본문 대조로 검증한다.
//         URL 인용 여부는 근거의 '강도'일 뿐 '유무'가 아니다.
//         토큰이 근거 본문에 실제로 등장해야 통과하므로 없는 수치를 지어내는 것은 여전히 차단된다.
const SUBSTANTIAL_CONTEXT_MIN_LENGTH = 200;

function isSupportedToken(value: string, evidence: FactEvidence, evidenceIsStrong = hasCitableEvidence(evidence)): boolean {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return true;
  if (isSystemKnownYearToken(normalizedValue)) return true;
  /**
   * v3.8.594: 부분 문자열이 아니라 **그 수치로** 들어 있는지 본다.
   *   예전 includes 대조는 "120개월" 안의 "20개"를 확인된 값으로 통과시켰다.
   *
   * 수치는 공백을 살린 정규화로 본다 — 공백을 지우면 "S10 3년"이 "s103년"이 되어
   * 멀쩡한 값이 남의 숫자 꼬리로 몰린다. 기관명은 예전대로 공백 없는 대조를 쓴다.
   */
  const isNumeric = /^\d/.test(normalizedValue);
  const has = (haystack: string): boolean =>
    isNumeric ? containsValueToken(haystack, normalizedValue) : haystack.includes(normalizedValue);
  const topicText = isNumeric ? normalizeForMatch(evidence.topic || '') : normalize(evidence.topic || '');
  if (topicText && has(topicText)) return true;
  const contextText = isNumeric ? normalizeForMatch(evidence.context || '') : normalize(evidence.context || '');
  // v3.8.760 — 근거의 범위 표기("13.2~14.4%")의 하한·상한도 그 값이다. 실측(run d7a142): "13.2%" 가 "13.2~" 로만 있어 미확인이 됐다
  if (!has(contextText)) return isNumeric && isRangeBound(normalizedValue, rangesOf(contextText)) && (evidenceIsStrong || contextText.length >= SUBSTANTIAL_CONTEXT_MIN_LENGTH);
  // v3.8.753 — 이름표에 유형 낱말이 있으면 그 곁의 값만 인정한다(다른 상품·다른 유형의 같은 숫자 차단)
  //   v3.8.755 — 주어 대조는 괄호를 남긴 정규화로 한다("6%(일반형) 또는 12%(우대형)" 을 가르기 위해)
  if (isNumeric && evidence.subjectHint && nearSubject(normalizedValue, normalizeForSubject(evidence.context || ''), evidence.subjectHint) === false) return false;
  return evidenceIsStrong || contextText.length >= SUBSTANTIAL_CONTEXT_MIN_LENGTH;
}

function inspectSentence(sentence: string, evidence: FactEvidence, derivedOut?: DerivedCheck[]): FactIntegrityViolation[] {
  const violations: FactIntegrityViolation[] = [];
  const exactValues = extractExactValues(sentence);
  const institutions = extractInstitutions(sentence);
  const sensitive = FACT_SENSITIVE_PATTERN.test(sentence);
  const evidenceIsStrong = hasCitableEvidence(evidence);
  const inherentlyTimeSensitiveValues = exactValues.filter((value) => /20\d{2}|월|만원|원|억|%|퍼센트|세|^\d{4}-/.test(value));
  const valuesToVerify = sensitive ? exactValues : inherentlyTimeSensitiveValues;

  /**
   * v3.8.760 — 범위 표기는 구조(하한·상한·단위)로 대조한다. 문장의 "13.2%에서 14.4%" 는 근거에 같은 범위가 묶여 있어야 지원된다 —
   * 하한·상한이 근거 어딘가에 따로 있는 것(상품 A 13.2%, 상품 B 14.4%)으로는 범위를 지원하지 않는다.
   */
  const sentenceRanges = extractRanges(sentence);
  const evidenceRanges = sentenceRanges.length ? rangesOf(normalizeForMatch(evidence.context || '')) : [];
  const supportedBounds = new Set<string>();
  for (const r of sentenceRanges) {
    if (evidenceRanges.some((e) => sameRange(e, r))) { for (const t of boundTokens(r)) supportedBounds.add(normalize(t)); continue; }
    violations.push({ kind: 'unsupported_range', sentence, detail: `근거 장부에 같은 범위가 없음: ${r.raw.replace(/\s+/g, ' ').trim()}` });
  }

  if (valuesToVerify.length > 0) {
    let unsupported = valuesToVerify.filter((value) => !supportedBounds.has(normalize(value)) && !isSupportedToken(value, evidence, evidenceIsStrong));
    // v3.8.757 — 직접 근거가 없는 값이라도 같은 블록의 표로 검산되는 단순 차액이면 지원된 것으로 본다(검산 기록은 derived 로 남긴다)
    if (unsupported.length > 0 && evidence.blockHtml) {
      const { resolved, checks } = resolveDerivedDifferences(sentence, unsupported, evidence.blockHtml, evidence.context || '', (t) => isSupportedToken(t, evidence, evidenceIsStrong));
      derivedOut?.push(...checks);
      unsupported = unsupported.filter((value) => !resolved.has(value));
    }
    // v3.8.767 — 근거 값 두 개의 한 단계 계산(|a−b| · a×r% · a×(1−r%))은 같은 문장·같은 표에 피연산자가 있고 같은 근거 문서에 함께 있으면 지원한다(DERIVED_FROM_EVIDENCE)
    if (unsupported.length > 0 && evidence.blockHtml) {
      const { resolved, checks } = resolveEvidenceArithmetic(sentence, unsupported, evidence.blockHtml, evidence.context || '', (t) => isSupportedToken(t, evidence, evidenceIsStrong));
      derivedOut?.push(...checks);
      unsupported = unsupported.filter((value) => !resolved.has(value));
    }
    // v3.8.760 — 명시적 가정 예시의 기준값·계산값은 공식 사실이 아니다(P1-D). 가정 표지가 붙은 값과, 검증된 규칙으로 그 기준값에서 나오는 값만 지원한다
    if (unsupported.length > 0 && evidence.blockHtml) {
      const { resolved, checks } = resolveHypotheticalValues(sentence, unsupported, evidence.blockHtml, evidence.context || '', (t) => isSupportedToken(t, evidence, evidenceIsStrong));
      derivedOut?.push(...checks);
      unsupported = unsupported.filter((value) => !resolved.has(value));
    }
    if (unsupported.length > 0) {
      violations.push({
        kind: 'unsupported_exact_value',
        sentence,
        detail: `근거 장부에서 확인되지 않은 정확한 값: ${unsupported.join(', ')}`,
      });
    }
  }

  if (institutions.length > 0 && (sensitive || exactValues.length > 0)) {
    const unsupported = institutions.filter((name) => !isSupportedToken(name, evidence, evidenceIsStrong));
    if (unsupported.length > 0) {
      violations.push({
        kind: 'unsupported_institution',
        sentence,
        detail: `근거 장부에서 확인되지 않은 기관명: ${unsupported.join(', ')}`,
      });
    }
  }

  return violations;
}

export function inspectFactIntegrity(html: string, evidence: FactEvidence): FactIntegrityReport {
  const sentences = splitSentences(html);
  // v3.8.757 — 블록 문맥(표)을 문장 검사에 넘긴다. 호출부가 안 주면 검사 대상 HTML 자체가 블록이다
  const blockEvidence: FactEvidence = evidence.blockHtml ? evidence : { ...evidence, blockHtml: String(html || '') };
  const derived: DerivedCheck[] = [];
  const violations = sentences.flatMap((sentence) => inspectSentence(sentence, blockEvidence, derived));

  return {
    status: violations.length > 0 ? 'blocked' : 'passed',
    checkedClaims: sentences.length,
    violations,
    ...(derived.length ? { derived } : {}),
  };
}

// 제목(H2/H3)은 문장이 아니라 라벨이다. 문장 단위 필터로 지우면 제목이 통째로 비므로
// 근거 미확인 토큰만 도려내고, 남는 게 없을 때만 폴백 라벨을 돌려준다.
function sanitizeHeadingText(block: string, evidence: FactEvidence, fallback: string): string {
  let value = toPlainText(block).replace(FACT_META_BOILERPLATE_PATTERN, '');
  for (const pattern of VALUE_PATTERNS) {
    value = value.replace(pattern, (match) => isSupportedToken(match, evidence) ? match : '');
  }
  value = value.replace(INSTITUTION_PATTERN, (match) => isSupportedToken(match, evidence) ? match : '');
  return value.replace(/\s{2,}/g, ' ').replace(/^[\s,·\-:]+|[\s,·\-:]+$/g, '').trim() || fallback;
}

/**
 * 🔗 v3.8.619 — 링크가 든 블록은 **태그를 살린 채** 값만 도려낸다.
 *
 * ## 실사고 (leadernam.com 발행글 2편, 2026-09-01)
 * 두 글 모두 바깥으로 나가는 링크가 **0개**로 발행됐다. CTA 가 부정확한 게 아니라
 * 아예 없어진 것이다. 사장님: "CTA가 정확하면 좋겠는데 여전히 불안정해".
 *
 * 원인은 이 파일이었다. 근거 미확인 문장이 든 문단은 `keepVerifiedSentences` 로 넘어가는데,
 * 그 함수는 `toPlainText` 로 **태그를 통째로 지운 뒤** 문장을 고른다.
 * 그래서 살아남은 문장에서도 `<a href>` 가 사라지고, 아무 문장도 못 살리면 문단째 지워진다.
 * CTA 는 대개 수치("최대 5,000만원")를 끼고 있어서 이 경로에 가장 잘 걸린다.
 *
 * ## 처방
 * 블록 안에 링크가 있으면 문장 단위로 버리지 않는다. 태그 밖의 글자에서만
 * 근거 미확인 값을 지우고 나머지는 그대로 둔다 — 링크는 무슨 일이 있어도 남긴다.
 * (태그 안을 건드리면 href 의 연도·숫자가 잘려 링크가 깨진다. 그래서 태그 밖만 손댄다.)
 */
function stripUnsafeValuesPreservingMarkup(html: string, evidence: FactEvidence): string {
  return String(html || '').replace(/(<[^>]*>)|([^<]+)/g, (_all, tag: string, text: string) => {
    if (tag) return tag;                       // 태그 안은 절대 건드리지 않는다
    let value = String(text || '');
    for (const pattern of VALUE_PATTERNS) {
      value = value.replace(pattern, (match) => (isSupportedToken(match, evidence) ? match : ''));
    }
    value = value.replace(INSTITUTION_PATTERN, (match) => (isSupportedToken(match, evidence) ? match : ''));
    return value.replace(/\s{2,}/g, ' ');
  });
}

/** 이 블록이 링크를 품고 있는가 — 품고 있으면 통째로 버릴 수 없다 */
function hasAnchor(html: string): boolean {
  return /<a\b[^>]*href\s*=/i.test(String(html || ''));
}

// 태그 없는 평문 제목 전용 진입점 — 어떤 입력에도 빈 문자열을 반환하지 않는다.
export function sanitizeFactUnsafeHeading(heading: string, evidence: FactEvidence, fallback: string): string {
  const source = String(heading || '').replace(FACT_META_BOILERPLATE_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
  if (!toPlainText(source)) return fallback;
  if (inspectFactIntegrity(source, evidence).status === 'passed') return source;
  const cleaned = sanitizeHeadingText(source, evidence, fallback);
  if (cleaned === fallback) return fallback;
  return inspectFactIntegrity(cleaned, evidence).status === 'passed' ? cleaned : fallback;
}

/**
 * v3.8.666 — 주소는 문장이 아니다.
 * 실측(v3.8.665, 두 편): "https://www.mt.co.kr/policy/…" 가 "www. mt. co. kr" 로 나갔다 — 아래 문장 분리가 주소 안의
 * 마침표에서 끊고 공백으로 이었다. 자가 수정 경로는 v3.8.658 에 막았지만 이 경로는 그대로였다.
 * 주소를 자리표로 바꿔 두고 검사한 뒤 되돌린다. 주소 안의 숫자(2026/09/06)도 수치로 세지 않게 된다.
 */
const URL_TOKEN = /(?:https?:\/\/|www\.)[^\s<>"']+/g;
const URL_SLOT = /␂U(\d+)␂/g;
export function sanitizeFactUnsafeHtml(html: string, evidence: FactEvidence): string {
  const urls: string[] = [];
  const masked = String(html || '').replace(URL_TOKEN, (u) => { urls.push(u); return `␂U${urls.length - 1}␂`; });
  const out = sanitizeFactUnsafeHtmlMasked(masked, evidence);
  return urls.length === 0 ? out : out.replace(URL_SLOT, (_m, i: string) => urls[Number(i)] ?? '');
}

function sanitizeFactUnsafeHtmlMasked(html: string, outerEvidence: FactEvidence): string {
  const withoutMetaBoilerplate = String(html || '').replace(FACT_META_BOILERPLATE_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
  // v3.8.757 — 문장·칸 단위로 다시 검사할 때도 블록(표 포함) 문맥을 잃지 않는다: "20만 원 차이" 는 같은 블록의 표로 검산된다
  const evidence: FactEvidence = outerEvidence.blockHtml ? outerEvidence : { ...outerEvidence, blockHtml: withoutMetaBoilerplate };
  if (inspectFactIntegrity(withoutMetaBoilerplate, evidence).status === 'passed') return withoutMetaBoilerplate;

  /**
   * v3.8.666 — 지운 문장 뒤에 "다만 이 수치는…", "두 내용은…" 처럼 앞을 가리키는 문장이 남으면 그것도 뺀다.
   * 실측(v3.8.665, 세 자리): 근거 없는 문장을 지운 자리 뒤에 지시어 문장이 허공을 가리킨 채 남았다. 되풀이 삭제와 같은 눈이다.
   */
  const { startsWithBackReference } = require('./refers-back');
  const keepVerifiedSentences = (block: string): string => {
    const kept: string[] = [];
    let droppedPrev = false;
    for (const sentence of splitSentencesForFactCheck(block)) {
      const ok = inspectFactIntegrity(sentence, evidence).status === 'passed';
      if (!ok || (droppedPrev && startsWithBackReference(sentence))) { droppedPrev = true; continue; }
      droppedPrev = false;
      kept.push(sentence);
    }
    return kept.join(' ').trim();
  };

  /**
   * 🧱 v3.8.619 — 표의 칸은 **지워도 자리는 남긴다.**
   *
   * 실사고: 4칸짜리 표의 한 줄이 `<td>` 2개로 나가 열이 통째로 밀렸다.
   * "연 4." | "고정형 조건을 검토하는 사람" — 마지막 열의 설명이 2번 열 자리에 앉았다.
   * 값이 빈 표는 "모른다"고 말하지만, **어긋난 표는 거짓말을 한다.**
   * 그래서 칸의 내용은 비울지언정 `<td>` 태그 자체는 절대 지우지 않는다.
   */
  const tagged = withoutMetaBoilerplate.replace(
    /<(p|li|blockquote|td|th|h[1-6])(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attrs: string, inner: string) => {
      if (inspectFactIntegrity(inner, evidence).status === 'passed') return `<${tag}${attrs}>${inner}</${tag}>`;

      const isCell = /^(td|th)$/i.test(tag);
      if (isCell) return `<${tag}${attrs}></${tag}>`;   // 칸은 비우되 자리는 지킨다

      // 링크가 든 블록은 통째로 버리지 않는다 — CTA 가 이 경로에서 사라졌다
      if (hasAnchor(inner)) {
        const kept = stripUnsafeValuesPreservingMarkup(inner, evidence);
        return `<${tag}${attrs}>${kept}</${tag}>`;
      }

      const cleaned = /^h[1-6]$/i.test(tag) ? sanitizeHeadingText(inner, evidence, '핵심 정보') : keepVerifiedSentences(inner);
      return cleaned ? `<${tag}${attrs}>${cleaned}</${tag}>` : '';
    },
  );

  if (inspectFactIntegrity(tagged, evidence).status === 'passed') return tagged;
  if (!/<[a-z][^>]*>/i.test(tagged)) return keepVerifiedSentences(tagged);
  /**
   * v3.8.619 — 마지막 관문에서도 링크는 지킨다.
   *
   * 블록 단위로 정리하고도 검사가 안 끝나면 예전에는 `''` 를 돌려 **전부** 버렸다.
   * 그 한 줄이 CTA 를 통째로 지운 마지막 경로다. 링크가 살아 있다면
   * 이미 값은 도려낸 상태이므로 그 결과를 쓴다 — 빈 글보다 낫다.
   */
  if (hasAnchor(tagged)) return stripUnsafeValuesPreservingMarkup(tagged, evidence);
  return narrowestRemoval(tagged, evidence, keepVerifiedSentences);
}

/**
 * v3.8.767 — 근거 없는 주장 1개 ≠ 절 전체 무효.
 * 실측(run 69f928): 가짜 값 "30주" 하나 때문에 이 자리까지 와서 `''` 가 돌아갔고, 주차 절 970자(위치·요금·초과 10분당 800원)가 통째로 사라졌다.
 * 태그별 정리를 지나고도 남은 위반은 태그(p·li·td …) 밖 맨 글자에 있다 — 그 조각만 문장 단위로 지운다.
 * 태그 안 문장은 이미 문장 단위로 정리됐다. 값만 도려내 반토막 문장을 남기지는 않는다(v3.8.619 "연 4." 사고).
 * 그래도 검사가 안 끝나거나(태그를 걸친 조각) 글자가 하나도 안 남으면 그때만 블록을 버린다. 새 호출 없음.
 */
function narrowestRemoval(tagged: string, evidence: FactEvidence, keepVerifiedSentences: (block: string) => string): string {
  const passes = (html: string) => inspectFactIntegrity(html, evidence).status === 'passed';
  const bare = tagged.replace(/(<[^>]*>)|([^<]+)/g, (_all, tag: string, text: string) => {
    if (tag) return tag;
    if (!String(text || '').trim() || passes(text)) return text;
    const kept = keepVerifiedSentences(text);
    return kept ? ` ${kept} ` : ' ';
  });
  if (!passes(bare) || !toPlainText(bare).replace(/[|\s]/g, '')) return '';
  return bare.replace(/\s{2,}/g, ' ').trim();
}

function mergeReports(reports: Array<{ report: FactIntegrityReport; location: string }>): FactIntegrityReport {
  const violations = reports.flatMap(({ report, location }) =>
    report.violations.map((violation) => ({ ...violation, location })),
  );
  const derived = reports.flatMap(({ report }) => report.derived || []);
  return {
    status: violations.length > 0 ? 'blocked' : 'passed',
    checkedClaims: reports.reduce((sum, item) => sum + item.report.checkedClaims, 0),
    violations,
    ...(derived.length ? { derived } : {}),
  };
}

export function inspectArticleFactIntegrity(article: FactIntegrityArticle, evidence: FactEvidence): FactIntegrityReport {
  const checks: Array<{ report: FactIntegrityReport; location: string }> = [
    { location: 'introduction', report: inspectFactIntegrity(article.introduction, evidence) },
    { location: 'conclusion', report: inspectFactIntegrity(article.conclusion, evidence) },
  ];

  for (const [sectionIndex, section] of (article.sections || []).entries()) {
    checks.push({ location: `section.${sectionIndex + 1}.h2`, report: inspectFactIntegrity(section.h2, evidence) });
    for (const [subsectionIndex, subsection] of (section.h3Sections || []).entries()) {
      const prefix = `section.${sectionIndex + 1}.h3.${subsectionIndex + 1}`;
      checks.push({ location: `${prefix}.title`, report: inspectFactIntegrity(subsection.h3, evidence) });
      checks.push({ location: `${prefix}.content`, report: inspectFactIntegrity(subsection.content, evidence) });
      for (const [tableIndex, table] of (subsection.tables || []).entries()) {
        checks.push({ location: `${prefix}.table.${tableIndex + 1}.headers`, report: inspectFactIntegrity((table.headers || []).join(' '), evidence) });
        checks.push({ location: `${prefix}.table.${tableIndex + 1}.rows`, report: inspectFactIntegrity((table.rows || []).flat().join(' '), evidence) });
      }
      if (subsection.cta) {
        checks.push({ location: `${prefix}.cta`, report: inspectFactIntegrity([
          subsection.cta.hookingMessage,
          subsection.cta.buttonText,
          subsection.cta.hook,
          subsection.cta.text,
        ].filter(Boolean).join(' '), evidence) });
      }
    }
  }

  return mergeReports(checks);
}

/**
 * v3.8.522 — 표 셀은 문장이 아니라 **라벨**이다.
 *
 * 사장님 실물 검수: "구분 | 가입 시점 | …" 표에서 앞 두 칸이 네 줄 모두 빈칸으로 나갔다.
 * 원인: 셀마다 sanitizeFactUnsafeHtml(문장 단위 필터)이 걸렸다. "2009년 10월 이전" 같은
 * 셀은 문장 하나뿐이라 근거 미확인이면 통째로 지워지고 빈 칸만 남는다.
 * 제목(H2/H3)은 이미 같은 이유로 라벨 취급을 하고 있었는데 표는 빠져 있었다.
 *
 * 처방:
 *  ① 셀은 문장이 아니라 라벨이므로 부분 삭제하지 않는다. 근거가 확인되면 그대로 두고,
 *     아니면 그 칸은 못 쓴다고 본다.
 *  ② 못 쓰는 칸이 하나라도 있으면 **그 줄을 통째로 버린다**.
 *     구멍 난 표는 없는 표보다 나쁘다 — 무엇에 대한 값인지 알 수 없어 독자를 오도한다.
 *     (근거 장부가 비어 있으면 결국 표가 통째로 빠진다. 검증 못 한 수치를 내보내는 것보다 낫다 —
 *      "정리 후에는 근거 없는 값이 남지 않는다"는 기존 계약도 이 쪽이라야 지켜진다.)
 *  ③ 줄이 하나도 안 남으면 표 자체를 버린다 (머리글만 남은 껍데기 금지).
 */
export function sanitizeFactUnsafeCell(value: string, evidence: FactEvidence): string {
  const source = String(value ?? '').replace(FACT_META_BOILERPLATE_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
  if (!source) return '';
  if (inspectFactIntegrity(source, evidence).status === 'passed') return source;
  return ''; // 호출부가 이 줄을 버린다
}

export function sanitizeArticleFactClaims<T extends FactIntegrityArticle>(article: T, evidence: FactEvidence): T {
  const sanitizeTable = (table: any) => {
    const headers = Array.isArray(table?.headers)
      ? table.headers.map((value: string) => sanitizeFactUnsafeCell(value, evidence) || String(value ?? ''))
      : table?.headers;
    if (!Array.isArray(table?.rows)) return { ...table, headers };
    // ② 구멍이 생기는 줄은 버린다
    const rows = table.rows.filter((row: string[]) => {
      if (!Array.isArray(row)) return false;
      return row.every((value) => {
        const original = String(value ?? '').trim();
        if (!original) return true;                       // 원래 빈 칸은 그대로 둔다
        return !!sanitizeFactUnsafeCell(value, evidence);  // 지워지는 칸이 있으면 줄째로 탈락
      });
    });
    return { ...table, headers, rows };
  };
  const sanitizeCta = (cta: any) => !cta ? cta : {
    ...cta,
    hookingMessage: cta.hookingMessage ? sanitizeFactUnsafeHtml(cta.hookingMessage, evidence) : cta.hookingMessage,
    buttonText: cta.buttonText ? sanitizeFactUnsafeHtml(cta.buttonText, evidence) : cta.buttonText,
    hook: cta.hook ? sanitizeFactUnsafeHtml(cta.hook, evidence) : cta.hook,
    text: cta.text ? sanitizeFactUnsafeHtml(cta.text, evidence) : cta.text,
  };

  return {
    ...article,
    introduction: sanitizeFactUnsafeHtml(article.introduction, evidence),
    conclusion: sanitizeFactUnsafeHtml(article.conclusion, evidence),
    sections: (article.sections || []).map((section, sectionIdx) => ({
      ...section,
      h2: sanitizeFactUnsafeHeading(section.h2, evidence, `섹션 ${sectionIdx + 1}`),
      h3Sections: (section.h3Sections || []).map((subsection, h3Idx) => ({
        ...subsection,
        h3: sanitizeFactUnsafeHeading(subsection.h3, evidence, `핵심 정리 ${h3Idx + 1}`),
        content: sanitizeFactUnsafeHtml(subsection.content, evidence),
        // ③ 줄이 하나도 안 남은 표는 껍데기라 버린다
        tables: Array.isArray(subsection.tables)
          ? subsection.tables.map(sanitizeTable).filter((t: any) => !Array.isArray(t?.rows) || t.rows.length > 0)
          : subsection.tables,
        cta: sanitizeCta(subsection.cta),
      })),
    })),
  } as T;
}

export function buildFactIntegrityPrompt(keyword: string, evidence: FactEvidence): string {
  /**
   * v3.8.753 — "충분하지 않습니다 … 일반 설명만" 은 유료 검증 요약이 없을 때 붙던 문장인데, 실측(run 1b7d92)에서는
   * 근거 블록에 문서 11건이 있는 채로 이 문장이 같이 갔다. 자료가 충분하다고 뒤집지도, 부족하다고 단정하지도 않는다 —
   * 어느 블록의 사실만 쓸 수 있는지만 말한다.
   */
  const evidenceState = hasCitableEvidence(evidence)
    ? `${evidence.provider}에서 수집한 검증 장부가 제공됩니다. 장부에 있는 사실만 사용할 수 있습니다.`
    : '유료 검증 요약은 없습니다. 위 [RESEARCH PACKET]·[FACT EVIDENCE] 블록에 적힌 사실만 쓸 수 있습니다 — 거기 없는 세부 조건은 쓰지 마세요.';

  return `
## FACT INTEGRITY: NON-NEGOTIABLE
주제: ${keyword}
${evidenceState}
- 근거에 없는 날짜, 금액, 비율, 인원, 신청 기간, 자격 조건, 기관명, 통계, URL은 절대 작성하지 마세요.
- 제공된 근거 장부에 없는 정확한 수치나 일정은 추정하거나 다른 사례로 보완하지 마세요.
- 확인되지 않은 최신 기준은 경고문이나 확인 안내로 대신하지 말고 해당 주장 자체를 생략하세요.
- "팩트체크 실패", "공식 안내를 확인하세요" 같은 내부 상태·면책 문구를 본문에 쓰지 마세요.
- 📎 **제도·지원금·기준을 설명할 때는 근거 문서를 최소 한 번 밝히세요.** (v3.8.649)
  "기관명 + 문서 종류 + 번호 또는 날짜" 꼴이면 됩니다 —
  예: 「임실군 공고 제2026-123호」, 「고용노동부 2026-09-03 보도자료」, 「○○ 조례 제12조」.
  근거에 그 문서가 있으면 반드시 본문에 적으세요. 독자가 확인할 수 없는 글은
  검색에서도 인용에서도 밀립니다. **없는 문서 번호를 지어내지는 마세요** —
  근거에 번호가 없으면 기관명과 발표 날짜만이라도 적습니다.
- 🚫 **자료가 부족하다는 사실을 독자에게 알리지 마세요.** (v3.8.641)
  "제공된 근거에는 ○○이 없으므로", "자료에 나와 있지 않아", "확인할 근거가 없어" 같은 말은
  독자에게 아무 쓸모가 없습니다. 당신이 무엇을 받았고 무엇을 못 받았는지는 독자의 관심사가 아닙니다.
  값이 없는 **곁가지 항목은 그 항목을 빼세요** — 소제목을 만들어 놓고 "근거가 없다"고 적으면 글이 비어 보입니다.
  단, **제목·소제목이 약속한 핵심 질문은 말없이 다른 이야기로 바꾸지 마세요.** (v3.8.753)
  그 질문은 「확인된 사실 / 아직 확인되지 않은 부분 / 독자가 자기 조건으로 확인할 부분」을 갈라 쓰고,
  "아직 발표되지 않았다"·"확인이 필요하다" 같은 상태는 그렇게 말할 근거가 있을 때만 씁니다.
- 사실처럼 보이는 예시 수치, 가상의 기관 발표, 출처 없는 인용을 만들지 마세요.
`;
}
