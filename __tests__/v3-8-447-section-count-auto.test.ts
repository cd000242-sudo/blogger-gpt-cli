/**
 * v3.8.447 — 소제목 수가 늘 5개로 잘리던 문제
 *
 * 사용자 지적: "5개로만 되어있다면 글이 억지로 5개를 만들거나 정보가 더있는데도
 *   5개만 만들수도있는 경우의수가 존재하자나 그럼안되지 정보를 주려면
 *   확실하게줘야되니까"
 *
 * 실태:
 *   · generation.ts 는 이미 재료 양에 따라 5~10개로 늘린다(targetCount).
 *   · 그런데 `Math.min(targetCount, maxCount)` 로 상한이 걸리는데,
 *     posting.js 가 **존재하지도 않는 #sectionCount** 를 읽고 기본값 5 를
 *     payload 에 실어 보냈다. 그래서 재료가 10개어치여도 늘 5개로 잘렸다.
 *
 * 해법: 고르는 UI 가 없으면 0(자동)을 보내 상한을 걸지 않는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const posting = read('electron/ui/modules/posting.js');
const orch = read('src/core/final/orchestration.ts');
const gen = read('src/core/final/generation.ts');
const indexHtml = read('electron/ui/index.html');

describe('① 유령 5가 payload 에 실리지 않는다', () => {
  it('⭐⭐ 기본값이 0(자동)이다', () => {
    expect(posting).toContain('sectionCount: 0,');
    expect(posting).not.toContain('sectionCount: 5,');
  });

  it('⭐⭐ 고르는 UI 가 없으면 0을 돌려준다', () => {
    const fn = blockBetween(posting, 'function getSectionCount() {', '\n/** 수동 CTA 수집 */');
    expect(fn).toContain('if (!sectionCountSelect) return 0;');
  });

  it('⭐ UI 가 생기면 그 값이 그대로 상한으로 쓰인다 (배선 유지)', () => {
    const fn = blockBetween(posting, 'function getSectionCount() {', '\n/** 수동 CTA 수집 */');
    expect(fn).toContain('PAYLOAD_DEFAULTS.minSectionCount');
    expect(fn).toContain('PAYLOAD_DEFAULTS.maxSectionCount');
  });

  it('⭐⭐ 0 이어도 분량 하한이 사라지지 않는다', () => {
    // sectionCount * 1200 을 그대로 두면 0자가 되어 길이 게이트가 통째로 없어진다
    expect(posting).toContain('const charBasisSections = sectionCount > 0 ? sectionCount : 5;');
    expect(posting).not.toContain('const dynamicMinChars = sectionCount * 1200;');
  });
});

describe('② 백엔드는 0이면 상한을 걸지 않는다', () => {
  it('⭐ 0/undefined 면 maxH2Count 를 넘기지 않는다', () => {
    expect(orch).toContain('payload.sectionCount > 0)');
    expect(orch).toContain(': undefined;');
  });

  it('⭐ 자동인지 지정인지 로그로 구분된다', () => {
    expect(orch).toContain('재료에 맞춰 자동 결정');
    expect(orch).toContain('사용자 지정');
  });

  /**
   * v3.8.452 에 사다리가 바뀌었다 — 기준이 uniqueCount 에서 materialCount
   * (고유 소제목 + 검색자 신호)로 넓어졌고, 얇은 주제는 3~4개까지 내려간다.
   * 이 테스트의 의도는 그대로다: **재료에 따라 개수가 움직이는 로직이 살아 있는가.**
   * 하한 정책 자체는 v3-8-452-section-count-honest.test.ts 가 따로 고정한다.
   */
  it('⭐⭐ 재료 기반 확장 로직은 그대로 살아 있다', () => {
    // 이 사다리가 사라지면 자동으로 둬도 의미가 없다
    expect(gen).toContain('const materialCount = uniqueCount + demandCount;');
    expect(gen).toContain('else targetCount = 10;');
    expect(gen).toContain('if (rawSignalCount >= 50) targetCount = Math.max(targetCount, 8);');
  });

  it('⭐ 상한은 여전히 상한으로 작동한다 (사용자가 지정했을 때)', () => {
    expect(gen).toContain('targetCount = Math.min(targetCount, Math.floor(maxCount));');
  });
});

describe('③ 화면이 없는 숫자를 지어내지 않는다', () => {
  it('⭐⭐ 고정 섹션 모드가 아니면 개수를 적지 않는다', () => {
    const fn = blockBetween(indexHtml, 'window.__syncH2ImageModeLabels = function', '\n    // v3.8.436');
    expect(fn).toContain('if (!total) {');
    expect(fn).toContain('본문 전체');
  });

  it('⭐ 쇼핑·페러프레이징은 고정 개수를 그대로 보여준다', () => {
    expect(indexHtml).toContain('MODE_FIXED_SECTIONS = { shopping: 8, paraphrasing: 6 }');
    const fn = blockBetween(indexHtml, 'window.__syncH2ImageModeLabels = function', '\n    // v3.8.436');
    expect(fn).toContain('const fixed = MODE_FIXED_SECTIONS[mode];');
  });
});
