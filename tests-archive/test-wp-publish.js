const puppeteer = require('puppeteer-core');
const path = require('path');

const KEYWORD = '경기도 청년 노동자 통장 2026 : 선착순 광탈 방지 서류 세팅, 모르면 작년처럼 또 낙방합니다';
const SS = 'C:/Users/박성현/.gemini/antigravity/brain/48947124-abc0-42ce-b0ae-ee5ee9337d0b';
let n = 1;
const ss = async (page, name) => {
    const p = path.join(SS, `auto_${String(n++).padStart(2, '0')}_${name}.png`);
    await page.screenshot({ path: p });
    console.log(`📸 ${name}`);
};

async function main() {
    console.log('🚀 완전 자동 발행 테스트 시작!');
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    const page = (await browser.pages())[0];

    // 1. 완전 자동 발행 탭 클릭
    await page.evaluate(() => {
        const tabs = document.querySelectorAll('button, [role="tab"]');
        for (const t of tabs) {
            if (t.textContent?.includes('완전') && t.textContent?.includes('자동')) {
                t.click();
                break;
            }
        }
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ 완전 자동 발행 탭 전환');
    await ss(page, 'tab_switched');

    // 2. 키워드 입력 필드 찾기 (완전 자동 발행 탭에서 보이는 입력 필드)
    const inputInfo = await page.evaluate((kw) => {
        // 보이는 textarea와 text input 중에서 키워드용 필드 찾기
        const fields = document.querySelectorAll('textarea, input[type="text"], input:not([type])');
        const visibleFields = [];

        for (const f of fields) {
            const rect = f.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                visibleFields.push({
                    tag: f.tagName, id: f.id, name: f.name, type: f.type,
                    ph: (f.placeholder || '').slice(0, 50),
                    val: (f.value || '').slice(0, 30),
                    y: Math.round(rect.top)
                });
            }
        }

        // 키워드 관련 ID 찾기
        const kwIds = ['keyword', 'keywords', 'postKeyword', 'mainKeyword', 'topicInput', 'keywordInput'];
        let target = null;

        for (const id of kwIds) {
            const el = document.getElementById(id);
            if (el) { target = el; break; }
        }

        // ID로 못 찾으면 placeholder에 키워드/주제 포함된 것 찾기
        if (!target) {
            for (const f of fields) {
                const rect = f.getBoundingClientRect();
                const ph = f.placeholder || '';
                if (rect.width > 0 && rect.height > 0 && (ph.includes('키워드') || ph.includes('주제') || ph.includes('topic'))) {
                    target = f;
                    break;
                }
            }
        }

        // 그래도 못 찾으면 가장 위에 있는 보이는 textarea 또는 text input
        if (!target) {
            for (const f of visibleFields) {
                const el = document.getElementById(f.id) || document.querySelector(`${f.tag}[placeholder="${f.ph}"]`);
                if (el && (el.tagName === 'TEXTAREA' || el.type === 'text')) {
                    target = el;
                    break;
                }
            }
        }

        if (target) {
            target.scrollIntoView({ block: 'center' });
            target.focus();
            target.value = kw;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, id: target.id, ph: target.placeholder?.slice(0, 50), visibleFields };
        }

        return { success: false, visibleFields };
    }, KEYWORD);

    console.log(`📝 키워드 입력: ${inputInfo.success ? '✅' : '❌'} id="${inputInfo.id}" ph="${inputInfo.ph}"`);
    if (!inputInfo.success) {
        console.log('보이는 필드 목록:', JSON.stringify(inputInfo.visibleFields, null, 2));
    }
    await new Promise(r => setTimeout(r, 500));
    await ss(page, 'keyword_entered');

    // 3. 플랫폼 = WordPress로 설정
    const platResult = await page.evaluate(() => {
        // 보이는 select 중에서 wordpress 옵션이 있는 것 찾기
        const selects = document.querySelectorAll('select');
        for (const s of selects) {
            const rect = s.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                for (const o of s.options) {
                    if (o.value === 'wordpress' || o.text.toLowerCase().includes('wordpress')) {
                        s.value = o.value;
                        s.dispatchEvent(new Event('change', { bubbles: true }));
                        return { success: true, selectId: s.id, value: o.value, text: o.text };
                    }
                }
            }
        }
        return { success: false };
    });
    console.log(`🌐 플랫폼: ${JSON.stringify(platResult)}`);
    await new Promise(r => setTimeout(r, 500));

    // 4. 설정 확인
    const settings = await page.evaluate(() => ({
        h2ImageSource: document.getElementById('h2ImageSource')?.value,
        thumbnailType: document.getElementById('thumbnailType')?.value,
        toneStyle: document.getElementById('toneStyle')?.value,
        wpCategory: document.getElementById('wpCategory')?.value
    }));
    console.log('⚙️ 설정:', JSON.stringify(settings));
    await ss(page, 'settings');

    // 5. publishBtn 발행 버튼 클릭
    const btn = await page.evaluate(() => {
        const b = document.getElementById('publishBtn');
        if (b) {
            b.scrollIntoView({ block: 'center' });
            return { found: true, text: b.textContent?.trim().slice(0, 50), visible: b.offsetParent !== null };
        }
        return { found: false };
    });
    console.log(`🔘 발행 버튼: ${JSON.stringify(btn)}`);

    if (!btn.found || !btn.visible) {
        console.log('❌ 발행 버튼을 찾을 수 없음!');
        await ss(page, 'no_button');
        browser.disconnect();
        return;
    }

    await new Promise(r => setTimeout(r, 500));
    await ss(page, 'before_publish');

    console.log('🚀 발행 시작!');
    await page.click('#publishBtn');
    await new Promise(r => setTimeout(r, 3000));
    await ss(page, 'after_click');

    // 6. 모니터링 (최대 5분)
    console.log('⏳ 발행 진행 모니터링...');
    const start = Date.now();
    let lastLog = '';

    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const elapsed = Math.round((Date.now() - start) / 1000);

        const st = await page.evaluate(() => {
            const body = document.body.innerText || '';

            // 로그 영역 찾기
            const logEls = document.querySelectorAll('[id*="log"], .log-area, .log-container, pre, .output');
            let logText = '';
            for (const el of logEls) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && el.textContent?.trim()) {
                    logText = el.textContent.trim().slice(-300);
                    break;
                }
            }

            // progress bar
            const progressBar = document.querySelector('progress, [role="progressbar"], .progress-bar');
            const progressValue = progressBar ? (progressBar.value || progressBar.style?.width || '') : '';

            return {
                logText,
                progressValue,
                complete: body.includes('발행 완료') || body.includes('발행이 완료') || body.includes('성공적으로 발행'),
                error: body.includes('발행 실패') || body.includes('Error:') || body.includes('에러')
            };
        });

        // 로그 변화 감지
        if (st.logText && st.logText !== lastLog) {
            const newPart = st.logText.slice(-150);
            console.log(`  [${elapsed}s] ${newPart}`);
            lastLog = st.logText;
        }

        if (elapsed % 30 < 6) await ss(page, `prog_${elapsed}s`);

        if (st.complete) {
            console.log(`\n✅✅✅ [${elapsed}s] 발행 완료!`);
            await ss(page, 'success');
            break;
        }
        if (st.error && elapsed > 15) {
            console.log(`\n❌ [${elapsed}s] 에러 발생!`);
            // 에러 상세 캡처
            const errDetail = await page.evaluate(() => {
                const body = document.body.innerText || '';
                const errMatch = body.match(/(Error|에러|실패|오류)[^\n]{0,200}/gi);
                return errMatch?.slice(0, 3) || [];
            });
            console.log('에러 상세:', JSON.stringify(errDetail));
            await ss(page, 'error');
            break;
        }
    }

    await ss(page, 'final');
    console.log('🏁 테스트 종료!');
    browser.disconnect();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
