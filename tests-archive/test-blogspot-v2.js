/**
 * 블로그스팟 발행 테스트 v2 (포스팅 탭 → 키워드 → 발행)
 */
const { chromium } = require('playwright');

(async () => {
    let browser;
    try {
        console.log('🔗 Electron 앱에 CDP로 연결 중...');
        browser = await chromium.connectOverCDP('http://localhost:9222');
        const page = browser.contexts()[0].pages()[0];
        if (!page) throw new Error('페이지를 찾을 수 없습니다');
        console.log(`✅ 연결 성공: ${await page.title()}`);

        // 1. 플랫폼을 blogger로 설정
        console.log('\n🔄 1단계: 플랫폼을 Blogger로 설정...');
        await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('blogSettings') || '{}');
            settings.platform = 'blogger';
            localStorage.setItem('blogSettings', JSON.stringify(settings));
        });

        // 2. 포스팅 탭으로 이동
        console.log('\n📝 2단계: 포스팅 탭으로 이동...');
        await page.click('#nav-auto');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-blogspot-v2-posting.png' });
        console.log('📸 포스팅 탭 스크린샷 저장');

        // 3. 키워드 입력 필드 찾기 & 입력
        console.log('\n📝 3단계: 키워드 입력...');
        const keyword = "2026 소상공인 '고금리 대환대출' 지원사업 조건";

        // keywordInput 또는 autoKeywordInput 찾기
        const inputExists = await page.evaluate(() => {
            const inputs = [];
            document.querySelectorAll('input[type=text], textarea').forEach(el => {
                if (el.offsetParent !== null) { // visible only
                    inputs.push({ id: el.id, placeholder: el.placeholder, tag: el.tagName });
                }
            });
            return inputs;
        });
        console.log('입력 필드들:', JSON.stringify(inputExists));

        // 키워드 입력 시도
        const inputResult = await page.evaluate((kw) => {
            // 가능한 키워드 입력 필드 ID들
            const possibleIds = ['autoKeywordInput', 'keywordInput', 'keyword-input'];
            for (const id of possibleIds) {
                const el = document.getElementById(id);
                if (el && el.offsetParent !== null) {
                    el.value = kw;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true, id, value: el.value };
                }
            }
            // ID로 못 찾으면 placeholder로 찾기
            const inputs = document.querySelectorAll('input[type=text], textarea');
            for (const inp of inputs) {
                if (inp.placeholder && inp.placeholder.includes('키워드') && inp.offsetParent !== null) {
                    inp.value = kw;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true, id: inp.id || 'placeholder-match', value: inp.value };
                }
            }
            return { success: false, id: 'none' };
        }, keyword);

        console.log('키워드 입력 결과:', JSON.stringify(inputResult));
        if (!inputResult.success) throw new Error('키워드 입력 필드를 찾을 수 없습니다');

        // 4. 발행 버튼 찾기 & 클릭
        console.log('\n🚀 4단계: 발행 버튼 찾기...');
        const publishBtnInfo = await page.evaluate(() => {
            const btns = [];
            document.querySelectorAll('button, .btn, [role=button]').forEach(el => {
                if (el.offsetParent !== null && (
                    el.textContent.includes('발행') ||
                    el.textContent.includes('시작') ||
                    el.textContent.includes('생성') ||
                    el.id.includes('publish') ||
                    el.id.includes('auto') && el.id.includes('Btn')
                )) {
                    btns.push({ id: el.id, text: el.textContent.trim().slice(0, 30), tag: el.tagName });
                }
            });
            return btns;
        });
        console.log('발행 버튼 후보:', JSON.stringify(publishBtnInfo));

        // 발행 버튼 클릭
        const clicked = await page.evaluate(() => {
            const possibleIds = ['autoPublishBtn', 'publishBtn', 'startAutoBtn'];
            for (const id of possibleIds) {
                const btn = document.getElementById(id);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    return { success: true, id };
                }
            }
            // 텍스트로 찾기
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
                if (btn.offsetParent !== null && (btn.textContent.includes('발행') || btn.textContent.includes('시작'))) {
                    btn.click();
                    return { success: true, id: btn.id || btn.textContent.trim().slice(0, 20) };
                }
            }
            return { success: false };
        });
        console.log('발행 클릭 결과:', JSON.stringify(clicked));
        if (!clicked.success) throw new Error('발행 버튼을 찾을 수 없습니다');

        // 5. 진행 상황 모니터링 (최대 10분)
        console.log('\n⏳ 5단계: 진행 상황 모니터링 (최대 10분)...');
        const startTime = Date.now();
        const maxWait = 10 * 60 * 1000;
        let lastLog = '';
        let completed = false;

        while (Date.now() - startTime < maxWait && !completed) {
            await page.waitForTimeout(5000);

            const state = await page.evaluate(() => {
                const pct = document.getElementById('progressPercentage');
                const step = document.getElementById('progressStep');
                const logArea = document.getElementById('logContent') || document.getElementById('progressLog');
                return {
                    pct: pct?.textContent || '',
                    step: step?.textContent || '',
                    lastLog: logArea ? logArea.innerText.split('\n').filter(l => l.trim()).slice(-5).join(' | ') : ''
                };
            }).catch(() => ({ pct: '', step: '', lastLog: '' }));

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

            if (state.lastLog && state.lastLog !== lastLog) {
                console.log(`📊 [${elapsed}s] ${state.pct} ${state.step}`);
                console.log(`   ${state.lastLog.slice(0, 200)}`);
                lastLog = state.lastLog;
            }

            // 완료/실패 체크
            if (state.pct === '100%' ||
                state.step?.includes('완료') ||
                state.step?.includes('실패') ||
                state.lastLog?.includes('발행 완료') ||
                state.lastLog?.includes('발행 실패') ||
                state.lastLog?.includes('성공적으로')) {
                completed = true;
                const isSuccess = !state.step?.includes('실패') && !state.lastLog?.includes('실패');
                console.log(`\n${isSuccess ? '✅' : '❌'} 작업 ${isSuccess ? '완료' : '실패'}!`);
            }
        }

        if (!completed) console.log('⏰ 10분 타임아웃');

        // 6. 최종 스크린샷 & 로그
        await page.screenshot({ path: 'test-blogspot-v2-result.png', fullPage: false });
        console.log('\n📸 최종 결과 스크린샷 저장');

        const finalLog = await page.evaluate(() => {
            const logArea = document.getElementById('logContent') || document.getElementById('progressLog');
            return logArea ? logArea.innerText : '로그 없음';
        }).catch(() => '로그 없음');

        console.log('\n📋 === 최종 로그 (마지막 20줄) ===');
        finalLog.split('\n').filter(l => l.trim()).slice(-20).forEach(line => {
            console.log(`  ${line}`);
        });

    } catch (error) {
        console.error('❌ 테스트 실패:', error.message);
    } finally {
        if (browser) browser.close();
        console.log('\n✅ 테스트 스크립트 종료');
    }
})();
