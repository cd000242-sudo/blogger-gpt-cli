// 스킨 적용 테스트 발행
const { publishToWordPress } = require('./dist/wordpress/wordpress-publisher.js');
const { loadEnvFromFile } = require('./dist/env.js');

async function testStyledPublish() {
  console.log('');
  console.log('============================================');
  console.log('   스킨 적용 테스트 발행');
  console.log('============================================');
  console.log('');
  
  const env = loadEnvFromFile();
  
  const wpUrl = env.wordpressSiteUrl || env.WORDPRESS_SITE_URL;
  const wpUser = env.wordpressUsername || env.WORDPRESS_USERNAME;
  const wpPass = env.wordpressPassword || env.WORDPRESS_PASSWORD;
  
  // 테스트용 HTML (스킨 적용 전)
  const testHtml = `
<h2>테스트 H2 제목 - 슬레이트 배경</h2>
<p>이것은 테스트 본문입니다. 스킨이 제대로 적용되면 이 텍스트는 깔끔한 스타일로 보여야 합니다.</p>

<h3>테스트 H3 소제목</h3>
<p>H3 밑의 본문입니다. <strong>강조 텍스트</strong>와 <b>굵은 텍스트</b>가 민트색으로 나타나야 합니다.</p>

<table>
  <thead>
    <tr>
      <th>항목</th>
      <th>내용</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>테스트 1</td>
      <td>슬레이트 모던 테이블</td>
    </tr>
    <tr>
      <td>테스트 2</td>
      <td>깔끔한 디자인</td>
    </tr>
  </tbody>
</table>

<blockquote>
이것은 인용구입니다. 민트 팁 박스 스타일로 나타나야 합니다.
</blockquote>

<ul>
  <li>리스트 항목 1</li>
  <li>리스트 항목 2</li>
  <li>리스트 항목 3</li>
</ul>
`;
  
  const onLog = (msg) => console.log('[LOG]', msg);
  
  try {
    const result = await publishToWordPress({
      title: '🎨 스킨 테스트 - 클린 모던 스타일',
      content: testHtml,
      status: 'draft',
      tags: ['테스트', '스킨테스트'],
      siteUrl: wpUrl,
      username: wpUser,
      password: wpPass,
    }, onLog);
    
    console.log('');
    console.log('============================================');
    console.log('   발행 완료!');
    console.log('============================================');
    console.log('');
    console.log('🔗 URL:', result.url);
    console.log('📝 ID:', result.id);
    console.log('✅ 상태:', result.ok ? '성공' : '실패');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

testStyledPublish();





