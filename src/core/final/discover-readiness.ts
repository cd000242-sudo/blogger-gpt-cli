/**
 * 🔎 구글 디스커버 자격 자가진단 (v3.8.477)
 *
 * 사용자 요구: "워드프레스와 블로그스팟은 구글 디스커버에 노출될수있도록
 *              제목과 이미지 본문을 최적화시킨모드가있어야되거든"
 *
 * ## 공식 요건 (Search Central — Get on Discover)
 * 특별한 태그나 구조화 데이터는 필요 없다. 색인되고 콘텐츠 정책을 지키면 후보가 된다.
 * 다만 **큰 이미지**가 카드 노출을 좌우한다:
 *   · 폭 1,200px 이상
 *   · 총 30만 픽셀 초과
 *   · `max-image-preview:large` 활성화 (또는 AMP)
 *   · og:image 또는 schema.org 로 대표 이미지 지정, 로고·글자 많은 이미지 회피
 *
 * ## 왜 진단만 하는가
 * 실측 2026-08-11 —
 *   워드프레스(leadernam.com): max-image-preview:large · og:image · og:title **전부 있음**
 *     → 손댈 게 없다. 테마/코어가 이미 넣는다.
 *   블로거(blogger.googleblog.com): 둘 다 **없음**
 *     → 그런데 Blogger API 는 글 본문만 다룬다. 테마 HTML 을 바꾸는 공개 API 가 없다.
 *       즉 **코드로는 고칠 수 없고**, 블로그 주인이 테마에 한 줄 넣어야 한다.
 *
 * 고칠 수 없는 것을 조용히 두면 "왜 디스커버에 안 뜨지" 로 남는다. 그래서 알린다.
 * 발행은 절대 막지 않는다.
 */

import { readImageSize } from './image-aspect';

/** 디스커버 카드가 요구하는 최소 폭 */
export const DISCOVER_MIN_WIDTH = 1200;

/** 디스커버가 요구하는 최소 총 픽셀 */
export const DISCOVER_MIN_PIXELS = 300_000;

export interface DiscoverCheckInput {
  /** 업로드 전 썸네일. data URL 이어야 크기를 잴 수 있다. */
  thumbnailDataUrl?: string;
  /** 'wordpress' | 'blogspot' 등 */
  platform?: string;
}

export interface DiscoverWarning {
  code: 'thumbnail-too-small' | 'thumbnail-unknown' | 'blogspot-head-meta';
  message: string;
}

/**
 * 발행물이 디스커버 카드 자격을 갖췄는지 본다.
 * 판정 불가·문제 없음이면 빈 배열. 절대 던지지 않는다.
 */
export function checkDiscoverReadiness(input: DiscoverCheckInput): DiscoverWarning[] {
  const warnings: DiscoverWarning[] = [];

  try {
    const dataUrl = String(input?.thumbnailDataUrl || '');
    const match = dataUrl.match(/^data:image\/[a-z+]+;base64,(.+)$/i);

    if (match) {
      const size = readImageSize(Buffer.from(match[1]!, 'base64'));
      if (!size) {
        warnings.push({
          code: 'thumbnail-unknown',
          message: '썸네일 크기를 읽지 못했습니다 — 디스커버 카드 자격(폭 1,200px 이상)을 확인하지 못했습니다',
        });
      } else if (size.width < DISCOVER_MIN_WIDTH || size.width * size.height <= DISCOVER_MIN_PIXELS) {
        /**
         * 이미지 최적화는 줄이기만 하고 키우지는 않는다(withoutEnlargement).
         * 그래서 원본이 작으면 작은 채로 나가고, 디스커버 카드에서 탈락한다.
         * 특히 크롤한 상품 사진이 작을 때 생긴다.
         */
        warnings.push({
          code: 'thumbnail-too-small',
          message: `썸네일이 ${size.width}x${size.height} 라 디스커버 카드 기준(폭 ${DISCOVER_MIN_WIDTH}px 이상 · 총 ${DISCOVER_MIN_PIXELS.toLocaleString()}픽셀 초과)에 못 미칩니다 — 큰 이미지를 쓰면 노출 확률이 올라갑니다`,
        });
      }
    }

    if (String(input?.platform || '').toLowerCase().includes('blog')
      && !String(input?.platform || '').toLowerCase().includes('wordpress')) {
      warnings.push({
        code: 'blogspot-head-meta',
        message: '블로그스팟은 max-image-preview:large 와 og:image 를 기본으로 넣지 않습니다 '
          + '(구글 자체 Blogger 블로그로 확인). 이건 글 본문이 아니라 테마 HTML 영역이라 자동화로 못 넣습니다 — '
          + '블로그 테마 편집에서 <head> 안에 '
          + '<meta name="robots" content="max-image-preview:large"> 를 한 번만 추가하세요',
      });
    }
  } catch {
    // 진단이 발행을 막으면 안 된다
  }

  return warnings;
}
