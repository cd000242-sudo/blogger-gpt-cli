/**
 * 모드 디스패처 — orchestration.ts의 하드코딩 모드 분기를 플러그인 레지스트리로 위임
 *
 * 기존 문제: orchestration.ts에서 contentMode를 if-else로 분기하여
 * 각 모드의 프롬프트 블록을 인라인으로 삽입했음.
 *
 * 해결: 레지스트리에 등록된 플러그인이 있으면 우선 사용하고,
 * 없으면 기존 하드코딩 로직으로 폴백.
 */

import { getMode, hasMode } from '../content-modes/mode-registry';
import type { ContentModePlugin } from '../content-modes/mode-interface';

export interface ModeDispatchResult {
  /** 플러그인에서 가져온 H2 제목 배열 (null이면 AI 생성 필요) */
  h2Titles: string[] | null;
  /** 본문 생성에 삽입할 모드별 프롬프트 블록 */
  sectionPromptBlock: string;
  /** CSS 생성 시 사용할 플러그인 (null이면 기본 CSS) */
  cssPlugin: ContentModePlugin | null;
  /** 후처리 플러그인 (null이면 후처리 없음) */
  postProcessPlugin: ContentModePlugin | null;
  /** 플러그인이 처리했는지 여부 */
  handledByPlugin: boolean;
}

/**
 * contentMode에 따라 적절한 플러그인을 찾아 디스패치한다.
 * 플러그인이 없으면 handledByPlugin: false를 반환하여
 * orchestration이 기존 로직을 사용하도록 한다.
 */
export function dispatchMode(
  contentMode: string,
  keyword: string,
  options?: { authorInfo?: { name: string; title: string; credentials: string } }
): ModeDispatchResult {
  const defaultResult: ModeDispatchResult = {
    h2Titles: null,
    sectionPromptBlock: '',
    cssPlugin: null,
    postProcessPlugin: null,
    handledByPlugin: false,
  };

  if (!contentMode) {
    return defaultResult;
  }

  // 레지스트리에서 플러그인 조회
  const plugin = getMode(contentMode);
  if (!plugin) {
    console.log(`[MODE-DISPATCH] 모드 '${contentMode}' 플러그인 미등록 — 기존 로직 사용`);
    return defaultResult;
  }

  console.log(`[MODE-DISPATCH] 모드 '${contentMode}' 플러그인 발견: ${plugin.config.name}`);

  // 🛡️ 애드센스 모드: 저자 프로필이 없으면 personal_experience 섹션 자동 제거
  // (허위 1인칭 경험담 생성 방지 — 구글 E-E-A-T 위반 리스크)
  let activeSections = plugin.sections || [];
  const hasAuthorInfo = !!(options?.authorInfo?.name && options.authorInfo.name.trim());
  if (contentMode === 'adsense' && !hasAuthorInfo) {
    const before = activeSections.length;
    activeSections = activeSections.filter(sec => sec.id !== 'personal_experience');
    if (activeSections.length < before) {
      console.log(`[MODE-DISPATCH] 🛡️ 저자 프로필 미입력 → personal_experience 섹션 자동 제외 (${before}→${activeSections.length})`);
    }
  }

  // 🎲 애드센스 모드: 중간 섹션 셔플 + minChars ±20% 지터
  // (patterned content 탐지 방지 — 같은 주제 여러 글이 동일 구조면 scaled abuse 플래그)
  if (contentMode === 'adsense' && activeSections.length >= 4) {
    const first = activeSections[0]!;          // author_intro 고정
    const last = activeSections[activeSections.length - 1]!;  // conclusion 고정
    const middle = activeSections.slice(1, -1);
    // Fisher-Yates 셔플
    for (let i = middle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [middle[i], middle[j]] = [middle[j]!, middle[i]!];
    }
    // minChars 지터 (각 섹션 ±20%)
    const jittered = [first, ...middle, last].map(sec => {
      const original = (sec as any).minChars || 800;
      const jitter = 1 + (Math.random() * 0.4 - 0.2); // 0.8 ~ 1.2
      return { ...sec, minChars: Math.round(original * jitter) };
    });
    activeSections = jittered;
    console.log(`[MODE-DISPATCH] 🎲 애드센스 섹션 셔플 + minChars 지터 적용 (patterned content 방지)`);
  }

  // H2 제목: 활성 섹션에서 가져오기 (빈 배열이면 null → AI 생성 위임)
  // v3.5.97: 단순 string replace로는 "방법란" 같은 어색한 조사 처리 불가.
  //   - 받침 자동 검사로 "이란/란", "은/는", "을/를" 등 자연스럽게 치환
  //   - 키워드가 매우 길면 (>15자) 후행 보일러플레이트("실전 활용 가이드" 등)를 더 간결하게 단축
  //   - 같은 글마다 동일 H2 → 검색 의도 다양화 위해 패턴 풀에서 일부 랜덤 변형
  const hasFinalConsonant = (word: string): boolean => {
    if (!word) return false;
    const lastChar = word.charCodeAt(word.length - 1);
    if (lastChar < 0xAC00 || lastChar > 0xD7A3) return false; // 한글 음절이 아니면 받침 판정 불가
    return (lastChar - 0xAC00) % 28 !== 0;
  };
  // 조사 자동 처리: 키워드 + 조사 패턴
  const josa = (word: string, withFinal: string, withoutFinal: string): string =>
    `${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`;

  // 보일러플레이트 패턴 변형 풀 (같은 의미, 다양한 표현)
  const variantPools: Record<string, string[]> = {
    '란 무엇인가': ['란 무엇인가', '의 의미와 특징', '핵심 정리', ' 한눈에 보기', ' 완전 정복'],
    '의 핵심 특성과 원리': ['의 핵심 특성과 원리', ' 작동 원리 알아보기', '의 주요 특징과 장점', ' 제대로 이해하기'],
    ' 실전 활용 가이드': [' 실전 활용 가이드', ' 단계별 실행 방법', ' 실전 적용 노하우', ' 따라하기 쉬운 방법'],
    ' 비교 및 선택 가이드': [' 비교 및 선택 가이드', ' 종류별 장단점 비교', ' 어떤 게 좋을까', ' 선택 기준 총정리'],
    ' 자주 묻는 질문과 마무리': [' 자주 묻는 질문 (FAQ)', ' Q&A 핵심 정리', '에 대한 궁금증 해결', ' 자주 묻는 질문 모음'],
  };
  const pickVariant = (key: string, seed: number): string => {
    const pool = variantPools[key];
    if (!pool || pool.length === 0) return key;
    return pool[seed % pool.length] || pool[0]!;
  };

  // 받침 처리: "[주제]란 무엇인가" → 받침 있으면 "[주제]이란 무엇인가"
  const applyJosaAndVariant = (raw: string, seed: number): string => {
    // 조사 처리: [주제]란 → 받침 있으면 [주제]이란
    let result = raw;
    if (/\[주제\]란\b/.test(result)) {
      result = result.replace(/\[주제\]란\b/g, josa(keyword, '이란', '란'));
      // 후행 패턴 변형 적용
      const variantSuffix = pickVariant('란 무엇인가', seed);
      result = result.replace(/(이란|란)\s*무엇인가/, variantSuffix.startsWith('란') || variantSuffix.startsWith('의') || variantSuffix.startsWith(' ')
        ? variantSuffix.replace(/^(란|의)/, (m) => m === '란' ? josa('', '이란', '란') : ` ${m}`)
        : ` ${variantSuffix}`);
    } else {
      result = result.replace(/\[주제\]/g, keyword);
    }
    // 다른 보일러플레이트 후행 패턴 변형
    for (const [boilerplate, _] of Object.entries(variantPools)) {
      if (boilerplate === '란 무엇인가') continue; // 위에서 처리
      if (result.includes(boilerplate)) {
        const variant = pickVariant(boilerplate, seed);
        result = result.replace(boilerplate, variant);
      }
    }
    result = result
      .replace(/\[실전 경험\]/g, `${keyword} 실전 경험`)
      .replace(/\[소주제\]/g, keyword);
    return result;
  };

  // v3.5.97: external 모드는 AI 동적 H2 생성으로 회귀.
  //   v3.5.81에서 정형 sections로 강제 → "예매하는 방법 작동 원리" 같은 의미 안 맞는 H2 발생
  //   external은 키워드 다양성이 가장 큰 모드 (이벤트성/시간성/정보형 모두 포함) → 정형 강제는 부자연스러움
  //   해결: sections는 prompt 가이드용으로만 유지(sectionPromptBlock), h2Titles는 null → AI가 키워드에 맞춰 동적 생성
  //   다른 모드(adsense/shopping/internal/paraphrasing)는 정형 유지 (각 모드별 정형 구조가 필수)
  let h2Titles: string[] | null = null;
  const isDynamicH2Mode = contentMode === 'external';
  if (activeSections.length > 0 && !isDynamicH2Mode) {
    // seed = 키워드 길이 + Date 한 자리 — 같은 키워드라도 매번 다른 변형
    const seedBase = (keyword?.length || 0) + Math.floor(Date.now() / 86400000) % 7;
    h2Titles = activeSections.map((sec, idx) => {
      const title = sec.title || '';
      return applyJosaAndVariant(title, seedBase + idx);
    });
  }
  // external 모드는 h2Titles=null 유지 → orchestration이 generateH2TitlesFinal로 AI 동적 생성

  // 섹션 프롬프트 블록: buildSectionPrompt로 생성
  let sectionPromptBlock = '';
  try {
    if (activeSections.length > 0) {
      // 섹션이 있는 모드 (adsense/internal/shopping/paraphrasing)
      const sectionGuides = activeSections.map((sec, idx) => {
        const params = {
          topic: keyword,
          keywords: [keyword],
          section: sec,
          subtopic: sec.title || '',
          authorInfo: options?.authorInfo,
        };
        try {
          return `[섹션 ${idx + 1}: ${sec.title}]\n${plugin.buildSectionPrompt(params)}`;
        } catch {
          return `[섹션 ${idx + 1}: ${sec.title}]\n${sec.description || ''}`;
        }
      });

      if (sectionGuides.length > 0) {
        sectionPromptBlock = `\n\n📋 [${plugin.config.name} — 플러그인 가이드]\n${sectionGuides.join('\n\n')}`;
      }
    } else {
      // 섹션이 빈 모드 (external/SEO) — 주제 기반 종합 가이드 1회 호출
      try {
        const params = {
          topic: keyword,
          keywords: [keyword],
          section: { id: 'general', title: keyword, description: '' } as any,
          subtopic: keyword,
          authorInfo: options?.authorInfo,
        };
        const generalGuide = plugin.buildSectionPrompt(params);
        if (generalGuide && generalGuide.trim().length > 0) {
          sectionPromptBlock = `\n\n📋 [${plugin.config.name} — 플러그인 가이드]\n${generalGuide}`;
        }
      } catch (e) {
        console.warn(`[MODE-DISPATCH] 섹션 없는 모드 프롬프트 빌드 실패: ${e}`);
      }
    }
  } catch (e) {
    console.warn(`[MODE-DISPATCH] 프롬프트 빌드 실패: ${e}`);
  }

  // CSS/후처리 플러그인
  const cssPlugin = plugin.generateCSS ? plugin : null;
  const postProcessPlugin = plugin.postProcess ? plugin : null;

  return {
    h2Titles,
    sectionPromptBlock,
    cssPlugin,
    postProcessPlugin,
    handledByPlugin: true,
  };
}
