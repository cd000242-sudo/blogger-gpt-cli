import fs from 'fs';
import path from 'path';
import {
  buildFactCheckPrompt,
  buildLatestNaverFactQuery,
  getFactCheckReferenceTime,
} from '../src/core/perplexityFactCheck';

describe('fact-check freshness regression', () => {
  const kstNow = new Date('2026-07-07T15:00:00.000Z');

  test('uses the current KST date instead of a hard-coded 2025 baseline', () => {
    const ref = getFactCheckReferenceTime(kstNow);
    const prompt = buildFactCheckPrompt('근로장려금 신청방법', kstNow);

    expect(ref.currentYear).toBe(2026);
    expect(ref.currentDateIso).toBe('2026-07-08');
    expect(ref.currentDateKo).toBe('2026년 7월 8일');
    expect(prompt).toContain('2026년 7월 8일');
    expect(prompt).toContain('2026년 최신 기준');
    expect(prompt).not.toContain('2025-2026년 기준');
  });

  test('Naver fact-check query requests the latest current-year information', () => {
    expect(buildLatestNaverFactQuery('근로장려금 신청방법', kstNow)).toBe(
      '근로장려금 신청방법 2026 최신 변경사항 공식',
    );
    expect(buildLatestNaverFactQuery('2026 근로장려금 신청방법', kstNow)).toBe(
      '2026 근로장려금 신청방법 최신 변경사항 공식',
    );
  });

  test('Naver fact-check search is latest-first, not relevance-first', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src', 'core', 'perplexityFactCheck.ts'), 'utf8');

    expect(source).toContain('&sort=date');
    expect(source).not.toContain('&sort=sim');
  });
});
