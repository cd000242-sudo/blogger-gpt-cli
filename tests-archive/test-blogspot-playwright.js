/**
 * 블로그스팟 발행 테스트 (Playwright CDP -> Electron)
 * 키워드: 2026 소상공인 '고금리 대환대출' 지원사업 조건
 */
const { chromium } = require('playwright');

(async () => {
    let browser;
    try {
        console.log('🔗 Electron 앱에 CDP로 연결 중...');
        browser = await chromium.connectOverCDP('http://localhost:9222');
        const mainPage = browser.contexts()[0].pages().find(p => p.url().includes('index.html'));
        if (!mainPage) throw new Error('메인 페이지를 찾을 수 없습니다');
        console.log(`✅ 연결 성공: ${await mainPage.title()}`);

        // 1. 플랫폼을 blogger로 변경 (설정 직접 변경)
        console.log('\n🔄 1단계: 플랫폼을 blogger로 변경...');
        await mainPage.evaluate(() => {
            // 설정에서 플랫폼 변경
            const settings = JSON.parse(localStorage.getItem('blogSettings') || '{}');
            settings.platform = 'blogger';
            localStorage.setItem('blogSettings', JSON.stringify(settings));
            // UI 업데이트
            const platformStatus = document.getElementById('platformStatus');
            if (platformStatus) platformStatus.textContent = 'Blogger';
            const platformName = document.getElementById('platformName');
            if (platformName) platformName.textContent = 'Blogspot (Blogger)';
            const platformIcon = document.getElementById('platformIcon');
            if (platformIcon) platformIcon.textContent = '📝';
            // togglePlatformFields가 있으면 호출
            if (typeof window.togglePlatformFields === 'function') {
                window.togglePlatformFields();
            }
        });
        const currentPlatform = await mainPage.$eval('#platformStatus', el => el.textContent).catch(() => 'unknown');
        console.log(`✅ 현재 플랫폼: ${currentPlatform}`);

        // 2. 키워드 입력
        console.log('\n📝 2단계: 키워드 입력...');
        // evaluate로 직접 키워드 입력 (fill이 Electron에서 안 될 수 있음)
        await mainPage.evaluate(() => {
        const kw = document.getElementById('keywordInput');
        if (kw) {
          kw.value = "2026 소상공인 '고금리 대환대출' 지원사업 조건";
            kw.dispatchEvent(new Event('input', { bubbles: true }));
          kw.dispatchEvent(new Event('change', { bubbles: true }));
          }
    });
    const kwValue = await mainPage.$eval('#keywordInput', el => el.value);
    console.log(`✅ 키워드 입력 완료: "${kwValue}"`);
    if (!kwValue) throw new Error('키워드 입력 실패');

        // 3. 발행 전 스크린샷 
        await mainPage.screenshot({ path: 'test-blogspot-before.png', fullPage: false });
        console.log('📸 발행 전 스크린샷 저장');

        // 4. 발행 버튼 클릭
        console.log('\n🚀 3단계: 발행 시작!');
        const publishBtn = await mainPage.$('#publishBtn');
        if (publishBtn) {
            await publishBtn.click();
            console.log('✅ 발행 버튼 클릭 완료');
        } else {
            throw new Error('#publishBtn을 찾을 수 없습니다');
        }

        // 5. 진행 상황 모니터링 (최대 10분)
        console.log('\n⏳ 4단계: 진행 상황 모니터링 (최대 10분)...');
        const startTime = Date.now();
        const maxWait = 10 * 60 * 1000;
        let lastLog = '';
        let completed = false;

        while (Date.now() - startTime < maxWait && !completed) {
            await mainPage.waitForTimeout(3000);

            // 프로그레스 모달 체크
            const progressText = await mainPage.evaluate(() => {
                const pct = document.getElementById('progressPercentage');
                const step = document.getElementById('progressStep');
                const logArea = document.getElementById('logContent') || document.getElementById('progressLog');
                return {
                    percentage: pct?.textContent || '',
                    step: step?.textContent || '',
                    lastLog: logArea ? logArea.innerText?.split('\n').slice(-3).join(' | ') : ''
                };
            }).catch(() => ({ percentage: '', step: '', lastLog: '' }));

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

            if (progressText.lastLog && progressText.lastLog !== lastLog) {
                console.log(`📊 [${elapsed}s] ${progressText.percentage} ${progressText.step}`);
                console.log(`   ${progressText.lastLog}`);
                lastLog = progressText.lastLog;
            }

            // 완료 체크
            if (progressText.percentage === '100%' ||
                progressText.step?.includes('완료') ||
                progressText.step?.includes('실패') ||
                progressText.step?.includes('발행 완료') ||
                progressText.lastLog?.includes('발행 완료') ||
                progressText.lastLog?.includes('발행 실패') ||
                progressText.lastLog?.includes('Cannot find module')) {
                completed = true;
                console.log(`\n${progressText.step?.includes('실패') || progressText.lastLog?.includes('실패') ? '❌' : '✅'} 작업 완료!`);
            }
        }

        if (!completed) {
            console.log('⏰ 10분 타임아웃');
        }

        // 6. 최종 결과 스크린샷
        await mainPage.screenshot({ path: 'test-blogspot-result.png', fullPage: false });
        console.log('📸 최종 결과 스크린샷 저장');

        // 7. 최종 로그 출력
        const finalLog = await mainPage.evaluate(() => {
            const logArea = document.getElementById('logContent') || document.getElementById('progressLog');
            return logArea ? logArea.innerText : '로그 없음';
        }).catch(() => '로그 없음');

        console.log('\n📋 === 최종 로그 (마지막 30줄) ===');
        finalLog.split('\n').slice(-30).forEach(line => {
            if (line.trim()) console.log(`  ${line}`);
        });

    } catch (error) {
        console.error('❌ 테스트 실패:', error.message);
    } finally {
        if (browser) browser.close();
        console.log('\n✅ 테스트 스크립트 종료');
    }
})();
