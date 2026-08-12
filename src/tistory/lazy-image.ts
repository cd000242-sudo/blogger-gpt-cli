/**
 * lazy-image — 지연 로딩된 목록 이미지에서 진짜 주소를 골라낸다.
 *
 * 티스토리 관리 목록은 스크롤해야 이미지를 채운다. 화면에 안 들어온 행은
 * `src` 가 비어 있거나 1x1 placeholder 이고, 실제 주소는 `data-src` 계열에 있다.
 * `src` 만 읽으면 "썸네일이 뜰 때도 있고 안 뜰 때도" 있게 된다 — 사장님 보고 그대로다.
 *
 * ## 함수 하나로 자기완결이어야 한다
 * 이 코드는 page.evaluate 안(브라우저 컨텍스트)에서도 돌아야 한다. 거기에는 이 모듈이
 * 없으므로 **함수 소스를 문자열로 넘겨 되살린다**(PICK_LAZY_IMAGE_SOURCE).
 * 그래서 바깥 헬퍼를 참조하지 않고 전부 함수 안에 둔다 — 밖으로 빼면 주입했을 때
 * ReferenceError 로 조용히 죽고, 썸네일이 통째로 사라진다.
 */

/** getAttribute 만 있으면 된다 — 실제 HTMLImageElement 도 그대로 들어온다 */
export interface AttrReadable {
  getAttribute(name: string): string | null;
  currentSrc?: string;
}

/**
 * 이미지 요소에서 쓸 만한 주소를 고른다. 없으면 빈 문자열 —
 * 없는 주소를 만들어내지 않는다(깨진 이미지 아이콘이 더 나쁘다).
 */
export function pickLazyImageUrl(image: AttrReadable | null | undefined): string {
  try {
    if (!image || typeof image.getAttribute !== 'function') return '';

    // 지연 로딩 라이브러리들이 쓰는 속성 이름들. 앞에서부터 먼저 본다
    const attrs = ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-url', 'data-thumb', 'data-image'];

    const candidates: string[] = [];
    if (image.currentSrc) candidates.push(image.currentSrc);
    for (const attr of attrs) {
      const value = image.getAttribute(attr);
      if (value) candidates.push(value);
    }
    const srcset = image.getAttribute('srcset') || image.getAttribute('data-srcset');
    if (srcset) {
      const first = String(srcset).split(',')[0] || '';
      const url = first.trim().split(/\s+/)[0] || '';
      if (url) candidates.push(url);
    }

    for (const raw of candidates) {
      let url = String(raw || '').trim();
      if (!url) continue;
      if (url.slice(0, 2) === '//') url = `https:${url}`;                 // 프로토콜 생략 주소
      if (/^data:/i.test(url)) continue;                                  // 인라인 1x1 자리표시자
      if (/(blank|spacer|placeholder|loading|dummy)\./i.test(url)) continue;
      if (/^about:blank$/i.test(url)) continue;
      return url;
    }
    return '';
  } catch {
    return '';
  }
}

/** page.evaluate 안에서 되살리기 위한 함수 소스 */
export const PICK_LAZY_IMAGE_SOURCE = pickLazyImageUrl.toString();
