/**
 * 로컬 placeholder 생성기 검증 — v3.6.0
 * 외부 의존성 0 (순수 zlib)으로 유효한 PNG data URL 을 항상 만들어내는지 확인.
 */
import { generatePlaceholderImage } from '../src/core/imagePlaceholder';

function decodeBase64Png(dataUrl: string): Buffer {
  const m = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  expect(m).not.toBeNull();
  return Buffer.from(m![1]!, 'base64');
}

describe('generatePlaceholderImage', () => {
  it('유효한 PNG data URL 반환 (PNG signature 확인)', () => {
    const url = generatePlaceholderImage('테스트 키워드', { width: 320, height: 180 });
    expect(url).toMatch(/^data:image\/png;base64,/);
    const buf = decodeBase64Png(url);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect([...buf.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    // IHDR 청크 타입 존재
    expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
    // IEND 로 끝남
    expect(buf.subarray(buf.length - 8, buf.length - 4).toString('ascii')).toBe('IEND');
  });

  it('IHDR 의 width/height 가 요청값과 일치', () => {
    const buf = decodeBase64Png(generatePlaceholderImage('kw', { width: 256, height: 144 }));
    expect(buf.readUInt32BE(16)).toBe(256); // width
    expect(buf.readUInt32BE(20)).toBe(144); // height
  });

  it('같은 키워드 → 결정적(동일) 출력', () => {
    const a = generatePlaceholderImage('동일키워드', { width: 64, height: 64 });
    const b = generatePlaceholderImage('동일키워드', { width: 64, height: 64 });
    expect(a).toBe(b);
  });

  it('다른 키워드 → 다른 색상(다른 출력)', () => {
    const a = generatePlaceholderImage('키워드A', { width: 64, height: 64 });
    const b = generatePlaceholderImage('키워드B', { width: 64, height: 64 });
    expect(a).not.toBe(b);
  });

  it('빈 키워드/극단 크기에도 throw 하지 않음', () => {
    expect(() => generatePlaceholderImage('', {})).not.toThrow();
    expect(() => generatePlaceholderImage('x', { width: 1, height: 1 })).not.toThrow();
    expect(() => generatePlaceholderImage('x', { width: 99999, height: 99999 })).not.toThrow();
  });
});
