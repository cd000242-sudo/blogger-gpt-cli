// src/core/url-image-crawler/urlImageCrawler.ts
// 단일 URL → Puppeteer로 이미지 전부 추출 + Downloads 폴더 자동 저장
// 원본: cd000242-sudo/naver — src/crawler/googleImageSearch.ts:crawlImagesFromUrl (v2.7.70)
//
// 동작:
//   1) puppeteer-extra-stealth로 offscreen 크롬
//   2) networkidle2 + 자동 스크롤 → lazy-load 강제
//   3) 메인 frame + iframe 전체 순회
//   4) BANNED 패턴 차단 + PRIORITY_HOSTS 우선
//   5) 150px 미만 자동 제외
//   6) 최대 30개 반환

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';

// puppeteer-extra + stealth
let puppeteerExtra: any = null;
let stealthPlugin: any = null;
try {
  puppeteerExtra = require('puppeteer-extra');
  stealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteerExtra.use(stealthPlugin());
} catch (e) {
  console.warn('[urlImageCrawler] puppeteer-extra 로드 실패 — 일반 puppeteer 폴백');
}

async function launchBrowser(visible: boolean = false): Promise<any> {
  const launcher = puppeteerExtra || require('puppeteer');
  // visible=true: 사용자가 수집 과정을 직접 관찰. 헤드리스 해제 + 정상 위치.
  // visible=false (기본): 발행 흐름에서 호출. 헤드리스 + 오프스크린.
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
  ];
  if (!visible) args.push('--window-position=-2400,-2400');
  return await launcher.launch({
    headless: visible ? false : 'new',
    args,
    defaultViewport: visible ? { width: 1280, height: 900 } : null,
  });
}

async function createOptimizedPage(browser: any): Promise<any> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  return page;
}

export interface CrawlImageResult {
  url: string;
  images: string[];      // 최종 후보 (최대 30)
  framesScanned: number; // iframe 포함 frame 수
}

export interface CrawlOptions {
  /** true면 보이는 브라우저로 실행 (사용자 검수용 단독 버튼). 기본 false (헤드리스 오프스크린) */
  visible?: boolean;
}

/**
 * URL에서 본문 이미지 추출 (Puppeteer + iframe 순회).
 */
export async function crawlImagesFromUrl(url: string, options: CrawlOptions = {}): Promise<CrawlImageResult> {
  const visible = !!options.visible;
  let browser: any;
  try {
    console.log(`[urlImageCrawler] 🌐 페이지 로드 (${visible ? '보이는 창' : '헤드리스'}): ${url.slice(0, 80)}`);
    browser = await launchBrowser(visible);
    const page = await createOptimizedPage(browser);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    });
    await new Promise(r => setTimeout(r, 1500));

    // 자동 스크롤 — lazy-load 강제 발화
    await page.evaluate(async () => {
      await new Promise<void>(resolve => {
        let total = 0;
        const step = 600;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          total += step;
          if (total >= document.body.scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
        setTimeout(() => { clearInterval(timer); resolve(); }, 8000);
      });
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 600));
    }).catch(() => {});

    // ▼ frame 단위 추출기 (iframe 내부 포함)
    const extractFromFrame = async (frame: any): Promise<string[]> => {
      return await frame.evaluate(() => {
        const urls: { src: string; w: number; priority: number }[] = [];
        const seen = new Set<string>();
        const baseHref = document.location.href;

        // 사이트-공통 UI / 광고 / 이전글카드 / 로고 차단 패턴 (v3.5.71 강화)
        const BANNED = /spacer|pixel|blank|1x1|spc\.gif|ico_n\.gif|ico_|gnb|navbar|footer|widget|profile|avatar|emoticon|sticker|bg_|btn_|\.svg$|logo|prev[_-]|next[_-]|related|recommend|recom[_-]|advert|adsense|adsbygoogle|googlesyndication|googleads|pagead|doubleclick|criteo|[_/.-]ad[_/.-]|sponsor|partner_|cardlist|card[_-]list|postlist|post[_-]list/i;
        // 본문 우선 패턴 — 네이버 블로그 + 일반 CDN
        const PRIORITY_HOSTS = /postfiles\.pstatic\.net|mblogthumb-phinf\.pstatic\.net|blogfiles\.pstatic\.net|dthumb-phinf\.pstatic\.net|pup-post-phinf\.pstatic\.net|tistory|naver\.net\/MjAy/i;

        // 광고/이전글/관련글 컨테이너 셀렉터 (이 안의 <img>는 모두 제외)
        const EXCLUDE_CONTAINER = 'aside, footer, nav, header, [role="navigation"], [role="banner"], [role="contentinfo"], [class*="advert"], [class*="ad-banner"], [class*="adsbygoogle"], [class*="related"], [class*="recommend"], [class*="recom"], [class*="prev"], [class*="next"], [class*="post-list"], [class*="postlist"], [class*="card-list"], [class*="cardlist"], [class*="profile"], [class*="footer"], [class*="header"], [class*="logo"], [id*="ad-"], [id*="ads-"], [id*="advert"], [id*="related"], [id*="prev"], [id*="next"], [id*="footer"], [id*="header"], [id*="logo"]';

        const isExcludedContainer = (el: Element): boolean => {
          try { return !!el.closest(EXCLUDE_CONTAINER); } catch { return false; }
        };

        // URL 정규화 — 동일 이미지의 사이즈 변종 제거
        // 네이버: ?type=w580 / ?type=w800 / ?type=w300 → 같은 base
        // 일반: image_300x200.jpg / image_w300.jpg → image.jpg
        const normalize = (src: string): string => {
          let n = (src.split('#')[0] || '').split('?')[0] || '';
          n = n.replace(/_(\d{2,4}x\d{2,4}|\d{2,4}w|w\d{2,4}|s\d{2,4}|m\d{2,4}|l\d{2,4})(?=\.[a-z]{2,5}$)/i, '');
          // 네이버 dthumb 사이즈 prefix: /img/?src=...&w=580 형태 — query 제거로 처리됨
          // 네이버 PostView resize prefix: ${host}/MjAyN.../resize/w580/... → /resize/wXXX/ 부분 제거
          n = n.replace(/\/(?:resize|crop)\/(?:w|h)\d{2,4}(?:_h\d{2,4})?\//i, '/');
          return n.toLowerCase();
        };

        const tryAdd = (raw: string | null | undefined, w: number) => {
          if (!raw) return;
          let src = String(raw).trim();
          if (!src || src.startsWith('data:')) return;
          try { src = new URL(src, baseHref).toString(); } catch { return; }
          if (BANNED.test(src)) return;
          const key = normalize(src);
          if (seen.has(key)) return;
          seen.add(key);
          const priority = PRIORITY_HOSTS.test(src) ? 0 : (w >= 400 ? 1 : 2);
          urls.push({ src, w, priority });
        };

        // OG/Twitter 메타 (페이지 대표 이미지)
        const og = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
        const ogSecure = document.querySelector('meta[property="og:image:secure_url"]') as HTMLMetaElement | null;
        const twitter = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null;
        tryAdd(og?.content, 999);
        tryAdd(ogSecure?.content, 999);
        tryAdd(twitter?.content, 999);

        // <img> — 150px 이하 제외 + 광고/이전글 컨테이너 안 이미지 제외
        document.querySelectorAll('img').forEach(el => {
          if (isExcludedContainer(el)) return;
          const img = el as HTMLImageElement;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if ((w > 0 && w < 150) && (h > 0 && h < 150)) return;
          tryAdd(
            img.currentSrc || img.src
            || img.getAttribute('data-src')
            || img.getAttribute('data-original')
            || img.getAttribute('data-lazy-src'),
            w
          );
        });

        // <picture> source srcset (광고/이전글 컨테이너 제외)
        document.querySelectorAll('picture source').forEach(el => {
          if (isExcludedContainer(el)) return;
          const srcset = el.getAttribute('srcset') || '';
          const first = srcset.split(',')[0]?.trim().split(/\s+/)[0];
          if (first) tryAdd(first, 0);
        });

        // background-image CSS (50개 이내 샘플, 광고 컨테이너 제외)
        let bgChecked = 0;
        document.querySelectorAll('div, section, figure, span').forEach(el => {
          if (bgChecked >= 50) return;
          if (isExcludedContainer(el)) return;
          bgChecked++;
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage;
          if (bg && bg !== 'none') {
            const match = bg.match(/url\(["']?(.+?)["']?\)/);
            if (match && match[1]) {
              const w = (el as HTMLElement).offsetWidth || 0;
              tryAdd(match[1], w);
            }
          }
        });

        urls.sort((a, b) => a.priority - b.priority || b.w - a.w);
        return urls.map(u => u.src);
      }).catch(() => []);
    };

    // iframe 20개 한도까지 순회 (네이버 블로그 PostView.naver 등)
    const allFrames = page.frames().slice(0, 20);
    const merged = new Set<string>();
    for (const frame of allFrames) {
      const fromFrame = await extractFromFrame(frame);
      fromFrame.forEach((u: string) => merged.add(u));
    }
    const collected = Array.from(merged).slice(0, 30);

    console.log(`[urlImageCrawler] ✅ 추출 ${collected.length}개 (frames=${allFrames.length})`);
    return { url, images: collected, framesScanned: allFrames.length };
  } catch (e: any) {
    console.warn(`[urlImageCrawler] ❌ 실패: ${e.message?.slice(0, 100)}`);
    return { url, images: [], framesScanned: 0 };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* 무시 */ }
    }
  }
}

// ─── 다운로드 ──────────────────────────────────────────
function safeFilename(s: string): string {
  return String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80) || 'untitled';
}

async function downloadOne(url: string, dest: string): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'http:' ? http : https;
      const req = lib.get(u, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          downloadOne(res.headers.location, dest).then(resolve);
          return;
        }
        if (res.statusCode !== 200) { res.resume(); resolve(false); return; }
        const cl = parseInt(res.headers['content-length'] || '0', 10);
        if (cl > 10 * 1024 * 1024) { req.destroy(); resolve(false); return; }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => { out.close(() => resolve(true)); });
        out.on('error', () => resolve(false));
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch {
      resolve(false);
    }
  });
}

export interface DownloadOptions {
  /** Downloads 베이스 경로 (Electron app.getPath('downloads')에서 받음) */
  downloadsBase: string;
  /** 프로젝트명 (폴더 prefix) */
  projectName: string;
  /** 글 제목 (서브폴더명) */
  postTitle: string;
}

export interface DownloadResult {
  saveDir: string;
  saved: string[];   // 절대 경로 목록
  failed: number;
  /** 첫 N개 파일의 base64 dataURL — UI 미리보기용 (v3.5.71) */
  thumbnails: string[];
  /** 바이트 단위 중복 차단으로 제거된 개수 (v3.5.71) */
  deduped: number;
}

const THUMBNAIL_LIMIT = 12;

function makeDataUrl(filePath: string): string | null {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * 이미지 URL 목록을 Downloads/{projectName}-images/{postTitle}/ 에 저장.
 *   v3.5.71: SHA-256 byte-level dedup + 첫 12개 썸네일 dataURL 반환
 */
export async function downloadImagesToFolder(
  urls: string[],
  options: DownloadOptions
): Promise<DownloadResult> {
  const projectFolder = `${safeFilename(options.projectName)}-images`;
  const titleFolder = safeFilename(options.postTitle);
  const saveDir = path.join(options.downloadsBase, projectFolder, titleFolder);
  fs.mkdirSync(saveDir, { recursive: true });

  const saved: string[] = [];
  const seenHashes = new Set<string>();
  let failed = 0;
  let deduped = 0;
  let savedIndex = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue;
    const ext = (url.match(/\.(jpe?g|png|gif|webp)(?:\?|$)/i)?.[1] || 'jpg').toLowerCase();
    const dest = path.join(saveDir, `image-${String(savedIndex + 1).padStart(3, '0')}.${ext}`);
    const ok = await downloadOne(url, dest);
    if (!ok) { failed++; continue; }

    // ▼ v3.5.71: 바이트 단위 중복 검사 — 같은 이미지가 다른 URL로 와도 차단
    try {
      const buf = fs.readFileSync(dest);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      if (seenHashes.has(hash)) {
        fs.unlinkSync(dest);
        deduped++;
        continue;
      }
      seenHashes.add(hash);
    } catch { /* 해시 실패 시 그냥 저장 유지 */ }

    saved.push(dest);
    savedIndex++;
  }

  // 썸네일 생성 (첫 12개)
  const thumbnails: string[] = [];
  for (const filePath of saved.slice(0, THUMBNAIL_LIMIT)) {
    const data = makeDataUrl(filePath);
    if (data) thumbnails.push(data);
  }

  console.log(`[urlImageCrawler] 💾 저장: ${saved.length}개 / 실패 ${failed}개 / 중복차단 ${deduped}개 → ${saveDir}`);
  return { saveDir, saved, failed, thumbnails, deduped };
}
