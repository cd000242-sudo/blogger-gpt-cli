/**
 * 안전망 — 프롬프트가 "공식 사이트에서 확인하세요"식 회피를 지시하지 않는다 (v3.8.382)
 *
 * 배경: substance-gate.ts의 DEFERRAL_PATTERNS는 "공식 사이트에서 확인" 류를 실속 미달로 잡는다.
 *   그런데 gemini-engine.ts의 grounding 폴백 프롬프트가 모델에게 정확히 그 문장을 쓰라고
 *   지시하고 있었다 — 게이트의 탈락 사유를 엔진이 생산하던 자기모순.
 *   (실측 2026-07-26: 실속 점수 41/60, 팩트 1.55/1000자 → 재생성 발동 → 비용 낭비)
 *
 * 이 테스트는 프롬프트 소스에 "회피 지시"가 다시 들어오는 것을 막는다.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');

/** 모델에게 회피 문장을 쓰라고 시키는 지시 패턴 (영문/한글) */
const INSTRUCTS_DEFERRAL: RegExp[] = [
  /write that the reader should confirm it on the official site/i,
  /tell the reader to check the official (site|website)/i,
  /"공식 사이트에서 확인하는 것이 가장 정확해요"처럼/,
];

describe('프롬프트 회피 지시 금지 (v3.8.382)', () => {
  const files = [
    'src/core/final/gemini-engine.ts',
    'src/core/final/generation.ts',
  ];

  it.each(files)('%s 가 모델에게 회피 문장을 지시하지 않는다', (rel) => {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    INSTRUCTS_DEFERRAL.forEach(pattern => {
      expect(src).not.toMatch(pattern);
    });
  });

  it('grounding 폴백 프롬프트가 대체 지시(판단 기준·절차·확인 경로)를 담는다', () => {
    const src = fs.readFileSync(path.join(REPO, 'src/core/final/gemini-engine.ts'), 'utf8');
    const idx = src.indexOf('Search grounding is unavailable');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 1200);
    expect(block).toMatch(/판단 기준/);
    expect(block).toMatch(/절차/);
    expect(block).toMatch(/기관명/);
  });

  it('실속 게이트의 회피 패턴과 프롬프트 지시가 충돌하지 않는다 (교차 검증)', () => {
    // substance-gate가 잡는 문구를 프롬프트가 예시로 "쓰라고" 제시하면 안 된다.
    // (금지 예시로 인용하는 것은 허용 — 그래서 '쓰지 마라' 문맥을 함께 확인한다)
    const engine = fs.readFileSync(path.join(REPO, 'src/core/final/gemini-engine.ts'), 'utf8');
    const idx = engine.indexOf('공식 사이트에서 확인하세요');
    if (idx >= 0) {
      const around = engine.slice(Math.max(0, idx - 120), idx + 120);
      expect(around).toMatch(/끝내지 마라|금지|쓰지 마라|하지 마라/);
    }
  });
});
