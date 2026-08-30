/**
 * v3.8.610 — "위치 좌표만 간다"
 *
 * 사장님: "사용법클릭하면 선택해야하는 곳으로바로가야되는데 위치좌표만가거든"
 *
 * 예전엔 곧장 scrollIntoView 만 했다. 대상 입력칸이 닫힌 설정 모달·안 보이는 탭·
 * 접힌 아코디언 안에 있으면 브라우저는 **"있었을 자리"로만 스크롤**하고
 * 화면에는 아무것도 안 나타난다. 그게 "좌표만 간다" 의 정체다.
 *
 * 순서를 바꿨다: 조상을 펼치고 → 탭을 맞추고 → 스크롤·포커스 → 잠깐 테두리 표시.
 */
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(
  path.join(__dirname, '..', 'electron/ui/modules/oneclick-setup.js'),
  'utf-8',
);

describe('가기 전에 보이게 만든다', () => {
  test('펼치는 함수가 있다', () => {
    expect(src).toContain('function revealOneclickControl');
  });

  test('닫힌 설정 모달을 연다', () => {
    expect(src).toContain('window.openSettingsModal');
    expect(src).toMatch(/closest\('\.settings-modal/);
  });

  test('안 보이는 탭으로 옮긴다', () => {
    expect(src).toContain('window.showTab');
  });

  test('접힌 details·hidden 조상을 편다', () => {
    expect(src).toContain("node.tagName === 'DETAILS'");
    expect(src).toContain("removeAttribute('hidden')");
  });
});

describe('가고 나서 어디인지 보여준다', () => {
  test('잠깐 테두리를 씌운다 — 스크롤만 하면 눈이 못 따라간다', () => {
    expect(src).toContain('function highlightOneclickControl');
    expect(src).toContain('3px solid #f59e0b');
  });

  test('테두리는 원래대로 되돌린다', () => {
    expect(src).toMatch(/el\.style\.outline = prev\.outline/);
  });

  test('펼친 직후가 아니라 한 프레임 뒤에 스크롤한다 — 좌표가 아직 안 잡혔다', () => {
    expect(src).toMatch(/requestAnimationFrame\(\(\) => \{[\s\S]{0,200}scrollIntoView/);
  });

  test('포커스가 스크롤을 되돌리지 않게 한다', () => {
    expect(src).toContain('focus?.({ preventScroll: true })');
  });
});

describe('이동이 한 곳을 지난다', () => {
  test('없는 id 면 조용히 넘어가지 않고 알린다', () => {
    expect(src).toContain('이동할 대상을 찾지 못했습니다');
  });

  test('맨몸 scrollIntoView 호출이 남아 있지 않다', () => {
    // 주석·헬퍼 안의 것만 남고, 곧장 부르는 호출은 없어야 한다
    const bare = src.match(/getElementById\([^)]+\)\?\.scrollIntoView/g) || [];
    expect(bare).toHaveLength(0);
  });

  test('변수로 들고 있던 대상도 펼친 뒤 간다', () => {
    expect(src).toMatch(/revealOneclickControl\(target\)[\s\S]{0,120}scrollIntoView/);
    expect(src).toMatch(/revealOneclickControl\(checkbox\)[\s\S]{0,120}scrollIntoView/);
  });
});
