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

  // SEO 메타 필드 업데이트 (Yoast SEO 연동)
  async updateSeoMeta(postId: number, seoData: {
    title?: string;
    description?: string;
    focusKeyword?: string;
  }): Promise<{ success: boolean }> {
    try {
      const metaData = {
        meta: {
          // Yoast SEO 플러그인 메타 필드
          '_yoast_wpseo_title': seoData.title || '',
          '_yoast_wpseo_metadesc': seoData.description || '',
          '_yoast_wpseo_focuskw': seoData.focusKeyword || '',
          
          // 다른 SEO 플러그인 지원
          '_rank_math_title': seoData.title || '',
          '_rank_math_description': seoData.description || '',
          '_rank_math_focus_keyword': seoData.focusKeyword || '',
          
          // All in One SEO Pack
          '_aioseop_title': seoData.title || '',
          '_aioseop_description': seoData.description || '',
          '_aioseop_keywords': seoData.focusKeyword || '',
        }
      };

      await this.request<WordPressPost>(`/posts/${postId}`, 'PUT', metaData);
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

