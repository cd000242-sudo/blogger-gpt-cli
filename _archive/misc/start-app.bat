@echo off
echo ========================================
echo Blogger GPT CLI - 직접 실행
echo ========================================
echo.
echo PowerShell 오류를 우회하여 직접 실행합니다...
echo.

cd /d "%~dp0"

echo 현재 디렉토리: %CD%
echo.

echo Node.js 버전 확인:
node --version
echo.

echo CLI 앱 실행:
node dist/cli.js --skipLicense --help

echo.
echo 앱이 종료되었습니다.
pause

