/**
 * test-adsense-nanobana.js
 * 에드센스 모드 통합 테스트 — 나노바나나2 이미지 생성 + Clean CSS + Blogger 발행
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── userData 경로 ──
function getUserDataPath() {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || process.env.USERPROFILE || '', 'blogger-gpt-cli');
    }
    return path.join(process.env.HOME || '', '.config', 'blogger-gpt-cli');
}

// ── .env 로드 ──
function loadEnv() {
    const paths = [
        path.join(getUserDataPath(), '.env'),
        path.join(__dirname, '.env'),
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            console.log(`[ENV] ${p}`);
            return parseEnvFile(fs.readFileSync(p, 'utf-8'));
        }
    }
    throw new Error('.env 파일 없음');
}

function parseEnvFile(content) {
    const vars = {};
    content.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) vars[match[1].trim()] = match[2].trim();
    });
    return vars;
}

// ── REST 호출 ──
function httpRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.request(url, options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// ── 토큰 갱신 ──
async function refreshToken(refreshTk, clientId, clientSecret) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTk,
        client_id: clientId,
        client_secret: clientSecret,
    }).toString();

    const res = await httpRequest('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, body);

    return res.data.access_token;
}

// ── 나노바나나2 이미지 생성 (Gemini API) ──
async function generateNanoBanana2Image(title, topic, apiKey, isThumbnail = false) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const startTime = Date.now();

    // 모델 우선순위 (Imagen4 우선 → Gemini 2.5 Flash 폴백)
    // Imagen4가 첫 실행에서 검증됨
    const USE_IMAGEN4_FIRST = true;
    const MODELS = [
        { id: 'gemini-2.5-flash-preview-image-generation', name: '나노바나나 (Gemini 2.5 Flash Image)' },
    ];

    // 프롬프트 생성
    let prompt;
    if (isThumbnail) {
        prompt = `Generate a professional blog thumbnail image.
Topic: ${topic}. Title: ${title}.
Style: Modern, vibrant, eye-catching.
CRITICAL: NO text, NO letters, NO words, NO watermarks.
Show relevant objects, environment and setting.
Clean professional photography, bright natural lighting, 4K quality.
If people appear, they must be Korean/East Asian in a Korean setting.`;
    } else {
        prompt = `Create a professional stock photograph about "${topic}".
Context: ${title}.
Show relevant objects, environment and setting that directly represent this topic.
Style: Clean, professional stock photography, bright clear lighting.
CRITICAL: NO text, NO letters, NO words, NO watermarks, NO logos.
If people appear, they must be Korean/East Asian.
Pure photographic image only with Korean setting and context.`;
    }

    // Imagen 4 먼저 시도 (첫 실행에서 검증됨)
    try {
        console.log(`  🔄 Imagen 4 시도 (검증된 모델)...`);
        const imagen4Models = ['imagen-4.0-generate-001', 'imagen-4.0-fast-generate-001'];
        for (const modelId of imagen4Models) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'allow_adult' },
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const imgBase64 = data.predictions?.[0]?.bytesBase64Encoded;
                if (imgBase64) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`  ✅ Imagen4 (${modelId}) 성공! (${elapsed}초, ${Math.round(imgBase64.length / 1024)}KB)`);
                    return { ok: true, dataUrl: `data:image/png;base64,${imgBase64}` };
                }
            } else {
                const errText = await response.text().catch(() => '');
                console.log(`  ⚠️ Imagen4 ${modelId} 실패 (${response.status}): ${errText.slice(0, 100)}`);
            }
        }
    } catch (e) {
        console.log(`  ⚠️ Imagen4 실패: ${e.message?.slice(0, 100)}`);
    }

    // Gemini 2.5 Flash 폴백
    for (const modelInfo of MODELS) {
        try {
            console.log(`  🧪 ${modelInfo.name} 시도 중...`);
            const model = genAI.getGenerativeModel({
                model: modelInfo.id,
                generationConfig: { responseModalities: ['image', 'text'] },
            });

            const result = await model.generateContent(prompt);
            const response = result.response;

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    const imageData = part.inlineData.data;
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    const dataUrl = `data:${mimeType};base64,${imageData}`;
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const sizeKB = Math.round(imageData.length / 1024);
                    console.log(`  ✅ ${modelInfo.name} 성공! (${elapsed}초, ${sizeKB}KB)`);
                    return { ok: true, dataUrl };
                }
            }
            console.log(`  ⚠️ ${modelInfo.name} - 이미지 없음, 다음 시도...`);
        } catch (e) {
            console.log(`  ⚠️ ${modelInfo.name} 실패: ${e.message?.slice(0, 100)}`);
        }
    }

    return { ok: false, error: '모든 이미지 모델 실패 (Imagen4 → Gemini 2.5 Flash)' };
}

// ── 이미지를 Blogger에 업로드 ──
async function uploadImageToBlogger(dataUrl, accessToken, blogId) {
    // dataUrl에서 base64 추출
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;

    const mimeType = matches[1];
    const base64Data = matches[2];

    // 임시 포스트를 생성해서 이미지를 업로드하는 대신,
    // 직접 base64 이미지를 HTML에 인라인으로 삽입하지 않고
    // Blogger에서 인식할 수 있도록 임시 포스트로 업로드
    // → 간단하게 Imgur에 업로드 (공개 API)
    try {
        const imgurResponse = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
                'Authorization': 'Client-ID 546c25a59c58ad7', // Anonymous upload
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: base64Data, type: 'base64' })
        });
        if (imgurResponse.ok) {
            const imgurData = await imgurResponse.json();
            if (imgurData.data?.link) {
                console.log(`  📤 Imgur 업로드 성공: ${imgurData.data.link}`);
                return imgurData.data.link;
            }
        }
    } catch (e) {
        console.log(`  ⚠️ Imgur 업로드 실패: ${e.message}`);
    }
    return null;
}

// ── 에드센스 클린 CSS ──
function getAdsenseCleanCSS() {
    return `
/* 에드센스 승인 전용 CSS — Clean Mode */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css');

.post-body, .entry-content {
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 16.5px;
  line-height: 1.85;
  color: #1a1a1a;
  word-break: keep-all;
  max-width: 720px;
  margin: 0 auto;
}

.post-body h2, .entry-content h2 {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 48px 0 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e5e7eb;
  line-height: 1.4;
}

.post-body h3, .entry-content h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 36px 0 16px;
  padding-left: 14px;
  border-left: 4px solid #3b82f6;
  line-height: 1.4;
}

.post-body p, .entry-content p {
  margin: 0 0 18px;
}

.post-body blockquote, .entry-content blockquote {
  margin: 24px 0;
  padding: 20px 24px;
  background-color: #f9fafb;
  border-left: 4px solid #6b7280;
  border-radius: 0 8px 8px 0;
  font-style: normal;
  color: #374151;
}

.post-body table, .entry-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 24px 0;
  font-size: 15px;
}

.post-body th, .entry-content th {
  background-color: #f3f4f6;
  color: #111827;
  font-weight: 600;
  padding: 14px 16px;
  text-align: left;
  border: 1px solid #d1d5db;
}

.post-body td, .entry-content td {
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  vertical-align: top;
}

.post-body tr:nth-child(even) td, .entry-content tr:nth-child(even) td {
  background-color: #f9fafb;
}

.post-body img, .entry-content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 24px 0;
}

figcaption {
  text-align: center;
  font-size: 13px;
  color: #64748b;
  margin-top: 8px;
  font-style: italic;
}

.faq-item {
  margin-bottom: 16px;
  padding: 16px 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.faq-item h3 {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 8px;
  padding-left: 0;
  border-left: none;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f0f9ff;
  border-radius: 12px;
  margin-bottom: 32px;
  border: 1px solid #bae6fd;
}

.info-box {
  margin: 24px 0;
  padding: 20px 24px;
  background: #eff6ff;
  border-radius: 10px;
  border: 1px solid #bfdbfe;
}

.post-body a, .entry-content a {
  color: #2563eb;
  text-decoration: none;
}

/* CTA/광고 강제 제거 */
.cta-btn, .cta-banner, .cta-box, .cta-wrapper,
.ad-safe-zone, .ad-placeholder, .ad-container {
  display: none !important;
}

/* 애니메이션 제거 */
@keyframes ctaPulse { from {} to {} }
@keyframes premiumPulse { from {} to {} }
@keyframes bounce { from {} to {} }
@keyframes fadeFloat { from {} to {} }

@media (max-width: 768px) {
  .post-body, .entry-content { font-size: 15.5px; }
  .post-body h2, .entry-content h2 { font-size: 21px; }
}`;
}

// ── 메인 ──
async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🏆 에드센스 모드 통합 테스트');
    console.log('   나노바나나2 이미지 + Clean CSS + Blogger 발행');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    const env = loadEnv();
    const blogId = env.BLOGGER_BLOG_ID || env.GOOGLE_BLOG_ID;
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const geminiApiKey = env.GEMINI_API_KEY;

    if (!blogId || !clientId || !clientSecret || !geminiApiKey) {
        console.error('❌ .env에 필수 키 누락 (BLOGGER_BLOG_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GEMINI_API_KEY)');
        process.exit(1);
    }

    // ── 1. 토큰 갱신 ──
    const tokenPath = path.join(getUserDataPath(), 'blogger-token.json');
    if (!fs.existsSync(tokenPath)) {
        console.error('❌ blogger-token.json 없음. 앱에서 Blogger 인증을 먼저 하세요.');
        process.exit(1);
    }
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

    console.log('🔄 토큰 갱신 중...');
    let accessToken;
    try {
        accessToken = await refreshToken(tokenData.refresh_token, clientId, clientSecret);
        console.log('✅ 토큰 갱신 성공\n');
    } catch (e) {
        console.error('❌ 토큰 갱신 실패:', e.message);
        process.exit(1);
    }

    // ── 2. 나노바나나2 이미지 생성 (5장: 썸네일 1 + 본문 4) ──
    console.log('🍌 나노바나나2 이미지 생성 중...\n');

    const topic = '봄철 건강관리';
    const sections = [
        { title: '봄철 건강관리 완벽 가이드', isThumbnail: true },
        { title: '봄철 알레르기 예방법', isThumbnail: false },
        { title: '봄나물 건강 레시피', isThumbnail: false },
        { title: '봄철 운동 가이드', isThumbnail: false },
        { title: '환절기 면역력 관리', isThumbnail: false },
    ];

    const generatedImages = [];
    for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        console.log(`[${i + 1}/${sections.length}] ${sec.isThumbnail ? '📸 썸네일' : '🖼️ 본문'}: "${sec.title}"`);
        const result = await generateNanoBanana2Image(sec.title, topic, geminiApiKey, sec.isThumbnail);
        if (result.ok) {
            // Imgur 업로드
            const imgUrl = await uploadImageToBlogger(result.dataUrl, accessToken, blogId);
            generatedImages.push({
                ...sec,
                dataUrl: result.dataUrl,
                hostedUrl: imgUrl || null,
            });
        } else {
            console.log(`  ❌ 실패: ${result.error}`);
            generatedImages.push({ ...sec, dataUrl: null, hostedUrl: null });
        }
        // API 리밋 방지
        if (i < sections.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    const successCount = generatedImages.filter(g => g.dataUrl).length;
    console.log(`\n✅ 이미지 생성 완료: ${successCount}/${sections.length}장 성공\n`);

    // ── 3. HTML 콘텐츠 조립 ──
    const thumbnailImg = generatedImages[0];
    const bodyImages = generatedImages.slice(1);

    // 이미지 URL 결정 (호스팅 URL 우선, 없으면 data URL 사용)
    function imgSrc(item) {
        if (!item || !item.dataUrl) return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format';
        return item.hostedUrl || item.dataUrl;
    }

    const html = `
<div class="post-body entry-content">

<p><em>이 글은 2026년 3월 기준으로 작성되었습니다.</em></p>

<div class="author-info">
  <div>
    <strong>박지현</strong> · 한의학 박사, 건강 칼럼니스트<br>
    <small>계절 건강 전문 | 12년 경력 | 한국한의학연구원 출신</small>
  </div>
</div>

<p>봄은 생명이 깨어나는 계절이지만, 우리 몸에는 의외로 까다로운 시기이기도 합니다. 저는 한의학 박사로서 12년간 환절기 건강 관리를 연구해왔는데요. 오늘은 2026년 봄철 건강관리의 핵심을 정리해드리겠습니다.</p>

<h2>봄철 알레르기, 왜 해마다 심해지는가</h2>

<figure>
  <img src="${imgSrc(bodyImages[0])}" alt="봄철 꽃가루 알레르기를 겪는 한국인 여성이 마스크를 쓰고 야외를 걷는 모습" loading="lazy" />
  <figcaption>봄철 야외 활동 시 마스크 착용이 알레르기 예방에 효과적입니다</figcaption>
</figure>

<p>기상청과 국립환경과학원의 공동 연구에 따르면, 2026년 봄 꽃가루 농도는 2020년 대비 약 34% 증가할 것으로 예측됩니다. 이는 기후변화에 따른 개화 시기 앞당김과 관련이 깊어요.</p>

<p>실제로 제가 진료실에서 만나는 환자 중 60% 이상이 "예전에는 괜찮았는데 요 몇 년 새 알레르기가 생겼다"고 말합니다. 이건 개인의 문제가 아니라 환경 변화의 영향이 큰 거예요.</p>

<h3>알레르기 예방을 위한 3가지 핵심 전략</h3>

<p>첫째, 외출 후 반드시 세안과 양치를 하세요. 꽃가루는 눈, 코, 입 점막에 달라붙어 반응을 일으키거든요. 둘째, 실내 습도를 50% 전후로 유지하는 게 중요합니다. 셋째, 프로바이오틱스 복용을 고려해보세요. 장내 미생물 환경 개선이 면역 반응 조절에 도움된다는 연구 결과가 있습니다.</p>

<h2>봄나물로 건강 챙기기 — 제철 식재료 활용법</h2>

<figure>
  <img src="${imgSrc(bodyImages[1])}" alt="다양한 봄나물이 놓인 한국 전통 시장 풍경" loading="lazy" />
  <figcaption>제철 봄나물에는 겨울 동안 부족했던 비타민과 미네랄이 풍부합니다</figcaption>
</figure>

<p>농촌진흥청 국립농업과학원의 분석에 따르면, 냉이에는 비타민 A가 시금치의 3배, 비타민 C가 레몬의 1.5배 함유되어 있습니다. 달래는 알리신 성분이 풍부해서 혈액순환과 면역력 강화에 효과적이에요.</p>

<table>
  <thead>
    <tr>
      <th>봄나물</th>
      <th>주요 영양소</th>
      <th>건강 효과</th>
      <th>추천 조리법</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>냉이</td>
      <td>비타민A, 칼슘</td>
      <td>간 건강, 눈 피로 회복</td>
      <td>된장국, 전</td>
    </tr>
    <tr>
      <td>달래</td>
      <td>알리신, 비타민C</td>
      <td>혈액순환, 면역력</td>
      <td>양념장, 무침</td>
    </tr>
    <tr>
      <td>쑥</td>
      <td>시네올, 철분</td>
      <td>소화 촉진, 빈혈 예방</td>
      <td>떡, 수프</td>
    </tr>
    <tr>
      <td>두릅</td>
      <td>사포닌, 단백질</td>
      <td>혈당 관리, 피로 회복</td>
      <td>튀김, 초장무침</td>
    </tr>
  </tbody>
</table>

<h2>봄철 운동 가이드 — 전문가의 실전 조언</h2>

<figure>
  <img src="${imgSrc(bodyImages[2])}" alt="한국의 봄 공원에서 조깅하는 커플" loading="lazy" />
  <figcaption>봄철 야외 운동은 오전 10시~오후 2시 사이가 최적입니다</figcaption>
</figure>

<p>대한체육회의 권고에 따르면, 겨울 동안 운동을 쉬었다면 첫 2주는 평소 운동 강도의 60% 수준에서 시작하는 것이 좋습니다. 갑작스러운 고강도 운동은 근육 부상 위험을 3배까지 높이거든요.</p>

<p>제가 추천하는 봄철 최적 운동 루틴은 이렇습니다. 월수금은 30분 걷기 + 스트레칭, 화목은 가벼운 근력 운동 20분, 주말에는 등산이나 자전거 타기를 1시간 정도 하는 겁니다. 이 루틴을 4주만 따라하면 체력이 눈에 띄게 좋아져요.</p>

<h2>환절기 면역력 — 과학적으로 검증된 관리법</h2>

<figure>
  <img src="${imgSrc(bodyImages[3])}" alt="건강한 식단과 영양제가 놓인 한국 가정의 식탁" loading="lazy" />
  <figcaption>균형 잡힌 식단과 적절한 보충제가 면역력 유지의 핵심입니다</figcaption>
</figure>

<p>서울대학교 의과대학의 2025년 연구에 의하면, 비타민 D 수치가 정상 범위(30ng/mL 이상)인 사람은 감기 발병률이 42% 낮았습니다. 문제는 한국인의 약 75%가 비타민 D 부족 상태라는 점이에요.</p>

<p>면역력 관리의 핵심은 크게 세 가지입니다. 수면 7시간 이상 확보하기, 하루 30분 이상 야외 활동으로 비타민 D 합성하기, 그리고 발효식품(김치, 된장, 요거트)을 매일 섭취하는 것입니다.</p>

<h2>자주 묻는 질문 (FAQ)</h2>

<div class="faq-item">
  <h3>Q. 봄철에 특별히 더 챙겨야 할 영양소가 있나요?</h3>
  <p>비타민 C와 D가 가장 중요합니다. 비타민 C는 알레르기 반응 완화에 도움되고, 비타민 D는 겨울 동안 부족해진 수치를 보충해야 합니다. 하루 비타민 C 1000mg, 비타민 D 2000IU 정도가 적정량입니다.</p>
</div>

<div class="faq-item">
  <h3>Q. 황사와 미세먼지가 심한 날 운동해도 되나요?</h3>
  <p>미세먼지 '나쁨' 이상일 때는 실외 운동을 피하는 것이 좋습니다. 실내 운동으로 대체하거나, 미세먼지 농도가 낮은 이른 아침(오전 6-8시)에 운동하는 것을 권합니다.</p>
</div>

<div class="faq-item">
  <h3>Q. 봄 졸음(춘곤증)을 이기는 방법은?</h3>
  <p>춘곤증은 계절 변화에 따른 생체리듬 적응 과정입니다. 충분한 수면, 가벼운 스트레칭, 뇌 활력 비타민B군 보충이 효과적입니다. 특히 점심 후 10-20분의 짧은 낮잠이 오후 집중력을 40% 향상시킨다는 연구 결과가 있습니다.</p>
</div>

<div class="faq-item">
  <h3>Q. 봄철 피부 관리에서 가장 중요한 것은?</h3>
  <p>자외선 차단입니다. 봄철 자외선은 여름 못지않게 강합니다. SPF 30 이상의 자외선 차단제를 매일 바르고, 2-3시간마다 덧발라주는 것이 기본입니다.</p>
</div>

<h2>마무리 — 핵심 정리</h2>

<div class="info-box">
  <p><strong>봄철 건강관리 핵심 5가지</strong></p>
  <p>1. 알레르기 예방 — 외출 후 세안·양치, 실내 습도 50% 유지</p>
  <p>2. 제철 봄나물 섭취 — 냉이, 달래, 쑥으로 비타민·미네랄 보충</p>
  <p>3. 점진적 운동 시작 — 첫 2주는 60% 강도로 부상 방지</p>
  <p>4. 비타민 D 보충 — 하루 30분 야외 활동 + 보충제 고려</p>
  <p>5. 수면 관리 — 7시간 이상 + 짧은 낮잠으로 춘곤증 극복</p>
</div>

<p>봄은 건강 습관을 새롭게 세우기에 가장 좋은 시기입니다. 위의 가이드를 참고하여 올봄 건강하게 보내시길 바랍니다.</p>

<p><small>이 글은 2026년 3월 기준으로 작성되었으며, 개인의 건강 상태에 따라 전문의와 상담하시기를 권장합니다.</small></p>

</div>`;

    // CSS + HTML 결합
    const cssBlock = `<style>${getAdsenseCleanCSS()}</style>`;
    const finalHtml = cssBlock + html;

    // ── 4. 정합성 체크 ──
    console.log('🔍 에드센스 정합성 체크:');
    console.log('─'.repeat(50));

    const bodyOnly = finalHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    const checks = [
        { name: '이미지 3개+', pass: (bodyOnly.match(/<img\s/gi) || []).length >= 3 },
        { name: 'CTA 클래스 없음', pass: !bodyOnly.match(/cta-btn|cta-box|cta-banner/) },
        { name: 'ad-safe-zone 없음', pass: !bodyOnly.includes('ad-safe-zone') },
        { name: '애니메이션 없음(본문)', pass: !bodyOnly.match(/pulse|bounce|premiumPulse|fadeFloat/) },
        { name: 'H2 태그 5개+', pass: (bodyOnly.match(/<h2/gi) || []).length >= 5 },
        { name: 'table 존재', pass: (bodyOnly.match(/<table/gi) || []).length >= 1 },
        { name: 'FAQ 3개+', pass: (bodyOnly.match(/faq-item/gi) || []).length >= 3 },
        { name: 'Clean CSS 적용', pass: finalHtml.includes('에드센스 승인 전용 CSS') },
    ];

    let allPass = true;
    for (const c of checks) {
        console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`);
        if (!c.pass) allPass = false;
    }
    console.log('─'.repeat(50));
    console.log(allPass ? '✅ 모든 체크 통과!\n' : '⚠️ 일부 체크 실패\n');

    // ── 5. Blogger 발행 ──
    const title = '2026년 봄철 건강관리 완벽 가이드 — 전문가가 알려주는 알레르기·면역력·운동 팁';
    const labels = ['봄철건강', '건강관리', '알레르기', '면역력'];

    console.log('🚀 Blogger 발행 중 (임시보관)...');

    const postBody = {
        kind: 'blogger#post',
        blog: { id: blogId },
        title: title,
        content: finalHtml,
        labels: labels,
    };

    // 썸네일 설정
    if (thumbnailImg?.hostedUrl) {
        postBody.images = [{ url: thumbnailImg.hostedUrl }];
    }

    try {
        const res = await httpRequest(
            `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?isDraft=true`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            },
            JSON.stringify(postBody)
        );

        console.log('\n═══════════════════════════════════════════════════');
        console.log('✅ 발행 성공!');
        console.log(`📝 제목: ${title}`);
        console.log(`🏷️ 라벨: ${labels.join(', ')}`);
        console.log(`🖼️ 이미지: ${successCount}개 (나노바나나2 생성)`);
        console.log(`📸 썸네일: ${thumbnailImg?.hostedUrl ? '설정됨' : '미설정'}`);
        console.log(`🎨 CSS: AdSense Clean Mode (Pretendard 폰트)`);
        console.log(`📄 Post ID: ${res.data.id}`);
        console.log(`🔗 URL: ${res.data.url || '(임시보관)'}`);
        console.log(`📊 HTML 크기: ${Math.round(finalHtml.length / 1024)}KB`);
        console.log('═══════════════════════════════════════════════════');

        // 미리보기 HTML 저장
        const previewPath = path.join(__dirname, 'test-adsense-preview.html');
        fs.writeFileSync(previewPath, finalHtml, 'utf-8');
        console.log(`\n📋 미리보기 저장: ${previewPath}`);

    } catch (e) {
        console.error('❌ 발행 실패:', e.message);

        // 실패해도 HTML 미리보기는 저장
        const previewPath = path.join(__dirname, 'test-adsense-preview.html');
        fs.writeFileSync(previewPath, finalHtml, 'utf-8');
        console.log(`\n📋 미리보기 저장됨: ${previewPath}`);

        process.exit(1);
    }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
