# 🔧 doGet 함수 배포 문제 해결

## ❌ 현재 상황

테스트 결과:
- ❌ `?path=time` → "doGet 함수를 찾을 수 없습니다"
- ✅ 라이선스 검증 API (doPost) → 정상 작동

## 🔍 원인

**Google Apps Script는 코드를 수정해도 기존 배포에 자동으로 반영되지 않습니다!**

`doGet` 함수를 추가했지만, **새 버전으로 배포하지 않으면** 기존 배포는 여전히 이전 코드를 사용합니다.

## ✅ 해결 방법 (3단계)

### 1단계: doGet 함수 확인

Google Apps Script 편집기에서:

1. 코드 편집기 열기
2. `doGet` 함수가 있는지 확인
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
3. **저장** (Ctrl+S)

### 2단계: 새 버전으로 배포 (중요!)

**이 단계가 필수입니다!**

#### 방법 A: 기존 배포 업데이트 (권장)

1. **"배포" 메뉴 클릭**
2. **"배포 관리" 클릭**
3. **기존 배포 옆 "연필 아이콘" (✏️) 클릭**
4. **"버전" 드롭다운에서 "새 버전" 선택**
5. **"배포" 클릭**
6. **완료!**

#### 방법 B: 새 배포 생성

1. **"배포" > "새 배포"**
2. **유형: "웹 앱" 선택**
3. **설명: "서버 시간 API 추가"**
4. **실행 사용자: "나"**
5. **액세스 권한: "모든 사용자"**
6. **"배포" 클릭**
7. **새 배포 URL 복사** (변경될 수 있음)

### 3단계: 테스트

배포 후 1-2분 기다린 다음 테스트:

```
https://script.google.com/macros/s/AKfycbxOUtjXlyQGcnJoK2DK_SgvyOe7pO9mzQnUgwGDI0p2D370340oJ2e8ostOzCYvn1Nygw/exec?path=time
```

**성공 응답:**
```json
{"timestamp":1704067200000}
```

## 🧪 테스트 명령어

배포 후 실행:

```bash
node test-license-server.js
```

## ⚠️ 주의사항

1. **배포 후 1-2분 대기** (Google 서버 반영 시간)
2. **새 배포 URL이 생성되면** 환경 변수도 업데이트 필요
3. **기존 배포를 업데이트하면** URL은 동일하게 유지됨 (방법 A 권장)

## ✅ 완료 확인

다음 명령어로 확인:

```bash
node test-license-server.js
```

**성공 시:**
```
✅ 서버 시간 API 정상 작동!
📊 시간 비교:
  서버 시간: 2024-01-01T00:00:00.000Z
  로컬 시간: 2024-01-01T00:00:00.000Z
  시간 차이: 0초
```

**실패 시:**
- 코드 저장 확인
- 새 버전으로 배포 확인
- 1-2분 대기 후 재시도






