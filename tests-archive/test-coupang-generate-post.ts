import { CoupangCrawler } from './src/core/coupang-crawler';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// OpenAI 초기화
const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || '';
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function generateProductPost(productData: any): Promise<{ title: string; html: string }> {
  console.log('\n✍️ AI 글 작성 시작...');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 등록되어 있지 않습니다. .env를 확인해주세요.');
  }

  const systemPrompt = `너는 전문 블로그 상품 리뷰 에디터야.
- 친절하고 친구에게 설명하듯 '~요' 체로 작성해줘.
- 쿠팡 파트너스 수익 창출을 위한 상품 리뷰 글이야.
- 제공된 상품 정보를 바탕으로 매력적이고 유용한 리뷰를 5문단 이상 작성해.
- 스펙, 장점, 추천 대상이 꼭 들어가게 해줘.
- 임의의 데이터나 거짓 정보를 만들지 마.
- HTML 형식(<article>, <h2>, <h3>, <p>, <ul>, <li> 등)으로만 출력해줘.`;

  const userPrompt = `
상품명: ${productData.title}
가격: ${productData.price} (원가: ${productData.originalPrice || '정보없음'}, 할인율: ${productData.discount || '없음'})
평점: ${productData.rating} (${productData.ratingCount})
배송정보: ${productData.delivery}

주요 스펙:
${productData.specs ? productData.specs.join('\n') : '정보 없음'}

상세 설명 컨텍스트:
${productData.description ? productData.description.substring(0, 500) : '정보 없음'}...

위 정보를 바탕으로 독자가 구매하고 싶어지도록 매력적이고 자연스러운 리뷰 포스트를 HTML로 작성해줘.
포스트 제목은 매력적인 리뷰형 제목으로 지어서 JSON 형식으로 반환해.
출력 형식: {"title": "문구를 가다듬은 제목", "html": "<article>...</article>"}
`;

  const response = await openai.chat.completions.create({
    model: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || '{}';
  let parsed = { title: productData.title, html: '' };
  
  try {
    // 마크다운 흔적 제거 및 파싱
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleanContent);
  } catch (error) {
    console.error('JSON 파싱 실패, 원문 저장:', content);
    parsed.html = `<article><p>${content}</p></article>`;
  }

  // CTA 버튼 추가 (쿠팡 파트너스 링크 삽입)
  const ctaButtonHtml = `
  <div style="text-align: center; margin: 30px 0;">
    <a href="${productData.url}" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(to bottom, #FF3B2F, #E62A1E); border-radius: 50px; color: #fff !important; font-size: 20px; font-weight: bold; padding: 15px 30px; text-decoration: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block;">
      🚀 최저가 보러가기 (클릭)
    </a>
    <p style="font-size: 11px; color: #999; margin-top: 10px;">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
  </div>`;

  parsed.html = parsed.html.replace('</article>', `${ctaButtonHtml}\n</article>`);
  return parsed;
}

async function runTest() {
  const profileId = process.env['ADSPOWER_PROFILE_ID'] || 'your-profile-id';
  
  // 요청하신 단축 URL (내부적으로 자동으로 상품 페이지로 리다이렉트됨)
  const TARGET_URL = 'https://link.coupang.com/a/d3lVwh';
  
  console.log(`🚀 쿠팡 하이파이델리티 자동화 및 글생성 시스템 구동...`);
  console.log(`📌 단축 URL: ${TARGET_URL}`);
  
  const crawler = new CoupangCrawler(TARGET_URL);
  
  try {
    // 1. 상품 & 이미지 수집 (AdsPower 기반 봇 탐지 우회)
    const result = await crawler.executeCrawl(profileId);
    
    if (result) {
      console.log('\n[1단계 완료] 데이터 추출 및 이미지 다운로드 완료');
      console.log(`수집된 이미지 수: ${result.downloadedImages.length}장`);
      
      // 2. 글 생성 (OpenAI 기반 수익형 블로그 글 작성)
      const post = await generateProductPost(result);
      console.log('\n[2단계 완료] AI 블로그 글 작성 완료');
      console.log(`📝 생성된 제목: ${post.title}`);
      
      // 3. 파일 저장
      const outputPath = path.join(__dirname, 'coupang-generated-post.html');
      fs.writeFileSync(outputPath, `<h1>${post.title}</h1>\n${post.html}`);
      console.log(`\n🎉 최종 결과물 HTML 저장 완료: ${outputPath}`);
      console.log('=' . repeat(60));
      console.log('이 스크립트를 통해 쿠팡 단축 링크의 최종 확인, 이미지 다운로드, 그리고 AI 글 생성까지 완벽히 대응 가능합니다!');
      console.log('=' . repeat(60));
    }
  } catch (err: any) {
    console.error('\n❌ 프로세스 실패:', err.message);
  }
}

runTest();
