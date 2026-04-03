const https = require('https');
const fs = require('fs');

const API_KEY = process.env.GEMINI_API_KEY || '';
if (!API_KEY) { console.error('GEMINI_API_KEY 환경변수를 설정하세요.'); process.exit(1); }

function testModel(model) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            contents: [{ parts: [{ text: 'Say hello' }] }]
        });

        const opts = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent?key=${API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(opts, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({ model, status: res.statusCode, body, headers: res.headers });
            });
        });

        req.on('error', (e) => resolve({ model, status: 0, body: e.message, headers: {} }));
        req.write(data);
        req.end();
    });
}

async function main() {
    const result = await testModel('gemini-2.0-flash');

    // 전체 응답을 파일에 저장
    const output = [
        `=== ${result.model} ===`,
        `STATUS: ${result.status}`,
        `HEADERS: ${JSON.stringify(result.headers, null, 2)}`,
        `BODY:`,
        result.body
    ].join('\n');

    fs.writeFileSync('test-gemini-result.txt', output, 'utf-8');
    console.log('결과 저장: test-gemini-result.txt');
    console.log('STATUS:', result.status);

    // body에서 핵심 메시지 추출
    try {
        const json = JSON.parse(result.body);
        console.log('ERROR CODE:', json.error?.code);
        console.log('ERROR STATUS:', json.error?.status);
        console.log('ERROR MESSAGE:', json.error?.message);
        if (json.error?.details) {
            json.error.details.forEach((d, i) => {
                console.log(`DETAIL ${i}:`, JSON.stringify(d));
            });
        }
    } catch {
        console.log('RAW:', result.body.substring(0, 500));
    }
}

main();
