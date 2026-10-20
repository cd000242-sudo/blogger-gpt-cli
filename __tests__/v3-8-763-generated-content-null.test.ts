/**
 * v3.8.763 — "Codex 산출물 적용에 실패했습니다: Cannot set properties of null (setting 'title')"
 *
 * 발행 직후·초기화(posting.js 495·1210·1436·1440, preview.js 310, publish-queue.js 2550)는 appState.generatedContent 를 null 로 비운다.
 * 그런데 결과를 넣는 쪽 네 곳은 그릇이 늘 있다고 보고 `.title =` 을 바로 썼다 → 한 번 발행한 뒤 Codex 산출물을 적용하면 이 오류.
 * 넣기 전에 비어 있으면 새 그릇을 만든다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const SITES: Array<[string, string]> = [
  ['electron/ui/modules/codex-workshop.js', 'appState.generatedContent.title = title;'],
  ['electron/ui/modules/posting.js', 'appState.generatedContent.title = title;'],
  ['electron/ui/modules/preview.js', 'appState.generatedContent.title = result.title || keyword;'],
  ['electron/ui/script.js', 'appState.generatedContent.title = result.title || keyword;'],
];

describe('v3.8.763 결과 그릇이 비어 있어도 넣는다', () => {
  test.each(SITES)('⭐ %s — 제목을 넣기 직전에 빈 그릇을 채운다', (file, write) => {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    const at = src.indexOf(write);
    expect(at).toBeGreaterThan(-1);
    const before = src.slice(src.lastIndexOf('\n', src.lastIndexOf('\n', at) - 1), at);
    expect(before).toContain('if (!appState.generatedContent) appState.generatedContent = {};');
  });

  test('실제로 null 인 상태에서 넣어도 던지지 않는다(같은 두 줄을 그대로 실행)', () => {
    const appState: any = { generatedContent: null };
    expect(() => {
      if (!appState.generatedContent) appState.generatedContent = {};
      appState.generatedContent.title = '제목';
    }).not.toThrow();
    expect(appState.generatedContent.title).toBe('제목');
  });
});
