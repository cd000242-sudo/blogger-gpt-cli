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
  let h2Titles: string[] | null = null;
  if (activeSections.length > 0) {
    h2Titles = activeSections.map(sec => {
      const title = sec.title || '';
      return title
        .replace(/\[주제\]/g, keyword)
        .replace(/\[실전 경험\]/g, `${keyword} 실전 경험`)
        .replace(/\[소주제\]/g, keyword);
    });
  }

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
