# 블로그스팟 포스팅 테스트 요약

## ✅ 빠른 테스트 결과

### 환경 변수 로드
- ✅ **geminiKey**: 정상 로드 (39자)
- ✅ **googleClientId**: 정상 로드 (71자)
- ✅ **googleClientSecret**: 정상 로드 (35자)
- ✅ **blogId**: 정상 로드 (19자)
- ✅ **googleCseKey**: 정상 로드 (39자)
- ✅ **googleCseCx**: 정상 로드 (17자)

### 코드 구조 확인
- ✅ **runPost 함수**: 존재
- ✅ **publishGeneratedContent 함수**: 존재
- ✅ **MAX_MODE_SECTIONS**: 5개 섹션
- ✅ **buildMaxModePromptWithSubtopic 함수**: 존재

### 프롬프트 구조 확인
- ✅ **표 생성 지시사항**: 포함됨
- ✅ **CTA 생성 지시사항**: 포함됨

### 모의 HTML 검증
- ✅ H1 태그: 통과
- ✅ H2 태그 (최소 3개): 통과
- ✅ 표 행/셀: 통과
- ✅ CTA 링크: 통과
- ✅ CTA 버튼 클래스: 통과
- ✅ 문단 태그: 통과

## 📋 테스트 파일

1. **test-blogger-posting-quick.ts**: 빠른 구조 검증 (즉시 실행)
2. **test-blogger-posting-complete.ts**: 전체 테스트 (실제 콘텐츠 생성)

## 🚀 실행 방법

### 빠른 테스트 (구조만 확인)
```bash
npx ts-node test-blogger-posting-quick.ts
```

### 전체 테스트 (실제 콘텐츠 생성)
```bash
npx ts-node test-blogger-posting-complete.ts
```

## ⚠️ 주의사항

- 전체 테스트는 실제 Gemini API를 호출하므로 시간이 오래 걸릴 수 있습니다 (10분 타임아웃)
- API 키가 유효하지 않으면 콘텐츠 생성이 실패할 수 있습니다
- 실제 발행 테스트는 blogId, googleClientId, googleClientSecret이 모두 필요합니다

## 📊 검증 항목

1. ✅ 모듈 로드
2. ✅ 환경 변수 확인
3. ✅ 콘텐츠 생성
4. ✅ 글 구조 검증 (H1, H2, H3, 문단, 리스트)
5. ✅ 표 검증 (표 태그, 행, 셀)
6. ✅ CTA 검증 (링크, 버튼, 공식 링크)
7. ✅ 이미지 검증 (이미지 태그, 썸네일)
8. ✅ 세팅 반영 검증 (톤 스타일, 최소 글자수)
9. ✅ 실제 발행 테스트 (환경 변수 있을 때만)



