/**
 * 수집한 상품 사진을 '발행 가능한 이미지'로 만든다 (v3.8.412)
 *
 * 왜 필요한가 — 사용자 실측(2026-08-02):
 *   글목록·블로그스팟 관리화면에서 쇼핑 글 2편만 썸네일이 안 떴다("브", "실" 글자만).
 *   AI 이미지로 만든 글은 멀쩡히 떴다.
 *
 * 원인:
 *   발행 코드는 data:image 썸네일만 업로드하고, **외부 URL 은 그대로 넘긴다.**
 *   Blogger 는 자기가 들고 있지 않은 이미지로는 썸네일(media$thumbnail)을 만들어주지 않는다.
 *   쇼핑 글 썸네일은 쿠팡 CDN 주소라 통째로 그 경로를 탔다.
 *
 * 해결: 상품 사진을 내려받아 data:image 로 바꾼다.
 *   그러면 AI 이미지와 **똑같은 업로드 경로**를 타므로
 *   블로그스팟·워드프레스·티스토리 세 곳 모두에서 썸네일이 생긴다.
 *
 * ⚠️ 실패해도 절대 발행을 막지 않는다 — 원래 URL 을 그대로 쓰면 되고,
 *    그건 지금까지의 동작과 같다(썸네일만 없을 뿐).
 */

/**
 * 프로토콜 없는 주소를 https 로 채운다 (v3.8.413)
 *
 * 실측(2026-08-02) — 발행된 글의 본문 이미지를 API 로 뜯어보니:
 *   //thumbnail.coupangcdn.com/thumbnails/remote/492x492ex/image/…
 *   ^^ 앞에 https: 가 없다. 쿠팡 og:image 가 이렇게 준다.
 *
 * 이 한 글자 때문에 세 곳이 동시에 깨졌다:
 *   1) 썸네일 유효성 검사가 /^https?:\/\// 를 요구해서 통째로 탈락 → 썸네일 없음
 *   2) fetchImageAsDataUrl 도 같은 검사라 변환 실패 → v3.8.412 수정이 무력화
 *   3) 앱 미리보기는 file:// 로 뜨는데 //host 는 file://host 로 해석돼 이미지가 안 뜸
 *
 * 사용자가 본 증상 세 개가 전부 여기서 나왔다.
 */
export function normalizeImageUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw;
}

/** 쿠팡 CDN 은 주소에 크기가 박혀 있다 — 있으면 최고 화질로 올린다. */
const COUPANG_SIZE_SEGMENT = /\/(\d{2,4})x(\d{2,4})(ex)?\//;

/** 쿠팡 썸네일 주소를 큰 크기로 바꾼다. 크기 세그먼트가 없으면 그대로 돌려준다. */
export function upgradeCoupangImageUrl(url: string, target = 1200): string {
  const raw = normalizeImageUrl(url);
  if (!raw) return '';
  const m = raw.match(COUPANG_SIZE_SEGMENT);
  if (!m) return raw;                                  // 크기가 안 박힌 주소(서명 URL 등)
  const cur = Number(m[1]) || 0;
  if (cur >= target) return raw;                       // 이미 충분히 크면 건드리지 않는다
  return raw.replace(COUPANG_SIZE_SEGMENT, `/${target}x${target}${m[3] || ''}/`);
}

/** 응답 바이트가 진짜 이미지인지 본다 — 에러 페이지를 썸네일로 쓰면 안 된다. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.subarray(0, 6).toString('ascii').startsWith('GIF8')) return 'image/gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export interface FetchImageOptions {
  /** 이보다 크면 포기한다 — 글 용량과 업로드 시간을 지킨다 */
  maxBytes?: number;
  timeoutMs?: number;
  onLog?: (msg: string) => void;
}

/**
 * 이미지 주소를 data:image 로 바꾼다.
 *
 * 최고 화질 주소를 먼저 시도하고, 실패하면 원래 주소로 물러선다.
 * 둘 다 안 되면 null — 부르는 쪽이 원래 URL 을 그대로 쓰면 된다.
 */
export async function fetchImageAsDataUrl(
  url: string,
  opts: FetchImageOptions = {},
): Promise<string | null> {
  const raw = normalizeImageUrl(url);         // //host/… 를 https://host/… 로
  if (!raw || !/^https?:\/\//i.test(raw)) return null;

  const maxBytes = opts.maxBytes ?? 8 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  // 큰 것부터. 같은 주소면 한 번만 시도한다.
  const upgraded = upgradeCoupangImageUrl(raw);
  const attempts = upgraded === raw ? [raw] : [upgraded, raw];

  for (const target of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(target, {
        signal: controller.signal,
        headers: {
          // 상품 페이지에서 온 것처럼 — CDN 이 빈 Referer 를 막는 경우가 있다
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      if (!res.ok) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > maxBytes) continue;

      const mime = sniffMime(buf);
      if (!mime) continue;                             // 이미지가 아니면 버린다

      opts.onLog?.(
        `   🖼️ 상품 사진 내려받음 ${(buf.length / 1024).toFixed(0)}KB`
        + `${target === upgraded && upgraded !== raw ? ' (고화질 주소)' : ''}`,
      );
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      // 다음 주소로 넘어간다
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
