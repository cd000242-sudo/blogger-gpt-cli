# 중복 로그인 방지 시스템

## 📋 개요

하나의 계정으로 동시에 여러 기기에서 로그인하는 것을 방지하는 시스템입니다.
새 기기에서 로그인하면 기존 세션이 자동으로 종료됩니다.

## 🔧 구현 구조

### 1. 서버측 (license-server-example.js)

```
POST /redeem          - 라이선스 등록 및 로그인 (세션 토큰 발급)
POST /session/validate - 세션 유효성 검증
POST /session/logout   - 로그아웃 (세션 종료)
GET  /session/active   - 활성 세션 조회 (관리자용)
```

**주요 로직:**
- 로그인 시 새 세션 토큰 생성
- 동일 userId로 다른 deviceId에서 로그인 시 기존 세션 무효화
- 세션 토큰 불일치 시 `SESSION_EXPIRED_BY_OTHER_LOGIN` 코드 반환

### 2. 클라이언트측

#### session-manager.ts
- 세션 토큰 저장/로드 (`userData/session.json`)
- 서버와 세션 유효성 검증
- 주기적 세션 체크 (5분 간격)
- 오프라인 grace period (30분)

#### license-manager-new.ts
- 로그인 시 세션 토큰 저장
- 로그아웃 시 서버에 세션 종료 요청
- 세션 검증 API 통합

#### preload.ts / main.ts
- `session-validate` - 세션 유효성 검증
- `session-start-validation` - 주기적 검증 시작
- `session-stop-validation` - 주기적 검증 중지
- `session-expired` 이벤트 - 세션 만료 알림

### 3. UI

#### login-window.html
- 로그인 성공 시 `previousSessionTerminated` 알림 표시
- 주기적 세션 검증 자동 시작

#### main.js
- `showSessionExpiredModal()` - 세션 만료 모달
- 다른 기기 로그인 감지 시 사용자에게 알림

## 📡 API 응답 형식

### 로그인 성공 응답
```json
{
  "ok": true,
  "valid": true,
  "sessionToken": "abc123...",
  "previousSessionTerminated": false,
  "type": "temporary",
  "expiresAt": "2025-01-17T00:00:00Z"
}
```

### 세션 검증 응답 (유효)
```json
{
  "valid": true,
  "code": "SESSION_VALID",
  "message": "세션이 유효합니다.",
  "loginAt": 1702800000000
}
```

### 세션 검증 응답 (다른 기기 로그인으로 만료)
```json
{
  "valid": false,
  "code": "SESSION_EXPIRED_BY_OTHER_LOGIN",
  "message": "다른 기기에서 로그인되어 현재 세션이 종료되었습니다."
}
```

## 🔄 동작 흐름

### 1. 로그인 흐름
```
사용자 A (기기 1) 로그인
    ↓
서버: 세션 토큰 발급 (token_A)
    ↓
클라이언트: 세션 저장, 주기적 검증 시작
```

### 2. 중복 로그인 감지 흐름
```
사용자 A (기기 2) 로그인
    ↓
서버: 기존 세션(token_A) 무효화, 새 토큰(token_B) 발급
    ↓
응답: previousSessionTerminated = true
    ↓
기기 1: 다음 세션 검증 시 SESSION_EXPIRED_BY_OTHER_LOGIN 수신
    ↓
기기 1: 세션 만료 모달 표시, 강제 로그아웃
```

## ⚙️ 설정

### 환경 변수
```env
LICENSE_SERVER_URL=https://your-server.com
# 또는
LICENSE_REDEEM_URL=https://your-server.com/redeem
```

### 세션 검증 주기
- 기본: 5분 (`VALIDATION_INTERVAL_MS`)
- 오프라인 허용 시간: 30분 (`OFFLINE_GRACE_PERIOD_MS`)

## 🧪 테스트

### 1. 서버 시작
```bash
node license-server-example.js
```

### 2. 첫 번째 기기 로그인
```bash
curl -X POST http://localhost:3000/redeem \
  -H "Content-Type: application/json" \
  -d '{"code":"TEMP-2025","userId":"user1","password":"pass","deviceId":"device1"}'
```

### 3. 두 번째 기기 로그인 (기존 세션 종료됨)
```bash
curl -X POST http://localhost:3000/redeem \
  -H "Content-Type: application/json" \
  -d '{"code":"TEMP-2025","userId":"user1","password":"pass","deviceId":"device2"}'
```

### 4. 첫 번째 기기 세션 검증 (실패)
```bash
curl -X POST http://localhost:3000/session/validate \
  -H "Content-Type: application/json" \
  -d '{"userId":"user1","sessionToken":"OLD_TOKEN"}'
```

## 📁 관련 파일

| 파일 | 설명 |
|------|------|
| `license-server-example.js` | 서버측 세션 관리 API |
| `src/utils/session-manager.ts` | 클라이언트 세션 관리자 |
| `src/utils/license-manager-new.ts` | 라이선스 + 세션 통합 |
| `electron/main.ts` | IPC 핸들러 |
| `electron/preload.ts` | API 노출 |
| `electron/ui/modules/main.js` | 세션 만료 모달 |
| `electron/ui/login-window.html` | 로그인 UI |

## ⚠️ 주의사항

1. **서버 필수**: 중복 로그인 방지는 서버와 통신이 필요합니다. 서버 미설정 시 오프라인 모드로 동작합니다.

2. **오프라인 허용**: 네트워크 불안정 시 30분간 기존 세션 유지됩니다.

3. **세션 저장 위치**: `{userData}/session.json`에 저장됩니다.

4. **실제 서버 구현 시**: 
   - Redis/DB로 세션 저장소 교체 권장
   - 관리자 API 인증 추가 필요
   - HTTPS 사용 권장
