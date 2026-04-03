# 포스팅 실행 체크리스트

## 🚀 실행 전 필수 확인 사항

### 1. 라이선스 확인
- [ ] 라이선스가 유효한지 확인
- [ ] 라이선스 모달에서 상태 확인 (초록색 "유효" 표시)

### 2. 키워드 입력 확인
- [ ] `keywordInput` 필드에 키워드 입력
- [ ] 또는 `topicInput` 필드에 주제 입력
- [ ] 최소 1개 이상의 키워드 필요

### 3. 환경 변수 확인

#### Blogger 플랫폼 선택 시:
- [ ] `geminiKey` 입력됨
- [ ] `blogId` 입력됨
- [ ] `googleClientId` 입력됨
- [ ] `googleClientSecret` 입력됨

#### WordPress 플랫폼 선택 시:
- [ ] `geminiKey` 입력됨
- [ ] `wordpressSiteUrl` 입력됨
- [ ] `wordpressUsername` 입력됨
- [ ] `wordpressPassword` 입력됨

### 4. 백엔드 연결 확인
- [ ] `window.blogger.runPost` 함수 존재 확인
- [ ] Electron IPC 통신 정상 작동 확인

### 5. 플랫폼 선택 확인
- [ ] Blogger 또는 WordPress 선택됨
- [ ] 선택한 플랫폼에 맞는 인증 정보 입력됨

---

## 📋 실행 단계별 확인

### Step 1: 함수 호출
```
✅ runPosting() 함수 시작
✅ 버튼 활성화 보장
✅ 진행률 초기화
```

### Step 2: 검증 단계
```
✅ 라이선스 유효성 확인
✅ 취소 상태 초기화
✅ 키워드 입력 확인
✅ 중복 실행 방지 체크
```

### Step 3: UI 준비
```
✅ 진행 모달 표시
✅ 중지 버튼 활성화
```

### Step 4: 데이터 준비
```
✅ 키워드 데이터 생성
✅ createPreviewPayload() 호출
✅ 환경 변수 수집
✅ 환경 변수 검증
```

### Step 5: 백엔드 호출
```
✅ setRunning(true) 호출
✅ 진행률 초기화
✅ window.blogger.runPost(payload) 호출
```

### Step 6: 결과 처리
```
✅ 성공: 콘텐츠 저장, 미리보기 업데이트, 상태 초기화
✅ 실패: 에러 로깅, 사용자 알림, 상태 초기화
```

---

## 🔍 실행 시 모니터링 포인트

### 콘솔 로그 확인
다음 로그들이 순서대로 나타나야 합니다:

1. `🔄 [BUTTON] runPosting 시작 - 버튼 활성화 보장`
2. `🔍 [POSTING] 라이선스 유효성 확인 중...`
3. `✅ [POSTING] 라이선스 유효성 확인 완료`
4. `🔍 [POSTING] 입력 필드 확인 중...`
5. `🔍 [POSTING] 미리보기와 동일한 페이로드 생성 시작`
6. `🔍 [POSTING] createPreviewPayload 함수 호출 중...`
7. `✅ [POSTING] 페이로드 생성 성공`
8. `🔍 [POSTING] 백엔드 연결 확인 중...`
9. `✅ [POSTING] 백엔드 연결 확인 완료`
10. `🔍 [POSTING] 백엔드에 데이터 전송 시작`
11. `✅ [POSTING] 백엔드 응답 수신`

### UI 상태 확인
- [ ] 진행 모달이 표시되는가?
- [ ] 중지 버튼이 활성화되는가?
- [ ] 진행률이 업데이트되는가?
- [ ] 로그가 실시간으로 표시되는가?

### 에러 발생 시 확인 사항
- [ ] 에러 메시지가 명확한가?
- [ ] 모달이 자동으로 숨겨지는가?
- [ ] 버튼 상태가 복원되는가?
- [ ] `isRunning` 상태가 `false`로 변경되는가?

---

## ⚠️ 예상되는 문제 및 해결 방법

### 문제 1: "라이선스 등록이 필요합니다"
**원인:** 라이선스가 유효하지 않음
**해결:** 라이선스 모달에서 라이선스 등록

### 문제 2: "최소 1개의 키워드를 입력해주세요"
**원인:** 키워드 입력 필드가 비어있음
**해결:** `keywordInput` 또는 `topicInput`에 키워드 입력

### 문제 3: "환경 변수 검증 실패"
**원인:** 필수 환경 변수가 누락됨
**해결:** 환경설정에서 필수 변수 입력

### 문제 4: "백엔드 연결 오류"
**원인:** `window.blogger.runPost` 함수가 없음
**해결:** 애플리케이션 재시작

### 문제 5: "포스팅 작업이 실행 중입니다"
**원인:** 이미 다른 포스팅이 실행 중
**해결:** 현재 작업 완료 대기 또는 취소 후 재시도

### 문제 6: "블로그스팟 인증이 필요합니다"
**원인:** Blogger OAuth2 인증이 완료되지 않음
**해결:** 환경설정에서 Blogger 인증 완료

---

## ✅ 성공 시 확인 사항

1. **콘텐츠 생성 확인**
   - [ ] `generatedContent` 객체에 제목과 내용이 저장되는가?
   - [ ] `localStorage`에 `lastGeneratedTitle`이 저장되는가?

2. **미리보기 업데이트 확인**
   - [ ] 미리보기 영역에 제목이 표시되는가?
   - [ ] 미리보기 영역에 내용이 표시되는가?

3. **작업 기록 확인**
   - [ ] 작업 기록에 포스트 작성 완료가 추가되는가?

4. **상태 초기화 확인**
   - [ ] `isRunning`이 `false`로 변경되는가?
   - [ ] 진행 모달이 3초 후 자동으로 숨겨지는가?
   - [ ] 버튼이 다시 활성화되는가?

---

## 🎯 실행 명령어

### 브라우저 콘솔에서 직접 실행
```javascript
// 직접 함수 호출
await runPosting();

// 또는 스마트 포스팅 (키워드 자동 감지)
await runSmartPosting();
```

### UI 버튼 클릭
- "포스팅 실행" 탭에서 실행 버튼 클릭
- 또는 키보드 단축키 (설정된 경우)

---

## 📊 실행 후 로그 분석

### 정상 실행 로그 예시
```
[HH:MM:SS] 🔍 [POSTING] runPosting 함수 시작
[HH:MM:SS] 🔄 [BUTTON] runPosting 시작 - 버튼 활성화 보장
[HH:MM:SS] 🔍 [POSTING] 라이선스 유효성 확인 중...
[HH:MM:SS] ✅ [POSTING] 라이선스 유효성 확인 완료
[HH:MM:SS] 🔍 [POSTING] 입력 필드 확인 중...
[HH:MM:SS] ✅ [POSTING] 사용자 입력 키워드 사용: "테스트 키워드"
[HH:MM:SS] 🔍 [POSTING] 미리보기와 동일한 페이로드 생성 시작
[HH:MM:SS] 🔍 [POSTING] createPreviewPayload 함수 호출 중...
[HH:MM:SS] ✅ [POSTING] 페이로드 생성 성공
[HH:MM:SS] 🔍 [POSTING] 백엔드 연결 확인 중...
[HH:MM:SS] ✅ [POSTING] 백엔드 연결 확인 완료
[HH:MM:SS] 🔍 [POSTING] 백엔드에 데이터 전송 시작
[HH:MM:SS] ✅ [POSTING] 백엔드 응답 수신
[HH:MM:SS] 🎮 🎉 완벽한 블로그 포스트가 완성되었어요!
```

### 에러 로그 예시
```
[HH:MM:SS] 🔍 [POSTING] runPosting 함수 시작
[HH:MM:SS] 🔍 [POSTING] 라이선스 유효성 확인 중...
[HH:MM:SS] ❌ [POSTING] 라이선스 무효 - 모달 표시
```

---

## 🔧 디버깅 팁

1. **브라우저 개발자 도구 열기**
   - F12 또는 Ctrl+Shift+I
   - Console 탭에서 로그 확인

2. **상태 변수 확인**
   ```javascript
   console.log('isRunning:', isRunning);
   console.log('isCanceled:', isCanceled);
   console.log('overallProgress:', overallProgress);
   ```

3. **페이로드 확인**
   ```javascript
   // createPreviewPayload() 결과 확인
   const payload = createPreviewPayload();
   console.log('Payload:', payload);
   ```

4. **백엔드 연결 확인**
   ```javascript
   console.log('window.blogger:', window.blogger);
   console.log('window.blogger.runPost:', window.blogger?.runPost);
   ```

---

## 📝 실행 후 체크리스트

- [ ] 모든 단계가 순서대로 실행되었는가?
- [ ] 에러 없이 완료되었는가?
- [ ] 콘텐츠가 정상적으로 생성되었는가?
- [ ] 미리보기가 업데이트되었는가?
- [ ] 상태가 정상적으로 초기화되었는가?
- [ ] 다음 실행이 가능한 상태인가?

---

**마지막 업데이트:** 2025-01-XX
**테스트 상태:** ✅ 준비 완료



















