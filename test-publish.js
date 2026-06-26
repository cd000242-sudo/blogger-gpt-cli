const { _electron: electron } = require('playwright');

(async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  const window = await app.firstWindow();
  await window.waitForTimeout(7000);

  // 콘솔 캡처
  const logs = [];
  window.on('console', (msg) => {
    const t = msg.text().substring(0, 400);
    logs.push(`[${msg.type()}] ${t}`);
    // 실시간으로 중요 로그 출력
    if (t.includes('PROGRESS') || t.includes('POSTING') || t.includes('Error') ||
        t.includes('오류') || t.includes('실패') || t.includes('성공') || t.includes('발행')) {
      console.log(`  >> ${t.substring(0, 200)}`);
    }
  });

  // 1. 키워드 입력
  const keyword = '🚀 [신설] 2026 \'제조업 AI 자율제조\' 도입 보조금: 공장 자동화 및 로봇 연동비 10억 지원';
  await window.evaluate((kw) => {
    const el = document.getElementById('keywordInput');
    if (el) {
      el.value = kw;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, keyword);
  console.log('[TEST] 키워드 입력 완료:', keyword);

  // 2. "키워드 제목 그대로 사용" 체크
  await window.evaluate(() => {
    const checkbox = document.getElementById('useKeywordAsTitle');
    if (checkbox && !checkbox.checked) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  console.log('[TEST] useKeywordAsTitle 체크 완료');

  // 3. 블로그스팟(Blogger) 플랫폼 선택
  await window.evaluate(() => {
    const radios = document.querySelectorAll('input[name="platform"]');
    for (const r of radios) {
      if (r.value === 'blogger' || r.value === 'blogspot') {
        r.checked = true;
        r.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  });
  console.log('[TEST] 플랫폼: 블로그스팟 선택');

  // 4. 상태 초기화
  await window.evaluate(() => {
    if (window.appState) {
      window.appState.generatedContent = null;
      window.appState.isRunning = false;
    }
  });

  // 5. 발행 실행
  console.log('[TEST] ===== publishToPlatform() 호출 =====');
  console.log('[TEST] 시작 시간:', new Date().toLocaleTimeString('ko-KR'));

  const result = await window.evaluate(async () => {
    try {
      await window.runPosting();
      const st = window.appState || {};
      return {
        ok: true,
        title: st.generatedContent?.title || '',
        contentLen: st.generatedContent?.content?.length || 0,
        url: st.generatedContent?.payload?.url || '',
      };
    } catch (e) {
      return { ok: false, error: e.message, stack: e.stack?.substring(0, 500) };
    }
  });

  console.log('\n[TEST] ===== 결과 =====');
  console.log('[TEST] 완료 시간:', new Date().toLocaleTimeString('ko-KR'));
  console.log('[TEST] 결과:', JSON.stringify(result, null, 2));

  // 발행 URL 확인
  const postUrl = await window.evaluate(() => {
    // 로그에서 URL 찾기
    const logEl = document.getElementById('logArea') || document.getElementById('progressLogContent');
    const text = logEl?.textContent || '';
    const urlMatch = text.match(/https?:\/\/[^\s<>"]+blogspot[^\s<>"]+/);
    return urlMatch ? urlMatch[0] : '(URL 못 찾음)';
  });
  console.log('[TEST] 발행 URL:', postUrl);

  // 마지막 20줄 로그
  console.log('\n=== 마지막 로그 ===');
  logs.slice(-20).forEach(l => console.log(l));

  await app.close();
  console.log('\n[TEST] 완료!');
})().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
