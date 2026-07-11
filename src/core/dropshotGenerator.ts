/**
 * 🍌 Dropshot 이미지 생성 엔진 (UI 자동화 방식)
 *
 * dropshot.io의 nano-banana-pro 모델을 Playwright UI 조작으로 자동 사용.
 * - API 직접 호출은 Cognito refresh token 외부 흐름 우회 불가능 → UI 조작으로 우회
 * - 같은 profile 영구 세션 (~/.blogger-gpt/dropshot-profile/)
 * - 결과는 DOM의 `<img src="data:image/png;base64,...">`에서 직접 scrape
 *
 * ⚠️ 비용:
 * - Pro 구독자: 무제한 (isUnlimited)
 * - 무료 사용자: creditCost 75/이미지 — 무료 quota 소진 시 자동 실패
 *
 * 패턴 출처: docs/IMAGE_SITE_AUTOMATION_PORTING.md
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { launchPersistentContextWithAutoInstall } from '../utils/playwright-browser-installer';

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_NAME = 'dropshot-profile';
const PROMPT_SELECTORS = [
  'textarea[placeholder="어떤 장면을 만들고 싶나요?"]',
  'textarea[placeholder*="어떤"]',
  'textarea[placeholder*="장면"]',
  'textarea[placeholder*="만들"]',
  'textarea[placeholder*="prompt"]',
  'textarea[placeholder*="describe"]',
  'textarea:not([disabled])',
  '[role="textbox"][contenteditable="true"]',
  '[role="textbox"]',
  '[data-slate-editor="true"]',
  '.ProseMirror',
  '[contenteditable="true"]',
];

let cachedContext: any = null;
let cachedPage: any = null;
let _ensurePagePromise: Promise<any> | null = null;

type DropshotLoginStatus = {
  loggedIn: boolean;
  userId?: string;
  userName?: string;
  email?: string;
  subscription?: 'pro' | 'free' | 'unknown';
  subscriptionKnown?: boolean;
  subscriptionLabel?: string;
  message?: string;
  cached?: boolean;
};

type DropshotClickResult = {
  clicked: boolean;
  detail: string;
  diagnostics?: string;
};

type DropshotImageCandidate = {
  src: string;
  width: number;
  height: number;
  area: number;
  kind: string;
};

let _loginCheckCache: { ts: number; result: DropshotLoginStatus } | null = null;
const LOGIN_CHECK_OK_TTL_MS = 10 * 60 * 1000;
const LOGIN_CHECK_FAIL_TTL_MS = 30 * 1000;
const DROPSHOT_RESULT_WAIT_MS = 210_000;
const DROPSHOT_RESULT_POLL_MS = 2_500;

function normalizeDropshotSubscription(value: unknown): 'pro' | 'free' | 'unknown' {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'pro' || raw.includes('pro') || raw.includes('paid') || raw.includes('premium')) return 'pro';
  if (raw === 'free' || raw === 'basic' || raw.includes('free')) return 'free';
  return 'unknown';
}

function getDropshotSubscriptionLabel(subscription: unknown): string {
  const normalized = normalizeDropshotSubscription(subscription);
  if (normalized === 'pro') return 'Pro 구독자 무제한';
  if (normalized === 'free') return '무료 사용자';
  return '구독 정보 미확인';
}

function withDropshotSubscriptionMeta<T extends DropshotLoginStatus>(status: T): T {
  if (!status?.loggedIn) return status;
  const subscription = normalizeDropshotSubscription(status.subscription);
  return {
    ...status,
    subscription,
    subscriptionKnown: subscription !== 'unknown',
    subscriptionLabel: status.subscriptionLabel || getDropshotSubscriptionLabel(subscription),
  };
}

async function closeDropshotContext(context: any, delayMs = 350): Promise<void> {
  if (!context) return;
  try {
    const pages = typeof context.pages === 'function' ? context.pages() : [];
    await Promise.allSettled(
      pages.map((page: any) => page?.close?.({ runBeforeUnload: false }).catch?.(() => undefined) || Promise.resolve()),
    );
  } catch { /* ignore */ }
  try { await context.close(); } catch { /* ignore */ }
  if (delayMs > 0) await wait(delayMs);
}

// v3.7.3: generation mutex — dropshot은 단일 브라우저 페이지 공유하므로
//   동시 호출 시 textarea가 덮어써져 마지막 prompt만 처리됨 (모든 결과가 마지막 prompt로 도배).
//   해결: 한 번에 한 호출만 진행. 큐 기반 직렬화.
let _generationChain: Promise<any> = Promise.resolve();

function getProfileDir(): string {
  const dir = path.join(os.homedir(), '.blogger-gpt', PROFILE_NAME);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function launchBrowser(profileDir: string, headless: boolean, onLog?: (msg: string) => void): Promise<any> {
  let chromium: any;
  try {
    chromium = (await import('patchright' as any)).chromium;
  } catch {
    chromium = (await import('playwright')).chromium;
  }

  const forceVisible = String(process.env['VISIBLE_BROWSER'] || '').toLowerCase() === 'true';
  // 로그인 유도처럼 caller가 명시적으로 headless=false를 요청할 때만 visible.
  // 이미 로그인된 뒤의 자동 생성/세션 확인은 VISIBLE_BROWSER가 켜져 있어도 숨김으로 유지한다.
  const effectiveHeadless = headless ? true : (forceVisible ? false : headless);

  const baseOptions: any = {
    headless: effectiveHeadless,
    args: [
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--lang=ko-KR,ko',
      '--window-size=1280,900',
    ],
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; }
      catch { return 'Asia/Seoul'; }
    })(),
    ignoreDefaultArgs: ['--enable-automation'],
  };

  const stealthInit = () => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
      configurable: true,
    });
  };

  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const opts = channel ? { ...baseOptions, channel } : baseOptions;
      const ctx = await launchPersistentContextWithAutoInstall(chromium, profileDir, opts, onLog);
      try { await ctx.addInitScript(stealthInit); } catch { /* ignore */ }
      return ctx;
    } catch { /* 다음 채널 */ }
  }
  throw new Error('Chrome/Edge/Chromium 실행 실패');
}

/** 사이트가 로그인 상태인지 — board 페이지 로드 후 "플랜 업그레이드" 또는 "이미지 생성" 메뉴 보이면 OK */
/**
 * v3.7.1: dropshot UI 컨트롤 자동 설정
 *   - 무제한 모드 토글 ON (Pro 구독자 무제한 권한 활성화)
 *   - 카운터(생성 장수)를 1로 (기본 2개씩 생성 → 1개로 변경 — 우리는 1프롬프트=1이미지)
 *   호출 시점: makeDropshotImage 진입 시 매번 (idempotent — 이미 정상이면 no-op)
 */
async function ensureDropshotControls(page: any, onLog?: (m: string) => void): Promise<void> {
  try {
    // 1. 무제한 모드 토글 ON
    const switchHandles = await page.$$('input[role="switch"]');
    for (const sw of switchHandles) {
      const isOn = await sw.evaluate((el: any) => el.checked === true || el.getAttribute('aria-checked') === 'true');
      if (!isOn) {
        // sr-only input은 직접 클릭 안 되므로 부모 label/button 클릭
        const parent = await sw.evaluateHandle((el: any) => el.closest('label') || el.closest('button') || el.parentElement);
        if (parent) {
          try { await parent.click({ timeout: 2000 }); } catch {}
          await new Promise(r => setTimeout(r, 300));
          onLog?.('🎛️ [Dropshot] 무제한 모드 자동 ON');
        }
      }
    }

    // 2. 카운터(생성 장수) 1로 설정 — 우리는 1프롬프트=1이미지 정책
    await page.evaluate(() => {
      // input[type="number"] 직접 변경 + React 이벤트 dispatch
      const numberInputs = Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
      for (const inp of numberInputs) {
        const v = Number(inp.value);
        // 의도된 카운터만 (1~10 범위)
        if (v >= 2 && v <= 10) {
          // React-controlled input은 native setter 호출 필요
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(inp, '1');
          else inp.value = '1';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      // 폴백: number input 없으면 - 버튼 반복 클릭
      if (numberInputs.length === 0) {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const minusBtns = allBtns.filter(b => {
          const t = (b.textContent || '').trim();
          if (t === '-' || t === '−') return true;
          if (b.querySelector('img[src*="ic_minus"]')) return true;
          return false;
        });
        for (const minus of minusBtns) {
          // 같은 카운터 그룹의 숫자 찾기
          const grp = minus.parentElement;
          const numTxt = grp?.querySelector('span:not(:has(img))')?.textContent || '';
          let cur = parseInt(numTxt, 10) || 0;
          let safety = 10;
          while (cur > 1 && safety-- > 0) {
            (minus as HTMLButtonElement).click();
            // 다시 읽기
            cur = parseInt(grp?.querySelector('span:not(:has(img))')?.textContent || '0', 10);
          }
        }
      }
    });
  } catch (e: any) {
    onLog?.(`⚠️ [Dropshot] 컨트롤 자동 조정 실패 (무시): ${(e.message || '').slice(0, 80)}`);
  }
}

async function isLoggedIn(page: any): Promise<boolean> {
  try {
    const has = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return text.includes('이미지 생성') || text.includes('플랜 업그레이드') || text.includes('워크스페이스');
    });
    return !!has;
  } catch { return false; }
}

async function wait(ms: number): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

async function resetDropshotBoard(page: any, onLog?: (m: string) => void): Promise<void> {
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(3000);
  if (!(await isLoggedIn(page))) {
    throw new Error('Dropshot 로그인 세션 만료 또는 board 진입 실패');
  }
  onLog?.('🔄 [Dropshot] 새 board 화면으로 초기화');
}

async function fillDropshotPrompt(page: any, prompt: string): Promise<void> {
  for (const selector of PROMPT_SELECTORS) {
    try {
      const handles = await page.$$(selector);
      for (const el of handles) {
        const usable = await el.evaluate((node: any) => {
          const rect = node.getBoundingClientRect?.();
          const style = window.getComputedStyle?.(node);
          const tag = String(node.tagName || '').toLowerCase();
          const role = String(node.getAttribute?.('role') || '').toLowerCase();
          const className = String(node.className || '');
          const disabled = node.disabled === true || node.getAttribute?.('aria-disabled') === 'true';
          const visible = !!rect && rect.width > 20 && rect.height > 10
            && style?.display !== 'none'
            && style?.visibility !== 'hidden'
            && Number(style?.opacity || '1') > 0;
          const editable = tag === 'textarea'
            || tag === 'input'
            || node.isContentEditable
            || role === 'textbox'
            || node.getAttribute?.('data-slate-editor') === 'true'
            || /ProseMirror/i.test(className);
          const type = String(node.getAttribute?.('type') || '').toLowerCase();
          const excluded = ['hidden', 'password', 'email', 'search', 'url'].includes(type);
          return visible && editable && !disabled && !excluded;
        }).catch(() => false);
        if (!usable) continue;

        await el.click({ timeout: 3000 }).catch(() => {});
        const filled = await el.evaluate((node: any, value: string) => {
          const tag = String(node.tagName || '').toLowerCase();
          if (tag === 'textarea' || tag === 'input') {
            const proto = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(node, value);
            else node.value = value;
            node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        }, prompt).catch(() => false);

        if (!filled) {
          await page.keyboard.press('Control+A').catch(() => {});
          await page.keyboard.press('Backspace').catch(() => {});
          await page.keyboard.insertText(prompt).catch(async () => {
            await page.keyboard.type(prompt, { delay: 2 });
          });
        }

        const hasValue = await el.evaluate((node: any, expected: string) => {
          const current = String(node.value || node.textContent || node.innerText || '');
          return current.includes(expected.slice(0, 24)) || current.length >= Math.min(24, expected.length);
        }, prompt).catch(() => false);
        if (hasValue) return;
      }
    } catch { /* try next selector */ }
  }

  const diagnostics = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('textarea,input,[contenteditable="true"],[role="textbox"],[data-slate-editor="true"],.ProseMirror'))
      .slice(0, 12)
      .map((node: any) => {
        const rect = node.getBoundingClientRect?.();
        const tag = String(node.tagName || '').toLowerCase();
        const attrs = [
          node.getAttribute?.('placeholder'),
          node.getAttribute?.('aria-label'),
          node.getAttribute?.('data-placeholder'),
          node.getAttribute?.('role'),
        ].filter(Boolean).join('/');
        return `${tag}[${Math.round(rect?.width || 0)}x${Math.round(rect?.height || 0)}] ${attrs}`.trim();
      });
    return `url=${location.href}; candidates=${candidates.join(' | ') || 'none'}`;
  }).catch((e: any) => `diagnostics failed: ${e?.message || e}`);

  throw new Error(`Dropshot 프롬프트 입력창을 찾지 못했습니다 (${diagnostics})`);
}

async function clickDropshotGenerate(page: any): Promise<DropshotClickResult> {
  const result = await page.evaluate(() => {
    const isVisible = (node: Element | null): boolean => {
      if (!node) return false;
      const rect = (node as HTMLElement).getBoundingClientRect?.();
      const style = window.getComputedStyle?.(node);
      return !!rect
        && rect.width > 4
        && rect.height > 4
        && style?.display !== 'none'
        && style?.visibility !== 'hidden'
        && Number(style?.opacity || '1') > 0;
    };

    const buttonText = (button: HTMLButtonElement): string => [
      button.textContent,
      button.getAttribute('aria-label'),
      button.title,
      button.getAttribute('data-testid'),
      button.getAttribute('type'),
      button.className,
    ].filter(Boolean).join(' ').trim();

    const isBadButton = (button: HTMLButtonElement): boolean => {
      const meta = buttonText(button);
      return /업로드|upload|reference|참조|삭제|remove|trash|취소|cancel|닫기|close|로그인|login|요금|구독|플랜|plan|upgrade|무제한|unlimited|minus|plus|증가|감소|새\s*창/i.test(meta);
    };

    const scoreButton = (button: HTMLButtonElement, promptRect?: DOMRect | null): number => {
      if (!isVisible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') return -999;
      if (isBadButton(button)) return -100;
      const meta = buttonText(button);
      let score = 0;
      if (/이미지\s*생성|생성하기|생성|만들기|만들|전송|보내기|generate|create|submit|send/i.test(meta)) score += 120;
      if (button.type === 'submit') score += 60;
      if (button.querySelector('svg,img')) score += 20;
      const rect = button.getBoundingClientRect();
      if (promptRect) {
        const closeToPrompt = rect.left >= promptRect.left - 40
          && rect.right <= promptRect.right + 120
          && rect.top >= promptRect.top - 80
          && rect.bottom <= promptRect.bottom + 140;
        if (closeToPrompt) score += 35;
        if (rect.left > promptRect.left + promptRect.width * 0.55) score += 15;
      }
      if (/absolute|right-|bottom-|rounded-full/i.test(meta)) score += 8;
      return score;
    };

    const findPrompt = (): Element | null => {
      const exact = document.querySelector('textarea[placeholder="어떤 장면을 만들고 싶나요?"]');
      if (exact) return exact;
      const candidates = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"],[data-slate-editor="true"],.ProseMirror'));
      return candidates.find((node: any) => {
        const rect = node.getBoundingClientRect?.();
        const style = window.getComputedStyle?.(node);
        const meta = [
          node.getAttribute?.('placeholder'),
          node.getAttribute?.('aria-label'),
          node.getAttribute?.('data-placeholder'),
          node.getAttribute?.('role'),
          node.value,
          node.textContent,
        ].filter(Boolean).join(' ');
        return rect && rect.width > 20 && rect.height > 10
          && style?.display !== 'none'
          && style?.visibility !== 'hidden'
          && /장면|만들|prompt|describe|image|textbox/i.test(meta);
      }) || null;
    };

    const promptEl = findPrompt();
    const promptRect = promptEl ? (promptEl as HTMLElement).getBoundingClientRect?.() : null;
    if (promptEl) {
      let parent: Element | null = promptEl.parentElement;
      for (let depth = 0; depth < 7 && parent; depth++) {
        const scored = Array.from(parent.querySelectorAll('button'))
          .map((button: any) => ({ button: button as HTMLButtonElement, score: scoreButton(button as HTMLButtonElement, promptRect) }))
          .sort((a, b) => b.score - a.score);
        const best = scored[0];
        if (best && best.score >= 40) {
          best.button.click();
          return { clicked: true, detail: `button score=${best.score} text="${buttonText(best.button).slice(0, 80)}"` };
        }
        parent = parent.parentElement;
      }

      const form = promptEl.closest('form') as HTMLFormElement | null;
      if (form) {
        try {
          form.requestSubmit();
          return { clicked: true, detail: 'form.requestSubmit()' };
        } catch { /* fallback below */ }
      }
    }

    const allButtons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    const fallback = allButtons
      .map(button => ({ button, score: scoreButton(button, promptRect) }))
      .sort((a, b) => b.score - a.score)[0];
    if (fallback && fallback.score >= 90) {
      fallback.button.click();
      return { clicked: true, detail: `fallback score=${fallback.score} text="${buttonText(fallback.button).slice(0, 80)}"` };
    }

    const diagnostics = allButtons.slice(0, 16).map((button, idx) => {
      const rect = button.getBoundingClientRect();
      return `${idx + 1}:${button.disabled ? 'disabled' : 'enabled'}:${Math.round(rect.width)}x${Math.round(rect.height)}:${buttonText(button).slice(0, 60)}`;
    }).join(' | ');
    return {
      clicked: false,
      detail: '생성 버튼 후보를 찾지 못함',
      diagnostics,
    };
  });
  if (!result.clicked) {
    await page.keyboard.press('Enter').catch(() => {});
    return {
      ...result,
      detail: `${result.detail}; Enter fallback 실행`,
    };
  }
  return result;
}

async function getDropshotImageSnapshot(page: any): Promise<string[]> {
  return await page.evaluate(() => {
    const out = new Set<string>();
    const add = (value: string | null | undefined) => {
      const raw = String(value || '').trim();
      if (!raw) return;
      for (const part of raw.split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (url) out.add(url);
      }
    };
    for (const img of Array.from(document.querySelectorAll('img')) as HTMLImageElement[]) {
      add(img.src);
      add(img.currentSrc);
      add(img.getAttribute('src'));
      add(img.getAttribute('srcset'));
    }
    for (const source of Array.from(document.querySelectorAll('source')) as HTMLSourceElement[]) {
      add(source.srcset);
    }
    for (const node of Array.from(document.querySelectorAll('*')) as HTMLElement[]) {
      const bg = window.getComputedStyle(node).backgroundImage || '';
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (match?.[1]) add(match[1]);
    }
    return Array.from(out).filter(src =>
      (src.startsWith('data:image/')
        || src.startsWith('blob:')
        || /^https?:\/\//i.test(src))
      && !/\/icons?\/|\/sample\/|placeholder|avatar|logo|sprite|favicon|blank/i.test(src)
    );
  });
}

function isLikelyDropshotResultUrl(src: string): boolean {
  const raw = String(src || '').trim();
  if (!raw) return false;
  if (/\/icons?\/|\/sample\/|placeholder|avatar|logo|sprite|favicon|blank/i.test(raw)) return false;
  if (raw.startsWith('data:image/')) return raw.length > 20_000;
  if (raw.startsWith('blob:')) return true;
  return /aistudio\.dropshot\.io|dropshot|cdn|cloudfront|r2\.dev|storage|supabase|googleusercontent|oaidalleapiprodscus/i.test(raw);
}

async function getDropshotGenerationDiagnostics(page: any): Promise<string> {
  return await page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 360);
    const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    const imageSummary = imgs.slice(-8).map((img, idx) => {
      const src = img.currentSrc || img.src || '';
      return `${idx + 1}:${img.naturalWidth}x${img.naturalHeight}:${src.slice(0, 70)}`;
    }).join(' | ');
    const buttonSummary = buttons.slice(-10).map((button, idx) => {
      const meta = [button.textContent, button.getAttribute('aria-label'), button.title, button.getAttribute('type')]
        .filter(Boolean).join('/').replace(/\s+/g, ' ').slice(0, 60);
      return `${idx + 1}:${button.disabled ? 'disabled' : 'enabled'}:${meta}`;
    }).join(' | ');
    return `url=${location.href}; imgs=${imgs.length}; buttons=${buttons.length}; text="${text}"; recentImgs=${imageSummary}; recentButtons=${buttonSummary}`;
  }).catch((e: any) => `diagnostics failed: ${e?.message || e}`);
}

async function urlToDataUrlInPage(page: any, url: string): Promise<string | null> {
  if (url.startsWith('data:image/')) return url;
  return await page.evaluate(async (imageUrl: string) => {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`fetch failed ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`not image ${blob.type}`);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('blob read failed'));
      reader.readAsDataURL(blob);
    });
  }, url).catch(() => null);
}

async function findDropshotResultDataUrl(page: any, beforeSrcs: string[], onLog?: (m: string) => void): Promise<string | null> {
  const candidates: DropshotImageCandidate[] = await page.evaluate((before: string[]) => {
    const beforeSet = new Set(before);
    const out: DropshotImageCandidate[] = [];
    const add = (src: string | null | undefined, width: number, height: number, kind: string) => {
      const raw = String(src || '').trim();
      if (!raw || beforeSet.has(raw)) return;
      if (/\/icons?\/|\/sample\/|placeholder|avatar|logo|sprite|favicon|blank/i.test(raw)) return;
      if (!(raw.startsWith('data:image/') || raw.startsWith('blob:') || /^https?:\/\//i.test(raw))) return;
      if (width < 256 || height < 180) return;
      out.push({ src: raw, width, height, area: width * height, kind });
    };

    for (const img of Array.from(document.querySelectorAll('img')) as HTMLImageElement[]) {
      const width = img.naturalWidth || img.width || img.getBoundingClientRect().width || 0;
      const height = img.naturalHeight || img.height || img.getBoundingClientRect().height || 0;
      add(img.currentSrc || img.src, width, height, 'img');
      add(img.getAttribute('src'), width, height, 'img-src');
      const srcset = img.getAttribute('srcset') || '';
      for (const part of srcset.split(',')) add(part.trim().split(/\s+/)[0], width, height, 'img-srcset');
    }

    for (const node of Array.from(document.querySelectorAll('*')) as HTMLElement[]) {
      const rect = node.getBoundingClientRect();
      const bg = window.getComputedStyle(node).backgroundImage || '';
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (match?.[1]) add(match[1], rect.width, rect.height, 'background');
    }

    return out
      .filter(item => {
        if (item.src.startsWith('data:image/')) return item.src.length > 20_000;
        if (item.src.startsWith('blob:')) return true;
        return /aistudio\.dropshot\.io|dropshot|cdn|cloudfront|r2\.dev|storage|supabase|googleusercontent|oaidalleapiprodscus/i.test(item.src);
      })
      .sort((a, b) => b.area - a.area);
  }, beforeSrcs).catch(() => []);

  if (!candidates.length) return null;
  const firstCandidate = candidates[0];
  if (firstCandidate) {
    onLog?.(`🔎 [Dropshot] 결과 후보 ${candidates.length}개 감지: ${firstCandidate.kind} ${firstCandidate.width}x${firstCandidate.height}`);
  }
  for (const candidate of candidates.slice(0, 4)) {
    if (!isLikelyDropshotResultUrl(candidate.src)) continue;
    const dataUrl = await urlToDataUrlInPage(page, candidate.src);
    if (dataUrl && dataUrl.startsWith('data:image/') && dataUrl.length > 20_000) {
      return dataUrl;
    }
  }
  return null;
}

export async function ensurePage(onLog?: (m: string) => void): Promise<any> {
  if (_ensurePagePromise) {
    await _ensurePagePromise;
    if (cachedPage && cachedContext) {
      try {
        await cachedPage.evaluate(() => document.readyState);
        if (!cachedPage.url().includes('dropshot.io') || !cachedPage.url().includes('panel=image')) {
          await cachedPage.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await wait(3000);
        }
        if (await isLoggedIn(cachedPage)) return cachedPage;
        await closeDropshotContext(cachedContext);
        cachedPage = null; cachedContext = null;
      } catch { /* 죽음 → 재초기화 */ }
    }
  }
  let lockResolve!: (value: any) => void;
  _ensurePagePromise = new Promise<any>(r => { lockResolve = r; });
  try { return await _ensurePageInternal(onLog); }
  finally { _ensurePagePromise = null; lockResolve(undefined); }
}

async function _ensurePageInternal(onLog?: (m: string) => void): Promise<any> {
  if (cachedPage && cachedContext) {
    try {
      await cachedPage.evaluate(() => document.readyState);
      if (!cachedPage.url().includes('dropshot.io') || !cachedPage.url().includes('panel=image')) {
        await cachedPage.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));
      }
      if (await isLoggedIn(cachedPage)) return cachedPage;
      onLog?.('🔐 [Dropshot] 캐시 세션 만료 감지 — 로그인 흐름으로 전환');
      await closeDropshotContext(cachedContext);
      cachedPage = null; cachedContext = null;
    } catch {
      cachedPage = null; cachedContext = null;
    }
  }

  const profileDir = getProfileDir();
  onLog?.('🌐 [Dropshot] 브라우저 준비 중...');

  // headless 먼저
  let context = await launchBrowser(profileDir, true, onLog);
  let page = context.pages()[0] || await context.newPage();
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 5000));

  if (await isLoggedIn(page)) {
    onLog?.('✅ [Dropshot] 로그인 세션 확인');
    cachedContext = context; cachedPage = page;
    return page;
  }

  // visible 로그인 유도
  onLog?.('🔐 [Dropshot] 로그인 필요 → 브라우저 표시 (최대 5분)');
  await closeDropshotContext(context);
  context = await launchBrowser(profileDir, false, onLog);
  page = context.pages()[0] || await context.newPage();
  await page.goto('https://aistudio.dropshot.io', { waitUntil: 'domcontentloaded', timeout: 45000 });

  let loggedIn = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const pages = context.pages();
      page = pages.find((p: any) => { try { return p.url().includes('dropshot.io'); } catch { return false; } })
        || pages[pages.length - 1];
      if (await isLoggedIn(page)) { loggedIn = true; break; }
    } catch { continue; }
    if (i % 6 === 5) onLog?.(`⏳ [Dropshot] 로그인 대기 (${Math.round((i+1)*5/60)}분 경과)`);
  }
  if (!loggedIn) { await closeDropshotContext(context); throw new Error('Dropshot 로그인 시간 초과'); }

  // visible 닫고 headless로 재진입
  await closeDropshotContext(context);
  const hctx = await launchBrowser(profileDir, true, onLog);
  const hpage = hctx.pages()[0] || await hctx.newPage();
  await hpage.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  cachedContext = hctx; cachedPage = hpage;
  onLog?.('✅ [Dropshot] 준비 완료');
  return hpage;
}

// ═══════════════════════════════════════════════════
// 🎯 PUBLIC API
// ═══════════════════════════════════════════════════

export interface DropshotResult {
  ok: boolean;
  dataUrl: string;
  error?: string;
}

/**
 * v3.6.4: Dropshot 로그인 상태 확인 (UI 자동화 부수 정보)
 *   - 캐시된 세션이 살아있는지 또는 새로 headless 진입해서 확인
 *   - 구독 정보까지 추출 (Pro 여부)
 */
export async function checkDropshotLogin(options: { force?: boolean } = {}): Promise<DropshotLoginStatus> {
  try {
    if (!options.force && _loginCheckCache) {
      const ttl = _loginCheckCache.result.loggedIn ? LOGIN_CHECK_OK_TTL_MS : LOGIN_CHECK_FAIL_TTL_MS;
      if (Date.now() - _loginCheckCache.ts < ttl) {
        return { ..._loginCheckCache.result, cached: true };
      }
    }

    const profileDir = getProfileDir();
    // headless로 빠르게 확인 (cached page 우선)
    let context = cachedContext;
    let page = cachedPage;
    let openedFresh = false;
    if (!context || !page) {
      context = await launchBrowser(profileDir, true);
      page = context.pages()[0] || await context.newPage();
      openedFresh = true;
      try {
        await page.goto('https://aistudio.dropshot.io', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));
      } catch (e: any) {
        if (openedFresh) { await closeDropshotContext(context); }
        const result = { loggedIn: false, message: `navigate 실패: ${e.message}` };
        _loginCheckCache = { ts: Date.now(), result };
        return result;
      }
    }

    const info = await page.evaluate(async () => {
      try {
        // /v1/user/{externalId} 엔드포인트로 확인 — 사이트 UI가 정상 호출하면 200
        const cookies = document.cookie;
        const cognitoMatch = cookies.match(/CognitoIdentityServiceProvider\.[^.]+\.LastAuthUser=([^;]+)/);
        if (!cognitoMatch) return { loggedIn: false, message: 'Cognito 쿠키 없음 — 로그인 필요' };

        // 사이트의 fetch wrapper를 통해 자체 user info 조회 — page 내부에서 fetch (자동 인증)
        const res = await fetch('/api/me', { credentials: 'include' }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          return { loggedIn: true, userName: data?.name, email: data?.email, userId: data?.externalId, message: 'OK' };
        }
        // 대체: localStorage 또는 다른 source
        return { loggedIn: true, message: 'Cognito 세션 있음 (상세 조회는 사이트 내에서)' };
      } catch (e: any) {
        return { loggedIn: false, message: `evaluate err: ${e.message}` };
      }
    });

    // 구독 상태 — best-effort (API 호출 실패해도 loggedIn 정보는 살림)
    let subscription: 'pro' | 'free' | 'unknown' = 'unknown';
    try {
      const sub = await page.evaluate(async () => {
        const r = await fetch('https://api.aistudio.dropshot.io/v1/user/subscription?lang=ko', { credentials: 'include' });
        if (!r.ok) return null;
        return await r.json();
      });
      if (sub && typeof sub === 'object') {
        const planType = String((sub as any)?.current?.plan || (sub as any)?.plan || '').toLowerCase();
        if (planType === 'pro' || planType.includes('pro')) subscription = 'pro';
        else if (planType === 'free' || planType === 'basic') subscription = 'free';
      }
    } catch { /* subscription 정보 못 가져와도 loggedIn 정보는 유효 */ }

    if (openedFresh) {
      // 캐시 안 했으면 닫기 (별도 ensurePage가 나중에 다시 띄움)
      await closeDropshotContext(context);
    }

    const result = withDropshotSubscriptionMeta({ ...info, subscription });
    _loginCheckCache = { ts: Date.now(), result };
    return result;
  } catch (e: any) {
    const result = { loggedIn: false, message: `예외: ${e.message || e}` };
    _loginCheckCache = { ts: Date.now(), result };
    return result;
  }
}

/**
 * v3.6.4: Dropshot visible 로그인 (사용자가 직접 로그인하는 흐름 명시적으로 trigger)
 *   - 환경설정의 "Dropshot 로그인" 버튼에서 호출
 *   - visible 브라우저 열고 5분 대기 → 사용자 로그인 완료 시 자동 close
 */
export async function loginDropshot(): Promise<{
  loggedIn: boolean;
  userName?: string;
  subscription?: 'pro' | 'free' | 'unknown';
  subscriptionKnown?: boolean;
  subscriptionLabel?: string;
  message?: string;
}> {
  try {
    const profileDir = getProfileDir();

    const preCheck = await checkDropshotLogin({ force: true });
    if (preCheck.loggedIn) {
      const result = withDropshotSubscriptionMeta({
        ...preCheck,
        cached: false,
        message: preCheck.subscriptionKnown
          ? '이미 로그인되어 있습니다.'
          : '이미 로그인되어 있습니다. 구독 정보는 사이트 응답 제한으로 미확인입니다.',
      });
      _loginCheckCache = { ts: Date.now(), result };
      return result;
    }

    // 기존 cached 닫기 (visible 새로 띄움)
    if (cachedContext) { await closeDropshotContext(cachedContext); cachedContext = null; cachedPage = null; }

    const context = await launchBrowser(profileDir, false);
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://aistudio.dropshot.io', { waitUntil: 'domcontentloaded', timeout: 45000 });

    let loggedIn = false;
    let userName: string | undefined;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const pages = context.pages();
        const p = pages.find((pg: any) => { try { return pg.url().includes('dropshot.io'); } catch { return false; } }) || pages[pages.length - 1];
        const ok = await isLoggedIn(p);
        if (ok) {
          loggedIn = true;
          try {
            const u = await p.evaluate(async () => {
              const r = await fetch('/api/me', { credentials: 'include' });
              return r.ok ? await r.json() : null;
            });
            userName = u?.name || u?.email;
          } catch {}
          break;
        }
      } catch { continue; }
    }
    await closeDropshotContext(context);
    if (loggedIn) {
      const verified = await checkDropshotLogin({ force: true }).catch(() => null);
      const result = withDropshotSubscriptionMeta(verified?.loggedIn
        ? { ...verified, message: '로그인 완료' }
        : userName
        ? { loggedIn: true, userName, message: '로그인 완료', subscription: 'unknown' }
        : { loggedIn: true, message: '로그인 완료', subscription: 'unknown' });
      _loginCheckCache = { ts: Date.now(), result };
      return result;
    }
    const result = { loggedIn: false, message: '5분 내 로그인 미완료' };
    _loginCheckCache = { ts: Date.now(), result };
    return result;
  } catch (e: any) {
    const result = { loggedIn: false, message: `예외: ${e.message || e}` };
    _loginCheckCache = { ts: Date.now(), result };
    return result;
  }
}

/**
 * URL 이미지를 buffer로 다운로드 → setInputFiles용 file 객체로 변환.
 * dropshot UI의 reference 업로드 input은 일반 file input이므로 setInputFiles가 동작한다.
 */
async function downloadAsFileBuffer(url: string): Promise<{ name: string; mimeType: string; buffer: Buffer } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]?.trim() ?? 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    return { name: `ref-${Date.now()}.${ext}`, mimeType: ct, buffer: buf };
  } catch (e) {
    console.warn('[Dropshot] reference 다운로드 실패:', (e as any)?.message);
    return null;
  }
}

export async function makeDropshotImage(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    /**
     * v3.6.0: 이미지-투-이미지(reference) 지원.
     * 빈 배열/미설정 = 텍스트→이미지, URL 배열 = i2i (최대 4장 권장).
     * 각 URL을 다운로드해서 dropshot UI의 reference 업로드 input에 setInputFiles로 주입.
     */
    referenceImageList?: string[];
  } = {},
  onLog?: (m: string) => void,
): Promise<DropshotResult> {
  // v3.7.3: 모든 호출을 generation mutex로 직렬화.
  //   dropshot은 단일 브라우저 페이지 공유 → 병렬 호출 시 textarea 덮어쓰기로 마지막 prompt만 처리됨.
  //   chain에 .catch()로 ignore-error 부착해서 한 호출 실패가 다음 호출 차단하지 않도록.
  onLog?.('🍌 [Dropshot] 순차 대기열 등록 — 1개씩 처리합니다.');
  const next = _generationChain.then(() => _makeDropshotImageInternal(prompt, options, onLog));
  _generationChain = next.catch(() => undefined as any);
  return next;
}

async function _makeDropshotImageInternal(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    referenceImageList?: string[];
  } = {},
  onLog?: (m: string) => void,
): Promise<DropshotResult> {
  const MAX_RETRIES = 2;
  let currentPrompt = prompt;
  let lastError: string | null = null;

  try {
    let page = await ensurePage(onLog);
    onLog?.('🍌 [Dropshot] 단일 실행 잠금 획득 — 현재 이미지만 생성합니다.');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      onLog?.(`🍌 [Dropshot] 이미지 생성 중... (시도 ${attempt}/${MAX_RETRIES})`);

      // v3.6.9: 한국어 짧은 prompt 자동 enhance (한국어 그대로 + 한국어 enhancer)
      //   nano-banana-pro는 multilingual이라 한국어를 잘 처리.
      //   짧으면 컨텍스트 부족 → 한국어로 시각적 디테일 자동 추가.
      const hasKorean = /[가-힯]/.test(currentPrompt);
      const isShort = currentPrompt.length < 50;
      const enhancedPrompt = (hasKorean && isShort)
        ? `${currentPrompt} — 본 주제를 직관적으로 표현하는 사실적 사진, 한국적 배경, 자연광, 시네마틱 4K, 텍스트 없음`
        : currentPrompt;

      // 매 호출마다 unique variation hint (한국어 + 영어 mixed, 강한 다양성 강제)
      const nonce = Math.random().toString(36).slice(2, 8);
      const variationSeed = Date.now().toString(36);
      const promptWithVariation = enhancedPrompt
        + ` (버전-${variationSeed}-${nonce}: 매번 완전히 다른 구도, 다른 시점, 다른 인물/배경/소품 — 이전 결과와 절대 같으면 안 됨)`;

      try {
        // 1. board URL 재진입. 이전 reference 업로드, 에러 화면, prompt 잔여 상태를 매번 비운다.
        await resetDropshotBoard(page, onLog);

        // v3.7.1: 무제한 모드 토글 ON + 카운터 1로 자동 설정 (매 호출마다 idempotent)
        await ensureDropshotControls(page, onLog);

        // 2. 호출 전 DOM의 result 이미지 snapshot (이전 이미지 반복 캡처 방지)
        const beforeSrcs = await getDropshotImageSnapshot(page);

        // v3.6.0: reference 이미지가 있으면 i2i 모드 — 업로드 input에 setInputFiles로 주입
        const refList = (options.referenceImageList || []).slice(0, 4);
        if (refList.length > 0) {
          onLog?.(`📎 [Dropshot] reference ${refList.length}장 업로드 중...`);
          const buffers: Array<{ name: string; mimeType: string; buffer: Buffer }> = [];
          for (const url of refList) {
            const f = await downloadAsFileBuffer(url);
            if (f) buffers.push(f);
          }
          if (buffers.length > 0) {
            // dropshot UI의 reference 업로드 input 찾기 — image-only + multiple input 우선
            //   selector 우선순위:
            //     1) data-dropzone-accept="image" + multiple — 다중 reference 슬롯
            //     2) data-sentry-component="UploadImage" 내부 input
            //     3) 첫 번째 image-accept file input
            const fileInput = await page.$(
              'input[type="file"][data-dropzone-accept="image"][multiple], ' +
              '[data-sentry-component="UploadedImage"] input[type="file"], ' +
              'input[type="file"][accept*="image"]'
            );
            if (fileInput) {
              try {
                await fileInput.setInputFiles(buffers);
                onLog?.(`✅ [Dropshot] reference ${buffers.length}장 업로드 완료`);
                await new Promise(r => setTimeout(r, 2500)); // upload 완료 대기
              } catch (e: any) {
                onLog?.(`⚠️ [Dropshot] reference 업로드 실패: ${e.message?.slice(0, 100)}`);
              }
            } else {
              onLog?.(`⚠️ [Dropshot] reference 업로드 input 못 찾음 (UI 변경?) — 텍스트→이미지로 폴백`);
            }
          }
        }

        // 3. 프롬프트 입력 (variation hint 포함)
        await fillDropshotPrompt(page, promptWithVariation);
        await wait(1000);

        // 4. 생성 버튼 클릭 — UI 변경 대비 다중 fallback
        const clickResult = await clickDropshotGenerate(page);
        onLog?.(`🖱️ [Dropshot] 생성 실행: ${clickResult.detail}`);
        if (!clickResult.clicked && clickResult.diagnostics) {
          onLog?.(`⚠️ [Dropshot] 생성 버튼 진단: ${clickResult.diagnostics.slice(0, 240)}`);
        }

        // 5. 결과 이미지 대기 — snapshot에 없던 NEW 이미지만 잡음
        // v3.8.130: nano-banana-pro는 90초를 넘기는 케이스가 있어 210초까지 기다린다.
        //   기존 90초 retry는 결과가 나올 타이밍에 board를 새로고침해 작업을 끊는 문제가 있었다.
        //   data:, blob:, currentSrc/srcset, background-image, CDN URL을 모두 후보로 본다.
        await new Promise(r => setTimeout(r, 5000)); // grace period: dropshot이 sample/placeholder를 일찍 보여주는 시간 회피
        const startTs = Date.now();
        let foundDataUrl: string | null = null;
        let lastProgressLogAt = 0;
        while ((Date.now() - startTs) < DROPSHOT_RESULT_WAIT_MS) {
          await new Promise(r => setTimeout(r, DROPSHOT_RESULT_POLL_MS));

          // v3.8.60: dropshot 에러 페이지 감지 — 즉시 폴백
          const dropshotError = await page.evaluate(() => {
            const bodyText = document.body?.innerText || '';
            return /이런[,\s]*문제가\s*발생|환불되었으니|크레딧은\s*환불|다시\s*시도해주세요|something went wrong|please try again/i.test(bodyText);
          });
          if (dropshotError) {
            console.warn('[DROPSHOT] ⚠️ dropshot 서버 에러 페이지 감지 — 즉시 폴백');
            throw new Error('dropshot 서버 에러: 잠시 후 재시도 필요');
          }

          foundDataUrl = await findDropshotResultDataUrl(page, beforeSrcs, onLog);
          if (foundDataUrl) break;

          const elapsed = Date.now() - startTs;
          if (elapsed - lastProgressLogAt >= 30_000) {
            lastProgressLogAt = elapsed;
            onLog?.(`⏳ [Dropshot] 결과 대기 중... ${Math.round(elapsed / 1000)}초/${Math.round(DROPSHOT_RESULT_WAIT_MS / 1000)}초`);
          }
        }

        if (foundDataUrl) {
          onLog?.('✅ [Dropshot] 이미지 생성 완료');
          return { ok: true, dataUrl: foundDataUrl };
        }

        const diagnostics = await getDropshotGenerationDiagnostics(page);
        lastError = `${Math.round(DROPSHOT_RESULT_WAIT_MS / 1000)}초 내 결과 이미지 미발견`;
        onLog?.(`🧪 [Dropshot] 결과 감지 진단: ${diagnostics.slice(0, 500)}`);
        onLog?.(`⚠️ [Dropshot] ${lastError} (시도 ${attempt})`);
      } catch (e: any) {
        lastError = e.message || String(e);
        onLog?.(`❌ [Dropshot] 시도 ${attempt} 실패: ${lastError}`);
        if (lastError && /Target closed|WebSocket|frame was detached|로그인 세션|board 진입|프롬프트 입력창|서버 에러|Timeout/i.test(lastError)) {
          await closeDropshotContext(cachedContext);
          cachedPage = null; cachedContext = null;
          if (attempt < MAX_RETRIES) {
            try { page = await ensurePage(onLog); } catch { /* next loop will return final error */ }
          }
        }
      }
    }
    return { ok: false, dataUrl: '', error: lastError || 'unknown' };
  } catch (e: any) {
    return { ok: false, dataUrl: '', error: e.message || String(e) };
  }
}
