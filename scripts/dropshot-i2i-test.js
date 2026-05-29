// scripts/dropshot-i2i-test.js — i2i 실제 동작 smoke test
//   - sample 이미지 URL 1장을 reference로 dispatcher 호출
//   - i2i 모드로 표시되는지 + 결과 이미지 reference 영향 받았는지 확인

const path = require('node:path');
const fs = require('node:fs');

const REFERENCE_URL = 'https://cdn.aistudio.dropshot.io/public/images/avatar/img_yeji_1770614.png';
const PROMPT = '동일한 인물이 한복을 입고 한옥마을 배경에서 미소짓는 사진, 시네마틱';

(async () => {
  console.log('[i2i-test] 시작 — reference:', REFERENCE_URL);
  console.log('  prompt:', PROMPT);

  const { dispatchH2ImageGeneration } = require('../dist/core/imageDispatcher');

  const t0 = Date.now();
  const r = await dispatchH2ImageGeneration(
    'dropshot-nanobanana-pro',
    PROMPT,
    PROMPT,
    (msg) => console.log('  📢', msg),
    undefined,
    { referenceImageList: [REFERENCE_URL] },
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (r.ok && r.dataUrl) {
    const m = /^data:image\/(\w+);base64,(.+)$/.exec(r.dataUrl);
    if (m) {
      const ext = m[1];
      const buf = Buffer.from(m[2], 'base64');
      const out = path.resolve(__dirname, '..', `dropshot-i2i-test.${ext}`);
      fs.writeFileSync(out, buf);
      console.log(`\n✅ ${elapsed}s — saved ${out} (${Math.round(buf.length/1024)}KB)`);
      console.log(`   source: ${r.source}`);
      console.log(`   ${r.source && r.source.includes('i2i') ? '🎉 i2i 모드 확인됨!' : '⚠️ source에 i2i 표시 없음'}`);
      process.exit(0);
    }
  }
  console.log(`\n❌ ${elapsed}s — 실패: ${r.error}`);
  process.exit(1);
})();
