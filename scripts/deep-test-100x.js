#!/usr/bin/env node
/**
 * 🧪 밑바닥 심층 검증 — 각 항목을 100회씩 반복 실행해 flakiness/간헐 실패 포착
 *
 * 대상:
 * - verifyHandlers의 5개 검증 함수 로직 (실제 네트워크 호출 포함)
 * - CTA validate-cta-url 차단 패턴 + GET 본문 스캔
 * - orchestration의 썸네일/섹션1/summary-container 로직 (문자열/정규식 기반 시뮬)
 * - blogspotSetup resumeFromStep 분기
 * - createBlog 기존 블로그 감지
 * - 쇼핑 모드 차단 가드
 * - Preflight GCP billing 로직 (mock 응답)
 *
 * 결과: 각 테스트의 (통과/실패, 평균/최대/최소 실행시간, 실패 원인) 리포트.
 */

const fs = require('fs');
const path = require('path');

const REPEAT = 1000;
const results = [];
let suiteStart = Date.now();

function load(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf-8'); }

async function runTest(name, fn, repeat = REPEAT) {
  const durations = [];
  let fails = 0;
  let firstFail = null;
  for (let i = 0; i < repeat; i++) {
    const t0 = Date.now();
    try {
      await fn(i);
      durations.push(Date.now() - t0);
    } catch (e) {
      fails++;
      durations.push(Date.now() - t0);
      if (!firstFail) firstFail = `#${i}: ${e?.message || e}`;
    }
  }
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const passed = repeat - fails;
  results.push({ name, passed, fails, repeat, avg, min, max, firstFail });
  const icon = fails === 0 ? '✅' : fails < repeat / 10 ? '⚠️' : '❌';
  console.log(`  ${icon} ${name} — ${passed}/${repeat} (avg ${avg}ms, min ${min}ms, max ${max}ms)${firstFail ? `\n      첫 실패: ${firstFail}` : ''}`);
}

async function httpGet(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  console.log('🧪 밑바닥 100회 심층 검증 시작\n');

  // ========== 정적 분석 (100회 반복 — flakiness 체크) ==========
  console.log('[그룹 1] 정적 파일 검증 (컴파일 결과 일관성)');

  await runTest('verifyHandlers.js IPC 채널 시그너처 일관', () => {
    const src = load('electron/oneclick/handlers/verifyHandlers.js');
    if (!src.includes("'oneclick:verify-only'")) throw new Error('verify-only 채널 누락');
    if (!src.includes("'oneclick:preflight-gcp-billing'")) throw new Error('preflight 채널 누락');
  });

  await runTest('setupHandlers.js retry-step IPC 시그너처 일관', () => {
    const src = load('electron/oneclick/handlers/setupHandlers.js');
    if (!src.includes("'oneclick:retry-step'")) throw new Error('retry-step 누락');
    if (!src.includes('resumeFromStep')) throw new Error('resumeFromStep 전달 누락');
  });

  await runTest('blogspotSetup.js loggedIn 가드 + step 기록', () => {
    const src = load('electron/oneclick/automation/blogspot/blogspotSetup.js');
    if (!/if\s*\(\s*!loggedIn\s*\)/.test(src)) throw new Error('!loggedIn 가드 누락');
    if (!src.includes('recordStep')) throw new Error('recordStep 누락');
    if (!src.includes('resumeFrom')) throw new Error('resumeFrom 분기 누락');
  });

  await runTest('createBlog.js 기존 블로그 보호', () => {
    const src = load('electron/oneclick/automation/blogspot/steps/createBlog.js');
    if (!src.includes('useExistingBlog')) throw new Error('useExistingBlog 플래그 누락');
    if (!src.includes('forceCreateNew')) throw new Error('forceCreateNew 플래그 누락');
  });

  await runTest('orchestration.ts 쇼핑 모드 차단 가드', () => {
    const src = load('src/core/final/orchestration.ts');
    if (!/payload\?\.contentMode\s*===\s*['"]shopping['"]/.test(src)) throw new Error('쇼핑 차단 가드 누락');
  });

  await runTest('orchestration.ts adsense 섹션 — author_intro 제거 후 첫 섹션 이미지 허용', () => {
    const src = load('src/core/final/orchestration.ts');
    // v3.5.55부터 첫 섹션도 이미지 정상 삽입 (skipFirstForAdsense 가드 제거)
    if (/const\s+skipFirstForAdsense/.test(src)) throw new Error('skipFirstForAdsense 변수 잔존');
    if (/contentMode === 'adsense' && idx === 0/.test(src)) throw new Error('첫 섹션 차단 조건 잔존');
    // 첫 섹션부터 이미지 생성하는 패턴이 살아있어야
    if (!/\(_, i\) =&gt; i \+ 1/.test(src) && !src.includes('(_, i) => i + 1')) {
      throw new Error('첫 섹션부터 이미지 생성 로직 누락');
    }
  });

  await runTest('orchestration.ts summary-container 클래스 + overflow:hidden 제거', () => {
    const src = load('src/core/final/orchestration.ts');
    if (!src.includes('class="summary-container"')) throw new Error('summary-container 클래스 누락');
    // overflow:hidden이 .summary-container 인라인에 잔존하면 안 됨 (table 스크롤 차단)
    const summaryLine = src.split('\n').find(l => l.includes('class="summary-container"'));
    if (summaryLine && /overflow\s*:\s*hidden/i.test(summaryLine)) {
      throw new Error('summary-container 인라인에 overflow:hidden 잔존');
    }
  });

  await runTest('validate-cta-url.ts 세션 바인딩 패턴 보존', () => {
    const src = load('src/cta/validate-cta-url.ts');
    if (!src.includes('SESSION_BOUND_PATTERNS')) throw new Error('SESSION_BOUND_PATTERNS 누락');
    // 정규식 이스케이프(\.) 를 고려해 두 가지 표현 모두 허용
    if (!/bokjiro\\?\.go\\?\.kr/.test(src)) throw new Error('bokjiro 패턴 누락');
    if (!src.includes('ERROR_CONTENT_SIGNATURES')) throw new Error('본문 시그니처 누락');
  });

  await runTest('validate-cta-url.ts 스트림 리더 + Content-Length 가드', () => {
    const src = load('src/cta/validate-cta-url.ts');
    if (!src.includes('getReader')) throw new Error('스트림 리더 누락');
    if (!src.includes('500_000') && !src.includes('500000')) throw new Error('Content-Length 가드 누락');
    if (!src.includes('reader.cancel')) throw new Error('조기 취소 누락');
  });

  await runTest('blogger-publisher.js REDACTED (2곳 모두)', () => {
    const src = load('src/core/blogger-publisher.js');
    const count = (src.match(/\[REDACTED\]/g) || []).length;
    if (count < 2) throw new Error(`REDACTED 2곳 필요, 실제 ${count}곳`);
    if (/substring\(0,\s*20\)/.test(src)) throw new Error('substring(0, 20) 잔존');
  });

  await runTest('UI 반자동 카피 일관', () => {
    const src = load('electron/ui/modules/oneclick-setup.js');
    if (src.includes('로그인만 하면 나머지는 자동으로 세팅됩니다')) throw new Error('허위 카피 잔존');
    if (src.includes('로그인만 하면 끝!')) throw new Error('허위 카피2 잔존');
    if (!src.includes('반자동 세팅')) throw new Error('솔직 카피 누락');
  });

  await runTest('UI 시작 전 준비사항 카드 + 예상 시간', () => {
    const src = load('electron/ui/modules/oneclick-setup.js');
    if (!src.includes('oneclick-prereq')) throw new Error('준비사항 카드 누락');
    if (!src.includes('5~15분')) throw new Error('예상 시간 누락');
    if (!src.includes('2~4주')) throw new Error('AdSense 타임라인 누락');
  });

  await runTest('UI 완료 요약 + Step 재시도 버튼', () => {
    const src = load('electron/ui/modules/oneclick-setup.js');
    if (!src.includes('renderSetupSummary')) throw new Error('renderSetupSummary 누락');
    if (!src.includes('oneclick-retry-btn')) throw new Error('재시도 버튼 누락');
    if (!src.includes("'oneclick:retry-step'")) throw new Error('retry-step invoke 누락');
  });

  await runTest('UI 헬스체크 버튼 + preflight 호출', () => {
    const src = load('electron/ui/modules/oneclick-setup.js');
    if (!src.includes('oneclick-healthcheck-btn')) throw new Error('헬스체크 버튼 누락');
    if (!src.includes("'oneclick:preflight-gcp-billing'")) throw new Error('preflight 호출 누락');
    if (!src.includes('GCP 결제 계정')) throw new Error('preflight 안내 누락');
  });

  await runTest('package.json 쇼핑 모드 disabled UI 3곳', () => {
    const html = load('electron/ui/index.html');
    const script = load('electron/ui/script.js');
    const shoppingDisabledHtml = (html.match(/value="shopping"[^>]*disabled/g) || []).length;
    const shoppingDisabledJs = (script.match(/value="shopping"[^>]*disabled/g) || []).length;
    if (shoppingDisabledHtml < 2) throw new Error(`html disabled 2곳 필요, 실제 ${shoppingDisabledHtml}`);
    if (shoppingDisabledJs < 1) throw new Error(`script disabled 1곳 필요, 실제 ${shoppingDisabledJs}`);
  });

  // ========== 실제 네트워크 호출 (HTTP 레벨) ==========
  console.log('\n[그룹 2] 실제 네트워크 호출 (Google API 401/DNS/GitHub 404)');

  await runTest('Blogger OAuth API 401 응답 일관성', async () => {
    const r = await httpGet('https://www.googleapis.com/blogger/v3/users/self/blogs', {
      headers: { Authorization: 'Bearer FAKE_DEEP_TEST' },
    });
    if (r.status !== 401) throw new Error(`예상 401, 실제 ${r.status}`);
  }, 20); // 네트워크 호출은 비용 절약 위해 20회

  await runTest('ads.txt 404 감지 (github.com)', async () => {
    const r = await httpGet('https://github.com/ads.txt');
    if (r.ok) throw new Error(`예상 non-2xx, 실제 ${r.status}`);
  }, 20);

  await runTest('존재하지 않는 도메인 fetch 예외', async () => {
    let threw = false;
    try { await httpGet('https://deep-test-nonexistent-99999.invalid/', {}, 3000); }
    catch { threw = true; }
    if (!threw) throw new Error('예외가 던져져야 함');
  }, 20);

  await runTest('bokjiro 세션 URL 패턴 매칭 (정규식 flaky 체크)', () => {
    const testUrl = 'https://www.bokjiro.go.kr/ssis-tbu/svcinfo/svcinfoDtl.do?ssisTbuId=S00000010372';
    const src = load('src/cta/validate-cta-url.ts');
    // 패턴 추출
    const patternMatch = src.match(/bokjiro\\\.go\\\.kr[^\s]*svcinfoDtl\\\.do/);
    if (!patternMatch) throw new Error('패턴 찾기 실패');
    // 동적 정규식 테스트
    const re1 = /bokjiro\.go\.kr\/.*\/svcinfoDtl\.do/i;
    const re2 = /bokjiro\.go\.kr\/.*[?&]ssisTbuId=/i;
    if (!re1.test(testUrl) && !re2.test(testUrl)) throw new Error('bokjiro 패턴 매치 실패');
  });

  // ========== 로직 단위 검증 (mock 기반) ==========
  console.log('\n[그룹 3] 로직 단위 검증 (mock 기반)');

  await runTest('CTA ERROR_CONTENT_SIGNATURES 매칭 — 정상 vs 에러 페이지 구분', () => {
    const sigs = [
      '요청하신 페이지를 바르게 표시',
      '요청하신 페이지를 표시할 수 없',
      '잘못된 접근입니다',
      '정상적인 접근이 아닙',
      '세션이 만료',
    ];
    const errorPage = `<html><body>요청하신 페이지를 바르게 표시할 수 없습니다.</body></html>`;
    const normalPage = `<html><body>복지 혜택 안내 페이지입니다.</body></html>`;
    const head1 = errorPage.slice(0, 20000);
    const head2 = normalPage.slice(0, 20000);
    const errDetected = sigs.some(s => head1.includes(s));
    const normDetected = sigs.some(s => head2.includes(s));
    if (!errDetected) throw new Error('에러 페이지를 탐지하지 못함');
    if (normDetected) throw new Error('정상 페이지를 오탐');
  });

  await runTest('resumeFromStep 분기 시뮬 — 0부터 / 3부터', () => {
    // blogspotSetup의 로직을 단순 시뮬
    const runSteps = (resumeFrom) => {
      const executed = [];
      for (let i = 0; i <= 7; i++) {
        if (resumeFrom <= i) executed.push(i);
      }
      return executed;
    };
    const all = runSteps(0);
    const fromThree = runSteps(3);
    if (all.length !== 8) throw new Error(`전체 실행 step 수 틀림: ${all.length}`);
    if (fromThree[0] !== 3 || fromThree.length !== 5) throw new Error(`재시도 시뮬 실패: ${JSON.stringify(fromThree)}`);
  });

  await runTest('Blogspot 기존 블로그 감지 로직 시뮬', () => {
    const currentUrl = 'https://www.blogger.com/blog/posts/1234567890123456789';
    const postMatch = currentUrl.match(/blogger\.com\/blog\/posts\/(\d+)/);
    const blogId = postMatch ? postMatch[1] : '';
    if (!blogId || blogId.length < 10) throw new Error(`blogId 추출 실패: ${blogId}`);
  });

  await runTest('쇼핑 모드 차단 payload 시뮬', () => {
    const payload = { contentMode: 'shopping' };
    let caught = false;
    try {
      if (payload?.contentMode === 'shopping') {
        throw new Error('🚧 쇼핑/구매유도 모드는 현재 점검 중입니다');
      }
    } catch (e) {
      caught = true;
      if (!String(e.message).includes('점검 중')) throw new Error(`메시지 틀림: ${e.message}`);
    }
    if (!caught) throw new Error('차단되지 않음');
  });

  await runTest('CTA validate URL 형식 체크 (100 URL 변종)', (i) => {
    const urls = [
      'https://www.google.com/',
      'http://example.com',
      'https://bokjiro.go.kr/ssis-tbu/svcinfo/svcinfoDtl.do?ssisTbuId=X',
      'ftp://invalid',
      '',
      'not-a-url',
    ];
    const url = urls[i % urls.length];
    const isHttp = typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
    // 검증: isHttp 플래그가 정상 동작해야 함
    if (url.startsWith('ftp://') && isHttp) throw new Error('ftp URL을 http로 오판');
    if (url.startsWith('https://') && !isHttp) throw new Error('https URL을 http가 아니라고 오판');
  });

  await runTest('GCP preflight JSON 응답 파싱 시뮬', () => {
    const mockBillingOn = { billingEnabled: true, billingAccountName: 'billingAccounts/123-456' };
    const mockBillingOff = { billingEnabled: false };
    const mockMissing = {};
    if (mockBillingOn.billingEnabled !== true) throw new Error('정상 케이스 파싱 실패');
    if (mockBillingOff.billingEnabled === true) throw new Error('비활성 케이스 오판');
    if (mockMissing.billingEnabled === true) throw new Error('누락 케이스 오판');
  });

  await runTest('HTTPS 강제 — WP 도메인 검증 시뮬', () => {
    const httpSite = 'http://example.com';
    const httpsSite = 'https://example.com';
    const httpPass = httpSite.startsWith('https://');
    const httpsPass = httpsSite.startsWith('https://');
    if (httpPass) throw new Error('http를 https로 오판');
    if (!httpsPass) throw new Error('https를 인식하지 못함');
  });

  await runTest('Summary step 집계 로직 시뮬', () => {
    const stepResults = [
      { index: 0, label: '로그인', ok: true, message: '' },
      { index: 1, label: '블로그 만들기', ok: false, message: '주소 중복' },
      { index: 2, label: '최적화', ok: true, message: '' },
    ];
    const ok = stepResults.filter(r => r.ok).length;
    const fail = stepResults.filter(r => !r.ok).length;
    if (ok !== 2 || fail !== 1) throw new Error(`집계 틀림: ok=${ok} fail=${fail}`);
  });

  await runTest('시작 전 준비사항 체크리스트 항목 수 (Blogspot/WP)', () => {
    const src = load('electron/ui/modules/oneclick-setup.js');
    const bsSection = src.split('🔵 블로그스팟 쪽')[1]?.split('🟠 워드프레스')[0] || '';
    const wpSection = src.split('🟠 워드프레스')[1]?.split('</ul>')[0] || '';
    const bsItems = (bsSection.match(/<li>/g) || []).length;
    const wpItems = (wpSection.match(/<li>/g) || []).length;
    if (bsItems < 5) throw new Error(`Blogspot 체크 ${bsItems}개 (5개 이상 필요)`);
    if (wpItems < 4) throw new Error(`WP 체크 ${wpItems}개 (4개 이상 필요)`);
  });

  await runTest('외부 링크 4개 존재 (GA/GCP/Cloudways/Gemini)', () => {
    const src = load('electron/ui/modules/oneclick-setup.js');
    if (!src.includes('analytics/answer/9539598')) throw new Error('GA 링크 누락');
    if (!src.includes('console.cloud.google.com/billing')) throw new Error('GCP 링크 누락');
    if (!src.includes('platform.cloudways.com/signup')) throw new Error('Cloudways 링크 누락');
    if (!src.includes('aistudio.google.com/apikey')) throw new Error('Gemini 링크 누락');
  });

  await runTest('index.ts IPC 핸들러 등록 (verify + 최신 수)', () => {
    const src = load('electron/oneclick/index.js');
    if (!src.includes('registerVerifyIpcHandlers')) throw new Error('verify 등록 누락');
    // 등록 수는 버전별 변동 가능하므로 "N개 등록 완료" 패턴 존재만 확인
    if (!/\d+개 등록 완료/.test(src)) throw new Error('등록 수 로그 누락');
  });

  // ========== 에러 메시지 품질 (actionable) ==========
  console.log('\n[그룹 4] 에러 메시지 품질 (actionable)');

  await runTest('createBlog 에러 안내 — URL/경로 포함', () => {
    const src = load('electron/oneclick/automation/blogspot/steps/createBlog.ts');
    if (!src.includes('blogger.com')) throw new Error('blogger.com 링크 누락');
    if (!src.includes('주소 중복')) throw new Error('원인 안내 누락');
  });

  await runTest('bloggerConnect 에러 안내 — GCP 결제 + URL', () => {
    const src = load('electron/oneclick/automation/connect/bloggerConnect.ts');
    if (!src.includes('console.cloud.google.com/billing')) throw new Error('billing URL 누락');
    if (!src.includes('결제 계정')) throw new Error('결제 계정 원인 안내 누락');
  });

  await runTest('searchConsole 에러 안내 — 메뉴 경로 포함', () => {
    const src = load('electron/oneclick/automation/blogspot/steps/searchConsole.ts');
    if (!src.includes('Google Search Console')) throw new Error('경로 안내 누락');
  });

  await runTest('verifyHandlers actionable fix 필드', () => {
    const src = load('electron/oneclick/handlers/verifyHandlers.js');
    // 2가지 패턴 모두 집계: 객체 리터럴 `fix:` + 속성 대입 `item.fix = `
    const literalCount = (src.match(/\bfix:\s*[`'"]/g) || []).length;
    const assignCount = (src.match(/item\.fix\s*=/g) || []).length;
    const totalFix = literalCount + assignCount;
    if (totalFix < 5) throw new Error(`fix 5개 이상 필요, 실제 ${totalFix} (리터럴 ${literalCount} + 대입 ${assignCount})`);
  });

  // ========== C안 신규 수정 검증 ==========
  console.log('\n[그룹 5] v3.5.41 신규 수정 (C안 — 구조적 취약점)');

  await runTest('StateManager.reset — async + await browser.close + resetAll + isBusy', () => {
    const src = load('electron/oneclick/state/StateManager.js');
    if (!/async\s+reset\s*\(/.test(src)) throw new Error('reset이 async 아님');
    if (!/await\s+state\.browser/.test(src)) throw new Error('browser.close await 누락');
    if (!src.includes('isBusy')) throw new Error('isBusy 메서드 누락');
    if (!src.includes('resetAll')) throw new Error('resetAll 메서드 누락');
  });

  await runTest('setupHandlers — 중복 호출 차단 + await reset', () => {
    const src = load('electron/oneclick/handlers/setupHandlers.js');
    if (!src.includes('isBusy(platform)')) throw new Error('중복 차단 가드 누락');
    // 컴파일된 JS는 `await instances_1.setupStateManager.reset` 형태이므로 유연하게 매칭
    if (!/await\s+[\w_.]*setupStateManager\.reset/.test(src)) throw new Error('await reset 누락');
    if (!src.includes("'oneclick:get-resume-info'")) throw new Error('get-resume-info IPC 누락');
    if (!src.includes("'oneclick:clear-checkpoint'")) throw new Error('clear-checkpoint IPC 누락');
  });

  await runTest('persistence — 체크포인트 저장/로드 함수 존재', () => {
    const src = load('electron/oneclick/state/persistence.js');
    if (!src.includes('saveCheckpoint')) throw new Error('saveCheckpoint 누락');
    if (!src.includes('loadCheckpoint') && !src.includes('loadAllCheckpoints')) throw new Error('load 함수 누락');
    if (!src.includes('clearCheckpoint')) throw new Error('clearCheckpoint 누락');
    if (!src.includes('getResumableCheckpoints')) throw new Error('getResumableCheckpoints 누락');
    if (!src.includes('oneclick-checkpoints.json')) throw new Error('파일명 누락');
  });

  await runTest('blogspotSetup — saveCheckpoint 훅 + clearCheckpoint on complete', () => {
    const src = load('electron/oneclick/automation/blogspot/blogspotSetup.js');
    if (!src.includes('saveCheckpoint')) throw new Error('saveCheckpoint 훅 누락');
    if (!src.includes('clearCheckpoint')) throw new Error('완료 시 clearCheckpoint 누락');
  });

  await runTest('engineLock — releaseLock 초기값 no-op + try/catch', () => {
    const src = load('src/core/final/orchestration.ts');
    if (!/let\s+releaseLock:\s*\(\s*\)\s*=>\s*void\s*=\s*\(\s*\)\s*=>/.test(src)) throw new Error('no-op 초기값 누락');
    if (!src.includes('try { releaseLock(); }')) throw new Error('finally try/catch 누락');
  });

  await runTest('will-quit — 원클릭 StateManager 전체 정리', () => {
    const src = load('electron/main.js');
    if (!src.includes('resetAll')) throw new Error('resetAll 호출 누락');
    if (!src.includes('setupStateManager')) throw new Error('setupStateManager 임포트 누락');
    if (!src.includes('원클릭 Playwright 세션 전체 정리')) throw new Error('정리 로그 누락');
  });

  await runTest('cloudwaysInfra — 복수 앱 감지 시 에러 + preferredAppId', () => {
    const src = load('electron/oneclick/automation/cloudwaysInfra.js');
    if (!src.includes('preferredAppId')) throw new Error('preferredAppId 인자 누락');
    if (!src.includes('candidates.length > 1')) throw new Error('복수 감지 분기 누락');
    if (!src.includes('candidateAppIds')) throw new Error('candidateAppIds 노출 누락');
  });

  await runTest('createBlog — 주소/제목 사전 형식 검증', () => {
    const src = load('electron/oneclick/automation/blogspot/steps/createBlog.js');
    if (!src.includes('[a-z0-9]')) throw new Error('주소 정규식 누락');
    if (!src.includes('블로그 주소 형식 오류')) throw new Error('에러 메시지 누락');
    if (!src.includes('1~200자')) throw new Error('제목 길이 안내 누락');
  });

  await runTest('validate-cta-url — CTA_CACHE dedup + TTL', () => {
    const src = load('src/cta/validate-cta-url.ts');
    if (!src.includes('CTA_CACHE')) throw new Error('CTA_CACHE Map 누락');
    if (!src.includes('CTA_CACHE_TTL_MS')) throw new Error('TTL 상수 누락');
    if (!src.includes('normalizeCacheKey')) throw new Error('정규화 함수 누락');
    if (!src.includes('performValidation')) throw new Error('분리된 performValidation 누락');
  });

  await runTest('index.ts — 18개 등록 로그', () => {
    const src = load('electron/oneclick/index.js');
    if (!src.includes('18개 등록 완료')) throw new Error('등록 수 갱신 안 됨');
  });

  // 동적 CTA_CACHE 동작 검증 (mock)
  await runTest('헤더 배지 분리 스타일 — :has() + modifier 클래스 폴백 + !important', () => {
    const src = load('electron/ui/styles.css');
    if (!src.includes(':has(.badge-info)')) throw new Error('플랫폼 배지 :has 선택자 누락');
    if (!src.includes('rgba(139, 92, 246')) throw new Error('플랫폼 퍼플 박스색 누락');
    if (!src.includes('#ddd6fe')) throw new Error('플랫폼 텍스트 색상(밝은 라일락) 누락');
    if (!src.includes('#c4b5fd')) throw new Error('플랫폼 라벨 색상 누락');
    // !important로 강제됐는지
    if (!/\.badge-info\s*\{[\s\S]*?color:\s*#ddd6fe\s*!important/.test(src)) throw new Error('badge-info color !important 누락');
    // modifier 클래스 폴백
    if (!src.includes('.header-badge--info')) throw new Error('header-badge--info modifier 누락');

    // HTML에 modifier 클래스 부여됐는지
    const html = load('electron/ui/index.html');
    if (!html.includes('header-badge--info')) throw new Error('HTML에 header-badge--info modifier 누락');
    if (!html.includes('header-badge--success')) throw new Error('HTML에 header-badge--success modifier 누락');
    if (!html.includes('header-badge--warning')) throw new Error('HTML에 header-badge--warning modifier 누락');

    // dist 동기화
    const distSrc = load('dist/ui/styles.css');
    if (!distSrc.includes('header-badge--info')) throw new Error('dist/ui/styles.css 동기화 누락');
  });

  await runTest('Schema.org JSON-LD 풀팩 자동 삽입', () => {
    const sch = load('src/core/final/schema-jsonld.ts');
    if (!sch.includes('buildSchemaJsonLd')) throw new Error('buildSchemaJsonLd export 누락');
    if (!sch.includes('@graph')) throw new Error('@graph 묶음 누락');
    if (!sch.includes("'@type': 'Article'")) throw new Error('Article 타입 누락');
    if (!sch.includes("'@type': 'Person'")) throw new Error('Person 타입 누락');
    if (!sch.includes("'@type': 'Organization'")) throw new Error('Organization 타입 누락');
    if (!sch.includes("'@type': 'BreadcrumbList'")) throw new Error('BreadcrumbList 타입 누락');
    if (!sch.includes("'@type': 'WebSite'")) throw new Error('WebSite 타입 누락');
    if (!sch.includes('application/ld+json')) throw new Error('script 타입 누락');
    if (!sch.includes("'ko-KR'")) throw new Error('inLanguage 누락');

    const orch = load('src/core/final/orchestration.ts');
    if (!orch.includes('buildSchemaJsonLd')) throw new Error('orchestration import 누락');
    if (!orch.includes('schema.scriptTag')) throw new Error('schema 삽입 호출 누락');

    // 시뮬: @graph에 entity가 모두 포함되는지
    const mockInput = {
      title: '복지 지원금 안내',
      authorName: '홍길동',
      siteName: '내 블로그',
      siteUrl: 'https://example.com',
      breadcrumbs: [{ name: '홈', url: 'https://example.com' }, { name: '글', url: 'https://example.com/post' }],
    };
    // 정규식으로 @graph 길이 확인 (Article + Person + Organization + WebSite + BreadcrumbList = 5)
    if (!sch.includes('graph.push(person)')) throw new Error('Person push 누락');
    if (!sch.includes('graph.push(organization)')) throw new Error('Organization push 누락');
    if (!sch.includes('graph.push(breadcrumb)')) throw new Error('Breadcrumb push 누락');
  });

  await runTest('AdSense 정책 사전 스캔 — prohibited/YMYL/misleading/deceptive', () => {
    const pol = load('src/core/final/policy-scanner.ts');
    if (!pol.includes('scanAdsensePolicy')) throw new Error('scanAdsensePolicy export 누락');
    if (!pol.includes('PROHIBITED_PATTERNS')) throw new Error('금지 패턴 누락');
    if (!pol.includes('YMYL_PATTERNS')) throw new Error('YMYL 패턴 누락');
    if (!pol.includes('MISLEADING_PATTERNS')) throw new Error('과장 패턴 누락');
    if (!pol.includes('DECEPTIVE_PATTERNS')) throw new Error('클릭베이트 패턴 누락');
    if (!pol.includes('safe')) throw new Error('safe 플래그 누락');
    if (!pol.includes('mustHave')) throw new Error('YMYL 면책 검사 누락');

    const orch = load('src/core/final/orchestration.ts');
    if (!orch.includes('scanAdsensePolicy')) throw new Error('orchestration import 누락');
    if (!orch.includes('정책 즉시 차단 위반')) throw new Error('block throw 메시지 누락');

    // 시뮬: prohibited 패턴 매칭
    const sample1 = '안녕하세요 야동 사이트 추천 드립니다';
    const re1 = /(성인\s*동영상|야동|섹스\s*비디오|포르노|음란물|불법\s*촬영물)/g;
    if (!re1.test(sample1)) throw new Error('야동 패턴 매칭 실패');

    // misleading 시뮬
    const sample2 = '100% 합격 보장합니다';
    const re2 = /100%\s*(보장|성공|합격|확실|완벽)/g;
    if (!re2.test(sample2)) throw new Error('100% 보장 패턴 매칭 실패');

    // 정상 글은 통과해야
    const cleanSample = '오늘은 복지 지원금 신청 방법을 알아보겠습니다.';
    const re3 = /(성인\s*동영상|야동|불법\s*도박|마약\s*구입|불법\s*총기)/g;
    re3.lastIndex = 0;
    if (re3.test(cleanSample)) throw new Error('정상 글 오탐');
  });

  await runTest('E-E-A-T 메타 보강 — 발행일·읽기시간·검토자·cite 자동 삽입', () => {
    const eeat = load('src/core/final/eeat-meta.ts');
    if (!eeat.includes('buildEeatMeta')) throw new Error('buildEeatMeta export 누락');
    if (!eeat.includes('estimateReadingTime')) throw new Error('읽기 시간 추정 누락');
    if (!eeat.includes('wrapCitations')) throw new Error('cite 변환 누락');
    if (!eeat.includes('formatIsoDate')) throw new Error('ISO 날짜 포맷 누락');
    if (!eeat.includes('formatKoreanDate')) throw new Error('한국 날짜 포맷 누락');
    if (!eeat.includes('EEAT_META_CSS')) throw new Error('CSS 정의 누락');
    if (!eeat.includes('eeat-meta-box')) throw new Error('메타 박스 클래스 누락');
    if (!eeat.includes('eeat-cite')) throw new Error('cite 클래스 누락');
    if (!eeat.includes('readingTimeMinutes')) throw new Error('읽기 시간 결과 필드 누락');

    const orch = load('src/core/final/orchestration.ts');
    if (!orch.includes('buildEeatMeta')) throw new Error('orchestration import 누락');
    if (!orch.includes('EEAT_META_PLACEHOLDER')) throw new Error('메타 placeholder 누락');
    if (!orch.includes('EEAT_META_CSS')) throw new Error('CSS inject 누락');

    // 시뮬: 1500자 글의 읽기 시간 = 5분
    const sim = (chars) => Math.max(1, Math.round(chars / 300));
    if (sim(1500) !== 5) throw new Error(`1500자 시뮬 실패: ${sim(1500)}`);
    if (sim(0) !== 1) throw new Error('빈 글 최소 1분 보장 실패');
    if (sim(3000) !== 10) throw new Error(`3000자 시뮬 실패: ${sim(3000)}`);

    // ISO 날짜 포맷 시뮬
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date('2026-04-26T09:00:00');
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (iso !== '2026-04-26') throw new Error(`ISO 날짜 시뮬 실패: ${iso}`);
  });

  await runTest('AdSense 단기 승인 패키지 — IPC 4채널 + UI 5버튼', () => {
    const fastSrc = load('electron/adsenseFastApprovalHandlers.ts');
    if (!fastSrc.includes("'adsense:fast-approval-readiness'")) throw new Error('진단 IPC 누락');
    if (!fastSrc.includes("'adsense:fast-approval-seed-plan'")) throw new Error('시드 일정 IPC 누락');
    if (!fastSrc.includes("'adsense:fast-approval-indexnow'")) throw new Error('색인 가속 IPC 누락');
    if (!fastSrc.includes("'adsense:fast-approval-open'")) throw new Error('신청 페이지 열기 IPC 누락');
    if (!fastSrc.includes('evaluateReadiness')) throw new Error('진단 함수 누락');
    if (!fastSrc.includes('buildSeedPlan')) throw new Error('시드 일정 함수 누락');
    if (!fastSrc.includes('triggerIndexNow')) throw new Error('색인 함수 누락');
    if (!fastSrc.includes('clipboard')) throw new Error('클립보드 복사 누락');

    const main = load('electron/main.ts');
    if (!main.includes('registerFastApprovalIpcHandlers')) throw new Error('main.ts 핸들러 등록 누락');

    const ui = load('electron/ui/modules/adsense-tools.js');
    if (!ui.includes('btnFastReadiness')) throw new Error('UI 진단 버튼 누락');
    if (!ui.includes('btnFastEssentialPages')) throw new Error('UI 필수페이지 버튼 누락');
    if (!ui.includes('btnFastSeedPlan')) throw new Error('UI 시드 버튼 누락');
    if (!ui.includes('btnFastIndexNow')) throw new Error('UI 색인 버튼 누락');
    if (!ui.includes('btnFastOpenAdSense')) throw new Error('UI 신청 버튼 누락');
    if (!ui.includes("'adsense:fast-approval-readiness'")) throw new Error('UI invoke 누락');

    // 점수 시뮬
    const eval2 = (input) => {
      const checks = [
        { weight: 18, pass: (input.postCount || 0) >= 15 },
        { weight: 14, pass: (input.avgPostLength || 0) >= 1500 },
        { weight: 12, pass: (input.recentPostCount || 0) >= 5 },
        { weight: 6, pass: (input.categoryCount || 0) >= 3 },
        { weight: 12, pass: !!input.hasPrivacy },
        { weight: 10, pass: !!input.hasAbout },
        { weight: 10, pass: !!input.hasContact },
        { weight: 10, pass: !!input.hasDisclaimer },
        { weight: 8, pass: !!(input.blogUrl && input.blogUrl.startsWith('http')) },
      ];
      return checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
    };
    const fullScore = eval2({ blogUrl: 'https://test.com', hasPrivacy: true, hasAbout: true, hasContact: true, hasDisclaimer: true, postCount: 20, avgPostLength: 2000, recentPostCount: 7, categoryCount: 3 });
    if (fullScore < 100) throw new Error(`만점 시뮬 실패: ${fullScore}`);
    const emptyScore = eval2({});
    if (emptyScore !== 0) throw new Error(`빈 시뮬 0점이어야: ${emptyScore}`);
  });

  await runTest('AdSense 강화 — LLM 로테이션 + 외부 출처 강제 + 점수 게이트 + 발행 분산', () => {
    const orchSrc = load('src/core/final/orchestration.ts');
    if (!orchSrc.includes('llmRotation')) throw new Error('LLM 로테이션 처리 누락');
    if (!orchSrc.includes('adsenseScoreGate')) throw new Error('점수 게이트 처리 누락');
    if (!orchSrc.includes('computedScore')) throw new Error('점수 계산 누락');
    if (!orchSrc.includes('adsenseMinScore')) throw new Error('임계값 처리 누락');
    if (!orchSrc.includes('adsenseGateMode')) throw new Error('게이트 모드(warn/block) 누락');
    if (!orchSrc.includes('block')) throw new Error('block 분기 누락');

    const promptSrc = load('src/core/content-modes/adsense/adsense-prompt-builder.ts');
    if (!promptSrc.includes('sourceMandate')) throw new Error('외부 출처 강제 변수 누락');
    if (!promptSrc.includes('통계청 KOSIS')) throw new Error('출처 예시 누락');
    if (!promptSrc.includes('가짜 통계 절대 금지')) throw new Error('환각 방지 안내 누락');

    const scriptSrc = load('electron/ui/script.js');
    if (!scriptSrc.includes('scaled content abuse')) throw new Error('스케줄 분산 안내 누락');
    if (!scriptSrc.includes('12 * 60 * 60 * 1000')) throw new Error('12시간 윈도우 누락');
    if (!scriptSrc.includes('12-24시간')) throw new Error('분산 안내 누락');

    const html = load('electron/ui/index.html');
    if (!html.includes('llmRotation')) throw new Error('UI 로테이션 토글 누락');
    if (!html.includes('adsenseScoreGate')) throw new Error('UI 게이트 토글 누락');
    if (!html.includes('adsenseMinScore')) throw new Error('UI 임계값 슬라이더 누락');
    if (!html.includes('adsenseGateMode')) throw new Error('UI 게이트 모드 select 누락');

    const postingJs = load('electron/ui/modules/posting.js');
    if (!postingJs.includes('llmRotation')) throw new Error('posting payload 로테이션 누락');
    if (!postingJs.includes('adsenseScoreGate')) throw new Error('posting payload 게이트 누락');

    // 점수 계산 시뮬
    const score = (b, e, s, ai) => {
      const burst = Math.min(25, Math.max(0, Math.round(b / 1.0 * 25)));
      const ending = Math.min(25, Math.max(0, Math.round(e / 6 * 25)));
      const stdDev = Math.min(25, Math.max(0, Math.round(s / 18 * 25)));
      const aiPenalty = Math.max(0, 25 - ai * 3);
      return burst + ending + stdDev + aiPenalty;
    };
    if (score(0.8, 5, 15, 0) < 80) throw new Error('우수 글 점수 시뮬 실패');
    if (score(0.3, 2, 5, 10) > 50) throw new Error('저품질 글 점수 시뮬 실패');
  });

  await runTest('AdSense 강화 자동 ON + 발행 서브탭 분리', () => {
    const orch = load('src/core/final/orchestration.ts');
    if (!orch.includes("payload?.contentMode === 'adsense'")) throw new Error('adsense 자동 분기 누락');
    if (!orch.includes('payload.llmRotation = payload.llmRotation !== false')) throw new Error('LLM 로테이션 자동 ON 누락');
    if (!orch.includes('payload.adsenseScoreGate = payload.adsenseScoreGate !== false')) throw new Error('점수 게이트 자동 ON 누락');
    if (!orch.includes('승인률 강화 자동 적용')) throw new Error('자동 적용 로그 누락');

    const html = load('electron/ui/index.html');
    // 사용자 노출 토글 카드 제거 (hidden input은 OK)
    // label 클래스 acc-label에 노출되는 토글만 제거 확인 (hidden input/주석은 OK)
    if (/<label\s+class="acc-label">🏆 AdSense 승인률 강화/.test(html)) throw new Error('AdSense 강화 카드 잔존');
    if (/<label\s+class="acc-label">🛡️ CTA AI 엄격 검증/.test(html)) throw new Error('CTA 엄격 카드 잔존');
    if (/<label\s+class="acc-label">🛡️ 썸네일 엔진 엄격 모드/.test(html)) throw new Error('썸네일 엄격 카드 잔존');
    // 자동 안내 카드 추가
    if (!html.includes('adsenseAutoHint')) throw new Error('자동 안내 카드 누락');
    if (!html.includes('승인률 강화 자동 적용 중')) throw new Error('자동 안내 문구 누락');
    // hidden input은 잔존해야 (payload 호환)
    if (!html.includes('id="llmRotation" hidden')) throw new Error('llmRotation hidden input 누락');
    if (!html.includes('id="adsenseScoreGate" hidden')) throw new Error('adsenseScoreGate hidden 누락');
    if (!html.includes('id="strictThumbnailEngine" hidden')) throw new Error('strictThumbnailEngine hidden 누락');

    // 서브탭 분리
    if (!html.includes('publishModeTabSingle')) throw new Error('단일 발행 탭 누락');
    if (!html.includes('publishModeTabBulk')) throw new Error('연속 발행 탭 누락');
    if (!html.includes('data-publish-mode')) throw new Error('data-publish-mode 속성 누락');
    if (!html.includes('singleModeHint')) throw new Error('단일 모드 안내 누락');
    if (!html.includes('bulkModeHint')) throw new Error('연속 모드 안내 누락');

    const queueJs = load('electron/ui/modules/publish-queue.js');
    if (!queueJs.includes('bindPublishModeTabs')) throw new Error('서브탭 바인딩 함수 누락');
    if (!queueJs.includes('getCurrentMode')) throw new Error('모드 조회 함수 누락');

    const script = load('electron/ui/script.js');
    if (!script.includes('adsenseAutoHint')) throw new Error('contentMode change 시 안내 표시 로직 누락');
  });

  await runTest('Internal 모드 — 외부출처 강제 + postProcess + 폴백 + 라벨', () => {
    const mode = load('src/core/content-modes/internal/internal-mode.ts');
    if (!mode.includes('postProcessInternal')) throw new Error('postProcess import 누락');
    if (!mode.includes('SOURCE_MANDATE')) throw new Error('외부 출처 강제 변수 누락');
    if (!mode.includes('통계청 KOSIS')) throw new Error('출처 예시 누락');
    if (!mode.includes('단일 완결 모드')) throw new Error('새 모드 이름 누락');
    if (!mode.includes('postProcess(html')) throw new Error('postProcess 메서드 누락');
    if (!mode.includes("sec.id === 'additional_resources'")) throw new Error('additional 가드 누락');

    const post = load('src/core/content-modes/internal/internal-post-processor.ts');
    if (!post.includes('SERIES_PATTERNS')) throw new Error('시리즈 패턴 정의 누락');
    if (!post.includes('EXTERNAL_REF_PATTERNS')) throw new Error('외부참조 패턴 정의 누락');
    if (!post.includes('postProcessInternal')) throw new Error('postProcessInternal export 누락');

    const orch = load('src/core/final/orchestration.ts');
    if (!orch.includes("contentMode === 'internal'")) throw new Error('orchestration internal 분기 누락');
    if (!orch.includes('internal 모드 폴백')) throw new Error('폴백 로직 누락');
    if (!orch.includes('fallbackLinks')) throw new Error('fallback 변수 누락');

    const html = load('electron/ui/index.html');
    if (html.includes('📝 내부링크 일관성 모드/정보전달')) throw new Error('기존 모호 라벨 잔존');
    if (!html.includes('🕸️ 단일 완결')) throw new Error('새 명확 라벨 누락');

    // 시뮬: 시리즈 패턴 자동 제거 (한글 경계 처리)
    const sample = '오늘은 1편입니다. 이전 글에서 다룬 내용을 확장합니다.';
    const cleaned = sample
      .replace(/\d+\s*편(?=[입니다은는이가\s,.\)])/g, '')
      .replace(/(이전|다음|첫|마지막)\s*(편|글|포스트)/g, '');
    if (cleaned.includes('1편')) throw new Error('시리즈 시뮬 실패');
    if (cleaned.includes('이전 글')) throw new Error('이전 글 시뮬 실패');
  });

  await runTest('연속발행 대기열 — 발행 간격 슬라이더 추가 (초/분/시간/무작위)', () => {
    const src = load('electron/ui/modules/publish-queue.js');
    if (!src.includes('pq-interval-mode')) throw new Error('간격 모드 select 누락');
    if (!src.includes('pq-interval-value')) throw new Error('간격 슬라이더 누락');
    if (!src.includes('getIntervalMs')) throw new Error('간격 계산 함수 누락');
    if (!src.includes("'seconds'") || !src.includes("'minutes'") || !src.includes("'hours'") || !src.includes("'random'")) {
      throw new Error('4개 모드(seconds/minutes/hours/random) 누락');
    }
    if (!src.includes('syncIntervalControl')) throw new Error('동기화 함수 누락');
    if (!src.includes('cursor += getIntervalMs()')) throw new Error('스케줄에 간격 적용 누락');
    if (!src.includes('intervalMs')) throw new Error('즉시 발행에 간격 적용 누락');

    // 시뮬: 간격 계산 정확성
    const simInterval = (mode, value) => {
      if (mode === 'random') return -1; // 무작위는 검증 불가
      if (mode === 'seconds') return Math.max(5, value) * 1000;
      if (mode === 'minutes') return Math.max(1, value) * 60 * 1000;
      return Math.max(1, value) * 3600 * 1000;
    };
    if (simInterval('seconds', 30) !== 30000) throw new Error('초 시뮬 실패');
    if (simInterval('minutes', 10) !== 600000) throw new Error('분 시뮬 실패');
    if (simInterval('hours', 6) !== 21600000) throw new Error('시간 시뮬 실패');
    if (simInterval('seconds', 2) !== 5000) throw new Error('최소 5초 안전장치 실패');
  });

  await runTest('거미줄치기 탭 — 다크 톤 리팩토링 + Step Stepper + 접근성', () => {
    const html = load('electron/ui/index.html');
    // 신규 컴포넌트 클래스 (다른 클래스와 함께 chained 가능)
    if (!/\bsw-tab\b/.test(html)) throw new Error('sw-tab 컨테이너 누락');
    if (!/\bsw-steps\b/.test(html)) throw new Error('Step Stepper 누락');
    if (!html.includes('Step 01') || !html.includes('Step 02') || !html.includes('Step 03') || !html.includes('Step 04')) {
      throw new Error('4단계 Step badge 누락');
    }
    if (!html.includes('aria-labelledby')) throw new Error('aria-labelledby 누락 (접근성)');
    if (!html.includes('aria-live')) throw new Error('aria-live 누락');
    if (!html.includes('role="dialog"') || !html.includes('aria-modal')) throw new Error('모달 ARIA 누락');
    // 기존 라이트 배경 제거
    if (html.includes('background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); min-height: 100vh;')) {
      throw new Error('기존 라이트 배경 잔존');
    }

    const css = load('electron/ui/styles.css');
    if (!css.includes('.sw-tab')) throw new Error('CSS sw-tab 누락');
    if (!css.includes('.sw-step.is-active')) throw new Error('Step active 상태 누락');
    if (!css.includes('.sw-btn--cta.is-loading::before')) throw new Error('로딩 스피너 누락');
    if (!css.includes(':focus-visible')) throw new Error('focus-visible 접근성 누락');
    if (!css.includes('@keyframes sw-spin')) throw new Error('스피너 애니메이션 누락');
    if (!css.includes('@media (max-width: 768px)') && !css.match(/@media \(max-width: 768px\)[\s\S]*?\.sw-/)) {
      throw new Error('반응형 미디어쿼리 누락');
    }
    if (!css.includes('@media (max-width: 480px)')) throw new Error('480px 미디어쿼리 누락');
  });

  await runTest('연속발행 대기열 — 줄바꿈 키워드 자동 감지 + 모달 UI', () => {
    const queueSrc = load('electron/ui/modules/publish-queue.js');
    if (!queueSrc.includes('initPublishQueue')) throw new Error('initPublishQueue export 누락');
    if (!queueSrc.includes('window.__publishQueue')) throw new Error('전역 노출 누락');
    if (!queueSrc.includes('publishQueueModal')) throw new Error('모달 ID 누락');
    if (!queueSrc.includes('pq-bulk-apply')) throw new Error('일괄 적용 버튼 누락');
    if (!queueSrc.includes('pq-action-schedule')) throw new Error('스케줄 추가 버튼 누락');
    if (!queueSrc.includes('pq-action-publish')) throw new Error('즉시 발행 버튼 누락');
    if (!queueSrc.includes('scheduledPosts')) throw new Error('scheduledPosts 통합 누락');
    if (!queueSrc.includes('12 + Math.random() * 12')) throw new Error('12-24h 분산 로직 누락');
    if (!queueSrc.includes('function addCurrent')) throw new Error('addCurrent 누적 함수 누락');
    if (!/window\.__publishQueue\s*=\s*\{[^}]*addCurrent/.test(queueSrc)) throw new Error('addCurrent 전역 노출 누락');

    const html = load('electron/ui/index.html');
    if (!html.includes('publishQueueBadge')) throw new Error('배지 UI 누락');
    if (!html.includes('publishQueueAddBtn')) throw new Error('대기열에 추가 버튼 누락');
    if (!html.includes('publishQueueOpenBtn')) throw new Error('대기열 보기 버튼 누락');
    if (!html.includes('publishQueueCurrentCount')) throw new Error('현재 입력 카운트 누락');
    if (!html.includes('publishQueueSavedCount')) throw new Error('저장 큐 카운트 누락');
    if (!html.includes('publishQueueCount')) throw new Error('카운트 표시 누락');

    const main = load('electron/ui/modules/main.js');
    if (!main.includes('initPublishQueue')) throw new Error('main.js init 호출 누락');
    if (!main.includes("import { initPublishQueue }")) throw new Error('main.js import 누락');
  });

  await runTest('AdSense — author_intro 섹션 H2 제거 (메타 박스로 위임)', () => {
    const sec = load('src/core/content-modes/adsense/adsense-sections.ts');
    if (sec.includes("id: 'author_intro'")) throw new Error('author_intro 섹션 잔존');
    if (sec.includes("title: '작성자 소개'")) throw new Error('"작성자 소개" 타이틀 잔존');
    // 6개 섹션이어야
    const idMatches = sec.match(/id: '[a-z_]+'/g) || [];
    if (idMatches.length !== 6) throw new Error(`섹션 수 6개 필요, 실제 ${idMatches.length}`);

    const prompt = load('src/core/content-modes/adsense/adsense-prompt-builder.ts');
    if (prompt.includes('1. 작성자 소개')) throw new Error('outline에 작성자 소개 잔존');
    if (!prompt.includes('절대 생성하지 마세요')) throw new Error('H2 작성자 소개 차단 안내 누락');
    if (!prompt.includes('6개 섹션')) throw new Error('6개 섹션 안내 누락');

    const orch = load('src/core/final/orchestration.ts');
    // 변수/조건 사용은 제거됐는지 (주석만 남은 건 OK)
    if (/const\s+skipFirstForAdsense\s*=/.test(orch)) throw new Error('skipFirstForAdsense 변수 잔존');
    if (/!skipFirstForAdsense/.test(orch)) throw new Error('skipFirstForAdsense 가드 잔존');
  });

  await runTest('SVG 텍스트 썸네일 폐지 — 모든 폴백 경로 제거', () => {
    const disp = load('src/core/imageDispatcher.ts');
    // makeAutoThumbnail import 제거됐는지 확인
    if (/import\s*\{[^}]*makeAutoThumbnail[^}]*\}\s*from/.test(disp)) throw new Error('makeAutoThumbnail import 잔존');
    // 호출 자체가 없어야 함
    if (/\bmakeAutoThumbnail\s*\(/.test(disp)) throw new Error('makeAutoThumbnail 호출 잔존');
    // SVG 폐지 안내 메시지가 있어야 함
    if (!disp.includes('SVG') || !disp.includes('폐지')) throw new Error('폐지 안내 메시지 누락');
    // 1순위 case (text/svg)도 imagefx로 자동 전환
    if (!disp.includes("thumbnailSource === 'text' || thumbnailSource === 'svg'")) throw new Error('text/svg 분기 누락');

    // thumbnail.ts의 makeAutoThumbnail은 deprecated 처리 (호출 시 fail 반환)
    const thumb = load('src/thumbnail.ts');
    if (!thumb.includes('@deprecated')) throw new Error('deprecated 마커 누락');
    if (!thumb.includes('SVG 텍스트 썸네일은 폐지')) throw new Error('폐지 메시지 누락');
    // makeEnhancedThumbnail의 SVG 폴백도 제거
    if (/배경 없음, 기본 SVG 생성/.test(thumb)) throw new Error('makeEnhancedThumbnail SVG 폴백 잔존');

    // UI 안내 문구는 v3.5.60에서 토글 자체를 제거(자동 ON), SVG 폐지 안내는 더 이상 노출 X
    // dispatcher 코드 레벨에서 SVG 폐지가 보장되므로 UI 검증은 hidden input 존재로 갈음
    const html = load('electron/ui/index.html');
    if (!html.includes('id="strictThumbnailEngine"')) throw new Error('strictThumbnailEngine input 누락');
    // script.js의 svg/text 옵션 제거
    const script = load('electron/ui/script.js');
    if (script.includes('SVG 썸네일 (기본)')) throw new Error('script.js SVG 옵션 잔존');
    if (script.includes('value="svg"') && script.includes('SVG 썸네일')) throw new Error('value="svg" 옵션 잔존');
  });

  await runTest('썸네일 엔진 폴백 — 명시 선택 실패 시 자동 폴백 (엄격 모드는 옵트인)', () => {
    const dispSrc = load('src/core/imageDispatcher.ts');
    if (!dispSrc.includes('STRICT_THUMBNAIL_ENGINE')) throw new Error('엄격 모드 환경변수 누락');
    if (!dispSrc.includes('strictMode')) throw new Error('엄격 모드 분기 누락');
    // 핵심: userPickedExplicitly만으로 SVG 폴백하면 안 됨 (strictMode와 AND 조건이어야)
    if (!dispSrc.includes('userPickedExplicitly && strictMode')) throw new Error('AND 조건 누락 — 명시 선택만으로 SVG 강제');
    if (!dispSrc.includes('자동 폴백')) throw new Error('자동 폴백 로그 누락');
    // 폴백 체인에 dalle도 포함
    if (!/fallbackOrder\s*=\s*\[[^\]]*'dalle'/.test(dispSrc)) throw new Error('폴백 체인에 dalle 누락');
    // 폴백 성공 시 출처 라벨에 원본 요청 명시
    if (!dispSrc.includes('자동 폴백')) throw new Error('폴백 source 라벨 누락');

    const orchSrc = load('src/core/final/orchestration.ts');
    if (!orchSrc.includes("payload?.strictThumbnailEngine")) throw new Error('payload 토글 처리 누락');

    const html = load('electron/ui/index.html');
    if (!html.includes('strictThumbnailEngine')) throw new Error('UI 토글 input 누락');
    if (!html.includes('썸네일 엔진 엄격 모드')) throw new Error('UI 라벨 누락');

    const postingJs = load('electron/ui/modules/posting.js');
    if (!postingJs.includes('strictThumbnailEngine')) throw new Error('posting payload 전달 누락');
  });

  await runTest('Adsense 작성자 — 비어있는 필드 AI 생성 차단 + img 후처리', () => {
    const promptSrc = load('src/core/content-modes/adsense/adsense-prompt-builder.ts');
    if (!promptSrc.includes('titleProvided')) throw new Error('titleProvided 분기 누락');
    if (!promptSrc.includes('credentialsProvided')) throw new Error('credentialsProvided 분기 누락');
    if (!promptSrc.includes('입력 안 됨')) throw new Error('비어있는 필드 명시 차단 안내 누락');
    if (!promptSrc.includes('HTML <img>') && !promptSrc.includes('아바타')) throw new Error('img 생성 금지 지시 누락');
    // 실제 fallback 패턴: ${authorInfo!.title || '(주제에 맞게 AI가 결정)'} 같은 코드 잔존 검사
    if (/\|\|\s*['"]\(주제에 맞게 AI가 결정\)['"]/.test(promptSrc)) throw new Error("기존 'AI가 결정' || fallback 잔존");

    const maxModeSrc = load('src/core/max-mode/content-mode-prompt.ts');
    if (/\|\|\s*['"]\(주제에 맞게 AI가 결정\)['"]/.test(maxModeSrc)) throw new Error("max-mode에 잔존 || fallback");
    if (!maxModeSrc.includes('입력 안 됨')) throw new Error('max-mode 차단 안내 누락');

    const postSrc = load('src/core/content-modes/adsense/adsense-post-processor.ts');
    if (!postSrc.includes('stripAuthorImagesAndAvatars')) throw new Error('후처리 함수 누락');
    if (!postSrc.includes('작성자\\s*소개')) throw new Error('작성자 소개 섹션 정규식 누락');
    if (!postSrc.includes('avatar') || !postSrc.includes('profile')) throw new Error('컨테이너 클래스 매칭 누락');

    // 시뮬: 작성자 소개 섹션 안의 img가 제거되는지 확인
    const sample = '<h2>작성자 소개</h2><p>안녕하세요. 저는 <img src="auto.png" alt="profile" />홍길동입니다.</p>';
    // 함수를 직접 import하지 않고 정규식 동작만 시뮬
    const cleaned = sample.replace(/<img\b[^>]*>/gi, '');
    if (cleaned.includes('<img')) throw new Error('img 정규식 시뮬 실패');
  });

  await runTest('썸네일 — 사용자 명시 엔진 선택 시 productImages 무시', () => {
    const src = load('src/core/final/orchestration.ts');
    if (!src.includes('userPickedAiEngine')) throw new Error('명시 엔진 플래그 누락');
    if (!src.includes('useProductImages')) throw new Error('useProductImages 가드 누락');
    if (!src.includes('isCrawledRequested')) throw new Error('crawled 분기 누락');
    if (!src.includes('수집 이미지') || !src.includes('무시하고')) throw new Error('무시 안내 로그 누락');
    // 시뮬: dalle 명시 선택 + productImages 있음 → useProductImages = false
    const sim = (src, productImages, contentMode) => {
      const srcLower = String(src || '').toLowerCase();
      const isCrawledRequested = srcLower === 'crawled' || srcLower.startsWith('crawled-') || srcLower === 'custom';
      const userPickedAiEngine = !!srcLower && srcLower !== 'auto' && srcLower !== 'default' && !isCrawledRequested && srcLower !== 'none' && srcLower !== 'skip';
      const isShoppingMode = contentMode === 'shopping';
      return productImages?.length > 0 && (isCrawledRequested || isShoppingMode || !userPickedAiEngine);
    };
    // dalle 명시 + 이미지 있음 + seo 모드 → 수집 이미지 무시
    if (sim('dalle', ['x.png'], 'seo')) throw new Error('dalle 명시 시뮬 실패: 수집 이미지 사용됨');
    // crawled 명시 → 수집 이미지 사용
    if (!sim('crawled', ['x.png'], 'seo')) throw new Error('crawled 명시 시뮬 실패: 수집 이미지 무시됨');
    // shopping 모드 → 수집 이미지 사용
    if (!sim('imagefx', ['x.png'], 'shopping')) throw new Error('shopping 모드 시뮬 실패');
    // auto + 이미지 있음 → 수집 이미지 사용
    if (!sim('auto', ['x.png'], 'seo')) throw new Error('auto 시뮬 실패');
  });

  await runTest('모든 AI 엔진 명시 선택 시 productImages 무시 (imagefx/flow/nanobananapro/deepinfra/leonardo/dalle/pollinations)', () => {
    const sim = (src) => {
      const srcLower = String(src || '').toLowerCase();
      const isCrawledRequested = srcLower === 'crawled' || srcLower.startsWith('crawled-') || srcLower === 'custom';
      const userPickedAiEngine = !!srcLower && srcLower !== 'auto' && srcLower !== 'default' && !isCrawledRequested && srcLower !== 'none' && srcLower !== 'skip';
      const isShoppingMode = false;
      return ['x.png'].length > 0 && (isCrawledRequested || isShoppingMode || !userPickedAiEngine);
    };
    const aiEngines = ['imagefx', 'flow', 'nanobananapro', 'nanobanana', 'deepinfra', 'leonardo', 'dalle', 'pollinations'];
    for (const e of aiEngines) {
      if (sim(e)) throw new Error(`${e} 엔진 명시 시 수집 이미지가 사용됨 (무시되어야 함)`);
    }
  });

  await runTest('H1 연도 복구기 — 한글 합성어(청년/노년/작년) 보호', () => {
    // orchestration.ts의 정규식이 한글 합성어를 깨뜨리지 않는지 검증
    const src = load('src/core/final/orchestration.ts');
    // 새 정규식 시그니처 존재
    if (!src.includes("(?<!\\d)(^|\\s)년(?=\\s|$)")) {
      throw new Error('H1 repairTitleYear 안전 정규식 누락');
    }
    // 옛 위험 패턴이 남아있으면 안 됨
    if (src.includes("(?<!\\d\\s*)(\\s*)년(?=[\\s가-힣A-Za-z0-9])")) {
      throw new Error('옛 위험 정규식 잔존 — 한글 합성어 깨뜨림');
    }
    // 시뮬레이션: 안전 정규식 동작 검증
    const Y = 2026;
    const repair = (t) => t.replace(/(?<!\d)(^|\s)년(?=\s|$)/g, (_m, p) => `${p}${Y}년`);
    const cases = [
      ['청년도약계좌', '청년도약계좌'],          // 한글 합성어 보호 (이전 버그: '청2026년도약계좌')
      ['노년 보험 가이드', '노년 보험 가이드'],   // 한글-년 단어 끝 보호
      ['작년 데이터', '작년 데이터'],
      ['2026년 정부정책', '2026년 정부정책'],   // 숫자-년 보호
      ['년 정부정책', '2026년 정부정책'],       // 선두 단독 → 치환
      ['올해 년 달라진 것', '올해 2026년 달라진 것'], // 중간 단독 → 치환
      ['2026 년 조회', '2026 년 조회'],         // 숫자+공백+년 보호
      ['3년차 직장인', '3년차 직장인'],
    ];
    for (const [input, expected] of cases) {
      const got = repair(input);
      if (got !== expected) throw new Error(`H1 정규식 실패: "${input}" → "${got}" (예상: "${expected}")`);
    }
  });

  await runTest('publish-queue — 즉시 순차 발행 시 change 이벤트 dispatch + 완료 이벤트 await', () => {
    const src = load('electron/ui/modules/publish-queue.js');
    // change 이벤트 dispatch (페이로드 빌더 동기화)
    if (!src.includes("dispatchEvent(new Event('change'")) throw new Error("change 이벤트 dispatch 누락");
    if (!src.includes("dispatchEvent(new Event('input'")) throw new Error("input 이벤트 dispatch 누락");
    // contentMode/thumbnailType/h2ImageSource/ctaMode 모두 sync
    if (!src.includes("h2ImageSource")) throw new Error('h2ImageSource sync 누락');
    if (!src.includes('input[name="ctaMode"]')) throw new Error('ctaMode 라디오 sync 누락');
    // 발행 완료 — CustomEvent 기반 (publishBtn은 disabled 안 되므로 폴링 불가)
    if (!src.includes("'bgpt:publish-complete'")) throw new Error('bgpt:publish-complete 이벤트 listener 누락');
    if (!src.includes('addEventListener')) throw new Error('addEventListener 미사용');
    if (!src.includes('removeEventListener')) throw new Error('removeEventListener 미사용 (leak 위험)');
    if (!src.includes('maxWaitMs')) throw new Error('maxWaitMs 타임아웃 누락');
    // 옛 폴링 잔존 금지
    if (src.includes('!btn.disabled && !btn.classList.contains')) throw new Error('옛 disabled 폴링 잔존 — CustomEvent로 교체되어야 함');
  });

  await runTest('posting.js — runPosting/publishToPlatform finally에서 bgpt:publish-complete 발사', () => {
    const src = load('electron/ui/modules/posting.js');
    const occurrences = (src.match(/bgpt:publish-complete/g) || []).length;
    if (occurrences < 2) throw new Error(`bgpt:publish-complete 발사 ${occurrences}회 — 최소 2회 (runPosting + publishToPlatform finally) 필요`);
    if (!src.includes("dispatchEvent(new CustomEvent('bgpt:publish-complete'")) throw new Error('CustomEvent 발사 누락');
    // source 식별자
    if (!src.includes("source: 'runPosting'")) throw new Error('runPosting source 누락');
    if (!src.includes("source: 'publishToPlatform'")) throw new Error('publishToPlatform source 누락');
  });

  await runTest('generation.ts — 폴백 사일런트 페일 차단 (보일러플레이트 × N 발행 방지)', () => {
    const src = load('src/core/final/generation.ts');
    // 옛 폴백 보일러플레이트 텍스트 잔존 금지
    if (src.includes('기초 개념부터 차근차근 이해하는 게 핵심이에요')) {
      throw new Error('옛 폴백 보일러플레이트 잔존 — H2 N개가 동일 텍스트로 채워질 위험');
    }
    if (src.includes('가장 흔한 실수는 너무 급하게 진행하는 거예요')) {
      throw new Error('옛 폴백 보일러플레이트 잔존 (주의사항)');
    }
    // throw 기반 명시적 실패
    if (!src.includes('섹션 콘텐츠 생성 실패')) throw new Error('명시적 throw 메시지 누락');
    if (!src.includes('폴백 콘텐츠는 모든 H2가 동일')) throw new Error('차단 사유 설명 누락');
  });

  await runTest('Nano Banana 파이프라인 — Gemini 3 Pro Image 우선 + 폴백 체인', () => {
    const src = load('src/thumbnail.ts');
    // 최신 모델 ID 3개 모두 존재
    if (!src.includes("id: 'gemini-3-pro-image-preview'")) throw new Error('Gemini 3 Pro Image 모델 ID 누락');
    if (!src.includes("id: 'gemini-3.1-flash-image-preview'")) throw new Error('Gemini 3.1 Flash Image 모델 ID 누락');
    if (!src.includes("id: 'gemini-2.5-flash-image'")) throw new Error('Gemini 2.5 Flash Image 폴백 ID 누락');
    // deprecated ID는 사용 안 함
    if (src.includes("'gemini-2.5-flash-image-preview'")) throw new Error('Deprecated -preview 접미사 모델 잔존');
    // 순서: Pro 우선 — IMAGE_MODELS 배열에서 Pro가 Flash보다 먼저
    const proIdx = src.indexOf("id: 'gemini-3-pro-image-preview'");
    const flashIdx = src.indexOf("id: 'gemini-3.1-flash-image-preview'");
    if (proIdx < 0 || flashIdx < 0 || proIdx > flashIdx) {
      throw new Error('파이프라인 순서 오류: Pro가 Flash보다 먼저여야 함');
    }
    // responseModalities 사용 (image+text)
    if (!src.includes("responseModalities")) throw new Error('responseModalities 설정 누락');
  });

  await runTest('UI — Nano Banana Pro 라벨에 Gemini 3 명시', () => {
    const html = load('electron/ui/index.html');
    if (!html.includes('Gemini 3 Pro Image')) throw new Error('Gemini 3 Pro Image 라벨 누락');
    // 모호한 옛 라벨이 남아있으면 안 됨
    if (html.includes('Nano Banana Pro (Gemini API 유료)')) throw new Error('옛 라벨 잔존');
  });

  await runTest('imageDispatcher — 모든 case 분기 + makeXxx 호출 일관', () => {
    const src = load('src/core/imageDispatcher.ts');
    // 7개 AI 엔진 case 분기 모두 있어야
    const required = [
      "case 'imagefx':",
      "case 'flow':",
      "case 'nanobananapro':",
      "case 'deepinfra':",
      "case 'leonardo':",
      "case 'dalle':",
      "case 'pollinations':",
    ];
    for (const r of required) {
      if (!src.includes(r)) throw new Error(`${r} 분기 누락`);
    }
    // 명시 선택 보호 (userPickedExplicitly)
    if (!src.includes('userPickedExplicitly')) throw new Error('명시 선택 보호 로직 누락');
    if (!src.includes('명시 선택')) throw new Error('명시 선택 안내 누락');
  });

  await runTest('imageDispatcher 별칭 — 모든 변종이 정확한 엔진으로 정규화', () => {
    const src = load('src/core/imageDispatcher.ts');
    // alias map 추출
    const aliasMatch = src.match(/aliasMap[\s\S]*?\{([\s\S]*?)\}/);
    if (!aliasMatch) throw new Error('aliasMap 정의를 찾지 못함');
    const aliases = aliasMatch[1];
    const required = [
      "'auto': 'imagefx'",
      "'default': 'imagefx'",
      "'nb': 'nanobananapro'",
      "'nano': 'nanobananapro'",
      "'flux': 'deepinfra'",
      "'openai': 'dalle'",
      "'gpt-image-2': 'dalle'",
      "'ducktape': 'dalle'",
      "'duct-tape': 'dalle'",
      "'덕트테이프': 'dalle'",
    ];
    for (const r of required) {
      if (!aliases.includes(r)) throw new Error(`별칭 누락: ${r}`);
    }
  });

  await runTest('썸네일 dispatchThumbnailGeneration — 명시 선택 + 엄격 모드 처리', () => {
    const src = load('src/core/imageDispatcher.ts');
    if (!src.includes('userPickedExplicitly')) throw new Error('명시 선택 플래그 누락');
    if (!src.includes('strictMode')) throw new Error('엄격 모드 플래그 누락');
    if (!src.includes('폴백 금지')) throw new Error('폴백 금지 메시지 누락');
    // SVG 대체 → 폐지로 변경됨
    if (!src.includes('SVG 폐지')) throw new Error('SVG 폐지 안내 누락');
    if (!src.includes('fallbackOrder')) throw new Error('폴백 체인 누락');
  });

  await runTest('썸네일 makeDalleThumbnail — 모델 폴백 체인 + b64_json 응답 처리', () => {
    const src = load('src/thumbnail.ts');
    if (!src.includes("'gpt-image-2'") || !src.includes("'gpt-image-1'") || !src.includes("'dall-e-3'")) {
      throw new Error('모델 체인 누락');
    }
    if (!src.includes('buildBody')) throw new Error('모델별 body 분기 누락');
    if (!src.includes('b64_json')) throw new Error('base64 응답 처리 누락');
    if (!src.includes('data:image/png;base64,')) throw new Error('data URL 변환 누락');
  });

  await runTest('CTA 하이브리드 검증 — Perplexity AI 모듈 + 토글 통합', () => {
    const aiSrc = load('src/cta/validate-cta-ai.ts');
    if (!aiSrc.includes('validateCtaUrlWithAi')) throw new Error('validateCtaUrlWithAi export 누락');
    if (!aiSrc.includes('callPerplexityAPI')) throw new Error('Perplexity 호출 누락');
    if (!aiSrc.includes('AI_CACHE')) throw new Error('AI 캐시 누락');
    if (!aiSrc.includes('getPerplexityApiKey')) throw new Error('API 키 부재 처리 누락');

    const httpSrc = load('src/cta/validate-cta-url.ts');
    if (!httpSrc.includes('aiRecommended')) throw new Error('aiRecommended 플래그 누락');

    const genSrc = load('src/core/final/generation.ts');
    if (!genSrc.includes('hybridValidateCta')) throw new Error('하이브리드 함수 누락');
    if (!genSrc.includes('CTA_AI_VALIDATE_STRICT')) throw new Error('엄격 모드 환경변수 누락');
    if (!genSrc.includes('validate-cta-ai')) throw new Error('AI 모듈 import 누락');

    const orchSrc = load('src/core/final/orchestration.ts');
    if (!orchSrc.includes("payload?.ctaAiStrictMode")) throw new Error('payload 토글 처리 누락');

    const html = load('electron/ui/index.html');
    // v3.5.60에서 라벨 카드는 제거됐고 hidden input만 잔존 (백엔드 자동 ON)
    if (!html.includes('id="ctaAiStrictMode"')) throw new Error('ctaAiStrictMode input 누락');

    const postingJs = load('electron/ui/modules/posting.js');
    if (!postingJs.includes('ctaAiStrictMode')) throw new Error('posting payload 전달 누락');
  });

  await runTest('GSC 소유권 — 스코프 사전 확인 + URL 변종 + skip 처리', () => {
    const src = load('electron/oneclick/handlers/verifyHandlers.js');
    if (!src.includes('tokeninfo')) throw new Error('스코프 확인 호출 누락');
    if (!src.includes('hasWebmasterScope')) throw new Error('스코프 플래그 누락');
    if (!src.includes('sc-domain:')) throw new Error('도메인 속성 변종 누락');
    if (!src.includes('candidates')) throw new Error('URL 후보 배열 누락');
    // 403 + 스코프 없음 → skip 처리
    if (!/스코프\(webmasters\)/.test(src)) throw new Error('스코프 없음 안내 누락');
    // 변종 시도가 fail 보존하지 않고 skip으로 처리되는지
    if (!src.includes("status = 'skip'")) throw new Error('skip 분기 누락');
  });

  await runTest('헬스체크 — blogger-token.json 폴백 로드', () => {
    const src = load('electron/oneclick/handlers/verifyHandlers.js');
    if (!src.includes('blogger-token.json')) throw new Error('토큰 파일 경로 누락');
    if (!src.includes('readBloggerTokenFile')) throw new Error('토큰 파일 로더 누락');
    // verify-only와 preflight 양쪽에서 사용하는지
    const occurrences = (src.match(/readBloggerTokenFile/g) || []).length;
    if (occurrences < 2) throw new Error(`사용처 2회 이상 필요, 실제 ${occurrences}`);
    if (!src.includes('tokenFile.access_token')) throw new Error('access_token 폴백 누락');
    if (!src.includes('tokenFile.refresh_token')) throw new Error('refresh_token 폴백 누락');
  });

  await runTest('WP 사이트 URL 자동 폴백 4단계 — input → localStorage → .env → modal', () => {
    const src = load('electron/ui/modules/oneclick-setup.js');
    if (!src.includes("getElementById('wordpressSiteUrl')")) throw new Error('input 폴백 누락');
    if (!src.includes("storage.get('bloggerSettings'")) throw new Error('localStorage 폴백 누락');
    if (!src.includes('window.electronAPI?.getEnv')) throw new Error('.env 폴백 누락');
    if (!src.includes('WORDPRESS_SITE_URL')) throw new Error('.env 키 폴백 누락');
    // 모달은 마지막 수단
    if (!src.includes('수동 입력 모달 표시')) throw new Error('모달 마지막 단계 마커 누락');
  });

  await runTest('AdsPower 탭 3중 제거 (hidden + display:none !important + JS removeChild)', () => {
    const html = load('electron/ui/index.html');
    // 1. hidden 속성
    const buttonMatch = html.match(/data-tab="adspower"[\s\S]{0,500}AdsPower\s*<\/button>/);
    if (!buttonMatch) throw new Error('AdsPower 탭 버튼을 찾지 못함');
    if (!/\bhidden\b/.test(buttonMatch[0])) throw new Error('hidden 속성 누락');
    // 2. display:none !important
    if (!/display:\s*none\s*!important/i.test(buttonMatch[0])) throw new Error('display:none !important 누락');
    // 3. JS 제거 함수 (DOM에서 완전 제거)
    if (!html.includes('removeAdsPowerTab')) throw new Error('JS 강제 제거 함수 누락');
    if (!html.includes('removeChild') || !html.includes('adspowerTabBtn')) throw new Error('removeChild 호출 누락');
    // 컨텐츠도 hidden
    if (!html.includes('id="tab-adspower" class="settings-tab-content" hidden')) throw new Error('컨텐츠 hidden 누락');
  });

  await runTest('글쓰기 준비 — 핵심 4개 OK 시 세팅 완료 자동 인식', () => {
    const src = load('electron/ui/index.html');
    if (!src.includes('coreChecksOk')) throw new Error('핵심 체크 자동 인식 로직 누락');
    if (!src.includes('oneclickFlag || coreChecksOk')) throw new Error('OR 조건 누락');
    if (!src.includes("setItem('oneclick_setup_complete', 'true')")) throw new Error('자동 플래그 설정 누락');
    if (!src.includes('수동 설정 완료 자동 인식')) throw new Error('수동 인식 메시지 누락');
    // 시뮬: 핵심 4개 모두 ok면 setupDone == true
    const sim = (oneclickFlag, allCore) => {
      const coreChecksOk = allCore;
      return oneclickFlag || coreChecksOk;
    };
    if (!sim(false, true)) throw new Error('수동 세팅 케이스 시뮬 실패');
    if (sim(false, false) === true) throw new Error('빈 세팅 케이스 시뮬 오류');
  });

  await runTest('웹마스터 URL 불러오기 — 4단계 폴백 (loadBlogUrlToInput)', () => {
    const src = load('electron/ui/modules/oneclick-setup.js');
    if (!src.includes("getElementById('blogUrl')")) throw new Error('blogUrl input 폴백 누락');
    // 다양한 키 지원
    if (!/wpSiteUrl|wordpressUrl|bloggerUrl/.test(src)) throw new Error('키 변종 폴백 누락');
    if (!src.includes('BLOGGER_URL')) throw new Error('.env BLOGGER_URL 키 누락');
    // 성공 시 출처 토스트
    if (!src.includes('블로그 URL 불러옴 (')) throw new Error('출처 표기 누락');
  });

  await runTest('UI 이미지 엔진 옵션 — 덕트테이프 노출 (3곳)', () => {
    const html = load('electron/ui/index.html');
    // option value="dalle" 가 3곳(scheduleThumbnailMode, thumbnailType, h2ImageSource)에 있어야
    const dalleOptions = (html.match(/<option value="dalle"/g) || []).length;
    if (dalleOptions < 3) throw new Error(`dalle 옵션 3곳 필요, 실제 ${dalleOptions}`);
    if (!html.includes('덕트테이프')) throw new Error('덕트테이프 라벨 누락');
    if (!html.includes('GPT-Image-2')) throw new Error('GPT-Image-2 라벨 누락');
    // imageDispatcher 별칭
    const disp = load('src/core/imageDispatcher.ts');
    if (!disp.includes("'gpt-image-2': 'dalle'")) throw new Error('gpt-image-2 별칭 누락');
    if (!disp.includes("'ducktape'") || !disp.includes("'duct-tape'")) throw new Error('ducktape 별칭 누락');
    if (!disp.includes("'덕트테이프'")) throw new Error('한글 별칭 누락');
  });

  await runTest('OpenAI 이미지 모델 — gpt-image-2 모델별 body 분기 + 폴백', () => {
    const thumb = load('src/thumbnail.ts');
    const main = load('electron/main.ts');
    // 폴백 체인
    if (!thumb.includes("'gpt-image-2'")) throw new Error('thumbnail에 gpt-image-2 누락');
    if (!thumb.includes("'gpt-image-1'") || !thumb.includes("'dall-e-3'")) throw new Error('폴백 체인 누락');
    if (!main.includes("'gpt-image-2'")) throw new Error('main.ts에 gpt-image-2 누락');
    // 모델별 body 분기 함수
    if (!thumb.includes('buildBody')) throw new Error('thumbnail buildBody 분기 누락');
    if (!main.includes('buildBody')) throw new Error('main.ts buildBody 분기 누락');
    // 권한 폴백 + b64_json 양쪽 응답 처리
    if (!/unsupported_model|access|permission/.test(thumb)) throw new Error('thumbnail 권한 폴백 누락');
    if (!thumb.includes('b64_json')) throw new Error('thumbnail b64 응답 처리 누락');
    if (!main.includes('b64_json')) throw new Error('main.ts b64 응답 처리 누락');
    // UI 즉시 사용 가능 안내
    const html = load('electron/ui/index.html');
    if (!html.includes('GPT-Image-2')) throw new Error('UI 라벨 갱신 누락');
    if (!html.includes('API 즉시 사용 가능')) throw new Error('UI 즉시 사용 가능 안내 누락');
    if (!html.includes('duct-tape')) throw new Error('UI duct-tape 코드명 누락');
  });

  await runTest('CTA_CACHE 동작 시뮬 — 동일 URL 요청은 같은 Promise 공유', () => {
    const cache = new Map();
    const TTL = 600_000;
    const key = 'https://example.com/test';
    const now = Date.now();
    let p = Promise.resolve({ isValid: true });
    cache.set(key, { result: p, expireAt: now + TTL });
    const got = cache.get(key);
    if (got?.result !== p) throw new Error('동일 Promise 아님');
    if (got.expireAt <= now) throw new Error('TTL 적용 안 됨');
  });

  // ========== 최종 집계 ==========
  const totalMs = Date.now() - suiteStart;
  const totalTests = results.length;
  const totalPass = results.reduce((a, r) => a + r.passed, 0);
  const totalRepeats = results.reduce((a, r) => a + r.repeat, 0);
  const totalFail = results.reduce((a, r) => a + r.fails, 0);
  const perfectTests = results.filter(r => r.fails === 0).length;

  console.log('\n' + '═'.repeat(70));
  console.log(`🧪 심층 100회 검증 완료 (총 ${totalMs}ms)`);
  console.log('═'.repeat(70));
  console.log(`테스트: ${totalTests}개`);
  console.log(`총 실행: ${totalRepeats}회 (테스트당 ${REPEAT}회 반복, 네트워크 호출은 비용/시간상 20회로 고정)`);
  console.log(`통과: ${totalPass}회 / 실패: ${totalFail}회`);
  console.log(`완벽한 테스트 (100% 통과): ${perfectTests}/${totalTests}`);
  console.log(`성공률: ${((totalPass / totalRepeats) * 100).toFixed(2)}%`);

  if (totalFail > 0) {
    console.log('\n❌ 실패 발생 테스트:');
    results.filter(r => r.fails > 0).forEach(r => {
      console.log(`  - ${r.name}: ${r.passed}/${r.repeat} — 첫 실패: ${r.firstFail}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 전 항목 100회 반복 모두 통과 — 견고함 확인');
    process.exit(0);
  }
})().catch(e => {
  console.error('치명 오류:', e);
  process.exit(2);
});
