/**
 * v3.8.458 — 사용자 발행 로그(와인 상품)에서 드러난 3건
 *
 *   ① 중지 무시 — "중지 요청" 로그 후에도 썸네일 폴백 체인이 nanobanana→prodia→
 *      gptimage1 을 8초 대기까지 끼워가며 계속 돌았다.
 *   ② 비용 누수 — 수집 사진 모드(crawled) 썸네일이 실패하자 유료 엔진 폴백
 *      체인에 진입했다. "수집 사진 그대로"는 비용 0 의도다.
 *   ③ "와인인데 왜 네이버로그인이 안뜨나요??" — 설정 버튼만으론 부족하다.
 *      발행 중 성인인증을 만나면 그 자리에서 창이 떠야 한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const dispatcher = read('src/core/imageDispatcher.ts');
const queue = read('src/core/image-generation-queue.ts');
const crawl = read('src/core/affiliate/crawl.ts');
const session = read('src/core/affiliate/naver-session.ts');

describe('① 중지가 이미지 폴백 전 구간에서 반응한다', () => {
  it('⭐⭐ H2 폴백 체인 — 엔진마다 중지를 본다', () => {
    const h2Chain = blockBetween(dispatcher, '// 2순위: 신뢰성 우선 폴백 체인', '🛡️ 최종 안전망 (v3.6.0): 모든 원격');
    expect(h2Chain).toContain("isCanceled()");
    expect(h2Chain).toContain('CANCELED_BY_USER');
  });

  it('⭐⭐ 썸네일 폴백 체인 — 엔진마다 중지를 본다', () => {
    const idx = dispatcher.indexOf('썸네일 폴백 체인을 멈춥니다');
    expect(idx).toBeGreaterThan(-1);
  });

  it('⭐⭐ 엔진 사이 안정화 대기가 0.5초 단위로 중지에 깬다', () => {
    expect(queue).toContain('const step = 500;');
    expect(queue).toContain('중지 요청 — 대기를 중단합니다');
    // 통짜 sleep 이 되살아나면 8초 대기가 다시 중지를 무시한다
    const waitBlock = blockBetween(queue, 'if (delayMs > 0) {', 'activeEngine = engine;');
    expect(waitBlock).not.toContain('await sleep(delayMs);');
  });

  it('⭐ 중지됐으면 안전망(pollinations·placeholder)도 돌리지 않는다', () => {
    const fn = blockBetween(dispatcher, 'async function buildPlaceholderResult(', 'const pol = await tryPollinationsFallback');
    expect(fn).toContain('CANCELED_BY_USER');
  });
});

describe('② 수집 모드는 유료 폴백으로 넘어가지 않는다', () => {
  it('⭐⭐ H2 체인 — NON_GENERATIVE 는 폴백 없이 반환', () => {
    const guard = dispatcher.indexOf("startsWith('NON_GENERATIVE_SOURCE')");
    const chain = dispatcher.indexOf('// 2순위: 신뢰성 우선 폴백 체인');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(chain);   // 폴백 진입 전에 걸러야 한다
  });

  it('⭐⭐ 썸네일 체인 — 같은 가드가 있다', () => {
    expect(dispatcher).toContain('수집 사진이 없어 썸네일을 비워 둡니다');
  });
});

describe('③ 성인인증 감지 시 로그인 창이 뜬다', () => {
  it('⭐⭐ 세션이 없으면 그 자리에서 창을 연다', () => {
    const block = blockBetween(crawl, 'const ageGated =', '네이버가 로그인 화면을');
    expect(block).toContain('tryClaimLoginPrompt()');
    expect(block).toContain('openNaverLoginWindow');
  });

  it('⭐⭐ 로그인하면 즉시 세션으로 재시도한다', () => {
    const block = blockBetween(crawl, 'const ageGated =', '네이버가 로그인 화면을');
    expect(block).toContain('_naverSession: true');
  });

  it('⭐⭐ 앱 실행당 1회만 띄운다 (동시 크롤 3개 = 창 3개 방지)', () => {
    expect(session).toContain('let loginPromptUsedThisRun = false;');
    const fn = blockBetween(session, 'export function tryClaimLoginPrompt()', '}');
    expect(fn).toContain('if (loginPromptUsedThisRun) return false;');
    expect(fn).toContain('loginPromptUsedThisRun = true;');
  });

  it('⭐ 로그인 안 하면 발행은 그대로 계속된다 (차단 금지)', () => {
    const block = blockBetween(crawl, 'const ageGated =', '네이버가 로그인 화면을');
    expect(block).toContain('상품 정보 없이 진행합니다');
  });
});
