/**
 * 🔗 자동 내부링크 시스템
 * - 키워드 기반 관련 글 검색
 * - HTML 본문에 자동 삽입
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// ============================================
// 🔧 인터페이스 정의
// ============================================

export interface InternalLink {
  title: string;
  url: string;
  relevance: number; // 0-100
  excerpt?: string;
}

export interface InternalLinkConfig {
  enabled: boolean;
  linksPerSection: number; // H2 섹션당 링크 개수
  blogUrl?: string; // 내 블로그 URL
}

// ============================================
// 🔍 블로그 내 관련 글 검색
// ============================================

/**
 * 티스토리 블로그에서 관련 글 검색
 */
async function searchTistoryPosts(blogUrl: string, keyword: string): Promise<InternalLink[]> {
  try {
    // 티스토리 검색 URL
    const searchUrl = `${blogUrl}/search/${encodeURIComponent(keyword)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
    
    const $ = cheerio.load(response.data);
    const links: InternalLink[] = [];
    
    // 티스토리 검색 결과 파싱
    $('article, .post-item, .entry, .article-list li').each((idx, el) => {
      if (idx >= 10) return; // 최대 10개
      
      const titleEl = $(el).find('a.link_post, a.title, h2 a, .tit a').first();
      const title = titleEl.text().trim();
      let url = titleEl.attr('href') || '';
      
      // 상대 경로면 절대 경로로 변환
      if (url && !url.startsWith('http')) {
        url = new URL(url, blogUrl).href;
      }
      
      if (title && url) {
        // 키워드 관련도 계산
        const relevance = calculateRelevance(title, keyword);
        
        links.push({
          title,
          url,
          relevance,
        });
      }
    });
    
    // 관련도 순으로 정렬
    return links.sort((a, b) => b.relevance - a.relevance);
  } catch (error) {
    console.warn(`[내부링크] 티스토리 검색 실패: ${error}`);
    return [];
  }
}

/**
 * 워드프레스 블로그에서 관련 글 검색
 */
async function searchWordPressPosts(blogUrl: string, keyword: string): Promise<InternalLink[]> {
  try {
    // 워드프레스 검색 URL
    const searchUrl = `${blogUrl}/?s=${encodeURIComponent(keyword)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
    
    const $ = cheerio.load(response.data);
    const links: InternalLink[] = [];
    
    // 워드프레스 검색 결과 파싱
    $('article, .post, .entry').each((idx, el) => {
      if (idx >= 10) return;
      
      const titleEl = $(el).find('h2 a, h3 a, .entry-title a').first();
      const title = titleEl.text().trim();
      let url = titleEl.attr('href') || '';
      
      if (title && url) {
        const relevance = calculateRelevance(title, keyword);
        links.push({ title, url, relevance });
      }
    });
    
    return links.sort((a, b) => b.relevance - a.relevance);
  } catch (error) {
    console.warn(`[내부링크] 워드프레스 검색 실패: ${error}`);
    return [];
  }
}

/**
 * 블로그스팟에서 관련 글 검색
 */
async function searchBlogspotPosts(blogUrl: string, keyword: string): Promise<InternalLink[]> {
  try {
    // 블로그스팟 검색 URL
    const searchUrl = `${blogUrl}/search?q=${encodeURIComponent(keyword)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
    
    const $ = cheerio.load(response.data);
    const links: InternalLink[] = [];
    
    // 블로그스팟 검색 결과 파싱
    $('.post, .post-outer, article').each((idx, el) => {
      if (idx >= 10) return;
      
      const titleEl = $(el).find('h3 a, h2 a, .post-title a').first();
      const title = titleEl.text().trim();
      let url = titleEl.attr('href') || '';
      
      if (title && url) {
        const relevance = calculateRelevance(title, keyword);
        links.push({ title, url, relevance });
      }
    });
    
    return links.sort((a, b) => b.relevance - a.relevance);
  } catch (error) {
    console.warn(`[내부링크] 블로그스팟 검색 실패: ${error}`);
    return [];
  }
}

/**
 * 키워드 관련도 계산 (0-100)
 */
function calculateRelevance(title: string, keyword: string): number {
  const titleLower = title.toLowerCase();
  const keywordLower = keyword.toLowerCase();
  const keywordWords = keywordLower.split(/\s+/);
  
  let score = 0;
  
  // 정확히 일치하면 100점
  if (titleLower.includes(keywordLower)) {
    score += 80;
  }
  
  // 키워드 단어별 포함 여부
  for (const word of keywordWords) {
    if (word.length > 1 && titleLower.includes(word)) {
      score += 20;
    }
  }
  
  return Math.min(100, score);
}

// ============================================
// 🎯 메인 함수
// ============================================

/**
 * 블로그에서 관련 글 검색
 */
export async function findRelatedPosts(
  blogUrl: string,
  keyword: string,
  maxResults: number = 5
): Promise<InternalLink[]> {
  if (!blogUrl || !keyword) {
    return [];
  }
  
  console.log(`[내부링크] "${keyword}" 관련 글 검색 중... (${blogUrl})`);
  
  let links: InternalLink[] = [];
  
  // 블로그 플랫폼 감지 및 검색
  if (blogUrl.includes('tistory.com')) {
    links = await searchTistoryPosts(blogUrl, keyword);
  } else if (blogUrl.includes('blogspot.com') || blogUrl.includes('blogger.com')) {
    links = await searchBlogspotPosts(blogUrl, keyword);
  } else {
    // 기본적으로 워드프레스 형식으로 시도
    links = await searchWordPressPosts(blogUrl, keyword);
  }
  
  // 관련도 50% 이상만 필터링
  const filteredLinks = links.filter(link => link.relevance >= 50);
  
  console.log(`[내부링크] ${filteredLinks.length}개 관련 글 발견`);
  
  return filteredLinks.slice(0, maxResults);
}

/**
 * HTML 본문에 내부링크 삽입
 */
export function insertInternalLinks(
  html: string,
  links: InternalLink[],
  linksPerSection: number = 1
): string {
  if (links.length === 0 || linksPerSection === 0) {
    return html;
  }
  
  const $ = cheerio.load(html, { decodeEntities: false });
  
  // H2 섹션 찾기
  const h2Sections = $('h2');
  let linkIndex = 0;
  
  h2Sections.each((idx, h2) => {
    if (linkIndex >= links.length) return;
    
    // 해당 H2의 다음 콘텐츠 영역 찾기
    const section = $(h2).nextUntil('h2');
    const lastParagraph = section.filter('p, div.premium-content').last();
    
    if (lastParagraph.length > 0) {
      // 내부링크 박스 생성
      const linksToInsert = links.slice(linkIndex, linkIndex + linksPerSection);
      const linkBoxHtml = generateInternalLinkBox(linksToInsert);
      
      // 마지막 문단 뒤에 삽입
      lastParagraph.after(linkBoxHtml);
      
      linkIndex += linksPerSection;
    }
  });
  
  return $.html();
}

/**
 * 내부링크 박스 HTML 생성
 */
function generateInternalLinkBox(links: InternalLink[]): string {
  if (links.length === 0) return '';
  
  const linkItems = links.map(link => `
    <li style="margin-bottom: 8px;">
      <a href="${link.url}" target="_blank" rel="noopener" 
         style="color: #667eea; text-decoration: none; font-weight: 600; transition: color 0.3s;">
        📌 ${link.title}
      </a>
    </li>
  `).join('');
  
  return `
<div class="internal-link-box" style="
  margin: 24px 0;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #e8f4f8 100%);
  border-left: 4px solid #667eea;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
">
  <p style="margin: 0 0 12px 0; font-weight: 700; color: #1e293b; font-size: 15px;">
    🔗 관련 글 더 보기
  </p>
  <ul style="margin: 0; padding-left: 20px; list-style: none;">
    ${linkItems}
  </ul>
</div>
`;
}

/**
 * 키워드에서 내부링크용 검색어 추출
 */
export function extractSearchKeywords(keyword: string, h2Titles: string[]): string[] {
  const keywords = new Set<string>();
  
  // 메인 키워드 추가
  keywords.add(keyword);
  
  // H2 제목에서 키워드 추출
  for (const h2 of h2Titles.slice(0, 3)) {
    // 핵심 단어만 추출 (조사, 어미 제거)
    const words = h2.split(/\s+/).filter(w => w.length > 2);
    words.forEach(w => keywords.add(w));
  }
  
  return Array.from(keywords).slice(0, 5);
}

/**
 * 내부링크 콘텐츠 생성 (Electron IPC용)
 */
export async function generateInternalLinkContent(
  request: { blogUrl: string; keyword: string; count?: number },
  _geminiKey: string
): Promise<{ links: InternalLink[] }> {
  const { blogUrl, keyword, count = 5 } = request;
  
  if (!blogUrl || !keyword) {
    return { links: [] };
  }
  
  const links = await findRelatedPosts(blogUrl, keyword, count);
  return { links };
}
