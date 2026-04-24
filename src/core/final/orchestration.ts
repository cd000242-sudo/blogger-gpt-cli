/**
 * 메인 오케스트레이션 함수
 * generateUltimateMaxModeArticleFinal: 끝판왕 블로그 글 생성 메인 함수
 */

import axios from 'axios';
import { loadEnvFromFile } from '../../env';
import {
  getGeminiApiKey, getPerplexityApiKey, getOpenAIApiKey,
  callPerplexityAPI,
} from '../llm';
import { makeNanoBananaProThumbnail } from '../../thumbnail';
import { dispatchH2ImageGeneration, dispatchThumbnailGeneration } from '../imageDispatcher';
import '../content-modes/register-all'; // 5개 모드 플러그인 자동 등록
import { generateContentFromUrl, generateContentFromUrls } from '../url-content-generator';
import { validateCtaUrl } from '../../cta/validate-cta-url';
import { findRelatedPosts, insertInternalLinks } from '../internal-links';
import { INTERNAL_CONSISTENCY_SECTIONS } from '../max-mode-structure';
import { SHOPPING_CONVERSION_MODE_SECTIONS, PARAPHRASING_PROFESSIONAL_MODE_SECTIONS } from '../max-mode/mode-sections-extended';
import { fetchFactContext, type FactCheckMode } from '../perplexityFactCheck';
import { searchCoupangProducts, createCoupangDeeplink, formatProductsForPrompt, renderCoupangProductBlock } from '../coupang-partners';
import { uploadBase64ToImageHost } from './image-helpers';
import { crawlSingleUrlFast } from './crawlers';
import { callGeminiWithGrounding, callGeminiWithRetry } from './gemini-engine';
import { FinalCrawledPost, FinalTableData, FinalCTAData } from './types';
import {
  generateH1TitleFinal, generateH2TitlesFinal,
  generateAllSectionsFinal, generateFAQFinal, buildFAQHtml,
  generateCTAsFinal, generateSummaryTableFinal, generateHashtagsFinal,
} from './generation';
import { generateCSSFinal, generateTOCFinal } from './html';
import { validateArticleQuality } from './quality-gate';
import { dispatchMode } from './mode-dispatcher';

// 🎯 동시 실행 시 process.env 충돌 방지 세마포어
let engineLock: Promise<void> = Promise.resolve();

export async function generateUltimateMaxModeArticleFinal(
  payload: any,
  env: any,
  onLog?: (s: string) => void
): Promise<{ html: string; title: string; labels: string[]; thumbnail: string }> {

  // 🚧 쇼핑 모드 임시 차단 (점검 중) — UI에서 disabled 처리했지만 IPC/스케줄 경로로도 유입될 수 있으므로 이중 가드
  if (payload?.contentMode === 'shopping') {
    const blockMsg = '🚧 쇼핑/구매유도 모드는 현재 점검 중입니다. 다른 모드(SEO/내부링크/애드센스/페러프레이징)를 선택해 주세요.';
    onLog?.(`[PROGRESS] 0% - ${blockMsg}`);
    throw new Error(blockMsg);
  }

  // 🎯 동시 실행 시 순차 처리 (process.env 보호)
  let releaseLock: () => void;
  const prevLock = engineLock;
  engineLock = new Promise<void>(resolve => { releaseLock = resolve; });
  await prevLock;

  // 🎯 사용자 선택 AI 엔진을 런타임에 반영
  // 🔥 우선순위 수정: provider(드롭다운, 최신 UI)가 primaryGeminiTextModel(라디오, 모달)보다 우선
  const previousTextModel = process.env['PRIMARY_TEXT_MODEL'] || '';
  const providerModelMap: Record<string, string> = {
    openai: 'openai-gpt41',
    claude: 'claude-sonnet',
    perplexity: 'perplexity-sonar',
    gemini: 'gemini-2.5-flash',
  };

  if (payload.provider && providerModelMap[payload.provider]) {
    // 🔥 1순위: 사용자가 포스팅 탭 드롭다운에서 직접 선택한 엔진
    const mapped = providerModelMap[payload.provider];
    // provider와 primaryGeminiTextModel이 일치하면 구체적 모델 사용
    const isConsistent = payload.primaryGeminiTextModel &&
      payload.primaryGeminiTextModel.startsWith(
        payload.provider === 'gemini' ? 'gemini-' :
        payload.provider === 'openai' ? 'openai-' :
        payload.provider === 'claude' ? 'claude-' :
        payload.provider === 'perplexity' ? 'perplexity-' : '__NO_MATCH__'
      );
    const finalModel = isConsistent ? payload.primaryGeminiTextModel : mapped;
    process.env['PRIMARY_TEXT_MODEL'] = finalModel!;
    onLog?.(`[PROGRESS] 0% - 🎯 AI 엔진: ${payload.provider} → ${finalModel}`);
  } else if (payload.primaryGeminiTextModel) {
    // 2순위: provider가 없으면 primaryGeminiTextModel 직접 사용
    process.env['PRIMARY_TEXT_MODEL'] = payload.primaryGeminiTextModel;
    onLog?.(`[PROGRESS] 0% - 🎯 AI 엔진 (모델 직접): ${payload.primaryGeminiTextModel}`);
  }

  // 🔥 빠른 모드 설정 (이미지 생성 최소화)
  const fastMode = payload.fastMode === true || payload.skipImages === true;
  const skipImages = payload.skipImages === true;

  // 🔥 이미지 소스 설정 - ImageFX 기본값!
  const rawImageSource = payload.h2ImageSource || payload.h2Images?.source || '';
  const imageSource = rawImageSource || 'imagefx'; // 기본값: ImageFX

  console.log('[ULTIMATE] 🎯 이미지 소스 설정:');
  console.log('[ULTIMATE]    - payload.h2ImageSource:', payload.h2ImageSource);
  console.log('[ULTIMATE]    - payload.h2Images?.source:', payload.h2Images?.source);
  console.log('[ULTIMATE]    - 최종 imageSource:', imageSource);

  onLog?.(`[PROGRESS] 0% - 🔥 끝판왕 콘텐츠 생성 시작! ${fastMode ? '(빠른 모드)' : ''}`);
  onLog?.(`[PROGRESS] 0% - 🎯 이미지 소스: ${imageSource} (원본: ${payload.h2ImageSource || '없음'})`);
  const startTime = Date.now();

  try {
    const keyword = payload.topic || '';
    const platform = payload.platform || 'wordpress'; // wordpress or blogspot

    // 1. 크롤링 - URL이 있으면 URL 크롤링, 없으면 키워드 크롤링
    const manualUrls: string[] = payload.manualCrawlUrls || [];
    const sourceUrl = payload.sourceUrl || payload.crawlUrl || '';

    // sourceUrl도 manualUrls에 포함
    if (sourceUrl && !manualUrls.includes(sourceUrl)) {
      manualUrls.unshift(sourceUrl);
    }

    // 🛒 쿠팡 URL은 자동으로 제휴 딥링크로 변환 (키가 있을 때만)
    try {
      const coupangUrls = manualUrls.filter(u => /(?:link\.)?coupang\.com/i.test(u));
      if (coupangUrls.length > 0) {
        const envForCoupang = loadEnvFromFile();
        const ak = (payload as any).coupangAccessKey || envForCoupang['coupangAccessKey'] || envForCoupang['COUPANG_ACCESS_KEY'] || '';
        const sk = (payload as any).coupangSecretKey || envForCoupang['coupangSecretKey'] || envForCoupang['COUPANG_SECRET_KEY'] || '';
        if (ak && sk) {
          onLog?.('[PROGRESS] 3% - 🛒 쿠팡 URL → 제휴 딥링크 자동 변환 중...');
          const deeplinks = await createCoupangDeeplink(coupangUrls, ak, sk);
          deeplinks.forEach(dl => {
            const idx = manualUrls.indexOf(dl.originalUrl);
            if (idx !== -1 && dl.shortenUrl) {
              manualUrls[idx] = dl.shortenUrl;
            }
          });
          (payload as any).coupangDeeplinks = deeplinks;
          onLog?.(`[PROGRESS] 4% - ✅ 쿠팡 제휴 딥링크 ${deeplinks.length}개 변환 완료`);
        }
      }
    } catch (dlErr: any) {
      onLog?.(`[PROGRESS] 4% - ⚠️ 쿠팡 딥링크 변환 실패 (원본 URL 사용): ${dlErr.message?.slice(0, 60)}`);
    }

    // 🔥 URL 전용 모드: URL만 있고 키워드가 없거나 URL 기반 생성 요청 시
    // 완전히 새로운 콘텐츠를 AI가 생성 (중복 문서 방지)
    const urlOnlyMode = (manualUrls.length > 0) && (!keyword || keyword.trim() === '' || payload.urlBasedGeneration === true);

    if (urlOnlyMode) {
      onLog?.('[PROGRESS] 2% - 🔗 URL 기반 완전 새로운 콘텐츠 생성 모드');
      onLog?.(`   📋 ${manualUrls.length}개 URL을 참고하여 완전히 새로운 글 작성`);
      onLog?.('   ⚠️ 원본 복사 없이 AI가 100% 새롭게 작성합니다 (중복 문서 방지)');

      try {
        // URL 콘텐츠 생성기 사용
        const firstUrl = manualUrls[0];
        if (!firstUrl) {
          throw new Error('URL이 유효하지 않습니다.');
        }
        const urlResult = manualUrls.length === 1
          ? await generateContentFromUrl(firstUrl, keyword || undefined, onLog)
          : await generateContentFromUrls(manualUrls, keyword || undefined, onLog);

        // 썸네일 생성 — 🎯 사용자 선택 엔진 사용 (dispatcher 경유)
        let thumbnailUrl = '';
        const urlThumbnailSource = payload.thumbnailSource || payload.thumbnailType || payload.thumbnailMode || 'imagefx';
        const urlThumbnailDisabled = urlThumbnailSource === 'none' || urlThumbnailSource === 'skip';
        if (!skipImages && !urlThumbnailDisabled) {
          onLog?.(`[PROGRESS] 92% - 🖼️ 썸네일 생성 중 (${urlThumbnailSource})...`);
          try {
            const thumbResult = await dispatchThumbnailGeneration(
              urlThumbnailSource,
              urlResult.title,
              keyword || urlResult.title,
              (msg) => onLog?.(`   ${msg}`),
            );
            if (thumbResult.ok && thumbResult.dataUrl) {
              thumbnailUrl = thumbResult.dataUrl;
              onLog?.(`   ✅ ${thumbResult.source} 썸네일 완료`);
            } else {
              onLog?.(`   ⚠️ 썸네일 생성 실패: ${thumbResult.error || '알 수 없음'}`);
            }
          } catch (thumbErr: any) {
            onLog?.(`   ⚠️ 썸네일 생성 실패: ${thumbErr.message}`);
          }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        onLog?.(`[PROGRESS] 100% - ✅ URL 기반 콘텐츠 생성 완료! (${duration}초)`);
        onLog?.(`   📝 제목: "${urlResult.title}"`);
        onLog?.(`   📊 H2: ${urlResult.h2Sections.length}개`);
        onLog?.(`   🏷️ 태그: ${urlResult.tags.length}개`);
        onLog?.(`   📄 글자수: ${urlResult.html.length}자`);

        return {
          html: urlResult.html,
          title: urlResult.title,
          labels: urlResult.tags,
          thumbnail: thumbnailUrl,
        };
      } catch (urlGenError: any) {
        onLog?.(`⚠️ URL 기반 생성 실패, 기존 방식으로 전환: ${urlGenError.message}`);
        // 실패 시 기존 방식으로 폴백
      }
    }

    let crawledPosts: FinalCrawledPost[] = [];

    if (manualUrls.length > 0) {
      // 🔗 URL 직접 크롤링 모드 (사용자가 참고 URL 입력한 경우 → 유지!)
      onLog?.('[PROGRESS] 5% - 🔗 URL 직접 크롤링 중...');
      onLog?.(`   📋 ${manualUrls.length}개 URL 크롤링`);

      for (let i = 0; i < manualUrls.length; i++) {
        const url = manualUrls[i];
        if (!url) continue;

        const progress = 5 + Math.floor((i / manualUrls.length) * 10);
        onLog?.(`[PROGRESS] ${progress}% - 🔗 URL ${i + 1}/${manualUrls.length} 크롤링 중...`);

        try {
          const result = await crawlSingleUrlFast(url);
          if (result) {
            crawledPosts.push(result);
            onLog?.(`   ✅ "${result.title.substring(0, 30)}..." 수집 완료`);
          }
        } catch (err: any) {
          onLog?.(`   ⚠️ URL 크롤링 실패: ${err.message}`);
        }
      }
    } else {
      // 🔥 2026 모드: 키워드 기반 → 네이버 API 실제 크롤링 + Grounding 병행
      //   네이버 API 키 있으면 실제 블로그 데이터 수집 → 할루시네이션 원천 차단
      //   네이버 없으면 RSS/CSE 폴백
      onLog?.('[PROGRESS] 5% - 🔎 네이버/Google 실시간 크롤링 시작...');

      try {
        const envKw = loadEnvFromFile();
        const naverClientId = (payload as any).naverClientId || (payload as any).naverCustomerId ||
          envKw['naverClientId'] || envKw['NAVER_CLIENT_ID'] || envKw['naverCustomerId'] || '';
        const naverClientSecret = (payload as any).naverClientSecret || (payload as any).naverSecretKey ||
          envKw['naverClientSecret'] || envKw['NAVER_CLIENT_SECRET'] || envKw['naverSecretKey'] || '';
        const googleCseKey = (payload as any).googleCseKey || envKw['googleCseKey'] || envKw['GOOGLE_CSE_KEY'] || '';
        const googleCseCx = (payload as any).googleCseCx || envKw['googleCseCx'] || envKw['GOOGLE_CSE_CX'] || '';

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ContentCrawler } = require('../content-crawler');
        const crawler = new ContentCrawler();
        const crawlerConfig = {
          topic: keyword,
          keywords: [keyword],
          maxResults: 5,
          naverClientId,
          naverClientSecret,
          googleCseKey,
          googleCseCx,
        };

        let crawledFromAPI: any[] = [];

        // 1순위: 네이버 API (키 있을 때)
        if (naverClientId && naverClientSecret) {
          try {
            onLog?.(`   📘 네이버 블로그 API 검색 중...`);
            crawledFromAPI = await crawler.crawlFromNaverAPI(crawlerConfig);
            onLog?.(`   ✅ 네이버에서 ${crawledFromAPI.length}개 자료 수집`);
          } catch (naverErr: any) {
            onLog?.(`   ⚠️ 네이버 크롤링 실패: ${naverErr.message?.slice(0, 80)}`);
          }
        }

        // 2순위: Google CSE (네이버 결과가 부족할 때)
        if (crawledFromAPI.length < 2 && googleCseKey && googleCseCx) {
          try {
            onLog?.(`   🔍 Google CSE 검색 중...`);
            const cseResults = await crawler.crawlFromCSE(crawlerConfig);
            crawledFromAPI.push(...cseResults);
            onLog?.(`   ✅ CSE에서 ${cseResults.length}개 추가 수집`);
          } catch (cseErr: any) {
            onLog?.(`   ⚠️ CSE 크롤링 실패: ${cseErr.message?.slice(0, 80)}`);
          }
        }

        // 3순위: RSS 폴백 (API 키 없을 때)
        if (crawledFromAPI.length === 0) {
          try {
            onLog?.(`   📡 RSS 폴백 검색 중...`);
            const rssResults = await crawler.crawlFromRSS(crawlerConfig);
            crawledFromAPI.push(...rssResults);
            onLog?.(`   ✅ RSS에서 ${rssResults.length}개 수집`);
          } catch (rssErr: any) {
            onLog?.(`   ⚠️ RSS 실패: ${rssErr.message?.slice(0, 80)}`);
          }
        }

        // CrawledContent → FinalCrawledPost 변환
        if (crawledFromAPI.length > 0) {
          for (const item of crawledFromAPI) {
            crawledPosts.push({
              title: item.title || '',
              url: item.url || '',
              content: item.content || '',
              subheadings: item.subheadings || [],
              source: 'external',
            } as any);
          }
        }
      } catch (crawlErr: any) {
        onLog?.(`⚠️ 크롤링 모듈 오류: ${crawlErr.message?.slice(0, 80)}`);
      }

      if (crawledPosts.length === 0) {
        onLog?.('[PROGRESS] 15% - 🌐 크롤링 결과 없음 → Grounding 폴백');
      } else {
        onLog?.(`[PROGRESS] 15% - ✅ 실시간 크롤링 ${crawledPosts.length}개 → 할루시네이션 차단`);
      }
    }

    // 🌐 크롤링 데이터 유무와 상관없이 진행 (Search Grounding이 보완)
    if (crawledPosts.length === 0) {
      onLog?.('[PROGRESS] 20% - 🌐 검색 기반 생성 모드 (크롤링 데이터 없음 → AI 직접 검색)');
    } else {
      onLog?.(`[PROGRESS] 20% - ✅ ${crawledPosts.length}개 자료 수집 완료 + Search Grounding 병행`);
    }

    const titles = crawledPosts.map(p => p.title);
    const contents = crawledPosts.map(p => p.content);
    const subheadings = crawledPosts.flatMap(p => p.subheadings);

    // 2. H1 생성 — 🔥 키워드 제목 옵션 체크박스 반영
    // 🛡️ 제목 연도 복구기 — "년"이 숫자 없이 제목에 떠 있으면 currentYear를 주입.
    //    단일 negative-lookbehind 패턴으로 다음을 모두 커버:
    //      (a) "년 정부..." (선두 bare 년) → "{year}년 정부..."
    //      (b) "올해 년 달라진..." (중간 bare 년) → "올해 {year}년 달라진..."
    //      (c) "3년차", "20년 만에", "2026년 정부" (숫자-년) → 건드리지 않음
    //      (d) "2026 년 조회" (숫자+공백+년) → "2026 {year}년 조회"가 되지 않도록 공백 앞 숫자도 차단
    const currentYearForTitle = new Date().getFullYear();
    const repairTitleYear = (title: string): string => {
      if (!title) return title;
      // Variable-length lookbehind `(?<!\d\s*)`: `년` 앞으로 임의 공백을 허용한 구간 직전이 숫자면 치환 차단.
      //   - "2026년" (공백 0) → 차단: `(?<!\d\s*)` 매칭 시 \d\s{0} = "6" → 매치 → 부정 lookbehind 실패 → 치환 안 함 ✓
      //   - "2026 년" (공백 1) → 차단: \d\s{1} = "6 " → 매치 → 실패 → 치환 안 함 ✓
      //   - "3년차" / "20년" → 차단 ✓
      //   - "년 정부" (선두) → 치환: 앞에 아무것도 없음 → 부정 lookbehind 성공 → `{year}년 정부` ✓
      //   - "올해 년 달라진" (중간) → 치환: `년` 앞 공백 직전이 `해`(비숫자) → 성공 → 치환 ✓
      return title.replace(/(?<!\d\s*)(\s*)년(?=[\s가-힣A-Za-z0-9])/g,
        (_m, leadingSpace: string) => `${leadingSpace}${currentYearForTitle}년`
      );
    };

    let h1: string;
    if (payload.useKeywordAsTitle) {
      // ✅ 키워드를 제목 그대로 사용
      h1 = keyword;
      onLog?.(`[PROGRESS] 30% - 🎯 키워드를 제목으로 사용: "${h1}"`);
    } else {
      // 🤖 AI 자동 생성
      onLog?.('[PROGRESS] 25% - ✍️ AI가 제목(H1) 생성 중...');
      h1 = await generateH1TitleFinal(keyword, titles);
      h1 = repairTitleYear(h1);

      // 📌 키워드를 제목 맨앞에 배치
      if (payload.keywordFront) {
        // 이미 키워드로 시작하는지 확인 (대소문자 무시)
        const alreadyStarts = h1.toLowerCase().startsWith(keyword.toLowerCase());
        if (!alreadyStarts) {
          // 기존 제목에서 키워드를 제거 (대소문자 무시, 전체 단어 매칭)
          const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          let h1WithoutKeyword = h1
            .replace(new RegExp(escapedKw, 'gi'), '')
            .replace(/\s{2,}/g, ' ')  // 중복 공백 제거
            .replace(/^[\s,·\-:]+/, '')  // 앞쪽 구분자 제거
            .replace(/[\s,·\-:]+$/, '')  // 뒤쪽 구분자 제거
            .trim();
          // 빈 문자열이 되면 원래 제목 사용
          if (h1WithoutKeyword.length < 5) h1WithoutKeyword = h1;
          h1 = `${keyword} ${h1WithoutKeyword}`;
        }
        // 키워드 재조립 후에도 한 번 더 연도 복구 적용
        h1 = repairTitleYear(h1);
        // 50자 초과시 자르기
        if (h1.length > 50) h1 = h1.substring(0, 47) + '...';
        onLog?.(`[PROGRESS] 30% - 📌 키워드 맨앞 배치 제목: "${h1}"`);
      } else {
        onLog?.(`[PROGRESS] 30% - ✅ 제목 완료: "${h1}"`);
      }
    };

    // 🔥 contentMode를 H2 생성 전에 추출 (내부 일관성 모드 지원)
    const contentMode = (payload as any).contentMode || 'external';

    // 3. H2 생성 — 모드 디스패처 우선, 없으면 기존 하드코딩 폴백
    const modeResult = dispatchMode(contentMode, keyword, {
      authorInfo: (payload as any).adsenseAuthorInfo,
    });

    let h2Titles: string[];
    if (modeResult.handledByPlugin && modeResult.h2Titles) {
      // 플러그인에서 H2 제목 제공
      h2Titles = modeResult.h2Titles;
      onLog?.(`[PROGRESS] 40% - ✅ ${contentMode} 모드: ${h2Titles.length}개 섹션 구조 적용`);
    } else if (contentMode === 'adsense') {
      // 폴백: 기존 하드코딩 (플러그인 미등록 시)
      // 🛡️ 애드센스 승인 모드: ADSENSE_ULTIMATE_SECTIONS 7섹션 고정 구조
      onLog?.('[PROGRESS] 35% - 🛡️ 애드센스 승인 모드: E-E-A-T 7섹션 구조 적용 중...');
      try {
        const { ADSENSE_ULTIMATE_SECTIONS } = require('../content-modes/adsense/adsense-sections');
        h2Titles = ADSENSE_ULTIMATE_SECTIONS.map((sec: any) => {
          return sec.title.replace('[주제]', keyword).replace('[실전 경험]', keyword + ' 실전 경험');
        });
        onLog?.(`[PROGRESS] 40% - ✅ 애드센스 7섹션 구조 적용 완료: ${h2Titles.join(', ')}`);
      } catch (e) {
        console.warn('[ULTIMATE] ⚠️ 애드센스 섹션 로드 실패, 기본 7섹션 사용');
        h2Titles = [
          '작성자 소개',
          `${keyword} 완전히 이해하기`,
          `${keyword} 실전 활용 가이드`,
          '단계별 실행 가이드',
          '비교 분석 및 추천',
          '자주 묻는 질문 (FAQ)',
          '마무리 및 추가 리소스'
        ];
        onLog?.(`[PROGRESS] 40% - ✅ 애드센스 기본 7섹션 적용 완료`);
      }
    } else if (contentMode === 'internal') {
      // 📝 내부 일관성 모드: 단일 글 정보 전달 구조
      onLog?.('[PROGRESS] 35% - 📝 내부 일관성 모드: 정보 전달 구조 적용 중...');
      h2Titles = INTERNAL_CONSISTENCY_SECTIONS.map(sec => {
        return sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
      });
      if (!modeResult.sectionPromptBlock) {
        const guides = INTERNAL_CONSISTENCY_SECTIONS.map((sec, idx) => {
          const t = sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
          const reqs = (sec as any).requiredElements?.map((r: string) => `  - ${r}`).join('\n') || '';
          return `[섹션 ${idx + 1}: ${t}] (최소 ${(sec as any).minChars || 600}자)\n역할: ${(sec as any).role || ''}\n핵심: ${(sec as any).contentFocus || ''}\n필수 요소:\n${reqs}`;
        }).join('\n\n');
        modeResult.sectionPromptBlock = `\n\n📋 [내부 일관성 모드 섹션별 상세 지시]\n${guides}`;
      }
      onLog?.(`[PROGRESS] 40% - ✅ 내부 일관성 구조 ${h2Titles.length}개 섹션 적용 완료`);
    } else if (contentMode === 'shopping') {
      // 🛍️ 쇼핑/구매유도 모드: 7단계 구매 퍼널 구조
      onLog?.('[PROGRESS] 35% - 🛍️ 쇼핑 모드: 구매 퍼널 7섹션 구조 적용 중...');
      h2Titles = SHOPPING_CONVERSION_MODE_SECTIONS.map(sec => {
        return sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
      });
      // 섹션별 상세 지시 주입 (requiredElements/role/contentFocus/minChars)
      if (!modeResult.sectionPromptBlock) {
        const guides = SHOPPING_CONVERSION_MODE_SECTIONS.map((sec, idx) => {
          const t = sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
          const reqs = (sec as any).requiredElements?.map((r: string) => `  - ${r}`).join('\n') || '';
          return `[섹션 ${idx + 1}: ${t}] (최소 ${(sec as any).minChars || 1000}자)\n역할: ${(sec as any).role || ''}\n핵심: ${(sec as any).contentFocus || ''}\n필수 요소:\n${reqs}`;
        }).join('\n\n');
        modeResult.sectionPromptBlock = `\n\n📋 [쇼핑 모드 섹션별 상세 지시]\n${guides}`;
      }
      // 🛒 쿠팡 파트너스 API로 실제 상품 데이터 수집 (키가 있으면)
      try {
        const envData = loadEnvFromFile();
        const coupangAccessKey = (payload as any).coupangAccessKey || envData['coupangAccessKey'] || envData['COUPANG_ACCESS_KEY'] || '';
        const coupangSecretKey = (payload as any).coupangSecretKey || envData['coupangSecretKey'] || envData['COUPANG_SECRET_KEY'] || '';
        if (coupangAccessKey && coupangSecretKey) {
          onLog?.('[PROGRESS] 37% - 🛒 쿠팡 파트너스 API: 실제 상품 데이터 조회 중...');
          const products = await searchCoupangProducts(keyword, coupangAccessKey, coupangSecretKey, 10);
          if (products.length > 0) {
            (payload as any).coupangProducts = products;
            // 상품 이미지를 썸네일/H2 이미지 소스로도 사용 가능
            if (!(payload as any).productImages || (payload as any).productImages.length === 0) {
              (payload as any).productImages = products.map(p => p.productImage).filter(Boolean);
            }
            // 섹션 가이드에 실제 상품 데이터 추가
            modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') + formatProductsForPrompt(products);
            onLog?.(`[PROGRESS] 38% - ✅ 쿠팡 상품 ${products.length}개 수집 완료 (할루시네이션 방지)`);
          } else {
            onLog?.('[PROGRESS] 38% - ℹ️ 쿠팡 검색 결과 없음');
          }
        }
      } catch (coupangErr: any) {
        onLog?.(`[PROGRESS] 38% - ⚠️ 쿠팡 API 오류 (계속 진행): ${coupangErr.message?.slice(0, 80)}`);
      }
      // 🛡️ 쿠팡 실제 데이터가 없으면 본문에 가격 숫자 직접 표기 금지 (할루시네이션 방지)
      const hasRealProducts = Array.isArray((payload as any).coupangProducts) && (payload as any).coupangProducts.length > 0;
      if (!hasRealProducts) {
        modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') +
          `\n\n🛡️ **가격 할루시네이션 방지 (실제 상품 데이터 없음)**:\n` +
          `- 본문에 구체적 가격 숫자 직접 표기 절대 금지 ("12,900원", "₩50,000", "월 3만원" 등)\n` +
          `- 가격은 "판매처별 상이", "가격대별 옵션", "예산에 맞게" 같은 추상 표현만 사용\n` +
          `- 할인율, 정가, 세일가 등 임의 수치 생성 금지\n` +
          `- 이유: 검증 불가능한 가격은 발행 시점에 틀려 신뢰도 즉시 붕괴\n`;
      }
      onLog?.(`[PROGRESS] 40% - ✅ 쇼핑 구매 퍼널 ${h2Titles.length}개 섹션 적용 완료`);
    } else if (contentMode === 'paraphrasing') {
      // 🔄 페러프레이징 모드: 6단계 재구성 구조
      onLog?.('[PROGRESS] 35% - 🔄 페러프레이징 모드: 재구성 6섹션 구조 적용 중...');
      h2Titles = PARAPHRASING_PROFESSIONAL_MODE_SECTIONS.map(sec => {
        return sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
      });
      if (!modeResult.sectionPromptBlock) {
        const guides = PARAPHRASING_PROFESSIONAL_MODE_SECTIONS.map((sec, idx) => {
          const t = sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
          const reqs = (sec as any).requiredElements?.map((r: string) => `  - ${r}`).join('\n') || '';
          return `[섹션 ${idx + 1}: ${t}] (최소 ${(sec as any).minChars || 700}자)\n역할: ${(sec as any).role || ''}\n핵심: ${(sec as any).contentFocus || ''}\n필수 요소:\n${reqs}`;
        }).join('\n\n');
        modeResult.sectionPromptBlock = `\n\n📋 [페러프레이징 모드 섹션별 상세 지시]\n${guides}`;
      }
      onLog?.(`[PROGRESS] 40% - ✅ 페러프레이징 ${h2Titles.length}개 섹션 적용 완료`);
    } else {
      // 🤖 일반 모드: AI가 H2 소제목 생성
      onLog?.('[PROGRESS] 35% - 📊 AI가 소제목(H2) 생성 중...');
      const maxH2Count = (typeof payload.sectionCount === 'number' && Number.isFinite(payload.sectionCount) && payload.sectionCount > 0)
        ? Math.floor(payload.sectionCount)
        : undefined;
      h2Titles = await generateH2TitlesFinal(keyword, subheadings, maxH2Count);
      onLog?.(`[PROGRESS] 40% - ✅ 소제목 ${h2Titles.length}개 완료`);
    }

    // 🛒 쇼핑 모드 사이드 이펙트: 수동 URL 우선 → API → 할루시 가드 (3단계)
    // 🔥 API 키 없는 사용자 지원: payload.manualCoupangUrls 로 제휴 딥링크 직접 입력 가능
    //    (쿠팡 파트너스 15만원 매출 조건 충족 전에도 수익화 시작)
    if (contentMode === 'shopping') {
      // ── 1순위: 사용자 수동 입력 URL (API 키 불필요) ──
      const manualUrls: string[] = Array.isArray((payload as any).manualCoupangUrls)
        ? (payload as any).manualCoupangUrls.filter((u: any) => typeof u === 'string' && u.trim().length > 0)
        : [];
      if (manualUrls.length > 0 && !(payload as any).coupangProducts) {
        try {
          onLog?.(`[PROGRESS] 41% - 🛒 쿠팡 수동 URL 크롤링 중... (${manualUrls.length}개)`);
          const { crawlCoupangProductsFromUrls } = await import('../coupang-partners');
          const products = await crawlCoupangProductsFromUrls(manualUrls, (msg) => onLog?.(`   ${msg}`));
          if (products.length > 0) {
            (payload as any).coupangProducts = products;
            if (!(payload as any).productImages || (payload as any).productImages.length === 0) {
              (payload as any).productImages = products.map(p => p.productImage).filter(Boolean);
            }
            modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') + formatProductsForPrompt(products);
            onLog?.(`[PROGRESS] 42% - ✅ 수동 입력 쿠팡 상품 ${products.length}개 준비 완료 (제휴링크 그대로 유지)`);
          } else {
            onLog?.('[PROGRESS] 42% - ⚠️ 수동 URL 크롤링 결과 없음 — 다음 경로 시도');
          }
        } catch (manualErr: any) {
          onLog?.(`[PROGRESS] 42% - ⚠️ 수동 URL 처리 오류: ${manualErr.message?.slice(0, 80)}`);
        }
      }

      // ── 2순위: API 키 있는 경우 자동 검색 ──
      try {
        const envData = loadEnvFromFile();
        const coupangAccessKey = (payload as any).coupangAccessKey || envData['coupangAccessKey'] || envData['COUPANG_ACCESS_KEY'] || '';
        const coupangSecretKey = (payload as any).coupangSecretKey || envData['coupangSecretKey'] || envData['COUPANG_SECRET_KEY'] || '';
        if (coupangAccessKey && coupangSecretKey && !(payload as any).coupangProducts) {
          onLog?.('[PROGRESS] 41% - 🛒 쿠팡 파트너스 API: 실제 상품 데이터 조회 중...');
          const products = await searchCoupangProducts(keyword, coupangAccessKey, coupangSecretKey, 10);
          if (products.length > 0) {
            (payload as any).coupangProducts = products;
            if (!(payload as any).productImages || (payload as any).productImages.length === 0) {
              (payload as any).productImages = products.map(p => p.productImage).filter(Boolean);
            }
            modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') + formatProductsForPrompt(products);
            onLog?.(`[PROGRESS] 42% - ✅ 쿠팡 상품 ${products.length}개 수집 완료 (할루시네이션 방지)`);
          } else {
            onLog?.('[PROGRESS] 42% - ℹ️ 쿠팡 검색 결과 없음');
          }
        }
      } catch (coupangErr: any) {
        onLog?.(`[PROGRESS] 42% - ⚠️ 쿠팡 API 오류 (계속 진행): ${coupangErr.message?.slice(0, 80)}`);
      }

      // ── 3순위: 실제 상품 데이터 없으면 가격 할루시 가드 강제 ──
      const hasRealProducts = Array.isArray((payload as any).coupangProducts) && (payload as any).coupangProducts.length > 0;
      if (!hasRealProducts) {
        modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') +
          `\n\n🛡️ **가격 할루시네이션 방지 (실제 상품 데이터 없음)**:\n` +
          `- 본문에 구체적 가격 숫자 직접 표기 절대 금지 ("12,900원", "₩50,000", "월 3만원" 등)\n` +
          `- 가격은 "판매처별 상이", "가격대별 옵션", "예산에 맞게" 같은 추상 표현만 사용\n` +
          `- 할인율, 정가, 세일가 등 임의 수치 생성 금지\n` +
          `- 이유: 검증 불가능한 가격은 발행 시점에 틀려 신뢰도 즉시 붕괴\n`;
      }
    }

    // 4. 🔥 전체 본문 한 번에 생성 (API 호출 1회로 단축!)
    onLog?.('[PROGRESS] 45% - 📝 AI가 전체 본문 생성 중 (1회 호출)...');

    // 🔍 팩트체크: 글 생성 전 실시간 검색으로 팩트 수집 (할루시네이션 방지)
    const factCheckMode: FactCheckMode = payload.factCheckMode || 'auto';
    let factEnrichedContents = contents;
    if (factCheckMode !== 'off') {
      try {
        const factModeLabel = factCheckMode === 'perplexity' ? 'Perplexity'
          : factCheckMode === 'naver' ? 'Naver'
          : factCheckMode === 'grounding' ? 'Gemini Grounding'
          : '자동 (Naver → Perplexity → Gemini)';
        onLog?.(`[PROGRESS] 46% - 🔍 팩트체크 실행 중 (${factModeLabel})...`);
        const factResult = await fetchFactContext(keyword, factCheckMode);
        if (factResult.success && factResult.context) {
          // 팩트 컨텍스트를 contents 맨 앞에 삽입 → generateAllSectionsFinal의 reference로 활용
          factEnrichedContents = [`[팩트체크 결과 - ${factResult.provider}]\n${factResult.context}`, ...contents];
          onLog?.(`[PROGRESS] 47% - ✅ 팩트체크 완료 (${factResult.provider}, ${factResult.context.length}자)`);
        } else {
          onLog?.('[PROGRESS] 47% - ⚠️ 팩트체크 실패, 기존 방식으로 진행');
        }
      } catch (factErr: any) {
        onLog?.(`[PROGRESS] 47% - ⚠️ 팩트체크 오류: ${factErr.message?.slice(0, 60)}`);
      }
    }

    // 섹션 프롬프트 블록은 "참고 데이터"가 아닌 별도 지시로 전달
    const draftContent = (payload as any).draftContent || '';
    let allSectionsObj = await generateAllSectionsFinal(
      keyword,
      h2Titles,
      factEnrichedContents,
      onLog,
      contentMode,
      draftContent,
      modeResult.sectionPromptBlock || '',
    );

    // 🔄 페러프레이징 모드: 유사도 검증 + 임계값 초과 시 자동 재시도 1회
    if (contentMode === 'paraphrasing' && draftContent) {
      try {
        const { checkParaphrasingSimilarity } = await import('../paraphrasing-validator');
        const computeSimilarity = (obj: any) => {
          const combined = [
            obj.introduction,
            ...obj.sections.flatMap((s: any) => (s.h3Sections || []).map((h: any) => h.content || '')),
            obj.conclusion,
          ].join(' ');
          return checkParaphrasingSimilarity(draftContent, combined, 0.4);
        };

        let report = computeSimilarity(allSectionsObj);
        onLog?.(`[PROGRESS] 68% - 🔄 페러프레이징 1차 검증: ${report.message}`);
        console.log(`[PARAPHRASING] 1차: ${report.message}`);

        if (!report.pass) {
          // 자동 재시도 — 더 강력한 재구성 지시 추가
          onLog?.('[PROGRESS] 69% - 🔄 유사도 초과 → 더 강한 재구성으로 재시도 중...');
          const stricterPromptBlock = (modeResult.sectionPromptBlock || '') +
            `\n\n🚨 **재시도 모드**: 이전 시도가 원문과 유사도 ${(report.similarity * 100).toFixed(0)}%로 너무 비슷했습니다. 이번엔 다음 규칙을 더 강하게 지키세요:\n` +
            `- 원문의 어휘를 직접 사용하지 말고, 모든 명사·형용사·동사를 유의어로 교체\n` +
            `- 문장 구조를 완전히 새로 짜기 (나열식 → 인과식, 시간순 → 중요도순 등)\n` +
            `- 원문에 없던 새로운 데이터/관점/사례를 최소 2개 이상 추가\n` +
            `- 원문이 다루지 않은 다른 측면을 30% 이상 비중으로 다루기\n`;
          allSectionsObj = await generateAllSectionsFinal(
            keyword,
            h2Titles,
            factEnrichedContents,
            onLog,
            contentMode,
            draftContent,
            stricterPromptBlock,
          );
          report = computeSimilarity(allSectionsObj);
          onLog?.(`[PROGRESS] 70% - 🔄 페러프레이징 2차 검증: ${report.message}`);
          console.log(`[PARAPHRASING] 2차: ${report.message}`);
          if (!report.pass) {
            console.warn('[PARAPHRASING] 🚨 2차 시도도 실패 — Scaled Content Abuse 리스크 그대로. 수동 검토 필수.');
            onLog?.('[PROGRESS] 70% - 🚨 페러프레이징 2회 시도 모두 임계값 초과. 수동 검토 권장.');
          }
        }
      } catch (e: any) {
        console.warn(`[PARAPHRASING] 유사도 검증 실패: ${e.message}`);
      }
    }

    const sections = allSectionsObj.sections;
    const introductionHTML = allSectionsObj.introduction;
    const conclusionHTML = allSectionsObj.conclusion;

    // 4.5. 🔥 FAQ 생성 (별도 API 호출 — Schema.org FAQPage 포함)
    const faqs = await generateFAQFinal(keyword, h2Titles, onLog);

    // 5. CTA 생성 (manualCtas 우선, 없으면 자동 생성)
    onLog?.('[PROGRESS] 70% - 💰 CTA 버튼 생성 중...');
    let ctas: FinalCTAData[] = [];

    // 🔥 수동 CTA가 있으면 우선 사용 (애드센스 모드에서는 수동 CTA도 차단)
    if (contentMode !== 'adsense' && payload.manualCtas && Object.keys(payload.manualCtas).length > 0) {
      const { validateCtaUrlFormat } = await import('../../cta/validate-cta-url');
      // 📥 문서 URL이면 빈 텍스트를 다운로드 버튼으로 자동 채움
      const manualDocMatch = (url: string) => {
        const m = url.match(/\.(pdf|ppt|pptx|pps|ppsx|key|hwp|hwpx|xlsx|xls|ods|csv|tsv|zip|rar|7z|docx|doc|odt|rtf|txt|pages|numbers)(\?|#|$)/i);
        if (!m) return null;
        const ext = m[1]!.toLowerCase();
        const label =
          ext === 'pdf' ? 'PDF 자료' :
          /^(ppt|pps|key)/.test(ext) ? '발표자료' :
          /^doc|^odt|^rtf|^txt|pages/.test(ext) ? '문서' :
          /^xls|^ods|csv|tsv|numbers/.test(ext) ? '엑셀 자료' :
          /^hwp/.test(ext) ? '한글파일' :
          /^(zip|rar|7z)/.test(ext) ? '압축파일' :
          '자료';
        return { btn: `📥 ${label} 다운받기`, hook: `${label}를 다운받아 자세히 확인하세요!` };
      };
      Object.entries(payload.manualCtas).forEach(([position, ctaData]: [string, any]) => {
        if (ctaData && ctaData.url) {
          // 🔥 수동 CTA URL 형식 검증 (HTTP 요청 없이 빠른 검증)
          const formatCheck = validateCtaUrlFormat(ctaData.url);
          if (!formatCheck.isValid) {
            console.warn(`[CTA] ⚠️ 수동 CTA URL 형식 오류: ${ctaData.url} (${formatCheck.reason}) — 건너뜀`);
            return; // 이 CTA 건너뛰기
          }
          const docInfo = manualDocMatch(ctaData.url);
          ctas.push({
            hookingMessage: ctaData.hook || (docInfo ? docInfo.hook : '더 자세한 정보가 궁금하시다면?'),
            buttonText: ctaData.text || (docInfo ? docInfo.btn : '자세히 보기'),
            url: ctaData.url,
            position: parseInt(position) || 0
          });
          console.log(`[CTA] ✅ 수동 CTA 사용: ${ctaData.url}${docInfo ? ' (문서 감지 → 다운로드 버튼 자동 적용)' : ''}`);
        }
      });
    }

    // 수동 CTA가 없으면 자동 생성
    if (ctas.length === 0) {
      ctas = await generateCTAsFinal(keyword, crawledPosts, sections, contentMode);
    }

    // CTA 배치
    ctas.forEach(cta => {
      const rawPosition = cta.position ?? 0;
      // 🔥 위치 범위 클램핑 — sections 배열 범위를 벗어나면 마지막 섹션으로 
      const position = Math.min(Math.max(0, rawPosition), sections.length - 1);
      if (rawPosition !== position) {
        console.log(`[CTA] ⚠️ 위치 클램핑: ${rawPosition} → ${position} (sections 범위: 0~${sections.length - 1})`);
      }
      const section = sections[position];
      if (section && section.h3Sections.length > 0) {
        const lastIdx = section.h3Sections.length - 1;
        if (section.h3Sections[lastIdx]) {
          section.h3Sections[lastIdx].cta = cta;
        }
      }
    });

    // 🔥 CTA 배치 실패 시 폴백: 마지막 섹션의 마지막 h3에 첫 번째 CTA 강제 배치
    if (ctas.length > 0) {
      const anyCtaPlaced = sections.some(s => s.h3Sections.some((h3: any) => h3.cta));
      if (!anyCtaPlaced && sections.length > 0) {
        const lastSection = sections[sections.length - 1];
        if (lastSection && lastSection.h3Sections.length > 0) {
          lastSection.h3Sections[lastSection.h3Sections.length - 1]!.cta = ctas[0] as any;
          console.log(`[CTA] 🔧 폴백: 마지막 섹션에 CTA 강제 배치`);
        }
      }
    }

    // 6. 요약표
    const allText = sections.flatMap(s => s.h3Sections.map(h => h.content)).join('\n');
    const summaryTable = await generateSummaryTableFinal(allText);

    // 7. 해시태그
    const hashtags = await generateHashtagsFinal(keyword, h2Titles);

    // 8. HTML 조립
    onLog?.('[PROGRESS] 75% - 🎨 백서(White Paper) 구조 조립 중...');

    // contentMode는 이미 위에서 추출됨 (H2 생성 전에 사용)
    let html = generateCSSFinal(platform, contentMode);

    // 💎 백서(White Paper) 시작 — .bgpt-content 래퍼로 CSS 변수 적용
    html += '<div class="bgpt-content">';
    html += '<div class="gradient-frame" id="premium-white-paper-container">';
    html += '<div class="white-paper">';

    // 워드프레스 테마 등에 의해 h1이 외부에서 출력되는 경우를 위해,
    // 이 스크립트가 생성하는 H1은 확실하게 백서 컨테이너 안쪽에 랜딩 페이지 타이틀처럼 배치합니다.
    html += `\n<h1 class="post-title">${h1}</h1>\n`;

    // 🔥 썸네일 자리 표시
    html += `<!-- THUMBNAIL_PLACEHOLDER -->`;

    // 워드프레스와 블로그스팟 모두 백서 템플릿의 목차 모듈을 사용
    html += `<!-- TOP_SUMMARY_CTA_PLACEHOLDER -->`;
    html += generateTOCFinal(h2Titles);

    // 🖼️ H2 섹션별 이미지 생성 
    const sectionImages: string[] = [];
    const sectionImageSources: string[] = [];

    const selectedH2SectionsRaw: any = payload.h2ImageSections || payload.h2Images?.sections || [];
    const selectedH2Sections: number[] = Array.isArray(selectedH2SectionsRaw)
      ? selectedH2SectionsRaw.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n) && n > 0)
      : [];

    // 🔥 빠른 모드: 이미지 생성 스킵
    if (skipImages) {
      onLog?.('[PROGRESS] 80% - ⚡ 빠른 모드: 이미지 생성 스킵');
      for (let i = 0; i < sections.length; i++) {
        sectionImages.push('');
        sectionImageSources.push('');
      }
    } else {
      onLog?.('[PROGRESS] 75% - 🖼️ 섹션별 이미지 생성 중...');
      onLog?.(`   🎯 선택된 이미지 소스: ${imageSource}`);

      // 🔥 이미지 배치 섹션 선택 — 썸네일은 썸네일, 섹션 이미지는 섹션 이미지로 독립 생성
      //    섹션 1(idx=0)도 포함하여 모든 선택 섹션에 이미지를 실제로 생성/렌더링한다.
      //    🛡️ adsense 모드는 섹션1(author_intro) 이미지 제외 — E-E-A-T 저자 프로필 보호.
      const defaultStart = contentMode === 'adsense' ? 2 : 1;
      const effectiveSelectedH2Sections = selectedH2Sections.length > 0
        ? (contentMode === 'adsense' ? selectedH2Sections.filter(n => n > 1) : selectedH2Sections)
        : Array.from({ length: Math.max(1, sections.length - (defaultStart - 1)) }, (_, i) => i + defaultStart);

      const envData = loadEnvFromFile();
      const pexelsKey = envData['pexelsApiKey'] || envData['PEXELS_API_KEY'] || '';
      const openaiKey = envData['openaiKey'] || envData['OPENAI_API_KEY'] || '';
      const stabilityKey = envData['stabilityApiKey'] || envData['STABILITY_API_KEY'] || '';

      // 🔥 API 키 상태 로그
      console.log('[ULTIMATE] API 키 상태:');
      console.log('   - Stability:', stabilityKey ? `있음 (${stabilityKey.length}자)` : '없음');
      console.log('   - OpenAI:', openaiKey ? `있음 (${openaiKey.length}자)` : '없음');
      console.log('   - Pexels:', pexelsKey ? `있음 (${pexelsKey.length}자)` : '없음');

      // 선택된 H2 섹션 수만큼 이미지 생성 (fastMode 제한 해제)
      const maxImages = sections.length;

      // 🚀 병렬 이미지 생성 — 모든 섹션의 이미지를 동시에 생성 (유료 티어: 충분한 RPM)
      const imageGenStartTime = Date.now();
      let completedCount = 0;
      const totalToGenerate = sections.filter((_, i) => {
        const h2Number = i + 1;
        return i < maxImages && effectiveSelectedH2Sections.includes(h2Number);
      }).length;

      // 이미지 섹션 설정이 실제 섹션 수와 맞지 않으면 경고
      const maxSection = effectiveSelectedH2Sections.length > 0 ? Math.max(...effectiveSelectedH2Sections) : 0;
      if (maxSection > sections.length) {
        onLog?.(`[PROGRESS] 75% - ⚠️ 이미지 섹션 설정(최대 ${maxSection})이 실제 섹션 수(${sections.length})를 초과합니다. 초과분은 무시됩니다.`);
      }
      onLog?.(`[PROGRESS] 75% - 🚀 이미지 ${totalToGenerate}장 병렬 생성 시작...`);

      // 각 섹션별 이미지 생성 함수
      async function generateSingleSectionImage(i: number): Promise<{ dataUrl: string; source: string }> {
        const section = sections[i];
        if (!section) return { dataUrl: '', source: '' };

        const h2Number = i + 1;
        if (!effectiveSelectedH2Sections.includes(h2Number)) return { dataUrl: '', source: '' };
        if (i >= maxImages) return { dataUrl: '', source: '' };

        let imageResult: { ok: boolean; dataUrl?: string; error?: string } = { ok: false };
        let usedSource = '';

        try {
          // 🛒 수집 이미지 모드: 크롤러에서 수집한 이미지를 직접 사용
          if (imageSource === 'crawled' && payload.productImages?.length > 0) {
            // idx=0은 썸네일과 중복이므로 idx+1부터 매칭 (이미지가 부족하면 순환)
            const imgIdx = (i + 1) % payload.productImages.length;
            const crawledUrl = payload.productImages[imgIdx];
            if (crawledUrl) {
              console.log(`[IMG-${i + 1}] 🛒 수집 이미지 직접 사용: ${crawledUrl.substring(0, 50)}...`);
              imageResult = { ok: true, dataUrl: crawledUrl };
              usedSource = '수집 이미지';
            }
          }

          // 🛒→AI 모드: 수집 이미지를 참고하여 AI가 새로 생성
          if (!imageResult.ok && (imageSource === 'crawled-ai-nanobananapro' || imageSource === 'crawled-ai-nanobanana2')) {
            const imgIdx = (i + 1) % (payload.productImages?.length || 1);
            const refImage = payload.productImages?.[imgIdx] || '';
            const enhancedPrompt = refImage
              ? `참고 이미지의 제품을 기반으로, ${section.h2} 주제에 맞는 고품질 블로그 이미지를 생성해주세요. 한국적 감성, 밝은 조명, 프리미엄 배경.`
              : section.h2;

            const nbApiKey = getGeminiApiKey();
            if (nbApiKey && nbApiKey.length > 10) {
              try {
                console.log(`[IMG-${i + 1}] 🛒→AI ${imageSource} 시도 (참고: ${refImage ? '있음' : '없음'})...`);
                const aiResult = await makeNanoBananaProThumbnail(enhancedPrompt, keyword, {
                  apiKey: nbApiKey, aspectRatio: '16:9', isThumbnail: false
                });
                if (aiResult.ok) {
                  imageResult = aiResult;
                  usedSource = imageSource === 'crawled-ai-nanobanana2' ? 'NanoBanana2 (수집 참고)' : 'NanoBanana Pro (수집 참고)';
                }
              } catch (e: any) { console.log(`[IMG-${i + 1}] ⚠️ 수집→AI 실패: ${e.message}`); }
            }
          }

          // 🎯 이미지 디스패치: 사용자 선택 엔진 1순위 → 실패 시 폴백
          if (!imageResult.ok) {
            try {
              console.log(`[IMG-${i + 1}] 🎯 이미지 디스패치 (소스: ${imageSource})...`);
              const dispatchResult = await dispatchH2ImageGeneration(
                imageSource,
                section.h2,
                keyword,
                (msg) => onLog?.(`   [IMG-${i + 1}] ${msg}`),
                contentMode,
              );
              if (dispatchResult.ok) {
                imageResult = { ok: true, dataUrl: dispatchResult.dataUrl };
                usedSource = dispatchResult.source;
              }
            } catch (e: any) {
              console.log(`[IMG-${i + 1}] ⚠️ 이미지 디스패치 실패: ${e.message}`);
            }
          }
        } catch (err) {
          console.log(`[IMG-${i + 1}] ⚠️ 이미지 생성 오류: ${err}`);
        }

        // 병렬 진행률 업데이트
        completedCount++;
        const progress = 76 + Math.round((completedCount / totalToGenerate) * 12);
        if (imageResult.ok && imageResult.dataUrl) {
          onLog?.(`[PROGRESS] ${progress}% - ✅ 섹션 ${i + 1} 이미지 완료 (${usedSource}) [${completedCount}/${totalToGenerate}]`);
          return { dataUrl: imageResult.dataUrl, source: usedSource || 'AI 생성' };
        } else {
          onLog?.(`[PROGRESS] ${progress}% - ⚠️ 섹션 ${i + 1} 이미지 스킵 [${completedCount}/${totalToGenerate}]`);
          return { dataUrl: '', source: '' };
        }
      }

      // 🚀 모든 이미지 동시 생성
      const imagePromises = sections.map((_, i) => generateSingleSectionImage(i));
      const imageResults = await Promise.allSettled(imagePromises);

      // 결과 수집 (순서 보장)
      for (let i = 0; i < sections.length; i++) {
        const result = imageResults[i];
        if (result && result.status === 'fulfilled') {
          sectionImages.push(result.value.dataUrl);
          sectionImageSources.push(result.value.source);
        } else {
          sectionImages.push('');
          sectionImageSources.push('');
        }
      }

      const imageGenElapsed = ((Date.now() - imageGenStartTime) / 1000).toFixed(1);
      const successCount = sectionImages.filter(img => img.length > 0).length;
      const failCount = totalToGenerate - successCount;
      if (failCount > 0) {
        onLog?.(`[PROGRESS] 85% - ⚠️ 이미지 ${successCount}/${totalToGenerate}장 완료, ${failCount}장 실패 (${imageGenElapsed}초)`);
      } else {
        onLog?.(`[PROGRESS] 85% - 🎉 이미지 ${successCount}/${totalToGenerate}장 완료 (${imageGenElapsed}초 — 병렬 처리)`);
      }
    } // 🔥 skipImages else 블록 종료

    // 🚀 Base64 이미지를 병렬로 URL 변환 (이미지 호스팅 업로드)
    const uploadStartTime = Date.now();
    const uploadPromises = sectionImages.map(async (img, idx) => {
      if (!img || !img.startsWith('data:image')) return img || '';
      try {
        const uploadedUrl = await uploadBase64ToImageHost(img, `section-${idx}-${Date.now()}`);
        if (uploadedUrl) {
          console.log(`[IMAGE] ✅ Base64 → 호스팅 업로드 성공 (섹션 ${idx + 1})`);
          return uploadedUrl;
        }
      } catch (e) { /* 무시 */ }
      console.log(`[IMAGE] ⚠️ 호스팅 실패 → Base64 그대로 (섹션 ${idx + 1})`);
      return img;
    });
    const uploadResults = await Promise.allSettled(uploadPromises);
    const processedImageUrls: string[] = uploadResults.map(r =>
      r.status === 'fulfilled' ? r.value : ''
    );
    const uploadElapsed = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
    console.log(`[IMAGE] 🚀 이미지 업로드 완료 (${uploadElapsed}초 — 병렬 처리)`);

    // H2 섹션들 — 💰 Revenue-Max: 카드 없이 플랫 구조
    sections.forEach((section, idx) => {
      // 🔥 H2 제목에서 접두어 제거 (h2:, H2-, 소제목: 등)
      let cleanH2 = (section.h2 || '')
        .replace(/^[hH]2[:\-\s]*/gi, '')
        .replace(/^소제목[:\s]*/gi, '')
        .replace(/^\d+[.\):\s]+/g, '')
        .trim();
      // 🛡️ 빈 제목 폴백 (h2Titles 배열에서 복구)
      if (!cleanH2 && h2Titles[idx]) {
        cleanH2 = h2Titles[idx]!.replace(/^\d+[.\):\s]+/g, '').trim();
      }
      if (!cleanH2) {
        cleanH2 = `섹션 ${idx + 1}`;
      }
      const h2Number = `${idx + 1}.`;

      // 💰 H2 — 인라인 !important는 Blogger 테마 override 방지 필수 (CSS만으로는 부족)
      // 여백(Margin) 최적화: H2 직후 약간의 공백을 두어 자동광고가 붙기 좋게 설계
      html += `\n<h2 id="section-${idx}" style="font-size:26px !important;font-weight:800 !important;color:#111 !important;-webkit-text-fill-color:#111 !important;margin:60px 0 24px !important;padding:0 0 14px 16px !important;border-bottom:2px solid #111 !important;border-left:6px solid #FF6B35 !important;letter-spacing:-0.03em !important;line-height:1.4 !important;word-break:keep-all !important;">${h2Number} ${cleanH2}</h2>\n`;

      // 🖼️ 섹션 이미지 — 플랫, 그림자 없음 (썸네일과 독립적으로 1번 섹션부터 렌더)
      // 🛡️ adsense 모드의 섹션1(author_intro)은 E-E-A-T 저자 프로필 영역이므로 이미지 삽입 제외
      const finalImageUrl = processedImageUrls[idx];
      const skipFirstForAdsense = contentMode === 'adsense' && idx === 0;
      if (finalImageUrl && !skipFirstForAdsense) {
        html += `
<figure class="section-image" style="margin:32px 0 40px !important;">
  <img src="${finalImageUrl}" alt="${cleanH2}" title="${cleanH2}" style="width:100%;height:auto;border-radius:8px;display:block;" loading="lazy" />
  <figcaption style="text-align:center;font-size:13px;color:#999;margin-top:12px;font-style:italic;">${cleanH2}</figcaption>
</figure>
`;
      }

      section.h3Sections.forEach((h3Sec, h3Idx) => {
        const cleanH3 = h3Sec.h3
          .replace(/^[hH]3[:\-\s]*/gi, '')
          .replace(/^소제목[:\s]*/gi, '')
          .replace(/^\d+[.\):\s]+/g, '')
          .trim();
        const h3Number = `${idx + 1}-${h3Idx + 1}.`;

        // 💰 H3 — 볼드, 여백 최적화
        html += `\n<h3 style="font-size:21px !important;font-weight:800 !important;color:#222 !important;-webkit-text-fill-color:#222 !important;margin:44px 0 16px !important;padding:0 !important;letter-spacing:-0.02em !important;line-height:1.5 !important;background:none !important;border:none !important;border-radius:0 !important;box-shadow:none !important;display:block !important;word-break:keep-all !important;">${h3Number} ${cleanH3}</h3>\n`;

        // 💰 본문 — 줄간격 1.8, 단락간 여백 확보로 가독성 극대화
        // <p> 간 간격이 자동으로 커지도록 CSS를 인젝트했지만, 인라인 스타일도 확실히 잡아줌
        const optimizedContent = h3Sec.content.replace(/<p>/g, '<p style="margin-bottom:24px !important; line-height:1.8 !important;">');
        html += `<div class="content" style="margin:0 0 32px !important;padding:0 !important;background:none !important;border:none !important;border-radius:0 !important;box-shadow:none !important;font-size:16px !important;color:#333 !important;">\n${optimizedContent}\n</div>\n`;

        // 표 — 미니멀 뉴스 스타일 + 모바일 반응형 + AdSense 광고 주입 차단
        // 🔥 2026.04 수정:
        //   - min-width:500px 제거 → 모바일에서 강제 스크롤 방지
        //   - class="ad-safe-zone table-wrapper" 추가 → AdSense Auto-Ads가 표 내부에 광고 삽입 방지
        //   - data-ad-region="no-ad" 시그널 추가 → AdSense 크롤러에게 광고 불가 영역임을 명시
        //   - 모바일 CSS는 generateCSSFinal()의 @media 쿼리에서 처리
        if (h3Sec.tables.length > 0) {
          h3Sec.tables.forEach(table => {
            html += `<div class="ad-safe-zone table-wrapper" data-ad-region="no-ad" style="width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:28px 0;position:relative;">`;
            html += `<table class="responsive-table" style="width:100%;border-collapse:collapse;font-size:15px;">`;
            html += `<thead><tr>${table.headers.map(h => `<th class="rt-th" style="background:#f8f9fa;color:#333;font-weight:700;padding:14px 16px;text-align:left;border-bottom:2px solid #ddd;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">${h}</th>`).join('')}</tr></thead>`;
            html += `<tbody>${table.rows.map(row => `<tr>${row.map(cell => {
              const cellStr = String(cell ?? '');
              let formatted = cellStr
                .replace(/\s*([☑✓✔✅☐•◦▶▪※►➤➜✦★●○■□◆◇])\s*/g, '<br>$1 ')
                .replace(/\s+(\d+[.\)]\s)/g, '<br>$1')
                .replace(/\s+([가-힣][.\)]\s)/g, '<br>$1')
                .replace(/\s+([a-zA-Z][.\)]\s)/g, '<br>$1')
                .replace(/\s+([-–—]\s)/g, '<br>$1')
                .replace(/^<br>/, '')
                .trim();
              return `<td class="rt-td" style="padding:14px 16px;border-bottom:1px solid #f0f0f0;color:#444;background:#fff;word-break:break-word;overflow-wrap:break-word;">${formatted}</td>`;
            }).join('')}</tr>`).join('')}</tbody>`;
            html += `</table></div>\n`;
          });
        }
      });

      // 💰 CTA — 박동하는 쿠폰형 Max-Adsense 스타일
      const sectionCta = section.h3Sections.find(h3 => h3.cta)?.cta;
      if (sectionCta) {
        // 🔥 CTA URL 검증
        const encodedKw = encodeURIComponent(keyword);
        const fakeDomains = [
          'example.com', 'your-site.com', 'placeholder.com', 'test.com',
          'yoursite.com', 'yourblog.com', 'myblog.com', 'mysite.com',
          'domain.com', 'website.com', 'sample.com', 'xxx.com',
          'abc.com', 'url.com', 'link.com'
        ];
        const isValidUrl = sectionCta.url &&
          /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(sectionCta.url) &&
          !fakeDomains.some(d => sectionCta.url.toLowerCase().includes(d)) &&
          !sectionCta.url.includes('{{') && !sectionCta.url.includes('}}') &&
          !sectionCta.url.includes('[') && !sectionCta.url.includes(']');

        const ctaUrl = isValidUrl ? sectionCta.url : `https://www.google.com/search?q=${encodedKw}`;
        if (!isValidUrl) {
          console.log(`[MAX-MODE] ⚠️ CTA URL 무효 → 구글 검색으로 대체: ${sectionCta.url}`);
        }

        html += `
<div class="cta-box">
  <p>${sectionCta.hookingMessage}</p>
  <a class="cta-btn" href="${ctaUrl}" target="_blank" rel="nofollow noopener noreferrer">
    ${sectionCta.buttonText}
  </a>
  <span class="cta-microcopy">※ 정확한 내용은 공식 사이트에서 확인해주세요.</span>
</div>
`;
      }

      // 💰 섹션 간 광고 안착 공간 (넉넉한 여백)
      if (idx < sections.length - 1) {
        html += `\n<div style="margin:40px 0 !important;clear:both !important;"></div>\n`;
      }
    });

    // 🔥 FAQ 섹션 삽입 (Schema.org FAQPage 마크업 포함)
    if (faqs && faqs.length > 0) {
      html += buildFAQHtml(faqs);
      console.log(`[MAX-MODE] ✅ FAQ ${faqs.length}개 + Schema.org FAQPage 마크업 삽입 완료`);
    }

    // 🛒 쇼핑 모드 — 쿠팡 상품 카드 블록 강제 삽입 (실제 제휴링크가 최종 HTML에 들어가도록 보장)
    if (contentMode === 'shopping') {
      const coupangProducts = (payload as any).coupangProducts;
      if (Array.isArray(coupangProducts) && coupangProducts.length > 0) {
        html += renderCoupangProductBlock(coupangProducts);
        console.log(`[MAX-MODE] 🛒 쿠팡 상품 카드 ${Math.min(coupangProducts.length, 6)}개 삽입 완료 (제휴링크 활성화)`);
      } else {
        console.log('[MAX-MODE] ⚠️ 쇼핑 모드인데 쿠팡 상품 데이터 없음 — 카드 블록 스킵');
      }
    }

    // 💰 면책 — 섹션 끝, 요약표 전 (FAQ/질문 섹션 직후)
    html += `
<div style="margin:24px 0 16px !important;padding:0 !important;display:block !important;visibility:visible !important;">
  <p style="font-size:12px !important;color:#767676 !important;-webkit-text-fill-color:#767676 !important;margin:0 !important;line-height:1.7 !important;display:block !important;visibility:visible !important;">※ 본 글은 정보 제공 목적으로 작성되었으며, 전문적인 조언을 대체하지 않습니다. 일부 링크는 제휴 링크가 포함되어 있습니다.</p>
</div>
`;

    // 🔥 CTA 최소 2개 보장 (사용자 요구사항) — 애드센스 모드에서는 완전 스킵
    const ctaBlockMatches = html.match(/class="rv-cta"/g) || [];
    const currentCtaCount = ctaBlockMatches.length;
    console.log(`[MAX-MODE] CTA 현재 ${currentCtaCount}개 렌더링됨`);

    // 🔥 CTA 데이터 (상단 CTA에도 사용하기 위해 블록 밖에 선언)
    let supplementalCtas: Array<{ label: string; hookingMessage: string; buttonText: string; url: string }> = [];

    if (contentMode === 'adsense') {
      // 🛡️ 애드센스 모드: 보충 CTA 완전 차단
      console.log('[MAX-MODE] 🛡️ 애드센스 모드 — 보충 CTA 생성 생략 (승인 정책 준수)');
    } else if (currentCtaCount < 2) {
      const needMore = 2 - currentCtaCount;
      console.log(`[MAX-MODE] 🔥 CTA ${needMore}개 추가 필요 (최소 2개 보장)`);

      const encodedKeyword = encodeURIComponent(keyword);

      // 🔥 Step 1: Perplexity로 실제 관련 URL 심층 검색
      supplementalCtas = [];
      try {
        console.log(`[MAX-MODE] 🔍 Gemini로 CTA 관련 URL 심층 검색 중...`);
        const searchPrompt = `"${keyword}" 주제에 대해 독자가 클릭하고 싶은 관련 정보 페이지를 ${needMore}개 찾아줘.

조건:
1. 실제 존재하는 정부기관, 공식사이트, 대형 포털의 정보 페이지 URL
2. 블로그나 카페 링크 제외 — 공신력 있는 출처만
3. 한국어 사이트 우선
4. 각 URL과 함께 한줄 설명 포함

JSON 형식: [{"url":"https://실제URL","title":"페이지제목","description":"한줄설명"}]
JSON 배열만 반환해. 마크다운 없이 순수 JSON만.`;

        const searchText = await callGeminiWithRetry(searchPrompt);

        if (searchText) {
          try {
            const cleanJson = searchText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            if (Array.isArray(parsed) && parsed.length > 0) {
              // Gemini 검색 결과로 CTA 구성
              supplementalCtas = parsed.slice(0, needMore).map((item: any, idx: number) => ({
                label: idx === 0 ? '필독' : '혜택',
                hookingMessage: item.description || item.title || `${keyword} 관련 핵심 정보`,
                buttonText: '바로 확인하기 →',
                url: item.url || `https://www.google.com/search?q=${encodedKeyword}`
              }));
              console.log(`[MAX-MODE] 🔍 Gemini URL 검색 완료: ${supplementalCtas.map(c => c.url.slice(0, 50)).join(' | ')}`);
            }
          } catch (parseErr) {
            console.log(`[MAX-MODE] ⚠️ Gemini CTA URL 파싱 실패 — 폴백으로 진행`);
          }
        }

        {
          // 🔥 Step 2: Gemini URL 있으면 CTA 카피 개선
          if (supplementalCtas.length > 0) {
            try {
              const ctaCopyPrompt = `블로그 키워드: "${keyword}"
아래 URL들에 대한 CTA 카피를 작성해줘:
${supplementalCtas.map((c, i) => `${i + 1}. URL: ${c.url} / 설명: ${c.hookingMessage}`).join('\n')}

각 CTA에 대해:
- label: 짧은 라벨 (필독/혜택/추천/정보 중 택1)
- hookingMessage: 클릭을 유도하는 한줄 후킹 문장 (25자 내외, 궁금증/긴급성/혜택 강조)
- buttonText: 버튼 텍스트 (8자 내외, 행동 유도)

JSON: [{"label":"필독","hookingMessage":"...","buttonText":"..."}]
마크다운 없이 순수 JSON 배열만 반환해.`;

              const copyText = await callGeminiWithRetry(ctaCopyPrompt);
              if (copyText) {
                const cleanCopy = copyText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const copyParsed = JSON.parse(cleanCopy);
                if (Array.isArray(copyParsed)) {
                  copyParsed.forEach((cp: any, idx: number) => {
                    if (supplementalCtas[idx]) {
                      supplementalCtas[idx] = {
                        ...supplementalCtas[idx],
                        label: cp.label || supplementalCtas[idx].label,
                        hookingMessage: cp.hookingMessage || supplementalCtas[idx].hookingMessage,
                        buttonText: cp.buttonText || supplementalCtas[idx].buttonText,
                      };
                    }
                  });
                  console.log(`[MAX-MODE] 🧠 Gemini CTA 카피 개선 완료`);
                }
              }
            } catch (copyErr: any) {
              console.log(`[MAX-MODE] ⚠️ CTA 카피 개선 실패 (검색 URL은 유지): ${copyErr.message}`);
            }
          }
        }
      } catch (e: any) {
        console.log(`[MAX-MODE] ⚠️ Gemini CTA 검색 실패: ${e.message}`);
      }

      // 🔥 Step 3: Gemini 실패 시 Gemini만으로 CTA 생성 (Google 검색 링크)
      if (supplementalCtas.length < needMore) {
        try {
          const remaining = needMore - supplementalCtas.length;
          const ctaFallbackPrompt = `"${keyword}" 블로그 글에 대한 CTA ${remaining}개 생성.
- label: 추천/정보/필독/혜택 중 택1
- hookingMessage: 한줄 후킹 (20자 내외)
- buttonText: 버튼 텍스트 (10자 내외)
JSON: [{"label":"추천","hookingMessage":"...","buttonText":"..."}]
마크다운 없이 순수 JSON 배열만 반환해.`;

          const ctaText = await callGeminiWithRetry(ctaFallbackPrompt);
          if (ctaText) {
            const cleanJson = ctaText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed)) {
              parsed.slice(0, remaining).forEach((c: any) => {
                supplementalCtas.push({
                  label: c.label || '추천',
                  hookingMessage: c.hookingMessage || `${keyword} 핵심 정보`,
                  buttonText: c.buttonText || '자세히 보기',
                  url: `https://www.google.com/search?q=${encodedKeyword}`
                });
              });
            }
          }
        } catch (e: any) {
          console.log(`[MAX-MODE] ⚠️ Gemini CTA 폴백 실패: ${e.message}`);
        }
      }

      // 최종 폴백: 모든 AI 실패 시 기본 텍스트
      if (supplementalCtas.length < needMore) {
        const fallbackCtas = [
          {
            label: '추천',
            hookingMessage: `${keyword}에 대해 더 자세히 알고 싶다면?`,
            buttonText: `${keyword} 더 알아보기`,
            url: `https://www.google.com/search?q=${encodedKeyword}`
          },
          {
            label: '정보',
            hookingMessage: `최신 정보를 놓치지 마세요`,
            buttonText: `${keyword} 최신 정보 확인`,
            url: `https://www.google.com/search?q=${encodedKeyword}+최신`
          }
        ];
        while (supplementalCtas.length < needMore && fallbackCtas.length > 0) {
          supplementalCtas.push(fallbackCtas.shift()!);
        }
      }

      for (let ci = 0; ci < needMore && ci < supplementalCtas.length; ci++) {
        const cta = supplementalCtas[ci]!;
        html += `
<div class="cta-box">
  <p><strong>${cta.hookingMessage}</strong></p>
  <a class="cta-btn" href="${cta.url}" target="_blank" rel="nofollow noopener noreferrer">
    ${cta.buttonText}
  </a>
</div>
`;
      }
      console.log(`[MAX-MODE] ✅ CTA ${needMore}개 보충 완료`);
    }

    // 🔥 실행 플랜 섹션 제거됨 (사용자 요청)

    // 🧹 Summary Table 셀 sanitization
    //   AI가 상품 카드 HTML(<div>, <img>, <button>)을 셀에 넣을 수 있음 → 모바일에서 표 폭 깨짐
    //   모든 HTML 태그·엔티티 제거, 공백 정리, 최대 120자 컷
    const sanitizeSummaryCell = (raw: unknown): string => {
      const s = String(raw ?? '');
      return s
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')           // 모든 HTML 태그 제거
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')                // 연속 공백 단일화
        .trim()
        .slice(0, 120);                      // 너무 긴 셀 컷
    };
    const cleanedRows = (summaryTable.rows || [])
      .map(row => row.map(sanitizeSummaryCell))
      // 전체 셀이 빈 줄 제거
      .filter(row => row.some(c => c.length > 0));
    const cleanedHeaders = (summaryTable.headers || []).map(sanitizeSummaryCell);

    // 💰 요약표를 상단(TOP_SUMMARY_CTA_PLACEHOLDER)에 배치
    const topSummaryHtml = cleanedRows.length === 0 ? '' : `
<div class="summary-container" style="margin:0 0 30px !important;background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;border:2px solid #f59e0b !important;border-radius:16px !important;display:block !important;visibility:visible !important;box-sizing:border-box !important;max-width:100% !important;">
  <div style="display:flex !important;align-items:center !important;gap:10px !important;margin-bottom:16px !important;">
    <span style="font-size:24px !important;">⚡</span>
    <h3 style="margin:0 !important;font-size:20px !important;font-weight:800 !important;color:#92400e !important;-webkit-text-fill-color:#92400e !important;">성급한 분들을 위한 핵심 요약</h3>
  </div>
  <div class="ad-safe-zone table-wrapper" data-ad-region="no-ad" style="overflow-x:auto !important;-webkit-overflow-scrolling:touch !important;width:100% !important;max-width:100% !important;position:relative;">
    <table class="responsive-table summary-table" style="display:table !important;visibility:visible !important;width:100% !important;border-collapse:collapse !important;font-size:15px !important;">
      <thead style="display:table-header-group !important;"><tr style="display:table-row !important;">${cleanedHeaders.map(h => `<th class="rt-th" style="display:table-cell !important;visibility:visible !important;background:#fef3c7 !important;color:#92400e !important;-webkit-text-fill-color:#92400e !important;font-weight:700 !important;padding:14px 16px !important;text-align:left !important;border-bottom:2px solid #f59e0b !important;font-size:13px !important;text-transform:uppercase !important;letter-spacing:0.05em !important;">${h}</th>`).join('')}</tr></thead>
      <tbody style="display:table-row-group !important;">${cleanedRows.map(row => `<tr style="display:table-row !important;">${row.map(cell => `<td class="rt-td" style="display:table-cell !important;visibility:visible !important;padding:14px 16px !important;border-bottom:1px solid #fde68a !important;color:#78350f !important;-webkit-text-fill-color:#78350f !important;background:#fffbeb !important;font-size:14px !important;line-height:1.5 !important;word-break:break-word !important;overflow-wrap:break-word !important;">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>
</div>
`;

    // 🔥 상단 CTA (첨 번째 CTA를 상단에 배치 — AI 생성 CTA 또는 보충 CTA)
    let topCtaHtml = '';
    if (contentMode === 'adsense') {
      // 🛡️ 애드센스 모드: 상단 CTA 완전 차단
      console.log('[MAX-MODE] 🛡️ 애드센스 모드 — 상단 CTA 생성 생략 (승인 정책 준수)');
    } else {
      // ctas 배열(AI 섹션 CTA)에서 가져오거나, 보충 CTA에서 가져오거나, 키워드 구글 검색 폴백
      const topCtaSource = ctas.length > 0
        ? { label: '핵심', hookingMessage: ctas[0]!.hookingMessage || `${keyword} 핵심 정보 바로가기`, buttonText: ctas[0]!.buttonText || '자세히 보기', url: ctas[0]!.url || `https://www.google.com/search?q=${encodeURIComponent(keyword)}` }
        : supplementalCtas.length > 0
          ? supplementalCtas[0]!
          : { label: '추천', hookingMessage: `${keyword}에 대해 더 알고 싶다면?`, buttonText: '자세히 알아보기', url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}` };
      {
        const topCta = topCtaSource;
        topCtaHtml = `
<div class="cta-box" style="margin-top: 20px !important;">
  <p><strong>${topCta.hookingMessage}</strong></p>
  <a class="cta-btn" href="${topCta.url}" target="_blank" rel="nofollow noopener noreferrer">
    ${topCta.buttonText}
  </a>
</div>
`;
      }
    } // end of non-adsense CTA block

    // 🔥 항상 상단 CTA가 나오도록 보장
    // (위 블록은 항상 실행되므로 topCtaHtml에 값이 있음)

    const formattedIntro = introductionHTML ? `
<div class="content intro-section" style="margin:24px 0 32px !important;padding:0 !important;background:none !important;border:none !important;border-radius:0 !important;box-shadow:none !important;font-size:16px !important;line-height:1.6 !important;color:#333 !important;">
${introductionHTML}
</div>
` : '';

    // 🔥 TOP_SUMMARY_CTA_PLACEHOLDER에 CTA 버튼 먼저 → 서론 → 핵심요약 삽입
    // 사용자 구조: 접속 즉시 CTA 버튼 → 서론 → 요약 정보 → 목차 → 상세 콘텐츠 → 결론 → 하단 CTA
    html = html.replace('<!-- TOP_SUMMARY_CTA_PLACEHOLDER -->', topCtaHtml + formattedIntro + topSummaryHtml);

    const formattedConclusion = conclusionHTML ? `
<div class="content conclusion-section" style="margin:40px 0 24px !important;padding:0 !important;background:none !important;border:none !important;border-radius:0 !important;box-shadow:none !important;font-size:16px !important;line-height:1.6 !important;color:#333 !important;">
${conclusionHTML}
</div>
` : '';
    html += formattedConclusion;

    // 💰 면책 조항 — 템플릿의 .disclaimer 부착
    html += `
<div class="disclaimer">
  ※ 본 글은 정보 제공 목적으로 작성되었으며, 전문적인 조언을 대체하지 않습니다. 일부 링크는 제휴 링크가 포함되어 있습니다.<br />
  ※ 실제 서비스 환경이나 시기에 따라 세부 내용이 일부 변경될 수 있습니다.
</div>
`;

    // 💰 공유 버튼 — v5.0 워드프레스 완전 호환 (script 태그 제거, 순수 HTML 링크)
    // 🔥 공유 URL은 발행 후 실제 permalink으로 교체됨 (WordPress/Blogger publisher에서 처리)
    // 여기서는 빈 URL placeholder를 쓰지 않고, 제목 기반 검색 링크를 설정
    const shareUrl = encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(h1)}`);
    const shareTitle = encodeURIComponent(h1);
    html += `
<div style="margin:40px 0 20px !important;padding:28px 24px !important;background:linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%) !important;border:1px solid #e0e8f5 !important;border-radius:16px !important;text-align:center !important;display:block !important;visibility:visible !important;">
  <div style="font-size:15px !important;font-weight:700 !important;color:#333 !important;-webkit-text-fill-color:#333 !important;margin-bottom:6px !important;">📢 이 글이 도움이 되셨다면 공유해보세요</div>
  <p style="font-size:13px !important;color:#888 !important;margin:0 0 16px !important;">도움이 필요한 분들에게 알려주세요</p>
  <div style="display:flex !important;flex-wrap:wrap !important;justify-content:center !important;gap:10px !important;">
    <a href="https://story.kakao.com/share?url=${shareUrl}" target="_blank" rel="nofollow noopener noreferrer" style="display:inline-flex !important;align-items:center !important;gap:6px !important;padding:10px 20px !important;background:#FEE500 !important;color:#3C1E1E !important;-webkit-text-fill-color:#3C1E1E !important;border:none !important;border-radius:10px !important;font-size:14px !important;font-weight:700 !important;text-decoration:none !important;box-shadow:0 2px 8px rgba(254,229,0,0.3) !important;">💛 카카오</a>
    <a href="https://share.naver.com/web/shareView?url=${shareUrl}&title=${shareTitle}" target="_blank" rel="nofollow noopener noreferrer" style="display:inline-flex !important;align-items:center !important;gap:6px !important;padding:10px 20px !important;background:#03C75A !important;color:#fff !important;-webkit-text-fill-color:#fff !important;border:none !important;border-radius:10px !important;font-size:14px !important;font-weight:700 !important;text-decoration:none !important;box-shadow:0 2px 8px rgba(3,199,90,0.3) !important;">🟢 네이버</a>
    <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}" target="_blank" rel="nofollow noopener noreferrer" style="display:inline-flex !important;align-items:center !important;gap:6px !important;padding:10px 20px !important;background:#000 !important;color:#fff !important;-webkit-text-fill-color:#fff !important;border:none !important;border-radius:10px !important;font-size:14px !important;font-weight:700 !important;text-decoration:none !important;box-shadow:0 2px 8px rgba(0,0,0,0.2) !important;">✖ X</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="nofollow noopener noreferrer" style="display:inline-flex !important;align-items:center !important;gap:6px !important;padding:10px 20px !important;background:#1877F2 !important;color:#fff !important;-webkit-text-fill-color:#fff !important;border:none !important;border-radius:10px !important;font-size:14px !important;font-weight:700 !important;text-decoration:none !important;box-shadow:0 2px 8px rgba(24,119,242,0.3) !important;">🔵 Facebook</a>
  </div>
</div>
`;

    // 💰 하단 최종 CTA 버튼 (마지막 클릭 유도) — 에드센스 모드에서는 생략
    if (contentMode !== 'adsense') {
      const finalCta = ctas.length > 0
        ? { hookingMessage: ctas[0]!.hookingMessage || `${keyword} 핵심 정보 바로가기`, buttonText: ctas[0]!.buttonText || '자세히 보기', url: ctas[0]!.url || `https://www.google.com/search?q=${encodeURIComponent(keyword)}` }
        : supplementalCtas.length > 0
          ? supplementalCtas[0]!
          : { hookingMessage: `${keyword}에 대해 더 알고 싶다면?`, buttonText: '자세히 알아보기', url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}` };
      html += `
<div class="cta-box">
  <p><strong>${finalCta.hookingMessage}</strong></p>
  <a class="cta-btn" href="${finalCta.url}" target="_blank" rel="nofollow noopener noreferrer">
    ${finalCta.buttonText}
  </a>
</div>
`;
    }

    // 💎 백서 컨테이너 닫기 (bgpt-content + gradient-frame + white-paper)
    html += '</div></div></div>';

    // 🔗 내부 링크 자동 삽입 (H2 섹션 사이드) — 애드센스 모드에서는 생략
    if (contentMode === 'adsense') {
      console.log('[MAX-MODE] 🛡️ 애드센스 모드 — 내부 링크 삽입 생략 (승인 정책 준수)');
    }
    try {
      const URLData = loadEnvFromFile();
      const blogUrl = contentMode !== 'adsense'
        ? (URLData['BLOGGER_URL'] || URLData['TISTORY_URL'] || URLData['WP_URL'] || payload.url || '')
        : '';

      if (blogUrl) {
        onLog?.('[PROGRESS] 88% - 🔗 내부 링크 검색 및 삽입 중...');
        const relatedLinks = await findRelatedPosts(blogUrl, keyword, 5);
        if (relatedLinks.length > 0) {
          // H2 섹션 1번째 이후부터 삽입 (최대 2개 섹션)
          html = insertInternalLinks(html, relatedLinks, 1);
          console.log(`[MAX-MODE] ✅ 내부 링크 ${relatedLinks.length}개 삽입 완료 (대상: ${blogUrl})`);
        } else {
          console.log(`[MAX-MODE] ℹ️ 관련 내부 링크를 찾지 못했습니다.`);
        }
      } else {
        console.log(`[MAX-MODE] ℹ️ 블로그 URL이 설정되지 않아 내부 링크를 생략합니다.`);
      }
    } catch (linkErr: any) {
      console.log(`[MAX-MODE] ⚠️ 내부 링크 삽입 실패 (계속 진행): ${linkErr.message}`);
    }

    // 🖼️ 썸네일 생성 - 수집 이미지 우선, 그 다음 나노 바나나 프로 또는 SVG
    let thumbnailUrl = '';

    // 🔥 thumbnailSource: 사용자 선택 값 (imagefx, nanobananapro, text 등)
    const thumbnailSource = payload.thumbnailSource || payload.thumbnailType || payload.thumbnailMode || 'imagefx';
    const thumbnailDisabled = thumbnailSource === 'none' || thumbnailSource === 'skip';

    // 🛒 1순위: 크롤러 수집 상품 이미지 (productImages가 있으면 첫 번째 이미지를 썸네일로 사용)
    // 단, 사용자가 'none'을 선택한 경우에는 존중
    if (!thumbnailDisabled && (payload.productImages as any)?.length > 0) {
      thumbnailUrl = (payload.productImages as any)[0];
      onLog?.(`[PROGRESS] 90% - 🛒 수집된 상품 이미지로 썸네일 설정 (${(payload.productImages as any).length}장 중 1번째)`);
      console.log(`[THUMBNAIL] ✅ 수집 이미지 썸네일: ${thumbnailUrl.substring(0, 60)}...`);
    }

    // 🎯 썸네일 디스패치: 사용자 선택 엔진 → 실패 시 폴백 → 최종 SVG
    if (!thumbnailUrl && !thumbnailDisabled) {
      onLog?.(`[PROGRESS] 90% - 🖼️ 썸네일 생성 중 (요청: ${thumbnailSource})...`);
      try {
        const thumbResult = await dispatchThumbnailGeneration(
          thumbnailSource,
          h1,
          keyword,
          (msg) => onLog?.(`   ${msg}`),
        );
        if (thumbResult.ok) {
          // 🔀 다운그레이드 감지 — 사용자가 요청한 엔진과 실제 사용 엔진이 다르면 경고
          const reqKey = String(thumbnailSource).toLowerCase().replace(/[^a-z]/g, '');
          const actKey = String(thumbResult.source || '').toLowerCase().replace(/[^a-z]/g, '');
          if (reqKey && reqKey !== 'auto' && !actKey.includes(reqKey) && !reqKey.includes(actKey)) {
            console.warn(`[THUMBNAIL] 🔀 엔진 다운그레이드: 요청=${thumbnailSource} 실제=${thumbResult.source}`);
            onLog?.(`   ⚠️ 요청 엔진(${thumbnailSource})과 실제 사용 엔진(${thumbResult.source})이 다릅니다.`);
          }
          onLog?.(`   📊 썸네일 최종 엔진: ${thumbResult.source}`);
          // Base64 이미지를 호스팅에 업로드
          if (thumbResult.dataUrl.startsWith('data:')) {
            const uploadedUrl = await uploadBase64ToImageHost(thumbResult.dataUrl, 'thumbnail');
            if (uploadedUrl) {
              thumbnailUrl = uploadedUrl;
              onLog?.(`   ✅ ${thumbResult.source} 썸네일 완료 (업로드됨)`);
            } else {
              thumbnailUrl = thumbResult.dataUrl;
              onLog?.(`   ✅ ${thumbResult.source} 썸네일 완료 (Base64)`);
            }
          } else {
            thumbnailUrl = thumbResult.dataUrl;
            onLog?.(`   ✅ ${thumbResult.source} 썸네일 완료`);
          }
        } else {
          onLog?.(`   ⚠️ 모든 썸네일 엔진 실패: ${thumbResult.error}`);
        }
      } catch (e: any) {
        console.error('[THUMBNAIL] 디스패치 실패:', e);
        onLog?.(`   ⚠️ 썸네일 생성 실패: ${e.message || e}`);
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    // 💰 썸네일 — 풀블리드 (패딩/그림자 없음)
    if (thumbnailUrl) {
      const thumbnailHtml = `
<div class="bgpt-thumbnail-box" style="margin:0;padding:0;overflow:hidden;">
  <img src="${thumbnailUrl}" alt="${h1}" style="width:100%;height:auto;display:block;" loading="lazy" />
</div>`;
      html = html.replace('<!-- THUMBNAIL_PLACEHOLDER -->', thumbnailHtml);
    } else {
      html = html.replace('<!-- THUMBNAIL_PLACEHOLDER -->', '');
    }

    onLog?.(`[PROGRESS] 93% - ✅ 콘텐츠 생성 완료! (${duration}초)`);
    onLog?.(`   - 글자수: ${html.length}자`);
    onLog?.(`   - 썸네일: ${thumbnailUrl ? '생성됨' : '없음'}`);

    // 품질 검증 게이트 — 발행을 막지 않고 경고만 로그한다
    try {
      const qualityReport = validateArticleQuality({
        h1Title: h1,
        introduction: introductionHTML || '',
        conclusion: conclusionHTML || '',
        sections: sections.map(s => ({
          h2: s.h2,
          h3Sections: s.h3Sections.map((h: any) => ({ h3: h.h3, content: h.content })),
        })),
        faqs: faqs ?? [],
      });

      const qualityStatus = qualityReport.passed ? '✅ PASS' : '⚠️ WARN';
      onLog?.(`[QUALITY] ${qualityStatus} 품질 점수: ${qualityReport.score}/100`);
      if (qualityReport.issues.length > 0) {
        onLog?.(`[QUALITY] 발견된 문제 (${qualityReport.issues.length}건):`);
        qualityReport.issues.forEach(issue => onLog?.(`   - ${issue}`));
      }
      if (!qualityReport.passed && qualityReport.suggestions.length > 0) {
        onLog?.('[QUALITY] 개선 제안:');
        qualityReport.suggestions.slice(0, 3).forEach(s => onLog?.(`   → ${s}`));
      }
    } catch (qualityErr: any) {
      onLog?.(`[QUALITY] ⚠️ 품질 검증 오류 (발행 계속 진행): ${qualityErr.message}`);
    }

    // 🛡️ 모드별 후처리 (adsense: CTA 잔재 제거 + AI 감지 완화)
    if (modeResult.postProcessPlugin?.postProcess) {
      try {
        const ppResult = modeResult.postProcessPlugin.postProcess(html);
        html = ppResult.html;
        onLog?.(`[PROGRESS] 99% - ✅ ${contentMode} 모드 후처리 완료`);
      } catch (ppErr: any) {
        console.warn(`[POST-PROCESS] ⚠️ 후처리 실패 (원본 유지): ${ppErr.message}`);
      }
    }

    return {
      html,
      title: h1,
      labels: hashtags.split(',').map(t => t.trim()).slice(0, 15),
      thumbnail: thumbnailUrl,
    };

  } catch (error: any) {
    const msg = error?.message || String(error);
    const isEngineError = /API 키가 설정되지|엔진 호출 실패|다른 엔진을 선택/i.test(msg);
    if (isEngineError) {
      // 엔진 선택 관련 에러 — 전체 메시지를 사용자에게 전달
      msg.split('\n').forEach((line: string) => {
        if (line.trim()) onLog?.(`[PROGRESS] 0% - ${line.trim()}`);
      });
    } else {
      const isApiError = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|timeout|ECONNREFUSED|ENOTFOUND/i.test(msg);
      if (isApiError) {
        onLog?.(`[PROGRESS] 0% - ❌ AI API 연결 실패: ${msg.substring(0, 150)}`);
        onLog?.('💡 해결 방법: 잠시 후 다시 시도하거나, 다른 AI 엔진을 선택해주세요.');
      } else {
        onLog?.(`[PROGRESS] 0% - ❌ 콘텐츠 생성 오류: ${msg.substring(0, 150)}`);
      }
    }
    throw error;
  } finally {
    // 🎯 AI 엔진 env 원복 (다음 요청에 영향 방지)
    process.env['PRIMARY_TEXT_MODEL'] = previousTextModel;
    releaseLock!();
  }
}

