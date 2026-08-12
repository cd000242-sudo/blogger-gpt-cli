/**
 * featured-image-repair — 워드프레스 대표 이미지가 실제로 붙었는지 확인하고, 안 붙었으면 고친다.
 *
 * ## 왜 필요한가
 * 사장님 보고(반복): "워드프레스로 지금 발행했는데 또 썸네일이 안나오네요.
 *                    글 들어가면 썸네일이 있습니다"
 *
 * 목록 카드가 글자 썸네일("작")로 뜨는 건 테마가 **대표 이미지(featured_media)** 를
 * 못 찾았다는 뜻이다. 본문 안에는 이미지가 있으니 이미지 자체는 만들어졌다.
 *
 * 발행 코드에는 이미 업로드 로직이 있는데, 실패해도 **로그만 남기고 넘어간다.**
 * 그래서 사장님은 발행이 끝난 뒤에야 목록에서 알아차린다.
 *
 * ## 무엇을 하는가
 * 발행 직후 글을 다시 읽어 featured_media 가 붙었는지 확인한다. 0 이면
 *   ① 이미 올린 미디어 id 가 있으면 그걸로 다시 붙인다 (생성 시 무시된 경우)
 *   ② 없으면 본문 첫 이미지를 올려 붙인다
 * 그래도 안 되면 **사용자에게 알린다** — 조용히 넘어가면 또 목록에서 발견한다.
 */

export interface FeaturedRepairApi {
  /** 글 하나를 읽어온다 (featured_media 포함) */
  getPost(postId: number): Promise<{ featured_media?: number } | null>;
  /** 글의 대표 이미지를 지정한다 */
  setFeaturedMedia(postId: number, mediaId: number): Promise<boolean>;
  /** 이미지 주소를 올려 media id 를 얻는다 */
  uploadFromUrl(url: string, filename: string): Promise<number | null>;
}

export interface FeaturedRepairResult {
  ok: boolean;
  /** 어떻게 해결했는지 — 로그·사용자 안내용 */
  action: 'already-set' | 'reattached' | 'uploaded' | 'no-candidate' | 'failed';
  mediaId?: number;
  message: string;
}

/** 본문에서 대표 이미지로 쓸 첫 이미지를 고른다 */
export function pickFeaturedCandidate(html: string): string {
  try {
    const source = String(html || '');

    /**
     * 첫 이미지가 SVG(로고·아이콘)면 **다음 것을 본다.**
     * 첫 개만 보고 포기하면 로고가 맨 위에 있는 글에서 대표 이미지를 못 찾는다.
     * 워드프레스는 SVG 를 대표 이미지로 잘 처리하지 못한다.
     */
    for (const m of source.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)) {
      const url = m[1] || '';
      if (url && !/\.svg(\?|#|$)/i.test(url)) return url;
    }

    // http 후보가 없으면 base64
    for (const m of source.matchAll(/<img[^>]+src=["'](data:image\/([a-z+]+);base64,[^"']+)["']/gi)) {
      if (m[2] && /svg/i.test(m[2])) continue;
      if (m[1]) return m[1];
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * 대표 이미지가 붙었는지 확인하고, 안 붙었으면 붙인다.
 * 어떤 경우에도 던지지 않는다 — 발행은 이미 끝났고, 여기서 막을 이유가 없다.
 */
export async function verifyAndRepairFeaturedImage(input: {
  api: FeaturedRepairApi;
  postId: number;
  html: string;
  /** 발행 과정에서 이미 올린 미디어 id (있으면 이걸 먼저 쓴다) */
  knownMediaId?: number | undefined;
  title?: string;
}): Promise<FeaturedRepairResult> {
  const { api, postId, html, knownMediaId, title } = input;

  try {
    const post = await api.getPost(postId);
    const current = Number(post?.featured_media || 0);
    if (current > 0) {
      return { ok: true, action: 'already-set', mediaId: current, message: '대표 이미지가 정상 설정되어 있습니다' };
    }

    // ① 이미 올린 미디어가 있으면 다시 붙인다 (생성 요청에서 무시된 경우)
    if (knownMediaId && knownMediaId > 0) {
      const attached = await api.setFeaturedMedia(postId, knownMediaId);
      if (attached) {
        return {
          ok: true,
          action: 'reattached',
          mediaId: knownMediaId,
          message: '대표 이미지가 빠져 있어 다시 지정했습니다',
        };
      }
    }

    // ② 본문 첫 이미지를 올려 붙인다
    const candidate = pickFeaturedCandidate(html);
    if (!candidate) {
      return {
        ok: false,
        action: 'no-candidate',
        message: '본문에 대표 이미지로 쓸 사진이 없어 목록 썸네일이 비어 보일 수 있습니다',
      };
    }

    const uploadedId = await api.uploadFromUrl(candidate, `${title || 'thumbnail'}-featured`);
    if (!uploadedId) {
      return {
        ok: false,
        action: 'failed',
        message: '대표 이미지 업로드에 실패했습니다 — 워드프레스 미디어 권한을 확인해주세요',
      };
    }

    const attached = await api.setFeaturedMedia(postId, uploadedId);
    return attached
      ? { ok: true, action: 'uploaded', mediaId: uploadedId, message: '대표 이미지를 새로 올려 지정했습니다' }
      : { ok: false, action: 'failed', mediaId: uploadedId, message: '대표 이미지를 올렸지만 글에 지정하지 못했습니다' };
  } catch (error: any) {
    return {
      ok: false,
      action: 'failed',
      message: `대표 이미지 확인 중 오류: ${String(error?.message || error).slice(0, 100)}`,
    };
  }
}
