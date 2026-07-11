import {
  buildFactIntegrityPrompt,
  inspectArticleFactIntegrity,
  inspectFactIntegrity,
  sanitizeArticleFactClaims,
  sanitizeFactUnsafeHtml,
  type FactEvidence,
} from '../src/core/final/fact-integrity';
import { getFactCheckProviderPriority } from '../src/core/perplexityFactCheck';

const noEvidence: FactEvidence = {
  context: '',
  provider: 'none',
  trustLevel: 'none',
};

describe('fact integrity regression', () => {
  test('blocks time-sensitive claims when the generator has no verified evidence', () => {
    const article = '<p>2026년 7월 15일까지 신청하면 25만원을 받을 수 있습니다.</p>';

    const report = inspectFactIntegrity(article, noEvidence);

    expect(report.status).toBe('blocked');
    expect(report.violations.some((item) => item.kind === 'unsupported_exact_value')).toBe(true);

    const sanitized = sanitizeFactUnsafeHtml(article, noEvidence);
    expect(sanitized).not.toContain('2026년 7월 15일');
    expect(sanitized).not.toContain('25만원');
    expect(sanitized).toContain('공식 안내');
  });

  test('accepts a current claim only when the exact date, amount, and institution exist in evidence', () => {
    const evidence: FactEvidence = {
      provider: 'Perplexity Sonar',
      trustLevel: 'strong',
      context: [
        '서울특별시 공식 안내',
        '2026년 7월 15일까지 신청할 수 있습니다.',
        '지원 금액은 25만원입니다.',
        '출처: https://www.seoul.go.kr/example',
      ].join('\n'),
    };
    const article = '<p>서울특별시는 2026년 7월 15일까지 신청을 받고 25만원을 지원한다고 안내했습니다.</p>';

    const report = inspectFactIntegrity(article, evidence);

    expect(report.status).toBe('passed');
    expect(report.violations).toHaveLength(0);
  });

  test('blocks a newer year when the supplied evidence only supports an older baseline', () => {
    const evidence: FactEvidence = {
      provider: 'Perplexity Sonar',
      trustLevel: 'strong',
      context: '공식 안내는 2025년 기준으로 적용됩니다.',
    };

    const report = inspectFactIntegrity('<p>2026년에 알아둘 내용입니다.</p>', evidence);

    expect(report.status).toBe('blocked');
    expect(report.violations.some((item) => item.kind === 'unsupported_exact_value')).toBe(true);
  });

  test('does not accept an institution claim that is absent from the evidence ledger', () => {
    const evidence: FactEvidence = {
      provider: 'Gemini Grounding',
      trustLevel: 'strong',
      context: '서울특별시 공식 안내\n2026년 7월 15일까지 신청할 수 있습니다.',
    };
    const article = '<p>보건복지부는 2026년 7월 15일까지 신청을 받는다고 밝혔습니다.</p>';

    const report = inspectFactIntegrity(article, evidence);

    expect(report.status).toBe('blocked');
    expect(report.violations.some((item) => item.kind === 'unsupported_institution')).toBe(true);
  });

  test('blocks unsupported eligibility thresholds as well as dates and money', () => {
    const article = '<p>지원 대상은 만 19세 이상이며 소득 기준을 충족한 사람입니다.</p>';

    const report = inspectFactIntegrity(article, noEvidence);

    expect(report.status).toBe('blocked');
    expect(report.violations.some((item) => item.kind === 'unsupported_exact_value')).toBe(true);
  });

  test('sanitizes factual claims in article sections and tables before publishing', () => {
    const article = {
      introduction: '<p>2026년 7월 15일까지 신청하세요.</p>',
      conclusion: '<p>공식 안내를 확인하세요.</p>',
      sections: [{
        h2: '지원 일정',
        h3Sections: [{
          h3: '신청 기준',
          content: '<p>25만원을 지원합니다.</p>',
          tables: [{ headers: ['마감일'], rows: [['2026년 7월 15일']] }],
        }],
      }],
    };

    const sanitized = sanitizeArticleFactClaims(article, noEvidence);

    const firstCell = sanitized.sections[0]?.h3Sections[0]?.tables?.[0]?.rows?.[0]?.[0] || '';
    expect(inspectArticleFactIntegrity(sanitized, noEvidence).status).toBe('passed');
    expect(firstCell).toContain('공식 안내');
  });

  test('adds a non-negotiable evidence rule to every generation prompt', () => {
    const prompt = buildFactIntegrityPrompt('청년 지원금 신청 방법', noEvidence);

    expect(prompt).toContain('근거에 없는 날짜');
    expect(prompt).toContain('공식 안내를 확인');
    expect(prompt).toContain('절대 작성하지 마세요');
  });

  test('prefers web-grounded evidence over Naver blog snippets in auto mode', () => {
    expect(getFactCheckProviderPriority({ perplexity: true, grounding: true, naver: true }))
      .toEqual(['perplexity', 'grounding', 'naver']);
    expect(getFactCheckProviderPriority({ perplexity: false, grounding: true, naver: true }))
      .toEqual(['grounding', 'naver']);
  });
});
