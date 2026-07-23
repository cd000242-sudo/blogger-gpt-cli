// 📋 생성된 글목록 탭 — WordPress 발행 글 목록 조회 / 수정발행 (REST API)
// Blogger(blogger-publisher.js의 listBloggerPosts/updateBloggerPost)와 응답 규격을 동일하게 맞춰
// 렌더러가 플랫폼별 분기 없이 같은 흐름으로 목록 → 편집 → 수정발행을 처리할 수 있게 한다.
import { loadEnvFromFile } from '../env';
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
function resolveWordPressAuth(payload: Record<string, any> = {}): WordPressAuth {
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

async function wpFetch(auth: WordPressAuth, endpoint: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${auth.siteUrl}/wp-json/wp/v2${endpoint}`, {
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

async function toHttpError(response: Response): Promise<AuthAwareError> {
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
    content: readRichField(post?.content),
    imageUrl: readFeaturedImage(post),
  };
}

/**
 * 발행된 글 목록 조회 (published 글만).
 * WordPress는 pageToken 대신 page 번호를 쓰므로, 다음 페이지 번호를 문자열 토큰으로 돌려준다.
 * context=edit으로 조회해 편집기가 원본 HTML(content.raw)을 그대로 왕복시킬 수 있게 한다.
 */
export async function listWordPressPosts(options: {
  maxResults?: number;
  pageToken?: string;
  payload?: Record<string, any>;
} = {}): Promise<PublishedPostListResult> {
  try {
    const auth = resolveWordPressAuth(options.payload || {});
    const perPage = Math.min(Math.max(Number(options.maxResults) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(Number(options.pageToken) || 1, 1);

    const query = `/posts?per_page=${perPage}&page=${page}&context=edit&status=publish`
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
export async function updateWordPressPost(options: {
  postId?: string | number;
  title?: string;
  content?: string;
  payload?: Record<string, any>;
} = {}): Promise<PublishedPostUpdateResult> {
  const postId = String(options.postId ?? '').trim();
  const title = String(options.title || '').trim();
  const content = String(options.content || '');

  if (!postId) return { ok: false, error: 'postId가 없습니다.' };
  if (!content.trim()) return { ok: false, error: '본문이 비어 있습니다.' };

  try {
    const auth = resolveWordPressAuth(options.payload || {});
    const body: Record<string, string> = { content };
    if (title) body['title'] = title;

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
