# 포스팅 실행 테스트 가이드

## 실행 방법

### 방법 1: npm 스크립트 사용 (권장)
```bash
npm run test:posting-execution
```

### 방법 2: 직접 실행
```bash
node test-posting-execution.js
```

### 방법 3: Windows 배치 파일 사용
```bash
test-posting-execution.bat
```

## 테스트 내용

이 테스트는 다음을 검증합니다:

1. **환경 변수 로드**: `.env` 파일에서 환경 변수를 로드합니다.
2. **필수 환경 변수 검증**: 다음 필수 변수가 있는지 확인합니다:
   - `GEMINI_API_KEY`
   - `BLOG_ID` (또는 `BLOGGER_BLOG_ID`, `GOOGLE_BLOG_ID`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
3. **페이로드 생성**: 테스트용 페이로드를 생성합니다.
4. **페이로드 검증**: 생성된 페이로드의 유효성을 검증합니다.
5. **Blogger API requestBody 구조 검증**: Blogger API에 전송될 `requestBody`의 구조를 검증합니다.

## 환경 변수 파일 위치

테스트는 다음 경로에서 `.env` 파일을 찾습니다 (우선순위 순):

1. `data/.env` (Electron userData 경로)
2. `.env` (프로젝트 루트)
3. `data/.env` (프로젝트 루트의 data 폴더)

## 예상 출력

성공 시:
```
🚀 포스팅 실행 테스트 시작

📂 1단계: 환경 변수 로드
📂 .env 파일 발견: C:\Users\park\blogger-gpt-cli\data\.env
✅ 환경 변수 로드 완료
📋 로드된 환경 변수 키: GEMINI_API_KEY, BLOG_ID, GOOGLE_CLIENT_ID, ...

🔍 2단계: 필수 환경 변수 검증
✅ 필수 환경 변수 검증 완료

📦 3단계: 페이로드 생성
✅ 페이로드 생성 완료
...

✅ 모든 테스트 통과! 포스팅 실행 준비 완료.
```

## 문제 해결

### PowerShell 오류가 발생하는 경우

터미널 환경 문제일 수 있습니다. 다음을 시도하세요:

1. **배치 파일 사용**: `test-posting-execution.bat` 실행
2. **직접 실행**: `node test-posting-execution.js` 실행
3. **다른 터미널 사용**: CMD 또는 Git Bash에서 실행

### .env 파일을 찾을 수 없는 경우

`.env` 파일이 다음 위치 중 하나에 있는지 확인하세요:
- 프로젝트 루트: `C:\Users\park\blogger-gpt-cli\.env`
- data 폴더: `C:\Users\park\blogger-gpt-cli\data\.env`

### 환경 변수가 누락된 경우

필수 환경 변수가 `.env` 파일에 있는지 확인하세요:
```
GEMINI_API_KEY=your_key_here
BLOG_ID=your_blog_id_here
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

## 참고

- 이 테스트는 실제 API 호출을 하지 않습니다.
- 페이로드 구조와 환경 변수만 검증합니다.
- 실제 포스팅 실행 시 네트워크 오류나 API 오류가 발생할 수 있습니다.









