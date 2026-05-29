// scripts/dropshot-batch-test.js — dispatcher 경유 3장 연속 생성 검증
//   - 세션 재사용 (1회만 ensurePage 호출 → 2/3번째는 캐시 적중)
//   - 각 시도별 소요 시간 측정
//   - 결과 PNG 3개 저장

const path = require('node:path');
const fs = require('node:fs');

const PROMPTS = [
  '귀여운 노란 고양이가 햇살 비치는 창가에서 잠자는 사실적인 사진',
  '오로라가 빛나는 밤하늘 아래 한적한 호숫가의 통나무집, 시네마틱',
  '서울 강남의 미래도시 풍경, 네온사인과 비, 사이버펑크',
];

(async () => {
  console.log('[batch] dropshot 3장 연속 생성 검증 시작');
  console.log('=========================================\n');

  const { dispatchH2ImageGeneration } = require('../dist/core/imageDispatcher');

  const results = [];
  const totalStart = Date.now();

  for (let i = 0; i < PROMPTS.length; i++) {
    const prompt = PROMPTS[i];
    console.log(`\n━━━ [${i+1}/${PROMPTS.length}] ${prompt} ━━━`);
    const t0 = Date.now();

    try {
      const r = await dispatchH2ImageGeneration(
        'dropshot-nanobanana-pro',
        prompt,
        prompt, // keyword == prompt (batch)
        (msg) => console.log(`  📢 ${msg}`),
        undefined,
        {},
      );
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      if (r.ok && r.dataUrl) {
        const matched = /^data:image\/(\w+);base64,(.+)$/.exec(r.dataUrl);
        if (matched) {
          const ext = matched[1];
          const buf = Buffer.from(matched[2], 'base64');
          const out = path.resolve(__dirname, '..', `dropshot-batch-${i+1}.${ext}`);
          fs.writeFileSync(out, buf);
          console.log(`  ✅ ${elapsed}s — saved ${out} (${Math.round(buf.length/1024)}KB)`);
          results.push({ i: i+1, ok: true, elapsed: parseFloat(elapsed), size: buf.length, source: r.source });
        } else {
          console.log(`  ⚠️  ${elapsed}s — dataUrl 형식 비정상 (length=${r.dataUrl.length})`);
          results.push({ i: i+1, ok: false, elapsed: parseFloat(elapsed), error: 'dataUrl-format' });
        }
      } else {
        console.log(`  ❌ ${elapsed}s — 실패: ${r.error}`);
        results.push({ i: i+1, ok: false, elapsed: parseFloat(elapsed), error: r.error });
      }
    } catch (e) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  💥 ${elapsed}s — 예외: ${e.message}`);
      results.push({ i: i+1, ok: false, elapsed: parseFloat(elapsed), error: e.message });
    }
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);

  console.log('\n=========================================');
  console.log(`📊 결과 요약 (총 ${totalElapsed}s)`);
  console.log('=========================================');
  for (const r of results) {
    const status = r.ok ? '✅' : '❌';
    console.log(`  [${r.i}] ${status}  ${r.elapsed}s  ${r.ok ? `${Math.round(r.size/1024)}KB ${r.source}` : r.error}`);
  }
  const ok = results.filter(r => r.ok).length;
  console.log(`\n→ ${ok}/${results.length} 성공`);

  // 세션 재사용 검증: 2번째/3번째가 1번째보다 빨라야 함 (브라우저 launch + 로그인 캐시)
  if (results.length >= 2 && results[0].ok && results[1].ok) {
    const speedup = ((results[0].elapsed - results[1].elapsed) / results[0].elapsed * 100).toFixed(0);
    console.log(`\n🚀 세션 재사용 효과: 1번째 vs 2번째 → ${speedup}% 단축`);
  }

  process.exit(ok === results.length ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
