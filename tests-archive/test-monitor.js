const puppeteer = require('puppeteer-core');
const path = require('path');
const SS = 'C:/Users/박성현/.gemini/antigravity/brain/48947124-abc0-42ce-b0ae-ee5ee9337d0b';
let n = 1;

async function main() {
    console.log('📊 발행 진행 모니터링 시작...');
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    const page = (await browser.pages())[0];
    const start = Date.now();

    for (let i = 0; i < 120; i++) { // 10초 × 120 = 20분
        await new Promise(r => setTimeout(r, 10000));
        const elapsed = Math.round((Date.now() - start) / 1000);

        const st = await page.evaluate(() => {
            // 프로그레스 퍼센트 찾기
            const body = document.body.innerText || '';
            const pctMatch = body.match(/(\d+)%/);
            const pct = pctMatch ? parseInt(pctMatch[1]) : 0;

            // 현재 단계 찾기
            const stageMatch = body.match(/(AI가|생성 중|이미지|발행|크롤링|WordPress|워드프레스|완료|실패|에러)[^\n]{0,80}/);

            // 로그 마지막 줄
            const logEls = document.querySelectorAll('[id*="log"], .log-area, pre');
            let lastLog = '';
            for (const el of logEls) {
                if (el.textContent?.trim()) {
                    const lines = el.textContent.trim().split('\n').filter(l => l.trim());
                    lastLog = lines[lines.length - 1]?.trim().slice(0, 100) || '';
                }
            }

            return {
                pct,
                stage: stageMatch ? stageMatch[0].slice(0, 60) : '',
                lastLog,
                complete: body.includes('발행 완료') || body.includes('성공적으로 발행') || body.includes('WordPress 발행 성공'),
                error: body.includes('발행 실패') || body.includes('Error:')
            };
        });

        console.log(`[${elapsed}s] ${st.pct}% | ${st.stage || st.lastLog}`);

        // 30초마다 스크린샷
        if (elapsed % 30 < 11) {
            await page.screenshot({ path: path.join(SS, `monitor_${String(n++).padStart(2, '0')}_${elapsed}s.png`) });
        }

        if (st.complete) {
            console.log(`\n✅✅✅ 발행 완료! (${elapsed}s)`);
            await page.screenshot({ path: path.join(SS, 'monitor_final_success.png') });

            // 결과 URL 캡처
            const url = await page.evaluate(() => {
                const body = document.body.innerText || '';
                const m = body.match(/(https?:\/\/[^\s]+)/);
                return m ? m[0] : 'URL 없음';
            });
            console.log(`🔗 URL: ${url}`);
            break;
        }
        if (st.error && elapsed > 30) {
            console.log(`\n❌ 에러! (${elapsed}s)`);
            await page.screenshot({ path: path.join(SS, 'monitor_final_error.png') });
            break;
        }
    }

    console.log('🏁 모니터링 종료');
    browser.disconnect();
}
main().catch(e => console.error(e));
