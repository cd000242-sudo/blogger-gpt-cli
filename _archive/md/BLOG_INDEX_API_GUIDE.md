# 🚀 블로그 지수 API 가이드

네이버 블로그 지수를 API로 제공하는 서비스입니다. 유료 서비스 대비 저렴한 가격으로 제공할 수 있습니다.

## 📋 목차

1. [설치 및 실행](#설치-및-실행)
2. [API 키 생성](#api-키-생성)
3. [API 사용법](#api-사용법)
4. [API 엔드포인트](#api-엔드포인트)
5. [가격 정책 제안](#가격-정책-제안)

## 🚀 설치 및 실행

### 1. 서버 시작

```bash
npm run api:blog-index
```

또는 직접 실행:

```bash
ts-node start-blog-index-api.ts
```

기본 포트: `3000` (환경 변수 `PORT`로 변경 가능)

### 2. 환경 변수 설정

`.env` 파일에 다음 변수들을 설정하세요:

```env
# 네이버 API 키 (필수)
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret

# API 서버 포트 (선택)
PORT=3000

# 관리자 키 (API 키 생성용, 선택)
ADMIN_KEY=your-secure-admin-key
```

## 🔑 API 키 생성

### 관리자로 API 키 생성

```bash
curl -X POST http://localhost:3000/api/admin/create-key \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-secure-admin-key" \
  -d '{
    "name": "클라이언트 이름",
    "dailyLimit": 1000
  }'
```

응답 예시:

```json
{
  "success": true,
  "data": {
    "apiKey": "a1b2c3d4e5f6...",
    "name": "클라이언트 이름",
    "dailyLimit": 1000,
    "createdAt": "2024-11-15T06:00:00.000Z"
  }
}
```

**⚠️ API 키는 한 번만 표시되므로 안전하게 저장하세요!**

### API 키 목록 조회

```bash
curl http://localhost:3000/api/admin/keys \
  -H "X-Admin-Key: your-secure-admin-key"
```

## 📚 API 사용법

### 1. 단일 블로그 지수 조회

```bash
curl http://localhost:3000/api/blog-index/mission49 \
  -H "X-API-Key: your-api-key"
```

또는 쿼리 파라미터로:

```bash
curl "http://localhost:3000/api/blog-index/mission49?apiKey=your-api-key"
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "blogId": "mission49",
    "blogIndex": 12345,
    "estimatedIndex": 12345,
    "confidence": 95,
    "source": "puppeteer"
  },
  "meta": {
    "cached": false,
    "source": "puppeteer",
    "confidence": 95
  }
}
```

### 2. 일괄 조회 (최대 100개)

```bash
curl -X POST http://localhost:3000/api/blog-index/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "blogIds": ["mission49", "choibrian", "kdjmoney"]
  }'
```

**응답 예시:**

```json
{
  "success": true,
  "data": [
    {
      "blogId": "mission49",
      "blogIndex": 12345,
      "estimatedIndex": 12345,
      "confidence": 95,
      "source": "puppeteer",
      "cached": false
    },
    {
      "blogId": "choibrian",
      "blogIndex": 8900,
      "estimatedIndex": 8900,
      "confidence": 70,
      "source": "rss",
      "cached": false
    }
  ],
  "meta": {
    "total": 2,
    "cached": 0,
    "new": 2
  }
}
```

### 3. 사용 통계 조회

```bash
curl http://localhost:3000/api/stats \
  -H "X-API-Key: your-api-key"
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "apiKey": "a1b2c3d4...",
    "name": "클라이언트 이름",
    "requestCount": 245,
    "dailyLimit": 1000,
    "remaining": 755,
    "lastUsed": "2024-11-15T06:30:00.000Z"
  }
}
```

### 4. 헬스 체크

```bash
curl http://localhost:3000/api/health
```

## 🔗 API 엔드포인트

| 메서드 | 엔드포인트 | 설명 | 인증 |
|--------|-----------|------|------|
| GET | `/api/blog-index/:blogId` | 블로그 지수 조회 | API Key |
| POST | `/api/blog-index/batch` | 일괄 조회 | API Key |
| GET | `/api/stats` | 사용 통계 | API Key |
| GET | `/api/health` | 헬스 체크 | 없음 |
| POST | `/api/admin/create-key` | API 키 생성 | Admin Key |
| GET | `/api/admin/keys` | API 키 목록 | Admin Key |

## 💰 가격 정책 제안

### 티어별 제안

#### 1. 무료 티어
- 일일 100회 요청
- 캐시된 데이터만 제공
- 신뢰도 70% 이상

#### 2. 베이직 ($9/월)
- 일일 1,000회 요청
- 실시간 데이터 추출
- 신뢰도 70% 이상
- API 우선 지원

#### 3. 프로 ($29/월)
- 일일 10,000회 요청
- 실시간 데이터 추출
- 신뢰도 95% 이상 (Puppeteer 사용)
- 일괄 조회 지원
- 전용 API 키

#### 4. 엔터프라이즈 ($99/월)
- 무제한 요청
- 모든 기능
- 전용 서버
- 우선 지원
- SLA 보장

### 구현 방법

1. **일일 한도 설정**: API 키의 `dailyLimit` 필드로 관리
2. **자동 갱신**: 매일 자정 사용량 리셋
3. **결제 통합**: Stripe 또는 한국 PG사 연동
4. **대시보드**: 사용량 및 결제 관리

## 📊 캐싱 전략

- **캐시 시간**: 24시간
- **캐시 저장소**: 파일 기반 (SQLite로 업그레이드 가능)
- **캐시 키**: 블로그 ID의 MD5 해시

## 🔒 보안

1. **API 키 인증**: 모든 요청에 API 키 필요
2. **Rate Limiting**: 일일 한도 초과 시 429 에러
3. **HTTPS 권장**: 운영 환경에서는 반드시 HTTPS 사용
4. **CORS 설정**: 필요시 CORS 미들웨어 추가

## 🚀 배포

### PM2로 배포

```bash
npm install -g pm2
pm2 start start-blog-index-api.ts --interpreter ts-node
pm2 save
pm2 startup
```

### Docker로 배포

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/api/blog-index-api.js"]
```

## 📈 모니터링

- **로그**: 콘솔 출력 (Winston 등으로 업그레이드 가능)
- **메트릭**: 요청 수, 응답 시간, 에러율 추적
- **알림**: 일일 한도 도달 시 알림

## 🔧 개선 사항

### 단기
- [ ] SQLite 데이터베이스로 캐시 저장소 변경
- [ ] Redis 캐싱 추가 (선택)
- [ ] Rate limiting 미들웨어 추가
- [ ] CORS 설정

### 중기
- [ ] 사용자 대시보드 웹 인터페이스
- [ ] 결제 시스템 통합 (Stripe, PG사)
- [ ] 웹훅 지원
- [ ] 상세 메트릭 대시보드

### 장기
- [ ] 분산 캐싱 (Redis Cluster)
- [ ] 로드 밸런싱
- [ ] CDN 연동
- [ ] GraphQL API 추가

## 📞 지원

문제가 발생하면 이슈를 등록하거나 연락하세요.

---

**💰 수익화 팁**: 
- 초기에는 무료 티어로 사용자를 모으고
- 실제 데이터를 많이 사용하는 고객에게 프로/엔터프라이즈 플랜 제안
- 블로그 마케팅 회사, SEO 도구, 키워드 분석 도구 등에 B2B 판매







