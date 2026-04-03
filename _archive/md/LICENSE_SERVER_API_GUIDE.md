# 라이선스 서버 API 가이드

## ✅ 클라이언트 코드 상태

**클라이언트 앱에는 이미 서버 시간 API 호출 기능이 추가되어 있습니다!**

- ✅ `src/utils/license-validator.ts`: 서버 시간 API 호출 코드
- ✅ `electron/main.ts`: 강화된 라이선스 검증 사용
- ✅ 서버 시간 캐싱 (5분)
- ✅ 타임아웃 처리 (3초)
- ✅ 폴백 로직 (서버 오류 시 로컬 시간 사용)

**이제 서버 측에서만 `/time` 엔드포인트를 추가하면 됩니다.**

## 서버 시간 API 엔드포인트

라이선스 서버에서 다음 엔드포인트를 제공해야 합니다:

### GET `/time`

서버의 현재 시간을 반환합니다.

**요청:**
```
GET {LICENSE_SERVER_URL}/time
Headers:
  Content-Type: application/json
```

**응답:**
```json
{
  "timestamp": 1234567890123
}
```

**응답 형식:**
- `timestamp`: 서버의 현재 시간 (밀리초 단위 Unix timestamp, number 타입)

**예시 (Node.js/Express):**
```javascript
const express = require('express');
const app = express();

// 서버 시간 API
app.get('/time', (req, res) => {
  res.json({
    timestamp: Date.now()
  });
});

app.listen(3000, () => {
  console.log('라이선스 서버가 포트 3000에서 실행 중');
});
```

**예시 (Python/Flask):**
```python
from flask import Flask, jsonify
import time

app = Flask(__name__)

@app.route('/time', methods=['GET'])
def get_time():
    return jsonify({
        'timestamp': int(time.time() * 1000)  # 밀리초 단위
    })

if __name__ == '__main__':
    app.run(port=3000)
```

**예시 (PHP):**
```php
<?php
header('Content-Type: application/json');
echo json_encode([
    'timestamp' => round(microtime(true) * 1000)  // 밀리초 단위
]);
?>
```

## 라이선스 코드 검증 API

기존에 사용 중인 라이선스 코드 검증 API도 필요합니다:

### POST `/redeem` (또는 설정된 경로)

라이선스 코드를 검증하고 등록합니다.

**요청:**
```json
{
  "code": "TEMP-2025-01-15-XXXXXXXX",
  "userId": "user123",
  "password": "hashed_password_sha256"
}
```

**응답 (성공):**
```json
{
  "valid": true,
  "type": "temporary",
  "expiresAt": "2025-02-15T00:00:00Z"
}
```

**응답 (실패):**
```json
{
  "valid": false,
  "message": "유효하지 않은 라이선스 코드입니다."
}
```

## 환경 변수 설정

클라이언트 앱에서 다음 환경 변수를 설정해야 합니다:

```env
LICENSE_SERVER_URL=https://your-license-server.com
# 또는
LICENSE_REDEEM_URL=https://your-license-server.com/redeem
```

## 성능 고려사항

1. **캐싱**: 서버 시간은 5분간 캐시되므로, 1분마다 체크해도 서버에 부하가 거의 없습니다.
2. **타임아웃**: 3초 타임아웃으로 빠르게 실패하여 앱 사용에 영향 없음
3. **비동기**: 모든 체크는 비동기로 실행되어 UI 블로킹 없음
4. **폴백**: 서버 시간을 가져올 수 없으면 로컬 시간 사용 (기능 유지)

## 보안 고려사항

1. **CORS**: 서버에서 적절한 CORS 헤더 설정
2. **Rate Limiting**: 서버 시간 API에 Rate Limiting 적용 (선택사항)
3. **HTTPS**: 프로덕션 환경에서는 HTTPS 사용 권장

## 테스트

서버 시간 API가 제대로 작동하는지 테스트:

```bash
curl https://your-license-server.com/time
```

응답 예시:
```json
{
  "timestamp": 1704067200000
}
```

