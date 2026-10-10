/**
 * v3.8.761 — 젠스파크 AI 이미지를 고를 수 있는 모든 자리. 리더스 나노바나나(Dropshot)가 있는 목록마다 바로 뒤에 짝으로 있다.
 * (조용한 미배선 방지 — 한 목록에만 빠지면 그 화면에서는 고를 수 없다)
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

function pairedAfterDropshot(src: string): { dropshot: number; paired: number } {
  const lines = src.split(/\r?\n/);
  let dropshot = 0;
  let paired = 0;
  lines.forEach((line, i) => {
    if (!/<option value="dropshot-nanobanana-pro"/.test(line)) return;
    dropshot += 1;
    if (lines.slice(i + 1, i + 3).some((l) => /<option value="genspark-image"/.test(l))) paired += 1;
  });
  return { dropshot, paired };
}

describe('v3.8.761 젠스파크 이미지 선택지', () => {
  test('⭐ 메인 화면: 드롭샷 선택지마다 젠스파크가 짝으로 있다', () => {
    const r = pairedAfterDropshot(read('electron/ui/index.html'));
    expect(r.dropshot).toBeGreaterThanOrEqual(8);
    expect(r.paired).toBe(r.dropshot);
  });

  test('묶음 제목이 있는 목록에서는 젠스파크 묶음 제목이 따로 있다(드롭샷으로 오해하지 않게)', () => {
    const html = read('electron/ui/index.html');
    expect((html.match(/✨ 젠스파크 \(본인 계정 로그인 · 설정 콘텐츠 탭\)/g) || []).length).toBe(2);
    expect((html.match(/─── ✨ 젠스파크 ───/g) || []).length).toBe(2);
  });

  test('⭐ 대기열 화면: 추가 목록 2곳 · 항목 편집 2곳 · 표시 이름', () => {
    const q = read('electron/ui/modules/publish-queue.js');
    expect(pairedAfterDropshot(q).paired).toBe(pairedAfterDropshot(q).dropshot);
    expect(q).toContain("'genspark-image': '젠스파크',");
    expect(q).toContain("${item.thumb === 'genspark-image' ? 'selected' : ''}");
    expect(q).toContain("${item.h2ImageSource === 'genspark-image' ? 'selected' : ''}");
  });

  test('다중계정 목록 · 비용 표 2곳(0원)', () => {
    expect(read('electron/ui/modules/multi-account.js')).toContain("['genspark-image', 'Genspark AI Image'],");
    expect((read('electron/ui/script.js').match(/'genspark-image': 0,/g) || []).length).toBe(2);
  });
});
