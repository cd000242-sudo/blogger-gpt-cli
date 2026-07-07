// electron/oneclick/utils/skinLoader.ts
// 블로그 스킨 CSS 로드 유틸

import * as path from 'path';
import * as fs from 'fs';

export type SkinType = 'blogspot' | 'blogspot-approval' | 'wordpress';

const CSS_FILES: Record<SkinType, string> = {
  blogspot: 'blogspot-cloud-skin.css',
  'blogspot-approval': 'blogspot-approval-revenue-skin.css',
  wordpress: 'cloud-skin.css',
};

function getCandidateSkinPaths(cssName: string): string[] {
  return [
    path.resolve(__dirname, '..', '..', 'ui', cssName),
    path.resolve(__dirname, '..', '..', '..', 'dist', 'ui', cssName),
    path.resolve(process.cwd(), 'electron', 'ui', cssName),
    path.resolve(process.cwd(), 'dist', 'ui', cssName),
    path.resolve(__dirname, '..', 'ui', cssName),
  ];
}

/**
 * 스킨 CSS 파일을 읽어 문자열로 반환한다.
 * 파일이 없으면 빈 문자열을 반환한다.
 */
export function loadSkinCSS(type: SkinType): string {
  try {
    const cssName = CSS_FILES[type];
    if (!cssName) return '';

    const candidates = getCandidateSkinPaths(cssName);
    for (const cssPath of candidates) {
      if (fs.existsSync(cssPath)) {
        return fs.readFileSync(cssPath, 'utf-8');
      }
    }

    console.warn(`[ONECLICK] skin CSS not found: ${cssName}`, candidates);
  } catch (e) {
    console.error(`[ONECLICK] 스킨 CSS 로드 실패:`, e);
  }
  return '';
}
