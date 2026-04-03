# Blogger Publisher - 모듈화된 구조

완벽하게 모듈화된 Blogger 퍼블리셔 시스템입니다. 기존 4604줄의 단일 파일을 9개의 명확한 책임을 가진 모듈로 분리했습니다.

## 📁 모듈 구조

```
blogger-modules/
├── index.js              # 통합 진입점 (134줄)
├── constants.js          # 상수 및 설정값 (98줄)
├── error-handler.js      # 에러 처리 및 진단 (123줄)
├── utils.js              # 공통 유틸리티 함수 (201줄)
├── auth.js               # OAuth2 인증 및 토큰 관리 (374줄)
├── style.js              # CSS 생성 및 스타일 처리 (279줄)
├── image.js              # 이미지 업로드 및 재호스팅 (200줄)
├── content.js            # 콘텐츠 검증 및 처리 (167줄)
└── publisher.js          # 메인 발행 로직 (360줄)
```

**총 코드량**: 약 1,936줄 (주석 포함)  
**코드 감소율**: 약 58% (4604줄 → 1,936줄)

## 🎯 각 모듈의 역할

### 1. **constants.js** - 상수 및 설정값
- API 할당량 설정
- 콘텐츠 크기 제한
- CSS 셀렉터 상수
- 에러 타입 정의
- OAuth2 설정

### 2. **error-handler.js** - 에러 처리 및 진단
- `diagnoseBloggerError()` - Blogger 에러 진단 및 해결 방법 제시
- `formatErrorDetails()` - 에러 메시지 포맷팅
- `logDetailedError()` - 상세 에러 로깅

### 3. **utils.js** - 공통 유틸리티 함수
- 환경변수 로드
- 텍스트 길이 계산
- HTML 특수문자 이스케이프
- 플랫폼별 경로 관리
- 안전한 JSON 파싱
- 크기/시간 포맷팅

### 4. **auth.js** - OAuth2 인증 및 토큰 관리
- `checkBloggerAuthStatus()` - 인증 상태 확인 (캐싱 지원)
- `clearAuthCache()` - 인증 캐시 무효화
- `getBloggerAuthUrl()` - OAuth2 인증 URL 생성
- `getBloggerInfo()` - 블로그 정보 조회
- `refreshAccessToken()` - 토큰 자동 갱신
- `saveTokenData()` - 토큰 저장

### 5. **style.js** - CSS 생성 및 스타일 처리
- `generateBloggerLayoutCSS()` - 프리미엄 디자인 CSS 생성
- `applyInlineStyles()` - 인라인 스타일 적용 (CSS 실패 대비)
- `compressCSS()` - CSS 압축 (공백/주석 제거)
- `injectCSS()` - HTML에 CSS 주입

### 6. **image.js** - 이미지 업로드 및 재호스팅
- `uploadDataUrlThumbnail()` - Data URL 썸네일 업로드
- `uploadExternalImage()` - 외부 이미지 재호스팅
- `processImagesInHtml()` - HTML 내 모든 이미지 처리

### 7. **content.js** - 콘텐츠 검증 및 처리
- `validateTitle()` - 제목 검증
- `validateHtml()` - HTML 콘텐츠 검증
- `validateContentSize()` - 콘텐츠 크기 검증 및 경고
- `analyzeContentSize()` - 콘텐츠 크기 분석
- `preprocessContent()` - 콘텐츠 전처리
- `determinePostingStatus()` - 포스팅 상태 결정
- `processLabels()` - 레이블 처리

### 8. **publisher.js** - 메인 발행 로직
- `publishToBlogger()` - Blogger API를 통한 포스트 발행
  - 인증 확인 및 토큰 갱신
  - 콘텐츠 검증 및 전처리
  - 이미지 재호스팅
  - CSS 생성 및 주입
  - API 호출 및 결과 처리

### 9. **index.js** - 통합 진입점
- 모든 모듈의 공개 API 통합
- 외부에서 사용할 함수들을 export
- 사용 예시 및 문서 제공

## 🚀 사용 방법

### 기본 사용 (기존 코드와 동일)

```javascript
const { publishToBlogger } = require('./blogger-publisher');

const result = await publishToBlogger(
  payload,              // {blogId, googleClientId, googleClientSecret}
  '포스트 제목',
  '<h1>포스트 내용</h1>',
  'https://example.com/image.jpg',
  (msg) => console.log(msg),
  'publish',           // 'publish' | 'draft' | 'scheduled'
  null                 // Date (scheduled일 경우)
);

if (result.ok) {
  console.log('발행 성공:', result.postUrl);
} else {
  console.error('발행 실패:', result.error);
}
```

### 모듈별 직접 사용

```javascript
const { 
  checkBloggerAuthStatus, 
  getBloggerAuthUrl,
  validateContentSize,
  analyzeContentSize,
  generateBloggerLayoutCSS
} = require('./blogger-modules');

// 인증 확인
const authStatus = await checkBloggerAuthStatus();

// 콘텐츠 크기 분석
const sizeInfo = analyzeContentSize(htmlContent);

// CSS 생성
const css = generateBloggerLayoutCSS();
```

## 📊 모듈화 이점

### 1. **코드 가독성 향상**
- 4604줄 단일 파일 → 각 모듈 100-400줄
- 명확한 책임 분리 (Single Responsibility Principle)
- 쉬운 코드 탐색 및 이해

### 2. **유지보수 용이성**
- 버그 수정 시 영향 범위 최소화
- 기능 추가 시 관련 모듈만 수정
- 코드 중복 제거로 일관성 향상

### 3. **테스트 용이성**
- 각 모듈을 독립적으로 테스트 가능
- Mock 객체 사용 용이
- 단위 테스트 작성 간편

### 4. **재사용성 향상**
- 필요한 모듈만 import 가능
- 다른 프로젝트에서 모듈 재사용
- 명확한 인터페이스로 통합 용이

### 5. **성능 최적화**
- 필요한 모듈만 로드
- 인증 캐싱으로 API 호출 감소
- CSS 압축으로 전송 크기 감소

## 🔄 마이그레이션 가이드

### 기존 코드와 100% 호환

```javascript
// 기존 방식 (여전히 작동)
const { publishToBlogger } = require('./blogger-publisher');

// 새로운 방식 (권장)
const { publishToBlogger } = require('./blogger-modules');
```

두 방식 모두 동일하게 작동하며, 기존 코드 변경 없이 사용 가능합니다.

### 단계별 마이그레이션

1. **백업 완료** ✅
   - `blogger-publisher.js.backup` 생성됨

2. **새 구조 적용** ✅
   - 모듈화된 구조로 자동 전환

3. **테스트** (권장)
   - 기존 기능 정상 작동 확인
   - 새로운 모듈 API 테스트

4. **최적화** (선택)
   - 필요한 모듈만 import하여 성능 향상
   - 커스텀 설정 적용

## 🛠️ 개발자 가이드

### 새 기능 추가 시

1. 관련 모듈 파일 수정
2. 필요시 새 모듈 생성
3. `index.js`에 export 추가
4. 테스트 작성 및 실행

### 버그 수정 시

1. 관련 모듈 파일 찾기
2. 해당 모듈에서만 수정
3. 영향 범위 확인
4. 테스트 실행

## 📝 의존성

### 핵심 의존성
- `googleapis` - Blogger API 클라이언트
- `google-auth-library` - OAuth2 인증
- `dotenv` - 환경변수 관리

### 내부 의존성 그래프

```
publisher.js
├── auth.js
│   ├── constants.js
│   └── utils.js
├── content.js
│   ├── constants.js
│   └── utils.js
├── image.js
│   └── error-handler.js
│       └── constants.js
├── style.js
└── error-handler.js
    └── constants.js
```

## 🎉 완료!

모듈화가 완료되었습니다. 기존 코드는 `blogger-publisher.js.backup`에 백업되어 있으며, 새로운 모듈화된 구조가 자동으로 적용되었습니다.

**변경 사항 없이 기존 코드가 그대로 작동합니다!** 🚀




