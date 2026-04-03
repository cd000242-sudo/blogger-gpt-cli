const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const log = [];
    const L = (msg) => { log.push(msg); console.log(msg); };

    try {
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        const contexts = browser.contexts();
        const page = contexts[0].pages()[0];

        // Check which renderCalendar is being used
        const fnInfo = await page.evaluate(() => {
            // Check if renderCalendar exists
            const fnStr = typeof renderCalendar === 'function' ? renderCalendar.toString().substring(0, 300) : 'NOT FOUND';
            return fnStr;
        });
        L('renderCalendar source (first 300 chars): ' + fnInfo);

        // Add test data to workDiary and scheduledPosts
        await page.evaluate(() => {
            // Add test work records
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            const todayKey = `${y}-${m}-${d}`;
            const yesterdayKey = `${y}-${m}-${String(today.getDate() - 1).padStart(2, '0')}`;

            const workDiary = {};
            workDiary[todayKey] = [
                { id: 1, time: '10:00', content: '블로그 포스트 작성', completed: true, timestamp: new Date().toISOString() },
                { id: 2, time: '14:30', content: '키워드 연구 진행', completed: false, timestamp: new Date().toISOString() }
            ];
            workDiary[yesterdayKey] = [
                { id: 3, time: '09:00', content: 'SEO 분석 완료', completed: true, timestamp: new Date().toISOString() }
            ];
            localStorage.setItem('workDiary', JSON.stringify(workDiary));

            // Also set the in-memory workDiary in script.js scope if accessible
            if (typeof window.workDiary !== 'undefined') {
                window.workDiary = workDiary;
            }

            // Add test scheduled posts
            const scheduledPosts = [
                { id: 1001, topic: '맛집 추천 리뷰', keywords: '서울 맛집', date: todayKey, time: '18:00', status: 'pending' },
                { id: 1002, topic: 'AI 기술 동향', keywords: 'ChatGPT', date: `${y}-${m}-${String(today.getDate() + 2).padStart(2, '0')}`, time: '09:00', status: 'pending' },
                { id: 1003, topic: '건강 관리 팁', keywords: '운동', date: `${y}-${m}-${String(today.getDate() + 5).padStart(2, '0')}`, time: '12:00', status: 'pending' }
            ];
            localStorage.setItem('scheduledPosts', JSON.stringify(scheduledPosts));

            return { todayKey, yesterdayKey, workDiary, scheduledPosts };
        });
        L('Test data injected');

        // Now call renderCalendar to re-render
        await page.evaluate(() => {
            if (typeof renderCalendar === 'function') {
                renderCalendar();
            }
        });
        L('renderCalendar() called');

        // Wait a moment
        await page.waitForTimeout(1000);

        // Take screenshot after re-render
        await page.screenshot({ path: 'calendar-after.png', fullPage: false });
        L('Screenshot after re-render saved');

        // Check calendar cells again
        const calInfo = await page.evaluate(() => {
            const el = document.getElementById('calendar-dates');
            if (!el) return { exists: false };
            const children = el.children;
            const info = { exists: true, childCount: children.length, samples: [] };
            for (let i = 0; i < Math.min(20, children.length); i++) {
                const ch = children[i];
                info.samples.push({
                    text: ch.innerText.trim().substring(0, 80),
                    htmlLen: ch.innerHTML.length,
                    minHeight: ch.style.minHeight || 'none',
                    display: ch.style.display || 'default'
                });
            }
            return info;
        });
        L('Calendar after re-render: ' + JSON.stringify(calInfo, null, 2));

        await browser.close();
    } catch (e) {
        L('Error: ' + e.message);
    }

    fs.writeFileSync('calendar-debug2.txt', log.join('\n'));
})();
