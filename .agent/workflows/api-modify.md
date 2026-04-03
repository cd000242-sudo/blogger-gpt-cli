---
description: 연동 수정 작업 (API, MCP, 외부 서비스 연동)
---

// turbo-all

## 연동 수정 워크플로우

API 연동, 외부 서비스 연결, IPC 브릿지 수정 등을 자동으로 처리합니다.

### 사전 작업
1. 수정 전 관련 파일 백업 (자동)

### 주요 수정 대상
- `src/ui/preload.ts` - IPC 브릿지
- `src/main.ts` - 메인 프로세스 핸들러
- `src/configManager.ts` - 설정 관리
- `src/image/*.ts` - 이미지 API 연동
- `src/core/*.ts` - 핵심 기능 연동

### 작업 순서
2. 사용자 요청에 따라 연동 코드 수정

3. TypeScript 타입 체크
   ```
   npx tsc --noEmit
   ```

4. 빌드
   ```
   npm run build
   ```

5. 테스트 (있는 경우)
   ```
   npm run test
   ```

### 완료 조건
- TypeScript 에러 없음
- 빌드 성공
- API 호출 테스트 통과 (해당 시)
