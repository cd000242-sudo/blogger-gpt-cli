// scripts/dropshot-verify.js
// Dropshot 이미지 생성 검증 — probe로 저장된 profile 재사용해서 자동 호출.
//
// 흐름:
//   1. 같은 profile로 visible 브라우저 띄움 (사용자 로그인 유지)
//   2. https://aistudio.dropshot.io 페이지 로드
//   3. POST /v1/job/google/nano-banana-pro 직접 호출 (page.evaluate)
//   4. 응답 본문 그대로 출력 — Pattern A/B/C 파악
//   5. Pattern B면 job polling까지 + dataUrl 추출
//   6. 결과 PNG로 저장 → ./dropshot-test-result.png

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const HOME_URL = 'https://aistudio.dropshot.io';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');
const OUTPUT_IMG = path.resolve(__dirname, '..', 'dropshot-test-result.png');
const OUTPUT_LOG = path.resolve(__dirname, '..', 'dropshot-test-log.json');

async function loadChromium() {
  try { return (await import('patchright')).chromium; }
  catch { return (await import('playwright')).chromium; }
}

(async () => {
  const chromium = await loadChromium();
  const launchOpts = {
    headless: false,
    args: [
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--lang=ko-KR,ko',
      '--window-size=1280,900',
    ],
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; } catch { return 'Asia/Seoul'; } })(),
    ignoreDefaultArgs: ['--enable-automation'],
  };

  let context;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const opts = channel ? { ...launchOpts, channel } : launchOpts;
      context = await chromium.launchPersistentContext(PROFILE_DIR, opts);
      console.log(`[verify] ✅ browser launched (channel=${channel || 'bundled'})`);
      break;
    } catch (e) { /* next */ }
  }
  if (!context) { console.error('[verify] ❌ 브라우저 실행 실패'); process.exit(1); }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
  });

  const page = context.pages()[0] || await context.newPage();

  // 모든 응답 캡처 — fine-tune용
  const allResponses = [];
  page.on('response', async (res) => {
    try {
      const url = res.request().url();
      const rt = res.request().resourceType();
      if (rt !== 'xhr' && rt !== 'fetch') return;
      if (!url.includes('dropshot.io')) return;
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      let body = null;
      try {
        if (ct.includes('json') || ct.includes('text')) {
          const t = await res.text();
          body = t.length > 6000 ? t.slice(0, 6000) + '...[TRUNC]' : t;
        } else { body = `[${ct}]`; }
      } catch { body = '[READ_ERR]'; }
      allResponses.push({
        ts: new Date().toISOString(),
        method: res.request().method(),
        url: url.replace(/^https:\/\/[^/]+/, ''),
        status: res.status(),
        body,
      });
    } catch { /* ignore */ }
  });

  console.log('[verify] 🌐 navigating to', HOME_URL);
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));

  // 로그인 상태 확인 — localStorage Firebase 토큰 추출 시도
  const authInfo = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const firebaseKeys = keys.filter(k => k.includes('firebase') || k.includes('authUser'));
    const out = {};
    for (const k of firebaseKeys) {
      const v = localStorage.getItem(k);
      out[k] = v && v.length > 500 ? v.slice(0, 500) + '...[TRUNC]' : v;
    }
    return { firebaseKeys, sample: out, ck: document.cookie };
  });
  console.log('[verify] 🔑 auth info:', JSON.stringify(authInfo, null, 2).slice(0, 1500));

  // ───────────────────────────────────────────────────
  // 🔥 실제 이미지 생성 호출
  // ───────────────────────────────────────────────────
  console.log('[verify] 🍌 calling POST /v1/job/google/nano-banana-pro ...');

  const genResult = await page.evaluate(async () => {
    const log = [];

    // 1차 시도: 그냥 brand-new 호출 (Body는 dropshot UI 호출 본 후 추측 — Pattern B 가정)
    //   probe에서 본 250B body 추측: { prompt, modelName, aspectRatio }
    //   실패 시 자동 fine-tune
    try {
      const candidatePayloads = [
        // 시도 1 — 표준 추측
        {
          prompt: '귀여운 노란 고양이가 노트북을 보고 있는 사실적인 사진',
          aspectRatio: '16:9',
        },
        // 시도 2 — 다른 키 이름
        {
          input: { prompt: '귀여운 노란 고양이가 노트북을 보고 있는 사실적인 사진' },
          aspectRatio: '16:9',
        },
        // 시도 3 — 더 풍부
        {
          prompt: '귀여운 노란 고양이가 노트북을 보고 있는 사실적인 사진',
          modelName: 'google/nano-banana-pro',
          aspectRatio: '16:9',
          count: 1,
        },
      ];

      for (let i = 0; i < candidatePayloads.length; i++) {
        const payload = candidatePayloads[i];
        log.push(`[try ${i+1}] payload: ${JSON.stringify(payload).slice(0, 200)}`);
        const res = await fetch('/v1/job/google%2Fnano-banana-pro', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        log.push(`[try ${i+1}] status=${res.status} body=${text.slice(0, 500)}`);

        if (res.ok) {
          let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
          return { ok: true, attempt: i+1, payload, status: res.status, data, log };
        }
        // 401/403 → 인증 문제, 다른 페이로드 시도 무의미
        if (res.status === 401 || res.status === 403) {
          return { ok: false, status: res.status, body: text.slice(0, 1000), log };
        }
        // 400 → 페이로드 형식 문제, 다음 시도
        if (res.status === 400 || res.status === 422) {
          continue;
        }
        // 그 외 status (404, 500, ...) → 즉시 반환
        return { ok: false, status: res.status, body: text.slice(0, 1000), log };
      }
      return { ok: false, error: 'all_payloads_failed', log };
    } catch (e) {
      return { ok: false, error: e.message, log };
    }
  });

  console.log('[verify] 🍌 generation response:');
  console.log(JSON.stringify(genResult, null, 2).slice(0, 4000));

  // 결과 분석
  if (genResult.ok) {
    console.log('[verify] ✅ POST 성공 (Pattern 파악 필요)');
    console.log('  → 다음 단계: Pattern A/B/C 식별 후 polling 또는 직접 사용');

    // Pattern 자동 식별
    const data = genResult.data;
    if (data && typeof data === 'object') {
      const hasJobId = data.jobId || data.id || data.taskId || data.uid;
      const hasImage = data.image || data.imageUrl || data.url || data.base64 || data.dataUrl;
      const hasStatus = data.status;

      if (hasImage) {
        console.log('[verify] 🎉 Pattern A 추정 — 즉시 응답에 이미지 포함');
      } else if (hasJobId) {
        console.log(`[verify] 🔄 Pattern B 추정 — Job ID = ${hasJobId}, polling 필요`);
        // 30초 polling 시도
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const polled = await page.evaluate(async (jid) => {
            const r = await fetch(`/v1/job/${jid}`, { credentials: 'include' });
            const t = await r.text();
            return { status: r.status, body: t.slice(0, 2000) };
          }, hasJobId);
          console.log(`[poll ${i+1}] ${polled.status} ${polled.body.slice(0, 200)}`);
          let pdata; try { pdata = JSON.parse(polled.body); } catch { pdata = null; }
          if (pdata?.status === 'done' || pdata?.status === 'completed' || pdata?.status === 'success' || pdata?.imageUrl || pdata?.image) {
            console.log('[verify] 🎉 polling 완료!');
            console.log(JSON.stringify(pdata, null, 2).slice(0, 2000));
            break;
          }
          if (pdata?.status === 'failed' || pdata?.status === 'error') {
            console.log('[verify] ❌ job failed');
            break;
          }
        }
      } else {
        console.log('[verify] ⚠️ Pattern 식별 실패 — 응답 구조 확인 필요');
      }
    }
  } else {
    console.log(`[verify] ❌ POST 실패 status=${genResult.status} error=${genResult.error || 'unknown'}`);
    console.log('  body:', genResult.body || JSON.stringify(genResult).slice(0, 500));
  }

  // 로그 저장
  fs.writeFileSync(OUTPUT_LOG, JSON.stringify({
    capturedAt: new Date().toISOString(),
    authInfo,
    genResult,
    allResponses: allResponses.slice(-40), // 마지막 40개
  }, null, 2));
  console.log(`[verify] 💾 log → ${OUTPUT_LOG}`);

  await new Promise(r => setTimeout(r, 2000));
  await context.close();
  process.exit(0);
})().catch(e => {
  console.error('[verify] FATAL:', e);
  process.exit(1);
});
