const puppeteer = require('puppeteer-core');
async function main() {
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    const page = (await browser.pages())[0];

    // 먼저 메인 탭으로 이동 (맨 위로 스크롤)
    await page.evaluate(() => window.scrollTo(0, 0));

    // 모든 textarea와 input(text) 찾기 (숨김 포함)
    const allFields = await page.evaluate(() => {
        const els = document.querySelectorAll('textarea, input[type="text"], input:not([type])');
        return Array.from(els).map(el => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const parent = el.closest('section, div[id], form');
            return {
                tag: el.tagName, id: el.id, name: el.name, type: el.type,
                placeholder: el.placeholder || '',
                visible: rect.width > 0 && rect.height > 0 && style.display !== 'none',
                parentId: parent?.id || '',
                parentClass: (parent?.className?.toString() || '').slice(0, 30)
            };
        });
    });

    console.log('=== 모든 텍스트 입력 필드 ===');
    allFields.forEach((f, i) => {
        console.log(`[${i}] ${f.visible ? '👁️' : '🚫'} <${f.tag}> id="${f.id}" name="${f.name}" ph="${f.placeholder}" parent="${f.parentId}"`);
    });

    // 발행 관련 버튼 찾기
    const allButtons = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        return Array.from(btns).filter(b => {
            const text = b.textContent || '';
            return text.includes('발행') || text.includes('생성') || text.includes('포스팅') ||
                text.includes('시작') || text.includes('Run') || text.includes('Post');
        }).map(b => ({
            id: b.id,
            text: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
            visible: b.getBoundingClientRect().width > 0,
            parentId: b.closest('section, div[id]')?.id || ''
        }));
    });

    console.log('\n=== 발행 관련 버튼 ===');
    allButtons.forEach((b, i) => {
        console.log(`[${i}] ${b.visible ? '👁️' : '🚫'} id="${b.id}" text="${b.text}" parent="${b.parentId}"`);
    });

    // h2ImageSource 확인
    const h2Info = await page.evaluate(() => {
        const sel = document.getElementById('h2ImageSource');
        if (sel) {
            return { found: true, tag: sel.tagName, value: sel.value, options: Array.from(sel.options || []).map(o => `${o.selected ? '✅' : '  '} ${o.value}: ${o.text}`) };
        }
        return { found: false };
    });
    console.log('\n=== H2 이미지 소스 ===');
    console.log(JSON.stringify(h2Info, null, 2));

    browser.disconnect();
}
main().catch(e => console.error(e));
