# 포스팅 발행 플로우 검증 가이드

## 문제점 분석
사용자가 포스팅 발행 시 설정한 글 생성 로직대로 글이 생성되지 않는 문제가 발생했습니다.

## 현재 설정 확인 사항

### 1. 글 생성 모드 확인
- **promptMode**: `max-mode` (MAX 모드)
- **contentMode**: 환경 변수에서 설정한 값 (external, internal, shopping, adsense, paraphrasing 중 하나)
- **AI Provider**: Gemini (글 생성 전용)

### 2. 코드 플로우 확인

#### `runPosting()` 함수 (src/ui/script.js)
1. 사용자 입력 수집 (주제, 키워드)
2. `createPreviewPayload()` 호출하여 payload 생성
3. `previewOnly = false`로 설정하여 발행 모드로 변경
4. `window.blogger.runPost(payload)` 호출

#### `runPost` IPC 핸들러 (electron/main.ts)
1. payload 수신
2. 환경 변수 병합
3. `runPost(payload, onLog)` 호출

#### `runPost` 함수 (src/core/index.ts)
1. `promptMode` 확인
2. `promptMode === 'max-mode'`인 경우:
   - `generateMaxModeArticle()` 호출
   - `contentMode`에 따라 섹션 구성
   - Gemini API로 글 생성

### 3. 검증해야 할 사항

#### ✅ 설정이 제대로 전달되는지 확인
- [ ] `promptMode`가 `max-mode`로 설정되는지
- [ ] `contentMode`가 환경 변수에서 올바르게 로드되는지
- [ ] `generateMaxModeArticle()`이 호출되는지

#### ✅ 글 생성 로직 확인
- [ ] `generateMaxModeArticle()` 함수가 올바른 섹션을 사용하는지
- [ ] 콘텐츠 모드에 맞는 프롬프트가 생성되는지
- [ ] Gemini API가 올바르게 호출되는지

## 테스트 방법

### 방법 1: 로그 확인
1. 앱 실행
2. 개발자 도구 열기 (F12)
3. 콘솔 탭에서 다음 로그 확인:
   - `[POSTING] runPosting 함수 시작`
   - `[MAIN] runPost 함수 호출 시작`
   - `[PROGRESS] MAX 모드로 콘텐츠 생성 중...`
   - `[PROGRESS] 콘텐츠 타입: ...`

### 방법 2: 실제 테스트 포스팅
1. 주제 입력: "블로그 마케팅 전략"
2. 키워드 입력: "블로그 마케팅, 콘텐츠 마케팅, SEO"
3. 콘텐츠 생성 버튼 클릭
4. 생성된 콘텐츠 확인:
   - 제목이 SEO 최적화되어 있는지
   - 콘텐츠 모드에 맞는 구조인지
   - 키워드가 자연스럽게 포함되어 있는지
   - 최소 글자 수를 충족하는지

### 방법 3: 설정 파일 확인
1. `.env` 파일 확인:
   ```
   CONTENT_MODE=external  # 또는 internal, shopping, adsense, paraphrasing
   PROMPT_MODE=max-mode
   AI_PROVIDER=gemini
   ```

## 문제 해결 체크리스트

### 문제 1: 다른 모드로 글이 생성되는 경우
- [ ] `promptMode`가 `max-mode`로 설정되어 있는지 확인
- [ ] `runPost` 함수에서 `promptMode` 체크 로직 확인
- [ ] 환경 변수에서 `PROMPT_MODE`가 올바르게 로드되는지 확인

### 문제 2: 콘텐츠 모드가 반영되지 않는 경우
- [ ] 환경 변수 `CONTENT_MODE` 값 확인
- [ ] `generateMaxModeArticle()`에서 `contentMode` 사용 확인
- [ ] 섹션 구성이 콘텐츠 모드에 맞는지 확인

### 문제 3: 키워드가 반영되지 않는 경우
- [ ] 키워드 입력 필드에서 값이 올바르게 수집되는지 확인
- [ ] `runPost` 함수에서 키워드 배열이 올바르게 전달되는지 확인
- [ ] 프롬프트에 키워드가 포함되는지 확인

## 코드 수정 사항

### 확인된 코드 위치
1. **글 생성 로직**: `src/core/index.ts`의 `runPost()` 함수 (3540줄)
2. **MAX 모드 생성**: `src/core/index.ts`의 `generateMaxModeArticle()` 함수 (1051줄)
3. **UI 호출**: `src/ui/script.js`의 `runPosting()` 함수 (1137줄)

### 권장 수정 사항
1. 로그 추가하여 각 단계에서 설정값 확인
2. 콘텐츠 모드에 따른 섹션 구성 명확화
3. 프롬프트 생성 로직 검증

## 다음 단계
1. 실제 포스팅 테스트 실행
2. 생성된 콘텐츠 검증
3. 문제 발견 시 해당 부분 수정






















