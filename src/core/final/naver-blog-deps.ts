/**
 * naver-blog-deps — naver-blog-source 가 쓰는 **바깥 세계** 를 한 군데 모은다. (v3.8.595)
 *
 * 수집 로직(naver-blog-source)은 순수 함수라 테스트가 네트워크를 안 탄다.
 * 실제 HTTP·검색 API 는 여기서만 붙인다. 두 크롤러(url-content-generator, crawlers)가
 * 같은 배선을 쓰도록 한 곳에 둔다 — 한쪽만 고쳐 두면 다른 경로가 조용히 옛 동작으로 남는다.
 */

import axios from 'axios';
import { naverSearch } from '../naver-search-client';
import type { NaverBlogFetchDeps } from './naver-blog-source';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function buildNaverBlogDeps(log?: (msg: string) => void): NaverBlogFetchDeps {
  return {
    fetchHtml: async (url: string): Promise<string> => {
      try {
        const response = await axios.get(url, {
          headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
          timeout: 10000,
          maxRedirects: 3,
          maxContentLength: 3_000_000,
          responseType: 'text',
          transformResponse: [(data: any) => data],
        });
        return typeof response.data === 'string' ? response.data : String(response.data || '');
      } catch {
        return '';   // 실패는 다음 갈래로 넘어가라는 뜻이다
      }
    },
    searchBlog: async (query: string): Promise<any[]> => {
      // 글 번호(logNo)로 검색하면 그 글 하나가 나온다 (실측: total 1)
      const result = await naverSearch('blog', { query, display: 5 });
      return result.ok ? result.items : [];
    },
    ...(log ? { log } : {}),
  };
}
