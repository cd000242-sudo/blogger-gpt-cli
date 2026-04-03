# PowerShell 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 한글 사용자명 문제 해결을 위한 환경 변수 설정
$env:LANG = 'ko_KR.UTF-8'
$env:LC_ALL = 'ko_KR.UTF-8'

Write-Host 'PowerShell 인코딩 설정이 완료되었습니다.' -ForegroundColor Green



