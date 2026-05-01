#!/usr/bin/env node
// dry-run-url-image-crawler.js
// URL 이미지 크롤러 모듈 실제 호출 검증 (Puppeteer/외부 API 없음 — 순수 로직만)

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const FAILED = [];
const PASSED = [];
function expect(label, cond, detail = '') {
  if (cond) { PASSED.push(label); console.log(`  ✅ ${label}`); }
  else { FAILED.push({ label, detail }); console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

(async function main() {
  console.log('🧪 URL 이미지 크롤러 dry-run');

  // ① visionRouter
  console.log('\n[① visionRouter — 글 생성 AI → vision 라우팅]');
  const { routeTextToVision, VISION_MODELS } = require(path.join(ROOT, 'dist/core/url-image-crawler/visionRouter.js'));

  const r1 = routeTextToVision('claude-sonnet');
  expect('claude-sonnet → vendor=claude, fellBack=false', r1.vendor === 'claude' && !r1.fellBack);

  const r2 = routeTextToVision('perplexity-sonar');
  expect('perplexity → Gemini Flash 폴백 (fellBack=true)', r2.fellBack === true && r2.vendor === 'gemini');
  expect('perplexity 폴백 사유 명시', !!r2.reason);

  const r3 = routeTextToVision('gemini-2.5-flash-lite');
  expect('Lite → Flash 자동 폴백', r3.fellBack === true && r3.model === VISION_MODELS.GEMINI_FLASH);

  const r4 = routeTextToVision('openai-gpt41');
  expect('openai-gpt41 → vendor=openai, model=gpt-4.1', r4.vendor === 'openai' && r4.model === 'gpt-4.1');

  const r5 = routeTextToVision('unknown-model');
  expect('미지원 모델 → Gemini Flash 기본 폴백', r5.fellBack === true);

  // ② visionBudgetGuard
  console.log('\n[② visionBudgetGuard — ₩500/₩1500 임계]');
  const { resetVisionBudget, getVisionBudget, chargeAndCheck } = require(path.join(ROOT, 'dist/core/url-image-crawler/visionBudgetGuard.js'));

  resetVisionBudget();
  expect('초기 누적 0', getVisionBudget().krw === 0);

  const claudeRoute = { provider: 'claude-sonnet', model: 'x', vendor: 'claude', fellBack: false };
  for (let i = 0; i < 8; i++) chargeAndCheck(claudeRoute);
  // 8회 × ₩60 = ₩480 → 경고 미발동
  const after8 = chargeAndCheck(claudeRoute);
  // 9회 × ₩60 = ₩540 → 경고 임계 ₩500 초과
  expect('9회 누적 시 경고 발동 (₩540 ≥ ₩500)', !!after8.warning && after8.proceed === true);

  resetVisionBudget();
  const proRoute = { provider: 'gemini-pro', model: 'x', vendor: 'gemini', fellBack: false };
  // gemini-pro: ₩400/회 × 4 = ₩1600 → 차단
  let blocked = null;
  for (let i = 0; i < 4; i++) {
    const r = chargeAndCheck(proRoute);
    if (r.blocked) { blocked = r; break; }
  }
  expect('Pro 4회 누적 시 차단 (₩1600 ≥ ₩1500)', !!blocked && blocked.proceed === false && blocked.blocked === true);

  // ③ imageRelevanceScorer (parseScoreJson만 dry — 외부 API 호출 없음)
  console.log('\n[③ imageRelevanceScorer — parseScoreJson + detectMimeType + filterImagesByRelevance(disabled)]');
  const { parseScoreJson, detectMimeType, filterImagesByRelevance } = require(path.join(ROOT, 'dist/core/url-image-crawler/imageRelevanceScorer.js'));

  expect('정상 JSON 파싱', parseScoreJson('{"score":85,"reason":"맞음"}').score === 85);
  expect('숫자 폴백 파싱', parseScoreJson('관련성 점수 70').score === 70);
  expect('완전 실패 → 50 중립', parseScoreJson('!!!').score === 50);

  // 100점 초과 클램프
  expect('100 초과 → 100 클램프', parseScoreJson('{"score":150,"reason":"x"}').score === 100);
  expect('음수 → 0 클램프', parseScoreJson('{"score":-10,"reason":"x"}').score === 0);

  // 이미지 시그니처
  expect('JPEG 시그니처', detectMimeType(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])) === 'image/jpeg');
  expect('PNG 시그니처', detectMimeType(Buffer.from([0x89, 0x50, 0x4E, 0x47])) === 'image/png');
  expect('GIF 시그니처', detectMimeType(Buffer.from([0x47, 0x49, 0x46, 0x38])) === 'image/gif');

  // enabled=false 시 패스스루
  const passthrough = await filterImagesByRelevance(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 'h', 'k', {
    enabled: false, textGenerator: 'gemini-2.5-flash', apiKeys: {}
  });
  expect('enabled=false 시 입력 그대로 반환', passthrough.filtered.length === 2 && passthrough.scores.length === 0);

  // 키 없을 때 검증 스킵
  const noKey = await filterImagesByRelevance(['https://a.com/1.jpg'], 'h', 'k', {
    enabled: true, textGenerator: 'claude-sonnet', apiKeys: {}
  });
  expect('API 키 없으면 검증 스킵 + 라우팅 정보 반환', noKey.filtered.length === 1 && !!noKey.routing);

  // ④ urlImageCrawler — crawlAndCollect URL 가드
  console.log('\n[④ crawlAndCollect — 잘못된 URL 가드]');
  const { crawlAndCollect } = require(path.join(ROOT, 'dist/core/url-image-crawler/index.js'));

  const bad1 = await crawlAndCollect({
    url: '', postTitle: 't', mainKeyword: 'k', downloadsBase: '/tmp', projectName: 'P'
  });
  expect('빈 URL → ok=false + 에러 메시지', !bad1.ok && !!bad1.error);

  const bad2 = await crawlAndCollect({
    url: 'ftp://example.com', postTitle: 't', mainKeyword: 'k', downloadsBase: '/tmp', projectName: 'P'
  });
  expect('비-HTTP 프로토콜 → 거부', !bad2.ok && bad2.error.includes('http'));

  // 결과 출력
  console.log('\n' + '═'.repeat(70));
  console.log(`✅ 통과: ${PASSED.length}`);
  console.log(`❌ 실패: ${FAILED.length}`);
  console.log('═'.repeat(70));

  if (FAILED.length > 0) {
    console.log('\n실패 항목:');
    FAILED.forEach(f => console.log(`   - ${f.label}${f.detail ? ' (' + f.detail + ')' : ''}`));
    process.exit(1);
  }
  console.log('\n🎉 URL 이미지 크롤러 모듈 정상 동작 검증 완료');
})().catch(err => {
  console.error('\n💥 dry-run 실패:', err);
  process.exit(2);
});
