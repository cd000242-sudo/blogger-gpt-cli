---
description: UI 수정 작업 (승인 없이 자동 완료)
---

// turbo-all

## UI 수정 워크플로우

이 워크플로우는 UI 수정 작업을 승인 없이 자동으로 완료합니다.

### 사전 작업
1. 수정 전 해당 파일 백업 생성 (자동)

### 작업 순서
2. 사용자 요청에 따라 UI 파일 수정
   - `src/ui/script.js`
   - `electron/ui/index.html`
   - `src/ui/styles.css` (있는 경우)

3. TypeScript 컴파일 및 빌드
   ```
   npm run build
   ```

4. 빌드 성공 확인

5. 앱 실행하여 변경사항 확인 (선택)
   ```
   npm run start
   ```

### 완료 조건
- 빌드 성공 (Exit Code: 0)
- 린트 에러 없음
