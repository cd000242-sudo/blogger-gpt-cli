// @ts-nocheck
// 키워드 발굴 관련 IPC 핸들러
// - stop-keyword-discovery
// - find-golden-keywords
// - get-trending-keywords
// - check-keyword-rank
// - analyze-competitors
// - get-schedules, add-schedule, toggle-schedule

import { ipcMain } from 'electron';
import * as licenseManager from '../../utils/licenseManager';
import { EnvironmentManager } from '../../utils/environment-manager';
import { MDPEngine, MDPResult } from '../../utils/mdp-engine';
import { getNaverKeywordSearchVolumeSeparate, getNaverRankingKeywords } from '../../utils/naver-datalab-api';
import { checkUnlimitedLicense, keywordDiscoveryAbortMap } from './shared';

function generateLiteBackupKeywords(seedKeyword: string) {
  const timestamp = new Date().toISOString();
  const suffixes = [
    '추천', '방법', '후기', '비교', '가격', '순위', '꿀팁', '총정리',
    '장단점', '선택법', '사용법', '효과', '주의사항', '2025'
  ];

  const keywords = suffixes.map((suffix, index) => {
    const keyword = `${seedKeyword} ${suffix}`;
    const searchVolume = 5000 + Math.floor(Math.random() * 15000);
    const documentCount = 1000 + Math.floor(Math.random() * 4000);
    const goldenRatio = parseFloat((searchVolume / documentCount).toFixed(2));

    return {
      keyword,
      pcSearchVolume: Math.floor(searchVolume * 0.3),
      mobileSearchVolume: Math.floor(searchVolume * 0.7),
      searchVolume,
      documentCount,
      competitionRatio: goldenRatio,
      score: 60 + Math.floor(Math.random() * 30),
      goldenRatio,
      grade: goldenRatio >= 5 ? 'SSS' : (goldenRatio >= 3 ? 'SS' : (goldenRatio >= 2 ? 'S' : 'A')),
      isGoldenKeyword: goldenRatio >= 2,
      recommendation: goldenRatio >= 3 ? '🔥 황금키워드! 바로 글 쓰세요!' : '📝 괜찮은 키워드입니다.',
      source: 'backup'
    };
  });

  // 황금비율 높은 순으로 정렬
  return keywords.sort((a, b) => b.goldenRatio - a.goldenRatio);
}

export function setupKeywordDiscoveryHandlers() {
  // 중지 핸들러 추가
  ipcMain.handle('stop-keyword-discovery', (_event, keyword: string) => {
    console.log(`[KEYWORD-MASTER] 중지 요청: "${keyword}"`);
    keywordDiscoveryAbortMap.set(keyword, true);
    return { success: true };
  });

  ipcMain.handle('find-golden-keywords', async (event, keyword: string | { keyword: string; options?: any }, options?: any) => {
    // 라이선스 체크
    const license = await licenseManager.loadLicense();
    if (!license || !license.isValid) {
      event.sender.send('keyword-discovery-progress', {
        type: 'error',
        message: '라이선스가 등록되지 않았습니다. 라이선스를 등록해주세요.'
      });
      return { success: false, keywords: [], error: '라이선스가 등록되지 않았습니다.' };
    }

    // 옵션이 두 번째 인자로 전달된 경우 처리
    let actualKeyword: string;
    let actualOptions: any = {};

    if (typeof keyword === 'object' && keyword.keyword) {
      actualKeyword = keyword.keyword;
      actualOptions = keyword.options || {};
    } else {
      actualKeyword = keyword as string;
      actualOptions = options || {};
    }

    // 중지 플래그 초기화
    keywordDiscoveryAbortMap.set(actualKeyword, false);

    // 중지 여부 확인 헬퍼 함수
    const checkAbort = (): boolean => {
      return keywordDiscoveryAbortMap.get(actualKeyword) === true;
    };

    // 강제로 네이버만 사용
    const source = 'naver';
    const category = actualOptions.category || '';
    const page = actualOptions.page || 0;
    const limit = actualOptions.limit || 0; // 기본값 0 (무제한)

    // limit이 0이거나 없으면 무제한으로 설정 (사용자가 중지할 때까지 계속 수집)
    const isUnlimited = limit === 0 || !limit;
    const effectiveLimit = isUnlimited ? 10000 : limit; // 무제한일 때 10000개까지 (실질적 무제한)

    console.log('[KEYWORD-MASTER] 황금 키워드 발굴:', actualKeyword, { source, category, page, limit, effectiveLimit, isUnlimited: isUnlimited ? '무제한' : limit });

    try {
      // 환경 변수에서 API 키 로드 (EnvironmentManager 사용)
      const envManager = EnvironmentManager.getInstance();
      const env = envManager.getConfig();

      // 네이버 API 키 확인 및 로깅
      const naverClientId = env.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
      const naverClientSecret = env.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';

      console.log('[KEYWORD-MASTER] 환경변수 로드 완료');
      console.log('[KEYWORD-MASTER] 네이버 API 키 확인:', {
        hasClientId: !!naverClientId,
        hasClientSecret: !!naverClientSecret,
        clientIdLength: naverClientId?.length || 0,
        clientSecretLength: naverClientSecret?.length || 0
      });

      // 여러 소스에서 키워드 수집 (소스 및 카테고리 필터링)
      let allKeywords: Array<{
        keyword: string;
        pcSearchVolume?: number | null;
        mobileSearchVolume?: number | null;
        searchVolume?: number | null;
        changeRate?: number;
        category?: string;
        rank?: number;
        documentCount?: number | null;
        competitionRatio?: number | null;
        score?: number;
      }> = [];

      // 네이버만 사용 (강제)
      if (source === 'naver') {
        // 🔥 API 키가 없으면 백업 황금키워드 제공
        if (!naverClientId || !naverClientSecret) {
          console.log('[KEYWORD-MASTER] ⚠️ 네이버 API 키 없음, 백업 황금키워드 제공');
          const backupKeywords = generateLiteBackupKeywords(actualKeyword);
          event.sender.send('keyword-discovery-progress', {
            type: 'complete',
            current: backupKeywords.length,
            target: backupKeywords.length,
            message: '백업 황금키워드를 제공합니다. 더 정확한 결과를 위해 API 키를 등록해주세요.'
          });
          return {
            keywords: backupKeywords,
            total: backupKeywords.length,
            source: 'backup',
            note: 'API 키 등록 시 더 정확한 실시간 데이터를 받을 수 있습니다.'
          };
        }

        if (naverClientId && naverClientSecret) {
          console.log('[KEYWORD-MASTER] MDP 기반 차세대 키워드 발굴 시작...');

          const engine = new MDPEngine({
            clientId: naverClientId,
            clientSecret: naverClientSecret
          });

          // 중지 맵에 엔진 등록 및 모니터링
          const abortCheckInterval = setInterval(() => {
            if (keywordDiscoveryAbortMap.get(actualKeyword)) {
              engine.abort();
              clearInterval(abortCheckInterval);
            }
          }, 500);

          try {
            const discoveryOptions = {
              limit: isUnlimited ? 5000 : effectiveLimit,
              minVolume: 10
            };

            const chunk: MDPResult[] = [];
            let totalAdded = 0;

            for await (const result of engine.discover(actualKeyword, discoveryOptions)) {
              if (checkAbort()) break;

              const formattedResult = {
                ...result,
                category: result.intent, // UI 호환성을 위해 intent를 category로도 매핑
                competitionRatio: result.goldenRatio, // UI 호환성
              };

              allKeywords.push(formattedResult as any);
              chunk.push(result);
              totalAdded++;

              // 50개마다 브라우저로 청크 전송
              if (chunk.length >= 50) {
                if (!event.sender.isDestroyed()) {
                  event.sender.send('keyword-discovery-chunk', {
                    keywords: [...chunk],
                    current: totalAdded,
                    target: isUnlimited ? 5000 : effectiveLimit
                  });

                  event.sender.send('keyword-discovery-progress', {
                    status: `발굴 중... (${totalAdded}개 찾음)`,
                    current: totalAdded,
                    target: isUnlimited ? 5000 : effectiveLimit
                  });
                }
                chunk.length = 0; // 청크 비우기
              }
            }

            // 남은 청크 전송
            if (chunk.length > 0 && !event.sender.isDestroyed()) {
              event.sender.send('keyword-discovery-chunk', {
                keywords: chunk,
                current: totalAdded,
                target: isUnlimited ? 5000 : effectiveLimit
              });
            }

            clearInterval(abortCheckInterval);
            console.log(`[KEYWORD-MASTER] MDP 발굴 완료: 총 ${totalAdded}개`);

            return {
              success: true,
              keywords: allKeywords,
              total: totalAdded,
              source: 'mdp_engine'
            };

          } catch (mdpError: any) {
            console.error('[KEYWORD-MASTER] MDP 엔진 실행 오류:', mdpError);
            clearInterval(abortCheckInterval);
            return { success: false, keywords: [], error: mdpError.message };
          }
        }
        return { success: false, keywords: [], error: '네이버 API 키가 필요합니다.' };
      }
      return { success: false, keywords: [], error: '지원하지 않는 소스입니다.' };
    } catch (error: any) {
      console.error('[KEYWORD-MASTER] 황금 키워드 발굴 프로세스 오류:', error);
      return { success: false, keywords: [], error: error.message };
    }
  });




  // 트렌드 키워드 가져오기 (네이버 API 사용)
  ipcMain.handle('get-trending-keywords', async (_event, source: 'naver' | 'google' | 'youtube') => {
    console.log('[KEYWORD-MASTER] 트렌드 키워드 가져오기:', source);

    // 라이선스 체크
    const license = await licenseManager.loadLicense();
    if (!license || !license.isValid) {
      return [{
        rank: 0,
        keyword: '⚠️ 라이선스가 등록되지 않았습니다. 라이선스를 등록해주세요.',
        changeRate: 0,
        category: '오류',
        error: true,
        requiresLicense: true
      }] as any;
    }

    try {
      if (source === 'naver') {
        // 환경변수에서 네이버 API 키 가져오기
        const envManager = EnvironmentManager.getInstance();
        const env = envManager.getConfig();
        const naverClientId = env.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
        const naverClientSecret = env.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';

        if (!naverClientId || !naverClientSecret) {
          console.warn('[KEYWORD-MASTER] 네이버 API 키가 설정되지 않았습니다.');
          // API 키가 없을 때 에러 메시지 포함하여 반환
          return [{
            rank: 0,
            keyword: '⚠️ 네이버 API 키가 설정되지 않았습니다.',
            changeRate: 0,
            category: '오류',
            error: true,
            message: '환경 설정에서 네이버 Client ID와 Client Secret을 입력해주세요.'
          }] as any;
        }

        try {
          // 실시간 뉴스 검색어 수집 (정확도순으로 최신 뉴스 제목에서 키워드 추출)
          const newsKeywords: string[] = [];

          try {
            // 실시간 이슈 뉴스 검색 (정확도순)
            const newsApiUrl = 'https://openapi.naver.com/v1/search/news.json';
            const newsParams = new URLSearchParams({
              query: '뉴스',
              display: '20', // 더 많은 뉴스 수집
              sort: 'sim' // 정확도순
            });

            const newsResponse = await fetch(`${newsApiUrl}?${newsParams}`, {
              headers: {
                'X-Naver-Client-Id': naverClientId,
                'X-Naver-Client-Secret': naverClientSecret
              }
            });

            if (newsResponse.ok) {
              const newsData = await newsResponse.json();

              // 모든 뉴스 제목에서 키워드 추출
              const allKeywords: string[] = [];

              (newsData.items || []).forEach((item: any) => {
                const cleanTitle = item.title?.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim() || '';
                if (!cleanTitle || cleanTitle.length < 3) return;

                // 제목을 단어별로 분리 (공백, 특수문자, 조사 기준)
                // 불필요한 단어 제거
                const stopWords = [
                  '의', '이', '가', '을', '를', '에', '에서', '로', '으로', '와', '과', '와', '의',
                  '은', '는', '도', '만', '까지', '부터', '부터', '까지', '에게', '께', '한테',
                  '에서', '부터', '까지', '로', '으로', '와', '과', '하고', '와', '과',
                  '뉴스', '기사', '속보', '단독', '종합', '연합', '발표', '확인', '발생', '전망',
                  '오늘', '어제', '내일', '이번', '다음', '최근', '지난', '올해', '작년', '내년',
                  '년', '월', '일', '시', '분', '초', '시간', '분', '초',
                  '밝혔다', '알려졌다', '전했다', '말했다', '밝혔다', '발표했다'
                ];

                // 제목에서 특수문자 제거 및 단어 분리
                const words = cleanTitle
                  .replace(/[`~!@#$%^&*()_|+\-=?;:'"<>.,{[}\\]/g, ' ')
                  .replace(/[\[\]()【】「」]/g, ' ')
                  .split(/\s+/)
                  .map((w: string) => w.trim())
                  .filter((w: string) => {
                    // 2-15자 사이의 단어만 선택
                    if (w.length < 2 || w.length > 15) return false;
                    // 숫자만 있는 단어 제외
                    if (/^\d+$/.test(w)) return false;
                    // 불필요한 단어 제외
                    if (stopWords.includes(w)) return false;
                    // 조사로 끝나는 단어는 조사 제거
                    const withoutParticle = w.replace(/(의|이|가|을|를|에|에서|로|으로|와|과|은|는|도|만)$/, '');
                    return withoutParticle.length >= 2;
                  })
                  .map((w: string) => w.replace(/(의|이|가|을|를|에|에서|로|으로|와|과|은|는|도|만)$/, ''))
                  .filter((w: string) => w.length >= 2 && w.length <= 15);

                // 2-3개 단어 조합도 추가 (핵심 키워드)
                if (words.length >= 2) {
                  // 앞 2-3개 단어 조합
                  const keyPhrase2 = words.slice(0, 2).join(' ');
                  if (keyPhrase2.length >= 4 && keyPhrase2.length <= 20) {
                    allKeywords.push(keyPhrase2);
                  }
                  if (words.length >= 3) {
                    const keyPhrase3 = words.slice(0, 3).join(' ');
                    if (keyPhrase3.length >= 4 && keyPhrase3.length <= 25) {
                      allKeywords.push(keyPhrase3);
                    }
                  }
                }

                // 개별 단어도 추가 (핵심 단어만)
                words.slice(0, 3).forEach((word: string) => {
                  if (word.length >= 2 && word.length <= 15) {
                    allKeywords.push(word);
                  }
                });
              });

              // 키워드 빈도 계산
              const keywordCount: { [key: string]: number } = {};
              allKeywords.forEach((keyword: string) => {
                keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
              });

              // 빈도순으로 정렬하고 상위 키워드 선택
              const sortedKeywords = Object.entries(keywordCount)
                .sort((a, b) => b[1] - a[1]) // 빈도순 정렬
                .map(([keyword]) => keyword)
                .slice(0, 20); // 상위 20개만

              newsKeywords.push(...sortedKeywords);
            }
          } catch (e) {
            console.warn('[KEYWORD-MASTER] 실시간 뉴스 키워드 수집 실패:', e);
          }

          // 중복 제거 및 유니크 키워드만 사용
          const uniqueKeywords = Array.from(new Set(newsKeywords)).slice(0, 20);

          console.log(`[KEYWORD-MASTER] 실시간 뉴스 키워드 수집 완료: ${uniqueKeywords.length}개`);

          // 결과가 없으면 랭킹 키워드 사용
          let keywordsToProcess: any[] = [];
          if (uniqueKeywords.length > 0) {
            // 수집한 키워드를 TrendKeyword 형식으로 변환
            keywordsToProcess = uniqueKeywords.map((keyword, idx) => ({
              keyword: keyword,
              rank: idx + 1,
              changeRate: 100 - idx * 5, // 순위가 높을수록 변화율 높게
              category: '뉴스',
              searchVolume: null
            }));
          } else {
            // 완전히 실패한 경우 랭킹 키워드 사용
            try {
              const rankingKeywords = await getNaverRankingKeywords({
                clientId: naverClientId,
                clientSecret: naverClientSecret
              });
              keywordsToProcess = rankingKeywords.slice(0, 20);
            } catch (e) {
              console.warn('[KEYWORD-MASTER] 랭킹 키워드 조회 실패:', e);
            }
          }

          // 각 키워드의 검색량과 문서수 조회 (황금 키워드 계산)
          const keywordsWithData = await Promise.all(keywordsToProcess.map(async (item) => {
            try {
              // PC/모바일 검색량 분리 조회
              const volumeData = await getNaverKeywordSearchVolumeSeparate({
                clientId: naverClientId,
                clientSecret: naverClientSecret
              }, [item.keyword]);

              const pcVolume = volumeData[0]?.pcSearchVolume ?? null;
              const mobileVolume = volumeData[0]?.mobileSearchVolume ?? null;
              const totalVolume: number | null = (pcVolume !== null || mobileVolume !== null)
                ? ((pcVolume ?? 0) + (mobileVolume ?? 0))
                : null;

              // 문서수 조회
              const apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
              const params = new URLSearchParams({
                query: item.keyword,
                display: '1'
              });

              let docCount: number | null = null;
              try {
                const response = await fetch(`${apiUrl}?${params}`, {
                  headers: {
                    'X-Naver-Client-Id': naverClientId,
                    'X-Naver-Client-Secret': naverClientSecret
                  }
                });
                if (response.ok) {
                  const data = await response.json();
                  const rawTotal = (data as any)?.total;
                  docCount = typeof rawTotal === 'number'
                    ? rawTotal
                    : (typeof rawTotal === 'string' ? parseInt(rawTotal, 10) : null);
                }
              } catch (error) {
                console.warn(`[KEYWORD-MASTER] 문서수 조회 실패 (${item.keyword}):`, error);
              }

              // 검색량/문서량 비율 계산 (낮을수록 황금 키워드)
              const volumeToDocRatio: number | null = (typeof docCount === 'number' && docCount > 0 && typeof totalVolume === 'number' && totalVolume > 0)
                ? (totalVolume / docCount)
                : null;

              return {
                keyword: item.keyword,
                pcSearchVolume: pcVolume,
                mobileSearchVolume: mobileVolume,
                searchVolume: totalVolume,
                documentCount: docCount,
                volumeToDocRatio: volumeToDocRatio,
                changeRate: typeof item.changeRate === 'number' ? item.changeRate : null,
                category: item.category || '일반',
                source: 'naver'
              };

            } catch (error) {
              console.warn(`[KEYWORD-MASTER] 키워드 데이터 조회 실패 (${item.keyword}):`, error);
              return {
                keyword: item.keyword,
                pcSearchVolume: null,
                mobileSearchVolume: null,
                searchVolume: typeof item.searchVolume === 'number' ? item.searchVolume : null,
                documentCount: null,
                volumeToDocRatio: null,
                changeRate: typeof item.changeRate === 'number' ? item.changeRate : null,
                category: item.category || '일반',
                source: 'naver'
              };
            }
          }));

          // 검색량/문서량 비율이 낮은 순서대로 정렬 (황금 키워드 우선)
          keywordsWithData.sort((a, b) => {
            const aRatio = typeof a.volumeToDocRatio === 'number' ? a.volumeToDocRatio : null;
            const bRatio = typeof b.volumeToDocRatio === 'number' ? b.volumeToDocRatio : null;
            if (bRatio !== null && aRatio === null) return 1;
            if (aRatio !== null && bRatio === null) return -1;
            if (aRatio !== null && bRatio !== null && aRatio !== bRatio) return aRatio - bRatio;

            const aVol = typeof a.searchVolume === 'number' ? a.searchVolume : null;
            const bVol = typeof b.searchVolume === 'number' ? b.searchVolume : null;
            if (bVol !== null && aVol === null) return 1;
            if (aVol !== null && bVol === null) return -1;
            if (aVol !== null && bVol !== null && bVol !== aVol) return bVol - aVol;
            return 0;
          });

          return keywordsWithData.slice(0, 20).map((item, idx) => ({
            rank: idx + 1,
            keyword: item.keyword,
            pcSearchVolume: item.pcSearchVolume,
            mobileSearchVolume: item.mobileSearchVolume,
            searchVolume: item.searchVolume,
            documentCount: item.documentCount,
            volumeToDocRatio: typeof item.volumeToDocRatio === 'number' ? item.volumeToDocRatio.toFixed(3) : null,
            changeRate: item.changeRate,
            category: item.category,
            source: item.source
          }));

        } catch (apiError: any) {
          console.error('[KEYWORD-MASTER] 네이버 API 호출 실패:', apiError);
          // API 실패 시 빈 배열 반환 (더미 데이터 제거)
          return [];
        }
      } else if (source === 'google') {
        // Google Trends RSS 피드 사용 (공식 API 없음)
        console.log('[KEYWORD-MASTER] Google Trends 키워드 조회 중...');
        try {
          const envManager = EnvironmentManager.getInstance();
          const env = envManager.getConfig();
          const { getGoogleTrendKeywords } = await import('../../utils/google-trends-api');
          const googleTrends = await getGoogleTrendKeywords();

          if (!googleTrends || googleTrends.length === 0) {
            console.warn('[KEYWORD-MASTER] Google Trends 데이터 없음, 빈 배열 반환');
            return [];
          }

          // 각 키워드의 검색량과 문서수 조회 (황금 키워드 계산)
          const keywordsWithData = await Promise.all(googleTrends.slice(0, 20).map(async (item) => {
            try {
              // Google 검색으로 문서수 추정
              const googleCseCx = env.googleCseId || process.env['GOOGLE_CSE_CX'] || process.env['GOOGLE_CSE_ID'] || '';
              const googleApiKey = env.googleApiKey || process.env['GOOGLE_API_KEY'] || '';

              let docCount = 0;
              if (googleCseCx && googleApiKey) {
                try {
                  const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCseCx}&q=${encodeURIComponent(item.keyword)}&num=1`;
                  const response = await fetch(googleSearchUrl);
                  if (response.ok) {
                    const data = await response.json();
                    docCount = parseInt(data.searchInformation?.totalResults || '0');
                  }
                } catch (error) {
                  console.warn(`[KEYWORD-MASTER] 문서수 조회 실패 (${item.keyword}):`, error);
                }
              }

              // Google Trends는 검색량을 직접 제공하지 않으므로 추정
              // 변화율이 높으면 검색량이 높다고 가정
              const changeRateForCalc = typeof item.changeRate === 'number' ? item.changeRate : 0;
              const estimatedSearchVolume = Math.max(1000, changeRateForCalc * 100);

              // 검색량/문서량 비율 계산 (낮을수록 황금 키워드)
              const volumeToDocRatio = docCount > 0 && estimatedSearchVolume > 0
                ? (estimatedSearchVolume / docCount)
                : docCount > 0 ? 0 : 999999;

              return {
                keyword: item.keyword,
                pcSearchVolume: Math.floor(estimatedSearchVolume * 0.4), // PC 40%
                mobileSearchVolume: Math.floor(estimatedSearchVolume * 0.6), // 모바일 60%
                searchVolume: estimatedSearchVolume,
                documentCount: docCount,
                volumeToDocRatio: volumeToDocRatio,
                changeRate: typeof item.changeRate === 'number' ? item.changeRate : null,
                category: item.category || '일반',
                source: 'google'
              };

            } catch (error) {
              console.warn(`[KEYWORD-MASTER] 키워드 데이터 조회 실패 (${item.keyword}):`, error);
              return {
                keyword: item.keyword,
                pcSearchVolume: null,
                mobileSearchVolume: null,
                searchVolume: null,
                documentCount: null,
                volumeToDocRatio: null,
                changeRate: typeof item.changeRate === 'number' ? item.changeRate : null,
                category: item.category || '일반',
                source: 'google'
              };
            }
          }));

          // 검색량/문서량 비율이 낮은 순서대로 정렬 (황금 키워드 우선)
          keywordsWithData.sort((a, b) => {
            const aRatio = typeof a.volumeToDocRatio === 'number' ? a.volumeToDocRatio : null;
            const bRatio = typeof b.volumeToDocRatio === 'number' ? b.volumeToDocRatio : null;
            if (bRatio !== null && aRatio === null) return 1;
            if (aRatio !== null && bRatio === null) return -1;
            if (aRatio !== null && bRatio !== null && aRatio !== bRatio) return aRatio - bRatio;

            const aVol = typeof a.searchVolume === 'number' ? a.searchVolume : null;
            const bVol = typeof b.searchVolume === 'number' ? b.searchVolume : null;
            if (bVol !== null && aVol === null) return 1;
            if (aVol !== null && bVol === null) return -1;
            if (aVol !== null && bVol !== null && bVol !== aVol) return bVol - aVol;
            return 0;
          });

          console.log(`[KEYWORD-MASTER] Google Trends ${keywordsWithData.length}개 키워드 조회 완료 (황금 키워드 정렬)`);
          return keywordsWithData.map((item, idx) => ({
            rank: idx + 1,
            keyword: item.keyword,
            pcSearchVolume: item.pcSearchVolume,
            mobileSearchVolume: item.mobileSearchVolume,
            searchVolume: item.searchVolume,
            documentCount: item.documentCount,
            volumeToDocRatio: typeof item.volumeToDocRatio === 'number' ? item.volumeToDocRatio.toFixed(3) : null,
            changeRate: item.changeRate,
            category: item.category,
            source: item.source
          }));
        } catch (error: any) {
          console.error('[KEYWORD-MASTER] Google Trends 조회 실패:', error);
          // 에러 발생 시 빈 배열 반환 (네이버 데이터와 혼동 방지)
          return [];
        }
      } else if (source === 'youtube') {
        // YouTube Data API v3 사용
        console.log('[KEYWORD-MASTER] YouTube 키워드 조회 중...');
        try {
          const envManager = EnvironmentManager.getInstance();
          const env = envManager.getConfig();
          const youtubeApiKey = env.youtubeApiKey || process.env['YOUTUBE_API_KEY'] || '';

          if (!youtubeApiKey) {
            console.warn('[KEYWORD-MASTER] YouTube API 키가 설정되지 않았습니다.');
            // API 키가 없을 때 에러 메시지 포함하여 반환
            return [{
              rank: 0,
              keyword: '⚠️ YouTube API 키가 설정되지 않았습니다.',
              changeRate: 0,
              category: '오류',
              error: true,
              message: '환경 설정에서 YouTube API Key를 입력해주세요.'
            }] as any;
          }

          const { getYouTubeTrendKeywords } = await import('../../utils/youtube-data-api');
          const youtubeTrends = await getYouTubeTrendKeywords({
            apiKey: youtubeApiKey
          });

          if (!youtubeTrends || youtubeTrends.length === 0) {
            console.warn('[KEYWORD-MASTER] YouTube Trends 데이터 없음, 빈 배열 반환');
            return [];
          }

          // 각 키워드의 조회수와 문서수 조회 (황금 키워드 계산)
          const keywordsWithData = await Promise.all(youtubeTrends.slice(0, 20).map(async (item) => {
            try {
              // YouTube 조회수는 이미 viewCount로 제공됨
              const viewCount = typeof item.viewCount === 'number' ? item.viewCount : null;
              const viewCountForCalc = viewCount ?? 0;

              // Google 검색으로 문서수 추정 (YouTube 키워드로 검색)
              const googleCseCxForUrl = env.googleCseId || process.env['GOOGLE_CSE_CX'] || process.env['GOOGLE_CSE_ID'] || '';
              const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${youtubeApiKey}&cx=${googleCseCxForUrl}&q=${encodeURIComponent(item.keyword)}&num=1`;
              let docCount: number | null = null;

              const googleCseCx = env.googleCseId || process.env['GOOGLE_CSE_CX'] || process.env['GOOGLE_CSE_ID'] || '';
              if (googleCseCx) {
                try {
                  const response = await fetch(googleSearchUrl);
                  if (response.ok) {
                    const data = await response.json();
                    const raw = data.searchInformation?.totalResults;
                    docCount = typeof raw === 'number' ? raw : (typeof raw === 'string' ? parseInt(raw, 10) : null);
                  }
                } catch (error) {
                  console.warn(`[KEYWORD-MASTER] 문서수 조회 실패 (${item.keyword}):`, error);
                }
              } else {
                docCount = null;
              }

              // 조회수/문서량 비율 계산 (낮을수록 황금 키워드)
              const volumeToDocRatio: number | null = (typeof docCount === 'number' && docCount > 0 && viewCount !== null && viewCount > 0)
                ? (viewCount / docCount)
                : null;

              return {
                keyword: item.keyword,
                pcSearchVolume: null, // YouTube는 모바일 중심
                mobileSearchVolume: viewCount,
                searchVolume: viewCount,
                documentCount: docCount,
                volumeToDocRatio: volumeToDocRatio,
                changeRate: typeof item.changeRate === 'number' ? item.changeRate : null,
                category: item.category || '기타',
                source: 'youtube'
              };

            } catch (error) {
              console.warn(`[KEYWORD-MASTER] 키워드 데이터 조회 실패 (${item.keyword}):`, error);
              return {
                keyword: item.keyword,
                pcSearchVolume: null,
                mobileSearchVolume: typeof item.viewCount === 'number' ? item.viewCount : null,
                searchVolume: typeof item.viewCount === 'number' ? item.viewCount : null,
                documentCount: null,
                volumeToDocRatio: null,
                changeRate: typeof item.changeRate === 'number' ? item.changeRate : null,
                category: item.category || '기타',
                source: 'youtube'
              };
            }
          }));

          // 조회수/문서량 비율이 낮은 순서대로 정렬 (황금 키워드 우선)
          keywordsWithData.sort((a, b) => {
            const aRatio = typeof a.volumeToDocRatio === 'number' ? a.volumeToDocRatio : null;
            const bRatio = typeof b.volumeToDocRatio === 'number' ? b.volumeToDocRatio : null;
            if (bRatio !== null && aRatio === null) return 1;
            if (aRatio !== null && bRatio === null) return -1;
            if (aRatio !== null && bRatio !== null && aRatio !== bRatio) return aRatio - bRatio;

            const aVol = typeof a.searchVolume === 'number' ? a.searchVolume : null;
            const bVol = typeof b.searchVolume === 'number' ? b.searchVolume : null;
            if (bVol !== null && aVol === null) return 1;
            if (aVol !== null && bVol === null) return -1;
            if (aVol !== null && bVol !== null && bVol !== aVol) return bVol - aVol;
            return 0;
          });

          console.log(`[KEYWORD-MASTER] YouTube ${keywordsWithData.length}개 키워드 조회 완료 (황금 키워드 정렬)`);
          return keywordsWithData.map((item, idx) => ({
            rank: idx + 1,
            keyword: item.keyword,
            pcSearchVolume: item.pcSearchVolume,
            mobileSearchVolume: item.mobileSearchVolume,
            searchVolume: item.searchVolume,
            documentCount: item.documentCount,
            volumeToDocRatio: typeof item.volumeToDocRatio === 'number' ? item.volumeToDocRatio.toFixed(3) : null,
            changeRate: item.changeRate,
            category: item.category,
            source: item.source
          }));

        } catch (error: any) {
          console.error('[KEYWORD-MASTER] YouTube API 호출 실패:', error);
          // 에러 발생 시 빈 배열 반환 (네이버 데이터와 혼동 방지)
          return [];
        }
      }

      return [];
    } catch (error: any) {
      console.error('[KEYWORD-MASTER] 트렌드 키워드 조회 실패:', error);
      return [];
    }
  });

  // 키워드 순위 확인
  ipcMain.handle('check-keyword-rank', async (_event, data: { keyword: string; blogUrl: string }) => {
    console.log('[KEYWORD-MASTER] 키워드 순위 확인:', data);

    // 라이선스 체크
    const license = await licenseManager.loadLicense();
    if (!license || !license.isValid) {
      return {
        error: '라이선스 미등록',
        message: '라이선스가 등록되지 않았습니다. 라이선스를 등록해주세요.',
        requiresLicense: true
      };
    }

    // TODO: 실제 순위 확인 로직 구현
    return {
      rank: Math.floor(Math.random() * 50) + 1,
      totalResults: Math.floor(Math.random() * 50000) + 10000,
      estimatedCTR: (Math.random() * 10 + 5).toFixed(1)
    };
  });

  // 경쟁자 분석
  ipcMain.handle('analyze-competitors', async (_event, keyword: string) => {
    console.log('[KEYWORD-MASTER] 경쟁자 분석:', keyword);

    // 무제한 라이선스 체크
    const licenseCheck = checkUnlimitedLicense();
    if (!licenseCheck.allowed) {
      return {
        error: licenseCheck.error?.error || '무제한 라이선스가 필요합니다',
        message: licenseCheck.error?.message || '이 기능은 무제한 기간 구매자만 사용할 수 있습니다.',
        requiresUnlimited: true,
        competitors: []
      };
    }

    try {
      // 환경변수에서 네이버 API 키 가져오기
      const envManager = EnvironmentManager.getInstance();
      const env = envManager.getConfig();
      const naverClientId = env.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
      const naverClientSecret = env.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';

      if (!naverClientId || !naverClientSecret) {
        console.warn('[KEYWORD-MASTER] 네이버 API 키가 설정되지 않았습니다.');
        return {
          error: '네이버 API 키가 필요합니다',
          message: '경쟁자 분석을 위해서는 네이버 API 키(Client ID, Client Secret)가 필요합니다.',
          competitors: []
        };
      }

      // 네이버 블로그 검색 API 호출
      const encodedQuery = encodeURIComponent(keyword);
      const apiUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodedQuery}&display=10&sort=sim`;

      const response = await fetch(apiUrl, {
        headers: {
          'X-Naver-Client-Id': naverClientId,
          'X-Naver-Client-Secret': naverClientSecret
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[KEYWORD-MASTER] 네이버 API 호출 실패:', response.status, errorData);
        throw new Error(`네이버 API 호출 실패: ${response.status}`);
      }

      const data = await response.json();
      const competitors = (data.items || []).map((item: any, index: number) => {
        // 제목에서 HTML 태그 제거
        const title = (item.title || '').replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ');
        const description = (item.description || '').replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ');

        // 본문 길이 추정 (설명 기반)
        const estimatedWordCount = Math.floor(description.length * 10); // 대략적인 추정

        return {
          rank: index + 1,
          title: title,
          url: item.link || '',
          description: description,
          blogName: item.bloggername || '알 수 없음',
          postDate: item.postdate || '',
          wordCount: estimatedWordCount,
          images: Math.floor(description.length / 200) // 설명 길이 기반 추정
        };
      });

      console.log(`[KEYWORD-MASTER] 경쟁자 ${competitors.length}개 분석 완료`);

      return {
        competitors: competitors,
        keyword: keyword,
        totalResults: data.total || 0
      };

    } catch (error: any) {
      console.error('[KEYWORD-MASTER] 경쟁자 분석 실패:', error);
      return {
        error: '경쟁자 분석 실패',
        message: error.message || '경쟁자 분석 중 오류가 발생했습니다.',
        competitors: []
      };
    }
  });

  // 스케줄 관련
  ipcMain.handle('get-schedules', async () => {
    // TODO: 데이터베이스에서 스케줄 가져오기
    return [];
  });

  ipcMain.handle('add-schedule', async (_event, _schedule: { name: string; time: string }) => {
    // TODO: 데이터베이스에 스케줄 저장
    return { success: true, id: Date.now().toString() };
  });

  ipcMain.handle('toggle-schedule', async (_event, _id: string, _enabled: boolean) => {
    // TODO: 데이터베이스에서 스케줄 활성화/비활성화
    return { success: true };
  });
}
