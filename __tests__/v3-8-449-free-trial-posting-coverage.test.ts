/**
 * v3.8.449 — 무료 체험 3회 안에서 글포스팅 기능이 막히던 곳
 *
 * 사용자 지시: "무료체험으로 들어오면 3회 발행 가능하자나 어떤모드든지 되어야하는데
 *   … 막힌게있으면안되 3회동안은 글포스팅에있는 기능은 모두 쓸수있어야되"
 *
 * 감사 결과 글포스팅 경로에서 3곳이 라이선스 게이트에 걸리고 있었다.
 * 이미지 디스패처는 `extra.allowFreeTrialPublishing === true` 일 때만 체험을 통과시키는데,
 * 이 세 곳이 플래그를 안 넘겼다.
 *   ① 쇼핑모드 product-i2i 본문 이미지 (orchestration)
 *   ② 내부 일관성 모드 썸네일 (main)
 *   ③ 내부 일관성 모드 본문 이미지 (main)
 *
 * ⚠️ 발행 횟수 제한은 별개다 — enforceFreeTier(FREE_TRIAL_PUBLISH_LIMIT=3)가
 *    run-post·publish-content 양쪽에서 막으므로, 기능을 열어도 무제한이 되지 않는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const orch = read('src/core/final/orchestration.ts');
const main = read('electron/main.ts');
const auth = read('electron/auth-utils.ts');
const dispatcher = read('src/core/imageDispatcher.ts');

describe('① 쇼핑모드 product-i2i 가 체험에서 막히지 않는다', () => {
  it('⭐⭐ i2i 호출이 체험 발행 플래그를 넘긴다', () => {
    const block = blockBetween(orch, 'const i2i = await dispatchH2ImageGeneration(', 'if (i2i.ok && i2i.dataUrl)');
    expect(block).toContain('allowFreeTrialPublishing: true');
    expect(block).toContain('referenceImageList: refs');
  });
});

describe('② 내부 일관성 모드(단일 일관)가 체험에서 이미지를 만들 수 있다', () => {
  it('⭐⭐ 썸네일이 플래그를 넘긴다', () => {
    const block = blockBetween(main, 'const thumbResult = await dispatchThumbnailGeneration(', 'if (thumbResult && thumbResult.ok');
    expect(block).toContain('allowFreeTrialPublishing: true');
  });

  it('⭐⭐ 본문 이미지가 플래그를 넘긴다', () => {
    const block = blockBetween(main, 'const h2Result = await dispatchH2ImageGeneration(', 'const hasDataUrl =');
    expect(block).toContain('allowFreeTrialPublishing: true');
  });
});

describe('③ 발행 횟수 3회 제한은 그대로다 (기능을 열어도 무제한이 아니다)', () => {
  it('⭐⭐ 한도는 3회로 고정', () => {
    expect(auth).toContain('export const FREE_TRIAL_PUBLISH_LIMIT = 3;');
  });

  it('⭐⭐ 단일 발행·발행 양쪽 경로에서 한도를 건다', () => {
    const enforced = main.match(/await enforceFreeTier\(\)/g) || [];
    expect(enforced.length).toBeGreaterThanOrEqual(2);
  });

  it('⭐ 실제 발행이 끝났을 때만 카운트한다', () => {
    expect(auth).toContain('실제 발행 완료 후에만 무료 체험 사용량을 1회 기록한다');
    expect(main).toContain('await recordFreeTrialPublishCompletion()');
  });
});

describe('④ 유료 전용 경계는 유지된다 (열어선 안 되는 곳)', () => {
  it('⭐⭐ 거미줄·외부유입은 백엔드에서 계속 차단', () => {
    expect(auth).toContain('거미줄 포스팅');
    expect(auth).toContain('외부유입 글 생성');
    expect(auth).toContain('export async function enforceFreeTrialPostingWorkflow');
  });

  it('⭐⭐ 독립 이미지 생성은 발행 컨텍스트일 때만 통과', () => {
    expect(main).toContain('allowFreeTrialPublishing: payload?.publishContext === true');
  });

  it('⭐ 디스패처는 명시 플래그가 없으면 체험을 통과시키지 않는다', () => {
    expect(dispatcher).toContain('allowFreeTrialPublishing: extra?.allowFreeTrialPublishing === true');
  });
});
