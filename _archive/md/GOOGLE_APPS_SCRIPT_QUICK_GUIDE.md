# Google Apps Script 서버 시간 API 추가 - 빠른 가이드

## ✅ 네, 그 코드만 복사해서 넣으면 됩니다!

## 📍 추가 위치

기존 코드의 **`doPost` 함수 아래**에 추가하세요.

## 📋 복사할 코드

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

## 📝 전체 코드 예시

```javascript
// ... 기존 코드 ...

function doPost(e) {
  try {
    // ... 기존 doPost 코드 ...
    return json({ ok:false, error:'unknown_action' });
  } catch (err) {
    Logger.log('doPost error: %s', err && err.stack || err);
    return json({ ok:false, error:String(err && err.message || err) });
  }
}

// ⬇️ 여기에 위의 doGet 함수를 복사해서 붙여넣으세요
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

## 🚀 다음 단계

1. **코드 추가 후 저장**
2. **웹 앱으로 배포** (배포 > 새 배포 > 웹 앱)
3. **배포 URL 복사**
4. **클라이언트 `.env`에 설정:**
   ```
   LICENSE_SERVER_URL=https://script.google.com/macros/s/YOUR_ID/exec
   ```

## 🧪 테스트

배포 후 브라우저에서 테스트:
```
https://script.google.com/macros/s/YOUR_ID/exec?path=time
```

**예상 응답:**
```json
{"timestamp":1704067200000}
```

## ✅ 완료!

이제 클라이언트 앱이 서버 시간을 가져와서 라이선스 만료를 정확하게 체크할 수 있습니다!






