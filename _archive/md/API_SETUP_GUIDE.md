# BLOGER-GPT API 설정 가이드

## 현재 상태 확인
❌ API 키가 설정되어 있지 않아 실제 Blogger 발행이 불가능합니다.

## 필요한 API 키들

### 1. Gemini API Key (Google AI)
- **용도**: AI 콘텐츠 생성
- **발급처**: https://makersuite.google.com/app/apikey
- **무료 티어**: 월 60회 요청 (충분)

### 2. Google OAuth2 (Blogger API)
- **용도**: Blogger 글 발행
- **발급처**: https://console.developers.google.com/
- **설정 방법**:
  1. 새 프로젝트 생성
  2. Blogger API 활성화
  3. OAuth 2.0 클라이언트 ID 생성
  4. 승인된 리디렉션 URI: `http://localhost:3000/oauth2callback`

### 3. Naver Search API (선택사항)
- **용도**: CTA 생성을 위한 검색
- **발급처**: https://developers.naver.com/

## 설정 방법

### 1. .env 파일 생성
프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# AI 콘텐츠 생성
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Blogger API
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
BLOGGER_BLOG_ID=your_blogger_blog_id

# Naver 검색 API (선택)
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
```

### 2. user-config.json 업데이트
```json
{
  "apiKeys": {
    "gemini": "your_actual_gemini_api_key_here",
    "googleClientId": "your_google_client_id.apps.googleusercontent.com",
    "googleClientSecret": "your_google_client_secret",
    "naverClientId": "your_naver_client_id",
    "naverClientSecret": "your_naver_client_secret"
  }
}
```

### 3. Blogger 블로그 ID 확인
1. Blogger 대시보드 접속
2. 설정 > 기본 > 블로그 ID 확인
3. 또는 주소창에서 `https://www.blogger.com/blogger.g?blogID=XXXXXXXXXXX#overview`의 XXXXXXXXXXX 부분

## 실제 발행 테스트 실행

API 키 설정 후 다음 명령어로 실제 발행 테스트를 실행하세요:

```bash
# 실제 Blogger 발행 테스트
node test-actual-content-generation.js --real

# 안전한 모의 테스트 (권장)
node test-actual-content-generation.js
```

## API 제한 사항

### Gemini API
- **무료 티어**: 월 60회 요청
- **유료 티어**: 요청당 $0.002
- **일일 제한**: 없음

### Blogger API
- **일일 제한**: 1,000회 요청
- **발행 제한**: 시간당 10회 포스트 발행
- **할당량**: 충분함

### 현재 상태
- ✅ 콘텐츠 생성 엔진: 완성
- ✅ HTML 처리 시스템: 완성
- ✅ CTA 자동 생성: 완성
- ❌ API 키 설정: 필요

## 테스트 결과 (현재)

| 토픽 | 품질 | 상태 |
|------|------|------|
| 프로그래밍 | A등급 (83%) | ✅ 고수 블로거급 |
| 건강 | D등급 (33%) | ⚠️ 개선 필요 |
| 투자 | C등급 (50%) | ⚠️ 개선 필요 |

## 다음 단계

1. **API 키 설정** 완료 후
2. `node test-actual-content-generation.js --real` 실행
3. 실제 Blogger에 고수 블로거 스타일 콘텐츠 발행 확인
4. 품질 평가 시스템으로 콘텐츠 개선 반복

---

💡 **팁**: API 키 발급이 어려우시면 일단 모의 테스트로 콘텐츠 품질을 확인해보세요!


