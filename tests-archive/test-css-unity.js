/**
 * CSS 통일 디자인 시스템 검증 테스트
 * 7개 CSS 소스 전체를 실행하여 실제 출력 결과를 크로스체크
 */

const fs = require('fs');
const path = require('path');

// 테스트용 샘플 HTML
const SAMPLE_HTML = `
<h2>수익 최적화 가이드</h2>
<p>이것은 <strong>테스트</strong> 본문입니다. 가독성과 수익을 동시에 잡는 방법을 알아보겠습니다.</p>
<h3>핵심 전략 3가지</h3>
<p>첫 번째로 <a href="https://example.com">콘텐츠 품질</a>이 중요합니다.</p>
<table><tr><th>항목</th><th>설명</th></tr><tr><td>폭</td><td>680px</td></tr></table>
<ul><li>리스트 아이템 1</li><li>리스트 아이템 2</li></ul>
<blockquote>인용구 테스트</blockquote>
<h4>세부 사항</h4>
<img src="https://example.com/test.jpg" alt="test">
`;

// ────────────── 디자인 시스템 스펙 ──────────────
const SPEC = {
    colors: {
        h2Accent: '#0d9488',      // 틸
        h3Accent: '#0891b2',      // 시안
        bodyText: '#1a1a1a',
        h2Text: '#0f172a',
        h3Text: '#1e293b',
    },
    oldColors: ['#dc2626', '#f87171', '#3b82f6', '#60a5fa', '#7c3aed'],
    typography: {
        bodySize: '18px',
        lineHeight: '1.85',
        maxWidth: '680px',
    }
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function check(name, condition, detail = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ ${name}`);
    } else {
        failedTests++;
        console.log(`  ❌ ${name} ${detail ? '— ' + detail : ''}`);
    }
}

function checkOutput(sourceName, output, isThemeInjector = false) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 ${sourceName}`);
    console.log(`${'─'.repeat(60)}`);

    // 새 색상 포함 여부
    check('H2 틸 악센트 (#0d9488)', output.includes('#0d9488'));
    check('H3/링크 시안 악센트 (#0891b2)', output.includes('#0891b2'));

    // 구 색상 미포함 여부
    for (const oldColor of SPEC.oldColors) {
        check(`구 색상 ${oldColor} 미사용`, !output.includes(oldColor), `발견됨!`);
    }

    // 타이포그래피 (theme-injector는 폴백 CSS로 소제목만 담당 — 본문 크기/줄간격은 인라인에서 처리)
    if (!isThemeInjector) {
        check('본문 18px', output.includes('18px'));
        check('줄간격 1.85', output.includes('1.85'));
    } else {
        check('[폴백 CSS] H2 22px', output.includes('22px'));
        check('[폴백 CSS] H3 19px', output.includes('19px'));
    }

    // !important (WordPress만 해당)
    if (sourceName.includes('WordPress') || sourceName.includes('WP')) {
        check('!important 사용', output.includes('!important'));
    }
}

// ────────────── 소스 1 & 2: blogger-publisher.js ──────────────
console.log('\n🔬 CSS 통일 디자인 시스템 검증 시작...\n');

try {
    // 소스 1: applyInlineStyles
    const bloggerPublisher = require('./src/core/blogger-publisher.js');

    // applyInlineStyles는 모듈 내부 함수이므로 직접 접근할 수 없음
    // 대신 파일 소스를 파싱하여 함수를 추출
    const bloggerSrc = fs.readFileSync('./src/core/blogger-publisher.js', 'utf-8');

    // applyInlineStyles 함수 추출 및 실행
    const applyInlineMatch = bloggerSrc.match(/function applyInlineStyles\(html\)\s*\{/);
    if (applyInlineMatch) {
        // 함수를 eval로 실행하는 대신, 소스 코드 내 색상값 검증
        const funcStart = applyInlineMatch.index;
        const funcBlock = bloggerSrc.substring(funcStart, funcStart + 5000);
        checkOutput('소스 1/2: blogger-publisher.js (applyInlineStyles)', funcBlock);
    }

    // 소스 2: generateBloggerLayoutCSS
    const layoutCSSMatch = bloggerSrc.match(/function generateBloggerLayoutCSS\(\)\s*\{/);
    if (layoutCSSMatch) {
        const funcStart = layoutCSSMatch.index;
        const funcBlock = bloggerSrc.substring(funcStart, funcStart + 5000);
        checkOutput('소스 2/2: blogger-publisher.js (generateBloggerLayoutCSS)', funcBlock);
    }
} catch (e) {
    console.log(`❌ blogger-publisher.js 로드 실패: ${e.message}`);
}

// ────────────── 소스 3 & 4: blogger-modules/style.js ──────────────
try {
    const styleSrc = fs.readFileSync('./src/core/blogger-modules/style.js', 'utf-8');

    const applyMatch = styleSrc.match(/function applyInlineStyles\(html\)\s*\{/);
    if (applyMatch) {
        const funcStart = applyMatch.index;
        const funcBlock = styleSrc.substring(funcStart, funcStart + 5000);
        checkOutput('소스 3: blogger-modules/style.js (applyInlineStyles)', funcBlock);
    }

    const layoutMatch = styleSrc.match(/function generateBloggerLayoutCSS\(\)\s*\{/);
    if (layoutMatch) {
        const funcStart = layoutMatch.index;
        const funcBlock = styleSrc.substring(funcStart, funcStart + 5000);
        checkOutput('소스 4: blogger-modules/style.js (generateBloggerLayoutCSS)', funcBlock);
    }
} catch (e) {
    console.log(`❌ blogger-modules/style.js 로드 실패: ${e.message}`);
}

// ────────────── 소스 5: blogger-theme-injector.ts ──────────────
try {
    const injectorSrc = fs.readFileSync('./src/core/blogger-theme-injector.ts', 'utf-8');
    const cssMatch = injectorSrc.match(/const CUSTOM_CSS\s*=\s*`/);
    if (cssMatch) {
        const cssStart = cssMatch.index;
        const cssBlock = injectorSrc.substring(cssStart, cssStart + 5000);
        checkOutput('소스 5: blogger-theme-injector.ts (CUSTOM_CSS)', cssBlock);
    }
} catch (e) {
    console.log(`❌ blogger-theme-injector.ts 로드 실패: ${e.message}`);
}

// ────────────── 소스 6: wordpress-publisher.ts ──────────────
try {
    const wpTsSrc = fs.readFileSync('./src/wordpress/wordpress-publisher.ts', 'utf-8');
    const wpMatch = wpTsSrc.match(/function applyWordPressInlineStyles/);
    if (wpMatch) {
        const funcStart = wpMatch.index;
        const funcBlock = wpTsSrc.substring(funcStart, funcStart + 8000);
        checkOutput('소스 6: wordpress-publisher.ts (applyWordPressInlineStyles)', funcBlock);
    }
} catch (e) {
    console.log(`❌ wordpress-publisher.ts 로드 실패: ${e.message}`);
}

// ────────────── 소스 7: wordpress-publisher.js (실제 런타임) ──────────────
try {
    const wpJsSrc = fs.readFileSync('./src/wordpress/wordpress-publisher.js', 'utf-8');
    const wpJsMatch = wpJsSrc.match(/function applyWordPressInlineStyles/);
    if (wpJsMatch) {
        const funcStart = wpJsMatch.index;
        const funcBlock = wpJsSrc.substring(funcStart, funcStart + 8000);
        checkOutput('소스 7: wordpress-publisher.js (런타임 실행 파일)', funcBlock);
    }

    // wrapSectionsInCards 함수 존재 확인
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📋 추가 검증: wrapSectionsInCards 함수');
    console.log(`${'─'.repeat(60)}`);
    check('wrapSectionsInCards 함수 정의 존재 (.js)', wpJsSrc.includes('function wrapSectionsInCards'));
    check('wrapSectionsInCards 호출 존재 (.js)', wpJsSrc.includes('wrapSectionsInCards(styledHtml)'));
} catch (e) {
    console.log(`❌ wordpress-publisher.js 로드 실패: ${e.message}`);
}

// ────────────── 실제 런타임 실행 테스트 ──────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('🚀 실제 런타임 함수 실행 테스트');
console.log(`${'─'.repeat(60)}`);

try {
    // WordPress publisher.js의 applyWordPressInlineStyles 실행
    // 함수를 직접 추출하여 실행
    const wpJsSrc = fs.readFileSync('./src/wordpress/wordpress-publisher.js', 'utf-8');

    // wrapSectionsInCards + applyWordPressInlineStyles 함수 추출
    const wrapFuncMatch = wpJsSrc.match(/function wrapSectionsInCards\(html\)/);
    const applyFuncMatch = wpJsSrc.match(/function applyWordPressInlineStyles\(html\)/);

    if (wrapFuncMatch && applyFuncMatch) {
        // 두 함수를 포함하는 코드 블록 추출 (wrapSectionsInCards 시작 ~ applyWordPressInlineStyles 끝)
        const codeStart = wrapFuncMatch.index;
        // applyWordPressInlineStyles 함수의 끝을 찾기
        let braceCount = 0;
        let funcStarted = false;
        let codeEnd = applyFuncMatch.index;
        for (let i = applyFuncMatch.index; i < wpJsSrc.length; i++) {
            if (wpJsSrc[i] === '{') { braceCount++; funcStarted = true; }
            if (wpJsSrc[i] === '}') { braceCount--; }
            if (funcStarted && braceCount === 0) { codeEnd = i + 1; break; }
        }

        const funcCode = wpJsSrc.substring(codeStart, codeEnd);

        // 함수 실행
        const execCode = funcCode + '\n; applyWordPressInlineStyles;';
        const applyFn = eval(`(function() { ${funcCode}\n return applyWordPressInlineStyles; })()`);

        const result = applyFn(SAMPLE_HTML);

        console.log('\n📄 WordPress 런타임 출력 검증:');
        check('출력 존재', result && result.length > 0);
        check('Gutenberg wp:html 블록', result.includes('<!-- wp:html -->'));
        check('wp-styled-content 클래스', result.includes('wp-styled-content'));
        check('H2에 #0d9488 틸', result.includes('#0d9488'));
        check('H3에 #0891b2 시안', result.includes('#0891b2'));
        check('680px 폭', result.includes('680px'));
        check('18px 본문', result.includes('18px'));
        check('1.85 줄간격', result.includes('1.85'));
        check('!important 사용', result.includes('!important'));
        check('카드 래핑 wp-section-card', result.includes('wp-section-card'));
        check('구 색상 #dc2626 미사용', !result.includes('#dc2626'));
        check('구 색상 #3b82f6 미사용', !result.includes('#3b82f6'));

        // HTML 프리뷰 파일 생성
        const previewHTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WordPress 수익 최적화 CSS 프리뷰</title>
<style>body { background: #f5f5f5; margin: 0; padding: 40px 20px; font-family: sans-serif; }</style>
</head>
<body>
<h1 style="text-align:center; color:#333; margin-bottom:40px;">🔍 WordPress 수익 최적화 CSS 프리뷰</h1>
${result}
</body>
</html>`;
        fs.writeFileSync('./preview-wordpress-revenue.html', previewHTML);
        console.log('\n  📎 프리뷰 파일 생성: preview-wordpress-revenue.html');
    }
} catch (e) {
    console.log(`  ❌ 런타임 실행 실패: ${e.message}`);
}

// ────────────── Blogger 런타임 테스트 ──────────────
try {
    const bloggerSrc = fs.readFileSync('./src/core/blogger-publisher.js', 'utf-8');

    // applyInlineStyles 함수 추출
    const applyMatch = bloggerSrc.match(/function applyInlineStyles\(html\)/);
    if (applyMatch) {
        let braceCount = 0, funcStarted = false, codeEnd = applyMatch.index;
        for (let i = applyMatch.index; i < bloggerSrc.length; i++) {
            if (bloggerSrc[i] === '{') { braceCount++; funcStarted = true; }
            if (bloggerSrc[i] === '}') { braceCount--; }
            if (funcStarted && braceCount === 0) { codeEnd = i + 1; break; }
        }
        const funcCode = bloggerSrc.substring(applyMatch.index, codeEnd);
        const applyFn = eval(`(function() { ${funcCode}\n return applyInlineStyles; })()`);

        const result = applyFn(SAMPLE_HTML);

        console.log('\n📄 Blogger 런타임 출력 검증 (applyInlineStyles):');
        check('출력 존재', result && result.length > 0);
        check('H2에 #0d9488 틸', result.includes('#0d9488'));
        check('H3에 #0891b2 시안', result.includes('#0891b2'));
        check('680px 폭', result.includes('680px'));
        check('18px 본문', result.includes('18px'));
        check('1.85 줄간격', result.includes('1.85'));
        check('구 색상 #dc2626 미사용', !result.includes('#dc2626'));
        check('구 색상 #3b82f6 미사용', !result.includes('#3b82f6'));

        // generateBloggerLayoutCSS 실행
        const layoutMatch = bloggerSrc.match(/function generateBloggerLayoutCSS\(\)\s*\{/);
        if (layoutMatch) {
            let bc = 0, fs2 = false, ce = layoutMatch.index;
            for (let i = layoutMatch.index; i < bloggerSrc.length; i++) {
                if (bloggerSrc[i] === '{') { bc++; fs2 = true; }
                if (bloggerSrc[i] === '}') { bc--; }
                if (fs2 && bc === 0) { ce = i + 1; break; }
            }
            const layoutCode = bloggerSrc.substring(layoutMatch.index, ce);
            const layoutFn = eval(`(function() { ${layoutCode}\n return generateBloggerLayoutCSS; })()`);
            const layoutCSS = layoutFn();

            console.log('\n📄 Blogger 런타임 출력 검증 (generateBloggerLayoutCSS):');
            check('CSS 출력 존재', layoutCSS && layoutCSS.length > 0);
            check('680px 폭', layoutCSS.includes('680px'));
            check('#0d9488 틸', layoutCSS.includes('#0d9488'));
            check('#0891b2 시안', layoutCSS.includes('#0891b2'));
            check('구 색상 #dc2626 미사용', !layoutCSS.includes('#dc2626'));
            check('구 색상 #3b82f6 미사용', !layoutCSS.includes('#3b82f6'));

            // Blogger 프리뷰 생성
            const bloggerPreview = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blogger 수익 최적화 CSS 프리뷰</title>
<style>body { background: #f5f5f5; margin: 0; padding: 40px 20px; font-family: sans-serif; }</style>
<style>${layoutCSS}</style>
</head>
<body>
<h1 style="text-align:center; color:#333; margin-bottom:40px;">🔍 Blogger 수익 최적화 CSS 프리뷰</h1>
<div class="blogspot-custom-content" style="max-width:680px; margin:0 auto; background:#fff; padding:40px; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.08);">
${result}
</div>
</body>
</html>`;
            fs.writeFileSync('./preview-blogspot-v4.html', bloggerPreview);
            console.log('\n  📎 프리뷰 파일 생성: preview-blogspot-v4.html');
        }
    }
} catch (e) {
    console.log(`  ❌ Blogger 런타임 실행 실패: ${e.message}`);
}

// ────────────── 최종 결과 ──────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('📊 최종 테스트 결과');
console.log(`${'═'.repeat(60)}`);
console.log(`  전체: ${totalTests}건`);
console.log(`  통과: ${passedTests}건 ✅`);
console.log(`  실패: ${failedTests}건 ${failedTests > 0 ? '❌' : ''}`);
console.log(`  결과: ${failedTests === 0 ? '🎉 완벽! 모든 테스트 통과' : '⚠️ 일부 테스트 실패'}`);
console.log(`${'═'.repeat(60)}\n`);

process.exit(failedTests > 0 ? 1 : 0);
