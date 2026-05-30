/**
 * 🎯 로컬 placeholder 이미지 생성기 — v3.6.0
 *
 * 목적: "이미지 항상 존재" 보장의 최종 안전망.
 *   모든 원격 이미지 엔진(API + 브라우저)이 동시에 실패해도, 네트워크/외부 라이브러리에
 *   전혀 의존하지 않고 유효한 PNG 한 장을 즉시 만들어낸다. → 디스패처가 절대 빈손으로 끝나지 않음.
 *
 * 구현: 순수 Node `zlib`만으로 PNG를 직접 인코딩한다 (sharp 등 optional dep 불필요).
 *   - 키워드 해시로 결정적(deterministic) 2색 세로 그라데이션 생성.
 *   - H2 본문에도 안전하도록 텍스트/로고 없는 추상 그라데이션 (NO TEXT 규칙 준수).
 */

import zlib from 'zlib';

// ── CRC32 (PNG 청크 체크섬) ──
let _crcTable: number[] | null = null;
function crcTable(): number[] {
  if (_crcTable) return _crcTable;
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  _crcTable = t;
  return t;
}

function crc32(buf: Buffer): number {
  const table = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** 문자열 → 32bit 해시 (결정적 색상 도출용) */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** HSL → RGB (0..255) */
function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** 키워드에서 보기 좋은 2색(상단/하단) 결정 */
function colorsFromKeyword(keyword: string): [RGB, RGB] {
  const hash = hashString(keyword || 'placeholder');
  const hue = hash % 360;
  // 상단: 약간 밝게, 하단: 보색 근처로 약간 어둡게 — 부드러운 그라데이션
  const top = hslToRgb(hue, 0.45, 0.55);
  const bottom = hslToRgb((hue + 40) % 360, 0.5, 0.32);
  return [top, bottom];
}

/**
 * 키워드 기반 세로 그라데이션 PNG 를 data URL 로 반환한다. **절대 throw 하지 않는다.**
 * @param keyword 색상 시드 (블로그 키워드)
 * @param opts width/height (기본 16:9 1024x576)
 */
export function generatePlaceholderImage(
  keyword: string,
  opts: { width?: number; height?: number } = {},
): string {
  try {
    const width = Math.max(16, Math.min(opts.width || 1024, 4096));
    const height = Math.max(16, Math.min(opts.height || 576, 4096));
    const [top, bottom] = colorsFromKeyword(keyword);

    const rowBytes = width * 3; // RGB
    const raw = Buffer.alloc((rowBytes + 1) * height);
    for (let y = 0; y < height; y++) {
      const t = height === 1 ? 0 : y / (height - 1);
      const r = Math.round(top.r + (bottom.r - top.r) * t);
      const g = Math.round(top.g + (bottom.g - top.g) * t);
      const b = Math.round(top.b + (bottom.b - top.b) * t);
      const off = y * (rowBytes + 1);
      raw[off] = 0; // filter: none
      for (let x = 0; x < width; x++) {
        const p = off + 1 + x * 3;
        raw[p] = r;
        raw[p + 1] = g;
        raw[p + 2] = b;
      }
    }

    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type: RGB
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace
    const idat = zlib.deflateSync(raw);
    const png = Buffer.concat([
      sig,
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', idat),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    // zlib 조차 실패하는 극단 상황 — 1x1 회색 PNG 상수 (최후의 최후)
    return (
      'data:image/png;base64,' +
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );
  }
}
