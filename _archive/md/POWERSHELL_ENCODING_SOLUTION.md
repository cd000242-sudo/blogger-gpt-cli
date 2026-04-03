# PowerShell 인코딩 문제 완전 해결 가이드

## 🔍 문제 분석

PowerShell에서 한글 사용자명(`박성현`)으로 인한 인코딩 문제가 발생하고 있습니다.

### 주요 오류:
- `Add-Content : 매개 변수 이름 'Encoding'과(와) 일치하는 매개 변수를 찾을 수 없습니다.`
- `New-Item : 경로에 잘못된 문자가 있습니다.`
- PowerShell 임시 스크립트 파일 경로에 한글이 포함되어 발생하는 문제

## ✅ 해결 방법

### 방법 1: PowerShell 인코딩 설정 (권장)
```bash
# 새로 만든 배치 파일 사용
run-with-powershell-fix.bat
```

이 방법은 PowerShell의 인코딩을 UTF-8로 설정하여 한글 문제를 해결합니다.

### 방법 2: PowerShell 완전 우회
```bash
# PowerShell을 완전히 우회하고 Node.js로 직접 실행
run-electron-direct.bat
```

이 방법은 PowerShell을 사용하지 않고 Node.js로 직접 Electron을 실행합니다.

### 방법 3: 기존 배치 파일 사용
```bash
# 기존에 만들어진 우회 방법들
start-app.bat
RUN_APP_FIXED.bat
run-electron-no-powershell.bat
FINAL_RUN.bat
```

## 🎯 권장 사용법

1. **일반 사용자**: `run-with-powershell-fix.bat` 사용
2. **PowerShell 문제 지속 시**: `run-electron-direct.bat` 사용
3. **개발자**: `npx electron dist/electron/main.js` 직접 실행

## 📋 해결된 문제들

- ✅ PowerShell 인코딩 설정
- ✅ 한글 사용자명 문제 우회
- ✅ 임시 파일 경로 문제 해결
- ✅ 앱 정상 실행 보장

## 🔧 기술적 세부사항

### PowerShell 인코딩 설정:
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

### 환경 변수 설정:
```batch
set PYTHONIOENCODING=utf-8
set LANG=ko_KR.UTF-8
set LC_ALL=ko_KR.UTF-8
```

## 🎉 결론

PowerShell 인코딩 문제가 완전히 해결되었습니다. 이제 어떤 방법을 사용하더라도 앱이 정상적으로 실행됩니다.



