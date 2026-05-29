// scripts/dropshot-verify9.js — GET 진단 + body 다양화

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');

async function loadChromium() {
  try { return (await import('patchright')).chromium; }
  catch { return (await import('playwright')).chromium; }
}

function pushId() {
  const C = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  const now = Date.now(); let n = now; const arr = [];
  for (let i = 7; i >= 0; i--) { arr[i] = C.charAt(n % 64); n = Math.floor(n / 64); }
  let id = arr.join('');
  for (let i = 0; i < 12; i++) id += C.charAt(Math.floor(Math.random() * 64));
  return id;
}

(async () => {
  const chromium = await loadChromium();
  const opts = {
    headless: false,
    args: ['--no-first-run', '--disable-blink-features=AutomationControlled', '--no-sandbox', '--lang=ko-KR,ko'],
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    ignoreDefaultArgs: ['--enable-automation'],
  };
  let context;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { const o = channel ? { ...opts, channel } : opts; context = await chromium.launchPersistentContext(PROFILE_DIR, o); break; } catch {}
  }
  const page = context.pages()[0] || await context.newPage();
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));
  const cookies = await context.cookies();
  await context.close();

  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const headers = {
    'accept': '*/*',
    'accept-language': 'ko-KR',
    'content-type': 'application/json',
    'origin': 'https://aistudio.dropshot.io',
    'referer': 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'cookie': cookieStr,
    'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };

  console.log(`[v9] cookie ${cookies.length}개`);

  // ─── 1단계: GET 진단 — cookie 인증 통과 확인 ───
  console.log('[v9] 🔍 GET 진단 — cookie 인증 통과 여부');
  const diagUrls = [
    'https://api.aistudio.dropshot.io/v1/avatar?lang=ko&count=1',
    'https://api.aistudio.dropshot.io/v1/credit?lang=en',
    'https://api.aistudio.dropshot.io/v1/zero-credit-cost-model/subscriber',
    'https://api-prod.stock.dropshot.io/v1/user/subscription?lang=ko',
  ];
  for (const u of diagUrls) {
    try {
      const r = await fetch(u, { method: 'GET', headers });
      const t = await r.text();
      console.log(`  ${r.status} ${u}`);
      console.log(`    body: ${t.slice(0, 200)}`);
    } catch (e) {
      console.log(`  ERR ${u}: ${e.message}`);
    }
  }

  // ─── 2단계: body 다양화 POST ───
  console.log('\n[v9] 🍌 POST body 다양화');
  const variants = [
    {
      name: 'A_unlimited_match',
      body: { prompt: '귀여운 노란 고양이가 햇살 비치는 창가에 앉아있는 사실적인 사진', modelName: 'google/nano-banana-pro', isUnlimited: true, aspect_ratio: 'match_input_image', resolution: '2K', messageId: pushId(), boardId: pushId() },
    },
    {
      name: 'B_unlimited_1to1',
      body: { prompt: '귀여운 노란 고양이가 햇살 비치는 창가에 앉아있는 사실적인 사진', modelName: 'google/nano-banana-pro', isUnlimited: true, aspect_ratio: '1:1', resolution: '2K', messageId: pushId(), boardId: pushId() },
    },
    {
      name: 'C_NOT_unlimited',
      body: { prompt: '귀여운 노란 고양이가 햇살 비치는 창가에 앉아있는 사실적인 사진', modelName: 'google/nano-banana-pro', isUnlimited: false, aspect_ratio: '1:1', resolution: '2K', messageId: pushId(), boardId: pushId() },
    },
    {
      name: 'D_no_resolution',
      body: { prompt: '귀여운 노란 고양이가 햇살 비치는 창가에 앉아있는 사실적인 사진', modelName: 'google/nano-banana-pro', isUnlimited: false, aspect_ratio: '1:1', messageId: pushId(), boardId: pushId() },
    },
    {
      name: 'E_1K',
      body: { prompt: '귀여운 노란 고양이가 햇살 비치는 창가에 앉아있는 사실적인 사진', modelName: 'google/nano-banana-pro', isUnlimited: false, aspect_ratio: '1:1', resolution: '1K', messageId: pushId(), boardId: pushId() },
    },
    {
      name: 'F_referenceImageList_empty',
      body: { prompt: '귀여운 노란 고양이가 햇살 비치는 창가에 앉아있는 사실적인 사진', modelName: 'google/nano-banana-pro', isUnlimited: false, aspect_ratio: '1:1', resolution: '2K', referenceImageList: [], messageId: pushId(), boardId: pushId() },
    },
  ];

  for (const v of variants) {
    try {
      const r = await fetch('https://api.aistudio.dropshot.io/v1/job/google%2Fnano-banana-pro', {
        method: 'POST',
        headers,
        body: JSON.stringify(v.body),
      });
      const t = await r.text();
      console.log(`\n  [${v.name}] status=${r.status}`);
      console.log(`    body: ${t.slice(0, 400)}`);
      if (r.ok) {
        console.log(`    🎉 성공! 다음 단계 진행.`);
        let d; try { d = JSON.parse(t); } catch { d = null; }
        if (d?.id) {
          // 결과 polling
          console.log(`    🔥 polling jobId=${d.id}`);
          for (let i = 0; i < 30; i++) {
            await new Promise(r2 => setTimeout(r2, 2000));
            const pUrls = [
              `https://api.aistudio.dropshot.io/v1/job/${d.id}`,
              `https://api.aistudio.dropshot.io/v1/message/${v.body.messageId}`,
              `https://api.aistudio.dropshot.io/v1/board/${v.body.boardId}/message/${v.body.messageId}`,
              `https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app/jobs/${d.id}.json`,
              `https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app/messages/${v.body.messageId}.json`,
            ];
            for (const pu of pUrls) {
              try {
                const pr = await fetch(pu, { method: 'GET', headers });
                if (pr.status === 404 || pr.status === 401) continue;
                const pt = await pr.text();
                if (pr.ok && (pt.includes('imageUrl') || pt.includes('"image":"') || pt.includes('base64'))) {
                  console.log(`    🎉🎉 결과: ${pu}`);
                  console.log(`      body: ${pt.slice(0, 1500)}`);
                  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-v9-WIN.json'), JSON.stringify({ payload: v, postResp: t, pollUrl: pu, finalBody: pt }, null, 2));
                  process.exit(0);
                }
                if (i % 5 === 4) console.log(`      poll ${i+1}: ${pr.status} ${pu.slice(0, 80)} body: ${pt.slice(0, 80)}`);
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.log(`  [${v.name}] ERR: ${e.message}`);
    }
  }

  process.exit(0);
})();
