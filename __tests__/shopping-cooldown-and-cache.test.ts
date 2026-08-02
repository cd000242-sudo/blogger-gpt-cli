/**
 * 쇼핑모드 쿨다운 · 보강 캐시 (v3.8.400)
 *
 * 사용자 지시:
 *   "사용자가 욕심내서 많이 작성하려다 막힐 수 있으니까 몇 분 후에 작성하게끔 권고해주고,
 *    그래도 말 안 듣고 발행 버튼 누르면 락을 걸어서 몇 분 뒤에 발행하라고 카운트하고
 *    그 시간 되면 발행할 수 있도록 풀어줘. 아니면 예약이 되게끔. 이건 쇼핑모드에만 해당."
 *
 * 실측 근거 (2026-08-01):
 *   쿠팡 상품 페이지를 15회 넘게 반복 조회하자 **창을 띄운 실제 Chrome 도 403** 이 됐고
 *   그 뒤 연속 실패했다. 막히면 후기·스펙을 못 가져와 글의 재료가 사라진다.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  computeStatus, cooldownForCount, nextState, readState, writeState,
  checkShoppingCooldown, recordShoppingPublish, DEFAULT_COOLDOWN_MS,
} from '../src/core/affiliate/shopping-cooldown';
import { isFresh, pruneEntries, getCached, putCached, DEFAULT_TTL_MS } from '../src/core/affiliate/enrich-cache';
import type { CoupangEnrichment } from '../src/core/affiliate/coupang-enrich';
import { braceBlock } from './helpers/source-block';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-cd-'));
const T0 = Date.UTC(2026, 7, 1, 12, 0, 0);

describe('쿨다운 계산', () => {
  it('처음 발행이면 통과한다', () => {
    expect(computeStatus(null, T0).canPublish).toBe(true);
  });

  it('⭐ 방금 발행했으면 막고 남은 시간을 알려준다', () => {
    const s = computeStatus({ lastPublishAt: T0, consecutive: 1 }, T0 + 60_000);
    expect(s.canPublish).toBe(false);
    expect(s.remainingMs).toBe(DEFAULT_COOLDOWN_MS - 60_000);
    expect(s.message).toContain('4분');
    expect(s.message).toContain('예약');          // 대안을 반드시 제시한다
  });

  it('⭐ 시간이 지나면 자동으로 풀린다 — 사람이 해제할 일이 없다', () => {
    const s = computeStatus({ lastPublishAt: T0, consecutive: 1 }, T0 + DEFAULT_COOLDOWN_MS);
    expect(s.canPublish).toBe(true);
    expect(s.remainingMs).toBe(0);
  });

  it('몰아 쓸수록 간격이 늘어난다', () => {
    expect(cooldownForCount(1)).toBe(DEFAULT_COOLDOWN_MS);
    expect(cooldownForCount(3)).toBe(DEFAULT_COOLDOWN_MS * 2);
    expect(cooldownForCount(5)).toBe(DEFAULT_COOLDOWN_MS * 3);
  });

  it('⭐ 시계가 뒤로 가도 영구 잠금이 되지 않는다', () => {
    // 사용자가 시스템 시간을 바꾸면 elapsed 가 음수가 된다
    expect(computeStatus({ lastPublishAt: T0 + 999_999, consecutive: 1 }, T0).canPublish).toBe(true);
  });

  it('오래 쉬었으면 연속 카운트를 리셋한다 (아침 1편·저녁 1편은 연속이 아니다)', () => {
    expect(nextState({ lastPublishAt: T0, consecutive: 4 }, T0 + 2 * 60 * 60 * 1000).consecutive).toBe(1);
    expect(nextState({ lastPublishAt: T0, consecutive: 4 }, T0 + 60_000).consecutive).toBe(5);
  });

  it('남은 시간이 1분 미만이면 초로 안내한다', () => {
    const s = computeStatus({ lastPublishAt: T0, consecutive: 1 }, T0 + DEFAULT_COOLDOWN_MS - 20_000);
    expect(s.message).toMatch(/\d+초 뒤/);
  });
});

describe('쿨다운 저장', () => {
  it('기록하고 다시 읽는다', () => {
    const dir = tmpDir();
    recordShoppingPublish(dir, T0);
    expect(readState(dir)).toEqual({ lastPublishAt: T0, consecutive: 1 });
    expect(checkShoppingCooldown(dir, T0 + 1000).canPublish).toBe(false);
    expect(checkShoppingCooldown(dir, T0 + DEFAULT_COOLDOWN_MS).canPublish).toBe(true);
  });

  it('⭐ 파일이 깨져도 발행을 막지 않는다 (막는 쪽으로 실패하지 않는다)', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'shopping-cooldown.json'), '{망가진 JSON');
    expect(readState(dir)).toBeNull();
    expect(checkShoppingCooldown(dir, T0).canPublish).toBe(true);
  });

  it('없는 폴더에도 안전하게 쓴다', () => {
    const dir = path.join(tmpDir(), 'nested', 'deep');
    writeState(dir, { lastPublishAt: T0, consecutive: 2 });
    expect(readState(dir)?.consecutive).toBe(2);
  });
});

describe('보강 캐시', () => {
  const sample = (n: number): CoupangEnrichment => ({
    productId: '9665577597',
    pageTitle: '수영장 에어 탱크 물총 튜브',
    reviews: Array.from({ length: n }, (_, i) => ({ body: `후기 ${i}`, rating: 5, date: '2026.07.25' })),
    totalReviewCount: n,
    specs: ['아이템 높이: 110cm'],
    options: ['110CM 소형 탱크 41,200원'],
    policy: ['배송사 CJ 대한통운'],
    imageUrl: 'https://img.example/product.jpg',   // v3.8.404 신설 — 썸네일용 상품 사진
    verified: true,
    note: '',
  });

  it('⭐ 저장하면 브라우저 없이 그대로 돌려준다 — 쿠팡을 다시 두드리지 않는다', () => {
    const dir = tmpDir();
    putCached(dir, '9665577597', sample(3), T0);
    const hit = getCached(dir, '9665577597', T0 + 1000);
    expect(hit?.reviews).toHaveLength(3);
    expect(hit?.specs).toEqual(['아이템 높이: 110cm']);
  });

  it('수명이 지나면 쓰지 않는다 (옛 정보를 본문에 넣으면 안 된다)', () => {
    const dir = tmpDir();
    putCached(dir, '111', sample(1), T0);
    expect(getCached(dir, '111', T0 + DEFAULT_TTL_MS + 1)).toBeNull();
  });

  it('없는 상품은 null', () => {
    expect(getCached(tmpDir(), '없는상품', T0)).toBeNull();
  });

  it('⭐ 깨진 캐시가 발행을 막지 않는다', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'coupang-enrich-cache.json'), 'not json at all');
    expect(getCached(dir, '111', T0)).toBeNull();
    expect(() => putCached(dir, '111', sample(1), T0)).not.toThrow();
  });

  it('오래된 것부터 버려 파일이 무한정 커지지 않는다', () => {
    const store: any = {};
    for (let i = 0; i < 250; i += 1) store[`p${i}`] = { savedAt: T0 - i * 1000, data: sample(1) };
    const pruned = pruneEntries(store, T0);
    expect(Object.keys(pruned).length).toBe(200);
    expect(pruned['p0']).toBeDefined();          // 최신은 남는다
    expect(pruned['p249']).toBeUndefined();      // 가장 오래된 것은 버린다
  });

  it('isFresh 는 미래 시각을 신뢰하지 않는다', () => {
    expect(isFresh({ savedAt: T0 + 10_000, data: sample(1) }, T0)).toBe(false);
    expect(isFresh(undefined, T0)).toBe(false);
  });
});

describe('배선', () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

  it('⭐ 쇼핑모드에만 적용된다 — 일반 글은 쿠팡을 두드리지 않는다', () => {
    const posting = read('electron', 'ui', 'modules', 'posting.js');
    const i = posting.indexOf('async function passesShoppingCooldown');
    const block = braceBlock(posting, 'async function passesShoppingCooldown');
    expect(block).toContain("mode !== 'shopping'");
    expect(block).toContain('return true');
  });

  it('⭐ 잠긴 동안 카운트다운을 보여주고 시간이 되면 스스로 푼다', () => {
    const posting = read('electron', 'ui', 'modules', 'posting.js');
    expect(posting).toContain('후 발행 가능');
    expect(posting).toContain('btn.disabled = false');
    expect(posting).toContain('clearInterval(timer)');
  });

  it('예약 발행이라는 대안을 알려준다', () => {
    expect(read('electron', 'ui', 'modules', 'posting.js')).toContain('예약 발행은 지금 가능');
  });

  it('발행에 성공하면 시각을 기록한다', () => {
    const posting = read('electron', 'ui', 'modules', 'posting.js');
    expect(posting).toContain("invoke?.('shopping:cooldown-record')");
  });

  it('IPC 두 개가 등록돼 있다', () => {
    const main = read('electron', 'main.ts');
    expect(main).toContain("ipcMain.handle('shopping:cooldown-status'");
    expect(main).toContain("ipcMain.handle('shopping:cooldown-record'");
  });

  it('⭐ IPC 실패 시에도 발행을 막지 않는다', () => {
    const main = read('electron', 'main.ts');
    const i = main.indexOf("ipcMain.handle('shopping:cooldown-status'");
    expect(braceBlock(main, "ipcMain.handle('shopping:cooldown-status'")).toContain('canPublish: true');
  });

  it('보강 모듈이 캐시를 먼저 본다', () => {
    const src = read('src', 'core', 'affiliate', 'coupang-enrich.ts');
    const i = src.indexOf('if (opts.cacheDir)');
    expect(i).toBeGreaterThan(-1);
    expect(braceBlock(src, 'if (opts.cacheDir)')).toContain('getCached');
    expect(src.indexOf('getCached')).toBeLessThan(src.indexOf('launchPersistentContext'));
  });

  it('orchestration 이 캐시 폴더를 넘긴다', () => {
    expect(read('src', 'core', 'final', 'orchestration.ts')).toContain('cacheDir');
  });
});

/**
 * 쿠팡 링크일 때만 쿨다운 (v3.8.404)
 *
 * 사용자 보고(2026-08-02): "쿠팡하고 나서 토스로 링크 넣고 발행하려니까 5분 후 발행하라고 막혔네"
 *   → 맞는 지적. 이 쿨다운은 **쿠팡이 반복 조회를 403 으로 막기 때문에** 만든 것이다.
 *     토스는 정적 요청, 네이버는 헤드리스로 가져오고 둘 다 차단 이력이 없다.
 *     쿠팡을 건드리지도 않는 발행을 막을 이유가 없었다.
 */
describe('쿠팡을 쓸 때만 막는다', () => {
  const posting = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ui', 'modules', 'posting.js'), 'utf8');

  it('⭐ 링크에 쿠팡이 없으면 그냥 통과시킨다', () => {
    const i = posting.indexOf('async function passesShoppingCooldown');
    const block = posting.slice(i, posting.indexOf('export async function publishToPlatform', i));
    // 백슬래시 이스케이프로 헛되이 깨지지 않게, 정규식 조각이 아니라 동작으로 확인한다
    expect(block).toContain('coupa');            // 쿠팡 도메인 판정이 있다
    expect(block).toContain('test(linkText)');   // 링크 텍스트를 검사한다
    expect(block).toContain('return true');      // 쿠팡이 없으면 통과
  });

  it('제휴 링크 칸·원본 URL 칸·쿠팡 수동 칸을 모두 본다', () => {
    const i = posting.indexOf('async function passesShoppingCooldown');
    const block = posting.slice(i, posting.indexOf('export async function publishToPlatform', i));
    ['affiliateLinks', 'referenceUrl', 'manualCoupangUrls'].forEach((id) => {
      expect(block).toContain(`getElementById('${id}')`);
    });
  });

  it('⭐ 쿠팡을 쓴 발행만 시각을 기록한다 (토스 글이 쿠팡 쿨다운을 시작시키면 안 된다)', () => {
    expect(posting).toContain('const usedCoupang =');
    const i = posting.indexOf('const usedCoupang =');
    expect(braceBlock(posting, 'const usedCoupang =')).toContain("=== 'shopping' && usedCoupang");
  });

  it('모달이 "쿠팡 링크를 쓸 때만"이라고 명시한다', () => {
    expect(posting).toContain('쿠팡 링크를 쓸 때만');
  });

  /** 판정 로직을 그대로 재현해 실제 링크로 확인한다 */
  it('⭐ 실제 링크로 판정이 맞는지', () => {
    const isCoupang = (s: string) => /coupang\.com|coupa\.ng/i.test(s);
    expect(isCoupang('https://link.coupang.com/a/fRJGxvXas8')).toBe(true);
    expect(isCoupang('https://coupa.ng/xxxx')).toBe(true);
    expect(isCoupang('https://toss.im/_m/bMxjrwji')).toBe(false);      // 토스는 막지 않는다
    expect(isCoupang('https://naver.me/I5w1Dexp')).toBe(false);        // 네이버도 막지 않는다
    expect(isCoupang('')).toBe(false);
  });
});
