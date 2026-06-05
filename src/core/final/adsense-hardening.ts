// Extra AdSense approval hardening checks for mass publishing.
// This scanner does not replace policy/quality gates. It catches the signals
// that tend to appear when many posts are produced with the same shape.

export type AdsenseHardeningMetric =
  | 'ctaResidue'
  | 'tableCoverage'
  | 'headingCoverage'
  | 'headingDiversity'
  | 'paragraphOpeners'
  | 'sentenceEndings'
  | 'listDominance';

export interface AdsenseHardeningWarning {
  metric: AdsenseHardeningMetric;
  severity: 'warn' | 'hard';
  actual: number;
  threshold: number;
  message: string;
}

export interface AdsenseHardeningMetrics {
  textLength: number;
  paragraphCount: number;
  sentenceCount: number;
  h2Count: number;
  h3Count: number;
  tableCount: number;
  blockquoteCount: number;
  listItemCount: number;
  ctaResidueCount: number;
  headingDuplicateRatio: number;
  paragraphOpenerUniqueRatio: number;
  dominantSentenceEndingRatio: number;
}

export interface AdsenseHardeningResult {
  ok: boolean;
  score: number;
  warnings: AdsenseHardeningWarning[];
  metrics: AdsenseHardeningMetrics;
  summary: string;
}

const CTA_RESIDUE_PATTERNS: RegExp[] = [
  /\bclass\s*=\s*["'][^"']*\bcta(?:-|_|box|btn|button)[^"']*["']/gi,
  /\bclass\s*=\s*["'][^"']*(?:affiliate|coupang|partners|adsbygoogle|ad-safe-zone)[^"']*["']/gi,
  /\bid\s*=\s*["'][^"']*(?:affiliate|coupang|partners|adsbygoogle|ad-safe-zone)[^"']*["']/gi,
  /\brel\s*=\s*["'][^"']*(?:sponsored|nofollow)[^"']*["']/gi,
  /\bonclick\s*=/gi,
  /<ins\b[^>]*\badsbygoogle\b/gi,
];

function countMatches(input: string, patterns: RegExp[]): number {
  let total = 0;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const matches = input.match(pattern);
    if (matches) total += matches.length;
  }
  return total;
}

function stripHtmlToText(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagText(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = stripHtmlToText(match[1] || '');
    if (text) values.push(text);
  }
  return values;
}

function countTag(html: string, tag: string): number {
  const re = new RegExp(`<${tag}\\b`, 'gi');
  return (String(html || '').match(re) || []).length;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\u3002\uff01\uff1f])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length >= 10);
}

function normalizeKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function uniqueRatio(values: string[]): number {
  if (values.length === 0) return 1;
  const unique = new Set(values.filter(Boolean));
  return unique.size / values.length;
}

function dominantRatio(values: string[]): number {
  if (values.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const max = Math.max(0, ...Array.from(counts.values()));
  return max / values.length;
}

function getParagraphOpeners(paragraphs: string[]): string[] {
  return paragraphs
    .map(p => normalizeKey(p).replace(/\s/g, '').slice(0, 14))
    .filter(v => v.length >= 5);
}

function getSentenceEndings(sentences: string[]): string[] {
  return sentences
    .map(sentence => {
      const cleaned = sentence.replace(/\s+/g, '').replace(/[.!?\u3002\uff01\uff1f]+$/g, '');
      const match = cleaned.match(/([\uAC00-\uD7A3]{2,5})$/u);
      return match?.[1] || cleaned.slice(-5);
    })
    .filter(v => v.length >= 2);
}

export function scanAdsenseHardening(html: string): AdsenseHardeningResult {
  const source = String(html || '');
  const text = stripHtmlToText(source);
  const paragraphs = extractTagText(source, 'p');
  const sentences = splitSentences(text);
  const headings = [...extractTagText(source, 'h2'), ...extractTagText(source, 'h3')]
    .map(normalizeKey)
    .filter(Boolean);

  const h2Count = countTag(source, 'h2');
  const h3Count = countTag(source, 'h3');
  const tableCount = countTag(source, 'table');
  const blockquoteCount = countTag(source, 'blockquote');
  const listItemCount = countTag(source, 'li');
  const ctaResidueCount = countMatches(source, CTA_RESIDUE_PATTERNS);
  const headingDuplicateRatio = headings.length > 0 ? 1 - uniqueRatio(headings) : 0;
  const paragraphOpenerUniqueRatio = uniqueRatio(getParagraphOpeners(paragraphs));
  const dominantSentenceEndingRatio = dominantRatio(getSentenceEndings(sentences));

  const warnings: AdsenseHardeningWarning[] = [];

  if (ctaResidueCount > 0) {
    warnings.push({
      metric: 'ctaResidue',
      severity: 'hard',
      actual: ctaResidueCount,
      threshold: 0,
      message: 'AdSense mode still contains CTA, affiliate, ad, onclick, sponsored, or nofollow residue.',
    });
  }

  if (tableCount < 1 && text.length >= 3500) {
    warnings.push({
      metric: 'tableCoverage',
      severity: 'warn',
      actual: tableCount,
      threshold: 1,
      message: 'Long AdSense article has no table. Add one comparison/checklist/summary table to reduce low-value pattern risk.',
    });
  }

  if (h2Count < 5) {
    warnings.push({
      metric: 'headingCoverage',
      severity: 'warn',
      actual: h2Count,
      threshold: 5,
      message: 'AdSense article has too few H2 sections for an approval-focused long-form post.',
    });
  }

  if (headingDuplicateRatio > 0.18 && headings.length >= 6) {
    warnings.push({
      metric: 'headingDiversity',
      severity: 'warn',
      actual: Math.round(headingDuplicateRatio * 100),
      threshold: 18,
      message: 'H2/H3 headings look repetitive. Vary article angles before mass scheduling similar keywords.',
    });
  }

  if (paragraphOpenerUniqueRatio < 0.62 && paragraphs.length >= 8) {
    warnings.push({
      metric: 'paragraphOpeners',
      severity: 'warn',
      actual: Math.round(paragraphOpenerUniqueRatio * 100),
      threshold: 62,
      message: 'Paragraph openings repeat too much. This can look template-generated across many scheduled posts.',
    });
  }

  if (dominantSentenceEndingRatio > 0.42 && sentences.length >= 14) {
    warnings.push({
      metric: 'sentenceEndings',
      severity: 'warn',
      actual: Math.round(dominantSentenceEndingRatio * 100),
      threshold: 42,
      message: 'One sentence ending dominates the article. Increase rhythm and ending variation.',
    });
  }

  if (listItemCount > Math.max(16, paragraphs.length * 3) && text.length < 7000) {
    warnings.push({
      metric: 'listDominance',
      severity: 'warn',
      actual: listItemCount,
      threshold: Math.max(16, paragraphs.length * 3),
      message: 'The post relies heavily on list items. Add explanatory paragraphs and evidence so it does not feel thin.',
    });
  }

  const hardCount = warnings.filter(w => w.severity === 'hard').length;
  const warnCount = warnings.length - hardCount;
  const score = Math.max(0, 100 - hardCount * 35 - warnCount * 8);
  const ok = hardCount === 0 && warnings.length === 0;
  const metrics: AdsenseHardeningMetrics = {
    textLength: text.length,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    h2Count,
    h3Count,
    tableCount,
    blockquoteCount,
    listItemCount,
    ctaResidueCount,
    headingDuplicateRatio: Math.round(headingDuplicateRatio * 100),
    paragraphOpenerUniqueRatio: Math.round(paragraphOpenerUniqueRatio * 100),
    dominantSentenceEndingRatio: Math.round(dominantSentenceEndingRatio * 100),
  };

  const summary = warnings.length === 0
    ? `AdSense hardening pass (${score}/100, H2 ${h2Count}, table ${tableCount}, paragraphs ${paragraphs.length})`
    : `AdSense hardening warnings ${warnings.length} (${score}/100, H2 ${h2Count}, table ${tableCount}, opener unique ${metrics.paragraphOpenerUniqueRatio}%, ending max ${metrics.dominantSentenceEndingRatio}%)`;

  return { ok, score, warnings, metrics, summary };
}
