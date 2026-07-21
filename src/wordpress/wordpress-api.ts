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

  // SEO 메타 필드 업데이트 (Yoast SEO / Rank Math / AIOSEO 다중 지원)
  // v3.8.306: Rank Math 필드 접두사 수정 (`_rank_math_*` → `rank_math_*`) — 사용자 보고: Rank Math에서 SEO 필드 인식 안 됨
  async updateSeoMeta(postId: number, seoData: {
    title?: string;
    description?: string;
    focusKeyword?: string;
  }): Promise<{ success: boolean }> {
    try {
      const metaData = {
        meta: {
          // Yoast SEO — 접두사 `_yoast_wpseo_`
          '_yoast_wpseo_title': seoData.title || '',
          '_yoast_wpseo_metadesc': seoData.description || '',
          '_yoast_wpseo_focuskw': seoData.focusKeyword || '',

          // Rank Math — 접두사 없음 (공식 필드명)
          'rank_math_title': seoData.title || '',
          'rank_math_description': seoData.description || '',
          'rank_math_focus_keyword': seoData.focusKeyword || '',

          // All in One SEO Pack
          '_aioseop_title': seoData.title || '',
          '_aioseop_description': seoData.description || '',
          '_aioseop_keywords': seoData.focusKeyword || '',
        }
      };

      await this.request<WordPressPost>(`/posts/${postId}`, 'PUT', metaData);

      // v3.8.306: Rank Math 전용 REST API 시도 (meta whitelist 우회)
      // Rank Math는 register_meta로 자체 등록 안 하면 WP `meta:` 필드로는 저장 안 됨.
      // 그래서 자체 REST endpoint로 재시도.
      try {
        const rankMathUrl = `${this.config.siteUrl.replace(/\/$/, '')}/wp-json/rankmath/v1/updatePostMeta`;
        const auth = btoa(`${this.config.username}:${this.config.password}`);
        await fetch(rankMathUrl, {
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
        }).catch(() => null); // Rank Math 미설치 사이트면 조용히 실패
      } catch { /* Rank Math 없으면 정상 */ }

      return { success: true };
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
