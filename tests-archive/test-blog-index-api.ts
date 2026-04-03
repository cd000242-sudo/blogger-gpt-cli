/**
 * 블로그 지수 API 테스트 스크립트
 */

async function testApi() {
  const baseUrl = process.env['API_URL'] || 'http://localhost:3000';
  
  console.log('🧪 블로그 지수 API 테스트\n');
  console.log(`API URL: ${baseUrl}\n`);
  
  // 1. 헬스 체크
  console.log('1️⃣ 헬스 체크...');
  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthResponse.json();
    console.log('✅ 헬스 체크 성공:', healthData);
  } catch (error: any) {
    console.error('❌ 헬스 체크 실패:', error.message);
    return;
  }
  
  // 2. API 키 생성 (관리자)
  console.log('\n2️⃣ API 키 생성...');
  const adminKey = process.env['ADMIN_KEY'] || 'change-me-in-production';
  
  try {
    const createKeyResponse = await fetch(`${baseUrl}/api/admin/create-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey
      },
      body: JSON.stringify({
        name: '테스트 클라이언트',
        dailyLimit: 1000
      })
    });
    
    const createKeyData = await createKeyResponse.json();
    
    if (createKeyData.success) {
      console.log('✅ API 키 생성 성공!');
      console.log(`   API Key: ${createKeyData.data.apiKey}`);
      console.log(`   이름: ${createKeyData.data.name}`);
      console.log(`   일일 한도: ${createKeyData.data.dailyLimit}`);
      
      const apiKey = createKeyData.data.apiKey;
      
      // 3. 블로그 지수 조회
      console.log('\n3️⃣ 블로그 지수 조회 (mission49)...');
      try {
        const blogIndexResponse = await fetch(`${baseUrl}/api/blog-index/mission49`, {
          headers: {
            'X-API-Key': apiKey
          }
        });
        
        const blogIndexData = await blogIndexResponse.json();
        console.log('✅ 블로그 지수 조회 성공:');
        console.log(JSON.stringify(blogIndexData, null, 2));
      } catch (error: any) {
        console.error('❌ 블로그 지수 조회 실패:', error.message);
      }
      
      // 4. 일괄 조회
      console.log('\n4️⃣ 일괄 조회 (3개 블로그)...');
      try {
        const batchResponse = await fetch(`${baseUrl}/api/blog-index/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          body: JSON.stringify({
            blogIds: ['mission49', 'choibrian', 'kdjmoney']
          })
        });
        
        const batchData = await batchResponse.json();
        console.log('✅ 일괄 조회 성공:');
        console.log(JSON.stringify(batchData, null, 2));
      } catch (error: any) {
        console.error('❌ 일괄 조회 실패:', error.message);
      }
      
      // 5. 사용 통계
      console.log('\n5️⃣ 사용 통계 조회...');
      try {
        const statsResponse = await fetch(`${baseUrl}/api/stats`, {
          headers: {
            'X-API-Key': apiKey
          }
        });
        
        const statsData = await statsResponse.json();
        console.log('✅ 사용 통계 조회 성공:');
        console.log(JSON.stringify(statsData, null, 2));
      } catch (error: any) {
        console.error('❌ 사용 통계 조회 실패:', error.message);
      }
      
    } else {
      console.error('❌ API 키 생성 실패:', createKeyData.error);
    }
    
  } catch (error: any) {
    console.error('❌ API 키 생성 실패:', error.message);
  }
  
  console.log('\n✅ 테스트 완료!\n');
}

// 실행
testApi().catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});







