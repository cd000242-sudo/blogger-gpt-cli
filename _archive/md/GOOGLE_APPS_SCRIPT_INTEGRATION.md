# Google Apps Script에 서버 시간 API 추가 가이드

## 📍 추가 위치

기존 `doPost` 함수 **아래**에 `doGet` 함수를 추가하세요.

## 🔧 추가할 코드

```javascript
/** ===================== GET 요청 처리 (서버 시간 API) ===================== **/
function doGet(e) {
  try {
    // 서버 시간 API: /time 엔드포인트
    const path = (e.parameter && e.parameter.path) || (e.pathInfo) || '';
    
    // /time 경로 처리
    if (path === 'time' || !path) {
      // 현재 서버 시간을 밀리초 단위 Unix timestamp로 반환
      return ContentService.createTextOutput(JSON.stringify({
        timestamp: Date.now()
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 알 수 없는 경로
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'unknown_path'
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log('doGet error: %s', err && err.stack || err);
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: String(err && err.message || err)
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 📝 전체 코드 구조

```javascript
// ... 기존 코드 ...

function doPost(e) {
  // ... 기존 doPost 코드 ...
}

// ⬇️ 여기에 doGet 함수 추가
function doGet(e) {
  // 위의 doGet 코드
}
```

## 🚀 배포 방법

1. **Google Apps Script 편집기에서:**
   - 코드 편집기에서 `doGet` 함수 추가
   - 저장 (Ctrl+S)

2. **웹 앱으로 배포:**
   - 상단 메뉴: "배포" > "새 배포"
   - 유형: "웹 앱" 선택
   - 실행 사용자: "나"
   - 액세스 권한: "모든 사용자"
   - "배포" 클릭
   - 배포 URL 복사 (예: `https://script.google.com/macros/s/XXXXX/exec`)

3. **클라이언트 앱 설정:**
   ```env
   LICENSE_SERVER_URL=https://script.google.com/macros/s/XXXXX/exec
   ```

## 🧪 테스트

브라우저에서 직접 접속하여 테스트:

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?path=time
```

**예상 응답:**
```json
{
  "timestamp": 1704067200000
}
```

## 📌 참고사항

1. **경로 파라미터:**
   - Google Apps Script는 기본적으로 쿼리 파라미터로 경로를 전달합니다
   - `?path=time` 형식으로 접근

2. **CORS:**
   - Google Apps Script는 자동으로 CORS를 처리하므로 별도 설정 불필요

3. **인증:**
   - 서버 시간 API는 공개 API이므로 인증 불필요
   - 기존 `doPost`의 관리자 액션과는 별개

4. **성능:**
   - Google Apps Script는 빠르게 응답합니다
   - 클라이언트에서 5분 캐싱을 사용하므로 부하 걱정 없음

## ✅ 완료 체크리스트

- [ ] `doGet` 함수 추가
- [ ] 코드 저장
- [ ] 웹 앱으로 배포
- [ ] 배포 URL 복사
- [ ] 클라이언트 `.env`에 `LICENSE_SERVER_URL` 설정
- [ ] 브라우저에서 테스트
- [ ] 클라이언트 앱에서 동작 확인






