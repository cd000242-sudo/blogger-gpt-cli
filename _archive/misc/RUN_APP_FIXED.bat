@echo off
echo ========================================
echo Blogger GPT CLI - PowerShell 오류 해결
echo ========================================
echo.
echo 한국어 사용자명으로 인한 PowerShell 오류를 우회합니다.
echo.

cd /d "%~dp0"

echo 앱 실행 중...
cmd /c "npx electron dist/electron/main.js"

echo.
echo 앱이 종료되었습니다.
pause
