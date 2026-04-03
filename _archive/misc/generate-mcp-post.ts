import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || '';
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const productData = {
  "title": "셀렉스 프로틴 락토프리 파우더, 570g, 1개",
  "price": "44,900원",
  "originalPrice": "39,900",
  "discount": "41%",
  "rating": "5.0점",
  "ratingCount": "",
  "delivery": "",
  "description": "",
  "specs": [],
  "images": [
    "https://thumbnail.coupangcdn.com/thumbnails/remote/q89/image/retail/images/63935665015203-af128c62-71da-4e27-93eb-36c82ec14c11.jpg",
    "https://thumbnail.coupangcdn.com/thumbnails/remote/q89/image/retail/images/32861433923652-3c9fef91-756a-4bc5-b9af-e8db7a640b86.jpg"
  ],
  "url": "https://www.coupang.com/vp/products/6825320316?itemId=16189216203&src=1139000&spec=10799999&addtag=400&ctag=6825320316&lptag=AF7510899&itime=20260313113558&pageType=PRODUCT&pageValue=6825320316&wPcid=17726977547341917392077&wRef=&wTime=20260313113558&redirect=landing&traceid=V0-101-77230707b2638511&mcid=b5dcf3d5b0ce4be99a190ea2c48b4a2a&campaignid=&clickBeacon=&imgsize=&pageid=&sig=&subid=&campaigntype=&puid=&ctime=&portal=&landing_exp=&placementid=&puidType=&contentcategory=&tsource=&deviceid=&contenttype=&token=&impressionid=&requestid=&contentkeyword=&offerId=&sfId=&subparam="
};

async function generateProductPost(): Promise<void> {
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

이미지 URL:
${productData.images[0]}

위 정보를 바탕으로 독자가 구매하고 싶어지도록 매력적이고 자연스러운 리뷰 포스트를 HTML로 작성해줘. 첫 분단 아래에 메인 이미지를 <img src="..."> 로 넣어줘.
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
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleanContent);
  } catch (error) {
    console.error('JSON 파싱 실패, 원문 저장:\n', content);
    parsed.html = `<article><p>${content}</p></article>`;
  }

  const ctaButtonHtml = `
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://link.coupang.com/a/d3lVwh" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(to bottom, #FF3B2F, #E62A1E); border-radius: 50px; color: #fff !important; font-size: 20px; font-weight: bold; padding: 15px 30px; text-decoration: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block;">
      🚀 최저가 보러가기 (클릭)
    </a>
    <p style="font-size: 11px; color: #999; margin-top: 10px;">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
  </div>`;

  parsed.html = parsed.html.replace('</article>', `${ctaButtonHtml}\n</article>`);
  
  const outputPath = path.join(process.cwd(), 'coupang-mcp-generated-post.html');
  fs.writeFileSync(outputPath, `<h1>${parsed.title}</h1>\n${parsed.html}`);
  console.log(`\n🎉 최종 결과물 HTML 저장 완료: ${outputPath}`);
}

generateProductPost().catch(console.error);
