const axios = require('axios');
const cheerio = require('cheerio');

// 새로운 접근법 1: 네이버 VIEW 탭 (블로그+카페) 에서 페이지네이션 정보 추출
// 새로운 접근법 2: 네이버 블로그 검색 결과 아이템수를 계수 (여러 페이지)
// 새로운 접근법 3: 네이버 모바일 VIEW 탭에서 블로그 통합검색 total 
// 새로운 접근법 4: 네이버 검색 결과 HTML raw text에서 모든 숫자 패턴 확인

async function testAllApproaches(keyword) {
    console.log(`\n=== "${keyword}" ===`);

    // Approach 1: Desktop VIEW tab - check all JSON in scripts
    try {
        const url = `https://search.naver.com/search.naver?where=view&query=${encodeURIComponent(keyword)}&sm=tab_viw`;
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9',
                'Referer': 'https://www.naver.com/',
            },
            timeout: 10000,
        });
        const html = resp.data;

        // Extract ALL "total":NUMBER patterns from script tags
        const $ = cheerio.load(html);
        const allTotals = [];
        $('script').each((i, el) => {
            const scriptText = $(el).html() || '';
            const matches = scriptText.matchAll(/"total"\s*:\s*(\d+)/g);
            for (const m of matches) {
                allTotals.push(parseInt(m[1]));
            }
        });
        if (allTotals.length > 0) console.log('[VIEW-script] totals:', allTotals);

        // Count actual blog list items
        const blogItems = $('li.bx').length;
        console.log('[VIEW-dom] li.bx:', blogItems);
    } catch (err) { console.error('[VIEW]', err.message); }

    // Approach 2: Mobile VIEW tab
    try {
        const url = `https://m.search.naver.com/search.naver?where=m_view&query=${encodeURIComponent(keyword)}`;
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
                'Accept-Language': 'ko-KR,ko;q=0.9',
            },
            timeout: 10000,
        });
        const html = resp.data;
        const allTotals = [];
        const matches = html.matchAll(/"total"\s*:\s*(\d+)/g);
        for (const m of matches) allTotals.push(parseInt(m[1]));
        if (allTotals.length > 0) console.log('[m_view] totals:', allTotals);

        // Also check for blogTotal, viewTotal, etc. 
        const blogTotal = html.match(/"blogTotal"\s*:\s*(\d+)/);
        if (blogTotal) console.log('[m_view] blogTotal:', blogTotal[1]);
    } catch (err) { console.error('[m_view]', err.message); }

    // Approach 3: Naver blog API (v2) - using API endpoint
    try {
        // This is the internal AJAX endpoint that the Naver search page uses
        const url = `https://s.search.naver.com/p/blog/search.naver?where=blog&start=1&display=1&query=${encodeURIComponent(keyword)}`;
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `https://search.naver.com/search.naver?where=view&query=${encodeURIComponent(keyword)}`,
                'Accept': '*/*',
            },
            timeout: 10000,
        });
        if (typeof resp.data === 'string') {
            const m = resp.data.match(/"total"\s*:\s*(\d+)/);
            if (m) console.log('[blog-ajax] total:', m[1]);
        } else if (resp.data?.total) {
            console.log('[blog-ajax] total:', resp.data.total);
        }
    } catch (err) {
        // Try alternate format
    }

    // Approach 4: Naver Blog section from integrated search (JSON response)
    try {
        const url = `https://s.search.naver.com/p/review/search.naver?where=view&start=1&display=1&query=${encodeURIComponent(keyword)}&mode=normal&cluster_rank=1&nlu_query=${encodeURIComponent(keyword)}`;
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `https://search.naver.com/search.naver?where=view&query=${encodeURIComponent(keyword)}`,
            },
            timeout: 10000,
        });
        if (typeof resp.data === 'string') {
            const m = resp.data.match(/"total"\s*:\s*(\d+)/);
            if (m) console.log('[review-ajax] total:', m[1]);
        }
    } catch (err) { }

    // Approach 5: Naver Smart Channel AJAX
    try {
        const url = `https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&qvt=0&query=${encodeURIComponent(keyword)}&ie=utf8&mra=blCK`;
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 10000,
        });
        const html = resp.data;
        // Extract blog section total from integrated search
        const blogSectionMatch = html.match(/blog.*?"total"\s*:\s*(\d+)/s);
        if (blogSectionMatch) console.log('[nexearch] blog total:', blogSectionMatch[1]);
    } catch (err) { }
}

async function main() {
    const keywords = [
        '정수기 추천', '다이어트 방법', '비염 수술 후기',
        '2026년 동계 올림픽', '비타민D 효능 탈모', '에어프라이어 고구마 시간',
    ];

    for (const kw of keywords) {
        await testAllApproaches(kw);
        await new Promise(r => setTimeout(r, 500));
    }
}

main();
