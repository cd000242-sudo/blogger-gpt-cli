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
  /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:만원|원|억(?:\s*원)?|%|퍼센트|명|건|개|개월|주|시간|일|세|회)/g,
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

function splitSentences(value: string): string[] {
  return toPlainText(value)
    .split(/(?:[.!?]+|\n+)/)
    .map((sentence) => sentence.trim())
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
  const topicText = normalize(evidence.topic || '');
  if (topicText && topicText.includes(normalizedValue)) return true;
  const contextText = normalize(evidence.context || '');
  if (!contextText.includes(normalizedValue)) return false;
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

// 태그 없는 평문 제목 전용 진입점 — 어떤 입력에도 빈 문자열을 반환하지 않는다.
export function sanitizeFactUnsafeHeading(heading: string, evidence: FactEvidence, fallback: string): string {
  const source = String(heading || '').replace(FACT_META_BOILERPLATE_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
  if (!toPlainText(source)) return fallback;
  if (inspectFactIntegrity(source, evidence).status === 'passed') return source;
  const cleaned = sanitizeHeadingText(source, evidence, fallback);
  if (cleaned === fallback) return fallback;
  return inspectFactIntegrity(cleaned, evidence).status === 'passed' ? cleaned : fallback;
}

export function sanitizeFactUnsafeHtml(html: string, evidence: FactEvidence): string {
  const withoutMetaBoilerplate = String(html || '').replace(FACT_META_BOILERPLATE_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
  if (inspectFactIntegrity(withoutMetaBoilerplate, evidence).status === 'passed') return withoutMetaBoilerplate;

  const keepVerifiedSentences = (block: string): string => {
    const sentences = toPlainText(block).match(/[^.!?\n]+[.!?]?/g) || [];
    return sentences
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence && inspectFactIntegrity(sentence, evidence).status === 'passed')
      .join(' ')
      .trim();
  };

  const tagged = withoutMetaBoilerplate.replace(
    /<(p|li|blockquote|td|h[1-6])(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attrs: string, inner: string) => {
      if (inspectFactIntegrity(inner, evidence).status === 'passed') return `<${tag}${attrs}>${inner}</${tag}>`;
      const cleaned = /^h[1-6]$/i.test(tag) ? sanitizeHeadingText(inner, evidence, '핵심 정보') : keepVerifiedSentences(inner);
      return cleaned ? `<${tag}${attrs}>${cleaned}</${tag}>` : '';
    },
  );

  if (inspectFactIntegrity(tagged, evidence).status === 'passed') return tagged;
  if (!/<[a-z][^>]*>/i.test(tagged)) return keepVerifiedSentences(tagged);
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

export function sanitizeArticleFactClaims<T extends FactIntegrityArticle>(article: T, evidence: FactEvidence): T {
  const sanitizeTable = (table: any) => ({
    ...table,
    headers: Array.isArray(table?.headers) ? table.headers.map((value: string) => sanitizeFactUnsafeHtml(value, evidence)) : table?.headers,
    rows: Array.isArray(table?.rows) ? table.rows.map((row: string[]) => row.map((value: string) => sanitizeFactUnsafeHtml(value, evidence))) : table?.rows,
  });
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
        tables: Array.isArray(subsection.tables) ? subsection.tables.map(sanitizeTable) : subsection.tables,
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
- 사실처럼 보이는 예시 수치, 가상의 기관 발표, 출처 없는 인용을 만들지 마세요.
`;
}
