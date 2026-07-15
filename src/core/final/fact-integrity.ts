export type FactTrustLevel = 'strong' | 'weak' | 'none';

export interface FactEvidence {
  context: string;
  provider: string;
  trustLevel: FactTrustLevel;
  sourceUrls?: string[];
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

const SAFE_FALLBACK = '세부 기준은 발행 시점의 공식 안내를 확인하세요.';
const FACT_SENSITIVE_PATTERN = /(신청|접수|마감|지원|지급|대상|자격|요건|조건|기간|일정|발표|공고|모집|혜택|할인|가격|금액|수령|가능|받을|시행|개정|기준|출처|통계|조사|자료|안내|밝혔)/;
const INSTITUTION_PATTERN = /[가-힣]{2,}(?:특별자치도|특별시|광역시|자치시|위원회|대학교|공단|공사|재단|센터|은행|부|청|원|도|시|군|구)/g;
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

function inspectSentence(sentence: string, evidence: FactEvidence): FactIntegrityViolation[] {
  const violations: FactIntegrityViolation[] = [];
  const exactValues = extractExactValues(sentence);
  const institutions = extractInstitutions(sentence);
  const sensitive = FACT_SENSITIVE_PATTERN.test(sentence);
  const evidenceText = normalize(evidence.context);
  const evidenceIsStrong = hasCitableEvidence(evidence);
  const inherentlyTimeSensitiveValues = exactValues.filter((value) => /20\d{2}|월|만원|원|억|%|퍼센트|세|^\d{4}-/.test(value));
  const valuesToVerify = sensitive ? exactValues : inherentlyTimeSensitiveValues;

  if (valuesToVerify.length > 0) {
    const unsupported = valuesToVerify.filter((value) => !evidenceIsStrong || !evidenceText.includes(value));
    if (unsupported.length > 0) {
      violations.push({
        kind: 'unsupported_exact_value',
        sentence,
        detail: `근거 장부에서 확인되지 않은 정확한 값: ${unsupported.join(', ')}`,
      });
    }
  }

  if (institutions.length > 0 && (sensitive || exactValues.length > 0)) {
    const unsupported = institutions.filter((name) => !evidenceIsStrong || !evidenceText.includes(name));
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

export function sanitizeFactUnsafeHtml(html: string, evidence: FactEvidence): string {
  if (inspectFactIntegrity(html, evidence).status === 'passed') return html;

  const sanitizeBlock = (block: string): string =>
    inspectFactIntegrity(block, evidence).status === 'blocked' ? SAFE_FALLBACK : block;

  const tagged = String(html || '').replace(
    /<(p|li|blockquote|td|h[1-6])(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attrs: string, inner: string) => {
      if (inspectFactIntegrity(inner, evidence).status === 'passed') return `<${tag}${attrs}>${inner}</${tag}>`;
      return `<${tag}${attrs}>${SAFE_FALLBACK}</${tag}>`;
    },
  );

  if (inspectFactIntegrity(tagged, evidence).status === 'passed') return tagged;
  if (!/<[a-z][^>]*>/i.test(tagged)) return sanitizeBlock(tagged);
  return `<p>${SAFE_FALLBACK}</p>`;
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
    sections: (article.sections || []).map((section) => ({
      ...section,
      h2: sanitizeFactUnsafeHtml(section.h2, evidence),
      h3Sections: (section.h3Sections || []).map((subsection) => ({
        ...subsection,
        h3: sanitizeFactUnsafeHtml(subsection.h3, evidence),
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
    : '검증 가능한 최신 근거가 충분하지 않습니다. 일반적인 설명만 쓰고, 세부 기준은 공식 안내 확인으로 안내해야 합니다.';

  return `
## FACT INTEGRITY: NON-NEGOTIABLE
주제: ${keyword}
${evidenceState}
- 근거에 없는 날짜, 금액, 비율, 인원, 신청 기간, 자격 조건, 기관명, 통계, URL은 절대 작성하지 마세요.
- 제공된 근거 장부에 없는 정확한 수치나 일정은 추정하거나 다른 사례로 보완하지 마세요.
- 확실하지 않은 최신 기준은 "세부 기준은 발행 시점의 공식 안내를 확인하세요"로만 안내하세요.
- 사실처럼 보이는 예시 수치, 가상의 기관 발표, 출처 없는 인용을 만들지 마세요.
`;
}
