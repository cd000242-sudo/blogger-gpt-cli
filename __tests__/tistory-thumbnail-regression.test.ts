import {
  buildTistoryFinalHtml,
  buildTistoryImageFallback,
  normalizeTistoryPublishedImageUrl,
} from '../src/tistory/tistory-publisher';

describe('Tistory thumbnail publish regression', () => {
  test('accepts only a persistent HTTP(S) image source for final post HTML', () => {
    expect(normalizeTistoryPublishedImageUrl('https://blog.kakaocdn.net/dna/example/image.jpg'))
      .toBe('https://blog.kakaocdn.net/dna/example/image.jpg');
    expect(normalizeTistoryPublishedImageUrl('//t1.daumcdn.net/example/image.jpg'))
      .toBe('https://t1.daumcdn.net/example/image.jpg');
    expect(normalizeTistoryPublishedImageUrl('blob:https://www.tistory.com/123')).toBe('');
    expect(normalizeTistoryPublishedImageUrl('data:image/png;base64,AAAA')).toBe('');
    expect(normalizeTistoryPublishedImageUrl('javascript:alert(1)')).toBe('');
  });

  test('never writes a temporary preview URL as the article thumbnail', () => {
    expect(buildTistoryImageFallback('blob:https://www.tistory.com/123', 'A title')).toBe('');
    expect(buildTistoryImageFallback('data:image/png;base64,AAAA', 'A title')).toBe('');

    const html = buildTistoryImageFallback('https://blog.kakaocdn.net/dna/example/image.jpg', 'A "title"');
    expect(html).toContain('https://blog.kakaocdn.net/dna/example/image.jpg');
    expect(html).toContain('alt="A &quot;title&quot;"');
  });

  test('replaces a transient first image with the permanent uploaded thumbnail block', () => {
    const html = buildTistoryFinalHtml(
      '<p><img src="blob:https://www.tistory.com/123" /></p><p>Body text</p>',
      'blob:https://www.tistory.com/123',
      '<p><img src="https://blog.kakaocdn.net/dna/example/image.jpg" /></p>',
      'A title',
    );

    expect(html).not.toContain('blob:');
    expect(html).toContain('https://blog.kakaocdn.net/dna/example/image.jpg');
    expect(html).toContain('Body text');
  });

  test('removes a transient image even when Tistory upload does not yield a permanent URL', () => {
    const html = buildTistoryFinalHtml(
      '<p><img src="blob:https://www.tistory.com/123" /></p><p>Body text</p>',
      'blob:https://www.tistory.com/123',
      '',
      'A title',
    );

    expect(html).not.toContain('blob:');
    expect(html).toContain('Body text');
  });
});
