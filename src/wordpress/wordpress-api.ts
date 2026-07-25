// 워드프레스 REST API 연동 모듈
import type { WordPressConfig } from '../types';

export type { WordPressConfig };

export interface WordPressPost {
  id?: number;
  title: string;
  content: string;
  excerpt?: string;
  status?: 'publish' | 'draft' | 'private' | 'pending' | 'future'; // 'future'는 예약 발행용
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  date?: string; // ISO 8601 형식 (예: "2024-12-25T10:00:00")
  date_gmt?: string; // GMT 시간
  slug?: string;
  link?: string; // v3.8.30: WordPress API가 반환하는 공개 글 URL (Pretty Permalinks 정확)
  meta?: Record<string, any>;
  // SEO 필드 추가
  yoast_seo_title?: string;
  yoast_seo_description?: string;
  yoast_seo_focuskw?: string;
}

export interface WordPressMedia {
  id: number;
  source_url: string;
  alt_text?: string;
  caption?: string;
  description?: string;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
}

export interface WordPressTag {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
}

/** \uC124\uCE58\uB41C SEO \uD50C\uB7EC\uADF8\uC778 \uC2DD\uBCC4\uC790. 'unknown' = \uAC10\uC9C0 \uC2E4\uD328(=\uD50C\uB7EC\uADF8\uC778 \uC804\uCCB4 \uD0A4\uB97C \uBCF4\uB0B4\uB294 \uC548\uC804 \uD3F4\uBC31). */
export type SeoPluginId = 'yoast' | 'rankmath' | 'aioseo';

/** REST \uB8E8\uD2B8 `namespaces` \u2192 SEO \uD50C\uB7EC\uADF8\uC778 \uB9E4\uD551. \uAC01 \uD50C\uB7EC\uADF8\uC778\uC774 \uC790\uAE30 \uB124\uC784\uC2A4\uD398\uC774\uC2A4\uB97C \uB4F1\uB85D\uD55C\uB2E4. */
const SEO_PLUGIN_NAMESPACES: Array<{ plugin: SeoPluginId; namespace: RegExp }> = [
  { plugin: 'yoast', namespace: /^yoast\/v\d+$/i },
  { plugin: 'rankmath', namespace: /^rankmath\/v\d+$/i },
  { plugin: 'aioseo', namespace: /^aioseo\/v\d+$/i },
];

/** \uC0AC\uC774\uD2B8\uBCC4 \uAC10\uC9C0 \uACB0\uACFC \uCE90\uC2DC \u2014 \uBC1C\uD589 1\uAC74\uB9C8\uB2E4 /wp-json/ \uC744 \uB2E4\uC2DC \uB54C\uB9AC\uC9C0 \uC54A\uB3C4\uB85D. */
const seoPluginCache = new Map<string, SeoPluginId[]>();

/** \uD14C\uC2A4\uD2B8/\uC124\uC815 \uBCC0\uACBD\uC6A9 \u2014 \uCE90\uC2DC \uBE44\uC6B0\uAE30 */
export function clearSeoPluginCache(): void {
  seoPluginCache.clear();
}

/** REST \uB8E8\uD2B8 \uC751\uB2F5\uC758 namespaces \uBC30\uC5F4\uC5D0\uC11C SEO \uD50C\uB7EC\uADF8\uC778 \uBAA9\uB85D\uC744 \uBF51\uB294\uB2E4. (\uC21C\uC218 \uD568\uC218 \u2014 \uB2E8\uC704 \uD14C\uC2A4\uD2B8 \uB300\uC0C1) */
export function detectSeoPluginsFromNamespaces(namespaces: unknown): SeoPluginId[] {
  if (!Array.isArray(namespaces)) return [];
  const found = new Set<SeoPluginId>();
  for (const ns of namespaces) {
    if (typeof ns !== 'string') continue;
    for (const { plugin, namespace } of SEO_PLUGIN_NAMESPACES) {
      if (namespace.test(ns)) found.add(plugin);
    }
  }
  return Array.from(found);
}

const WP_API_BROKEN_TEXT_PATTERN = /\uFFFD|&#(?:65533|xfffd);|%EF%BF%BD/gi;

function repairBrokenTextValue(label: string, value: string): string {
  const matches = value.match(WP_API_BROKEN_TEXT_PATTERN);
  if (!matches || matches.length === 0) return value;

  const marker = '(?:\\uFFFD|&#(?:65533|xfffd);|%EF%BF%BD)+';
  const mk = (source: string, flags = 'gi') => new RegExp(source.replace(/\[BAD\]/g, marker), flags);
  const repaired = value
    .replace(mk('청년내[BAD]저축계좌', 'g'), '청년내일저축계좌')
    .replace(mk('청년내[BAD]저축', 'g'), '청년내일저축')
    .replace(mk('폭넓[BAD]'), '폭넓게')
    .replace(mk('답니[BAD]'), '답니다')
    .replace(mk('합니[BAD]'), '합니다')
    .replace(mk('됩니[BAD]'), '됩니다')
    .replace(mk('입니[BAD]'), '입니다')
    .replace(mk('습니[BAD]'), '습니다')
    .replace(mk('([가-힣])니[BAD]'), '$1니다')
    .replace(WP_API_BROKEN_TEXT_PATTERN, '');

  console.warn(`[WP-API] ${label}: repaired ${matches.length} broken replacement marker(s).`);
  return repaired;
}

function repairBrokenTextPayload(value: unknown, path = 'payload'): unknown {
  if (typeof value === 'string') {
    return repairBrokenTextValue(path, value);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => repairBrokenTextPayload(item, `${path}[${index}]`));
  }

  if (value && typeof value === 'object') {
    const repaired: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      repaired[key] = repairBrokenTextPayload(item, `${path}.${key}`);
    });
    return repaired;
  }

  return value;
}

export class WordPressAPI {
  private config: WordPressConfig;
  private baseUrl: string;

  constructor(config: WordPressConfig) {
    this.config = {
      apiVersion: 'v2',
      ...config
    };
    
    // URL에 프로토콜이 없으면 https:// 추가
    let siteUrl = this.config.siteUrl.trim();
    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
      siteUrl = `https://${siteUrl}`;
    }
    
    this.baseUrl = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // 인증 방식 결정
    let authHeader = '';
    if (this.config.jwtToken) {
      authHeader = `Bearer ${this.config.jwtToken}`;
    } else if (this.config.username && this.config.password) {
      const auth = btoa(`${this.config.username}:${this.config.password}`);
      authHeader = `Basic ${auth}`;
    } else if (this.config.clientId && this.config.clientSecret) {
      // OAuth 2.0의 경우 별도 처리 필요 (현재는 Basic Auth 사용)
      const auth = btoa(`${this.config.clientId}:${this.config.clientSecret}`);
      authHeader = `Basic ${auth}`;
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WordPress-Auto-Blogger/1.0'
      }
    };

    if (authHeader) {
      const headers = options.headers as Record<string, string>;
      headers['Authorization'] = authHeader;
      options.headers = headers;
    }

    if (data && (method === 'POST' || method === 'PUT')) {
      data = repairBrokenTextPayload(data);
      options.body = JSON.stringify(data);
    }

    try {
      console.log('[WP-API] 요청:', { method, url, hasAuth: !!authHeader });
      const response = await fetch(url, options);
      
      console.log('[WP-API] 응답:', { status: response.status, statusText: response.statusText, ok: response.ok });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WP-API] ❌ API 오류:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 200)
        });
        throw new Error(`WordPress API Error: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log('[WP-API] ✅ 요청 성공');
      return data;
    } catch (error: any) {
      console.error('[WP-API] ❌ 요청 실패:', {
        url,
        method,
        errorMessage: error?.message || '알 수 없는 오류',
        errorCode: error?.code || 'UNKNOWN',
        errorType: error?.name || 'Error'
      });
      throw error;
    }
  }

  // 포스트 생성/수정
  async createPost(post: WordPressPost): Promise<WordPressPost> {
    return this.request<WordPressPost>('/posts', 'POST', post);
  }

  async updatePost(id: number, post: Partial<WordPressPost>): Promise<WordPressPost> {
    return this.request<WordPressPost>(`/posts/${id}`, 'PUT', post);
  }

  async getPost(id: number): Promise<WordPressPost> {
    return this.request<WordPressPost>(`/posts/${id}`);
  }

  async deletePost(id: number): Promise<WordPressPost> {
    return this.request<WordPressPost>(`/posts/${id}`, 'DELETE');
  }

  /**
   * 설치된 SEO 플러그인 감지. `/wp-json/` 루트의 namespaces 목록을 근거로 판정하고 사이트별로 캐시한다.
   * 감지 실패(네트워크 오류 등) 시 빈 배열 → 호출부가 "모든 키 전송" 안전 폴백을 쓴다.
   */
  async detectSeoPlugins(): Promise<SeoPluginId[]> {
    const siteKey = this.baseUrl;
    const cached = seoPluginCache.get(siteKey);
    if (cached) return cached;

    try {
      const rootUrl = `${this.baseUrl.replace(/\/wp-json\/wp\/v2$/, '')}/wp-json/`;
      const response = await fetch(rootUrl, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) {
        console.warn(`[WP-SEO] SEO 플러그인 감지 실패 (HTTP ${response.status}) — 전체 키 전송 폴백`);
        return [];
      }
      const root: any = await response.json();
      const plugins = detectSeoPluginsFromNamespaces(root?.namespaces);
      seoPluginCache.set(siteKey, plugins);
      console.log(`[WP-SEO] 감지된 SEO 플러그인: ${plugins.length > 0 ? plugins.join(', ') : '없음'}`);
      return plugins;
    } catch (error: any) {
      console.warn('[WP-SEO] SEO 플러그인 감지 예외 — 전체 키 전송 폴백:', error?.message);
      return [];
    }
  }

  // SEO 메타 필드 업데이트 (Yoast SEO / Rank Math / AIOSEO)
  // v3.8.306: Rank Math 필드 접두사 수정 (`_rank_math_*` → `rank_math_*`)
  // v3.8.374: 플러그인을 실제로 감지해서 해당 플러그인 키만 전송.
  //   기존에는 9개 키를 항상 뿌리고, 성공 판정도 `rankMathSaved || yoastSaved`라 Yoast 전용 사이트에서
  //   "Rank Math 필드 저장 안 됨" 경고가 매번 떴고, Rank Math 전용 REST도 매 발행마다 헛호출됐다.
  async updateSeoMeta(postId: number, seoData: {
    title?: string;
    description?: string;
    focusKeyword?: string;
  }): Promise<{ success: boolean }> {
    try {
      const plugins = await this.detectSeoPlugins();
      // 감지 실패 시에는 예전처럼 전부 전송 (안전 폴백)
      const unknown = plugins.length === 0;
      const useYoast = unknown || plugins.includes('yoast');
      const useRankMath = unknown || plugins.includes('rankmath');
      const useAioseo = unknown || plugins.includes('aioseo');

      const meta: Record<string, string> = {
        ...(useYoast ? {
          '_yoast_wpseo_title': seoData.title || '',
          '_yoast_wpseo_metadesc': seoData.description || '',
          '_yoast_wpseo_focuskw': seoData.focusKeyword || '',
        } : {}),
        ...(useRankMath ? {
          'rank_math_title': seoData.title || '',
          'rank_math_description': seoData.description || '',
          'rank_math_focus_keyword': seoData.focusKeyword || '',
        } : {}),
        ...(useAioseo ? {
          '_aioseop_title': seoData.title || '',
          '_aioseop_description': seoData.description || '',
          '_aioseop_keywords': seoData.focusKeyword || '',
        } : {}),
      };

      // v3.8.328: 응답 검증으로 실제 저장 여부 확인
      const updateResp: any = await this.request<WordPressPost>(`/posts/${postId}`, 'PUT', { meta });
      const savedMeta = updateResp?.meta || {};
      const yoastSaved = !!(savedMeta._yoast_wpseo_focuskw || savedMeta._yoast_wpseo_title || savedMeta._yoast_wpseo_metadesc);
      const rankMathSaved = !!(savedMeta.rank_math_focus_keyword || savedMeta.rank_math_title || savedMeta.rank_math_description);
      const aioseoSaved = !!(savedMeta._aioseop_title || savedMeta._aioseop_description);

      // 설치된 플러그인 기준으로만 성공/실패를 판정한다.
      const success = unknown
        ? (yoastSaved || rankMathSaved || aioseoSaved)
        : ((plugins.includes('yoast') && yoastSaved)
          || (plugins.includes('rankmath') && rankMathSaved)
          || (plugins.includes('aioseo') && aioseoSaved));

      if (!success && seoData.focusKeyword) {
        const target = unknown ? 'SEO' : plugins.join('/');
        console.warn(`[WP-SEO] ⚠️ ${target} 메타가 저장되지 않았습니다 — register_meta(show_in_rest) 미등록일 수 있습니다.`);
        if (useRankMath) {
          console.warn(`  add_action('init', function() {
    register_post_meta('post', 'rank_math_focus_keyword', ['type'=>'string','single'=>true,'show_in_rest'=>true,'auth_callback'=>function(){return current_user_can('edit_posts');}]);
    register_post_meta('post', 'rank_math_title', ['type'=>'string','single'=>true,'show_in_rest'=>true,'auth_callback'=>function(){return current_user_can('edit_posts');}]);
    register_post_meta('post', 'rank_math_description', ['type'=>'string','single'=>true,'show_in_rest'=>true,'auth_callback'=>function(){return current_user_can('edit_posts');}]);
  });`);
          console.warn('[WP-SEO] 위 스니펫을 Code Snippets 플러그인 또는 functions.php에 추가하면 자동 저장 가능.');
        }
      } else if (success) {
        const saved = [yoastSaved && 'Yoast', rankMathSaved && 'Rank Math', aioseoSaved && 'AIOSEO'].filter(Boolean).join(', ');
        console.log(`[WP-SEO] ✅ SEO 메타 저장 확인: ${saved}`);
      }

      // Rank Math 전용 REST API — Rank Math가 실제로 설치된 경우에만 호출 (meta whitelist 우회용)
      if (useRankMath && !rankMathSaved) {
        try {
          const rankMathUrl = `${this.config.siteUrl.replace(/\/$/, '')}/wp-json/rankmath/v1/updatePostMeta`;
          const auth = btoa(`${this.config.username}:${this.config.password}`);
          const rmResp = await fetch(rankMathUrl, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              objectID: postId,
              objectType: 'post',
              meta: {
                rank_math_title: seoData.title || '',
                rank_math_description: seoData.description || '',
                rank_math_focus_keyword: seoData.focusKeyword || '',
              },
            }),
          }).catch((e) => { console.warn('[WP-SEO/RankMath] REST 호출 예외:', e?.message); return null; });
          if (rmResp && rmResp.ok) {
            console.log('[WP-SEO/RankMath] ✅ 전용 REST 저장 성공');
            return { success: true };
          }
          if (rmResp) console.warn(`[WP-SEO/RankMath] ⚠️ 전용 REST 응답 ${rmResp.status}`);
        } catch { /* Rank Math endpoint 없음 */ }
      }

      return { success };
    } catch (error) {
      console.error('SEO 메타 업데이트 실패:', error);
      return { success: false };
    }
  }

  // 미디어 업로드
  async uploadMedia(file: ArrayBuffer, filename: string, altText?: string): Promise<WordPressMedia> {
    const formData = new FormData();
    const blob = new Blob([file], { type: 'image/jpeg' });
    formData.append('file', blob, filename);
    formData.append('alt_text', altText || '');

    const url = `${this.baseUrl}/media`;
    const auth = btoa(`${this.config.username}:${this.config.password}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'WordPress-Auto-Blogger/1.0'
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Media Upload Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // 카테고리 관리
  async getCategories(): Promise<WordPressCategory[]> {
    return this.request<WordPressCategory[]>('/categories?per_page=100');
  }

  async getCategory(id: number): Promise<WordPressCategory> {
    return this.request<WordPressCategory>(`/categories/${id}`);
  }

  async createCategory(name: string, description?: string): Promise<WordPressCategory> {
    return this.request<WordPressCategory>('/categories', 'POST', {
      name,
      description: description || ''
    });
  }

  async updateCategory(id: number, data: Partial<WordPressCategory>): Promise<WordPressCategory> {
    return this.request<WordPressCategory>(`/categories/${id}`, 'PUT', data);
  }

  async deleteCategory(id: number): Promise<WordPressCategory> {
    return this.request<WordPressCategory>(`/categories/${id}`, 'DELETE');
  }

  // 태그 관리
  async getTags(): Promise<WordPressTag[]> {
    return this.request<WordPressTag[]>('/tags?per_page=100');
  }

  async createTag(name: string, description?: string): Promise<WordPressTag> {
    return this.request<WordPressTag>('/tags', 'POST', {
      name,
      description: description || ''
    });
  }

  // 사이트 정보 확인
  async testConnection(): Promise<boolean> {
    try {
      console.log('[WP-API] 연결 테스트 시작:', this.baseUrl);
      const result = await this.request('/posts?per_page=1');
      console.log('[WP-API] ✅ 연결 성공');
      return true;
    } catch (error: any) {
      console.error('[WP-API] ❌ 연결 테스트 실패:', {
        baseUrl: this.baseUrl,
        errorMessage: error?.message || '알 수 없는 오류',
        errorCode: error?.code || error?.status || 'UNKNOWN',
        errorDetails: error?.response?.data || error?.response || error
      });
      return false;
    }
  }

  // 포스트 검색
  async searchPosts(search: string, perPage: number = 10): Promise<WordPressPost[]> {
    return this.request<WordPressPost[]>(`/posts?search=${encodeURIComponent(search)}&per_page=${perPage}`);
  }

  // 최근 포스트 조회
  async getRecentPosts(perPage: number = 10): Promise<WordPressPost[]> {
    return this.request<WordPressPost[]>(`/posts?per_page=${perPage}&orderby=date&order=desc`);
  }

}

// 독립 함수: 워드프레스 카테고리 조회
export async function getWordPressCategories(args: {
  siteUrl: string;
  username?: string;
  password?: string;
  jwtToken?: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<WordPressCategory[]> {
  const config: WordPressConfig = {
    siteUrl: args.siteUrl
  };
  
  if (args.username) config.username = args.username;
  if (args.password) config.password = args.password;
  if (args.jwtToken) config.jwtToken = args.jwtToken;
  if (args.clientId) config.clientId = args.clientId;
  if (args.clientSecret) config.clientSecret = args.clientSecret;
  
  const api = new WordPressAPI(config);
  
  return api.getCategories();
}

// 독립 함수: 워드프레스 태그 조회
export async function getWordPressTags(args: {
  siteUrl: string;
  username?: string;
  password?: string;
  jwtToken?: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<WordPressTag[]> {
  const config: WordPressConfig = {
    siteUrl: args.siteUrl
  };
  
  if (args.username) config.username = args.username;
  if (args.password) config.password = args.password;
  if (args.jwtToken) config.jwtToken = args.jwtToken;
  if (args.clientId) config.clientId = args.clientId;
  if (args.clientSecret) config.clientSecret = args.clientSecret;
  
  const api = new WordPressAPI(config);
  
  return api.getTags();
}

export async function testWordPressConnection(args: {
  siteUrl: string;
  username?: string;
  password?: string;
  jwtToken?: string;
}): Promise<{ success: boolean; message: string }> {
  const rawUrl = String(args.siteUrl || '').trim();
  if (!rawUrl) {
    return { success: false, message: 'WordPress 사이트 URL이 비어 있습니다.' };
  }

  const siteUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`)
    .replace(/\/wp-admin\/?$/i, '')
    .replace(/\/wp-login\.php$/i, '')
    .replace(/\/+$/, '');

  const username = String(args.username || '').trim();
  const password = String(args.password || '').trim();
  const jwtToken = String(args.jwtToken || '').trim();

  if (!jwtToken && (!username || !password)) {
    return { success: false, message: 'WordPress 관리자 ID와 Application Password가 필요합니다.' };
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'WordPress-Auto-Blogger/1.0'
  };

  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  } else {
    headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  const authCheckUrl = `${siteUrl}/wp-json/wp/v2/users/me?context=edit`;
  const restRootUrl = `${siteUrl}/wp-json/`;

  try {
    const response = await fetch(authCheckUrl, { method: 'GET', headers });

    if (response.ok) {
      const user: any = await response.json().catch(() => ({}));
      const label = user?.name || user?.slug || username;
      return { success: true, message: `WordPress REST API 인증 성공${label ? ` (${label})` : ''}` };
    }

    const body = await response.text().catch(() => '');
    const shortBody = body.replace(/\s+/g, ' ').trim().slice(0, 180);

    if (response.status === 401) {
      return {
        success: false,
        message: '401 인증 실패: 관리자 ID 또는 Application Password가 맞지 않습니다. 일반 로그인 비밀번호가 아니라 프로필에서 만든 Application Password를 넣어야 합니다.'
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        message: '403 권한 차단: 보안 플러그인, WAF, REST API 차단, 또는 계정 권한 문제를 확인해주세요.'
      };
    }

    if (response.status === 404) {
      return {
        success: false,
        message: '404 REST API 경로 없음: /wp-json/ 접근 가능 여부와 고유주소/REST API 차단 설정을 확인해주세요.'
      };
    }

    return {
      success: false,
      message: `WordPress REST API 인증 실패 (HTTP ${response.status})${shortBody ? `: ${shortBody}` : ''}`
    };
  } catch (error: any) {
    try {
      const restRoot = await fetch(restRootUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!restRoot.ok) {
        return {
          success: false,
          message: `/wp-json/ 연결 실패 (HTTP ${restRoot.status}). 사이트 URL, HTTPS, 보안 플러그인, 방화벽 설정을 확인해주세요.`
        };
      }
    } catch {
      // 아래 공통 메시지로 처리
    }

    return {
      success: false,
      message: `WordPress 연결 실패: ${error?.message || '알 수 없는 오류'}`
    };
  }
}
