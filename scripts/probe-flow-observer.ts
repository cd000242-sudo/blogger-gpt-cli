/**
 * 🔬 Flow 관찰자 모드 프로브
 *
 * 동작:
 *   1) Chrome headed 실행 (ImageFX 프로필 공유, Pro 로그인 유지)
 *   2) labs.google 으로 이동 후 사용자가 수동 조작
 *   3) 10분간 모든 aisandbox/labs.google 네트워크 요청/응답 캡처
 *   4) 사용자가 Ctrl+C 또는 10분 경과 시 JSON 저장 + 종료
 *
 * 사용자 조작:
 *   - 평소처럼 Flow 앱 진입 (자신만 아는 URL / 대시보드 / 프로젝트)
 *   - 이미지 1장 생성 (Nano Banana Pro)
 *   - 완성되면 그냥 기다리거나 Ctrl+C
 *
 * 목적: 자동 UI 탐색 실패 → 사용자 실제 플로우 관찰로 정확한 엔드포인트 포착
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'dry-run-output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_FILE = path.join(OUTPUT_DIR, `flow-observe-${TS}.json`);

interface CapturedExchange {
  t: string;
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

function isInteresting(url: string): boolean {
  return /aisandbox-pa|labs\.google|generativelanguage|sandbox\.google|contentstore-pa|googleapis\.com/i.test(url)
    && !/google-analytics|googletagmanager|fonts\.googleapis/i.test(url);
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

  // 이미지 생성 관련 POST 필터
  const imgPosts = okPosts.filter(p => {
    const body = p.reqBody || '';
    const resBody = p.resBody || '';
    return /runImageFx|runImageGen|runBanana|generateImage|imagen|banana/i.test(p.url + body)
      || /encodedImage|generatedImages|imagePanels/i.test(resBody)
      || (body.includes('prompt') && body.length > 100);
  });

  if (imgPosts.length > 0) {
    console.log(`\n🎯 이미지 생성 관련 POST ${imgPosts.length}개:`);
    imgPosts.forEach((p, i) => {
      console.log(`\n  ━━━━━ #${i + 1} ━━━━━`);
      console.log(`  URL: ${p.url}`);
      console.log(`  Status: ${p.resStatus}`);
      console.log(`  Req body (앞 500자): ${(p.reqBody || '').substring(0, 500).replace(/\n/g, ' ')}`);
      console.log(`  Res body (앞 300자): ${(p.resBody || '').substring(0, 300).replace(/\n/g, ' ')}`);
    });
  } else if (okPosts.length > 0) {
    console.log(`\n📋 성공 POST 상위 15개 URL:`);
    okPosts.slice(0, 15).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.url} [${p.resStatus}]`);
      if (p.reqBody && p.reqBody.length > 20) console.log(`     req: ${p.reqBody.substring(0, 200).replace(/\n/g, ' ')}`);
    });
  }
}

(async () => {
  console.log('🔬 Flow 관찰자 모드 시작');
  console.log(`출력: ${OUT_FILE}\n`);

  const { chromium } = await import('playwright') as any;
  const profileDir = path.join(os.homedir(), '.blogger-gpt', 'imagefx-profile');

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
      args: ['--no-first-run'],
      ignoreDefaultArgs: ['--enable-automation'],
      channel: 'msedge',
    });
  }

  const page = ctx.pages()[0] || await ctx.newPage();

  page.on('request', (req: any) => {
    const url = req.url();
    if (!isInteresting(url)) return;
    const method = req.method();
    if (method === 'OPTIONS') return;
    let body: string | null = null;
    try { body = req.postData(); } catch { /* ignore */ }
    const entry: CapturedExchange = {
      t: new Date().toISOString(),
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
    if (method === 'POST') console.log(`📤 POST ${url.substring(0, 120)}`);
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
        entry.resBody = buf.toString('utf-8').substring(0, 30720);
      } else if (buf.length < 500) {
        entry.resBody = buf.toString('utf-8').substring(0, 500);
      } else {
        entry.resBody = `<binary ${buf.length} bytes>`;
      }
    } catch { entry.resBody = '<unreadable>'; }
    if (req.method() === 'POST') console.log(`📥 ${res.status()} ${url.substring(0, 120)}`);
  });

  // Flow 앱 직접 이동 (Pro/Ultra 로그인된 경우 New project 버튼이 보여야 함)
  console.log('🌐 labs.google/fx/tools/flow 로 이동...\n');
  try {
    await page.goto('https://labs.google/fx/tools/flow', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch { /* ignore */ }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🖱️  지금부터 10분간 모든 네트워크 요청이 캡처됩니다.');
  console.log('');
  console.log('   사용자 할 일:');
  console.log('   1. 브라우저에서 평소처럼 Flow 앱 진입 (북마크/URL 입력/Google 검색 뭐든)');
  console.log('   2. 새 프로젝트 생성 → 이미지 생성기 진입');
  console.log('   3. 프롬프트 입력 후 Nano Banana Pro로 이미지 1장 생성');
  console.log('   4. 이미지 완성되면 그대로 둬도 됩니다 (10분 후 자동 종료)');
  console.log('');
  console.log('   터미널에 📤/📥 찍히는 게 실시간 캡처 로그입니다.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 10분 대기
  const DURATION_MS = 10 * 60 * 1000;
  await new Promise<void>((resolve) => {
    const to = setTimeout(() => resolve(), DURATION_MS);
    process.on('SIGINT', () => { clearTimeout(to); resolve(); });
    process.on('SIGTERM', () => { clearTimeout(to); resolve(); });
    // 브라우저 닫힘 감지
    page.on('close', () => { clearTimeout(to); resolve(); });
    ctx.on('close', () => { clearTimeout(to); resolve(); });
  });

  save();
  console.log('\n브라우저 닫는 중...');
  await ctx.close().catch(() => {});
  process.exit(0);
})();
