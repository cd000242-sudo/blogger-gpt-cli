const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const visualRoot = path.resolve(__dirname, '..');
const outDir = path.join(visualRoot, 'export', 'detail-9');

function toFileUrl(filePath) {
  return pathToFileURL(filePath).href;
}

function ensureCleanDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const file of fs.readdirSync(dir)) {
    if (file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.md')) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
}

async function main() {
  ensureCleanDir(outDir);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1700 }, deviceScaleFactor: 1 });

  try {
    await page.goto(toFileUrl(path.join(visualRoot, 'src', 'compact-9.html')), {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.addStyleTag({
      content: '* { animation: none !important; transition: none !important; scroll-behavior: auto !important; } body { background:#050914 !important; }',
    });

    const names = await page.$$eval('[data-kmong9]', (els) => els.map((el) => el.getAttribute('data-kmong9')));
    const exported = [];

    for (const [index, name] of names.entries()) {
      const fileName = `${String(index + 1).padStart(2, '0')}-${name.replace(/^\d+-/, '')}.png`;
      const outPath = path.join(outDir, fileName);
      await page.locator(`[data-kmong9="${name}"]`).screenshot({
        path: outPath,
        animations: 'disabled',
        timeout: 20000,
      });
      exported.push({ name, fileName, outPath });
    }

    const uploadOrder = [
      '# 크몽 9장 제한용 상세 이미지 업로드 순서',
      '',
      '메인 이미지는 기존 `export/main/00-main-image.png`를 사용하세요.',
      '',
      ...exported.map((item, index) => `${index + 1}. \`export/detail-9/${item.fileName}\``),
      '',
      '구성: 후킹 -> 문제/해결 -> 올인원 실제 화면 -> LEWORD -> 네이버 자동화 -> Blogspot/WP/외부유입 -> 거미줄 구조 -> 추천 대상/사용 흐름 -> 가격/주의/FAQ',
    ].join('\n');

    await fsp.writeFile(path.join(outDir, 'upload-order-9.md'), uploadOrder, 'utf8');

    console.log(JSON.stringify({
      ok: true,
      count: exported.length,
      outDir,
      files: exported.map((item) => item.fileName),
    }, null, 2));
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
