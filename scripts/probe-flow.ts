/**
 * 🔬 Flow 네트워크 리버스 엔지니어링 프로브 (완전 자동)
 *
 * 동작:
 *   1) 기존 ImageFX persistent context로 Chrome headed 실행 (로그인 쿠키 공유)
 *   2) labs.google/flow로 이동, HTML 구조 덤프
 *   3) 이미지 생성 UI 탐색: 버튼/링크 텍스트에 "image"/"generate"/"이미지"/"생성"/"create"/"new" 매칭
 *   4) 후보 경로를 순차 탐색하며 각 페이지 HTML + 네트워크 캡처
 *   5) 프로그래매틱하게 input 채우고 Generate 클릭 → 실제 API 호출 캡처
 *   6) 60초간 모든 aisandbox/labs.google POST 요청 저장
 *
 * 사용자 조작 불필요. headed 모드로 띄우지만 Playwright가 자동 조작.
 * 실패해도 수집된 HTML + 네트워크 로그를 저장 → 다음 단계에서 수정.
 *
 * 출력: dry-run-output/flow-probe-<ts>.json
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'dry-run-output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_FILE = path.join(OUTPUT_DIR, `flow-probe-${TS}.json`);
const HTML_DIR = path.join(OUTPUT_DIR, `flow-probe-html-${TS}`);
fs.mkdirSync(HTML_DIR, { recursive: true });

interface CapturedExchange {
  t: string;
  step: string;
  method: string;
  url: string;
  reqHeaders: Record<string, string>;
  reqBody: string | null;
  resStatus: number | null;
  resHeaders: Record<string, string> | null;
  resBody: string | null;
  resContentType: string | null;
}

const captured: CapturedExchange[] = [];
let currentStep = 'init';

function isInteresting(url: string): boolean {
  return /aisandbox-pa|labs\.google|generativelanguage|sandbox\.google|contentstore-pa/i.test(url);
}

function setupCapture(page: any) {
  page.on('request', (req: any) => {
    const url = req.url();
    if (!isInteresting(url)) return;
    const method = req.method();
    if (method === 'OPTIONS') return;
    let body: string | null = null;
    try { body = req.postData(); } catch { /* ignore */ }
    const entry: CapturedExchange = {
      t: new Date().toISOString(),
      step: currentStep,
      method,
      url,
      reqHeaders: req.headers(),
      reqBody: body,
      resStatus: null,
      resHeaders: null,
      resBody: null,
      resContentType: null,
    };
    captured.push(entry);
    (entry as any)._ref = req;
  });

  page.on('response', async (res: any) => {
    const url = res.url();
    if (!isInteresting(url)) return;
    const req = res.request();
    if (req.method() === 'OPTIONS') return;
    const entry = [...captured].reverse().find(e => (e as any)._ref === req);
    if (!entry) return;
    entry.resStatus = res.status();
    entry.resHeaders = res.headers();
    entry.resContentType = res.headers()['content-type'] || null;
    try {
      const buf = await res.body();
      if (entry.resContentType && /json|text|xml/.test(entry.resContentType)) {
        entry.resBody = buf.toString('utf-8').substring(0, 20480);
      } else if (buf.length < 500) {
        entry.resBody = buf.toString('utf-8').substring(0, 500);
      } else {
        entry.resBody = `<binary ${buf.length} bytes>`;
      }
    } catch { entry.resBody = '<unreadable>'; }
  });
}

async function dumpPage(page: any, name: string) {
  try {
    const html = await page.content();
    fs.writeFileSync(path.join(HTML_DIR, `${name}.html`), html, 'utf-8');
    const screenshot = path.join(HTML_DIR, `${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
    console.log(`   💾 덤프: ${name}.html + .png (${html.length} bytes)`);
  } catch (e: any) {
    console.log(`   ⚠️ 덤프 실패: ${e.message}`);
  }
}

async function listClickableElements(page: any) {
  return await page.evaluate(() => {
    const result: Array<{ tag: string; text: string; href?: string; id?: string; aria?: string }> = [];
    const els = document.querySelectorAll('a, button, [role="button"], [role="link"]');
    els.forEach((el) => {
      const text = (el.textContent || '').trim().substring(0, 60);
      const href = (el as HTMLAnchorElement).href || '';
      const id = el.id || '';
      const aria = el.getAttribute('aria-label') || '';
      if (!text && !aria) return;
      result.push({ tag: el.tagName.toLowerCase(), text, href, id, aria });
    });
    return result.slice(0, 100);
  });
}

function save() {
  const clean = captured.map(e => {
    const { _ref, ...rest } = e as any;
    return rest;
  });
  fs.writeFileSync(OUT_FILE, JSON.stringify(clean, null, 2), 'utf-8');
  console.log(`\n💾 총 ${clean.length}개 요청 저장 → ${OUT_FILE}`);

  const posts = clean.filter(e => e.method === 'POST');
  const okPosts = posts.filter(e => e.resStatus && e.resStatus < 300);
  console.log(`📊 POST ${posts.length}개 (성공 ${okPosts.length}개)`);

  if (okPosts.length > 0) {
    console.log(`\n✅ 성공 POST 상위 10개:`);
    okPosts.slice(0, 10).forEach((p, i) => {
      console.log(`\n  ${i + 1}. ${p.url}`);
      console.log(`     step: ${p.step}`);
      if (p.reqBody) console.log(`     req body(앞 300): ${p.reqBody.substring(0, 300).replace(/\n/g, ' ')}`);
      if (p.resBody) console.log(`     res body(앞 200): ${p.resBody.substring(0, 200).replace(/\n/g, ' ')}`);
    });
  } else {
    console.log(`\n⚠️ 성공 POST 없음. 실패 POST 상위 5개:`);
    posts.filter(p => p.resStatus && p.resStatus >= 400).slice(0, 5).forEach((p, i) => {
      console.log(`\n  ${i + 1}. [${p.resStatus}] ${p.url}`);
      if (p.resBody) console.log(`     err: ${p.resBody.substring(0, 300).replace(/\n/g, ' ')}`);
    });
  }
}

(async () => {
  console.log('🔬 Flow 자동 프로브 시작');
  console.log(`출력: ${OUT_FILE}\n`);

  const { chromium } = await import('playwright') as any;
  const profileDir = path.join(os.homedir(), '.blogger-gpt', 'imagefx-profile');
  if (!fs.existsSync(profileDir)) {
    console.error(`❌ ImageFX 프로필 없음: ${profileDir}`);
    process.exit(1);
  }

  let ctx: any;
  try {
    ctx = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
      channel: 'chrome',
    });
  } catch {
    ctx = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
      channel: 'msedge',
    });
  }

  const page = ctx.pages()[0] || await ctx.newPage();
  setupCapture(page);

  // ── Step 1: Flow 앱 직접 진입 시도 (Pro 로그인 상태 전제)
  //    마케팅 랜딩(`/fx/ko/tools/flow`)이 아닌 앱 URL(`/flow`)로 바로 이동
  currentStep = 'step1-flow-app';
  console.log('\n[1] labs.google/flow 앱 직접 이동 (Pro 계정 전제)...');
  try {
    await page.goto('https://labs.google/flow', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    console.log(`   현재 URL: ${page.url()}`);
    await dumpPage(page, 'step1-flow-app');
  } catch (e: any) {
    console.log(`   이동 오류: ${e.message}`);
  }

  // ── Step 2: textarea가 나타날 때까지 자동 버튼 클릭 + 폴링
  //    전략: 매 3초마다 (a) textarea 있으면 종료, (b) 없으면 "시작/Try/New/만들기" 버튼 찾아 클릭
  currentStep = 'step2-auto-navigate';
  console.log('\n[2] 자동 탐색 — textarea 나타날 때까지 버튼 클릭...');

  const WAIT_MAX_MS = 4 * 60 * 1000; // 4분
  const start = Date.now();
  let uiReady = false;
  const clickedHashes = new Set<string>();

  const clickPatterns = [
    // Korean (priority)
    'button:has-text("시작")',
    'button:has-text("만들기")',
    'button:has-text("새")',
    'button:has-text("이동")',
    'a:has-text("시작")',
    'a:has-text("Flow에서")',
    'a:has-text("만들기")',
    // English
    'button:has-text("New project")',
    'button:has-text("Create")',
    'button:has-text("Start")',
    'button:has-text("Try")',
    'button:has-text("Get started")',
    'a:has-text("New project")',
    'a:has-text("Try Flow")',
    'a:has-text("Start creating")',
    // Image tool within project
    'button:has-text("Image")',
    'button:has-text("이미지")',
    '[role="tab"]:has-text("Image")',
    '[role="tab"]:has-text("이미지")',
    '[role="tab"]:has-text("Frame")',
    '[role="tab"]:has-text("Ingredient")',
    // Aria-label 기반
    '[aria-label*="새 프로젝트" i]',
    '[aria-label*="New project" i]',
    '[aria-label*="Create" i]',
    '[aria-label*="Start" i]',
  ];

  while (Date.now() - start < WAIT_MAX_MS) {
    try {
      // (a) textarea 체크
      const hasTextarea = await page.locator('textarea, [contenteditable="true"], [role="textbox"]').first().isVisible({ timeout: 1500 }).catch(() => false);
      const url = page.url();
      if (hasTextarea) {
        uiReady = true;
        console.log(`   ✅ textarea 감지됨, url=${url}`);
        await dumpPage(page, 'step2-textarea-found');
        break;
      }

      // (b) 버튼 자동 클릭
      let clicked = false;
      for (const sel of clickPatterns) {
        try {
          const els = page.locator(sel);
          const count = await els.count();
          for (let i = 0; i < Math.min(count, 3); i++) {
            const el = els.nth(i);
            const visible = await el.isVisible({ timeout: 500 }).catch(() => false);
            if (!visible) continue;
            const text = ((await el.textContent().catch(() => '')) || '').trim().substring(0, 40);
            const hash = `${sel}:${text}`;
            if (clickedHashes.has(hash)) continue;
            clickedHashes.add(hash);
            console.log(`   🖱️  클릭: ${sel} [${text}]`);
            await el.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(2500);
            clicked = true;
            break;
          }
          if (clicked) break;
        } catch { /* next pattern */ }
      }

      const elapsed = Math.round((Date.now() - start) / 1000);
      if (!clicked && elapsed % 10 === 0) {
        console.log(`   ⏳ ${elapsed}s — 클릭 가능 버튼 없음. 현재 url: ${url.substring(0, 100)}`);
      }
    } catch { /* 페이지 로딩 중 */ }
    await page.waitForTimeout(3000);
  }
  if (!uiReady) {
    console.log('   ⚠️ 4분 타임아웃 — textarea 못 찾음. 현재 페이지 상태 덤프 후 종료.');
    await dumpPage(page, 'step2-timeout');
  }
  let flowAppUrl: string | null = page.url();

  // ── Step 3: 이미지 생성 관련 UI 요소 탐색
  currentStep = 'step3-scan-ui';
  console.log('\n[3] 페이지 UI 스캔...');
  const clickables = await listClickableElements(page).catch(() => []);
  const imageRelated = clickables.filter((c: any) => {
    const all = `${c.text} ${c.aria} ${c.href}`.toLowerCase();
    return /image|generate|create|new|이미지|생성|banana|flow/.test(all);
  });
  console.log(`   이미지 관련 클릭 요소 ${imageRelated.length}개 (전체 ${clickables.length}개 중):`);
  imageRelated.slice(0, 20).forEach((c: any, i: number) => {
    console.log(`   ${i + 1}. <${c.tag}> "${c.text}" ${c.aria ? `[${c.aria}]` : ''} ${c.href ? c.href.substring(0, 80) : ''}`);
  });

  // ── Step 4: Flow "New project" / Image tool로 진입 시도
  currentStep = 'step4-enter-image-tool';
  console.log('\n[4] 이미지 도구 진입 시도...');
  const enterCandidates = [
    'button:has-text("New project")',
    'button:has-text("New")',
    'button:has-text("Get started")',
    'button:has-text("Create")',
    'a:has-text("New project")',
    'a:has-text("Try Flow")',
    '[aria-label*="Create" i]',
    '[aria-label*="New" i]',
  ];
  let entered = false;
  for (const sel of enterCandidates) {
    try {
      const el = await page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`   클릭: ${sel}`);
        await el.click({ timeout: 5000 });
        await page.waitForTimeout(3500);
        await dumpPage(page, `step4-after-${sel.replace(/[^a-z]/gi, '_').substring(0, 30)}`);
        entered = true;
        break;
      }
    } catch { /* 다음 후보 */ }
  }
  if (!entered) {
    console.log('   ⚠️ 진입 버튼 못 찾음. 현재 페이지에서 직접 시도');
  }

  // ── Step 5: 프롬프트 입력 + Generate 버튼 탐색 & 클릭
  currentStep = 'step5-prompt-and-generate';
  console.log('\n[5] 프롬프트 입력 + Generate 시도...');
  const inputCandidates = [
    'textarea',
    'input[type="text"]',
    '[role="textbox"]',
    '[contenteditable="true"]',
  ];
  let typedOk = false;
  for (const sel of inputCandidates) {
    try {
      const el = await page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click({ timeout: 3000 });
        await el.fill('a red apple on a wooden table').catch(async () => {
          await page.keyboard.type('a red apple on a wooden table');
        });
        console.log(`   ✅ 프롬프트 입력: ${sel}`);
        typedOk = true;
        break;
      }
    } catch { /* 다음 */ }
  }

  const generateCandidates = [
    'button:has-text("Generate")',
    'button:has-text("Create")',
    'button:has-text("생성")',
    'button[aria-label*="Generate" i]',
    'button[aria-label*="Submit" i]',
    '[role="button"]:has-text("Generate")',
    'button[type="submit"]',
  ];
  if (typedOk) {
    for (const sel of generateCandidates) {
      try {
        const el = await page.locator(sel).first();
        if (await el.count() > 0 && await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`   🎯 Generate 클릭: ${sel}`);
          await el.click({ timeout: 5000 });
          console.log('   ⏳ 60초간 이미지 생성 대기 (네트워크 캡처 중)...');
          await page.waitForTimeout(60000);
          await dumpPage(page, 'step5-after-generate');
          break;
        }
      } catch { /* 다음 */ }
    }
  } else {
    console.log('   ⚠️ 입력 필드 못 찾음 → 페이지 덤프만 저장하고 종료');
    await page.waitForTimeout(10000);
    await dumpPage(page, 'step5-no-input');
  }

  // 저장 + 종료
  save();
  console.log('\n브라우저 닫는 중...');
  await ctx.close().catch(() => {});
  process.exit(0);
})();
