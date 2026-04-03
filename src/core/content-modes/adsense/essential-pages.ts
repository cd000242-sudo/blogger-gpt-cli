// src/core/content-modes/adsense/essential-pages.ts
// 애드센스 승인 필수 4개 페이지 HTML 생성
// Blogger API pages.insert()를 통해 자동 발행 가능

/**
 * 필수 페이지 타입
 */
export type EssentialPageType = 'privacy' | 'disclaimer' | 'about' | 'contact';

export interface EssentialPageContent {
  type: EssentialPageType;
  title: string;
  slug: string;
  html: string;
}

/**
 * 블로그 이름과 이메일을 받아 4개 필수 페이지 HTML 생성
 */
export function generateEssentialPage(
  type: EssentialPageType,
  blogName: string,
  contactEmail: string,
  blogUrl: string
): EssentialPageContent {
  const year = new Date().getFullYear();

  switch (type) {
    case 'privacy':
      return {
        type: 'privacy',
        title: '개인정보처리방침 (Privacy Policy)',
        slug: 'privacy-policy',
        html: `
<div style="max-width: 800px; margin: 0 auto; font-family: 'Pretendard', sans-serif; line-height: 1.85; color: #1a1a1a;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">개인정보처리방침</h1>
  <p><strong>${blogName}</strong>(이하 "본 블로그")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 및 관련 법령을 준수합니다.</p>
  <p>최종 업데이트: ${year}년</p>

  <h2>1. 수집하는 개인정보 항목</h2>
  <p>본 블로그는 별도의 회원가입 없이 이용 가능하며, 댓글 작성 시 닉네임이 수집될 수 있습니다.</p>

  <h2>2. 쿠키(Cookie) 사용</h2>
  <p>본 블로그는 Google Analytics 및 Google AdSense를 통해 쿠키를 사용할 수 있습니다. 쿠키는 브라우저 설정에서 관리할 수 있습니다.</p>

  <h2>3. 제3자 광고 서비스</h2>
  <p>본 블로그는 Google AdSense를 사용하여 광고를 게재할 수 있습니다. Google은 쿠키를 사용하여 이용자의 관심사에 맞는 광고를 제공합니다. 자세한 내용은 <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">Google 광고 정책</a>을 참고하세요.</p>

  <h2>4. GDPR 준수 (EU 이용자)</h2>
  <p>EU 지역 이용자의 경우, TCF v2.3(투명성 및 동의 프레임워크)에 따라 개인정보 수집 전 명시적 동의를 받습니다.</p>

  <h2>5. 개인정보의 보유 및 이용 기간</h2>
  <p>본 블로그는 이용자의 개인정보를 수집하지 않으며, 댓글을 통해 제공된 정보는 댓글 삭제 시 함께 삭제됩니다.</p>

  <h2>6. 문의</h2>
  <p>개인정보 관련 문의: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
</div>`.trim(),
      };

    case 'disclaimer':
      return {
        type: 'disclaimer',
        title: '면책조항 (Disclaimer)',
        slug: 'disclaimer',
        html: `
<div style="max-width: 800px; margin: 0 auto; font-family: 'Pretendard', sans-serif; line-height: 1.85; color: #1a1a1a;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">면책조항</h1>
  <p><strong>${blogName}</strong>에 게시된 모든 콘텐츠는 정보 제공 목적으로만 작성되었습니다.</p>

  <h2>일반 면책</h2>
  <p>본 블로그의 정보는 작성 시점 기준으로 정확하다고 판단되나, 완전성과 정확성을 보장하지 않습니다. 독자는 전문가의 조언을 구한 후 의사결정을 내리시기 바랍니다.</p>

  <h2>전문 조언 면책</h2>
  <p>본 블로그의 콘텐츠는 의료, 법률, 재정, 세무 등 전문 분야의 조언을 대체하지 않습니다. 해당 분야의 전문가에게 별도로 상담하시기 바랍니다.</p>

  <h2>외부 링크</h2>
  <p>본 블로그에 포함된 외부 링크는 참고용이며, 해당 사이트의 콘텐츠에 대해 책임지지 않습니다.</p>

  <h2>저작권</h2>
  <p>본 블로그의 텍스트, 이미지, 기타 콘텐츠는 저작권법에 의해 보호됩니다. 무단 복제 및 재배포를 금지합니다.</p>

  <p>최종 업데이트: ${year}년</p>
</div>`.trim(),
      };

    case 'about':
      return {
        type: 'about',
        title: '소개 (About)',
        slug: 'about',
        html: `
<div style="max-width: 800px; margin: 0 auto; font-family: 'Pretendard', sans-serif; line-height: 1.85; color: #1a1a1a;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">${blogName} 소개</h1>

  <h2>블로그 소개</h2>
  <p><strong>${blogName}</strong>은 독자에게 유용하고 신뢰할 수 있는 정보를 제공하기 위해 운영되는 블로그입니다.</p>

  <h2>운영 목적</h2>
  <ul>
    <li>검증된 정보를 쉽고 정확하게 전달</li>
    <li>직접 경험을 바탕으로 한 실용적 가이드 제공</li>
    <li>최신 트렌드와 업데이트를 반영한 콘텐츠 발행</li>
  </ul>

  <h2>콘텐츠 품질 기준</h2>
  <p>모든 콘텐츠는 아래 기준을 충족합니다:</p>
  <ul>
    <li>신뢰할 수 있는 출처 기반 작성</li>
    <li>직접 경험 및 전문 지식 반영</li>
    <li>정기적인 내용 업데이트</li>
    <li>객관적이고 균형 잡힌 관점</li>
  </ul>

  <h2>문의</h2>
  <p>블로그 관련 문의는 <a href="mailto:${contactEmail}">${contactEmail}</a>으로 보내주세요.</p>
</div>`.trim(),
      };

    case 'contact':
      return {
        type: 'contact',
        title: '연락처 (Contact)',
        slug: 'contact',
        html: `
<div style="max-width: 800px; margin: 0 auto; font-family: 'Pretendard', sans-serif; line-height: 1.85; color: #1a1a1a;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">연락처</h1>

  <p><strong>${blogName}</strong>에 대한 문의, 제안, 피드백은 아래 방법으로 연락해주세요.</p>

  <h2>이메일</h2>
  <p>📧 <a href="mailto:${contactEmail}">${contactEmail}</a></p>

  <h2>문의 유형</h2>
  <ul>
    <li>콘텐츠 관련 문의 및 오류 신고</li>
    <li>협업 및 기고 제안</li>
    <li>개인정보 관련 요청</li>
    <li>저작권 관련 문의</li>
    <li>기타 제안 사항</li>
  </ul>

  <h2>응답 시간</h2>
  <p>문의사항은 영업일 기준 1-3일 내에 답변드리겠습니다.</p>

  <p>블로그 URL: <a href="${blogUrl}" target="_blank" rel="noopener">${blogUrl}</a></p>
</div>`.trim(),
      };
  }
}

/**
 * 4개 필수 페이지 전체 생성
 * IPC 핸들러에서 config 객체로 호출됨
 */
export function generateAllEssentialPages(
  config: { blogName: string; email: string; blogUrl: string; ownerName?: string }
): EssentialPageContent[] {
  const { blogName, email: contactEmail, blogUrl } = config;
  const types: EssentialPageType[] = ['privacy', 'disclaimer', 'about', 'contact'];
  return types.map(type => generateEssentialPage(type, blogName, contactEmail, blogUrl));
}
