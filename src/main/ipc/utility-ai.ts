// @ts-nocheck
// Utility & AI IPC Handlers
// infinite-keyword-search, export-keywords-to-excel, crawl-news-snippets, fetch-real-related-keywords,
// get-niche-keywords, collect-now, get-system-status, gemini-chat, find-ultimate-niche-keywords
import { ipcMain } from 'electron';
import axios from 'axios';
import { EnvironmentManager } from '../../utils/environment-manager';
import { getNaverKeywordSearchVolumeSeparate } from '../../utils/naver-datalab-api';
import { getNaverSearchAdKeywordSuggestions } from '../../utils/naver-searchad-api';
import { getRelatedKeywords as getRelatedKeywordsFromCache } from '../../utils/related-keyword-cache';
import { crawlNewsSnippets } from '../../utils/keyword-competition/naver-search-crawler';
import { getFreshKeywordsAPI } from '../../utils/mass-collection/fresh-keywords-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { findUltimateNicheKeywords } from '../../utils/ultimate-niche-finder';
import { checkUnlimitedLicense } from './shared';

export function setupUtilityAiHandlers() {

  // 키워드 무한 반복 조회 핸들러 (연관 키워드 일괄 조회)
  ipcMain.handle('infinite-keyword-search', async (event, options: {
    initialKeyword: string;
    maxKeywords: number; // 몇 개의 키워드를 조회할지
  }) => {
    try {
      const { initialKeyword, maxKeywords } = options;

      if (!initialKeyword || initialKeyword.trim().length === 0) {
        throw new Error('시작 키워드를 입력해주세요.');
      }

      // maxKeywords가 0이면 무제한 모드 (에러 발생하지 않음)
      if (maxKeywords && maxKeywords < 0) {
        throw new Error('조회할 키워드 개수는 0 이상이어야 합니다. (0은 무제한)');
      }

      console.log(`[INFINITE-SEARCH] 시작: "${initialKeyword}", 최대 ${maxKeywords}개 연관 키워드 추출 및 조회`);

      const envManager = EnvironmentManager.getInstance();
      // EnvironmentManager의 config 속성 접근
      const env = (envManager as any).config || {
        naverClientId: process.env['NAVER_CLIENT_ID'] || '',
        naverClientSecret: process.env['NAVER_CLIENT_SECRET'] || '',
        naverSearchAdAccessLicense: process.env['NAVER_SEARCH_AD_ACCESS_LICENSE'] || '',
        naverSearchAdSecretKey: process.env['NAVER_SEARCH_AD_SECRET_KEY'] || '',
        naverSearchAdCustomerId: process.env['NAVER_SEARCH_AD_CUSTOMER_ID'] || ''
      };
      const naverClientId = env.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
      const naverClientSecret = env.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';
      const naverSearchAdAccessLicense = env.naverSearchAdAccessLicense || process.env['NAVER_SEARCH_AD_ACCESS_LICENSE'] || '';
      const naverSearchAdSecretKey = env.naverSearchAdSecretKey || process.env['NAVER_SEARCH_AD_SECRET_KEY'] || '';
      const naverSearchAdCustomerId = env.naverSearchAdCustomerId || process.env['NAVER_SEARCH_AD_CUSTOMER_ID'] || '';

      if (!naverClientId || !naverClientSecret) {
        throw new Error('네이버 API 키가 설정되지 않았습니다.');
      }

      // 무제한 모드 확인
      const isUnlimited = maxKeywords === 0 || !maxKeywords;
      const effectiveMaxKeywords = isUnlimited ? 10000 : maxKeywords; // 무제한일 때 합리적인 최대값

      console.log(`[INFINITE-SEARCH] 모드: ${isUnlimited ? '무제한 (계속 추출)' : `${maxKeywords}개 제한`}`);

      // 1단계: 시작 키워드로 연관 키워드 대량 추출 (이미지처럼)
      console.log(`[INFINITE-SEARCH] 1단계: "${initialKeyword}"의 연관 키워드 추출 중...`);

      const allRelatedKeywords: string[] = [];
      const searchAdEnabled = !!(naverSearchAdAccessLicense && naverSearchAdSecretKey);
      const searchAdConfig = searchAdEnabled ? {
        accessLicense: naverSearchAdAccessLicense,
        secretKey: naverSearchAdSecretKey,
        customerId: naverSearchAdCustomerId
      } : null;
      const normalizeKeywordTerm = (value: string): string => {
        if (!value || typeof value !== 'string') return '';
        return value
          .replace(/\s+/g, ' ')
          .replace(/["""<>[\]{}()|]+/g, ' ')
          .replace(/[!?~`^]/g, ' ')
          .replace(/\.+/g, '.')
          .replace(/-+/g, '-')
          .replace(/\s*\.\s*/g, ' ')
          .trim();
      };
      const isKeywordCandidate = (value: string): boolean => {
        if (!value || value.length < 2) return false;
        if (value.length > 40) return false;
        if (value.includes('\n') || value.includes('\r')) return false;
        if (/[!?]/.test(value)) return false;
        if (value.includes('http') || value.includes('www')) return false;
        if (value.includes('더보기') || value.includes('로그인') || value.includes('전체보기')) return false;
        const tokens = value.split(' ');
        if (tokens.length > 5) return false;
        return true;
      };
      const processedForExtraction = new Set<string>();
      let extractionDepth = 0;

      // 시작 키워드를 포함하여 연관 키워드 추출
      const extractRelatedKeywords = async (keyword: string, depth: number = 0, maxDepth: number = 3) => {
        // 무제한이 아닐 때만 개수 체크
        if (!isUnlimited && allRelatedKeywords.length >= effectiveMaxKeywords) {
          console.log(`[INFINITE-SEARCH] 목표 개수(${maxKeywords})에 도달했습니다.`);
          return;
        }

        if (depth > maxDepth) {
          console.log(`[INFINITE-SEARCH] 최대 깊이(${maxDepth})에 도달했습니다.`);
          return;
        }
        if (processedForExtraction.has(keyword)) return;

        processedForExtraction.add(keyword);

        try {
          // 네이버 검색 API로 연관 키워드 추출
          const blogApiUrl = 'https://openapi.naver.com/v1/search/blog.json';
          const params = new URLSearchParams({
            query: keyword,
            display: '100', // 최대 100개 결과
            sort: 'sim'
          });

          const response = await fetch(`${blogApiUrl}?${params}`, {
            method: 'GET',
            headers: {
              'X-Naver-Client-Id': naverClientId,
              'X-Naver-Client-Secret': naverClientSecret
            }
          });

          if (response.ok) {
            const data = await response.json();
            const items = data.items || [];

            // 제목과 설명에서 연관 키워드 추출
            const extractedKeywords = new Set<string>();
            let titlesWithKeyword = 0;

            items.forEach((item: any) => {
              const title = item.title?.replace(/<[^>]*>/g, '').trim() || '';
              const description = item.description?.replace(/<[^>]*>/g, '').trim() || '';

              if (title.includes(keyword)) {
                titlesWithKeyword++;
                // 제목을 단어 단위로 분리
                const words = title.split(/[\s|,，、·\[\]()【】「」<>]+/).filter((w: string) => w.trim().length > 0);
                const keywordIndexes: number[] = [];
                words.forEach((word: string, idx: number) => {
                  if (word.includes(keyword)) {
                    keywordIndexes.push(idx);
                  }
                });

                // 키워드 주변 단어들로 구문 생성
                keywordIndexes.forEach(keywordIdx => {
                  // 키워드 앞 단어들 (최대 2개)
                  for (let offset = 1; offset <= 2 && keywordIdx - offset >= 0; offset++) {
                    const phrase = words.slice(keywordIdx - offset, keywordIdx + 1).join(' ').trim();
                    if (phrase.length >= keyword.length && phrase.length <= 30 && phrase.includes(keyword)) {
                      extractedKeywords.add(phrase);
                    }
                  }

                  // 키워드 뒤 단어들 (최대 4개) - "박지선 사망", "박지선 어머니" 같은 패턴
                  for (let offset = 1; offset <= 4 && keywordIdx + offset < words.length; offset++) {
                    const phrase = words.slice(keywordIdx, keywordIdx + offset + 1).join(' ').trim();
                    if (phrase.length >= keyword.length && phrase.length <= 35) {
                      if (!extractedKeywords.has(phrase)) {
                        extractedKeywords.add(phrase);
                      }
                    }
                  }

                  // 키워드 앞뒤 단어들 (앞 1-2개 + 뒤 1-2개)
                  for (let before = 1; before <= 2 && keywordIdx - before >= 0; before++) {
                    for (let after = 1; after <= 2 && keywordIdx + after < words.length; after++) {
                      const phrase = words.slice(keywordIdx - before, keywordIdx + after + 1).join(' ').trim();
                      if (phrase.length >= keyword.length && phrase.length <= 40) {
                        extractedKeywords.add(phrase);
                      }
                    }
                  }
                });

                // 짧은 제목 전체도 추가
                if (title.length >= keyword.length && title.length <= 40 && title.includes(keyword)) {
                  extractedKeywords.add(title);
                }
              }

              // 설명에서도 키워드 추출
              if (description.includes(keyword)) {
                const descWords = description.split(/[\s|,，、·\[\]()【】「」<>]+/).filter((w: string) => w.trim().length > 0);
                const descKeywordIdx = descWords.findIndex((w: string) => w.includes(keyword));
                if (descKeywordIdx >= 0 && descKeywordIdx < descWords.length - 1) {
                  for (let offset = 1; offset <= 2 && descKeywordIdx + offset < descWords.length; offset++) {
                    const phrase = descWords.slice(descKeywordIdx, descKeywordIdx + offset + 1).join(' ').trim();
                    if (phrase.length >= keyword.length && phrase.length <= 30) {
                      extractedKeywords.add(phrase);
                    }
                  }
                }
              }
            });

            // 추출된 키워드를 리스트에 추가 (중복 방지)
            const newKeywordsCount = allRelatedKeywords.length;
            const phrasesExtracted = extractedKeywords.size; // 총 추출된 구문 수
            Array.from(extractedKeywords).forEach(kw => {
              const trimmed = kw.trim();
              if (trimmed && trimmed.length > 0 && !allRelatedKeywords.includes(trimmed) && trimmed !== keyword) {
                allRelatedKeywords.push(trimmed);
              }
            });

            const addedCount = allRelatedKeywords.length - newKeywordsCount;
            console.log(`[INFINITE-SEARCH] "${keyword}": 제목 ${titlesWithKeyword}개에서 ${phrasesExtracted}개 구문 추출, ${addedCount}개 새 키워드 추가`);

            // API 호출 제한 고려
            await new Promise(resolve => setTimeout(resolve, 200));

            // 재귀적으로 일부 연관 키워드도 추출 (무제한 모드에서는 더 많이 추출)
            const maxRecursiveKeywords = isUnlimited ? 10 : 3;
            if (depth < maxDepth) {
              if (isUnlimited || allRelatedKeywords.length < effectiveMaxKeywords * 0.8) {
                const topRelated = Array.from(extractedKeywords)
                  .filter(kw => kw.trim().length > 0 && kw !== keyword)
                  .slice(0, maxRecursiveKeywords);

                for (const relKw of topRelated) {
                  if (!isUnlimited && allRelatedKeywords.length >= effectiveMaxKeywords) break;
                  await extractRelatedKeywords(relKw.trim(), depth + 1, maxDepth);
                }
              }
            }
          } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`[INFINITE-SEARCH] "${keyword}" API 호출 실패:`, response.status, errorText.substring(0, 200));
            if (response.status === 401) {
              throw new Error('네이버 API 인증 실패. API 키를 확인해주세요.');
            }
          }
        } catch (err: any) {
          console.error(`[INFINITE-SEARCH] "${keyword}" 연관 키워드 추출 실패:`, err.message);
          console.error(`[INFINITE-SEARCH] 에러 상세:`, {
            message: err.message,
            stack: err.stack,
            name: err.name
          });
        }
      };

      // 시작 키워드로 연관 키워드 추출
      await extractRelatedKeywords(initialKeyword.trim());

      // 시작 키워드도 리스트 맨 앞에 추가
      if (!allRelatedKeywords.includes(initialKeyword.trim())) {
        allRelatedKeywords.unshift(initialKeyword.trim());
      }

      // 중복 제거 및 정제
      let uniqueKeywords = Array.from(new Set(allRelatedKeywords))
        .map(normalizeKeywordTerm)
        .filter(isKeywordCandidate);

      const uniqueKeywordSet = new Set(uniqueKeywords.map(k => k.toLowerCase()));
      const normalizedSeed = normalizeKeywordTerm(initialKeyword.trim());
      if (normalizedSeed && isKeywordCandidate(normalizedSeed) && !uniqueKeywordSet.has(normalizedSeed.toLowerCase())) {
        uniqueKeywords.unshift(normalizedSeed);
        uniqueKeywordSet.add(normalizedSeed.toLowerCase());
      }

      if (searchAdEnabled && searchAdConfig) {
        const suggestionSeeds = [normalizedSeed, ...uniqueKeywords.slice(0, 15)];
        for (const seed of suggestionSeeds) {
          if (!seed) continue;
          if (!isUnlimited && uniqueKeywords.length >= effectiveMaxKeywords) break;
          try {
            const suggestions = await getNaverSearchAdKeywordSuggestions(searchAdConfig, seed, Math.min(300, effectiveMaxKeywords * 2));
            for (const suggestion of suggestions) {
              const normalizedSuggestion = normalizeKeywordTerm(suggestion.keyword);
              if (!normalizedSuggestion || !isKeywordCandidate(normalizedSuggestion)) continue;
              if (uniqueKeywordSet.has(normalizedSuggestion.toLowerCase())) continue;
              uniqueKeywordSet.add(normalizedSuggestion.toLowerCase());
              uniqueKeywords.push(normalizedSuggestion);
              if (!isUnlimited && uniqueKeywords.length >= effectiveMaxKeywords) break;
            }
          } catch (error: any) {
            console.warn('[INFINITE-SEARCH] 검색광고 연관 키워드 보강 실패:', error?.message || error);
          }
        }
      }

      const finalKeywords = isUnlimited ? uniqueKeywords : uniqueKeywords.slice(0, maxKeywords);

      console.log(`[INFINITE-SEARCH] 연관 키워드 ${finalKeywords.length}개 추출 완료 (전체 후보: ${uniqueKeywords.length}개)`);
      if (finalKeywords.length > 0) {
        console.log(`[INFINITE-SEARCH] 추출된 키워드 샘플:`, finalKeywords.slice(0, 10));
      } else {
        console.error(`[INFINITE-SEARCH] ⚠️ 추출된 키워드가 없습니다.`);
        console.error(`[INFINITE-SEARCH] 디버깅 정보:`, {
          initialKeyword,
          allRelatedKeywordsLength: allRelatedKeywords.length,
          uniqueKeywordsLength: uniqueKeywords.length,
          maxKeywords,
          isUnlimited
        });
      }

      // 추출된 키워드가 없으면 에러
      if (finalKeywords.length === 0) {
        throw new Error(`"${initialKeyword}"에 대한 연관 키워드를 찾을 수 없습니다. 네이버 API 키를 확인하거나 다른 키워드로 시도해보세요.`);
      }

      // 2단계: 각 연관 키워드의 검색량, 문서수, 비율 조회 (병렬 처리)
      console.log(`[INFINITE-SEARCH] 2단계: ${finalKeywords.length}개 키워드의 검색량/문서수 조회 시작...`);

      const results: Array<{
        keyword: string;
        pcSearchVolume: number | null;
        mobileSearchVolume: number | null;
        totalSearchVolume: number | null;
        documentCount: number | null;
        competitionRatio: number | null; // 문서수 / 월간총검색량 (비율)
      }> = [];

      // 병렬 처리 함수
      const processKeyword = async (keyword: string): Promise<{
        keyword: string;
        pcSearchVolume: number | null;
        mobileSearchVolume: number | null;
        totalSearchVolume: number | null;
        documentCount: number | null;
        competitionRatio: number | null;
        relatedKeywords: string[]; // 🔥 추가
      } | null> => {
        try {
          // 1. 검색량 조회 & 연관검색어 조회 (병렬 시작)
          const volumePromise = getNaverKeywordSearchVolumeSeparate({
            clientId: naverClientId,
            clientSecret: naverClientSecret
          }, [keyword]);

          const relatedPromise = getRelatedKeywordsFromCache(keyword);

          const volumeData = await volumePromise;

          let pcVolume: number | null = null;
          let mobileVolume: number | null = null;
          let totalVolume: number | null = null;

          if (volumeData && volumeData.length > 0 && volumeData[0]) {
            pcVolume = volumeData[0].pcSearchVolume ?? null;
            mobileVolume = volumeData[0].mobileSearchVolume ?? null;
            totalVolume = (pcVolume !== null || mobileVolume !== null)
              ? ((pcVolume ?? 0) + (mobileVolume ?? 0))
              : null;
          }

          // 2. 문서수 조회
          let documentCount: number | null = null;
          try {
            const blogApiUrl = 'https://openapi.naver.com/v1/search/blog.json';
            const docParams = new URLSearchParams({
              query: keyword,
              display: '1'
            });
            const docResponse = await fetch(`${blogApiUrl}?${docParams}`, {
              method: 'GET',
              headers: {
                'X-Naver-Client-Id': naverClientId,
                'X-Naver-Client-Secret': naverClientSecret
              }
            });

            if (docResponse.ok) {
              const docData = await docResponse.json();
              const rawTotal = (docData as any)?.total;
              documentCount = typeof rawTotal === 'number'
                ? rawTotal
                : (typeof rawTotal === 'string' ? parseInt(rawTotal, 10) : null);
            }
          } catch (docErr: any) {
            console.warn(`[INFINITE-SEARCH] "${keyword}" 문서수 조회 실패:`, docErr.message);
          }

          // 3. 비율 계산: 문서수 / 월간총검색량
          const competitionRatio: number | null = (typeof totalVolume === 'number' && totalVolume > 0 && typeof documentCount === 'number')
            ? (documentCount / totalVolume)
            : null;

          // 4. 연관검색어 결과 대기
          const relatedKeywords = await relatedPromise;

          return {
            keyword: keyword,
            pcSearchVolume: pcVolume,
            mobileSearchVolume: mobileVolume,
            totalSearchVolume: totalVolume,
            documentCount: documentCount,
            competitionRatio: typeof competitionRatio === 'number' ? (Math.round(competitionRatio * 10000) / 10000) : null, // 소수점 4자리
            relatedKeywords
          };
        } catch (error: any) {
          console.error(`[INFINITE-SEARCH] "${keyword}" 처리 실패:`, error.message);
          return null;
        }
      };

      // 배치 단위로 병렬 처리 (한 번에 5개씩)
      const batchSize = 5;
      for (let i = 0; i < finalKeywords.length; i += batchSize) {
        const batch = finalKeywords.slice(i, i + batchSize);
        console.log(`[INFINITE-SEARCH] 배치 ${Math.floor(i / batchSize) + 1} 처리 중: ${batch.length}개 키워드`);

        const batchResults = await Promise.allSettled(
          batch.map(keyword => processKeyword(keyword))
        );

        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
            const ratioText = typeof result.value.competitionRatio === 'number' ? result.value.competitionRatio.toFixed(4) : 'null';
            console.log(`[INFINITE-SEARCH] ✅ "${batch[idx]}" 완료: 검색량=${result.value.totalSearchVolume}, 문서수=${result.value.documentCount}, 비율=${ratioText}`);
          }
        });

        // API 호출 제한 고려
        if (i + batchSize < finalKeywords.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 무제한 모드에서는 진행 상황만 표시하고 계속 진행
        if (isUnlimited && (i + batchSize) % 50 === 0) {
          console.log(`[INFINITE-SEARCH] 무제한 모드 진행 중: ${results.length}개 완료, ${finalKeywords.length - i - batchSize}개 남음`);
        }
      }

      // 총 조회수(검색량) 순으로 정렬
      results.sort((a, b) => {
        const aVol = typeof a.totalSearchVolume === 'number' ? a.totalSearchVolume : null;
        const bVol = typeof b.totalSearchVolume === 'number' ? b.totalSearchVolume : null;
        if (bVol !== null && aVol === null) return 1;
        if (aVol !== null && bVol === null) return -1;
        if (aVol !== null && bVol !== null && bVol !== aVol) return bVol - aVol;
        return 0;
      });

      console.log(`[INFINITE-SEARCH] 완료: ${results.length}개 키워드 수집 및 조회 완료`);

      return {
        success: true,
        keywords: results,
        count: results.length
      };

    } catch (error: any) {
      console.error('[INFINITE-SEARCH] 키워드 무한 반복 조회 실패:', error);
      return {
        success: false,
        error: error.message || '키워드 조회 중 오류가 발생했습니다.',
        keywords: [],
        count: 0
      };
    }
  });

  // 엑셀 파일 저장 핸들러
  ipcMain.handle('export-keywords-to-excel', async (event, data: {
    keywords: Array<{
      keyword: string;
      pcSearchVolume: number | null;
      mobileSearchVolume: number | null;
      totalSearchVolume: number | null;
      documentCount: number | null;
      competitionRatio: number | null;
    }>;
    filename: string; // 입력한 키워드 (예: "여름휴가")
  }) => {
    try {
      const XLSX = require('xlsx');
      const { dialog } = require('electron');
      const { keywords, filename } = data;

      if (!keywords || keywords.length === 0) {
        throw new Error('저장할 키워드 데이터가 없습니다.');
      }

      // 엑셀 데이터 준비
      const worksheetData = [
        ['키워드', 'PC 검색량', '모바일 검색량', '월간 총 검색량', '문서수', '경쟁률']
      ];

      keywords.forEach(kw => {
        worksheetData.push([
          kw.keyword,
          (kw.pcSearchVolume ?? '').toString(),
          (kw.mobileSearchVolume ?? '').toString(),
          (kw.totalSearchVolume ?? '').toString(),
          (kw.documentCount ?? '').toString(),
          (kw.competitionRatio ?? '').toString()
        ]);
      });

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // 컬럼 너비 설정
      worksheet['!cols'] = [
        { wch: 30 }, // 키워드
        { wch: 12 }, // PC 검색량
        { wch: 15 }, // 모바일 검색량
        { wch: 18 }, // 월간 총 검색량
        { wch: 12 }, // 문서수
        { wch: 12 }  // 경쟁률
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, '키워드 조회 결과');

      // 파일 저장 경로 선택 (기본 파일명: 입력한 키워드.xlsx)
      const defaultFilename = `${filename || 'keywords'}.xlsx`;
      const result = await dialog.showSaveDialog({
        title: '엑셀 파일 저장',
        defaultPath: defaultFilename,
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        return { success: false, message: '저장이 취소되었습니다.' };
      }

      const filePath = result.filePath;
      if (!filePath) {
        throw new Error('파일 경로가 지정되지 않았습니다.');
      }

      // 파일 저장
      XLSX.writeFile(workbook, filePath);

      console.log(`[EXCEL-EXPORT] 파일 저장 완료: ${filePath}`);

      return {
        success: true,
        message: `${keywords.length}개 키워드가 엑셀 파일로 저장되었습니다.`,
        filePath: filePath
      };

    } catch (error: any) {
      console.error('[EXCEL-EXPORT] 엑셀 파일 저장 실패:', error);
      return {
        success: false,
        error: error.message || '엑셀 파일 저장 중 오류가 발생했습니다.',
        filePath: null
      };
    }
  });

  // 🔥 100점짜리 뉴스 스니펫 크롤링 (IPC 핸들러)
  ipcMain.handle('crawl-news-snippets', async (_event, keyword: string) => {
    console.log(`[KEYWORD-MASTER] 뉴스 스니펫 크롤링 요청: "${keyword}" (Puppeteer via Main)`);
    try {
      // Main 프로세스에서 Puppeteer 실행
      const snippets = await crawlNewsSnippets(keyword);
      console.log(`[KEYWORD-MASTER] 스니펫 크롤링 성공: ${snippets.length}개 반환`);
      return snippets;
    } catch (error: any) {
      console.error(`[KEYWORD-MASTER] 스니펫 크롤링 실패:`, error);
      return [];
    }
  });

  // 🔥 100점짜리 연관 검색어 실시간 조회 (IPC 핸들러 - User-Agent 우회)
  ipcMain.handle('fetch-real-related-keywords', async (_event, keyword: string) => {
    console.log(`[KEYWORD-MASTER] 연관 검색어 조회 요청: "${keyword}" (Axios via Main)`);
    try {
      // Main 프로세스에서는 User-Agent 헤더 설정 가능
      const response = await axios.get('https://ac.search.naver.com/nx/ac', {
        params: {
          q: keyword,
          con: 1,
          frm: 'nv',
          ans: 2,
          r_format: 'json',
          r_enc: 'UTF-8'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 3000
      });

      const results: string[] = [];
      if (response.data?.items) {
        for (const itemGroup of response.data.items) {
          if (Array.isArray(itemGroup)) {
            for (const item of itemGroup) {
              if (Array.isArray(item) && item[0]) {
                const kw = String(item[0]).trim();
                if (kw.length >= 2 && kw !== keyword) results.push(kw);
              }
            }
          }
        }
      }
      return [...new Set(results)].slice(0, 10);
    } catch (error: any) {
      console.error(`[KEYWORD-MASTER] 연관 검색어 조회 실패:`, error.message);
      return [];
    }
  });

  // 🚀 원클릭 빈집털이 - 틈새 키워드 추천 (IPC 핸들러)
  ipcMain.handle('get-niche-keywords', async (_event, options: any) => {
    console.log('[KEYWORD-MASTER] 틈새 키워드 발굴 요청 수신');
    try {
      const api = getFreshKeywordsAPI();
      const result = await api.getNicheKeywords(options);
      return result;
    } catch (error: any) {
      console.error('[KEYWORD-MASTER] 틈새 키워드 발굴 실패:', error);
      throw error;
    }
  });

  // 🔄 즉시 수집 실행 (IPC 핸들러)
  ipcMain.handle('collect-now', async () => {
    console.log('[KEYWORD-MASTER] 즉시 수집 요청 수신');
    try {
      const api = getFreshKeywordsAPI();
      await api.collectNow();
      return { success: true };
    } catch (error: any) {
      console.error('[KEYWORD-MASTER] 즉시 수집 실패:', error);
      return { success: false, error: error.message };
    }
  });

  // 📊 시스템 상태 조회 (IPC 핸들러)
  ipcMain.handle('get-system-status', async () => {
    try {
      const api = getFreshKeywordsAPI();
      const status = await api.getSystemStatus();
      return status;
    } catch (error: any) {
      console.error('[KEYWORD-MASTER] 시스템 상태 조회 실패:', error);
      throw error;
    }
  });

  // 🤖 AI 챗봇 - Gemini 대화 (IPC 핸들러)
  ipcMain.handle('gemini-chat', async (_event, args: { apiKey: string; message: string; history: any[]; modelName?: string }) => {
    console.log('[KEYWORD-MASTER] Gemini AI 채팅 요청 수신');
    try {
      const { apiKey, message, history, modelName = 'gemini-2.5-flash' } = args;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const chat = model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 2048,
        },
      });

      const result = await chat.sendMessage(message);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error('[KEYWORD-MASTER] Gemini AI 채팅 실패:', error);
      throw error;
    }
  });

  // 🏆 Ultimate Niche Finder - 끝판왕 핸들러
  ipcMain.handle('find-ultimate-niche-keywords', async (event, options: { seeds?: string[]; maxDepth?: number; targetCount?: number }) => {
    console.log('[KEYWORD-MASTER] 🏆 Ultimate Niche Finder 요청:', options);

    // 진행 상황 전송 헬퍼
    const sendProgress = (message: string) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ultimate-niche-progress', { message });
      }
    };

    try {
      sendProgress('🚀 1단계: Deep Mining 시작 (자동완성 깊이 파기)...');

      const result = await findUltimateNicheKeywords({
        ...options,
        // 진행 상황 콜백은 추후 ultimate-niche-finder에 추가할 수 있음
      });

      if (result.success) {
        sendProgress(`✅ 완료! ${result.keywords.length}개 틈새 키워드 발견`);
      } else {
        sendProgress(`❌ 실패: ${result.error}`);
      }

      return result;
    } catch (error: any) {
      console.error('[KEYWORD-MASTER] Ultimate Niche Finder 오류:', error);
      return { success: false, error: error.message };
    }
  });

}
