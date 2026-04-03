# 환경 변수 설정 가이드

## 📋 필요한 환경 변수

다음 환경 변수들을 `.env` 파일에 설정해야 합니다:

### 필수 환경 변수
```
BLOG_ID=your_blog_id_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### 선택적 환경 변수 (AI 생성용)
```
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
PEXELS_API_KEY=your_pexels_api_key_here
```

## 🔧 설정 방법

### 방법 1: .env 파일 직접 생성/수정

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 위의 환경 변수들을 입력하세요.

**예시:**
```env
BLOG_ID=1234567890123456789
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GEMINI_API_KEY=AIzaSyAbcdefghijklmnopqrstuvwxyz123456
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456
PEXELS_API_KEY=12345678abcdefghijklmnopqrstuvwxyz
```

### 방법 2: Electron 앱에서 확인

Electron 앱의 환경 설정에서 다음 정보를 확인할 수 있습니다:
- Blog ID
- Google Client ID
- Google Client Secret

이 정보들을 `.env` 파일에 복사하세요.

## 📍 .env 파일 위치

프로젝트 루트 디렉토리:
```
C:\Users\park\blogger-gpt-cli\.env
```

## ✅ 설정 확인

환경 변수가 제대로 설정되었는지 확인하려면:

```bash
# PowerShell에서
Get-Content .env | Select-String -Pattern "BLOG|GOOGLE"
```

또는 스크립트를 실행하면 자동으로 확인됩니다.

## 🚀 스크립트 실행

환경 변수 설정이 완료되면:

```bash
npx ts-node test-publish-layout.ts
```

## ⚠️ 주의사항

1. `.env` 파일은 Git에 커밋하지 마세요 (이미 .gitignore에 포함되어 있을 것입니다)
2. 환경 변수 값에 공백이나 특수문자가 있으면 따옴표로 감싸지 마세요
3. 각 환경 변수는 한 줄에 하나씩 작성하세요








