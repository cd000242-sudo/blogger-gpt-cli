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
import { generateContentFromUrl, generateContentFromUrls } from '../url-content-generator';
import { validateCtaUrl } from '../../cta/validate-cta-url';
import { findRelatedPosts, insertInternalLinks } from '../internal-links';
import { INTERNAL_CONSISTENCY_SECTIONS } from '../max-mode-structure';
import { fetchFactContext, type FactCheckMode } from '../perplexityFactCheck';
import { uploadBase64ToImageHost } from './image-helpers';
import { crawlSingleUrlFast } from './crawlers';
import { callGeminiWithGrounding } from './gemini-engine';
import { FinalCrawledPost, FinalTableData, FinalCTAData } from './types';
import {
  generateH1TitleFinal, generateH2TitlesFinal,
  generateAllSectionsFinal, generateFAQFinal, buildFAQHtml,
  generateCTAsFinal, generateSummaryTableFinal, generateHashtagsFinal,
} from './generation';
import { generateCSSFinal, generateTOCFinal } from './html';
import { validateArticleQuality } from './quality-gate';
import { dispatchMode } from './mode-dispatcher';

export async function generateUltimateMaxModeArticleFinal(
  payload: any,
  env: any,
  onLog?: (s: string) => void
): Promise<{ html: string; title: string; labels: string[]; thumbnail: string }> {

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

        // 썸네일 생성 (기존 로직 활용)
        let thumbnailUrl = '';
        if (!skipImages) {
          onLog?.('[PROGRESS] 92% - 🖼️ 썸네일 생성 중...');
          try {
            const nbApiKey = getGeminiApiKey();
            if (nbApiKey) {
              const thumbResult = await makeNanoBananaProThumbnail(urlResult.title, keyword || urlResult.title, {
                apiKey: nbApiKey,
                aspectRatio: '16:9',
                isThumbnail: true
              });
              if (thumbResult.ok && thumbResult.dataUrl) {
                thumbnailUrl = thumbResult.dataUrl;
              }
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
      // 🌐 2026 모드: 키워드 기반 → Search Grounding으로 전환! (크롤링 스킵)
      onLog?.('[PROGRESS] 5% - 🌐 Search Grounding 모드 (AI가 Google 검색으로 직접 정보 수집)');
      onLog?.('   🔍 Gemini + Google Search로 최신 정보를 실시간 검색합니다...');
      // 크롤링 없이 빈 배열 → generateH1/H2/AllSections에서 AI가 직접 검색
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
    let h1: string;
    if (payload.useKeywordAsTitle) {
      // ✅ 키워드를 제목 그대로 사용
      h1 = keyword;
      onLog?.(`[PROGRESS] 30% - 🎯 키워드를 제목으로 사용: "${h1}"`);
    } else {
      // 🤖 AI 자동 생성
      onLog?.('[PROGRESS] 25% - ✍️ AI가 제목(H1) 생성 중...');
      h1 = await generateH1TitleFinal(keyword, titles);

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
    const modeResult = dispatchMode(contentMode, keyword);

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
      // 폴백: 기존 하드코딩
      // 📝 내부 일관성(시리즈) 모드: INTERNAL_CONSISTENCY_SECTIONS 고정 구조 사용
      onLog?.('[PROGRESS] 35% - 📝 내부 일관성 모드: 시리즈 구조 적용 중...');
      h2Titles = INTERNAL_CONSISTENCY_SECTIONS.map(sec => {
        // 키워드를 반영한 제목 생성 (예: "② 핵심 지식 전달" → 키워드 맥락 유지)
        return sec.title.replace('[주제]', keyword).replace('[소주제]', keyword);
      });
      onLog?.(`[PROGRESS] 40% - ✅ 시리즈 구조 ${h2Titles.length}개 섹션 적용 완료`);
    } else {
      // 🤖 일반 모드: AI가 H2 소제목 생성
      onLog?.('[PROGRESS] 35% - 📊 AI가 소제목(H2) 생성 중...');
      const maxH2Count = (typeof payload.sectionCount === 'number' && Number.isFinite(payload.sectionCount) && payload.sectionCount > 0)
        ? Math.floor(payload.sectionCount)
        : undefined;
      h2Titles = await generateH2TitlesFinal(keyword, subheadings, maxH2Count);
      onLog?.(`[PROGRESS] 40% - ✅ 소제목 ${h2Titles.length}개 완료`);
    }

    // 4. 🔥 전체 본문 한 번에 생성 (API 호출 1회로 단축!)
    onLog?.('[PROGRESS] 45% - 📝 AI가 전체 본문 생성 중 (1회 호출)...');

    // 🔍 팩트체크: 글 생성 전 실시간 검색으로 팩트 수집 (할루시네이션 방지)
    const factCheckMode: FactCheckMode = payload.factCheckMode || 'grounding';
    let factEnrichedContents = contents;
    if (factCheckMode !== 'off') {
      try {
        onLog?.(`[PROGRESS] 46% - 🔍 팩트체크 실행 중 (${factCheckMode === 'perplexity' ? 'Perplexity' : 'Gemini Grounding'})...`);
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

    // 모드 디스패처의 섹션 프롬프트 블록이 있으면 reference 맨 앞에 삽입
    const modeEnrichedContents = modeResult.sectionPromptBlock
      ? [modeResult.sectionPromptBlock, ...factEnrichedContents]
      : factEnrichedContents;

    const allSectionsObj = await generateAllSectionsFinal(keyword, h2Titles, modeEnrichedContents, onLog, contentMode);
    const sections = allSectionsObj.sections;
    const introductionHTML = allSectionsObj.introduction;
    const conclusionHTML = allSectionsObj.conclusion;

    // 4.5. 🔥 FAQ 생성 (별도 API 호출 — Schema.org FAQPage 포함)
    const faqs = await generateFAQFinal(keyword, h2Titles, onLog);

    // 5. CTA 생성 (manualCtas 우선, 없으면 자동 생성)
    onLog?.('[PROGRESS] 70% - 💰 CTA 버튼 생성 중...');
    let ctas: FinalCTAData[] = [];

    // 🔥 수동 CTA가 있으면 우선 사용
    if (payload.manualCtas && Object.keys(payload.manualCtas).length > 0) {
      const { validateCtaUrlFormat } = await import('../../cta/validate-cta-url');
      Object.entries(payload.manualCtas).forEach(([position, ctaData]: [string, any]) => {
        if (ctaData && ctaData.url) {
          // 🔥 수동 CTA URL 형식 검증 (HTTP 요청 없이 빠른 검증)
          const formatCheck = validateCtaUrlFormat(ctaData.url);
          if (!formatCheck.isValid) {
            console.warn(`[CTA] ⚠️ 수동 CTA URL 형식 오류: ${ctaData.url} (${formatCheck.reason}) — 건너뜀`);
            return; // 이 CTA 건너뛰기
          }
          ctas.push({
            hookingMessage: ctaData.hook || '더 자세한 정보가 궁금하시다면?',
            buttonText: ctaData.text || '자세히 보기',
            url: ctaData.url,
            position: parseInt(position) || 0
          });
          console.log(`[CTA] ✅ 수동 CTA 사용: ${ctaData.url}`);
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

      // 🔥 이미지 배치 섹션 선택 — idx=0은 썸네일과 중복(L4196 idx>0 필터)이므로
      //    기본값은 섹션 2,3,4 (idx=1,2,3)부터 시작하여 본문 이미지가 실제 표시되도록 함
      // 모든 H2 섹션에 이미지 생성 (idx=1은 썸네일 중복 가능성으로 idx=2부터)
      const effectiveSelectedH2Sections = selectedH2Sections.length > 0
        ? selectedH2Sections
        : Array.from({ length: Math.max(1, sections.length - 1) }, (_, i) => i + 2);

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
      const cleanH2 = section.h2
        .replace(/^[hH]2[:\-\s]*/gi, '')
        .replace(/^소제목[:\s]*/gi, '')
        .replace(/^\d+[.\):\s]+/g, '')
        .trim();
      const h2Number = `${idx + 1}.`;

      // 💰 H2 — 인라인 !important는 Blogger 테마 override 방지 필수 (CSS만으로는 부족)
      // 여백(Margin) 최적화: H2 직후 약간의 공백을 두어 자동광고가 붙기 좋게 설계
      html += `\n<h2 id="section-${idx}" style="font-size:26px !important;font-weight:800 !important;color:#111 !important;-webkit-text-fill-color:#111 !important;margin:60px 0 24px !important;padding:0 0 14px 16px !important;border-bottom:2px solid #111 !important;border-left:6px solid #FF6B35 !important;letter-spacing:-0.03em !important;line-height:1.4 !important;word-break:keep-all !important;">${h2Number} ${cleanH2}</h2>\n`;

      // 🖼️ 섹션 이미지 — 플랫, 그림자 없음
      // 🔥 첫 번째 섹션(idx===0) 이미지는 스킵 — nuclear separator 썸네일과 중복 방지
      const finalImageUrl = processedImageUrls[idx];
      if (finalImageUrl && idx > 0) {
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

        // 표 — 미니멀 뉴스 스타일
        if (h3Sec.tables.length > 0) {
          h3Sec.tables.forEach(table => {
            html += `<div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:28px 0;">`;
            html += `<table style="width:100%;min-width:500px;border-collapse:collapse;font-size:15px;">`;
            html += `<thead><tr>${table.headers.map(h => `<th style="background:#f8f9fa;color:#333;font-weight:700;padding:14px 16px;text-align:left;border-bottom:2px solid #ddd;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">${h}</th>`).join('')}</tr></thead>`;
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
              return `<td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;color:#444;background:#fff;">${formatted}</td>`;
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
        const perplexityKey = getPerplexityApiKey();

        if (perplexityKey) {
          console.log(`[MAX-MODE] 🔍 Perplexity로 CTA 관련 URL 심층 검색 중...`);
          const searchResponse = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
              model: 'sonar',
              messages: [{
                role: 'system',
                content: 'You are a Korean web researcher. Find the most relevant, authoritative, and helpful URLs for the given topic. Output ONLY valid JSON array, nothing else. No markdown, no explanation.'
              }, {
                role: 'user',
                content: `"${keyword}" 주제에 대해 독자가 클릭하고 싶은 관련 정보 페이지를 ${needMore}개 찾아줘.

조건:
1. 실제 존재하는 정부기관, 공식사이트, 대형 포털의 정보 페이지 URL
2. 블로그나 카페 링크 제외 — 공신력 있는 출처만
3. 한국어 사이트 우선
4. 각 URL과 함께 한줄 설명 포함

JSON 형식: [{"url":"https://실제URL","title":"페이지제목","description":"한줄설명"}]
JSON 배열만 반환해.`
              }],
              max_tokens: 500,
              temperature: 0.3,
              return_citations: true
            },
            {
              headers: {
                'Authorization': `Bearer ${perplexityKey}`,
                'Content-Type': 'application/json',
              },
              timeout: 15000,
            }
          );

          const searchText = searchResponse.data?.choices?.[0]?.message?.content?.trim() || '';
          const citations: string[] = searchResponse.data?.citations || [];

          if (searchText) {
            try {
              const cleanJson = searchText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
              const parsed = JSON.parse(cleanJson);

              if (Array.isArray(parsed) && parsed.length > 0) {
                // Perplexity 검색 결과로 CTA 구성
                supplementalCtas = parsed.slice(0, needMore).map((item: any, idx: number) => ({
                  label: idx === 0 ? '필독' : '혜택',
                  hookingMessage: item.description || item.title || `${keyword} 관련 핵심 정보`,
                  buttonText: '바로 확인하기 →',
                  url: item.url || citations[idx] || `https://www.google.com/search?q=${encodedKeyword}`
                }));
                console.log(`[MAX-MODE] 🔍 Perplexity URL 검색 완료: ${supplementalCtas.map(c => c.url.slice(0, 50)).join(' | ')}`);
              }
            } catch (parseErr) {
              // JSON 파싱 실패 시 citations에서 직접 URL 추출
              if (citations.length > 0) {
                supplementalCtas = citations.slice(0, needMore).map((url: string, idx: number) => ({
                  label: idx === 0 ? '필독' : '정보',
                  hookingMessage: `${keyword} 관련 공식 정보를 확인하세요`,
                  buttonText: '공식 사이트 보기 →',
                  url: url
                }));
                console.log(`[MAX-MODE] 🔍 Perplexity citations URL 사용: ${citations.slice(0, needMore).join(' | ')}`);
              }
            }
          }

          // 🔥 Step 2: Perplexity URL 있으면 OpenAI로 CTA 카피 개선
          if (supplementalCtas.length > 0) {
            try {
              const envData = loadEnvFromFile();
              const openaiKey = (envData['openaiKey'] || envData['OPENAI_API_KEY'] || '').trim();

              if (openaiKey && openaiKey.length > 20) {
                const ctaCopyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'gpt-4.1',
                    messages: [{
                      role: 'system',
                      content: 'You are a Korean blog CTA copywriter. Improve CTA texts. Output ONLY valid JSON array.'
                    }, {
                      role: 'user',
                      content: `블로그 키워드: "${keyword}"
아래 URL들에 대한 CTA 카피를 작성해줘:
${supplementalCtas.map((c, i) => `${i + 1}. URL: ${c.url} / 설명: ${c.hookingMessage}`).join('\n')}

각 CTA에 대해:
- label: 짧은 라벨 (필독/혜택/추천/정보 중 택1)
- hookingMessage: 클릭을 유도하는 한줄 후킹 문장 (25자 내외, 궁금증/긴급성/혜택 강조)
- buttonText: 버튼 텍스트 (8자 내외, 행동 유도)

JSON: [{"label":"필독","hookingMessage":"...","buttonText":"..."}]`
                    }],
                    temperature: 0.8,
                    max_tokens: 300
                  })
                });

                if (ctaCopyResponse.ok) {
                  const copyData = await ctaCopyResponse.json();
                  const copyText = copyData.choices?.[0]?.message?.content?.trim();
                  if (copyText) {
                    const cleanCopy = copyText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                    const copyParsed = JSON.parse(cleanCopy);
                    if (Array.isArray(copyParsed)) {
                      copyParsed.forEach((cp: any, idx: number) => {
                        if (supplementalCtas[idx]) {
                          supplementalCtas[idx].label = cp.label || supplementalCtas[idx].label;
                          supplementalCtas[idx].hookingMessage = cp.hookingMessage || supplementalCtas[idx].hookingMessage;
                          supplementalCtas[idx].buttonText = cp.buttonText || supplementalCtas[idx].buttonText;
                        }
                      });
                      console.log(`[MAX-MODE] 🧠 OpenAI CTA 카피 개선 완료`);
                    }
                  }
                }
              }
            } catch (copyErr: any) {
              console.log(`[MAX-MODE] ⚠️ CTA 카피 개선 실패 (검색 URL은 유지): ${copyErr.message}`);
            }
          }
        }
      } catch (e: any) {
        console.log(`[MAX-MODE] ⚠️ Perplexity CTA 검색 실패: ${e.message}`);
      }

      // 🔥 Step 3: Perplexity 실패 시 OpenAI만으로 CTA 생성 (Google 검색 링크)
      if (supplementalCtas.length < needMore) {
        try {
          const envData = loadEnvFromFile();
          const openaiKey = (envData['openaiKey'] || envData['OPENAI_API_KEY'] || '').trim();

          if (openaiKey && openaiKey.length > 20) {
            const remaining = needMore - supplementalCtas.length;
            const ctaResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4.1',
                messages: [{
                  role: 'system',
                  content: 'You are a Korean blog CTA copywriter. Output ONLY valid JSON array.'
                }, {
                  role: 'user',
                  content: `"${keyword}" 블로그 글에 대한 CTA ${remaining}개 생성.
- label: 추천/정보/필독/혜택 중 택1
- hookingMessage: 한줄 후킹 (20자 내외)
- buttonText: 버튼 텍스트 (10자 내외)
JSON: [{"label":"추천","hookingMessage":"...","buttonText":"..."}]`
                }],
                temperature: 0.8,
                max_tokens: 300
              })
            });

            if (ctaResponse.ok) {
              const ctaData = await ctaResponse.json();
              const ctaText = ctaData.choices?.[0]?.message?.content?.trim();
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
            }
          }
        } catch (e: any) {
          console.log(`[MAX-MODE] ⚠️ OpenAI CTA 폴백 실패: ${e.message}`);
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

    // 💰 요약표를 상단(TOP_SUMMARY_CTA_PLACEHOLDER)에 배치
    const topSummaryHtml = `
<div style="margin:0 0 30px !important;padding:24px !important;background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;border:2px solid #f59e0b !important;border-radius:16px !important;display:block !important;visibility:visible !important;">
  <div style="display:flex !important;align-items:center !important;gap:10px !important;margin-bottom:16px !important;">
    <span style="font-size:24px !important;">⚡</span>
    <h3 style="margin:0 !important;font-size:20px !important;font-weight:800 !important;color:#92400e !important;-webkit-text-fill-color:#92400e !important;">성급한 분들을 위한 핵심 요약</h3>
  </div>
  <div style="overflow-x:auto !important;-webkit-overflow-scrolling:touch !important;width:100% !important;">
    <table style="display:table !important;visibility:visible !important;width:100% !important;min-width:500px !important;border-collapse:collapse !important;font-size:15px !important;">
      <thead style="display:table-header-group !important;"><tr style="display:table-row !important;">${summaryTable.headers.map(h => `<th style="display:table-cell !important;visibility:visible !important;background:#fef3c7 !important;color:#92400e !important;-webkit-text-fill-color:#92400e !important;font-weight:700 !important;padding:14px 16px !important;text-align:left !important;border-bottom:2px solid #f59e0b !important;font-size:13px !important;text-transform:uppercase !important;letter-spacing:0.05em !important;">${h}</th>`).join('')}</tr></thead>
      <tbody style="display:table-row-group !important;">${summaryTable.rows.map(row => `<tr style="display:table-row !important;">${row.map(cell => `<td style="display:table-cell !important;visibility:visible !important;padding:14px 16px !important;border-bottom:1px solid #fde68a !important;color:#78350f !important;-webkit-text-fill-color:#78350f !important;background:#fffbeb !important;font-size:14px !important;line-height:1.5 !important;">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
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

    // 🔗 내부 링크 자동 삽입 (H2 섹션 사이드)
    try {
      const URLData = loadEnvFromFile();
      const blogUrl = URLData['BLOGGER_URL'] || URLData['TISTORY_URL'] || URLData['WP_URL'] || payload.url || '';

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

    // 🛒 1순위: 크롤러 수집 상품 이미지 (productImages가 있으면 첫 번째 이미지를 썸네일로 사용)
    if (payload.productImages?.length > 0) {
      thumbnailUrl = payload.productImages[0];
      onLog?.(`[PROGRESS] 90% - 🛒 수집된 상품 이미지로 썸네일 설정 (${payload.productImages.length}장 중 1번째)`);
      console.log(`[THUMBNAIL] ✅ 수집 이미지 썸네일: ${thumbnailUrl.substring(0, 60)}...`);
    }

    // 🔥 thumbnailSource: 사용자 선택 값 (imagefx, nanobananapro, text 등)
    const thumbnailSource = payload.thumbnailSource || payload.thumbnailType || payload.thumbnailMode || 'imagefx';

    // 🎯 썸네일 디스패치: 사용자 선택 엔진 → 실패 시 폴백 → 최종 SVG
    if (!thumbnailUrl) {
      onLog?.(`[PROGRESS] 90% - 🖼️ 썸네일 생성 중 (${thumbnailSource})...`);
      try {
        const thumbResult = await dispatchThumbnailGeneration(
          thumbnailSource,
          h1,
          keyword,
          (msg) => onLog?.(`   ${msg}`),
        );
        if (thumbResult.ok) {
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

    return {
      html,
      title: h1,
      labels: hashtags.split(',').map(t => t.trim()).slice(0, 15),
      thumbnail: thumbnailUrl,
    };

  } catch (error: any) {
    const msg = error?.message || String(error);
    const isApiError = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|timeout|ECONNREFUSED|ENOTFOUND/i.test(msg);
    if (isApiError) {
      onLog?.(`[PROGRESS] 0% - ❌ AI API 연결 실패: ${msg.substring(0, 100)}`);
      onLog?.('💡 해결 방법: 잠시 후 다시 시도하거나, API 키와 인터넷 연결을 확인해주세요.');
    } else {
      onLog?.(`[PROGRESS] 0% - ❌ 콘텐츠 생성 오류: ${msg.substring(0, 100)}`);
    }
    throw error;
  }
}

