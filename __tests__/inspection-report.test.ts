import { __TESTING__ } from '../src/core/inspection-utils';

const {
  htmlToParagraphs,
  extractSampleParagraphs,
  splitIntoSentences,
  detectFactCheckCandidates,
  detectAiTonePhrases,
  extractSectionTitleFromHtml,
  buildInspectionReport,
} = __TESTING__;

describe('Inspection utilities', () => {
  const sampleSectionHtml = `
    <section>
      <h2>테스트 섹션 제목</h2>
      <p>이 글에서는 2025년에 발표된 데이터를 기반으로 핵심 내용을 정리해 드리겠습니다.</p>
      <p>실제 조사 결과 85%의 사용자가 기능 개선에 긍정적인 반응을 보였습니다.</p>
      <p>단계별로 살펴보겠습니다. 우선 하루 30분만 투자하면 빠르게 적응할 수 있습니다.</p>
    </section>
  `;

  test('htmlToParagraphs extracts clean text paragraphs', () => {
    const paragraphs = htmlToParagraphs(sampleSectionHtml);
    expect(paragraphs).toHaveLength(4);
    expect(paragraphs[0]).toBe('테스트 섹션 제목');
    expect(paragraphs[1]).toContain('2025년에 발표된 데이터');
  });

  test('extractSampleParagraphs limits paragraph count', () => {
    const samples = extractSampleParagraphs(sampleSectionHtml, 2);
    expect(samples).toHaveLength(2);
  });

  test('splitIntoSentences splits by punctuation', () => {
    const sentences = splitIntoSentences('한 문장입니다. 또 다른 문장입니다? 마지막 문장!');
    expect(sentences).toEqual([
      '한 문장입니다.',
      '또 다른 문장입니다?',
      '마지막 문장!',
    ]);
  });

  test('detectFactCheckCandidates finds numbered statements', () => {
    const paragraphs = extractSampleParagraphs(sampleSectionHtml, 3);
    const candidates = detectFactCheckCandidates(paragraphs);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates).toEqual(expect.arrayContaining([
      expect.stringContaining('2025년에 발표된 데이터'),
      expect.stringContaining('85%의 사용자가'),
    ]));
  });

  test('detectAiTonePhrases flags templated AI phrases', () => {
    const paragraphs = extractSampleParagraphs(sampleSectionHtml, 3);
    const findings = detectAiTonePhrases(paragraphs);
    expect(findings).toEqual(expect.arrayContaining([
      '“이 글에서는” 표현',
      '정리해 드리겠습니다',
    ]));
    if (paragraphs.some(text => text.includes('살펴보겠습니다'))) {
      expect(findings).toEqual(expect.arrayContaining(['살펴보겠습니다']));
    }
  });

  test('extractSectionTitleFromHtml falls back gracefully', () => {
    const title = extractSectionTitleFromHtml(sampleSectionHtml, '폴백 제목', 0);
    expect(title).toBe('테스트 섹션 제목');

    const fallback = extractSectionTitleFromHtml('<p>본문만 있습니다.</p>', '폴백 제목', 1);
    expect(fallback).toBe('폴백 제목');
  });

  test('buildInspectionReport summarizes sections correctly', () => {
    const report = buildInspectionReport('테스트 토픽', [sampleSectionHtml], ['테스트 섹션 제목']);
    expect(report.topic).toBe('테스트 토픽');
    expect(report.sections).toHaveLength(1);
    expect(report.summary.totalSections).toBe(1);
    expect(report.summary.totalFactChecks).toBeGreaterThanOrEqual(1);
    expect(report.summary.flaggedSections).toBe(1);
    expect(report.sections[0]!.sampleParagraphs).toHaveLength(2);
  });
});

