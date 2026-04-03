const puppeteer = require('puppeteer-core');
async function main() {
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    const page = (await browser.pages())[0];

    // 1. 완전 자동 발행 탭 클릭
    const clicked = await page.evaluate(() => {
        const tabs = document.querySelectorAll('[data-tab], [role="tab"], .tab-btn, .nav-btn, .tab-button, button');
        for (const t of tabs) {
            if (t.textContent?.includes('완전') && t.textContent?.includes('자동')) {
                t.click();
                return { clicked: true, text: t.textContent.trim().slice(0, 30) };
            }
        }
        return { clicked: false };
    });
    console.log('탭 클릭:', JSON.stringify(clicked));
    await new Promise(r => setTimeout(r, 1000));

    // 2. 완전 자동 발행 탭의 모든 input, textarea, select, button 분석
    const fields = await page.evaluate(() => {
        // 현재 보이는 탭/섹션 찾기
        const visibles = document.querySelectorAll('div[id*="auto"], div[id*="full"], section');
        const results = [];

        // 모든 보이는 입력 필드
        const inputs = document.querySelectorAll('input, textarea, select');
        for (const el of inputs) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                results.push({
                    type: 'field',
                    tag: el.tagName,
                    inputType: el.type,
                    id: el.id,
                    name: el.name,
                    placeholder: (el.placeholder || '').slice(0, 50),
                    value: (el.value || '').slice(0, 30),
                    y: Math.round(rect.top)
                });
            }
        }

        // 모든 보이는 버튼
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
            const rect = b.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const text = b.textContent?.trim().replace(/\s+/g, ' ').slice(0, 50) || '';
                if (text.includes('발행') || text.includes('시작') || text.includes('생성') || text.includes('Run') || text.includes('실행') || text.includes('추가')) {
                    results.push({
                        type: 'button',
                        id: b.id,
                        text: text,
                        y: Math.round(rect.top)
                    });
                }
            }
        }

        return results.sort((a, b) => a.y - b.y);
    });

    console.log('\n=== 완전 자동 발행 탭 - 보이는 요소 ===');
    fields.forEach((f, i) => {
        if (f.type === 'field') {
            console.log(`[${i}] 📝 <${f.tag}> id="${f.id}" type="${f.inputType}" ph="${f.placeholder}" val="${f.value}" y=${f.y}`);
        } else {
            console.log(`[${i}] 🔘 BTN id="${f.id}" text="${f.text}" y=${f.y}`);
        }
    });

    // 3. 플랫폼 선택 관련 확인
    const platformInfo = await page.evaluate(() => {
        const selects = document.querySelectorAll('select');
        const visible = [];
        for (const s of selects) {
            const rect = s.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                visible.push({
                    id: s.id,
                    value: s.value,
                    options: Array.from(s.options).map(o => `${o.selected ? '✅' : '  '} ${o.value}: ${o.text}`)
                });
            }
        }
        return visible;
    });
    console.log('\n=== 보이는 Select 드롭다운 ===');
    platformInfo.forEach(s => {
        console.log(`id="${s.id}" value="${s.value}"`);
        s.options.forEach(o => console.log(`  ${o}`));
    });

    browser.disconnect();
}
main().catch(e => console.error(e));
