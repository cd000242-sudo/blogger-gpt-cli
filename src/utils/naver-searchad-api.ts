/**
 * 네이버 검색광고 키워드 도구 API
 * 정확한 PC/모바일 검색량 조회
 */

import { createHash, createHmac } from 'crypto';

export interface NaverSearchAdConfig {
  accessLicense: string;
  secretKey: string;
  customerId?: string; // 고객 ID (X-Customer 헤더에 사용)
}

export interface KeywordSearchVolume {
  keyword: string;
  pcSearchVolume: number;
  mobileSearchVolume: number;
  totalSearchVolume: number;
  competition?: string;
  monthlyPcQcCnt?: number;
  monthlyMobileQcCnt?: number;
}

function generateSignature(
  method: string,
  uri: string,
  timestamp: string, // 밀리초 단위 문자열
  secretKey: string
): string {
  // 네이버 검색광고 API 서명 생성 방식
  // ✅ 정확한 방법:
  // message = f"{timestamp}.{method}.{uri}"
  // signature = base64.b64encode(
  //   hmac.new(secret_key.encode('utf-8'), 
  //            message.encode('utf-8'), 
  //            hashlib.sha256).digest()
  // ).decode('utf-8')
  //
  // 핵심:
  // 1. 메시지 형식: "{timestamp}.{HTTP_METHOD}.{URI}" (점으로 구분)
  // 2. Timestamp: 밀리초 단위 (문자열)
  // 3. URI: 쿼리 파라미터 제외한 경로만 (예: "/keywordstool")
  // 4. Secret Key: base64 디코딩하지 않고 그대로 UTF-8로 사용
  // 5. HMAC 결과: base64로 인코딩 (hex 아님!)
  // 6. POST 요청: body hash 포함하지 않음 (GET과 동일한 방식)

  // 메시지 생성: {timestamp}.{HTTP_METHOD}.{URI}
  // 네이버 검색광고 API는 GET/POST 모두 동일한 방식으로 서명 생성
  // body hash는 포함하지 않음
  const message = `${timestamp}.${method.toUpperCase()}.${uri}`;

  // digest()가 이미 Buffer를 반환하므로 바로 base64로 변환
  return createHmac('sha256', secretKey)
    .update(message, 'utf8')
    .digest('base64');
}

// generateAltSignature 함수는 더 이상 필요 없음 (올바른 서명 방식으로 통일)

export async function getNaverSearchAdKeywordVolume(
  config: NaverSearchAdConfig,
  keywords: string[]
): Promise<KeywordSearchVolume[]> {
  if (!config.accessLicense || !config.secretKey) {
    throw new Error('네이버 검색광고 API 인증 정보가 필요합니다');
  }

  // X-Customer 헤더는 필수이므로 customerId가 없으면 accessLicense에서 추출 시도
  // ⚠️ 중요: customerId는 별도의 고객 ID (예: "3992868")이며,
  // accessLicense와는 별개의 값입니다.
  // 환경 변수 NAVER_SEARCH_AD_CUSTOMER_ID에 설정하거나 config.customerId로 전달해야 합니다.
  let customerId: string;
  if (config.customerId && typeof config.customerId === 'string' && config.customerId.trim() !== '') {
    customerId = config.customerId.trim();
  } else {
    // customerId가 명시적으로 제공되지 않은 경우
    // accessLicense에서 추출 시도 (하지만 권장하지 않음)
    const parts = config.accessLicense.split(':');
    if (parts.length > 1 && parts[0] && typeof parts[0] === 'string' && parts[0].trim() !== '') {
      customerId = parts[0].trim(); // "CUSTOMER_ID:ACCESS_LICENSE" 형식
    } else {
      // ⚠️ 경고: 이 방법은 정확하지 않을 수 있습니다.
      // customerId는 별도로 설정하는 것이 좋습니다.
      // accessLicense는 "0100000000273f693000..." 형식일 수 있지만,
      // 실제 customerId는 "3992868"과 같은 별도 값입니다.
      const extracted = config.accessLicense.substring(0, Math.min(10, config.accessLicense.length));
      customerId = extracted;
      console.warn(`[NAVER-SEARCHAD] ⚠️ customerId가 명시적으로 설정되지 않아 accessLicense에서 추출: "${customerId}". 정확한 customerId를 설정하세요.`);
    }
  }

  // customerId가 확실히 string임을 보장 (최종 안전장치)
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    const extracted = config.accessLicense.substring(0, Math.min(10, config.accessLicense.length));
    customerId = extracted;
    console.warn(`[NAVER-SEARCHAD] ⚠️ customerId가 비어있어 accessLicense에서 추출: "${customerId}"`);
  }

  // 첫 번째 키워드의 경우 customerId 로깅 (디버깅용)
  if (keywords.length > 0 && keywords[0]) {
    console.log(`[NAVER-SEARCHAD] customerId 사용: "${customerId}" (accessLicense: ${config.accessLicense.substring(0, 20)}...)`);
  }
  const results: KeywordSearchVolume[] = [];
  for (const keyword of keywords) {
    // 원본 키워드 저장 (catch 블록에서도 사용하기 위해 try 블록 밖에서 정의)
    const cleanKeyword = keyword.trim();
    const originalKeyword = cleanKeyword; // 원본 저장 (결과 반환용)

    try {
      // 네이버 검색광고 API는 GET 방식으로 쿼리 파라미터 전송
      const apiUrl = 'https://api.searchad.naver.com/keywordstool';
      const uri = '/keywordstool'; // URI는 경로만 (쿼리 파라미터 제외)
      const method = 'GET'; // GET 방식 사용

      // Timestamp: 밀리초 단위 (문자열)
      const timestamp = String(Date.now());

      // GET 요청의 경우 쿼리 파라미터로 전송
      // 네이버 검색광고 API는 여러 파라미터를 지원:
      // 1. hintKeywords (복수형, 쉼표로 구분) - 여러 키워드 조회
      // 2. hintKeyword (단수형) - 단일 키워드 조회 (띄어쓰기 포함 키워드에 적합)
      // 3. query - 검색어로 조회

      // ⚠️ 중요: "부세미 시청률"과 "부세미시청률"은 다른 키워드입니다!
      // 네이버 검색광고 API는 hintKeyword (단수형)를 사용하면 띄어쓰기 포함 키워드를 더 잘 처리합니다.

      // 키워드 전처리: 특수문자만 제거 (띄어쓰기는 유지)
      // ⚠️ 중요: 네이버 검색광고 API는 특수문자를 제거해야 할 수 있음
      let processedKeyword = cleanKeyword
        .replace(/['"]/g, '') // 작은따옴표, 큰따옴표 제거
        .replace(/[&<>]/g, '') // HTML 특수문자 제거
        .replace(/[^\w\s가-힣]/g, '') // 영문, 숫자, 한글, 공백만 허용 (특수문자 모두 제거)
        .trim() // 앞뒤 공백 제거
        .replace(/\s+/g, ' '); // 연속 공백을 하나로 통합

      // 키워드가 비어있으면 원본 그대로 사용
      if (!processedKeyword || processedKeyword.length === 0) {
        processedKeyword = cleanKeyword.trim();
      }

      // 네이버 검색광고 API 키워드 길이 제한 (40자로 여유있게 설정)
      if (processedKeyword.length > 40) {
        console.warn(`[NAVER-SEARCHAD] "${keyword}": 키워드 길이 초과 (${processedKeyword.length}자), 40자로 제한`);
        processedKeyword = processedKeyword.substring(0, 40).trim();
      }

      // 네이버 검색광고 API 파라미터 설정
      // ⚠️ 중요: 네이버 검색광고 API는 hintKeywords를 배열로 받을 수 있음
      // 단일 키워드도 hintKeywords로 전달 (더 안정적)
      const params = new URLSearchParams();

      // hintKeywords를 배열 형태로 전달 (JSON 문자열)
      // 예: hintKeywords=["키워드1","키워드2"] 또는 hintKeywords=키워드1,키워드2
      // 네이버 API는 쉼표로 구분된 문자열도 받을 수 있음
      params.append('hintKeywords', processedKeyword);
      params.append('showDetail', '1');

      if (keywords.indexOf(keyword) === 0) {
        console.log(`[NAVER-SEARCHAD] "${keyword}": hintKeywords 사용 (띄어쓰기 ${processedKeyword.includes(' ') ? '포함' : '없음'})`);
      }

      // 첫 번째 키워드의 경우 요청 정보 로깅
      if (keywords.indexOf(keyword) === 0) {
        console.log(`[NAVER-SEARCHAD] "${keyword}" API 요청 정보:`, {
          url: apiUrl,
          uri: uri,
          method: method,
          timestamp: timestamp,
          params: params.toString(),
          keyword: processedKeyword,
          keywordEncoded: encodeURIComponent(processedKeyword),
          keywordWithPlus: processedKeyword.replace(/\s+/g, '+'),
          'params.toString()': params.toString(),
          'URLSearchParams keys': Array.from(params.keys()),
          'URLSearchParams values': Array.from(params.values())
        });
      }

      // 서명 생성: {timestamp}.{HTTP_METHOD}.{URI}
      // ⚠️ 중요: URI는 쿼리 파라미터를 포함하지 않고 경로만 사용
      // 서명에는 쿼리 파라미터가 포함되지 않음
      const signature = generateSignature(method, uri, timestamp, config.secretKey);

      const controller = new AbortController();
      // 타임아웃을 60초로 증가 (429 에러 재시도 시간 고려)
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      let response: Response;
      try {
        // ⚠️ 중요: GET 요청은 Content-Type 헤더가 필요 없거나
        // application/x-www-form-urlencoded여야 합니다.
        // 네이버 검색광고 API는 GET 요청이므로 Content-Type을 제거하거나 수정
        const headers: Record<string, string> = {
          'X-Timestamp': timestamp,
          'X-API-KEY': config.accessLicense,
          'X-Signature': signature,
          'X-Customer': customerId  // 필수 헤더
          // Content-Type은 GET 요청에서 제거 (쿼리 파라미터로 전송하므로)
        };

        // 첫 번째 키워드의 경우 헤더 정보 상세 로깅 (디버깅용)
        if (keywords.indexOf(keyword) === 0) {
          console.log(`[NAVER-SEARCHAD] "${keyword}" 요청 헤더:`, {
            'X-Timestamp': timestamp,
            'X-API-KEY': config.accessLicense.substring(0, 20) + '...',
            'X-Signature': signature.substring(0, 20) + '...',
            'X-Customer': customerId,
            'customerId_length': customerId.length,
            'accessLicense_prefix': config.accessLicense.substring(0, 15),
            'headers_count': Object.keys(headers).length,
            'all_headers': Object.keys(headers)
          });
          console.log(`[NAVER-SEARCHAD] "${keyword}" 쿼리 파라미터:`, params.toString());
          console.log(`[NAVER-SEARCHAD] "${keyword}" 전체 URL:`, `${apiUrl}?${params.toString()}`);
        }

        // GET 요청의 경우 쿼리 파라미터로 전송
        // ⚠️ 중요: URLSearchParams.toString()은 공백을 '+'로 인코딩하지만
        // 네이버 API는 '%20' 인코딩을 기대하므로 수동 변환
        const fullUrl = `${apiUrl}?${params.toString().replace(/\+/g, '%20')}`;
        response = await fetch(fullUrl, {
          method: method,
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          console.warn(`[NAVER-SEARCHAD] "${keyword}": 타임아웃 (AbortError) - 0 반환`);
          results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
          continue;
        }
        throw fetchErr;
      }
      const isFirstKeyword = keywords.indexOf(keyword) === 0;
      if (!response.ok) {
        // 응답 본문 읽기 시도
        let errorText = '';
        try {
          errorText = await response.text();
        } catch { errorText = ''; }

        if (isFirstKeyword) {
          console.warn(`[NAVER-SEARCHAD] "${keyword}" API 호출 실패: ${response.status} ${response.statusText} — ${errorText.substring(0, 200)}`);
        }

        // 400 에러 → 즉시 실패 (파라미터 문제이므로 재시도 무의미)
        if (response.status === 400) {
          console.warn(`[NAVER-SEARCHAD] "${keyword}" 400 에러 → 건너뜀`);
          results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
          continue;
        }

        // 429 에러 → 짧은 재시도 (최대 2회, 10초 대기)
        if (response.status === 429) {
          let retrySuccess = false;
          const maxRetries = 2;

          for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
            const delay = 10000; // 10초 고정
            console.warn(`[NAVER-SEARCHAD] "${keyword}" 429 Rate Limit → ${delay / 1000}초 대기 후 재시도 ${retryCount + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, delay));

            try {
              const retryTimestamp = String(Date.now());
              const retrySignature = generateSignature(method, uri, retryTimestamp, config.secretKey);
              const retryHeaders: Record<string, string> = {
                'X-Timestamp': retryTimestamp,
                'X-API-KEY': config.accessLicense,
                'X-Signature': retrySignature,
                'X-Customer': customerId
              };
              const retryFullUrl = `${apiUrl}?${params.toString().replace(/\+/g, '%20')}`;

              const retryController = new AbortController();
              const retryTimeoutId = setTimeout(() => retryController.abort(), 15000);
              const retryResponse = await fetch(retryFullUrl, { method, headers: retryHeaders, signal: retryController.signal });
              clearTimeout(retryTimeoutId);

              if (retryResponse.ok) {
                response = retryResponse;
                retrySuccess = true;
                console.log(`[NAVER-SEARCHAD] ✅ "${keyword}" 429 재시도 성공 (${retryCount + 1}번째)`);
                break;
              }
            } catch (retryErr: any) {
              console.warn(`[NAVER-SEARCHAD] "${keyword}" 429 재시도 ${retryCount + 1} 실패: ${retryErr.message}`);
            }
          }

          if (!retrySuccess) {
            console.error(`[NAVER-SEARCHAD] "${keyword}" 429 Rate Limit: ${maxRetries}회 재시도 후 실패`);
            results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
            continue;
          }
          // 재시도 성공 시 response가 업데이트됨 → 아래 JSON 파싱으로 진행
        }

        // 403 에러 → 즉시 실패 (인증 문제)
        else if (response.status === 403) {
          if (isFirstKeyword) {
            console.error(`[NAVER-SEARCHAD] "${keyword}" 403 인증 실패 → 건너뜀`);
          }
          results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
          continue;
        }

        // 기타 에러 → 즉시 실패
        else {
          if (isFirstKeyword) {
            console.error(`[NAVER-SEARCHAD] "${keyword}" ${response.status} 에러 → 건너뜀`);
          }
          results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
          continue;
        }
      }



      // JSON 파싱 시도 (에러 처리 포함)
      let data: any;
      try {
        data = await response.json();
      } catch (jsonError: any) {
        console.error(`[NAVER-SEARCHAD] "${keyword}" JSON 파싱 실패:`, jsonError.message);
        results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
        continue;
      }

      // 디버깅: API 응답 구조 확인 (첫 번째 키워드만 상세 로깅)
      if (keywords.indexOf(keyword) === 0) {
        console.log(`[NAVER-SEARCHAD] "${keyword}" API 응답 전체 구조:`, JSON.stringify(data, null, 2));
        console.log(`[NAVER-SEARCHAD] "${keyword}" API 응답 키 목록:`, Object.keys(data || {}));

        // 응답 구조 분석
        if (data && typeof data === 'object') {
          console.log(`[NAVER-SEARCHAD] "${keyword}" 응답 구조 분석:`, {
            hasKeywordList: !!data.keywordList,
            hasRelKeywordList: !!data.relKeywordList,
            hasResult: !!data.result,
            hasData: !!data.data,
            hasBody: !!data.body,
            hasResponse: !!data.response,
            isArray: Array.isArray(data),
            keys: Object.keys(data)
          });
        }
      }

      // 다양한 응답 구조 처리 (네이버 검색광고 API는 여러 형태의 응답을 반환)
      let keywordList: any[] = [];

      // 1. keywordList (기본)
      if (data.keywordList && Array.isArray(data.keywordList)) {
        keywordList = data.keywordList;
      }
      // 2. relKeywordList (관련 키워드 리스트)
      else if (data.relKeywordList && Array.isArray(data.relKeywordList)) {
        keywordList = data.relKeywordList;
      }
      // 3. result.keywordList
      else if (data.result && data.result.keywordList && Array.isArray(data.result.keywordList)) {
        keywordList = data.result.keywordList;
      }
      // 4. result.relKeywordList
      else if (data.result && data.result.relKeywordList && Array.isArray(data.result.relKeywordList)) {
        keywordList = data.result.relKeywordList;
      }
      // 5. data (배열)
      else if (data.data && Array.isArray(data.data)) {
        keywordList = data.data;
      }
      // 6. userKeyword (단일 키워드 정보)
      else if (data.userKeyword) {
        keywordList = [data.userKeyword];
      }
      // 7. userKeywordList (사용자 키워드 리스트)
      else if (data.userKeywordList && Array.isArray(data.userKeywordList)) {
        keywordList = data.userKeywordList;
      }
      // 8. 직접 배열
      else if (Array.isArray(data)) {
        keywordList = data;
      }
      // 9. body.keywordList
      else if (data.body && data.body.keywordList && Array.isArray(data.body.keywordList)) {
        keywordList = data.body.keywordList;
      }
      // 10. body.relKeywordList
      else if (data.body && data.body.relKeywordList && Array.isArray(data.body.relKeywordList)) {
        keywordList = data.body.relKeywordList;
      }
      // 11. response.keywordList
      else if (data.response && data.response.keywordList && Array.isArray(data.response.keywordList)) {
        keywordList = data.response.keywordList;
      }
      // 12. response.data (배열)
      else if (data.response && data.response.data && Array.isArray(data.response.data)) {
        keywordList = data.response.data;
      }
      // 13. 직접 키워드 정보 (keywordList가 없지만 키워드 정보가 직접 있는 경우)
      else if (data.relKeyword || data.keyword || data.query) {
        keywordList = [data];
      }

      // 디버깅: 추출된 keywordList 확인
      if (keywords.indexOf(keyword) === 0) {
        console.log(`[NAVER-SEARCHAD] "${keyword}" 추출된 keywordList 개수: ${keywordList.length}`);
        if (keywordList.length > 0) {
          console.log(`[NAVER-SEARCHAD] 첫 번째 항목 구조:`, JSON.stringify(keywordList[0], null, 2).substring(0, 500));
        }
      }

      // ⚠️ 중요: keywordList가 빈 배열이면 즉시 블로그 검색 API로 폴백
      if (!keywordList || keywordList.length === 0) {
        console.warn(`[NAVER-SEARCHAD] ⚠️ "${keyword}": keywordList 없음 또는 비어있음`);
        console.log(`[NAVER-SEARCHAD] 응답 전체 데이터:`, JSON.stringify(data, null, 2));
        console.log(`[NAVER-SEARCHAD] 응답 키 목록:`, Object.keys(data || {}));

        // 즉시 블로그 검색 API로 폴백 시도
        console.log(`[NAVER-SEARCHAD] "${keyword}": 검색량 데이터 없음 (빈 배열) - 블로그 검색 API로 즉시 폴백`);
        try {
          const { getBlogSearchFallback } = await import('../utils/naver-datalab-api');
          const envManager = (await import('../utils/environment-manager')).EnvironmentManager.getInstance();
          const envConfig = envManager.getConfig();

          const fallbackConfig = {
            clientId: envConfig.naverClientId || '',
            clientSecret: envConfig.naverClientSecret || ''
          };

          if (fallbackConfig.clientId && fallbackConfig.clientSecret) {
            // 블로그 검색 API 폴백 함수 호출 (naver-datalab-api.ts에 정의되어 있음)
            const fallbackResult = await getBlogSearchFallback(fallbackConfig, originalKeyword);
            if (fallbackResult && (fallbackResult.pcSearchVolume > 0 || fallbackResult.mobileSearchVolume > 0)) {
              console.log(`[NAVER-SEARCHAD] ✅ "${keyword}": 블로그 검색 API 폴백 성공`);
              results.push({
                keyword: originalKeyword,
                pcSearchVolume: fallbackResult.pcSearchVolume,
                mobileSearchVolume: fallbackResult.mobileSearchVolume,
                totalSearchVolume: fallbackResult.pcSearchVolume + fallbackResult.mobileSearchVolume
              });
              continue;
            }
          }
        } catch (fallbackError: any) {
          console.warn(`[NAVER-SEARCHAD] "${keyword}": 블로그 검색 API 폴백 실패:`, fallbackError.message);
        }

        // 폴백도 실패하면 0 반환
        console.warn(`[NAVER-SEARCHAD] "${keyword}": 검색량 데이터 없음 (빈 배열)`);
        results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
        continue;
      }

      if (keywordList && keywordList.length > 0) {
        // HTML 엔티티 디코딩 함수
        const decodeHtmlEntities = (str: string): string => {
          if (!str || typeof str !== 'string') return str;
          return str
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim();
        };

        // 정확한 키워드 매칭 시도
        // ⚠️ 중요: "부세미 시청률"과 "부세미시청률"은 다른 키워드입니다!
        // 원본 키워드와 정확히 일치하는 결과를 찾아야 합니다.
        const normalizedOriginalKeyword = decodeHtmlEntities(originalKeyword.trim().toLowerCase());
        const normalizedProcessedKeyword = processedKeyword.toLowerCase();

        // 1순위: 원본 키워드와 정확히 일치하는 결과 찾기 (띄어쓰기 포함)
        let keywordData = keywordList.find((item: any) => {
          const relKeyword = decodeHtmlEntities(item.relKeyword || item.keyword || item.query || item.hintKeyword || '');
          const normalizedRelKeyword = relKeyword.toLowerCase();

          // 정확히 일치 (띄어쓰기 포함)
          return normalizedRelKeyword === normalizedOriginalKeyword;
        });

        // 2순위: 처리된 키워드(특수문자 제거)와 일치하는 결과 찾기
        if (!keywordData) {
          keywordData = keywordList.find((item: any) => {
            const relKeyword = decodeHtmlEntities(item.relKeyword || item.keyword || item.query || item.hintKeyword || '');
            const normalizedRelKeyword = relKeyword.toLowerCase();

            return normalizedRelKeyword === normalizedProcessedKeyword;
          });
        }

        // 3순위: 부분 일치
        if (!keywordData) {
          keywordData = keywordList.find((item: any) => {
            const relKeyword = decodeHtmlEntities(item.relKeyword || item.keyword || item.query || item.hintKeyword || '');
            const normalizedRelKeyword = relKeyword.toLowerCase();

            // 부분 일치 체크
            return normalizedRelKeyword.includes(normalizedOriginalKeyword) ||
              normalizedOriginalKeyword.includes(normalizedRelKeyword);
          });
        }

        // 4순위: 첫 번째 결과 사용
        if (!keywordData) {
          keywordData = keywordList[0];
          const foundKeywordRaw = keywordData?.relKeyword || keywordData?.keyword || keywordData?.query || keywordData?.hintKeyword || 'N/A';
          const foundKeyword = decodeHtmlEntities(foundKeywordRaw);
          console.log(`[NAVER-SEARCHAD] "${originalKeyword}": 정확한 매칭 실패, 첫 번째 결과 사용: ${foundKeyword}`);

          // 첫 번째 키워드와 검색 키워드가 완전히 다르면 경고
          if (keywords.indexOf(keyword) === 0) {
            if (foundKeyword.toLowerCase() !== normalizedOriginalKeyword) {
              console.warn(`[NAVER-SEARCHAD] ⚠️ 검색 키워드 "${originalKeyword}"와 응답 키워드 "${foundKeyword}"가 다릅니다.`);
            }
          }
        }

        // ⚠️ 중요: 결과에는 원본 키워드(originalKeyword)를 그대로 사용 (띄어쓰기 포함)
        const extractedKeyword = originalKeyword; // 원본 키워드 그대로 사용

        // 다양한 필드명으로 검색량 추출 (네이버 검색광고 API 필드명)
        // PC 검색량: monthlyPcQcCnt, pcQcCnt, pcSearchVolume, pcVolume, monthlyPcQcCnt, pcQcCnt
        // 모바일 검색량: monthlyMobileQcCnt, mobileQcCnt, mobileSearchVolume, mobileVolume
        // 전체 검색량: monthlyQcCnt, totalQcCnt, totalSearchVolume, totalVolume, plAvgDepth, monthlyQcCnt

        // PC 검색량 추출 (다양한 필드명 시도)
        // 네이버 검색광고 API는 다양한 필드명을 사용할 수 있음
        let pcVolume: number | string | null = null;
        if (keywordData.monthlyPcQcCnt !== undefined && keywordData.monthlyPcQcCnt !== null) {
          pcVolume = keywordData.monthlyPcQcCnt;
        } else if (keywordData.pcQcCnt !== undefined && keywordData.pcQcCnt !== null) {
          pcVolume = keywordData.pcQcCnt;
        } else if (keywordData.pcSearchVolume !== undefined && keywordData.pcSearchVolume !== null) {
          pcVolume = keywordData.pcSearchVolume;
        } else if (keywordData.pcVolume !== undefined && keywordData.pcVolume !== null) {
          pcVolume = keywordData.pcVolume;
        } else if (keywordData.monthlyQcCnt !== undefined && keywordData.monthlyQcCnt !== null) {
          // 전체 검색량이 있으면 50%를 PC로 추정
          pcVolume = Math.floor(Number(keywordData.monthlyQcCnt) * 0.5);
        }
        const pcVolumeValue: number = pcVolume !== null ? (typeof pcVolume === 'string' ? parseInt(pcVolume.replace(/[^0-9]/g, ''), 10) || 0 : Number(pcVolume) || 0) : 0;

        // 모바일 검색량 추출
        let mobileVolume: number | string | null = null;
        if (keywordData.monthlyMobileQcCnt !== undefined && keywordData.monthlyMobileQcCnt !== null) {
          mobileVolume = keywordData.monthlyMobileQcCnt;
        } else if (keywordData.mobileQcCnt !== undefined && keywordData.mobileQcCnt !== null) {
          mobileVolume = keywordData.mobileQcCnt;
        } else if (keywordData.mobileSearchVolume !== undefined && keywordData.mobileSearchVolume !== null) {
          mobileVolume = keywordData.mobileSearchVolume;
        } else if (keywordData.mobileVolume !== undefined && keywordData.mobileVolume !== null) {
          mobileVolume = keywordData.mobileVolume;
        } else if (keywordData.monthlyQcCnt !== undefined && keywordData.monthlyQcCnt !== null && pcVolumeValue === 0) {
          // PC 검색량이 없고 전체 검색량만 있으면 50%를 모바일로 추정
          mobileVolume = Math.floor(Number(keywordData.monthlyQcCnt) * 0.5);
        }
        const mobileVolumeValue: number = mobileVolume !== null ? (typeof mobileVolume === 'string' ? parseInt(mobileVolume.replace(/[^0-9]/g, ''), 10) || 0 : Number(mobileVolume) || 0) : 0;

        // 전체 검색량 추출 (다양한 필드명 시도)
        // 네이버 검색광고 API는 다양한 필드명을 사용할 수 있음
        // 주의: plAvgDepth는 검색량이 아니라 "평균 검색 결과 페이지 깊이"이므로 제외
        let totalVolumeField: number | string | null = null;
        if (keywordData.monthlyQcCnt !== undefined && keywordData.monthlyQcCnt !== null) {
          totalVolumeField = keywordData.monthlyQcCnt;
        } else if (keywordData.totalQcCnt !== undefined && keywordData.totalQcCnt !== null) {
          totalVolumeField = keywordData.totalQcCnt;
        } else if (keywordData.totalSearchVolume !== undefined && keywordData.totalSearchVolume !== null) {
          totalVolumeField = keywordData.totalSearchVolume;
        } else if (keywordData.totalVolume !== undefined && keywordData.totalVolume !== null) {
          totalVolumeField = keywordData.totalVolume;
        } else if (keywordData.qcCnt !== undefined && keywordData.qcCnt !== null) {
          totalVolumeField = keywordData.qcCnt;
        } else if (keywordData.searchVolume !== undefined && keywordData.searchVolume !== null) {
          totalVolumeField = keywordData.searchVolume;
        } else if (keywordData.monthlyPcQcCnt !== undefined && keywordData.monthlyMobileQcCnt !== undefined) {
          // PC와 모바일 검색량을 합산 (우선순위 높음)
          totalVolumeField = (Number(keywordData.monthlyPcQcCnt) || 0) + (Number(keywordData.monthlyMobileQcCnt) || 0);
        }

        // 숫자로 변환 (문자열인 경우, 쉼표 제거)
        const finalPcVolume = pcVolumeValue;
        const finalMobileVolume = mobileVolumeValue;
        const finalTotalVolumeField = totalVolumeField !== null ? (typeof totalVolumeField === 'string' ? parseInt(totalVolumeField.replace(/[^0-9]/g, ''), 10) || 0 : Number(totalVolumeField) || 0) : 0;

        // 전체 검색량이 있으면 우선 사용, 없으면 PC + 모바일 합계
        const finalTotalVolume = finalTotalVolumeField > 0 ? finalTotalVolumeField : (finalPcVolume + finalMobileVolume);

        // 디버깅: 검색량 추출 과정 확인
        if (keywords.indexOf(keyword) === 0) {
          console.log(`[NAVER-SEARCHAD] "${keyword}" 검색량 추출:`, {
            pcVolume: finalPcVolume,
            mobileVolume: finalMobileVolume,
            totalVolumeField: finalTotalVolumeField,
            finalTotalVolume: finalTotalVolume,
            rawData: {
              monthlyPcQcCnt: keywordData.monthlyPcQcCnt,
              monthlyMobileQcCnt: keywordData.monthlyMobileQcCnt,
              monthlyQcCnt: keywordData.monthlyQcCnt,
              totalQcCnt: keywordData.totalQcCnt,
              pcQcCnt: keywordData.pcQcCnt,
              mobileQcCnt: keywordData.mobileQcCnt,
              totalSearchVolume: keywordData.totalSearchVolume,
              pcSearchVolume: keywordData.pcSearchVolume,
              mobileSearchVolume: keywordData.mobileSearchVolume
            },
            keywordDataKeys: Object.keys(keywordData || {})
          });
        }

        if (finalTotalVolume > 0) {
          console.log(`[NAVER-SEARCHAD] ✅ "${keyword}": PC=${finalPcVolume}, 모바일=${finalMobileVolume}, 총=${finalTotalVolume}`);
          results.push({
            keyword: extractedKeyword, // HTML 엔티티 디코딩된 키워드 사용
            pcSearchVolume: finalPcVolume,
            mobileSearchVolume: finalMobileVolume,
            totalSearchVolume: finalTotalVolume,
            competition: keywordData.competition || keywordData.competitionLevel,
            monthlyPcQcCnt: finalPcVolume,
            monthlyMobileQcCnt: finalMobileVolume
          });
        } else {
          console.warn(`[NAVER-SEARCHAD] ⚠️ 검색광고 API "${keyword}": 검색량 데이터 없음 (0 반환) - 응답 키워드: ${extractedKeyword}`);
          results.push({
            keyword: extractedKeyword, // HTML 엔티티 디코딩된 키워드 사용
            pcSearchVolume: 0,
            mobileSearchVolume: 0,
            totalSearchVolume: 0
          });
        }
      } else {
        // keywordList가 없거나 비어있을 때
        // 첫 번째 키워드의 경우 상세 로깅
        if (keywords.indexOf(keyword) === 0) {
          console.warn(`[NAVER-SEARCHAD] ⚠️ "${keyword}": keywordList 없음 또는 비어있음`);
          console.log(`[NAVER-SEARCHAD] 응답 전체 데이터:`, JSON.stringify(data, null, 2));
          console.log(`[NAVER-SEARCHAD] 응답 키 목록:`, Object.keys(data || {}));

          // 응답에 hintKeywords 관련 데이터가 있는지 확인
          if (data.hintKeywords) {
            console.log(`[NAVER-SEARCHAD] hintKeywords 발견:`, data.hintKeywords);
          }
          if (data.query) {
            console.log(`[NAVER-SEARCHAD] query 발견:`, data.query);
          }
          if (data.keyword) {
            console.log(`[NAVER-SEARCHAD] keyword 발견:`, data.keyword);
          }
        }

        // keywordList가 빈 배열이면 검색량이 실제로 0인 것
        if (data.keywordList && Array.isArray(data.keywordList) && data.keywordList.length === 0) {
          if (keywords.indexOf(keyword) === 0) {
            console.log(`[NAVER-SEARCHAD] "${keyword}": 검색량 데이터 없음 (빈 배열)`);
          }
        }

        // 검색량이 없어도 0으로 반환 (에러 아님) - 원본 키워드 사용
        results.push({
          keyword: originalKeyword,
          pcSearchVolume: 0,
          mobileSearchVolume: 0,
          totalSearchVolume: 0
        });
      }
      // API 호출 간 딜레이 (Rate Limit 방지) - 429 오류 방지를 위해 딜레이 증가
      // 키워드 간 딜레이를 점진적으로 증가 (Rate Limit 방지)
      const baseDelay = 2000; // 기본 2초
      const keywordIndex = keywords.indexOf(keyword);
      const delay = baseDelay + (keywordIndex * 500); // 첫 번째: 2초, 두 번째: 2.5초, 세 번째: 3초...
      if (keywordIndex < keywords.length - 1) { // 마지막 키워드가 아닐 때만 딜레이
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      // 모든 예외를 잡아서 0 반환 (앱이 크래시하지 않도록)
      const errorMessage = error?.message || String(error || '');
      const isFirstKeyword = keywords.indexOf(keyword) === 0;

      if (isFirstKeyword) {
        console.error(`[NAVER-SEARCHAD] "${keyword}" 처리 중 예외 발생:`, {
          message: errorMessage,
          stack: error.stack?.substring(0, 500),
          name: error.name,
          code: error.code,
          cause: error.cause
        });
      } else {
        console.warn(`[NAVER-SEARCHAD] "${keyword}" 처리 중 예외: ${errorMessage}`);
      }

      // 429 에러는 재시도가 이미 시도되었으므로 조용히 처리
      if (errorMessage.includes('429') || errorMessage.includes('Rate Limit') || errorMessage.includes('Too Many Requests')) {
        console.warn(`[NAVER-SEARCHAD] "${keyword}": Rate Limit 에러 - 0 반환`);
      } else if (errorMessage.includes('타임아웃') || errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
        console.warn(`[NAVER-SEARCHAD] "${keyword}": 타임아웃 에러 - 0 반환`);
      } else {
        console.warn(`[NAVER-SEARCHAD] "${keyword}": 예외 발생 - 0 반환 (${errorMessage})`);
      }

      // 원본 키워드 사용하여 결과 반환
      results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
    }
  }
  return results;
}

export interface KeywordSuggestion {
  keyword: string;
  pcSearchVolume: number;
  mobileSearchVolume: number;
  totalSearchVolume: number;
  competition?: string;
  monthlyPcQcCnt?: number;
  monthlyMobileQcCnt?: number;
}

export async function getNaverSearchAdKeywordSuggestions(
  config: NaverSearchAdConfig,
  seedKeyword: string,
  limit: number = 200
): Promise<KeywordSuggestion[]> {
  const accessLicense = config.accessLicense ?? '';
  const secretKey = config.secretKey ?? '';

  if (!accessLicense || !secretKey) {
    throw new Error('네이버 검색광고 API 인증 정보가 필요합니다');
  }

  let customerId = '';
  const providedCustomerId = typeof config.customerId === 'string' ? config.customerId.trim() : '';
  if (providedCustomerId) {
    customerId = providedCustomerId;
  } else if (accessLicense.includes(':')) {
    const parts = accessLicense.split(':');
    customerId = (parts[0] || '').trim();
  } else {
    customerId = accessLicense.substring(0, Math.min(accessLicense.length, 10));
  }

  const method = 'GET';
  const uri = '/keywordstool';
  const timestamp = String(Date.now());

  const params = new URLSearchParams();
  const processedSeed = seedKeyword.replace(/['"]/g, '').replace(/[&<>]/g, '').trim();
  params.append('hintKeywords', processedSeed);
  params.append('showDetail', '1');

  const signature = generateSignature(method, uri, timestamp, secretKey);
  const headers: Record<string, string> = {
    'X-Timestamp': timestamp,
    'X-API-KEY': accessLicense,
    'X-Signature': signature,
    'X-Customer': customerId
  };

  const suggestions: KeywordSuggestion[] = [];
  const seenKeywords = new Set<string>();

  try {
    const response = await fetch(`https://api.searchad.naver.com/keywordstool?${params.toString()}`, {
      method,
      headers
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`네이버 검색광고 API 호출 실패 (${response.status}): ${text.substring(0, 200)}`);
    }

    const data = await response.json();

    const extractKeywordList = (payload: any): any[] => {
      if (!payload || typeof payload !== 'object') return [];
      if (Array.isArray(payload.keywordList)) return payload.keywordList;
      if (Array.isArray(payload.relKeywordList)) return payload.relKeywordList;
      if (payload.result && Array.isArray(payload.result.relKeywordList)) return payload.result.relKeywordList;
      if (payload.result && Array.isArray(payload.result.keywordList)) return payload.result.keywordList;
      if (payload.response && Array.isArray(payload.response.keywordList)) return payload.response.keywordList;
      if (payload.response && Array.isArray(payload.response.relKeywordList)) return payload.response.relKeywordList;
      if (Array.isArray(payload.results)) return payload.results;
      if (payload.keyword && !Array.isArray(payload.keyword)) return [payload];
      return [];
    };

    const keywordList = extractKeywordList(data);

    const decodeHtmlEntities = (str: string): string => {
      if (!str || typeof str !== 'string') return str;
      return str
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
    };

    keywordList.forEach((item: any) => {
      const rawKeyword = item?.relKeyword || item?.keyword || item?.query || item?.hintKeyword || '';
      const cleanedKeyword = decodeHtmlEntities(rawKeyword);
      if (!cleanedKeyword || typeof cleanedKeyword !== 'string') return;
      const normalized = cleanedKeyword.trim();
      const lower = normalized.toLowerCase();
      if (normalized.length < 2 || normalized.length > 35) return;
      if (seenKeywords.has(lower)) return;
      if (normalized.includes('http') || normalized.includes('www')) return;

      seenKeywords.add(lower);
      const pc = Number(item?.monthlyPcQcCnt || item?.monthlyPcSearchVolume || item?.pcSearchVolume || 0);
      const mobile = Number(item?.monthlyMobileQcCnt || item?.monthlyMobileSearchVolume || item?.mobileSearchVolume || 0);
      suggestions.push({
        keyword: normalized,
        pcSearchVolume: pc,
        mobileSearchVolume: mobile,
        totalSearchVolume: pc + mobile,
        competition: item?.compIdx || item?.compete,
        monthlyPcQcCnt: item?.monthlyPcQcCnt,
        monthlyMobileQcCnt: item?.monthlyMobileQcCnt
      });
    });
  } catch (error: any) {
    console.warn('[NAVER-SEARCHAD] 연관 키워드 조회 실패:', error?.message || error);
  }

  suggestions.sort((a, b) => (b.totalSearchVolume || 0) - (a.totalSearchVolume || 0));
  return suggestions.slice(0, limit);
}
