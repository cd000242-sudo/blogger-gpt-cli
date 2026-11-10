import { readFileSync } from 'fs';
import { resolve } from 'path';

// Measured 2026-11-10: the 12-second goldShimmer on the header title kept the renderer at 45-55% CPU and the GPU
// at 115-140% right after launch, dropping to under 2% as soon as it stopped.
describe('앱 시작 직후 헤더 제목 애니메이션', () => {
  it('헤더 제목이 금색 반짝임 애니메이션을 돌리지 않는다', () => {
    const html = readFileSync(resolve(__dirname, '..', 'electron', 'ui', 'index.html'), 'utf8');
    const titleTag = html.slice(html.indexOf('class="header-title"'), html.indexOf('LEADERNAM ORBIT</h1>'));
    expect(titleTag.length).toBeGreaterThan(0);
    expect(titleTag).not.toMatch(/goldShimmer/);
  });
});
