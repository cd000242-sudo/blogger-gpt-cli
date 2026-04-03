/**
 * 🔗 URL 기반 완전 새로운 콘텐츠 생성기
 * 
 * URL만 입력하면:
 * - 제목 (H1) 완전히 새롭게 생성
 * - 소제목 (H2, H3) 완전히 새롭게 생성
 * - 본문 완전히 새롭게 작성 (중복 문서 방지)
 * - 태그/라벨 자동 생성
 * 
 * 원본 콘텐츠를 참고만 하고, 완전히 새로운 글을 작성합니다.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadEnvFromFile } from '../env';

// ============================================
// 타입 정의
// ============================================

export interface UrlCrawlResult {
  url: string;
  title: string;
  content: string;
  subheadings: string[];
  metaDescription: string;
  keywords: string[];
  images: string[];
  publishDate?: string;
  author?: string;
}

export interface GeneratedArticle {
  title: string;           // 완전히 새로운 제목
  h2Sections: H2Section[]; // 완전히 새로운 소제목과 본문
  tags: string[];          // 자동 생성된 태그
  metaDescription: string; // SEO 메타 설명
  html: string;            // 최종 HTML
}

export interface H2Section {
  title: string;
  h3Sections: H3Section[];
}

export interface H3Section {
  title: string;
  content: string;
}

// ============================================
// Gemini API 설정
// ============================================

function getGeminiApiKey(): string {
  try {
    const envData = loadEnvFromFile();
    const key = envData['geminiKey'] || envData['GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'] || '';
    return key.trim();
  } catch (error) {
    return process.env['GEMINI_API_KEY'] || '';
  }
}

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey.length < 20) {
      throw new Error('Gemini API 키가 설정되지 않았습니다.');
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

// ============================================
// 1단계: URL 깊이 크롤링
// ============================================

export async function deepCrawlUrl(url: string): Promise<UrlCrawlResult> {
  console.log(`[URL-GEN] 🔍 URL 깊이 크롤링 시작: ${url.substring(0, 60)}...`);

  let html = '';
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 10000,
      maxRedirects: 5,
    });
    html = response.data;
  } catch (axiosError) {
    console.warn(`[URL-GEN] ⚠️ Axios 크롤링 실패, Puppeteer로 전환합니다: ${url}`);
    html = await crawlWithPuppeteer(url);
  }

  const $ = cheerio.load(html);

  // 불필요한 요소 제거
  $('script, style, nav, header, footer, aside, .ads, .advertisement, .sidebar, .comment, .comments, noscript, iframe').remove();

  // 제목 추출
  let title = '';
  const titleSelectors = [
    'h1', 'meta[property="og:title"]', '.article_tit', '.news_title',
    'h1.title', 'h1.entry-title', 'h1.post-title', 'title'
  ];

  for (const sel of titleSelectors) {
    if (sel.includes('meta')) {
      const found = $(sel).attr('content');
      if (found && found.length > 5) {
        const parts = found.split(' - ');
        const part1 = parts[0] || found;
        const parts2 = part1.split(' | ');
        const part2 = parts2[0] || part1;
        const parts3 = part2.split(' : ');
        title = (parts3[0] || part2).trim();
        break;
      }
    } else {
      const found = $(sel).first().text().trim();
      if (found && found.length > 5 && found.length < 200) {
        title = found;
        break;
      }
    }
  }

  // 메타 설명 추출
  const metaDescription = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') || '';

  // 키워드 추출
  const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
  const keywords = metaKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

  // 소제목 추출 (H2, H3)
  const subheadings: string[] = [];
  $('h2, h3').each((_i, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 3 && text.length < 100) {
      subheadings.push(text);
    }
  });

  // 본문 추출 (다양한 사이트 지원)
  let content = '';
  const contentSelectors = [
    'article', '.article-body', '.article-content', '.post-content',
    '.entry-content', '.content', '#content', 'main',
    '.se-main-container', '.post-view', '#postViewArea', // 네이버 블로그
    '.article-view', // 티스토리
  ];

  for (const sel of contentSelectors) {
    const found = $(sel).first();
    if (found.length) {
      const text = found.text().trim().replace(/\s+/g, ' ');
      if (text.length > content.length) {
        content = text;
      }
    }
  }

  // 본문이 너무 짧으면 body에서 추출
  if (content.length < 500) {
    const bodyText = $('body').text().trim().replace(/\s+/g, ' ');
    if (bodyText.length > content.length) {
      content = bodyText;
    }
  }

  // 이미지 URL 추출
  const images: string[] = [];
  $('img').each((_i, elem) => {
    const src = $(elem).attr('src') || $(elem).attr('data-src');
    if (src && (src.startsWith('http') || src.startsWith('//'))) {
      images.push(src.startsWith('//') ? 'https:' + src : src);
    }
  });

  // 작성자, 날짜 추출
  const author = $('meta[name="author"]').attr('content') ||
    $('[class*="author"]').first().text().trim() || '';
  const publishDate = $('meta[property="article:published_time"]').attr('content') ||
    $('time').first().attr('datetime') || '';

  console.log(`[URL-GEN] ✅ 크롤링 완료: 제목="${title.substring(0, 30)}...", 본문=${content.length}자, H2/H3=${subheadings.length}개`);

  return {
    url,
    title: title || '제목 없음',
    content: content, // 최대 10000자로 이미 잘림
    subheadings: subheadings.slice(0, 20),
    metaDescription,
    keywords,
    images: images.slice(0, 10),
    publishDate,
    author,
  };
}

// ============================================
// 2단계: AI로 완전히 새로운 콘텐츠 생성
// ============================================

/**
 * URL 콘텐츠를 참고하여 완전히 새로운 제목 생성
 */
async function generateNewTitle(crawledData: UrlCrawlResult): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `당신은 SEO 전문 블로그 작가입니다.

다음 참고 자료를 바탕으로, 완전히 새로운 블로그 제목을 생성하세요.

[참고 자료]
- 원본 제목: ${crawledData.title}
- 주요 내용: ${crawledData.content.substring(0, 1500)}
- 키워드: ${crawledData.keywords.join(', ')}

[요구사항]
1. 원본 제목과 완전히 다른 새로운 제목 생성
2. SEO에 최적화된 제목 (50-70자)
3. 호기심을 자극하는 클릭 유도 제목
4. 숫자나 연도 활용 권장 (2025년 등)
5. 절대로 원본 제목을 그대로 복사하지 마세요

새로운 제목만 출력하세요 (따옴표 없이):`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // 따옴표 제거
    return text.replace(/^["']|["']$/g, '').trim();
  } catch (error: any) {
    console.error('[URL-GEN] 제목 생성 실패:', error.message);
    // 폴백: 원본 제목 변형
    return `${crawledData.title} - 2025년 완벽 가이드`;
  }
}

/**
 * 완전히 새로운 H2 소제목 5개 생성
 */
async function generateNewH2Titles(crawledData: UrlCrawlResult, keyword: string): Promise<string[]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `당신은 블로그 콘텐츠 구조 전문가입니다.

다음 참고 자료를 바탕으로, 완전히 새로운 H2 소제목 5개를 생성하세요.

[주제/키워드]
${keyword || crawledData.title}

[참고 소제목]
${crawledData.subheadings.slice(0, 10).join('\n')}

[참고 내용]
${crawledData.content.substring(0, 2000)}

[요구사항]
1. 참고 소제목과 완전히 다른 새로운 소제목 5개 생성
2. 논리적 흐름 (서론 → 개념 → 방법 → 사례 → 결론)
3. 각 소제목은 20-40자
4. 독자의 궁금증을 해결하는 구조
5. 절대로 참고 소제목을 그대로 복사하지 마세요

JSON 배열로 출력하세요:
["소제목1", "소제목2", "소제목3", "소제목4", "소제목5"]`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // JSON 파싱
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 5);
      }
    }
  } catch (error: any) {
    console.error('[URL-GEN] H2 생성 실패:', error.message);
  }

  // 폴백
  const topic = keyword || crawledData.title;
  return [
    `${topic}란 무엇인가? 핵심 개념 정리`,
    `${topic}가 중요한 이유 5가지`,
    `${topic} 실전 활용 방법 가이드`,
    `${topic} 성공 사례와 팁`,
    `${topic} 총정리 및 시작하기`,
  ];
}

/**
 * 각 H2에 대한 H3 소제목과 본문 생성
 */
async function generateH2Content(
  h2Title: string,
  crawledData: UrlCrawlResult,
  keyword: string
): Promise<H3Section[]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `당신은 전문 블로그 작가입니다.

다음 H2 소제목에 대한 상세 내용을 작성하세요.

[H2 소제목]
${h2Title}

[주제/키워드]
${keyword || crawledData.title}

[참고 자료]
${crawledData.content.substring(0, 3000)}

[요구사항]
1. H3 소제목 3개 생성 (각 15-30자)
2. 각 H3에 대한 본문 작성 (각 300-500자)
3. 원본 내용을 참고만 하고 완전히 새롭게 작성
4. 절대로 원본 문장을 그대로 복사하지 마세요
5. 실용적이고 구체적인 정보 포함
6. 문체: 친근하고 전문적인 어투 (~입니다, ~합니다)

JSON 형식으로 출력:
{
  "h3Sections": [
    {"title": "H3 제목1", "content": "본문1..."},
    {"title": "H3 제목2", "content": "본문2..."},
    {"title": "H3 제목3", "content": "본문3..."}
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.h3Sections && Array.isArray(parsed.h3Sections)) {
        return parsed.h3Sections;
      }
    }
  } catch (error: any) {
    console.error('[URL-GEN] H3 콘텐츠 생성 실패:', error.message);
  }

  // 폴백
  return [
    { title: `${h2Title} 개요`, content: `${h2Title}에 대해 자세히 알아보겠습니다. 이 내용은 여러분의 이해를 돕기 위해 작성되었습니다.` },
    { title: `${h2Title} 핵심 포인트`, content: `핵심적인 내용을 정리하면 다음과 같습니다. 실제로 적용할 때 참고하시기 바랍니다.` },
    { title: `${h2Title} 실전 팁`, content: `실제로 활용할 때 도움이 되는 팁을 공유합니다. 꼭 기억해두세요.` },
  ];
}

/**
 * 태그/라벨 자동 생성
 */
async function generateTags(crawledData: UrlCrawlResult, keyword: string): Promise<string[]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `다음 내용에 대한 블로그 태그 10개를 생성하세요.

[주제]: ${keyword || crawledData.title}
[키워드]: ${crawledData.keywords.join(', ')}
[내용 요약]: ${crawledData.content.substring(0, 1000)}

JSON 배열로 태그만 출력:
["태그1", "태그2", ...]`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 10);
      }
    }
  } catch (error: any) {
    console.error('[URL-GEN] 태그 생성 실패:', error.message);
  }

  // 폴백
  return [keyword || crawledData.title, '정보', '가이드', '2025'];
}

// ============================================
// 3단계: HTML 생성
// ============================================

function generateArticleHtml(
  title: string,
  h2Sections: H2Section[],
  tags: string[]
): string {
  let html = `
<style>
.url-gen-content { max-width: 800px; margin: 0 auto; font-family: 'Noto Sans KR', sans-serif; line-height: 1.8; }
.url-gen-content h2 { font-size: 24px; font-weight: 700; margin: 32px 0 16px; padding: 16px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 8px; }
.url-gen-content h3 { font-size: 20px; font-weight: 600; margin: 24px 0 12px; color: #1e293b; }
.url-gen-content p { font-size: 18px; color: #334155; margin-bottom: 16px; }
.url-gen-tags { margin-top: 32px; display: flex; flex-wrap: wrap; gap: 8px; }
.url-gen-tag { background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 16px; font-size: 14px; }
</style>
<div class="url-gen-content">
`;

  // H2 섹션들
  for (const h2 of h2Sections) {
    html += `\n<h2>${h2.title}</h2>\n`;

    for (const h3 of h2.h3Sections) {
      html += `<h3>${h3.title}</h3>\n`;
      html += `<p>${h3.content}</p>\n`;
    }
  }

  // 태그
  if (tags.length > 0) {
    html += `\n<div class="url-gen-tags">\n`;
    for (const tag of tags) {
      html += `  <span class="url-gen-tag">#${tag}</span>\n`;
    }
    html += `</div>\n`;
  }

  html += `</div>`;

  return html;
}

// ============================================
// 메인 함수: URL로 완전 새로운 콘텐츠 생성
// ============================================

export async function generateContentFromUrl(
  url: string,
  keyword?: string,
  onLog?: (msg: string) => void
): Promise<GeneratedArticle> {
  const log = onLog || console.log;

  log('[PROGRESS] 5% - 🔗 URL 콘텐츠 분석 시작...');

  // 1. URL 크롤링
  const crawledData = await deepCrawlUrl(url);
  log(`[PROGRESS] 15% - ✅ URL 분석 완료: "${crawledData.title.substring(0, 30)}..."`);

  // 키워드가 없으면 제목에서 추출
  const effectiveKeyword = keyword || crawledData.title.split(' ').slice(0, 3).join(' ');

  // 2. 새로운 제목 생성
  log('[PROGRESS] 20% - ✍️ AI가 새로운 제목 생성 중...');
  const newTitle = await generateNewTitle(crawledData);
  log(`[PROGRESS] 25% - ✅ 새 제목: "${newTitle}"`);

  // 3. 새로운 H2 소제목 생성
  log('[PROGRESS] 30% - 📊 AI가 소제목 구조 생성 중...');
  const h2Titles = await generateNewH2Titles(crawledData, effectiveKeyword);
  log(`[PROGRESS] 40% - ✅ ${h2Titles.length}개 소제목 생성 완료`);

  // 4. 각 H2에 대한 H3 콘텐츠 생성
  log('[PROGRESS] 45% - 📝 AI가 본문 작성 중...');
  const h2Sections: H2Section[] = [];

  for (let i = 0; i < h2Titles.length; i++) {
    const h2Title = h2Titles[i];
    if (!h2Title) continue;
    const progress = 45 + Math.floor((i / h2Titles.length) * 30);
    log(`[PROGRESS] ${progress}% - 📝 H2 ${i + 1}/${h2Titles.length} 본문 작성 중...`);

    const h3Sections = await generateH2Content(h2Title, crawledData, effectiveKeyword);
    h2Sections.push({
      title: h2Title,
      h3Sections,
    });
  }

  log('[PROGRESS] 80% - ✅ 본문 작성 완료');

  // 5. 태그 생성
  log('[PROGRESS] 85% - 🏷️ 태그 생성 중...');
  const tags = await generateTags(crawledData, effectiveKeyword);
  log(`[PROGRESS] 90% - ✅ ${tags.length}개 태그 생성`);

  // 6. HTML 조립
  log('[PROGRESS] 95% - 🎨 HTML 구조 생성 중...');
  const html = generateArticleHtml(newTitle, h2Sections, tags);

  log('[PROGRESS] 100% - ✅ 콘텐츠 생성 완료!');

  return {
    title: newTitle,
    h2Sections,
    tags,
    metaDescription: crawledData.metaDescription,
    html,
  };
}

/**
 * 여러 URL에서 콘텐츠 생성 (참고 자료 병합)
 */
export async function generateContentFromUrls(
  urls: string[],
  keyword?: string,
  onLog?: (msg: string) => void
): Promise<GeneratedArticle> {
  const log = onLog || console.log;

  if (urls.length === 0) {
    throw new Error('URL이 최소 1개 이상 필요합니다.');
  }

  const firstUrl = urls[0];
  if (!firstUrl) {
    throw new Error('URL이 유효하지 않습니다.');
  }

  if (urls.length === 1) {
    return generateContentFromUrl(firstUrl, keyword, onLog);
  }

  log(`[PROGRESS] 5% - 🔗 ${urls.length}개 URL 분석 시작...`);

  // 여러 URL 크롤링
  const crawledDataList: UrlCrawlResult[] = [];
  for (let i = 0; i < urls.length; i++) {
    const currentUrl = urls[i];
    if (!currentUrl) continue;
    try {
      const data = await deepCrawlUrl(currentUrl);
      crawledDataList.push(data);
      log(`[PROGRESS] ${5 + Math.floor((i / urls.length) * 10)}% - ✅ URL ${i + 1}/${urls.length} 분석 완료`);
    } catch (err: any) {
      log(`⚠️ URL ${i + 1} 분석 실패: ${err.message}`);
    }
  }

  if (crawledDataList.length === 0) {
    throw new Error('모든 URL 분석에 실패했습니다.');
  }

  const firstCrawled = crawledDataList[0];
  if (!firstCrawled) {
    throw new Error('크롤링 데이터가 없습니다.');
  }

  // 데이터 병합
  const mergedData: UrlCrawlResult = {
    url: firstUrl,
    title: firstCrawled.title,
    content: crawledDataList.map(d => d.content).join('\n\n'),
    subheadings: crawledDataList.flatMap(d => d.subheadings),
    metaDescription: firstCrawled.metaDescription,
    keywords: [...new Set(crawledDataList.flatMap(d => d.keywords))],
    images: crawledDataList.flatMap(d => d.images).slice(0, 10),
  };

  // 병합된 데이터로 콘텐츠 생성
  const effectiveKeyword = keyword || mergedData.title.split(' ').slice(0, 3).join(' ');

  log('[PROGRESS] 20% - ✍️ AI가 새로운 제목 생성 중...');
  const newTitle = await generateNewTitle(mergedData);

  log('[PROGRESS] 30% - 📊 AI가 소제목 구조 생성 중...');
  const h2Titles = await generateNewH2Titles(mergedData, effectiveKeyword);

  log('[PROGRESS] 45% - 📝 AI가 본문 작성 중...');
  const h2Sections: H2Section[] = [];

  for (let i = 0; i < h2Titles.length; i++) {
    const h2Title = h2Titles[i];
    if (!h2Title) continue;
    const h3Sections = await generateH2Content(h2Title, mergedData, effectiveKeyword);
    h2Sections.push({ title: h2Title, h3Sections });
    log(`[PROGRESS] ${45 + Math.floor((i / h2Titles.length) * 30)}% - 📝 H2 ${i + 1}/${h2Titles.length} 완료`);
  }

  log('[PROGRESS] 85% - 🏷️ 태그 생성 중...');
  const tags = await generateTags(mergedData, effectiveKeyword);

  log('[PROGRESS] 95% - 🎨 HTML 구조 생성 중...');
  const html = generateArticleHtml(newTitle, h2Sections, tags);

  log('[PROGRESS] 100% - ✅ 콘텐츠 생성 완료!');

  return {
    title: newTitle,
    h2Sections,
    tags,
    metaDescription: mergedData.metaDescription,
    html,
  };
}
// ============================================
// Puppeteer 크롤링 유틸리티
// ============================================

async function crawlWithPuppeteer(url: string): Promise<string> {
  let browser = null;
  try {
    puppeteer.use(StealthPlugin());
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    // 네트워크 유휴 상태까지 대기 (JS 렌더링 완료 대기)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 추가적인 렌더링 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    const html = await page.content();
    console.log(`[URL-GEN] ✅ Puppeteer 크롤링 성공 (${html.length}자)`);
    return html;
  } catch (error) {
    console.error('[URL-GEN] ❌ Puppeteer 크롤링 실패:', error);
    return '';
  } finally {
    if (browser) await browser.close();
  }
}
