/**
 * 🤖 Flow 자동 드라이버 — 한국어 텍스트 기반으로 Scene Builder → 이미지 생성까지 전부 Playwright가 클릭
 *
 * 사용자 역할: Chrome 창은 방해하지 말고 놔두기만 하면 됨. 이미 Pro 로그인된 프로필 사용.
 *
 * 전략:
 *   1. Flow 대시보드 진입
 *   2. 기존 프로젝트 카드 클릭 (or New project 있으면 그거)
 *   3. 프로젝트 안에서 "미디어 추가하기" / "Add media" 클릭 → 드롭다운 열림
 *   4. 드롭다운에서 "장면" / "Scene" 관련 옵션 클릭 → Scene Builder 열림
 *   5. Scene Builder 내 "이미지" 탭 / "Text to image" 모드 전환
 *   6. 프롬프트 "3차 민생지원금" 입력
 *   7. 모델을 Nano Banana Pro로 선택
 *   8. "생성" / "Generate" 클릭
 *   9. 네트워크 캡처 10~60초
 *
 * 각 단계 성공/실패 시 HTML + screenshot dump → 막히면 제가 사후 분석
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'dry-run-output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_JSON = path.join(OUTPUT_DIR, `flow-driver-${TS}.json`);
const DUMP_DIR = path.join(OUTPUT_DIR, `flow-driver-html-${TS}`);
fs.mkdirSync(DUMP_DIR, { recursive: true });

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
  return /aisandbox-pa|labs\.google|generativelanguage|sandbox\.google|contentstore-pa/i.test(url)
    && !/google-analytics|googletagmanager|fonts\.googleapis/i.test(url);
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
      method, url,
      reqHeaders: req.headers(),
      reqBody: body,
      resStatus: null, resHeaders: null, resBody: null, resContentType: null,
    };
    captured.push(entry);
    (entry as any)._ref = req;
    if (method === 'POST') console.log(`   📤 POST ${url.substring(0, 110)}`);
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
        entry.resBody = buf.toString('utf-8').substring(0, 40960);
      } else if (buf.length < 500) {
        entry.resBody = buf.toString('utf-8').substring(0, 500);
      } else {
        entry.resBody = `<binary ${buf.length} bytes>`;
      }
    } catch { entry.resBody = '<unreadable>'; }
    if (req.method() === 'POST') console.log(`   📥 ${res.status()} ${url.substring(0, 110)}`);
  });
}

async function dumpPage(page: any, name: string) {
  try {
    const html = await page.content();
    fs.writeFileSync(path.join(DUMP_DIR, `${name}.html`), html, 'utf-8');
    await page.screenshot({ path: path.join(DUMP_DIR, `${name}.png`), fullPage: false }).catch(() => {});
    console.log(`   💾 ${name}`);
  } catch (e: any) {
    console.log(`   ⚠️ dump 실패: ${e.message}`);
  }
}

async function listVisibleText(page: any): Promise<string[]> {
  return await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('button, [role="button"], [role="menuitem"], a, [role="tab"]').forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 3 || r.height < 3) return;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
      const text = (el.textContent || '').trim();
      const aria = el.getAttribute('aria-label') || '';
      const combined = `${text}|${aria}`.substring(0, 100);
      if (combined.trim()) out.push(combined);
    });
    return [...new Set(out)].slice(0, 60);
  });
}

async function tryClickByText(page: any, texts: string[], label: string): Promise<boolean> {
  for (const text of texts) {
    // 1) 정확 일치
    try {
      const el = page.getByText(text, { exact: true }).first();
      if (await el.count() > 0 && await el.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`   🖱️  [${label}] exact="${text}"`);
        await el.click({ timeout: 4000 });
        await page.waitForTimeout(1500);
        return true;
      }
    } catch { /* next */ }
    // 2) 부분 일치 (역할 기반)
    try {
      const el = page.getByRole('button', { name: new RegExp(text, 'i') }).first();
      if (await el.count() > 0 && await el.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`   🖱️  [${label}] button~="${text}"`);
        await el.click({ timeout: 4000 });
        await page.waitForTimeout(1500);
        return true;
      }
    } catch { /* next */ }
    // 3) 일반 텍스트 일치
    try {
      const el = page.getByText(new RegExp(text, 'i')).first();
      if (await el.count() > 0 && await el.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`   🖱️  [${label}] text~="${text}"`);
        await el.click({ timeout: 4000 });
        await page.waitForTimeout(1500);
        return true;
      }
    } catch { /* next */ }
  }
  return false;
}

function save() {
  const clean = captured.map(e => { const { _ref, ...rest } = e as any; return rest; });
  fs.writeFileSync(OUT_JSON, JSON.stringify(clean, null, 2), 'utf-8');
  console.log(`\n💾 ${clean.length}개 요청 → ${OUT_JSON}`);
  const posts = clean.filter(e => e.method === 'POST');
  const okPosts = posts.filter(e => e.resStatus && e.resStatus < 300);
  console.log(`📊 POST ${posts.length}개 (성공 ${okPosts.length}개)`);
  const imgGen = okPosts.filter(p => {
    const body = (p.reqBody || '') + (p.resBody || '');
    return /encodedImage|generatedImages|nano_banana|gem_pix|runImage|runBanana|generateImage/.test(body);
  });
  if (imgGen.length > 0) {
    console.log(`\n🎯 이미지 생성 관련 POST ${imgGen.length}개 🎉`);
    imgGen.forEach((p, i) => {
      console.log(`\n  === ${i + 1} ===`);
      console.log(`  URL: ${p.url}`);
      console.log(`  REQ: ${(p.reqBody || '').substring(0, 800).replace(/\n/g, ' ')}`);
      console.log(`  RES(앞 400): ${(p.resBody || '').substring(0, 400).replace(/\n/g, ' ')}`);
    });
  } else {
    console.log('\n⚠️ 이미지 생성 POST 미발견');
  }
}

(async () => {
  console.log('🤖 Flow 자동 드라이버 시작');
  console.log(`출력: ${OUT_JSON}\n`);

  const { chromium } = await import('playwright') as any;
  const profileDir = path.join(os.homedir(), '.blogger-gpt', 'imagefx-profile');

  let ctx: any;
  try {
    ctx = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1600, height: 1000 },
      args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
      channel: 'chrome',
    });
  } catch {
    ctx = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1600, height: 1000 },
      args: ['--no-first-run'],
      ignoreDefaultArgs: ['--enable-automation'],
      channel: 'msedge',
    });
  }

  const page = ctx.pages()[0] || await ctx.newPage();
  setupCapture(page);

  // ── [1] Flow 대시보드 진입
  currentStep = '1-dashboard';
  console.log('\n[1] Flow 대시보드 이동...');
  try {
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
  } catch { /* ignore */ }
  await dumpPage(page, '1-dashboard');
  console.log(`   URL: ${page.url()}`);

  // ── [2] 쿠키 배너 + 환영 팝업 전부 닫기
  currentStep = '2-close-popups';
  console.log('\n[2] 쿠키 배너 + 환영 팝업 닫기...');
  // 2-a. 쿠키 배너: "Agree" / "No thanks" / "동의" / "거부" 등
  await tryClickByText(page, ['Agree', 'Accept all', 'Accept', '동의', '모두 동의', 'OK, got it'], 'cookie-agree');
  await page.waitForTimeout(800);
  // 2-b. 환영 팝업
  await tryClickByText(page, ['시작하기', 'Get started', 'Close', '닫기'], 'close-welcome');
  await page.waitForTimeout(1200);
  await dumpPage(page, '2-after-popups');

  // ── [3] 기존 프로젝트 카드 클릭 (or New project)
  currentStep = '3-enter-project';
  console.log('\n[3] 프로젝트 진입...');
  let entered = false;
  // 기존 카드 클릭 시도: "오후", "오전" 같은 시간 표기를 포함하는 타일
  const dateRegex = /\d+월 \d+일|오후|오전|Today/;
  try {
    const card = page.getByText(dateRegex).first();
    if (await card.count() > 0 && await card.isVisible({ timeout: 1500 }).catch(() => false)) {
      await card.click({ timeout: 4000 });
      entered = true;
      console.log('   🖱️  기존 프로젝트 카드 클릭');
    }
  } catch { /* next */ }
  if (!entered) {
    entered = await tryClickByText(page, ['새 프로젝트', 'New project', '프로젝트 만들기', '시작', 'Create'], 'new-project');
  }
  await page.waitForTimeout(3500);
  await dumpPage(page, '3-project-entered');
  console.log(`   URL: ${page.url()}`);
  console.log(`   보이는 버튼들(상위 30):`);
  const btnsA = await listVisibleText(page);
  btnsA.slice(0, 30).forEach(t => console.log(`     - ${t}`));

  // ── [4] "미디어 추가하기" / Add menu 클릭 (드롭다운 열기 + 충분 대기)
  currentStep = '4-add-menu';
  console.log('\n[4] 미디어 추가 메뉴 열기...');
  await tryClickByText(page, ['미디어 추가하기', '미디어 추가', '추가', 'Add media', 'Add', '+'], 'add-menu');
  await page.waitForTimeout(5000);
  await dumpPage(page, '4-after-add-click');
  console.log(`   드롭다운 후 보이는 것들(상위 40):`);
  const btnsB = await listVisibleText(page);
  btnsB.slice(0, 40).forEach(t => console.log(`     - ${t}`));

  // ── [5] 프로젝트 메인에 이미 Nano Banana 2 이미지 생성 UI가 있음
  //     Scene Builder(장면)로 가면 비디오 모드라 잘못된 경로 — 스킵
  currentStep = '5-skip-scenebuilder';
  console.log('\n[5] Scene Builder 스킵 — 프로젝트 메인에 이미 이미지 생성 UI 있음');
  await dumpPage(page, '5-project-main');

  // ── [6] "정밀 모드" 토글 켜기 → Nano Banana Pro 자동 활성화
  //    HTML 분석 결과: "Nano Banana Pro is now the default when you toggle on Precise Mode"
  currentStep = '6-enable-precise-mode';
  console.log('\n[6] 정밀 모드(Precise Mode) 토글 ON → Nano Banana Pro 활성화...');
  // 토글 후보: "정밀 모드", "Precise Mode", "정밀", "Precise"
  const preciseEnabled = await tryClickByText(page, ['정밀 모드', 'Precise Mode', '정밀', 'Precise'], 'precise-toggle');
  if (!preciseEnabled) {
    // role=switch 기반 폴백
    try {
      const sw = page.locator('[role="switch"]').first();
      if (await sw.count() > 0 && await sw.isVisible({ timeout: 500 }).catch(() => false)) {
        const pressed = await sw.getAttribute('aria-checked').catch(() => 'false');
        if (pressed !== 'true') {
          await sw.click({ timeout: 3000 });
          console.log('   🖱️  [precise] switch toggled ON');
        }
      }
    } catch { /* ignore */ }
  }
  await page.waitForTimeout(1500);
  await dumpPage(page, '6-precise-mode');

  // ── [7] 프롬프트 입력 (textarea 찾아서 입력)
  currentStep = '7-input-prompt';
  console.log('\n[7] 프롬프트 입력...');
  const PROMPT = '3차 민생지원금';
  let typed = false;
  const inputSels = ['textarea', '[contenteditable="true"]', '[role="textbox"]', 'input[type="text"]'];
  for (const sel of inputSels) {
    try {
      const els = page.locator(sel);
      const count = await els.count();
      for (let i = 0; i < count; i++) {
        const el = els.nth(i);
        if (!(await el.isVisible({ timeout: 500 }).catch(() => false))) continue;
        const box = await el.boundingBox().catch(() => null);
        if (!box || box.width < 100) continue; // 너무 작은 인풋은 제외
        await el.click({ timeout: 3000 });
        await page.keyboard.type(PROMPT);
        console.log(`   ✍️  입력: ${sel}[${i}] (${Math.round(box.width)}x${Math.round(box.height)}) ← "${PROMPT}"`);
        typed = true;
        break;
      }
      if (typed) break;
    } catch { /* next */ }
  }
  if (!typed) console.log('   ⚠️ 입력 필드 없음');
  await page.waitForTimeout(1500);
  await dumpPage(page, '7-prompt-typed');

  // ── [8] Generate 버튼 = button with <i>arrow_forward</i> 자식
  //    HTML 분석으로 확정: Generate 버튼은 "arrow_forward" google-symbols 아이콘 가진 버튼이며,
  //    visible text가 없음(span.만들기는 시각적으로 clip됨)
  currentStep = '8-generate';
  console.log('\n[8] Generate 버튼 (arrow_forward 아이콘) 클릭...');
  let genClicked = false;
  try {
    // 가장 확실한 selector: arrow_forward 아이콘을 가진 button
    const el = page.locator('button').filter({ has: page.locator('i', { hasText: 'arrow_forward' }) }).first();
    const count = await el.count();
    if (count > 0 && await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`   🖱️  Generate: button with <i>arrow_forward</i>`);
      await el.click({ timeout: 5000 });
      genClicked = true;
    }
  } catch (e: any) {
    console.log(`   ⚠️ arrow_forward 버튼 클릭 실패: ${e.message.substring(0, 80)}`);
  }

  // 폴백: 다른 방식으로 찾기
  if (!genClicked) {
    try {
      const el = page.locator('button:has(i.google-symbols:text-is("arrow_forward"))').first();
      if (await el.count() > 0) {
        await el.click({ timeout: 4000 });
        genClicked = true;
        console.log('   🖱️  Generate: fallback CSS');
      }
    } catch { /* ignore */ }
  }
  if (!genClicked) console.log('   ⚠️ Generate 버튼 못 찾음');
  await dumpPage(page, '8-after-generate');

  // ── [9] 생성 대기 + 캡처
  currentStep = '9-wait-for-generation';
  console.log('\n[9] 90초 생성 대기 / 캡처 중...');
  await page.waitForTimeout(90000);
  await dumpPage(page, '9-final');

  save();
  console.log('\n브라우저 닫는 중...');
  await ctx.close().catch(() => {});
  process.exit(0);
})();
