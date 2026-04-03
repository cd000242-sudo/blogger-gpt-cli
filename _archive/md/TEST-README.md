# 포스팅 발행 테스트 가이드

## 테스트 파일 실행 방법

```bash
npm run test:posting
```

## 테스트 내용

이 테스트 파일은 다음을 검증합니다:

1. **크롤링 기능**
   - 네이버 API 크롤링
   - RSS 크롤링
   - Google CSE 크롤링
   - 크롤링 타임아웃 (45초)

2. **포스팅 생성**
   - 제목 생성
   - 소제목 생성
   - 본문 생성
   - CTA 생성
   - 핵심 요약표 생성

3. **성능 검증**
   - 전체 생성 시간 (목표: 60초 이내)
   - 크롤링 시간 (목표: 45초 이내)

4. **콘텐츠 품질**
   - HTML 구조 검증
   - 텍스트 길이 검증
   - 필수 요소 포함 여부

## 환경 변수 설정

테스트를 실행하기 전에 다음 환경 변수를 설정하세요:

```env
GEMINI_API_KEY=your_gemini_api_key
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_google_cse_id
```

또는 `.env` 파일에 추가하세요.

## 테스트 결과 해석

### 성공 기준
- ✅ HTML이 비어있지 않음
- ✅ H2 태그 포함
- ✅ P 태그 포함
- ✅ 생성 시간 60초 이내
- ✅ 최소 글자수 충족

### 실패 시 확인 사항
1. API 키가 올바르게 설정되었는지 확인
2. 네트워크 연결 확인
3. API 할당량 확인
4. 에러 메시지 확인

## 성능 최적화

현재 크롤링 성능 최적화 설정:
- 네이버 API: 최대 50개 결과
- RSS: 최대 50개 결과
- Google CSE: 최대 30개 결과
- 크롤링 타임아웃: 45초

## 문제 해결

### API 키 오류
```
❌ Gemini API 키 오류: API key not valid
```
→ `.env` 파일에 올바른 API 키가 설정되어 있는지 확인

### 타임아웃 오류
```
❌ 크롤링 전체 시간 초과: 45초를 초과했습니다
```
→ 네트워크 속도나 API 응답 시간 확인, 필요시 타임아웃 증가

### 크롤링 실패
```
❌ 네이버 API 실패
❌ RSS 실패
❌ CSE 실패
```
→ 각 API 키가 올바른지, 할당량이 남아있는지 확인



















