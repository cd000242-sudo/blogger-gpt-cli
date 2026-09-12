// 📋 생성된 글목록 탭 — WordPress 발행 글 목록 조회 / 수정발행 (REST API)
// Blogger(blogger-publisher.js의 listBloggerPosts/updateBloggerPost)와 응답 규격을 동일하게 맞춰
// 렌더러가 플랫폼별 분기 없이 같은 흐름으로 목록 → 편집 → 수정발행을 처리할 수 있게 한다.
import { loadEnvFromFile } from '../env';
import { wrapAsHtmlBlock, unwrapHtmlBlock } from './wp-html-block';
import type {
  PublishedPostItem,
  PublishedPostListResult,
  PublishedPostUpdateResult,
} from '../types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 30000;

type WordPressAuth = {
  siteUrl: string;
  authHeader: string;
};

type AuthAwareError = Error & { needsAuth?: boolean };

function authError(message: string): AuthAwareError {
  const error = new Error(message) as AuthAwareError;
  error.needsAuth = true;
  return error;
}

function pickString(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeSiteUrl(raw: string): string {
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol
    .replace(/\/wp-admin\/?$/i, '')
    .replace(/\/wp-login\.php$/i, '')
    .replace(/\/+$/, '');
}

/**
 * 사이트 URL + 인증 헤더 구성.
 * 발행 경로(main.ts의 loadPlatformCredsFromEnv)와 동일한 키 우선순위를 그대로 따른다.
 */
export function resolveWordPressAuth(payload: Record<string, any> = {}): WordPressAuth {
  const env = loadEnvFromFile();

  const siteUrl = normalizeSiteUrl(pickString(
    payload['siteUrl'], payload['wordpressSiteUrl'],
    env['wordpressSiteUrl'], env['WORDPRESS_SITE_URL'],
    env['wpSiteUrl'], env['WP_SITE_URL'], env['WP_URL'],
  ));
  const username = pickString(
    payload['username'], payload['wordpressUsername'],
    env['wordpressUsername'], env['WORDPRESS_USERNAME'],
    env['wpUsername'], env['WP_USERNAME'],
  );
  const password = pickString(
    payload['password'], payload['wordpressPassword'],
    env['wordpressPassword'], env['WORDPRESS_PASSWORD'],
    env['wpPassword'], env['WP_PASSWORD'], env['WORDPRESS_APP_PASSWORD'],
  );
  const jwtToken = pickString(
    payload['jwtToken'], payload['wordpressJwtToken'],
    env['wordpressJwtToken'], env['WP_JWT_TOKEN'], env['jwtToken'],
  );

  if (!siteUrl) {
    throw authError('WordPress 사이트 주소가 설정되지 않았습니다. 환경설정에서 사이트 URL을 저장한 뒤 다시 시도해주세요.');
  }
  if (!jwtToken && (!username || !password)) {
    throw authError('WordPress 관리자 ID와 Application Password가 설정되지 않았습니다. 환경설정에서 입력한 뒤 다시 시도해주세요.');
  }

  const authHeader = jwtToken
    ? `Bearer ${jwtToken}`
    : `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  return { siteUrl, authHeader };
}

/**
 * @param namespace 기본은 워드프레스 코어(wp/v2). 플러그인 API 는 자기 네임스페이스를 쓴다
 *   (예: Pretty Links = pretty-links/v1). 인증·타임아웃 처리를 두 벌로 만들지 않으려고
 *   여기 하나로 모은다 — 갈라놓으면 한쪽만 고쳐지는 사고가 난다.
 */
export async function wpFetch(
  auth: WordPressAuth, endpoint: string, init: RequestInit = {}, namespace = 'wp/v2',
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${auth.siteUrl}/wp-json/${namespace}${endpoint}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'LEADERNAM-Orbit/PublishedPosts',
        Authorization: auth.authHeader,
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`WordPress 응답이 ${Math.round(REQUEST_TIMEOUT_MS / 1000)}초 안에 오지 않았습니다. 사이트 상태를 확인해주세요.`);
    }
    throw new Error(`WordPress 연결 실패: ${error?.message || String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function toHttpError(response: Response): Promise<AuthAwareError> {
  const body = await response.text().catch(() => '');
  const short = body.replace(/\s+/g, ' ').trim().slice(0, 180);

  if (response.status === 401) {
    return authError('401 인증 실패: 관리자 ID 또는 Application Password를 확인해주세요. 로그인 비밀번호가 아니라 프로필에서 발급한 Application Password가 필요합니다.');
  }
  if (response.status === 403) {
    return authError('403 권한 차단: 보안 플러그인·WAF·REST API 차단 설정 또는 계정 권한을 확인해주세요.');
  }
  if (response.status === 404) {
    const error = new Error('404: 글을 찾을 수 없거나 REST API 경로(/wp-json/)에 접근할 수 없습니다.') as AuthAwareError;
    return error;
  }
  return new Error(`WordPress API 오류 (HTTP ${response.status})${short ? `: ${short}` : ''}`) as AuthAwareError;
}

function toErrorResult(error: unknown): { ok: false; error: string; needsAuth: boolean } {
  const typed = error as AuthAwareError | undefined;
  const message = typed?.message || String(error);
  return { ok: false, error: message, needsAuth: Boolean(typed?.needsAuth) };
}

/** WordPress는 title/content를 context에 따라 문자열 또는 {raw, rendered}로 돌려준다 */
function readRichField(value: any): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return String(value.raw || value.rendered || '');
  return '';
}

function readFeaturedImage(post: any): string {
  const embedded = post?._embedded?.['wp:featuredmedia'];
  const media = Array.isArray(embedded) ? embedded[0] : null;
  return String(media?.source_url || post?.jetpack_featured_media_url || '');
}

function toPublishedPostItem(post: any): PublishedPostItem {
  return {
    id: String(post?.id ?? ''),
    title: readRichField(post?.title),
    url: String(post?.link || ''),
    published: String(post?.date_gmt ? `${post.date_gmt}Z` : (post?.date || '')),
    updated: String(post?.modified_gmt ? `${post.modified_gmt}Z` : (post?.modified || '')),
    // v3.8.726: 저장할 때 씌운 HTML 블록 주석을 벗겨 편집기에 깨끗한 HTML 을 준다
    content: unwrapHtmlBlock(readRichField(post?.content)),
    imageUrl: readFeaturedImage(post),
    status: String(post?.status || 'publish'),
  };
}

/**
 * 글 목록 조회 — 발행글 + 임시(draft) + 예약(future).
 *
 * 예전엔 status=publish 만 물어봐서 임시·예약 글이 목록에 아예 안 떴다.
 * 앱에서 임시로 저장했는데 목록에 없으니 "사라졌다"고 보일 수밖에 없었다.
 *
 * WordPress는 pageToken 대신 page 번호를 쓰므로, 다음 페이지 번호를 문자열 토큰으로 돌려준다.
 * context=edit으로 조회해 편집기가 원본 HTML(content.raw)을 그대로 왕복시킬 수 있게 한다.
 * (draft·future 는 context=edit + 인증이 있어야 보인다 — 둘 다 이미 갖췄다)
 */
const LIST_STATUSES = 'publish,draft,future,pending,private';
export async function listWordPressPosts(options: {
  maxResults?: number;
  pageToken?: string;
  payload?: Record<string, any>;
} = {}): Promise<PublishedPostListResult> {
  try {
    const auth = resolveWordPressAuth(options.payload || {});
    const perPage = Math.min(Math.max(Number(options.maxResults) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(Number(options.pageToken) || 1, 1);

    const query = `/posts?per_page=${perPage}&page=${page}&context=edit&status=${LIST_STATUSES}`
      + '&orderby=date&order=desc&_embed=wp%3Afeaturedmedia';
    const response = await wpFetch(auth, query);

    if (!response.ok) {
      // 페이지 범위를 넘어선 요청은 "더 없음"으로 간주 (더 불러오기 마지막 페이지)
      if (response.status === 400 && page > 1) {
        return { ok: true, items: [], nextPageToken: null };
      }
      throw await toHttpError(response);
    }

    const raw = await response.json();
    const items = (Array.isArray(raw) ? raw : []).map(toPublishedPostItem);
    const totalPages = Number(response.headers.get('X-WP-TotalPages') || '0');
    const hasMore = totalPages > 0 ? page < totalPages : items.length >= perPage;

    return { ok: true, items, nextPageToken: hasMore ? String(page + 1) : null };
  } catch (error) {
    console.error('[WP-POSTS] ❌ 글 목록 조회 실패:', (error as Error)?.message || error);
    return toErrorResult(error);
  }
}

/**
 * 수정발행 — 제목/본문만 갱신 (카테고리·태그·발행일 등은 보존).
 */
/**
 * 🖼️ v3.8.724 — 편집기에서 넣은 썸네일을 **대표 이미지로도** 올린다.
 *
 * 사장님: "썸네일을 넣기로 해서 넣었는데 생성된 글목록에서 썸네일로 안 보이고 썸네일 지정도 안 되네요"
 *
 * 워드프레스에서 목록·홈에 뜨는 그림은 본문 이미지가 아니라 **대표 이미지(featured_media)** 다.
 * 그런데 수정발행은 `{ content, title }` 만 보냈다 — 편집기에서 썸네일을 아무리 갈아 끼워도
 * 본문 맨 위 그림만 바뀌고 대표 이미지는 0 그대로였다(실측: 발행글 5714 featured_media=0).
 *
 * data:image 는 그대로 올리고, http 주소는 내려받아 올린다. 실패하면 **본문 수정은 그대로 진행**한다 —
 * 그림 하나 때문에 고친 글이 안 올라가는 쪽이 더 나쁘다.
 */
async function uploadFeaturedMedia(
  auth: ReturnType<typeof resolveWordPressAuth>,
  imageUrl: string,
  title: string,
): Promise<number | null> {
  const src = String(imageUrl || '').trim();
  if (!src) return null;

  try {
    let buffer: Buffer;
    if (/^data:image\/[a-z+]+;base64,/i.test(src)) {
      buffer = Buffer.from(src.replace(/^data:image\/[a-z+]+;base64,/i, ''), 'base64');
    } else if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`내려받기 실패 ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      return null;
    }
    if (buffer.byteLength < 1024) throw new Error('그림이 너무 작습니다');

    const filename = `${Date.now()}-thumbnail.jpg`;
    const response = await wpFetch(auth, '/media', {
      method: 'POST',
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'image/jpeg',
      },
      body: buffer as any,
    });
    if (!response.ok) throw await toHttpError(response);
    const media = await response.json();
    const id = Number(media?.id || 0);
    if (id > 0) console.log(`[WP-POSTS] ✅ 대표 이미지 업로드: ID ${id} (${title.slice(0, 20)})`);
    return id > 0 ? id : null;
  } catch (error: any) {
    console.warn(`[WP-POSTS] ⚠️ 대표 이미지 업로드 실패(본문 수정은 계속): ${error?.message || error}`);
    return null;
  }
}

/**
 * 본문 **맨 앞**의 썸네일 한 덩이만 뗀다 (v3.8.727).
 *
 * 발행기가 썸네일로 집는 모양은 `div.separator > img` 이고, 에이전트 글은 `<figure>` 로도 넣는다.
 * 맨 앞의 한 개만 본다 — 본문 중간의 소제목 그림까지 지우면 글이 헐거워진다.
 */
export function stripLeadingThumbnail(html: string): string {
  const source = String(html || '');
  const lead = /^\s*(?:<div[^>]*class=["'][^"']*separator[^"']*["'][^>]*>\s*<img[\s\S]*?<\/div>|<figure[^>]*>\s*<img[\s\S]*?<\/figure>)/i;
  return lead.test(source) ? source.replace(lead, '').trimStart() : source;
}

export async function updateWordPressPost(options: {
  postId?: string | number;
  title?: string;
  content?: string;
  /** v3.8.724: 편집기가 넘기는 썸네일 — 있으면 대표 이미지로 올린다 */
  thumbnailUrl?: string;
  payload?: Record<string, any>;
} = {}): Promise<PublishedPostUpdateResult> {
  const postId = String(options.postId ?? '').trim();
  const title = String(options.title || '').trim();
  const content = String(options.content || '');

  if (!postId) return { ok: false, error: 'postId가 없습니다.' };
  if (!content.trim()) return { ok: false, error: '본문이 비어 있습니다.' };

  try {
    const auth = resolveWordPressAuth(options.payload || {});
    /**
     * v3.8.726 — 워드프레스가 wpautop 으로 <p> 를 덧씌우지 못하게 HTML 블록으로 감싼다.
     * 실측(5714): 감싸기 전 짝 없는 </p> 25개 → 감싼 뒤 0개. 미리보기와 실제가 같아진다.
     */
    /**
     * 썸네일이 넘어왔으면 대표 이미지로 올린다.
     * 본문에 이미 있는 주소(i0.wp.com 등 이 사이트가 이미 쓰는 그림)라도 다시 올려 둔다 —
     * 대표 이미지는 미디어 라이브러리의 항목을 가리켜야 하기 때문이다.
     */
    const mediaId = await uploadFeaturedMedia(auth, String(options.thumbnailUrl || ''), title);

    /**
     * 🖼️ v3.8.727 — **같은 그림이 두 번 보이지 않게 한다.**
     *
     * 사장님(실물 검수, 발행글 5714): "썸네일이 따로 있고 핵심요약 위에 썸네일이 하나 더 있다고"
     *
     * 내가 만든 문제다. v3.8.724 에서 대표 이미지를 붙이는 길을 열면서, 발행 경로에는 있는
     * **본문 맨 위 썸네일 제거**(stripBodyThumbnailBox, v3.8.336)를 이쪽에 안 걸었다.
     * 그래서 대표 이미지가 제목 위에 그려지고 본문 첫 그림도 그대로 남아 두 장이 됐다.
     *
     * 대표 이미지가 생길 때만 지운다 — 대표가 없으면 본문 것이 유일한 그림이라 지우면 안 된다.
     */
    let finalContent = content;
    if (mediaId) {
      const withoutLead = stripLeadingThumbnail(finalContent);
      if (withoutLead !== finalContent) {
        finalContent = withoutLead;
        console.log('[WP-POSTS] 🖼️ 대표 이미지와 겹치는 본문 맨 위 그림을 뺐습니다 (두 장으로 보이던 문제)');
      }
    }

    /**
     * v3.8.726 — 워드프레스가 wpautop 으로 <p> 를 덧씌우지 못하게 HTML 블록으로 감싼다.
     * 실측(5714): 감싸기 전 짝 없는 </p> 25개 → 감싼 뒤 0개. 미리보기와 실제가 같아진다.
     */
    const body: Record<string, any> = { content: wrapAsHtmlBlock(finalContent) };
    if (title) body['title'] = title;
    if (mediaId) body['featured_media'] = mediaId;

    const response = await wpFetch(auth, `/posts/${encodeURIComponent(postId)}?context=edit`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await toHttpError(response);

    const data = await response.json();
    console.log(`[WP-POSTS] ✅ 수정발행 완료: ${data?.link || postId}`);
    return {
      ok: true,
      postId: String(data?.id ?? postId),
      url: String(data?.link || ''),
      updated: String(data?.modified_gmt ? `${data.modified_gmt}Z` : (data?.modified || '')),
    };
  } catch (error) {
    console.error('[WP-POSTS] ❌ 수정발행 실패:', (error as Error)?.message || error);
    return toErrorResult(error);
  }
}

/**
 * 발행된 글을 지운다 (v3.8.412)
 *
 * 사용자 요청: "생성된 글목록에서 글 삭제할 수 있는 기능은 못 넣나요?"
 *
 * 기본은 **휴지통**이다. 워드프레스는 force=true 를 줘야 영구 삭제인데,
 * 되돌릴 수 없는 동작을 기본값으로 두지 않는다 — 실수로 지워도 복구할 수 있어야 한다.
 */
export async function deleteWordPressPost(options: {
  postId?: string | number;
  /** true 면 휴지통을 거치지 않고 영구 삭제한다 */
  permanent?: boolean;
  payload?: Record<string, any>;
} = {}): Promise<PublishedPostUpdateResult> {
  const postId = String(options.postId ?? '').trim();
  if (!postId) return { ok: false, error: 'postId가 없습니다.' };

  try {
    const auth = resolveWordPressAuth(options.payload || {});
    const query = options.permanent === true ? '?force=true' : '';
    const response = await wpFetch(auth, `/posts/${encodeURIComponent(postId)}${query}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw await toHttpError(response);

    console.log(`[WP-POSTS] ✅ 삭제 완료: ${postId}${options.permanent ? ' (영구)' : ' (휴지통)'}`);
    return { ok: true, postId, url: '', updated: '' };
  } catch (error) {
    console.error('[WP-POSTS] ❌ 삭제 실패:', (error as Error)?.message || error);
    return toErrorResult(error);
  }
}
