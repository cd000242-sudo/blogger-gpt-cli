# .env 파일에 Blogger 환경 변수 추가 스크립트

$envFile = ".env"

# .env 파일이 없으면 생성
if (-not (Test-Path $envFile)) {
    New-Item -ItemType File -Path $envFile | Out-Null
    Write-Host "✅ .env 파일을 생성했습니다." -ForegroundColor Green
}

# 현재 .env 파일 내용 읽기
$currentContent = Get-Content $envFile -ErrorAction SilentlyContinue

# 필요한 환경 변수 확인
$needsBlogId = -not ($currentContent | Select-String -Pattern "^BLOG_ID=")
$needsClientId = -not ($currentContent | Select-String -Pattern "^GOOGLE_CLIENT_ID=")
$needsClientSecret = -not ($currentContent | Select-String -Pattern "^GOOGLE_CLIENT_SECRET=")

if ($needsBlogId -or $needsClientId -or $needsClientSecret) {
    Write-Host "`n📝 .env 파일에 다음 환경 변수를 추가해야 합니다:`n" -ForegroundColor Cyan
    
    # 사용자 입력 받기
    if ($needsBlogId) {
        $blogId = Read-Host "BLOG_ID를 입력하세요 (예: 1234567890123456789)"
        Add-Content -Path $envFile -Value "`n# Blogger Blog ID"
        Add-Content -Path $envFile -Value "BLOG_ID=$blogId"
        Write-Host "✅ BLOG_ID가 추가되었습니다." -ForegroundColor Green
    }
    
    if ($needsClientId) {
        $clientId = Read-Host "GOOGLE_CLIENT_ID를 입력하세요 (예: 123456789-xxx.apps.googleusercontent.com)"
        Add-Content -Path $envFile -Value "`n# Google OAuth2 Client ID"
        Add-Content -Path $envFile -Value "GOOGLE_CLIENT_ID=$clientId"
        Write-Host "✅ GOOGLE_CLIENT_ID가 추가되었습니다." -ForegroundColor Green
    }
    
    if ($needsClientSecret) {
        $clientSecret = Read-Host "GOOGLE_CLIENT_SECRET을 입력하세요 (예: GOCSPX-xxx)"
        Add-Content -Path $envFile -Value "`n# Google OAuth2 Client Secret"
        Add-Content -Path $envFile -Value "GOOGLE_CLIENT_SECRET=$clientSecret"
        Write-Host "✅ GOOGLE_CLIENT_SECRET이 추가되었습니다." -ForegroundColor Green
    }
    
    Write-Host "`n✅ 환경 변수 설정이 완료되었습니다!`n" -ForegroundColor Green
    Write-Host "다음 명령어로 테스트 스크립트를 실행하세요:" -ForegroundColor Yellow
    Write-Host "  npx ts-node test-publish-layout.ts`n" -ForegroundColor Cyan
} else {
    Write-Host "✅ 모든 필수 환경 변수가 이미 설정되어 있습니다!`n" -ForegroundColor Green
    Write-Host "다음 명령어로 테스트 스크립트를 실행하세요:" -ForegroundColor Yellow
    Write-Host "  npx ts-node test-publish-layout.ts`n" -ForegroundColor Cyan
}








