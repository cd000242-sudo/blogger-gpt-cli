// 실제 블로그스팟 발행 - gemini-2.5-flash
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const LOG = path.join(__dirname, 'publish-result.txt');
fs.writeFileSync(LOG, '', 'utf-8');
function log(msg) { const line = String(msg); console.log(line); fs.appendFileSync(LOG, line + '\n', 'utf-8'); }

async function main() {
    try {
        const LBA = path.join(process.env.APPDATA, 'lba');
        const envContent = fs.readFileSync(path.join(LBA, '.env'), 'utf-8');
        const env = {};
        envContent.split('\n').forEach(l => { const m = l.match(/^([^#=]+)=(.+)$/); if (m) env[m[1].trim()] = m[2].trim(); });
        const token = JSON.parse(fs.readFileSync(path.join(LBA, 'blogger-token.json'), 'utf-8'));

        const blogId = env.BLOG_ID;
        const clientId = env.GOOGLE_CLIENT_ID;
        const clientSecret = env.GOOGLE_CLIENT_SECRET;
        const geminiKey = env.GEMINI_API_KEY || env.geminiKey;

        log('BLOG_ID: ' + blogId);
        log('TOKEN_EXPIRED: ' + (token.expires_at < Date.now()));

        log('Calling Gemini 2.5-flash...');
        const resp = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + geminiKey,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: '2026년 최신 노트북 추천 가성비 키워드로 한국어 블로그 글을 써줘. 반드시 JSON으로만 답해: {"title":"제목50자이내", "content":"<h2>소제목</h2><p>본문</p>...", "labels":["태그1","태그2"]}. 본문은 HTML, 1500자 이상, h2 소제목 4개, 전문적이지만 친근한 톤.' }] }],
                    generationConfig: { temperature: 0.8, maxOutputTokens: 4096 }
                })
            }
        );

        log('Gemini status: ' + resp.status);
        if (!resp.ok) {
            log('Gemini ERROR: ' + (await resp.text()).substring(0, 500));
            return;
        }

        const data = await resp.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        log('Response length: ' + text.length);

        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) {
            log('JSON NOT FOUND');
            log('Preview: ' + text.substring(0, 500));
            return;
        }

        const article = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        log('TITLE: ' + article.title);
        log('CONTENT_LEN: ' + (article.content?.length || 0));

        // Blogger API
        log('Publishing...');
        const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
        oauth2.setCredentials({ access_token: token.access_token, refresh_token: token.refresh_token, expiry_date: token.expires_at });
        const blogger = google.blogger({ version: 'v3', auth: oauth2 });

        const result = await blogger.posts.insert({
            blogId,
            isDraft: false,
            requestBody: { title: article.title, content: article.content, labels: article.labels || [] }
        });

        log('=== SUCCESS ===');
        log('POST_ID: ' + result.data.id);
        log('POST_URL: ' + result.data.url);
        log('STATUS: ' + result.data.status);
    } catch (err) {
        log('ERROR: ' + err.message);
        if (err.response) log('RESP: ' + JSON.stringify(err.response.data).substring(0, 300));
    }
}

main().then(() => { log('DONE'); process.exit(0); }).catch(e => { log('FATAL: ' + e.message); process.exit(1); });
