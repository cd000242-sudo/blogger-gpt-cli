const path = require('path');
require('dotenv').config({ path: path.join(process.env.APPDATA, 'blogger-gpt-cli', '.env') });
const { makeLeonardoPhoenixImage } = require('./dist/thumbnail.js');

async function testLeo() {
    const apiKey = process.env.LEONARDO_API_KEY;
    console.log('Using API KEY:', apiKey ? apiKey.slice(0, 8) + '***' : 'NONE');

    const result = await makeLeonardoPhoenixImage(
        "3월 2일(내일) 시작! '김해시 초등학생 입학축하금' 10만원 신청",
        "김해시 초등학생 입학축하금 정책 도입 배경과 핵심 내용",
        {
            apiKey: apiKey,
            width: 1024,
            height: 768,
            isThumbnail: false
        }
    );
    console.log('Leonardo Result:', result);
}

testLeo();
