import { containsValueToken, normalizeForMatch } from './number-token';

export type FactTrustLevel = 'strong' | 'weak' | 'none';

export interface FactEvidence {
  context: string;
  provider: string;
  trustLevel: FactTrustLevel;
  sourceUrls?: string[];
  topic?: string;
}

export type FactIntegrityViolationKind =
  | 'unsupported_exact_value'
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
  /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:만원|원|억(?:\s*원)?|%|퍼센트|명|건|개월|개|주|시간|일|세|회)/g,
];

function toPlainText(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value: string): string {
  return toPlainText(value)
    .replace(/[\s,]/g, '')
    .replace(/[()\[\]{}]/g, '')
    .toLowerCase();
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

function extractExactValues(value: string): string[] {
  const values = new Set<string>();
  for (const pattern of VALUE_PATTERNS) {
    const matches = String(value || '').match(pattern) || [];
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
  if (!has(contextText)) return false;
  return evidenceIsStrong || contextText.length >= SUBSTANTIAL_CONTEXT_MIN_LENGTH;
}

function inspectSentence(sentence: string, evidence: FactEvidence): FactIntegrityViolation[] {
  const violations: FactIntegrityViolation[] = [];
  const exactValues = extractExactValues(sentence);
  const institutions = extractInstitutions(sentence);
  const sensitive = FACT_SENSITIVE_PATTERN.test(sentence);
  const evidenceIsStrong = hasCitableEvidence(evidence);
  const inherentlyTimeSensitiveValues = exactValues.filter((value) => /20\d{2}|월|만원|원|억|%|퍼센트|세|^\d{4}-/.test(value));
  const valuesToVerify = sensitive ? exactValues : inherentlyTimeSensitiveValues;

  if (valuesToVerify.length > 0) {
    const unsupported = valuesToVerify.filter((value) => !isSupportedToken(value, evidence, evidenceIsStrong));
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
  const violations = sentences.flatMap((sentence) => inspectSentence(sentence, evidence));

  return {
    status: violations.length > 0 ? 'blocked' : 'passed',
    checkedClaims: sentences.length,
    violations,
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

function sanitizeFactUnsafeHtmlMasked(html: string, evidence: FactEvidence): string {
  const withoutMetaBoilerplate = String(html || '').replace(FACT_META_BOILERPLATE_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
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
  return '';
}

function mergeReports(reports: Array<{ report: FactIntegrityReport; location: string }>): FactIntegrityReport {
  const violations = reports.flatMap(({ report, location }) =>
    report.violations.map((violation) => ({ ...violation, location })),
  );
  return {
    status: violations.length > 0 ? 'blocked' : 'passed',
    checkedClaims: reports.reduce((sum, item) => sum + item.report.checkedClaims, 0),
    violations,
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
  const evidenceState = hasCitableEvidence(evidence)
    ? `${evidence.provider}에서 수집한 검증 장부가 제공됩니다. 장부에 있는 사실만 사용할 수 있습니다.`
    : '검증 가능한 최신 근거가 충분하지 않습니다. 확인되지 않은 세부 조건은 쓰지 말고 검증 가능한 일반 설명만 작성하세요.';

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
  독자에게 아무 쓸모가 없습니다. 자료가 없으면 **그 항목을 통째로 빼세요** —
  소제목을 만들어 놓고 "근거가 없다"고 적으면 글이 비어 보입니다.
  당신이 무엇을 받았고 무엇을 못 받았는지는 독자의 관심사가 아닙니다.
- 사실처럼 보이는 예시 수치, 가상의 기관 발표, 출처 없는 인용을 만들지 마세요.
`;
}
