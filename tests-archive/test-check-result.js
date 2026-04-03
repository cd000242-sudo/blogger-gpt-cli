const puppeteer = require('puppeteer-core');
const path = require('path');
const SS = 'C:/Users/박성현/.gemini/antigravity/brain/48947124-abc0-42ce-b0ae-ee5ee9337d0b';

async function main() {
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    const page = (await browser.pages())[0];

    // 1. 발행 로그 섹션 열기
    await page.evaluate(() => {
        // 발행 로그 토글 버튼 클릭
        const toggleBtns = document.querySelectorAll('button, summary, details, [class*="toggle"], [class*="collapse"]');
        for (const b of toggleBtns) {
            if (b.textContent?.includes('발행 로그') && b.textContent?.includes('펼치기')) {
                b.click();
                return true;
            }
        }
        // details 태그 열기
        const details = document.querySelectorAll('details');
        for (const d of details) {
            if (d.textContent?.includes('발행 로그')) {
                d.open = true;
                return true;
            }
        }
        return false;
    });
    await new Promise(r => setTimeout(r, 1000));

    // 2. 화면 아래로 스크롤하여 로그 확인
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 500));

    // 3. 스크린샷
    await page.screenshot({ path: path.join(SS, 'auto_result_01_log.png') });
    console.log('📸 로그 영역 스크린샷');

    // 4. 전체 로그 텍스트 추출
    const logData = await page.evaluate(() => {
        // 로그 영역 찾기
        const logEls = document.querySelectorAll('[id*="log"], .log-area, pre, .log-container, details');
        let allLogs = [];

        for (const el of logEls) {
            const text = el.textContent?.trim();
            if (text && text.includes('발행')) {
                allLogs.push(text.slice(-1000)); // 마지막 1000글자
            }
        }

        // body에서 발행/성공/실패 관련 텍스트 추출
        const body = document.body.innerText || '';
        const hasComplete = body.includes('발행 완료') || body.includes('WordPress 발행 성공') || body.includes('성공적으로 발행');
        const hasError = body.includes('발행 실패') || body.includes('Error:');

        // 결과 URL 찾기
        const urlMatch = body.match(/(https?:\/\/[^\s]+wordpress[^\s]*|https?:\/\/[^\s]+wp[^\s]*)/i);

        return {
            logs: allLogs,
            hasComplete,
            hasError,
            resultUrl: urlMatch ? urlMatch[0] : null
        };
    });

    console.log('\n=== 발행 결과 ===');
    console.log(`완료: ${logData.hasComplete}`);
    console.log(`에러: ${logData.hasError}`);
    console.log(`URL: ${logData.resultUrl || '없음'}`);
    console.log('\n=== 로그 내용 ===');
    logData.logs.forEach((log, i) => {
        console.log(`--- 로그 ${i} ---`);
        console.log(log.slice(-500));
    });

    // 5. 좀 더 위로 스크롤해서 로그 전체 보이게
    await page.evaluate(() => {
        const logEl = document.querySelector('[id*="log"], .log-area, pre, details[open]');
        if (logEl) logEl.scrollIntoView({ block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SS, 'auto_result_02_log_top.png') });
    console.log('📸 로그 상단 스크린샷');

    browser.disconnect();
}
main().catch(e => console.error(e));
