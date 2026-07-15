import { extractGroundingSourceUrls } from '../src/core/final/gemini-engine';

describe('Gemini grounding evidence extraction', () => {
  test('keeps only valid web URLs from grounding metadata', () => {
    const urls = extractGroundingSourceUrls({
      groundingChunks: [
        { web: { uri: 'https://www.gov.kr/portal/main' } },
        { web: { url: 'https://www.seoul.go.kr/example' } },
        { web: { uri: 'not-a-url' } },
        { web: { uri: 'https://www.gov.kr/portal/main' } },
      ],
    });

    expect(urls).toEqual([
      'https://www.gov.kr/portal/main',
      'https://www.seoul.go.kr/example',
    ]);
  });
});
