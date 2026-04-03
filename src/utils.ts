// src/utils.ts
// 유틸리티 함수들

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { URL } from 'node:url';
import { EnvConfig, LogSink } from './types';

// ---------- 네트워크 설정 ----------
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
const proxyUrl = process.env['HTTPS_PROXY'] || process.env['HTTP_PROXY'];
let gaxiosAgent: any = keepAliveAgent;
if (proxyUrl) {
  const { HttpsProxyAgent } = require('https-proxy-agent');
  gaxiosAgent = new HttpsProxyAgent({ proxy: proxyUrl, keepAlive: true } as any);
}

// ---------- 기본 유틸리티 함수들 ----------
export const TODAY_ISO = new Date().toISOString().slice(0, 10);

export function emit(onLog?: LogSink, line?: string) { 
  if (onLog && line) { 
    try { onLog(line); } catch {} 
  } 
}

export function now(): string {
  const d = new Date();
  const z = (n: number) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
}

export function getWritableDataDir(): string {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      const dir = app.getPath('userData'); 
      fs.mkdirSync(dir, { recursive: true }); 
      return dir;
    }
  } catch {}
  const base = process.env['APPDATA'] || process.env['LOCALAPPDATA'] || process.env['HOME'] || process.cwd();
  const dir = path.join(base, 'blogger-gpt-cli');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function safeWrite(filePath: string, data: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data, 'utf-8');
}

// ---------- 환경 변수 검사 ----------
export function assertRequiredEnv(env: EnvConfig, onLog?: (message: string) => void) {
  const emit = (message: string) => {
    console.log(message);
    if (onLog) onLog(message);
  };
  
  emit('[core] assertRequiredEnv 호출됨');
  emit('[core] env.provider: ' + env.provider);
  emit('[core] env.platform: ' + env.platform);
  emit('[core] env.openaiKey: ' + (env.openaiKey ? '설정됨' : '비어있음'));
  emit('[core] env.blogId: ' + (env.blogId ? '설정됨' : '비어있음'));
  emit('[core] env.googleClientId: ' + (env.googleClientId ? '설정됨' : '비어있음'));
  emit('[core] env.googleClientSecret: ' + (env.googleClientSecret ? '설정됨' : '비어있음'));
  
  // 미리보기 모드인지 확인
  const isPreview = (env as any).previewOnly === true || env.platform === 'preview';
  emit('[core] 미리보기 모드: ' + isPreview);
  
  const missing: string[] = [];
  const req = (name: string, v?: string) => { 
    emit('[core] ' + name + ' 검사: ' + (v ? '설정됨' : '비어있음'));
    if (!v || !String(v).trim()) missing.push(name); 
  };

  if (!env.provider) {
    emit('[core] AI_PROVIDER 누락');
    missing.push('AI_PROVIDER');
  }
  if (env.provider === 'openai') req('OPENAI_API_KEY', env.openaiKey);
  if (env.provider === 'gemini') req('GEMINI_API_KEY', env.geminiKey);

  // 미리보기 모드가 아닐 때만 플랫폼별 설정 검증
  if (!isPreview) {
    const platform = env.platform || 'wordpress';
    emit('[core] 플랫폼: ' + platform);
    
    if (platform === 'blogger') {
      req('GOOGLE_BLOG_ID', env.blogId);
      req('GOOGLE_CLIENT_ID', env.googleClientId);
      req('GOOGLE_CLIENT_SECRET', env.googleClientSecret);
      if (!env.redirectUri) env.redirectUri = 'http://localhost:8080/';
    } else if (platform === 'wordpress') {
      req('WORDPRESS_SITE_URL', env.wordpressSiteUrl);
      
      const authType = env.wordpressAuthType || 'appPassword';
      if (authType === 'appPassword') {
        req('WORDPRESS_USERNAME', env.wordpressUsername);
        req('WORDPRESS_PASSWORD', env.wordpressPassword);
      } else if (authType === 'oauth') {
        req('WORDPRESS_CLIENT_ID', env.wordpressClientId);
        req('WORDPRESS_CLIENT_SECRET', env.wordpressClientSecret);
      } else if (authType === 'jwt') {
        req('WORDPRESS_JWT_TOKEN', env.wordpressJWTToken);
      }
    }
  } else {
    emit('[core] 미리보기 모드 - 플랫폼 설정 검증 건너뜀');
  }

  emit('[core] 누락된 항목들: [' + missing.join(', ') + ']');

  if (missing.length) {
    const msg = '[설정 필요] 다음 항목이 비어 있어요: ' + missing.join(', ') + '\n\n1) UI에서 ENV 저장을 먼저 해 주세요.\n2) 예) OPENAI_API_KEY=sk-xxxx';
    throw new Error(msg);
  }
  
  emit('[core] 환경 변수 검증 통과');
}

// ---------- HTML 처리 함수들 ----------
export function cleanAllHtmlEntities(content: string): string {
  if (!content || typeof content !== 'string') return '';
  
  let cleaned = content;
  
  try {
    // 1. 일반적인 숫자형 HTML 엔티티만 제거 (&#숫자; 형태)
    cleaned = cleaned.replace(/&#(?:(?:1[0-5]\d|[1-9]?\d)|(?:8[0-2]\d{2}|7[0-9]\d{2}|6[0-9]\d{2}|[1-5]\d{3}|[1-9]\d{2}));/g, '');
    
    // 2. 특정 명명된 HTML 엔티티만 제거 (안전한 것들만)
    const safeEntities = /&(?:nbsp|amp|lt|gt|quot|apos|#39);/g;
    cleaned = cleaned.replace(safeEntities, ' ');
    
    // 3. 16진수 HTML 엔티티 제거 (&#x숫자; 형태)
    cleaned = cleaned.replace(/&#x[0-9a-fA-F]{1,4};/g, '');
    
    // 4. 특정 특수 문자만 제거 (전체가 아닌 일부만)
    cleaned = cleaned.replace(/[▶►▸]/g, '');
    
    // 5. 연속된 공백 정리
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  } catch (e) {
    console.warn('HTML 엔티티 정리 중 오류:', e);
    return content; // 오류 시 원본 반환
  }
}

export function stripHtml(html: string) {
  if (!html || typeof html !== 'string') return '';
  
  try {
    let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                      .replace(/<style[\s\S]*?<\/style>/gi, '')
                      .replace(/<[^>]+>/g, '')
                      .replace(/\s+/g, ' ')
                      .trim();
    
    // 안전한 HTML 엔티티 정리
    return cleanAllHtmlEntities(cleaned);
  } catch (e) {
    console.warn('HTML 제거 중 오류:', e);
    return html;
  }
}

export function charCountFromHtml(html: string) { 
  return stripHtml(html).length; 
}

export function escapeHtml(s: string) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string)
  );
}

export function stripCodeFences(s: string) {
  if (!s) return s;
  let out = s;
  try {
    // 🔥 최종 강력한 마크다운 마커 완전 제거
    out = out.replace(/```[\w]*[\s\S]*?```/g, ''); // 모든 ```언어 블록 제거
    out = out.replace(/```[\w]*/g, ''); // 모든 ```언어 마커 제거
    out = out.replace(/```/g, ''); // 모든 ``` 마커 제거
    out = out.replace(/`/g, ''); // 모든 백틱 제거
    
    // 마크다운 문법 완전 제거
    out = out.replace(/\*\*([^*]+)\*\*/g, '$1'); // **굵게** 제거
    out = out.replace(/\*([^*]+)\*/g, '$1'); // *기울임* 제거
    out = out.replace(/~~([^~]+)~~/g, '$1'); // ~~취소선~~ 제거
    out = out.replace(/##\s*/g, ''); // ## 제목 제거
    out = out.replace(/#\s*/g, ''); // # 제목 제거
    
    // HTML 코드 블록 제거
    out = out.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, '$1');
    out = out.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '$1');
    
    // 수정: 안전한 HTML 엔티티 제거
    out = cleanAllHtmlEntities(out);
    
    return out.trim();
  } catch (e) {
    console.warn('코드 펜스 처리 중 오류:', e);
    return s;
  }
}

export function textLenOfSection(sec: { title: string; content: string }) { 
  return stripHtml(sec.content).length; 
}

// ---------- 네트워크 함수들 ----------
export async function getJson<T = any>(rawUrl: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const u = new URL(rawUrl);
    const req = https.get(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: { 'User-Agent': 'blogger-gpt-premium/2.1' },
        agent: gaxiosAgent,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 3, baseDelay = 800): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      const transient = /ECONNRESET|socket hang up|ETIMEDOUT|ESOCKETTIMEDOUT|EAI_AGAIN|ENETUNREACH|429|rate.*limit|backendError|502|503|504/i.test(msg);
      if (!transient || i === tries - 1) throw e;
      const jitter = Math.floor(Math.random() * 250);
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i) + jitter));
    }
  }
  throw lastErr;
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------- 해시태그 생성 ----------
export function generateHashtags(topic: string, keywords: string[]): string {
  try {
    const baseWords = [
      ...topic.split(/\s+/).filter(w => w.length > 1),
      ...keywords.filter(w => w.length > 1)
    ];
    
    // 렌터카 관련 특화 해시태그
    const carRentalTags = ['렌터카', '완전자차', '제주여행', '렌트카', '자차보험', '여행준비', '제주도', '자동차보험', '여행꿀팁', '휴가계획'];
    
    // 여행 관련 특화 해시태그
    const travelTags = ['여행', '제주여행', '국내여행', '해외여행', '여행계획', '여행준비', '여행꿀팁', '여행정보', '여행리뷰', '여행후기'];
    
    // 건강 관련 특화 해시태그
    const healthTags = ['건강', '건강관리', '건강정보', '건강팁', '건강식품', '건강식단', '건강운동', '건강검진', '건강상식', '건강관리법'];
    
    // 투자 관련 특화 해시태그
    const investmentTags = ['투자', '주식', '부동산', '재테크', '투자정보', '투자팁', '투자전략', '투자분석', '투자노하우', '투자가이드'];
    
    // IT/프로그래밍 관련 특화 해시태그
    const itTags = ['프로그래밍', '코딩', '개발', 'IT', '프로그래머', '개발자', '소프트웨어', '웹개발', '앱개발', '프로그래밍언어'];
    
    // 요리 관련 특화 해시태그
    const cookingTags = ['요리', '레시피', '요리법', '요리팁', '요리정보', '요리후기', '요리노하우', '요리가이드', '요리기법', '요리재료'];
    
    // 교육 관련 특화 해시태그
    const educationTags = ['교육', '학습', '공부', '교육정보', '학습방법', '교육팁', '교육가이드', '교육노하우', '교육상식', '교육정보'];
    
    // 주제별 해시태그 선택
    let topicSpecificTags: string[] = [];
    const lowerTopic = topic.toLowerCase();
    
    if (lowerTopic.includes('렌터카') || lowerTopic.includes('렌트카') || lowerTopic.includes('자차')) {
      topicSpecificTags = carRentalTags;
    } else if (lowerTopic.includes('여행')) {
      topicSpecificTags = travelTags;
    } else if (lowerTopic.includes('건강') || lowerTopic.includes('의학') || lowerTopic.includes('병원')) {
      topicSpecificTags = healthTags;
    } else if (lowerTopic.includes('투자') || lowerTopic.includes('주식') || lowerTopic.includes('금융')) {
      topicSpecificTags = investmentTags;
    } else if (lowerTopic.includes('프로그래밍') || lowerTopic.includes('코딩') || lowerTopic.includes('it') || lowerTopic.includes('컴퓨터')) {
      topicSpecificTags = itTags;
    } else if (lowerTopic.includes('요리') || lowerTopic.includes('레시피')) {
      topicSpecificTags = cookingTags;
    } else if (lowerTopic.includes('교육') || lowerTopic.includes('학습') || lowerTopic.includes('공부')) {
      topicSpecificTags = educationTags;
    } else {
      // 일반적인 해시태그
      topicSpecificTags = ['정보', '가이드', '팁', '노하우', '리뷰', '후기', '분석', '전략', '방법', '기법'];
    }
    
    // 기본 키워드와 주제별 해시태그 결합
    const allTags = [...baseWords, ...topicSpecificTags];
    
    // 중복 제거 및 정렬
    const uniqueTags = [...new Set(allTags)]
      .filter(tag => tag.length > 1 && tag.length < 20)
      .slice(0, 15);
    
    return uniqueTags.join(' ');
  } catch (e) {
    console.warn('해시태그 생성 중 오류:', e);
    return topic + ' ' + keywords.join(' ');
  }
}

// ---------- 제목 생성 ----------
export function generateCleanTitle(topic: string): string {
  if (!topic || typeof topic !== 'string') return '제목 없음';
  
  try {
    let title = topic.trim();
    
    // 불필요한 단어 제거
    const removeWords = ['에 대해서', '에 대해', '에 관한', '에 대한', '에 관하여', '에 관해', '에 대하여', '에 대해'];
    for (const word of removeWords) {
      title = title.replace(new RegExp(word, 'gi'), '');
    }
    
    // 연속된 공백 제거
    title = title.replace(/\s+/g, ' ').trim();
    
    // 길이 제한 (50자 이하)
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    return title;
  } catch (e) {
    console.warn('제목 생성 중 오류:', e);
    return topic;
  }
}









