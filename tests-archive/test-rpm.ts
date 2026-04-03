import { generateAllSectionsFinal } from './src/core/ultimate-final-functions.js';
import fs from 'fs';

async function runTest() {
    console.log('🚀 Starting 1-Billion-Point "Ultra-RPM" Content Generation Test...');
    try {
        const keyword = '구글 애드센스 수익금 지급받는 방법';
        const h2Titles = [
            '애드센스 수익금, 지급 기준액 100달러 달성하셨나요?',
            'SC제일은행 외화통장 개설이 필요한 진짜 이유',
            '애드센스 결제 수단 추가 및 영문 은행 정보 완벽 입력가이드',
            '지급 보류 알림 해결 및 양식 세금 정보(W-8BEN) 제출법',
            '매월 21일 수입 송금완료 메시지 후 입금까지 걸리는 시간'
        ];

        // Generate the mocked RPM optimized content
        const result = await generateAllSectionsFinal(
            keyword,
            h2Titles,
            ['애드센스 지급일은 보통 21~26일 사이입니다.', '수수료가 1만원 정도 발생할 수 있습니다.'],
            (msg) => console.log(msg)
        );

        fs.writeFileSync('test-1billion-rpm-output.json', JSON.stringify(result, null, 2));
        console.log('✅ 1-Billion-Point test completed. Saved to test-1billion-rpm-output.json');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

runTest();
