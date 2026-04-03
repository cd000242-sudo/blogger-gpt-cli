# 서버 시간 API 적용 확인 가이드

## ✅ 클라이언트 코드 상태

**클라이언트 앱에는 이미 서버 시간 API 호출 기능이 구현되어 있습니다!**

- ✅ `src/utils/license-validator.ts`: 서버 시간 API 호출 코드
- ✅ Google Apps Script URL 형식 지원 (`?path=time`)
- ✅ 일반 서버 URL 형식 지원 (`/time`)
- ✅ `electron/main.ts`: 강화된 라이선스 검증 사용
- ✅ 서버 시간 캐싱 (5분)
- ✅ 타임아웃 처리 (3초)
- ✅ 폴백 로직 (서버 오류 시 로컬 시간 사용)

## 🧪 적용 확인 방법

### 1단계: 서버 테스트 (브라우저)

Google Apps Script 배포 URL로 직접 테스트:

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?path=time
```

**예상 응답:**
```json
{"timestamp":1704067200000}
```

✅ 이 응답이 나오면 서버는 정상 작동합니다!

### 2단계: 클라이언트 앱 설정

`.env` 파일에 서버 URL 추가:

```env
LICENSE_SERVER_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

또는

```env
LICENSE_REDEEM_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

### 3단계: 앱 재시작 및 확인

1. 앱 재시작
2. 개발자 도구 콘솔 열기 (F12)
3. 다음 로그 확인:

**성공 시:**
```
[LICENSE-VALIDATOR] 서버 시간 가져오기 성공
```

**실패 시 (폴백):**
```
[LICENSE-VALIDATOR] 서버 시간 가져오기 실패, 로컬 시간 사용: ...
```

**캐시 사용 시:**
- 로그 없음 (5분간 캐시된 시간 사용)

### 4단계: Node.js 테스트 스크립트 (선택사항)

```bash
# 환경 변수 설정
$env:LICENSE_SERVER_URL="https://script.google.com/macros/s/YOUR_ID/exec"

# 테스트 실행
node test-server-time-api.js
```

## 🔍 적용 확인 체크리스트

### 서버 측 (Google Apps Script)
- [ ] `doGet` 함수 추가됨
- [ ] 코드 저장됨
- [ ] 웹 앱으로 배포됨
- [ ] 배포 URL 복사됨
- [ ] 브라우저에서 `?path=time` 테스트 성공 ✅

### 클라이언트 측
- [ ] `.env` 파일에 `LICENSE_SERVER_URL` 설정됨
- [ ] 앱 재시작됨
- [ ] 개발자 도구 콘솔에서 서버 시간 로그 확인

## 📊 로그 확인 위치

1. **Electron 개발자 도구:**
   - 앱 실행 중 `Ctrl+Shift+I` (또는 `F12`)
   - Console 탭에서 `[LICENSE-VALIDATOR]` 로그 확인

2. **터미널/콘솔:**
   - 앱 실행 시 터미널에도 로그 출력됨

## 🚨 문제 해결

### 문제: 서버 시간을 가져올 수 없음

**확인 사항:**
1. 서버 URL이 올바른지 확인
2. Google Apps Script가 웹 앱으로 배포되었는지 확인
3. 배포 시 "액세스 권한: 모든 사용자"로 설정했는지 확인
4. `doGet` 함수가 올바르게 추가되었는지 확인

**해결:**
- 브라우저에서 직접 `?path=time` 접속하여 테스트
- 응답이 나오면 서버는 정상, 클라이언트 설정 확인
- 응답이 안 나오면 서버 코드 확인

### 문제: 응답 형식이 다름

**확인:**
- 브라우저에서 `?path=time` 접속 시 응답 확인
- `{"timestamp":숫자}` 형식이어야 함

**해결:**
- `doGet` 함수 코드 재확인
- `timestamp` 필드가 number 타입인지 확인

## ✅ 정상 작동 확인

다음 조건을 만족하면 정상 작동합니다:

1. ✅ 브라우저에서 `?path=time` 접속 시 `{"timestamp":숫자}` 응답
2. ✅ 클라이언트 앱 실행 시 서버 시간 로그 확인 (또는 캐시 사용)
3. ✅ 라이선스 만료 체크가 정확하게 작동

## 📝 참고

- 서버 시간은 5분간 캐시되므로, 처음 호출 후 5분 동안은 서버에 요청하지 않습니다.
- 서버 시간을 가져올 수 없어도 앱은 정상 작동합니다 (로컬 시간 사용).
- 시스템 시간 조작 방지는 서버 시간이 있을 때만 작동합니다.






