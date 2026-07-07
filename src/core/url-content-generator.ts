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
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadEnvFromFile } from '../env';
import { callGeminiWithRetry } from './final/gemini-engine';

const URL_GEN_AXIOS_TIMEOUT_MS = Number(process.env['URL_GEN_AXIOS_TIMEOUT_MS'] || 8000);
const URL_GEN_PUPPETEER_TIMEOUT_MS = Number(process.env['URL_GEN_PUPPETEER_TIMEOUT_MS'] || 15000);
const URL_GEN_CONTEXT_CHARS = Number(process.env['URL_GEN_CONTEXT_CHARS'] || 7000);
const URL_GEN_TARGET_H2 = Number(process.env['URL_GEN_TARGET_H2'] || 5);
const URL_GEN_H3_PER_H2 = Number(process.env['URL_GEN_H3_PER_H2'] || 2);
const URL_GEN_ENABLE_BROWSER_FALLBACK = /^(1|true|yes)$/i.test(String(process.env['URL_GEN_ENABLE_BROWSER_FALLBACK'] || ''));

function resolvePuppeteerExecutablePath(): string | undefined {
  const envCandidates = [
    process.env['PUPPETEER_EXECUTABLE_PATH'],
    process.env['CHROME_PATH'],
    process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'],
  ].filter(Boolean) as string[];
  for (const candidate of envCandidates) {
    try { if (candidate && fs.existsSync(candidate)) return candidate; } catch {}
  }
  try {
    const { chromium } = require('playwright');
    const playwrightPath = chromium?.executablePath?.();
    if (playwrightPath && fs.existsSync(playwrightPath)) return playwrightPath;
  } catch {}
  const localAppData = process.env['LOCALAPPDATA'] || '';
  const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const candidates = [
    path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
  ];
  return candidates.find((candidate) => {
    try { return !!candidate && fs.existsSync(candidate); } catch { return false; }
  });
}

function withPuppeteerBrowserFallback<T extends Record<string, any>>(options: T): T {
  if (options['executablePath']) return options;
  const executablePath = resolvePuppeteerExecutablePath();
  return executablePath ? { ...options, executablePath } : options;
}

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

function guessTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname)
      .replace(/[-_+]+/g, ' ')
      .replace(/\.(html?|php|aspx?)$/i, '')
      .trim();
    return last || parsed.hostname;
  } catch {
    return 'URL 참고 콘텐츠';
  }
}

function cleanJsonText(text: string): string {
  return String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
}

function parseJsonObjectLoose(text: string): any {
  const cleaned = cleanJsonText(text);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('JSON 객체를 찾지 못했습니다.');
  }
  const json = cleaned
    .slice(start, end + 1)
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(json);
}

function safeText(value: any, fallback = ''): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function fallbackTags(crawledData: UrlCrawlResult, keyword: string): string[] {
  const base = [
    keyword,
    ...crawledData.keywords,
    ...crawledData.title.split(/\s+/).slice(0, 4),
    '가이드',
    '정보',
  ];
  return Array.from(new Set(base.map((v) => safeText(v)).filter(Boolean))).slice(0, 10);
}

function normalizeGeneratedArticle(raw: any, crawledData: UrlCrawlResult, keyword: string): GeneratedArticle {
  const title = safeText(raw?.title, `${keyword || crawledData.title} 완벽 가이드`);
  const rawSections = Array.isArray(raw?.h2Sections) ? raw.h2Sections : [];
  const h2Sections = rawSections
    .map((section: any, idx: number) => {
      const h2Title = safeText(section?.title, `${keyword || crawledData.title} 핵심 ${idx + 1}`);
      const rawH3 = Array.isArray(section?.h3Sections) ? section.h3Sections : [];
      const h3Sections = rawH3
        .map((h3: any, h3Idx: number) => ({
          title: safeText(h3?.title, `${h2Title} 세부 ${h3Idx + 1}`).slice(0, 80),
          content: safeText(h3?.content, `${h2Title}에 대한 핵심 내용을 정리했습니다.`),
        }))
        .filter((h3: H3Section) => h3.content.length >= 20)
        .slice(0, 3);

      return {
        title: h2Title.slice(0, 90),
        h3Sections: h3Sections.length > 0
          ? h3Sections
          : [{ title: `${h2Title} 핵심 정리`, content: `${h2Title}에 대해 독자가 바로 이해할 수 있도록 핵심 내용을 새롭게 정리했습니다.` }],
      };
    })
    .filter((section: H2Section) => section.title && section.h3Sections.length > 0)
    .slice(0, URL_GEN_TARGET_H2);

  if (h2Sections.length < 3) {
    throw new Error(`URL 통합 생성 결과의 섹션이 부족합니다 (${h2Sections.length}개).`);
  }

  const tags = Array.isArray(raw?.tags)
    ? raw.tags.map((tag: any) => safeText(tag)).filter(Boolean).slice(0, 10)
    : fallbackTags(crawledData, keyword);

  const metaDescription = safeText(raw?.metaDescription, crawledData.metaDescription || `${title}에 대한 핵심 정보를 정리했습니다.`).slice(0, 160);
  const html = generateArticleHtml(title, h2Sections, tags);

  return {
    title,
    h2Sections,
    tags: tags.length > 0 ? tags : fallbackTags(crawledData, keyword),
    metaDescription,
    html,
  };
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
      timeout: URL_GEN_AXIOS_TIMEOUT_MS,
      maxRedirects: 5,
      maxContentLength: 2_000_000,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    html = response.data;
  } catch (axiosError) {
    const message = axiosError instanceof Error ? axiosError.message : String(axiosError);
    if (URL_GEN_ENABLE_BROWSER_FALLBACK) {
      console.warn(`[URL-GEN] ⚠️ Axios 크롤링 실패, 브라우저 폴백 사용: ${url} — ${message}`);
      html = await crawlWithPuppeteer(url);
    } else {
      console.warn(`[URL-GEN] ⚠️ 빠른 크롤링 실패, 브라우저 폴백 생략: ${url} — ${message}`);
      html = '';
    }
  }

  if (!html || html.trim().length < 80) {
    const fallbackTitle = guessTitleFromUrl(url);
    return {
      url,
      title: fallbackTitle,
      content: `${fallbackTitle}에 대한 참고 URL입니다. 원문 페이지가 차단되었거나 응답이 느려 본문 전체를 가져오지 못했습니다. 글 작성 시 변동 가능한 정보는 공식 사이트에서 최신 내용을 확인하도록 안내하세요. URL: ${url}`,
      subheadings: [],
      metaDescription: '',
      keywords: fallbackTitle.split(/\s+/).filter(Boolean).slice(0, 6),
      images: [],
    };
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
    const text = await callGeminiWithRetry(prompt);
    return text.trim().replace(/^["']|["']$/g, '').trim();
  } catch (error: any) {
    console.error('[URL-GEN] 제목 생성 실패:', error.message);
    return `${crawledData.title} - 2025년 완벽 가이드`;
  }
}

/**
 * 완전히 새로운 H2 소제목 5개 생성
 */
async function generateNewH2Titles(crawledData: UrlCrawlResult, keyword: string): Promise<string[]> {
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
    let text = (await callGeminiWithRetry(prompt)).trim();

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
    let text = (await callGeminiWithRetry(prompt)).trim();

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
  const prompt = `다음 내용에 대한 블로그 태그 10개를 생성하세요.

[주제]: ${keyword || crawledData.title}
[키워드]: ${crawledData.keywords.join(', ')}
[내용 요약]: ${crawledData.content.substring(0, 1000)}

JSON 배열로 태그만 출력:
["태그1", "태그2", ...]`;

  try {
    let text = (await callGeminiWithRetry(prompt)).trim();

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

/**
 * URL 전용 빠른 생성: 제목/H2/H3/태그를 한 번의 LLM 호출로 생성
 *
 * 기존 경로는 제목 1회 + H2 1회 + H2별 본문 5회 + 태그 1회로 최소 8회 호출이 필요했다.
 * URL 모드 사용자는 "URL 넣고 바로 글"을 기대하므로, 우선 통합 생성으로 응답 시간을 줄이고
 * 파싱 실패 때만 아래 레거시 순차 경로로 폴백한다.
 */
async function generateCompleteArticleFast(
  crawledData: UrlCrawlResult,
  keyword: string,
  onLog?: (msg: string) => void,
): Promise<GeneratedArticle> {
  const context = crawledData.content
    .replace(/\s+/g, ' ')
    .slice(0, URL_GEN_CONTEXT_CHARS);
  const h2Count = Math.max(3, Math.min(6, URL_GEN_TARGET_H2));
  const h3Count = Math.max(2, Math.min(3, URL_GEN_H3_PER_H2));

  const prompt = `당신은 SEO 블로그 작가이자 편집자입니다.

아래 URL에서 추출한 참고 자료를 바탕으로, 원문을 복사하지 않고 완전히 새로운 블로그 글을 작성하세요.

[주제/키워드]
${keyword || crawledData.title}

[원본 URL]
${crawledData.url}

[원본 제목]
${crawledData.title}

[원본 메타 설명]
${crawledData.metaDescription || '(없음)'}

[원본 소제목 참고]
${crawledData.subheadings.slice(0, 12).join('\n') || '(없음)'}

[원본 본문 참고]
${context}

[작성 규칙]
1. 원문 제목과 문장을 그대로 복사하지 말고, 새 관점과 새 문장으로 재작성하세요.
2. title은 50~70자 SEO 제목으로 작성하세요.
3. h2Sections는 정확히 ${h2Count}개 생성하세요.
4. 각 H2마다 h3Sections를 정확히 ${h3Count}개 생성하세요.
5. 각 H3 content는 350~550자, 실용적이고 구체적으로 작성하세요.
6. 한국어 존댓말 문체(~합니다, ~입니다)로 작성하세요.
7. 날짜, 금액, 자격 요건처럼 변동 가능한 정보는 "공식 사이트에서 최신 공고를 확인"하도록 안전하게 표현하세요.
8. 출력은 JSON 객체 하나만 반환하세요. 마크다운 코드블록, 설명 문장 금지.

[JSON 형식]
{
  "title": "새 제목",
  "metaDescription": "150자 이내 설명",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5", "태그6", "태그7", "태그8"],
  "h2Sections": [
    {
      "title": "H2 제목",
      "h3Sections": [
        { "title": "H3 제목", "content": "본문" },
        { "title": "H3 제목", "content": "본문" }
      ]
    }
  ]
}`;

  onLog?.(`[PROGRESS] 20% - ⚡ URL 전용 빠른 생성: AI 통합 호출 1회로 제목/본문/태그 생성 중...`);
  const text = await callGeminiWithRetry(prompt);
  const parsed = parseJsonObjectLoose(text);
  return normalizeGeneratedArticle(parsed, crawledData, keyword);
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

  try {
    const fastArticle = await generateCompleteArticleFast(crawledData, effectiveKeyword, onLog);
    log(`[PROGRESS] 85% - ✅ URL 빠른 본문 생성 완료: H2 ${fastArticle.h2Sections.length}개, 태그 ${fastArticle.tags.length}개`);
    return fastArticle;
  } catch (fastErr: any) {
    log(`⚠️ URL 빠른 생성 실패 → 안정 폴백으로 전환: ${fastErr.message?.slice(0, 100) || fastErr}`);
  }

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

  try {
    const fastArticle = await generateCompleteArticleFast(mergedData, effectiveKeyword, onLog);
    log(`[PROGRESS] 85% - ✅ 다중 URL 빠른 본문 생성 완료: H2 ${fastArticle.h2Sections.length}개, 태그 ${fastArticle.tags.length}개`);
    return fastArticle;
  } catch (fastErr: any) {
    log(`⚠️ 다중 URL 빠른 생성 실패 → 안정 폴백으로 전환: ${fastErr.message?.slice(0, 100) || fastErr}`);
  }

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
    browser = await puppeteer.launch(withPuppeteerBrowserFallback({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }));

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        request.abort().catch(() => {});
        return;
      }
      request.continue().catch(() => {});
    });

    // 브라우저 폴백은 macOS 패키지에서 특히 무거우므로 짧게 제한한다.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: URL_GEN_PUPPETEER_TIMEOUT_MS });

    // 동적 렌더링이 필요한 사이트를 위해 최소 대기만 둔다.
    await new Promise(resolve => setTimeout(resolve, 700));

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
