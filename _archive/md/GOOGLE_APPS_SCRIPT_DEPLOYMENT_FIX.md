# Google Apps Script doGet 함수 오류 해결

## ❌ 현재 오류

```
Script function not found: doGet
```

## 🔍 원인

1. **doGet 함수가 저장되지 않음**
2. **배포가 업데이트되지 않음** (가장 흔한 원인)
3. **함수 이름 오타**

## ✅ 해결 방법

### 1단계: doGet 함수 확인

Google Apps Script 편집기에서:

1. **코드 편집기 열기**
2. **doGet 함수가 있는지 확인**
   - `doGet` 함수가 있어야 함
   - `doPost` 함수 아래에 있어야 함

### 2단계: 코드 저장

1. **Ctrl+S** 또는 **저장** 버튼 클릭
2. **저장 완료 확인**

### 3단계: 새 버전으로 배포 (중요!)

**이 단계가 가장 중요합니다!**

1. **"배포" 메뉴 클릭**
2. **"배포 관리" 클릭**
3. **기존 배포 옆 "연필 아이콘" 클릭** (편집)
4. **"버전" 드롭다운에서 "새 버전" 선택**
5. **"배포" 클릭**
6. **새 배포 URL 확인** (변경될 수 있음)

또는:

1. **"배포" > "새 배포"**
2. **유형: "웹 앱" 선택**
3. **실행 사용자: "나"**
4. **액세스 권한: "모든 사용자"**
5. **"배포" 클릭**
6. **새 배포 URL 복사**

### 4단계: 테스트

새 배포 URL로 테스트:

```
https://script.google.com/macros/s/NEW_ID/exec?path=time
```

**예상 응답:**
```json
{"timestamp":1704067200000}
```

## 📝 doGet 함수 코드 (확인용)

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

## ⚠️ 중요 사항

**Google Apps Script는 코드를 수정해도 기존 배포에 자동으로 반영되지 않습니다!**

반드시 **"새 버전으로 배포"** 또는 **"새 배포"**를 해야 합니다!

## 🧪 테스트 방법

1. **브라우저에서 직접 접속:**
   ```
   https://script.google.com/macros/s/YOUR_ID/exec?path=time
   ```

2. **Node.js 테스트:**
   ```bash
   node test-license-server.js
   ```

## ✅ 성공 확인

다음 응답이 나오면 성공:

```json
{"timestamp":1704067200000}
```

오류 메시지가 나오면:
- 코드 저장 확인
- 새 버전으로 배포 확인
- doGet 함수 이름 확인






