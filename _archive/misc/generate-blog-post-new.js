// 키워드로 블로그 포스트 생성 및 발행 시스템 (개선판)
// 범용적인 클릭 유발 제목 생성 기능 포함
const fs = require('fs');
const path = require('path');

// 연말정산 연도 자동 계산 함수
function getCurrentTaxYear() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-11 → 1-12

    // 연말정산 미리보기는 미래 지향적으로 최신 연도 기준으로 설정
    // 2025년 현재 = 2026년 연말정산 미리보기 (미래 트렌드 고려)
    return currentYear + 1;
}

// 범용적인 클릭 유발 제목 생성 함수
function generateClickBaitTitle(keyword, category = 'default') {
    const clickBaitPatterns = {
        programming: [
            `개발자들이 절대 말하지 않는 ${keyword} 진실`,
            `${keyword} 초보자라면 반드시 피해야 할 실수 TOP 7`,
            `이 ${keyword} 꿀팁 하나로 연봉이 2000만원 올랐습니다`,
            `${keyword} 고수들은 왜 이 비법을 숨길까?`,
            `99%의 개발자가 모르는 ${keyword} 비밀`,
            `${keyword} 왕초보가 3개월만에 고수가 된 방법`
        ],
        health: [
            `병원에서 절대 말하지 않는 ${keyword} 진실`,
            `${keyword} 환자 90%가 저지르는 실수`,
            `이 ${keyword} 습관 하나로 증상이 사라졌습니다`,
            `${keyword} 치료비를 70% 아끼는 방법`,
            `의사들도 인정하는 ${keyword} 생활습관`,
            `${keyword} 왕초보를 위한 생존 가이드`
        ],
        investment: [
            `주식 고수들이 절대 말하지 않는 ${keyword} 전략`,
            `${keyword} 초보자가 1년만에 5000만원 번 방법`,
            `99%의 투자자가 모르는 ${keyword} 공식`,
            `${keyword}으로 매달 100만원씩 버는 시스템`,
            `${keyword} 왕초보를 위한 안전 투자법`,
            `이 ${keyword} 타이밍을 놓치면 평생 후회합니다`
        ],
        tax: [
            `세무사도 깜짝! ${keyword} 숨겨진 환급금 찾는 법`,
            `${keyword}로 세금 200만원 아끼는 비법`,
            `99%의 직장인이 모르는 ${keyword} 꿀팁`,
            `${keyword} 미리보기만 잘해도 연봉이 오르는 이유`,
            `세무서에서 숨기고 싶은 ${keyword} 비밀`,
            `${keyword} 왕초보를 위한 환급금 극대화 가이드`
        ],
        default: [
            `전문가가 밝히는 ${keyword}의 놀라운 진실`,
            `${keyword} 초보자들이 반드시 알아야 할 것`,
            `이 ${keyword} 비법으로 삶이 바뀌었습니다`,
            `${keyword} 전문가만 아는 숨겨진 비밀`,
            `${keyword} 왕초보 탈출 가이드`,
            `${keyword}로 성공한 사람들의 공통점`,
            `이 ${keyword} 습관이 당신을 바꿔줍니다`,
            `${keyword} 전문가가 공개하는 숨겨진 전략`,
            `${keyword} 초보 탈출을 위한 필수 가이드`,
            `99%의 사람들이 모르는 ${keyword} 꿀팁`
        ]
    };

    const patterns = clickBaitPatterns[category] || clickBaitPatterns.default;
    const randomIndex = Math.floor(Math.random() * patterns.length);
    return patterns[randomIndex];
}

// 키워드별 카테고리 분류
function getCategory(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerKeyword.includes('프로그래밍') || lowerKeyword.includes('코딩') || lowerKeyword.includes('개발')) {
        return 'programming';
    } else if (lowerKeyword.includes('건강') || lowerKeyword.includes('의학') || lowerKeyword.includes('병원') ||
               lowerKeyword.includes('치료') || lowerKeyword.includes('약') || lowerKeyword.includes('운동')) {
        return 'health';
    } else if (lowerKeyword.includes('투자') || lowerKeyword.includes('주식') || lowerKeyword.includes('재테크')) {
        return 'investment';
    } else if (lowerKeyword.includes('연말정산') || lowerKeyword.includes('세금') || lowerKeyword.includes('세무')) {
        return 'tax';
    }
    return 'default';
}

// 콘텐츠 생성 함수
function generateContent(keyword) {
    const category = getCategory(keyword);
    let processedKeyword = keyword;

    // 연말정산 키워드에 연도 자동 추가
    if (category === 'tax' && keyword.toLowerCase().includes('연말정산') && !keyword.includes('년')) {
        const taxYear = getCurrentTaxYear();
        processedKeyword = `${taxYear}년 ${keyword}`;
    }

    const title = generateClickBaitTitle(processedKeyword, category);

    let content = '';

    if (keyword.toLowerCase().includes('연말정산')) {
        content = `
<h1>${title}</h1>

<p>15년차 세무사로 일하면서 가장 많이 받는 질문이 있어요. "${keyword} 어떻게 하면 세금 많이 환급받을 수 있을까요?" 사실 많은 분들이 연말정산 시즌에만 바짝 긴장하시다가 중요한 공제 항목들을 놓치고 계세요.</p>

<h2>연말정산 미리보기의 진짜 가치</h2>
<p>홈택스에서 제공하는 연말정산 미리보기는 그냥 '예상 금액 보여주는 기능'이 아니에요. 이걸 제대로 활용하면 연말정산 때 받을 환급금을 최대화할 수 있어요.</p>

<h2>미리보기 활용 꿀팁</h2>
<ul>
<li>연금저축공제 한도 확인</li>
<li>건강보험 미보험금 주의</li>
<li>자녀 관련 공제 꼼꼼히</li>
<li>신용카드 추가 공제 확인</li>
<li>의료비 세액공제 놓치지 않기</li>
</ul>

<h2>실제 환급 사례</h2>
<p>미리보기를 통해 평균 15-30만원 추가 환급을 받는 경우가 많아요. 작년 한 고객님은 연금저축공제와 건강보험 미보험금으로 25만원 더 환급받으셨어요.</p>

<h2>미리보기 활용 5단계 전략</h2>
<ol>
<li>홈택스 로그인 후 연말정산 메뉴 선택</li>
<li>기본 정보 입력 및 공제 항목 검토</li>
<li>증빙서류 준비 및 추가 공제 탐색</li>
<li>세무사 상담으로 놓친 항목 확인</li>
<li>최종 예상 환급금 계산</li>
</ol>

<p>연말정산 미리보기를 제대로 활용하면 세금 부담을 크게 줄일 수 있어요. 세무사 상담도 잊지 마세요!</p>
        `;
    } else {
        // 기본 콘텐츠 템플릿
        content = `
<h1>${title}</h1>

<p>${keyword}에 대해 이야기하려고 해요. 이 분야에서 10년 이상 경험을 쌓았어요. 많은 분들이 ${keyword}에 관심은 있지만 어떻게 시작해야 할지 모르시는 것 같아요.</p>

<h2>${keyword}의 중요성</h2>
<p>${keyword}는 이제 선택이 아닌 필수예요. 저도 처음엔 '괜찮겠지'라고 생각했어요. 하지만 실제로 적용해보니 효율성이 확 달라지더라고요.</p>

<h2>기본 개념부터 제대로</h2>
<p>많은 분들이 급하게 시작하시다가 어려움을 겪어요. ${keyword}의 기본을 제대로 이해하는 게 중요해요. 저도 처음엔 이 부분을 무시했다가 나중에 고생했어요.</p>

<h2>실전 적용 사례</h2>
<p>이론만으로는 부족해요. 실제로 적용해보는 게 중요합니다. 저는 ${keyword}를 업무에 적용한 후 큰 변화를 경험했어요.</p>

<h2>마무리</h2>
<p>${keyword}의 세계에 입문하시는 걸 환영해요. 처음엔 어렵겠지만 꾸준히 노력하시면 좋은 결과 얻으실 수 있어요. 궁금한 점 있으시면 언제든 물어보세요!</p>
        `;
    }

    return { title, content: content.trim() };
}

// 키워드 기반 콘텐츠 생성 및 발행
async function generateBlogPost(keyword, isPreview = false) {
    console.log('🎯 키워드 기반 블로그 포스트 생성 (개선판)');
    console.log('=======================================');
    console.log(`📝 키워드: "${keyword}"`);

    try {
        // 콘텐츠 생성
        console.log('\n🤖 콘텐츠 생성 중...');
        const generatedContent = generateContent(keyword);

        // HTML 포맷팅
        console.log('\n🎨 HTML 포맷팅 및 스타일 적용 중...');
        const formattedContent = formatContent(generatedContent.content, keyword);

        if (isPreview) {
            // 미리보기 모드
            console.log('\n👀 콘텐츠 미리보기');
            console.log('==================');

            const plainText = formattedContent
                .replace(/<[^>]*>/g, '')
                .replace(/\n\s*\n/g, '\n')
                .trim();

            console.log(`📝 제목: ${generatedContent.title}`);
            console.log(`📊 콘텐츠 길이: ${formattedContent.length}자 (${plainText.length}자 텍스트)`);
            console.log(`🏷️ 키워드: ${keyword}`);
            console.log('');

            console.log('📄 콘텐츠 미리보기 (처음 300자):');
            console.log('===================================');
            console.log(plainText.substring(0, 300) + (plainText.length > 300 ? '...\n\n[콘텐츠가 길어 300자로 요약 표시했습니다]' : ''));

            return {
                keyword,
                title: generatedContent.title,
                content: formattedContent,
                contentLength: formattedContent.length,
                preview: true
            };
        } else {
            // 실제 발행 모드
            console.log('\n📤 Blogger 발행 중...');
            // 실제 발행 로직은 나중에 추가
            console.log('⚠️ 실제 발행 기능은 아직 구현되지 않았습니다.');

            return {
                keyword,
                title: generatedContent.title,
                content: formattedContent,
                contentLength: formattedContent.length
            };
        }

    } catch (error) {
        console.error('\n❌ 포스트 생성 실패:', error.message);
        throw error;
    }
}

// 콘텐츠 포맷팅 함수
function formatContent(content, keyword) {
    let formatted = content
        .replace(/<h1>/g, '<h1 style="color: #2c3e50; margin-bottom: 20px; font-size: 28px;">')
        .replace(/<h2>/g, '<h2 style="color: #34495e; margin: 30px 0 15px 0; font-size: 24px; border-bottom: 2px solid #3498db; padding-bottom: 5px;">')
        .replace(/<h3>/g, '<h3 style="color: #7f8c8d; margin: 25px 0 10px 0; font-size: 20px;">')
        .replace(/<p>/g, '<p style="line-height: 1.8; margin-bottom: 15px; font-size: 16px; color: #333;">')
        .replace(/<ul>/g, '<ul style="margin: 15px 0; padding-left: 30px;">')
        .replace(/<li>/g, '<li style="margin-bottom: 8px; line-height: 1.6;">')
        .replace(/<ol>/g, '<ol style="margin: 15px 0; padding-left: 30px;">');

    // 키워드 강조
    const keywordRegex = new RegExp(keyword, 'gi');
    formatted = formatted.replace(keywordRegex, `<strong style="color: #e74c3c;">${keyword}</strong>`);

    return formatted;
}

// 메인 실행 함수
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('❌ 키워드를 입력해주세요.');
        console.log('사용법:');
        console.log('  미리보기: node generate-blog-post-new.js "키워드" --preview');
        console.log('  발행: node generate-blog-post-new.js "키워드"');
        console.log('');
        console.log('예시:');
        console.log('  node generate-blog-post-new.js "연말정산 미리보기" --preview');
        console.log('  node generate-blog-post-new.js "프로그래밍" --preview');
        return;
    }

    const keyword = args[0];
    const isPreview = args.includes('--preview');

    try {
        const result = await generateBlogPost(keyword, isPreview);

        if (isPreview) {
            console.log('\n💡 실제 발행을 원하시면 --preview 옵션을 제거하세요!');
        }

        console.log('\n🎊 콘텐츠 생성 완료!');

    } catch (error) {
        console.error('❌ 실행 실패:', error);
    }
}

// 실행
if (require.main === module) {
    main();
}

module.exports = { generateBlogPost, generateClickBaitTitle, getCategory };
