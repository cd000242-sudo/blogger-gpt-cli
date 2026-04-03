---
description: 빌드 및 배포 (빌드 → 테스트 → 릴리즈)
---

// turbo-all

## 빌드 및 배포 워크플로우

프로젝트를 빌드하고 배포 준비를 합니다.

### 작업 순서
1. 클린 빌드
   ```
   npm run build
   ```

2. 앱 실행 테스트
   ```
   npm run start
   ```

3. 배포용 패키지 생성 (필요시)
   ```
   npm run make
   ```

4. GitHub 릴리즈 (필요시)
   ```
   npm run release
   ```

### 완료 조건
- 빌드 성공
- 앱 정상 실행
- 배포 패키지 생성 완료
