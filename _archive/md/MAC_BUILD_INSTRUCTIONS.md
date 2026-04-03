# macOS 빌드 가이드

## 🍎 Mac 사용자를 위한 배포 패키지 생성

### 필수 요구사항

1. **macOS 환경 필요**
   - macOS 빌드는 macOS에서만 가능합니다 (Cross-compilation 미지원)
   - Windows/Linux에서는 macOS 빌드 불가

2. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

3. **Node.js 및 npm**
   ```bash
   node --version  # v18 이상 권장
   npm --version
   ```

## 📦 빌드 방법

### 1. macOS에서 직접 빌드

```bash
# 의존성 설치
npm install

# TypeScript 컴파일 및 빌드
npm run build

# macOS용 패키지 생성
npm run dist:mac
```

### 2. 빌드 결과물

빌드 완료 후 `release/` 폴더에 다음 파일이 생성됩니다:

- **Intel Mac (x64)**: `LEADERNAM Orbit-2.0.0-x64.dmg`
- **Apple Silicon (arm64)**: `LEADERNAM Orbit-2.0.0-arm64.dmg`
- **Universal Binary**: 두 아키텍처 모두 지원하는 `.app` 파일

### 3. 배포 방법

#### DMG 파일 배포
- DMG 파일을 다운로드 링크로 제공
- 사용자가 DMG를 마운트하고 앱을 Applications 폴더로 드래그

#### ZIP 파일 배포 (선택사항)
```bash
# .app 파일을 ZIP으로 압축
cd release
zip -r LEADERNAM-Orbit-macOS.zip "LEADERNAM Orbit.app"
```

## 🔐 코드 서명 (선택사항)

Gatekeeper 경고를 제거하려면 코드 서명이 필요합니다.

### 1. Apple Developer 계정 필요
- [Apple Developer Program](https://developer.apple.com/programs/) 가입
- 연간 $99

### 2. 인증서 발급
```bash
# Xcode에서 자동으로 처리하거나
# 또는 수동으로 인증서 생성
```

### 3. electron-builder.yml 설정
```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAM_ID)"
```

### 4. 코드 서명 후 빌드
```bash
npm run dist:mac
```

## 🚀 CI/CD를 통한 자동 빌드

### GitHub Actions 사용

`.github/workflows/build-mac.yml` 파일 생성:

```yaml
name: Build macOS

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-mac:
    runs-on: macos-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Build macOS app
        run: npm run dist:mac
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: macos-build
          path: release/
```

## 📝 빌드 전 체크리스트

- [ ] `package.json`의 버전 번호 확인
- [ ] 모든 의존성 설치 (`npm install`)
- [ ] TypeScript 컴파일 확인 (`npm run build`)
- [ ] macOS에서 테스트 실행 (`npm start`)
- [ ] 아이콘 파일 준비 (선택사항)

## 🐛 문제 해결

### "Gatekeeper가 앱을 차단했습니다"
- 코드 서명이 필요합니다
- 또는 사용자가 "시스템 환경설정 > 보안 및 개인 정보 보호"에서 허용

### "앱이 손상되어 열 수 없습니다"
- 코드 서명 문제일 수 있습니다
- `hardenedRuntime: true` 설정 확인

### 빌드 실패
- Xcode Command Line Tools 설치 확인
- Node.js 버전 확인 (v18 이상 권장)
- `npm install` 재실행

## 📚 참고 자료

- [electron-builder macOS 문서](https://www.electron.build/configuration/mac)
- [Apple 코드 서명 가이드](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)




