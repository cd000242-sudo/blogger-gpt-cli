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
  keyword: string
): ModeDispatchResult {
  const defaultResult: ModeDispatchResult = {
    h2Titles: null,
    sectionPromptBlock: '',
    cssPlugin: null,
    postProcessPlugin: null,
    handledByPlugin: false,
  };

  if (!contentMode || contentMode === 'external') {
    return defaultResult;
  }

  // 레지스트리에서 플러그인 조회
  const plugin = getMode(contentMode);
  if (!plugin) {
    console.log(`[MODE-DISPATCH] 모드 '${contentMode}' 플러그인 미등록 — 기존 로직 사용`);
    return defaultResult;
  }

  console.log(`[MODE-DISPATCH] 모드 '${contentMode}' 플러그인 발견: ${plugin.config.name}`);

  // H2 제목: 플러그인의 sections에서 가져오기
  let h2Titles: string[] | null = null;
  if (plugin.sections && plugin.sections.length > 0) {
    h2Titles = plugin.sections.map(sec => {
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
    // 모든 섹션에 대한 통합 프롬프트 생성
    const sectionGuides = (plugin.sections || []).map((sec, idx) => {
      const params = {
        topic: keyword,
        keywords: [keyword],
        section: sec,
        subtopic: sec.title || '',
      };
      try {
        return `[섹션 ${idx + 1}: ${sec.title}]\n${plugin.buildSectionPrompt(params)}`;
      } catch {
        return `[섹션 ${idx + 1}: ${sec.title}]\n${sec.description || ''}`;
      }
    });

    if (sectionGuides.length > 0) {
      sectionPromptBlock = `\n\n📋 [${plugin.config.name} 모드 — 플러그인 가이드]\n${sectionGuides.join('\n\n')}`;
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
