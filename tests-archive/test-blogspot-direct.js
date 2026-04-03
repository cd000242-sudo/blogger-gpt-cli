// Blogspot 발행 테스트 - lba 폴더의 토큰 직접 사용
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const LBA_PATH = path.join(process.env.APPDATA, 'lba');
const tokenPath = path.join(LBA_PATH, 'blogger-token.json');
const envPath = path.join(LBA_PATH, '.env');

// .env 읽기
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) env[m[1].trim()] = m[2].trim();
});

// 토큰 읽기
const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

const blogId = env.BLOG_ID || env.blogId;
const clientId = env.GOOGLE_CLIENT_ID || env.googleClientId;
const clientSecret = env.GOOGLE_CLIENT_SECRET || env.googleClientSecret;

console.log('BLOG_ID:', blogId);
console.log('TOKEN_EXPIRED:', token.expires_at ? token.expires_at < Date.now() : '?');
console.log('ACCESS_TOKEN_LEN:', token.access_token?.length || 0);

// OAuth2 클라이언트 생성
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: token.expires_at
});

const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

// 테스트 글 임시저장
async function testPublish() {
    try {
        console.log('\n📤 블로그스팟 임시저장 테스트 시작...');
        const result = await blogger.posts.insert({
            blogId: blogId,
            isDraft: true,
            requestBody: {
                title: '[테스트] 발행 테스트 - ' + new Date().toLocaleString('ko-KR'),
                content: '<h2>발행 테스트</h2><p>이 글은 자동 발행 테스트입니다. 삭제해도 됩니다.</p>'
            }
        });

        console.log('\n✅ 발행 성공!');
        console.log('POST_ID:', result.data.id);
        console.log('POST_URL:', result.data.url);
        console.log('STATUS:', result.data.status);
    } catch (error) {
        console.error('\n❌ 발행 실패:', error.message);
        if (error.response) {
            console.error('STATUS:', error.response.status);
            console.error('DATA:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testPublish();
