# 빌드 가이드 (Build Guide)

## 📦 배포용 패키지 생성

### 전체 플랫폼 빌드
```bash
npm run dist:all
```
Windows, macOS, Linux 모두 빌드합니다.

### 플랫폼별 빌드

#### Windows만 빌드
```bash
npm run dist:win
```

#### macOS만 빌드
```bash
npm run dist:mac
```

#### Linux만 빌드
```bash
npm run dist:linux
```

### 패키징만 (설치 파일 생성 안 함)
```bash
npm run pack
```

## 🍎 macOS 빌드 주의사항

### 1. macOS에서 빌드하는 경우
- macOS에서 직접 빌드하면 가장 깔끔하게 빌드됩니다.
- Intel Mac (x64)와 Apple Silicon (arm64) 모두 지원됩니다.

### 2. Windows/Linux에서 macOS 빌드하는 경우
- **Cross-compilation은 지원되지 않습니다.**
- macOS 빌드를 위해서는 macOS 환경이 필요합니다.
- 대안: GitHub Actions, CircleCI 등 CI/CD를 사용하여 macOS에서 빌드

### 3. 코드 서명 (선택사항)
- App Store 배포나 Gatekeeper 경고 제거를 위해 코드 서명이 필요합니다.
- Apple Developer 계정이 필요합니다.
- `electron-builder.yml`에서 `identity` 설정을 추가하세요.

## 📁 빌드 결과물

빌드된 파일은 `release/` 폴더에 생성됩니다:

- **Windows**: `LEADERNAM Orbit-2.0.0-x64.exe` (설치 파일)
- **macOS**: `LEADERNAM Orbit-2.0.0-x64.dmg` 또는 `.app`
- **Linux**: `LEADERNAM Orbit-2.0.0-x64.AppImage`

## 🔧 필수 아이콘 파일

다음 아이콘 파일들이 필요합니다 (선택사항):
- `build/icon.ico` - Windows 아이콘
- `build/icon.icns` - macOS 아이콘
- `build/icon.png` - Linux 아이콘

아이콘이 없어도 빌드는 가능하지만, 기본 Electron 아이콘이 사용됩니다.

## 🚀 CI/CD를 통한 자동 빌드

### GitHub Actions 예시

`.github/workflows/build.yml` 파일 생성:

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Build app
        run: |
          if [ "${{ matrix.os }}" == "windows-latest" ]; then
            npm run dist:win
          elif [ "${{ matrix.os }}" == "macos-latest" ]; then
            npm run dist:mac
          else
            npm run dist:linux
          fi
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: release/
```

## 📝 빌드 전 체크리스트

- [ ] `package.json`의 버전 번호 확인
- [ ] 모든 의존성 설치 (`npm install`)
- [ ] TypeScript 컴파일 확인 (`npm run build`)
- [ ] 테스트 실행 (선택사항)
- [ ] 아이콘 파일 준비 (선택사항)

## 🐛 문제 해결

### macOS 빌드 오류
- macOS에서만 빌드 가능합니다.
- Xcode Command Line Tools 설치 필요: `xcode-select --install`

### Windows 빌드 오류
- Visual Studio Build Tools 필요할 수 있습니다.

### Linux 빌드 오류
- `fuse` 패키지 필요 (AppImage용): `sudo apt-get install fuse`

## 📚 참고 자료

- [electron-builder 공식 문서](https://www.electron.build/)
- [Electron 공식 문서](https://www.electronjs.org/)




