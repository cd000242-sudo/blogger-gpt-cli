const path = require('path');
require('dotenv').config({ path: path.join(process.env.APPDATA, 'blogger-gpt-cli', '.env') });
const { publishGeneratedContent } = require('./dist/core/index');
const { generateCSSFinal, generateBloggerTOCFinal } = require('./dist/core/ultimate-final-functions');

async function testDirectPublish() {
    console.log('--- 수동 조합 화이트페이퍼 블로그스팟 테스팅 ---');

    const title = "3월 2일(내일) 시작! '김해시 초등학생 입학축하금' 10만원 신청";

    // Create base White Paper layout
    let html = generateCSSFinal('blogspot');
    html += '<div class="gradient-frame" id="premium-white-paper-container">';
    html += '<div class="white-paper">';
    html += `\n<h1 class="post-title">${title}</h1>\n`;
    html += `<img src="https://via.placeholder.com/1200x630.png?text=Thumbnail" alt="Thumbnail" style="width:100%; border-radius:12px; margin-bottom: 30px;" />`;

    const h2Titles = [
        "1. 김해시 초등학생 입학축하금이란?",
        "2. 신청 자격 및 지원 금액",
        "3. 신청 방법 및 기간 완벽 가이드"
    ];
    html += generateBloggerTOCFinal(h2Titles);

    // Section 1
    html += `\n<h2>${h2Titles[0]}</h2>\n`;
    html += `<p>김해시에서 초등학교 신입생 가정의 교육비 부담을 덜어주기 위해 <b>'초등학생 입학축하금'</b> 지원을 시작합니다. 이번 지원은 교육복지 보편화를 실현하고, 초등학교에 첫 발을 내딛는 아이들을 응원하기 위해 마련되었습니다.</p>`;

    // Section 2
    html += `\n<h2>${h2Titles[1]}</h2>\n`;
    html += `<p>지원 대상은 2024년 3월 2일 기준으로 김해시에 주민등록이 되어 있고, 초등학교에 최초로 입학하는 신입생입니다. 지원 금액은 <strong>1인당 10만원</strong>이며, 김해사랑상품권 또는 제로페이로 지급됩니다.</p>`;
    html += `<div class="cta-box blue">
        <a href="https://www.gimhae.go.kr" target="_blank" class="cta-button">김해시청 공지사항 바로가기</a>
    </div>`;

    // Section 3
    html += `\n<h2>${h2Titles[2]}</h2>\n`;
    html += `<p>신청 기간은 <strong>3월 2일부터 4월 30일까지</strong>이며, 정부24 포털 접수 또는 거주지 읍/면/동 행정복지센터 방문 접수가 가능합니다.</p>`;

    // Summary Table
    html += `<table class="summary-table">
      <thead><tr><th>구분</th><th>상세 내용</th></tr></thead>
      <tbody>
        <tr><td><strong>신청 기간</strong></td><td>3월 2일 ~ 4월 30일</td></tr>
        <tr><td><strong>지원 대상</strong></td><td>김해시 주민등록 초등학교 신입생</td></tr>
        <tr><td><strong>지원 금액</strong></td><td>10만 원 (지역화폐 지급)</td></tr>
      </tbody>
    </table>`;

    // DISCLAIMER
    html += `\n<div class="disclaimer">\n`;
    html += `<div class="disclaimer-title">ℹ️ 콘텐츠 정보 안내</div>\n`;
    html += `해당 정보는 지자체 공식 홈페이지 공지사항을 바탕으로 작성되었으며, 신청 시기에 따라 일부 변경될 수 있습니다.\n`;
    html += `</div>\n`;

    html += '</div></div>'; // Close white-paper and gradient-frame

    const payload = {
        platform: 'blogspot',
        publishType: 'publish',
        blogId: process.env.BLOG_ID,
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };

    console.log('[LOG] HTML 조립 완료. 발행 시도...');
    try {
        const publishResult = await publishGeneratedContent(payload, title, html, '');
        console.log('\n--- 발행 완료 ---');
        console.log(JSON.stringify(publishResult, null, 2));
    } catch (error) {
        console.error('발행 실패:', error);
    }
}

testDirectPublish();
