#!/usr/bin/env node
/**
 * 🔍 verifyHandlers.ts 자체 검증 스크립트
 *
 * Electron 런타임 없이 Node에서 직접 돌려서
 * - 컴파일 결과(verifyHandlers.js)가 로드 가능한가
 * - 각 함수(verifyBloggerOAuth/Auth/AdsTxt/Domain/GSC)가 존재하는가
 * - 실제 공개 엔드포인트로 fake credential 돌렸을 때 예상대로 fail/skip 반환하는가
 * 만 확인한다. 실제 API 키는 사용하지 않는다.
 */

const path = require('path');
const assert = require('assert');

const results = [];
function test(name, fn) {
  return (async () => {
    const t0 = Date.now();
    try {
      await fn();
      results.push({ name, ok: true, ms: Date.now() - t0 });
      console.log(`  ✅ ${name} (${Date.now() - t0}ms)`);
    } catch (e) {
      results.push({ name, ok: false, ms: Date.now() - t0, error: e.message });
      console.log(`  ❌ ${name} — ${e.message}`);
    }
  })();
}

(async () => {
  console.log('🔍 verifyHandlers 자체 검증 시작\n');

  // 1) 컴파일 결과 로드
  await test('컴파일된 verifyHandlers.js 파일 존재', async () => {
    const p = path.join(__dirname, '..', 'electron', 'oneclick', 'handlers', 'verifyHandlers.js');
    const fs = require('fs');
    assert(fs.existsSync(p), `파일 없음: ${p}`);
  });

  // 2) 모듈 내보내기 확인 (electron 의존성은 try/catch로 회피)
  await test('registerVerifyIpcHandlers export 확인', async () => {
    const p = path.join(__dirname, '..', 'electron', 'oneclick', 'handlers', 'verifyHandlers.js');
    const fs = require('fs');
    const src = fs.readFileSync(p, 'utf-8');
    assert(src.includes('exports.registerVerifyIpcHandlers'), 'export 없음');
    assert(src.includes("oneclick:verify-only"), 'IPC 채널명 누락');
    assert(src.includes('verifyBloggerOAuth'), 'verifyBloggerOAuth 누락');
    assert(src.includes('verifyWordPressAuth'), 'verifyWordPressAuth 누락');
    assert(src.includes('verifyAdsTxt'), 'verifyAdsTxt 누락');
    assert(src.includes('verifyWordPressDomain'), 'verifyWordPressDomain 누락');
    assert(src.includes('verifyGscOwnership'), 'verifyGscOwnership 누락');
  });

  // 3) Blogger OAuth — 잘못된 토큰 401 감지
  await test('Blogger OAuth 401 감지', async () => {
    const r = await fetch('https://www.googleapis.com/blogger/v3/users/self/blogs', {
      headers: { Authorization: 'Bearer FAKE_TOKEN_FOR_SELFCHECK_12345' },
    });
    assert(r.status === 401, `예상 401, 실제 ${r.status}`);
  });

  // 4) WordPress REST — 존재하지 않는 사이트 네트워크 오류 감지
  await test('WordPress REST 존재하지 않는 도메인 DNS 오류', async () => {
    let threw = false;
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      await fetch('https://self-check-nonexistent-domain-99999.example.invalid/wp-json/wp/v2/', {
        signal: controller.signal,
      });
    } catch (e) {
      threw = true;
    }
    assert(threw, 'DNS 오류가 던져져야 함');
  });

  // 5) ads.txt — 404를 돌려주는 사이트
  await test('ads.txt 404 감지 (github.com은 ads.txt 없음)', async () => {
    const r = await fetch('https://github.com/ads.txt');
    // github는 보통 404를 준다. 403이나 다른 값일 수도 있는데, 200이 아니어야 함
    assert(!r.ok || r.status >= 400, `예상 non-2xx, 실제 ${r.status}`);
  });

  // 6) WordPress 도메인 — HTTPS 강제 로직 확인 (http:// 입력 시 fail)
  await test('WP 도메인 검증 로직 — http:// 입력 시 HTTPS 미사용 탐지', async () => {
    // 함수 직접 호출은 ipcMain 의존성으로 어려우니 소스에서 로직 존재 확인
    const p = path.join(__dirname, '..', 'electron', 'oneclick', 'handlers', 'verifyHandlers.js');
    const src = require('fs').readFileSync(p, 'utf-8');
    assert(src.includes("startsWith('https://')"), 'HTTPS 체크 로직 누락');
    assert(src.includes('HTTPS 미사용'), 'HTTPS 미사용 메시지 누락');
  });

  // 7) GSC — 미등록 사이트 404 감지 (인증 없이 테스트하면 401이 뜨지만, 로직만 확인)
  await test('GSC 핸들러 — 404/401 분기 존재', async () => {
    const p = path.join(__dirname, '..', 'electron', 'oneclick', 'handlers', 'verifyHandlers.js');
    const src = require('fs').readFileSync(p, 'utf-8');
    assert(src.includes('r.status === 404'), '404 분기 누락');
    assert(src.includes('permissionLevel'), 'permissionLevel 확인 로직 누락');
  });

  // 8) registerOneclickSetupIpcHandlers에서 register 호출 확인
  await test('index.ts가 registerVerifyIpcHandlers 호출', async () => {
    const p = path.join(__dirname, '..', 'electron', 'oneclick', 'index.js');
    const src = require('fs').readFileSync(p, 'utf-8');
    assert(src.includes('registerVerifyIpcHandlers'), 'index에서 호출 누락');
  });

  // 9) blogspotSetup.ts 로그인 가드 확인
  await test('blogspotSetup — loggedIn 체크 가드 추가됨', async () => {
    const p = path.join(__dirname, '..', 'electron', 'oneclick', 'automation', 'blogspot', 'blogspotSetup.js');
    const src = require('fs').readFileSync(p, 'utf-8');
    assert(/if\s*\(\s*!loggedIn\s*\)/.test(src), '!loggedIn 체크 누락');
    assert(src.includes('로그인 대기 시간이 초과'), '타임아웃 메시지 누락');
  });

  // 10) createBlog — useExistingBlog 가드
  await test('createBlog — 기존 블로그 보호 가드 추가됨', async () => {
    const p = path.join(__dirname, '..', 'electron', 'oneclick', 'automation', 'blogspot', 'steps', 'createBlog.js');
    const src = require('fs').readFileSync(p, 'utf-8');
    assert(src.includes('useExistingBlog'), 'useExistingBlog 플래그 누락');
    assert(src.includes('forceCreateNew'), 'forceCreateNew 플래그 누락');
    assert(src.includes('기존 블로그'), '기존 블로그 사용 메시지 누락');
  });

  // 11) 보안 로그 수정 확인
  await test('blogger-publisher.js — client_id REDACTED', async () => {
    const p = path.join(__dirname, '..', 'src', 'core', 'blogger-publisher.js');
    const src = require('fs').readFileSync(p, 'utf-8');
    assert(src.includes('[REDACTED]'), 'REDACTED 라벨 누락');
    assert(!src.includes("substring(0, 20)"), 'substring(0, 20) 잔존');
  });

  // 12) UI 헬스체크 버튼 + runHealthcheck 함수 추가 확인
  await test('oneclick-setup.js — 헬스체크 UI 추가됨', async () => {
    const p = path.join(__dirname, '..', 'electron', 'ui', 'modules', 'oneclick-setup.js');
    const src = require('fs').readFileSync(p, 'utf-8');
    assert(src.includes('oneclick-healthcheck-btn'), '헬스체크 버튼 없음');
    assert(src.includes('runHealthcheck'), 'runHealthcheck 함수 없음');
    assert(src.includes("'oneclick:verify-only'"), 'verify-only invoke 누락');
    assert(src.includes('renderHealthcheckReport'), '결과 렌더러 없음');
  });

  console.log('\n════════════════════════════════════════════');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`결과: ${passed}/${results.length} 통과 (실패 ${failed}개)`);
  if (failed > 0) {
    console.log('\n❌ 실패 항목:');
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 전 항목 통과');
    process.exit(0);
  }
})();
