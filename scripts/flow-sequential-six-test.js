const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { makeFlowImage } = require('../dist/core/flowGenerator');
const { cleanupImageFx } = require('../dist/core/imageFxGenerator');

const outDir = path.resolve(__dirname, '..', 'test-output', 'flow-six');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const prompts = [
  'Premium Korean blog thumbnail, calm blue and mint editorial design, a modern desk with laptop and analytics dashboard, no text overlay, 16:9.',
  'Premium Korean blog thumbnail, warm natural office light, checklist and notebook on a wooden desk, no text overlay, 16:9.',
  'Premium Korean blog thumbnail, clean financial planning scene, smartphone and documents arranged neatly, no text overlay, 16:9.',
  'Premium Korean blog thumbnail, travel preparation flat lay with passport, map, and coffee, no text overlay, 16:9.',
  'Premium Korean blog thumbnail, modern SEO workflow dashboard on laptop, elegant teal accent, no text overlay, 16:9.',
  'Premium Korean blog thumbnail, content publishing calendar and progress board, soft green accent, no text overlay, 16:9.',
];

function saveDataUrl(dataUrl, index) {
  const match = /^data:image\/(\w+);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new Error(`Invalid data URL for item ${index}`);
  const ext = match[1].toLowerCase().replace('jpeg', 'jpg');
  const file = path.join(outDir, `flow-test-${String(index).padStart(2, '0')}.${ext}`);
  fs.writeFileSync(file, Buffer.from(match[2], 'base64'));
  return file;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const results = [];
  try {
    for (let i = 0; i < prompts.length; i++) {
      const n = i + 1;
      console.log(`\n[FLOW_TEST] ${n}/6 start`);
      const startedAt = Date.now();
      const result = await makeFlowImage(
        prompts[i],
        { aspectRatio: '16:9', isThumbnail: false },
        msg => console.log(`[FLOW_TEST] ${msg}`),
      );
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      if (!result.ok) {
        results.push({ index: n, ok: false, error: result.error, elapsedSec });
        console.error(`[FLOW_TEST] ${n}/6 failed after ${elapsedSec}s: ${result.error}`);
        process.exitCode = 1;
        break;
      }
      const file = saveDataUrl(result.dataUrl, n);
      results.push({ index: n, ok: true, file, source: result.modelUsed || result.source || 'Flow', elapsedSec });
      console.log(`[FLOW_TEST] ${n}/6 saved: ${file} (${elapsedSec}s)`);
      if (n < prompts.length) {
        console.log('[FLOW_TEST] wait 15s before next Flow job');
        await sleep(15000);
      }
    }
  } finally {
    await cleanupImageFx().catch(() => {});
  }

  const summaryFile = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2), 'utf8');
  console.log(`\n[FLOW_TEST] summary: ${summaryFile}`);
  setTimeout(() => process.exit(process.exitCode || 0), 500);
})();
