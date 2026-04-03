# 빌드 및 배포 가이드

## 🚀 빠른 시작

### Windows용 빌드
```bash
npm run dist:win
```

### macOS용 빌드 (macOS에서만 가능)
```bash
npm run dist:mac
```

### Linux용 빌드
```bash
npm run dist:linux
```

### 모든 플랫폼 빌드
```bash
npm run dist:all
```

## 📦 빌드 결과물

빌드된 파일은 `release/` 폴더에 생성됩니다:

- **Windows**: `LEADERNAM Orbit-2.0.0-x64.exe` (설치 파일)
- **macOS**: `LEADERNAM Orbit-2.0.0-x64.dmg` 또는 `.app`
- **Linux**: `LEADERNAM Orbit-2.0.0-x64.AppImage`

## 🍎 macOS 빌드 주의사항

### 중요: macOS 빌드는 macOS에서만 가능합니다

- Windows나 Linux에서는 macOS 빌드 불가
- macOS 빌드를 위해서는 macOS 환경이 필요합니다
- 대안: GitHub Actions 등 CI/CD를 사용하여 macOS에서 자동 빌드

### macOS 빌드 방법

1. **macOS 환경에서 실행**
2. **Xcode Command Line Tools 설치**
   ```bash
   xcode-select --install
   ```
3. **빌드 실행**
   ```bash
   npm install
   npm run dist:mac
   ```

## 📋 빌드 스크립트 설명

- `npm run dist` - 현재 플랫폼용 빌드
- `npm run dist:win` - Windows용 빌드
- `npm run dist:mac` - macOS용 빌드 (macOS에서만 가능)
- `npm run dist:linux` - Linux용 빌드
- `npm run dist:all` - 모든 플랫폼 빌드
- `npm run pack` - 패키징만 (설치 파일 생성 안 함)

## 🔧 설정 파일

- `electron-builder.yml` - electron-builder 설정 파일
- `package.json`의 `build` 섹션 - 빌드 설정
- `build/entitlements.mac.plist` - macOS 권한 설정

## 📚 상세 가이드

- [BUILD_GUIDE.md](./BUILD_GUIDE.md) - 전체 빌드 가이드
- [MAC_BUILD_INSTRUCTIONS.md](./MAC_BUILD_INSTRUCTIONS.md) - macOS 빌드 상세 가이드

## 🐛 문제 해결

빌드 중 문제가 발생하면:
1. `npm install` 재실행
2. `npm run build` 확인
3. Node.js 버전 확인 (v18 이상 권장)
4. 플랫폼별 필수 도구 설치 확인




