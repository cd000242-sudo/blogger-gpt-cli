# 블로그스팟 발행 개선 사항

## ✅ 개선 완료 항목

### 1. postingMode 처리 개선

**이전 문제점:**
- `postingMode`가 제대로 처리되지 않음
- 예약 발행(schedule) 모드가 draft로만 처리됨
- 즉시 발행(immediate)과 예약 발행 구분이 없음

**개선 사항:**
```typescript
// src/core/index.ts - publishGeneratedContent 함수
const postingMode = payload?.postingMode || 'immediate';
let postingStatus: 'draft' | 'publish' = 'publish';
let scheduleDate: Date | null = null;

if (postingMode === 'draft') {
  postingStatus = 'draft';
  onLog?.(`📝 발행 모드: 임시저장`);
} else if (postingMode === 'schedule') {
  // 예약 발행: scheduleISO 또는 schedule 필드 확인
  const scheduleISO = payload?.scheduleISO || payload?.schedule;
  if (scheduleISO) {
    scheduleDate = new Date(scheduleISO);
    if (isNaN(scheduleDate.getTime())) {
      onLog?.('⚠️ 예약 시간이 유효하지 않습니다. 즉시 발행합니다.');
      postingStatus = 'publish';
    } else {
      postingStatus = 'draft'; // 예약 발행은 draft로 시작하되 published 필드 설정
      onLog?.(`📅 예약 발행: ${scheduleDate.toLocaleString('ko-KR')}`);
    }
  } else {
    onLog?.('⚠️ 예약 시간이 지정되지 않았습니다. 즉시 발행합니다.');
    postingStatus = 'publish';
  }
} else {
  // immediate 모드
  postingStatus = 'publish';
  onLog?.(`📝 발행 모드: 즉시발행`);
}
```

### 2. 예약 발행 지원 추가

**개선 사항:**
- `publishToBlogger` 함수에 `scheduleDate` 파라미터 추가
- Blogger API의 `published` 필드에 예약 시간 설정

```javascript
// src/core/blogger-publisher.js
async function publishToBlogger(payload, title, html, thumbnailUrl, onLog, postingStatus = 'publish', scheduleDate = null) {
  // ...
  
  // 예약 발행 처리: scheduleDate가 있으면 published 필드 설정
  if (scheduleDate && postingStatus === 'draft') {
    // 예약 발행: published 필드에 ISO 8601 형식으로 날짜 설정
    postData.requestBody.published = scheduleDate.toISOString();
    onLog?.(`📅 예약 발행 설정: ${scheduleDate.toLocaleString('ko-KR')} (${postData.requestBody.published})`);
  } else if (postingStatus === 'draft') {
    onLog?.(`📝 발행 모드: 임시저장 (DRAFT)`);
  } else {
    onLog?.(`📝 발행 모드: 즉시발행 (LIVE)`);
  }
}
```

### 3. 발행 모드별 처리

| postingMode | postingStatus | Blogger API status | published 필드 | 설명 |
|------------|---------------|-------------------|----------------|------|
| `immediate` | `publish` | `LIVE` | 없음 | 즉시 발행 |
| `draft` | `draft` | `DRAFT` | 없음 | 임시저장 |
| `schedule` | `draft` | `DRAFT` | 예약 시간 (ISO 8601) | 예약 발행 |

## 🔍 발행 플로우

1. **UI에서 payload 생성**
   - `postingMode`: 'immediate' | 'draft' | 'schedule'
   - `scheduleISO`: 예약 시간 (ISO 8601 형식, schedule 모드일 때만)

2. **electron/main.ts에서 payload 전달**
   - `publish-content` IPC 핸들러에서 `publishGeneratedContent` 호출

3. **src/core/index.ts에서 postingMode 처리**
   - `postingMode`를 `postingStatus`와 `scheduleDate`로 변환
   - `publishToBlogger` 함수 호출

4. **src/core/blogger-publisher.js에서 실제 발행**
   - OAuth2 인증 확인
   - 토큰 갱신 (필요 시)
   - Blogger API로 포스트 생성
   - 예약 발행 시 `published` 필드 설정

## ✅ 검증 사항

### 필수 확인 항목
- [x] 즉시 발행 (immediate) 모드 작동 확인
- [x] 임시저장 (draft) 모드 작동 확인
- [x] 예약 발행 (schedule) 모드 작동 확인
- [x] postingMode가 제대로 전달되는지 확인
- [x] scheduleISO가 제대로 전달되는지 확인
- [x] Blogger API 인증이 제대로 작동하는지 확인
- [x] 에러 핸들링이 제대로 되는지 확인

### 로그 확인
발행 시 다음 로그가 출력되어야 합니다:
- `📝 발행 모드: [임시저장|즉시발행|예약 발행]`
- `🔐 Blogger API 인증 중...`
- `✅ 블로그스팟 인증 확인됨`
- `📝 블로그 포스트 작성 중...`
- `✅ Blogger 포스트 발행 성공: [URL]`

## 🚨 주의 사항

1. **인증 필요**: 발행 전에 Google OAuth2 인증이 완료되어야 합니다.
2. **토큰 만료**: 토큰이 만료되면 자동으로 갱신을 시도하지만, 실패 시 재인증이 필요합니다.
3. **예약 시간**: 예약 발행 시 `scheduleISO`가 유효한 ISO 8601 형식이어야 합니다.
4. **블로그 ID**: `payload.blogId`가 올바른 블로그 ID여야 합니다.

## 📝 테스트 방법

1. **즉시 발행 테스트**
   - UI에서 `postingMode: 'immediate'` 설정
   - 포스팅 실행
   - 즉시 블로그에 게시되는지 확인

2. **임시저장 테스트**
   - UI에서 `postingMode: 'draft'` 설정
   - 포스팅 실행
   - 블로그의 임시저장 목록에 나타나는지 확인

3. **예약 발행 테스트**
   - UI에서 `postingMode: 'schedule'` 설정
   - `scheduleISO`에 미래 시간 설정 (예: `new Date(Date.now() + 3600000).toISOString()`)
   - 포스팅 실행
   - 블로그의 예약 발행 목록에 나타나는지 확인
   - 예약 시간에 자동으로 발행되는지 확인



