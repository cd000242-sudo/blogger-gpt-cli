# doGet 함수 오류 진단

## 🔍 가능한 원인들

새 배포를 했는데도 "doGet 함수를 찾을 수 없습니다" 오류가 나는 경우:

### 1. 함수 이름 오타
- ❌ `doget` (소문자)
- ❌ `DoGet` (대소문자 혼합)
- ✅ `doGet` (정확한 이름)

### 2. 함수가 저장되지 않음
- 코드 편집기에서 **저장(Ctrl+S)** 확인
- 저장 후 배포해야 함

### 3. 배포 설정 문제
- **배포 유형**: "웹 앱"으로 배포했는지 확인
- **실행 사용자**: "나"로 설정
- **액세스 권한**: "모든 사용자"로 설정

### 4. 코드 문법 오류
- 코드에 문법 오류가 있으면 함수가 인식되지 않을 수 있음
- Google Apps Script 편집기에서 오류 메시지 확인

### 5. 배포 버전 문제
- "새 버전"으로 배포했는지 확인
- 기존 배포를 편집했는지 확인

## ✅ 확인 체크리스트

Google Apps Script 편집기에서:

1. **doGet 함수 존재 확인**
   ```javascript
   function doGet(e) {  // ← 이 함수가 있는지 확인
     // ...
   }
   ```

2. **저장 확인**
   - Ctrl+S 또는 저장 버튼 클릭
   - 저장 완료 확인

3. **문법 오류 확인**
   - 편집기 하단에 빨간 오류 표시가 없는지 확인

4. **배포 확인**
   - 배포 > 배포 관리
   - 최신 배포가 "새 버전"인지 확인
   - 배포 유형이 "웹 앱"인지 확인

## 🧪 테스트 방법

### 방법 1: 브라우저에서 직접 테스트
```
https://script.google.com/macros/s/AKfycbxOUtjXlyQGcnJoK2DK_SgvyOe7pO9mzQnUgwGDI0p2D370340oJ2e8ostOzCYvn1Nygw/exec?path=time
```

**성공 시:**
```json
{"timestamp":1704067200000}
```

**실패 시:**
- HTML 오류 페이지 표시
- "doGet 함수를 찾을 수 없습니다" 메시지

### 방법 2: Node.js 테스트
```bash
node test-license-server.js
```

## 🔧 해결 방법

### Step 1: 코드 재확인
```javascript
function doGet(e) {
  try {
    const path = (e.parameter && e.parameter.path) || (e.pathInfo) || '';
    
    if (path === 'time' || !path) {
      return ContentService.createTextOutput(JSON.stringify({
        timestamp: Date.now()
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
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

### Step 2: 완전히 새로 배포
1. **기존 배포 삭제** (선택사항)
2. **배포 > 새 배포**
3. **유형: 웹 앱**
4. **설명: "서버 시간 API"**
5. **실행 사용자: 나**
6. **액세스 권한: 모든 사용자**
7. **배포 클릭**
8. **새 URL 복사**

### Step 3: 1-2분 대기 후 테스트
Google 서버 반영 시간 필요

## 💡 추가 팁

만약 여전히 안 된다면:

1. **doPost는 작동하는지 확인**
   - doPost가 작동한다면 배포 자체는 정상
   - doGet만 문제인 경우 함수 이름/위치 확인

2. **간단한 테스트 함수 추가**
   ```javascript
   function doGet(e) {
     return ContentService.createTextOutput("Hello World")
       .setMimeType(ContentService.MimeType.TEXT);
   }
   ```
   - 이렇게 간단한 버전으로 먼저 테스트
   - 작동하면 점진적으로 기능 추가

3. **Google Apps Script 로그 확인**
   - 실행 > 로그 보기
   - 오류 메시지 확인






