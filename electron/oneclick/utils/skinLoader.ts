// electron/oneclick/utils/skinLoader.ts
// 블로그 스킨 CSS 로드 유틸

import * as path from 'path';
import * as fs from 'fs';

const CSS_FILES: Record<string, string> = {
  blogspot: 'blogspot-cloud-skin.css',
  wordpress: 'cloud-skin.css',
};

/**
 * 스킨 CSS 파일을 읽어 문자열로 반환한다.
 * 파일이 없으면 빈 문자열을 반환한다.
 */
export function loadSkinCSS(type: 'blogspot' | 'wordpress'): string {
  try {
    const cssName = CSS_FILES[type];
    if (!cssName) return '';

    const cssPath = path.join(__dirname, '..', 'ui', cssName);
    if (fs.existsSync(cssPath)) {
      return fs.readFileSync(cssPath, 'utf-8');
    }
  } catch (e) {
    console.error(`[ONECLICK] 스킨 CSS 로드 실패:`, e);
  }
  return '';
}
