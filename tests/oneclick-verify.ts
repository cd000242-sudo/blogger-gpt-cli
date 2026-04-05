/**
 * tests/oneclick-verify.ts
 * 원클릭세팅 Playwright 검증 스크립트
 *
 * 실행: npx ts-node tests/oneclick-verify.ts
 *
 * 각 Step의 셀렉터가 실제 외부 사이트에서 존재하는지 검증.
 * 실제 로그인/생성은 하지 않고, 페이지 로딩 + 셀렉터 존재 여부만 체크.
 */

import { chromium, Browser, Page } from 'playwright';

interface TestResult {
  step: string;
  url: string;
  checks: { selector: string; found: boolean; description: string }[];
  passed: boolean;
}

const results: TestResult[] = [];
let browser: Browser;
let page: Page;

async function checkSelector(page: Page, selector: string, description: string, timeout = 5000): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function runTest(step: string, url: string, checks: { selector: string; desc: string }[]): Promise<TestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 ${step}`);
  console.log(`   URL: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
  } catch (e: any) {
    console.log(`   ❌ 페이지 로드 실패: ${e.message}`);
    const result: TestResult = {
      step, url,
      checks: checks.map(c => ({ selector: c.selector, found: false, description: c.desc })),
      passed: false
    };
    results.push(result);
    return result;
  }

  const checkResults: TestResult['checks'] = [];

  for (const check of checks) {
    const found = await checkSelector(page, check.selector, check.desc);
    const emoji = found ? '✅' : '❌';
    console.log(`   ${emoji} ${check.desc}: ${check.selector.substring(0, 60)}`);
    checkResults.push({ selector: check.selector, found, description: check.desc });
  }

  const passed = checkResults.filter(c => c.found).length >= Math.ceil(checkResults.length * 0.5);
  const result: TestResult = { step, url, checks: checkResults, passed };
  results.push(result);
  return result;
}

async function main() {
  console.log('🚀 원클릭세팅 셀렉터 검증 시작\n');
  console.log('⚠️  로그인이 필요한 사이트는 셀렉터 검증이 제한됩니다.');
  console.log('    로그인 페이지의 셀렉터만 검증합니다.\n');

  browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  page = await context.newPage();

  // ═══════════════════════════════════════════════
  // 1. Blogger 로그인 페이지
  // ═══════════════════════════════════════════════
  await runTest('Blogger 로그인 페이지', 'https://www.blogger.com/', [
    { selector: 'a[href*="accounts.google.com"], input[type="email"]', desc: 'Google 로그인 리다이렉트/입력' },
  ]);

  // ═══════════════════════════════════════════════
  // 2. Google Search Console
  // ═══════════════════════════════════════════════
  await runTest('Google Search Console - Welcome', 'https://search.google.com/search-console/welcome', [
    { selector: 'div:has-text("URL 접두어"), div:has-text("URL prefix")', desc: 'URL 접두어 패널' },
    { selector: 'input[placeholder="https://www.example.com"], input[placeholder*="example.com"]', desc: 'URL 입력 필드' },
  ]);

  // ═══════════════════════════════════════════════
  // 3. Naver Search Advisor
  // ═══════════════════════════════════════════════
  await runTest('Naver Search Advisor', 'https://searchadvisor.naver.com/', [
    { selector: 'a:has-text("로그인"), .login_area a', desc: '로그인 버튼' },
  ]);

  await runTest('Naver Search Advisor - Board', 'https://searchadvisor.naver.com/console/board', [
    { selector: 'input[placeholder*="사이트"], input[type="url"]', desc: '사이트 추가 입력' },
  ]);

  // ═══════════════════════════════════════════════
  // 4. Daum Webmaster
  // ═══════════════════════════════════════════════
  await runTest('Daum Webmaster - PIN 발급', 'https://webmaster.daum.net/join', [
    { selector: 'input[placeholder="사이트 URL"]', desc: '사이트 URL 입력' },
    { selector: 'input[placeholder*="PIN"]', desc: 'PIN코드 입력' },
    { selector: 'input[type="checkbox"]', desc: '이용동의 체크박스' },
    { selector: 'button:has-text("확인")', desc: '확인 버튼' },
  ]);

  await runTest('Daum Webmaster - 인증', 'https://webmaster.daum.net/', [
    { selector: 'input[placeholder="사이트 URL"]', desc: '사이트 URL 입력' },
    { selector: 'button:has-text("인증하기")', desc: '인증하기 버튼' },
  ]);

  // ═══════════════════════════════════════════════
  // 5. Bing Webmaster
  // ═══════════════════════════════════════════════
  await runTest('Bing Webmaster', 'https://www.bing.com/webmasters', [
    { selector: 'button.signInButton, button:has-text("Sign In")', desc: 'Sign In 버튼' },
  ]);

  // ═══════════════════════════════════════════════
  // 6. ZUM Webmaster
  // ═══════════════════════════════════════════════
  await runTest('ZUM Webmaster', 'https://webmaster.zum.com/', [
    { selector: 'a:has-text("로그인"), .login, a:has-text("Sign")', desc: '로그인 버튼' },
  ]);

  // ═══════════════════════════════════════════════
  // 7. Cloudways
  // ═══════════════════════════════════════════════
  await runTest('Cloudways 로그인', 'https://unified.cloudways.com/', [
    { selector: 'input[type="email"], input[name="email"]', desc: '이메일 입력' },
    { selector: 'input[type="password"]', desc: '비밀번호 입력' },
    { selector: 'button[type="submit"], button:has-text("Login"), button:has-text("Sign")', desc: '로그인 버튼' },
  ]);

  // ═══════════════════════════════════════════════
  // 8. WordPress 로그인 (example — 실제 사이트 필요)
  // ═══════════════════════════════════════════════
  // WordPress는 사용자별 URL이 다르므로 기본 패턴만 검증
  console.log('\n⚠️  WordPress는 사용자 사이트별 URL이므로 자동 검증 불가 (수동 확인)');

  // ═══════════════════════════════════════════════
  // 결과 요약
  // ═══════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('📊 검증 결과 요약\n');

  let totalChecks = 0;
  let passedChecks = 0;
  let totalSteps = 0;
  let passedSteps = 0;

  for (const result of results) {
    totalSteps++;
    if (result.passed) passedSteps++;

    const stepEmoji = result.passed ? '✅' : '❌';
    const found = result.checks.filter(c => c.found).length;
    const total = result.checks.length;
    totalChecks += total;
    passedChecks += found;

    console.log(`${stepEmoji} ${result.step}: ${found}/${total} 셀렉터 발견`);

    for (const check of result.checks) {
      if (!check.found) {
        console.log(`   ❌ 미발견: ${check.description}`);
      }
    }
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`📊 총 ${totalSteps}개 Step, ${passedSteps}개 통과`);
  console.log(`📊 총 ${totalChecks}개 셀렉터, ${passedChecks}개 발견 (${Math.round(passedChecks / totalChecks * 100)}%)`);

  if (passedChecks < totalChecks) {
    console.log('\n⚠️  발견되지 않은 셀렉터가 있습니다.');
    console.log('   → 로그인이 필요한 사이트일 수 있습니다.');
    console.log('   → 외부 사이트 UI가 변경되었을 수 있습니다.');
    console.log('   → config/selectors.ts 업데이트가 필요할 수 있습니다.');
  }

  await browser.close();
  console.log('\n✅ 검증 완료');
}

main().catch(e => {
  console.error('검증 오류:', e);
  browser?.close();
  process.exit(1);
});
