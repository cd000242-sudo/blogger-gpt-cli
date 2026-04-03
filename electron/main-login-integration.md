# 하이브리드 로그인 시스템 통합 가이드

## 구현 완료 사항

### 1. 자동 로그인 관리자 (`src/utils/auto-login-manager.ts`)
- ✅ 저장된 인증 정보 확인
- ✅ 기간제 만료 시 자동 로그인 차단
- ✅ 자동 로그인 설정 저장/로드

### 2. 로그인 창 UI (`electron/ui/login-window.html`)
- ✅ ID/비밀번호/코드 입력
- ✅ 자동 로그인 체크박스
- ✅ 에러/성공 메시지 표시
- ✅ 자동 로그인 확인 로직

### 3. 하이브리드 로그인 시스템 (`electron/main-login.ts`)
- ✅ 자동 로그인 시도
- ✅ 실패 시 로그인 창 표시
- ✅ IPC 핸들러 등록

## 통합 방법

### `electron/electron/main.js` 수정 필요

`app.whenReady()` 내부의 `checkLicenseNew()` 호출을 `checkLicenseWithAutoLogin()`로 변경:

```javascript
// 기존 코드 (라인 877)
if (!(await checkLicenseNew())) {
    console.log('[BLOGGER] 라이선스 인증 실패, 앱 종료');
    return;
}

// 변경 후
const { checkLicenseWithAutoLogin, setupAutoLoginHandlers, setMainWindow } = require('./main-login');
setupAutoLoginHandlers(); // IPC 핸들러 등록

if (!(await checkLicenseWithAutoLogin())) {
    console.log('[BLOGGER] 라이선스 인증 실패, 앱 종료');
    electron_1.app.quit();
    return;
}
```

그리고 `createWindow()` 함수에서 메인 윈도우 참조 설정:

```javascript
function createWindow() {
    // ... 기존 코드 ...
    mainWin = new BrowserWindow({...});
    
    // 메인 윈도우 참조 설정
    setMainWindow(mainWin);
    
    // ... 나머지 코드 ...
}
```

## 인증 정보 저장 위치

인증 정보는 다음 위치에 저장됩니다:
- **라이선스 파일**: `{userData}/license.json`
- **패치 파일** (영구제): `{userData}/license.patch`
- **자동 로그인 설정**: `{userData}/auto-login.json`

`userData` 경로는 Electron의 `app.getPath('userData')`로 결정되며, 일반적으로:
- Windows: `%APPDATA%/blogger-gpt-cli`
- macOS: `~/Library/Application Support/blogger-gpt-cli`
- Linux: `~/.config/blogger-gpt-cli`

## 앱 업데이트 후 인증 유지

✅ **인증 정보는 앱 업데이트 후에도 유지됩니다!**

이유:
1. 인증 정보는 `userData` 폴더에 저장됨
2. `userData` 폴더는 앱 업데이트 시 삭제되지 않음
3. 앱 버전이 바뀌어도 같은 `userData` 경로를 사용

## 기간제 만료 시 동작

1. **자동 로그인 시도**: 만료된 기간제 라이선스 감지
2. **자동 로그인 차단**: `tryAutoLogin()`에서 `shouldShowLoginWindow: true` 반환
3. **로그인 창 표시**: 사용자에게 코드 재등록 요청
4. **코드 재등록**: 새 코드 입력 후 자동 로그인 설정 가능

## 사용자 플로우

### 첫 실행
1. 앱 시작 → 자동 로그인 시도 (실패)
2. 로그인 창 표시
3. ID/비밀번호/코드 입력
4. "자동 로그인" 체크 → 저장
5. 메인 윈도우 표시

### 이후 실행 (기간 남음)
1. 앱 시작 → 자동 로그인 시도 (성공)
2. 메인 윈도우 바로 표시

### 기간 만료 후
1. 앱 시작 → 자동 로그인 시도 (만료 감지)
2. 로그인 창 표시
3. 새 코드 입력
4. 자동 로그인 설정 유지
5. 메인 윈도우 표시






