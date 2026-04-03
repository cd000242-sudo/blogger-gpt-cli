/**
 * Playwright Electron 연동 WordPress 발행 자동 테스트 v3
 * 
 * 정확한 셀렉터:
 * - 키워드 입력: #keywordInput (textarea)
 * - 발행 버튼: #publishBtn (onclick=publishToPlatform)
 */

const { _electron: electron } = require('playwright');
const path = require('path');

const KEYWORD = '2026 청년미래적금 신청방법 : 청년도약계좌 유지하면 바보? 수익률 갈아타기 팩트체크';

let screenshotCounter = 1;

async function screenshot(window, label) {
    const name = `screenshots/${String(screenshotCounter++).padStart(2, '0')}-${label}.png`;
    await window.screenshot({ path: name });
    console.log(`  📸 ${name}`);
}

(async () => {
    console.log('🚀 Playwright Electron 테스트 v3 시작\n');

    // 1. Electron 앱 실행
    const electronApp = await electron.launch({
        args: [path.join(__dirname, '.')],
        env: {
            ...process.env,
            NODE_ENV: 'development',
        },
    });

    console.log('✅ Electron 앱 실행됨');

    // 앱 콘솔 로그 캡처
    const appLogs = [];
    electronApp.on('console', (msg) => {
        const text = msg.text();
        appLogs.push(text);
        // 중요 로그만 출력
        if (text.includes('[PUBLISH]') || text.includes('[RUN-POST]') ||
            text.includes('[PROGRESS]') || text.includes('❌') ||
            text.includes('✅') || text.includes('에러') || text.includes('오류') ||
            text.includes('[WP]') || text.includes('WordPress') || text.includes('워드프레스') ||
            text.includes('agent') || text.includes('에이전트')) {
            console.log(`  [앱] ${text.substring(0, 250)}`);
        }
    });

    // 2. 첫 번째 윈도우 대기
    const window = await electronApp.firstWindow();
    console.log('✅ 윈도우:', await window.title());
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(4000);
    await screenshot(window, 'initial');

    // 3. "완전 자동 발행" 탭 클릭
    console.log('\n📌 "완전 자동 발행" 탭 클릭...');
    const autoTab = await window.$('text=완전 자동 발행');
    if (autoTab) {
        await autoTab.click();
        console.log('  ✅ 탭 클릭 성공');
    }
    await window.waitForTimeout(1500);
    await screenshot(window, 'auto-tab');

    // 4. 키워드 입력 (#keywordInput textarea)
    console.log('\n🔑 키워드 입력 (#keywordInput)...');
    const keywordField = await window.$('#keywordInput');
    if (keywordField) {
        await keywordField.scrollIntoViewIfNeeded();
        await keywordField.click();
        await window.waitForTimeout(300);
        await keywordField.fill(KEYWORD);

        // 값 확인
        const val = await keywordField.inputValue();
        console.log(`  ✅ 입력 완료: "${val.substring(0, 60)}..." (길이: ${val.length})`);
    } else {
        console.log('  ❌ #keywordInput 필드를 찾지 못했습니다!');
        await electronApp.close();
        return;
    }

    await window.waitForTimeout(500);
    await screenshot(window, 'keyword-filled');

    // 5. 아래로 스크롤하여 발행 버튼 보이게 하기
    console.log('\n📜 발행 버튼으로 스크롤...');
    const publishBtn = await window.$('#publishBtn');
    if (publishBtn) {
        await publishBtn.scrollIntoViewIfNeeded();
        await window.waitForTimeout(500);
        const text = await publishBtn.textContent();
        console.log(`  발행 버튼: "${text.trim()}"`);
        await screenshot(window, 'publish-ready');

        // 6. 발행 버튼 클릭!
        console.log('\n🚀 발행 버튼 클릭!');
        await publishBtn.click();
        console.log('  ✅ 클릭 완료!');
    } else {
        console.log('  ⚠️ #publishBtn 없음, JS 호출 fallback...');
        await window.evaluate(() => {
            if (typeof publishToPlatform === 'function') publishToPlatform();
        });
    }

    await window.waitForTimeout(2000);
    await screenshot(window, 'after-click');

    // 7. 발행 진행 모니터링 (최대 300초 = 5분)
    console.log('\n⏳ 발행 진행 모니터링 (최대 5분)...\n');

    const startTime = Date.now();
    const maxWait = 300000;
    let finished = false;
    let lastScreenshotTime = Date.now();

    while (Date.now() - startTime < maxWait && !finished) {
        await window.waitForTimeout(5000); // 5초마다 확인
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        try {
            const status = await window.evaluate(() => {
                // 로그 마지막 줄
                const logLines = document.querySelectorAll('#logArea div, .log-line');
                let lastLog = '';
                if (logLines.length > 0) {
                    lastLog = logLines[logLines.length - 1].textContent || '';
                }

                // 전체 텍스트에서 상태 확인
                const bodyText = document.body.innerText;
                const hasComplete = bodyText.includes('발행 완료') || bodyText.includes('✅ 발행');
                const hasFailed = bodyText.includes('발행 실패') || bodyText.includes('❌ 오류');
                const hasKeywordError = bodyText.includes('키워드를 입력');

                // 진행률
                const progressEl = document.querySelector('#progress-percent, .progress-text');
                const progressText = progressEl ? progressEl.textContent : '';

                return { lastLog: lastLog.substring(0, 200), hasComplete, hasFailed, hasKeywordError, progressText };
            });

            if (status.progressText) {
                console.log(`  [${elapsed}s] 진행: ${status.progressText}`);
            }
            if (status.lastLog && status.lastLog.length > 5) {
                console.log(`  [${elapsed}s] 로그: ${status.lastLog}`);
            }
            if (status.hasKeywordError) {
                console.log(`\n  ❌ [${elapsed}s] 키워드 입력 에러!`);
                finished = true;
                await screenshot(window, 'keyword-error');
            }
            if (status.hasComplete) {
                console.log(`\n  ✅ [${elapsed}s] 발행 완료!`);
                finished = true;
                await screenshot(window, 'complete');
            }
            if (status.hasFailed) {
                console.log(`\n  ❌ [${elapsed}s] 발행 실패 감지`);
                finished = true;
                await screenshot(window, 'failed');
            }
        } catch (e) {
            if (e.message.includes('Target closed')) {
                console.log('  ⚠️ 윈도우 닫힘');
                break;
            }
        }

        // 30초마다 스크린샷
        if (Date.now() - lastScreenshotTime > 30000) {
            try {
                await screenshot(window, `progress-${elapsed}s`);
                lastScreenshotTime = Date.now();
            } catch (e) { /* 무시 */ }
        }
    }

    if (!finished) {
        console.log('\n  ⏰ 타임아웃');
        await screenshot(window, 'timeout');
    }

    // 8. 주요 앱 로그 출력
    console.log('\n📋 주요 앱 로그 (마지막 30줄):');
    const important = appLogs.filter(l =>
        l.includes('[PUBLISH]') || l.includes('[RUN-POST]') || l.includes('[WP]') ||
        l.includes('워드프레스') || l.includes('WordPress') || l.includes('에이전트') ||
        l.includes('agent') || l.includes('❌') || l.includes('✅') ||
        l.includes('status') || l.includes('publish') || l.includes('[PROGRESS]')
    );
    for (const line of important.slice(-30)) {
        console.log(`  ${line.substring(0, 300)}`);
    }

    // 9. 종료
    console.log('\n🔚 테스트 종료');
    try { await electronApp.close(); } catch (e) { /* 무시 */ }
    console.log('✅ 완료');
})().catch(err => {
    console.error('❌ 테스트 실패:', err);
    process.exit(1);
});
