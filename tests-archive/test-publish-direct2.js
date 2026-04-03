const path = require('path');
require('dotenv').config({ path: path.join(process.env.APPDATA, 'blogger-gpt-cli', '.env') });
const { publishGeneratedContent } = require('./dist/core/index');
const { generateCSSFinal, generateBloggerTOCFinal } = require('./dist/core/ultimate-final-functions');

async function testDirectPublish() {
  console.log('--- 수동 조합 화이트페이퍼 블로그스팟 테스팅 (Full Length) ---');

  const title = "3월 2일(내일) 시작! '김해시 초등학생 입학축하금' 10만원 신청 및 자격 완벽 정리";

  // Create base White Paper layout
  let html = generateCSSFinal('blogspot');
  html += '<div class="gradient-frame" id="premium-white-paper-container">';
  html += '<div class="white-paper">';
  html += `\n<h1 class="post-title">${title}</h1>\n`;
  html += `<img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1200" alt="학생 이미지" style="width:100%; border-radius:12px; margin-bottom: 30px;" />`;

  // Introduction
  html += `<div class="intro-box">`;
  html += `<p>올해 초등학교 입학을 앞둔 자녀를 둔 김해시 학부모님들께 희소식이 있습니다! 교육비 부담을 덜어주기 위해 <b>'김해시 초등학생 입학축하금'</b> 지원이 바로 내일인 <strong>3월 2일</strong>부터 본격적으로 시작됩니다. 입학 준비에 필요한 책가방, 학용품 등 경제적 부담이 만만치 않은 상황에서 1인당 10만 원의 지원금은 가뭄에 단비 같은 소식입니다.</p>`;
  html += `<p>이 글에서는 누락 없이 100% 혜택을 챙겨가실 수 있도록 <b>지원 대상, 신청 자격, 지원 금액, 그리고 놓치기 쉬운 지역화폐(제로페이) 사용법</b>까지 가장 정확하게 안내해 드립니다. 바쁘신 학부모님들을 위해 3분 만에 읽고 바로 신청하실 수 있도록 핵심만 짚어드리겠습니다.</p>`;
  html += `</div>`;

  const h2Titles = [
    "1. 김해시 초등학생 입학축하금 정책 도입 배경과 핵심 내용",
    "2. 누가, 얼마나 받을까? 지원 자격 및 금액 심층 분석",
    "3. 1분 만에 끝내는 입학축하금 온라인/오프라인 신청 방법"
  ];
  html += generateBloggerTOCFinal(h2Titles);

  // Section 1
  html += `\n<h2 class="section-title">${h2Titles[0]}</h2>\n`;
  html += `<figure class="section-image" style="margin: 32px 0 40px !important;">
    <img src="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=1200" alt="핵심 내용" style="width:100% !important; height:auto !important; border-radius:12px !important; display:block !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05) !important;" />
    <figcaption style="text-align:center !important; font-size:13px !important; color:#64748b !important; margin-top:12px !important; font-style:italic !important;">김해시 초등학생 입학 안내문 예시 이미지</figcaption>
    </figure>`;
  html += `<h3 class="subsection-title">■ 교육복지 보편화를 향한 김해시의 노력</h3>`;
  html += `<p>우리 아이가 초등학교에 첫 발을 내딛는 순간은 무척 설레지만, 동시에 현실적인 교육비 지출에 대한 걱정이 앞서는 것도 사실입니다. 각종 학용품부터 실내화, 책가방 등 필수 준비물을 갖추다 보면 예상치 못한 지출이 크게 늘어납니다. 이러한 각 가정의 어려움을 깊이 공감하여, 김해시에서는 올해부터 <b>교육복지 보편화 및 아이 키우기 좋은 환경 조성</b>의 일환으로 입학축하금 제도를 전격 도입했습니다.</p>`;
  html += `<p>이번 정책은 단순한 현금 지원을 넘어, 지역 사회가 함께 아이들의 첫 출발을 축하하고 응원한다는 깊은 의미를 담고 있습니다. 또한, 지원금이 지역 내에서 소비되도록 유도하여 <strong>골목 상권 활성화와 지역 경제 선순환</strong>이라는 일석이조의 효과를 기대하고 있습니다.</p>`;

  html += `<h3 class="subsection-title">■ 타 지자체 대비 차별점 및 주요 특징</h3>`;
  html += `<p>이미 여러 지자체에서 입학 지원금을 지급하고 있지만, 김해시의 축하금은 <b>신청의 편의성을 극대화</b>한 것이 가장 큰 특징입니다. 복잡한 서류 제출 없이 온라인으로 간편하게 신청이 가능하며, 부모뿐만 아니라 실질적으로 아이를 부양 중인 보호자라면 누구나 신청할 수 있도록 자격 요건을 현실화했습니다.</p>`;
  html += `<p><mark>특히, 지원금이 모바일 지역화폐로 신속하게 지급</mark>되기 때문에 발급 즉시 학원비나 도서 구매 등에 편리하게 사용할 수 있습니다. 이는 실질적인 가계 통신비 절감 및 교육비 부담 완화에 직결될 것으로 보입니다.</p>`;

  html += `
<div class="cta-box">
  <p>👉 1분 만에 확인하는 내 지원금 신청 자격 알아보기</p>
  <a class="cta-btn" href="https://www.gimhae.go.kr" target="_blank" rel="nofollow noopener noreferrer">
    김해시청 공식 보도자료 바로가기
  </a>
  <span class="cta-microcopy">※ 단, 예산 소진 시 조기 마감될 수 있습니다.</span>
</div>
`;

  // Section 2
  html += `\n<h2 class="section-title">${h2Titles[1]}</h2>\n`;
  html += `<figure class="section-image" style="margin: 32px 0 40px !important;">
    <img src="https://images.unsplash.com/photo-1620325867502-221affb5b461?auto=format&fit=crop&q=80&w=1200" alt="지원 금액" style="width:100% !important; height:auto !important; border-radius:12px !important; display:block !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05) !important;" />
    <figcaption style="text-align:center !important; font-size:13px !important; color:#64748b !important; margin-top:12px !important; font-style:italic !important;">지역화폐 및 보조금 지원금 활용 예시 이미지</figcaption>
    </figure>`;
  html += `<h3 class="subsection-title">■ 필수 신청 자격 체크리스트</h3>`;
  html += `<p>가장 중요한 신청 자격 요건을 살펴보겠습니다. 너무 복잡하게 생각하실 필요 없이, 딱 <strong>두 가지 조건</strong>만 충족하시면 됩니다. 첫째, <b>2024년 3월 2일(입학일) 기준으로 김해시에 주민등록</b>이 되어 있어야 합니다. 둘째, 올해 <b>초등학교에 최초로 입학하는 신입생</b>이어야 합니다. 아주 명확하고 심플한 기준을 적용하여 사각지대를 최소화했습니다.</p>`;
  html += `<p>만약 취학유예 등으로 인해 올해 입학하지 않는 학생은 제외되지만, 대안학교나 국립/사립 초등학교 등 학교의 종류와 무관하게 입학 사실만 증명되면 모두 지원 대상에 포함됩니다. 쌍둥이나 다자녀 가정의 경우, <strong>입학하는 아동 수만큼 각각 10만 원씩 지급</strong>된다는 점도 꼭 기억해 두시기 바랍니다.</p>`;

  html += `<h3 class="subsection-title">■ 10만 원 지원금의 지급 형태와 사용처</h3>`;
  html += `<p>지원 금액은 아동 1인당 <b>10만 원</b>입니다. 현금 계좌 이체가 아닌 <strong>'김해사랑상품권(제로페이 모바일 상품권)'</strong> 형태로 신청인의 스마트폰에 지급됩니다. 이는 지역 자본의 역외 유출을 막고 김해시 소상공인을 돕기 위한 필수 조치입니다.</p>`;
  html += `<p>지급된 10만 원은 김해시 관내 제로페이 가맹점 중 <b>학원, 서점, 문구점, 의류 매장 등 교육 및 육아와 관련된 다양한 업종</b>에서 자유롭게 사용하실 수 있습니다. 대형 마트나 유흥 업소 등에서는 사용이 제한될 수 있으니 결제 전 가맹점 여부를 앱에서 확인하시는 것이 좋습니다. 사용 기한 역시 지급일로부터 일정 기간(보통 연말까지) 내로 제한되어 있으니, 미루지 말고 가급적 빨리 입학 준비물 구매에 사용하시길 권장드립니다.</p>`;

  // Section 3
  html += `\n<h2 class="section-title">${h2Titles[2]}</h2>\n`;
  html += `<h3 class="subsection-title">■ 가장 쉽고 빠른 '정부24' 온라인 신청법</h3>`;
  html += `<p>신청 기간은 바로 내일인 <b>3월 2일부터 4월 30일까지</b>입니다. 약 두 달간의 여유가 있지만, 행정 처리 속도를 고려하면 초반에 신청하는 것이 지원금을 빠르게 받는 비결입니다. 가장 추천하는 방법은 <strong>'정부24(보조금24)' 포털</strong>을 통한 온라인 신청입니다. PC나 스마트폰만 있다면 시간과 장소에 구애받지 않고 1분 만에 접수를 완료할 수 있습니다.</p>`;
  html += `<p>정부24에 로그인하신 후, '보조금24' 메뉴에서 '김해시 초등학생 입학축하금'을 검색하여 안내에 따라 인적 사항을 입력하시기만 하면 됩니다. 행정망을 통해 주민등록 및 취학 여부가 자동 열람되므로 별도의 종이 서류를 제출하실 필요가 없어 매우 쾌적합니다.</p>`;

  html += `<h3 class="subsection-title">■ 방문 신청 시 필요 서류 및 주의사항</h3>`;
  html += `<p>만약 온라인 신청이 익숙하지 않거나 공인인증서 등 본인 인증에 어려움이 있으신 분들은 <b>거주지 관할 읍·면·동 행정복지센터</b>에 직접 방문하여 신청하실 수도 있습니다. 이때는 반드시 신청자 본인의 신분증(주민등록증, 운전면허증 등)을 지참하셔야 합니다. 대리인이 방문할 경우 위임장과 가족관계증명서가 추가로 필요할 수 있으니 방문 전 전화로 확인하는 것이 필수입니다.</p>`;
  html += `<p><mark>주의사항!</mark> 신청 기간(4월 30일)이 지나면 예산이 소진되거나 마감되어 지원을 받지 못할 수 있으니 반드시 기한 내에 신청을 완료해 주셔야 합니다.</p>`;

  // Summary Table
  html += `<div class="table-container">`;
  html += `<table class="summary-table">
      <thead><tr><th>항목</th><th>핵심 내용 상세 요약</th></tr></thead>
      <tbody>
        <tr><td><strong>신청 기간</strong></td><td>2024년 3월 2일(월) ~ 4월 30일(화) 자정까지</td></tr>
        <tr><td><strong>지원 대상자</strong></td><td>3월 2일 기준 김해시 주민등록 초등학교 1학년 신입생</td></tr>
        <tr><td><strong>지원 혜택 (금액)</strong></td><td>신입생 1인당 10만 원 (모바일 지역화폐 지급)</td></tr>
        <tr><td><strong>지급 방식</strong></td><td>김해사랑상품권 (제로페이 앱을 통해 발급 및 충전)</td></tr>
        <tr><td><strong>신청 방법</strong></td><td>온라인(정부24 보조금24 포털) 또는 오프라인(행정복지센터 방문)</td></tr>
      </tbody>
    </table>`;
  html += `</div>`;

  // DISCLAIMER
  html += `\n<div class="disclaimer">\n`;
  html += `<div class="disclaimer-title">ℹ️ 콘텐츠 정보 안내</div>\n`;
  html += `본 포스팅은 김해시청 공식 보도자료 및 공지사항을 바탕으로 작성되었으며, 신청 시기와 예산 상황에 따라 세부 내용이 변경될 수 있으니 반드시 공식 홈페이지를 최종 확인하시기 바랍니다.\n`;
  html += `</div>\n`;

  // Tags
  html += `<div class="hash-tags">#김해시지원금 #입학축하금 #초등학생입학 #김해사랑상품권 #교육비지원</div>`;

  html += '</div></div>'; // Close white-paper and gradient-frame

  const payload = {
    platform: 'blogspot',
    publishType: 'publish', // Publish live!
    blogId: process.env.BLOG_ID,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };

  console.log('[LOG] Full HTML payload prepared. Publishing to Blogspot...');
  // Save to HTML file for Playwright testing
  const fs = require('fs');
  fs.writeFileSync('preview-mobile-cta.html', html, 'utf-8');
  console.log('[LOG] Saved HTML to preview-mobile-cta.html for local testing.');
}

testDirectPublish();
