/**
 * Blogger OAuth 원클릭 연동 테스트
 * 사용자가 직접 로그인 → 자동 완료까지 추적
 */
const { _electron: electron } = require('playwright');

(async () => {
  console.log('[TEST] 앱 실행...');
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  const window = await app.firstWindow();
  await window.waitForTimeout(7000);
  console.log('[TEST] 메인 윈도우 로드 완료');

  // 콘솔 로그 캡처 (중요한 것만)
  window.on('console', (msg) => {
    const t = msg.text().substring(0, 300);
    if (t.includes('ONECLICK') || t.includes('CONNECT') || t.includes('Blogger') ||
        t.includes('OAuth') || t.includes('연동') || t.includes('blogger') ||
        t.includes('error') || t.includes('Error') || t.includes('완료') ||
        t.includes('실패')) {
      console.log(`[RENDERER] ${t}`);
    }
  });

  // 원클릭 셋업 탭으로 이동
  console.log('[TEST] 원클릭 셋업 탭으로 이동...');
  await window.evaluate(() => {
    if (typeof window.showTab === 'function') window.showTab('settings');
    setTimeout(() => {
      if (typeof window.switchSettingsTab === 'function') window.switchSettingsTab('oneclick-setup');
    }, 300);
  });
  await window.waitForTimeout(2000);

  // 기존 세팅 있으면 강제로 지우기 (체크 우회)
  await window.evaluate(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('bloggerSettings') || '{}');
      delete settings.googleClientId;
      delete settings.googleClientSecret;
      delete settings.blogId;
      localStorage.setItem('bloggerSettings', JSON.stringify(settings));
      console.log('[TEST] 기존 세팅 초기화');
    } catch {}
  });

  // Blogger OAuth 시작 버튼 찾기
  const btnInfo = await window.evaluate(() => {
    const btn = document.getElementById('oneclick-connect-btn-blogspot') ||
                document.getElementById('oneclick-connect-btn-blogger');
    return {
      exists: !!btn,
      visible: btn ? btn.offsetParent !== null : false,
      text: btn?.textContent?.trim().substring(0, 50) || '',
      id: btn?.id || ''
    };
  });
  console.log('[TEST] Blogger 연동 버튼:', btnInfo);

  if (!btnInfo.exists) {
    console.log('[TEST] ❌ 버튼을 찾을 수 없습니다.');
    await app.close();
    return;
  }

  // 버튼 클릭 (직접 함수 호출)
  console.log('[TEST] 🚀 Blogger OAuth 연동 시작...');
  await window.evaluate(() => {
    if (typeof window.startPlatformConnect === 'function') {
      window.startPlatformConnect('blogspot');
    } else {
      // 폴백: 버튼 클릭
      document.getElementById('oneclick-connect-btn-blogspot')?.click();
    }
  });

  console.log('[TEST] ⏳ 사용자 로그인 대기 중... (Playwright가 연 브라우저에서 직접 Google 로그인 해주세요)');
  console.log('[TEST] 최대 5분 대기');

  // 5분간 폴링 (300초)
  let lastMsg = '';
  for (let i = 0; i < 60; i++) {
    await window.waitForTimeout(5000);
    const status = await window.evaluate(() => {
      const msgDiv = document.getElementById('oneclick-connect-msg-blogspot') ||
                     document.getElementById('oneclick-connect-msg-blogger');
      return {
        msg: msgDiv?.textContent?.trim() || '',
        settings: (() => {
          try {
            return JSON.parse(localStorage.getItem('bloggerSettings') || '{}');
          } catch { return {}; }
        })(),
      };
    });

    if (status.msg && status.msg !== lastMsg) {
      console.log(`[${(i+1)*5}초] ${status.msg}`);
      lastMsg = status.msg;
    }

    // 완료 감지: googleClientId/blogId 저장됨
    if (status.settings.googleClientId && status.settings.blogId) {
      console.log('[TEST] ✅ 연동 완료!');
      console.log('[TEST] googleClientId:', status.settings.googleClientId.substring(0, 20) + '...');
      console.log('[TEST] blogId:', status.settings.blogId);
      break;
    }

    // 에러 감지
    if (status.msg.includes('❌') || status.msg.includes('실패')) {
      console.log('[TEST] ❌ 에러 감지, 종료');
      break;
    }
  }

  // 최종 상태
  const final = await window.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('bloggerSettings') || '{}');
    return {
      googleClientId: settings.googleClientId || '(없음)',
      googleClientSecret: settings.googleClientSecret ? '(있음)' : '(없음)',
      blogId: settings.blogId || '(없음)',
    };
  });
  console.log('[TEST] 최종 환경설정:', final);

  console.log('[TEST] 30초 후 종료 (확인 시간)...');
  await window.waitForTimeout(30000);
  await app.close();
})().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
