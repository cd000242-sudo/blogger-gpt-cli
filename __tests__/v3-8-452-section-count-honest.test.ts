/**
 * v3.8.452 — 재료가 얇으면 억지로 5섹션을 채우지 않는다
 *
 * 사용자 판단: "강제하면 억지로 없는 내용이 나올수있으니까 신뢰와 글품질이
 *   우선이야 유지할필요없어"
 *
 * 예전에는 어떤 경우에도 최소 5개였다. 쓸 내용이 2~3개뿐인 주제에서 5개를
 * 요구하면 남는 칸은 지어내거나 뻔한 소리로 채워진다.
 *
 * ⚠️ 단, "크롤이 실패한 것"과 "주제가 얇은 것"은 다르다.
 *    수집 자체가 0건이면 얇다는 근거가 없으므로 예전값(5)을 유지한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const gen = read('src/core/final/generation.ts');
const orch = read('src/core/final/orchestration.ts');

describe('① 최소 5개 강제가 사라졌다', () => {
  const block = blockBetween(gen, 'const uniqueCount = sorted.length;', '// 크롤링 신호가 많으면');

  it('⭐⭐ 얇은 주제는 3~4개까지 내려간다', () => {
    expect(block).toContain('targetCount = 3;');
    expect(block).toContain('targetCount = 4;');
  });

  it('⭐ 예전의 "무조건 5" 사다리는 없어졌다', () => {
    expect(gen).not.toContain('if (uniqueCount <= 3) targetCount = 5;');
    expect(gen).not.toContain('else if (uniqueCount <= 5) targetCount = 5;');
  });

  it('⭐ 최대 10개 확장은 그대로다', () => {
    expect(block).toContain('targetCount = 10;');
  });
});

describe('② 크롤 실패와 얇은 주제를 구분한다', () => {
  const block = blockBetween(gen, 'const uniqueCount = sorted.length;', '// 크롤링 신호가 많으면');

  it('⭐⭐ 근거가 아예 없으면 예전값(5)을 유지한다', () => {
    expect(block).toContain('const noEvidence = rawSignalCount === 0 && demandCount === 0;');
    expect(block).toContain('if (noEvidence)');
  });

  it('⭐⭐ 재료는 크롤 소제목 + 검색자 신호를 함께 본다', () => {
    expect(block).toContain('const demandCount =');
    expect(block).toContain('demandSignals?.userQuestions');
    expect(block).toContain('demandSignals?.searchQueries');
    expect(block).toContain('const materialCount = uniqueCount + demandCount;');
  });

  it('⭐ 크롤 신호가 많으면 위로만 조정한다', () => {
    expect(gen).toContain('if (rawSignalCount >= 50) targetCount = Math.max(targetCount, 8);');
  });
});

describe('③ 짧은 글이 유료 재시도를 부르지 않는다 (비용 고정)', () => {
  it('⭐⭐ 분량 하한이 섹션 수에 비례한다', () => {
    expect(orch).toContain('const minPlainLen = Math.min(3000, sectionCountForGate * 800);');
    expect(orch).not.toContain('if (plainLen < 3000) {');
  });

  it('⭐ 상한은 3,000자로 유지 — 게이트의 원래 목적은 살아 있다', () => {
    expect(orch).toContain('Math.min(3000,');
  });

  it('⭐ 어떤 기준으로 판정했는지 로그에 남는다', () => {
    expect(orch).toContain('소제목 ${sectionCountForGate}개 기준');
  });
});
