/**
 * v3.8.602 — 「먹과 놋쇠」 스킨 적용
 *
 * 사장님 승인: "합격 승인" (목업 2안)
 * 요구: "보기편한 색상과 조화롭고 화려하면서 고급지며 현대 트렌디함이 묻어나오고
 *        AI티가 전혀 나지 않은 사람냄새가 물씬"
 */
import { generateCSSFinal } from '../src/core/final/html';
import * as fs from 'fs';
import * as path from 'path';

const css = generateCSSFinal('wordpress');
const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('글마다 색이 바뀌지 않는다', () => {
  test('열 번 생성해도 같은 팔레트다 — 무작위 선택을 멈췄다', () => {
    const runs = new Set(Array.from({ length: 10 }, () => generateCSSFinal('wordpress')));
    expect(runs.size).toBe(1);
  });

  test('먹청·놋쇠·한지빛이 실려 나간다', () => {
    expect(css).toContain('#0C453F');   // 먹청
    expect(css).toContain('#A98A4B');   // 놋쇠
    expect(css).toContain('#FAF9F6');   // 한지
  });
});

describe('AI 티가 나던 것들을 걷는다', () => {
  test('주황 세로줄이 사라졌다 — 자동생성 티의 1순위', () => {
    expect(css).not.toContain('#FF6B35');
    // 제목에서 좌측 테두리를 명시적으로 0 으로 되돌린다
    expect(css).toMatch(/\.bgpt-content h2[\s\S]*?border-left: 0/);
  });

  test('제목이 명조로 선다', () => {
    expect(css).toMatch(/\.bgpt-content h2[\s\S]*?Gowun Batang/);
  });

  test('본문 이미지의 둥근 모서리·그림자를 없앤다', () => {
    expect(css).toMatch(/\.bgpt-content img[\s\S]*?border-radius: 0/);
    expect(css).toMatch(/\.bgpt-content img[\s\S]*?box-shadow: none/);
  });
});

describe('숫자가 답이다', () => {
  test('표의 값 칸은 고정폭 숫자로 나온다', () => {
    expect(css).toMatch(/td:last-child[\s\S]*?tabular-nums/);
    expect(css).toMatch(/td:last-child[\s\S]*?IBM Plex Mono/);
  });

  test('표 머리는 채우지 않고 놋쇠 선 하나로 긋는다', () => {
    expect(css).toMatch(/\.bgpt-content th[\s\S]*?background: none/);
    expect(css).toMatch(/\.bgpt-content th[\s\S]*?border-bottom: 1px solid var\(--ink-brass\)/);
  });
});

describe('깊은 색은 답 한 곳에만', () => {
  test('답 상자에만 먹청 그라데이션이 깔린다', () => {
    expect(css).toMatch(/\.tldr-answer-box[\s\S]*?linear-gradient\(160deg,#0C453F/);
  });

  test('답 상자 위에 놋쇠 선이 지나간다', () => {
    expect(css).toMatch(/\.tldr-answer-box::after[\s\S]*?#C2A063/);
  });
});

describe('제목 인라인 스타일을 걷어야 스킨이 이긴다', () => {
  const orchestration = read('src/core/final/orchestration.ts');

  test('H2 를 클래스만으로 내보낸다', () => {
    expect(orchestration).toContain('html += `\\n<h2 id="section-${idx}">${h2Number} ${cleanH2}</h2>\\n`');
  });

  test('주황 세로줄을 style 속성으로 내보내지 않는다', () => {
    // 주석에 남은 설명("여기 박혀 있던 …")은 코드가 아니다 — style 속성 안만 본다
    expect(orchestration).not.toMatch(/style="[^"]*FF6B35/);
  });
});
