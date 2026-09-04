const fs = require('fs');
const path = require('path');

export {};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/** 시작 표시부터 다음 표시 직전까지 — 고정 길이 slice 는 몇 줄만 밀려도 헛것을 검사한다. */
function blockBetween(source: string, startMarker: string, endMarker: string): string {
  const from = source.indexOf(startMarker);
  if (from === -1) throw new Error('시작 표시를 못 찾음: ' + startMarker);
  const to = source.indexOf(endMarker, from + startMarker.length);
  return to === -1 ? source.slice(from) : source.slice(from, to);
}

/*
 * v3.8.628 — 중지하거나 오류로 끝난 발행이 다음 발행을 90초 막던 문제.
 *
 * 사장님 보고: "발행을 하고나서 내가 실수를해서 다시발행하려고 중지를 해서
 * 중단되거나 오류로 중단이됫어. 그러고 다시 제대로된키워드나 url을 넣고
 * 바로발행버튼누르니까 100초있다가 발행해야된다고 락이걸리네"
 *
 * _enforcePublishGap 은 시각을 **시작할 때** 찍는데 실패해도 지우지 않았다.
 * 그래서 한 글자도 못 쓰고 멈춘 시도가 다음 시도를 막았다 —
 * 실수를 바로잡으려는 사람을 벌주는 셈이었다.
 */
describe('v3.8.628 끝나지 않은 발행은 대기를 물려주지 않는다', () => {
  const links = read('electron/ui/modules/internal-links.js');
  const posting = read('electron/ui/modules/posting.js');

  test('해제 함수가 있고 화면 어디서나 부를 수 있다', () => {
    expect(links).toContain('function _releasePublishGap(');
    expect(links).toContain('window._releasePublishGap = _releasePublishGap;');
  });

  test('지우지 않고 직전 값으로 되돌린다 — 진짜 마지막 발행 시각은 살린다', () => {
    const fn = blockBetween(links, 'function _releasePublishGap(', 'window._releasePublishGap =');

    expect(fn).toContain('_publishGapPrevValue');
    expect(fn).toContain("localStorage.setItem('lastPublishStartAt', _publishGapPrevValue)");
    // 직전 값이 아예 없었던 경우에만 지운다
    expect(fn).toContain("localStorage.removeItem('lastPublishStartAt')");
  });

  test('시작할 때 직전 값을 기억해 둔다 — 기억하지 않으면 되돌릴 수 없다', () => {
    const fn = blockBetween(links, 'async function _enforcePublishGap(', 'window._enforcePublishGap =');

    expect(fn).toContain("_publishGapPrevValue = localStorage.getItem('lastPublishStartAt')");
    // 기억한 뒤에 덮어써야 한다 — 순서가 뒤집히면 새 값을 기억하게 된다
    const 기억 = fn.indexOf('_publishGapPrevValue = localStorage.getItem');
    const 덮어쓰기 = fn.indexOf("localStorage.setItem('lastPublishStartAt', String(Date.now()))");
    expect(기억).toBeGreaterThan(-1);
    expect(덮어쓰기).toBeGreaterThan(기억);
  });

  test('해제는 되돌린 뒤 기억을 비운다 — 두 번 눌러도 엉뚱한 값이 안 들어간다', () => {
    const fn = blockBetween(links, 'function _releasePublishGap(', 'window._releasePublishGap =');
    expect(fn).toContain('_publishGapPrevValue = null');
  });

  describe('일반 발행 — 세 갈래 모두에서 풀린다', () => {
    const fn = blockBetween(posting, 'const releaseGap =', 'function ');

    test('중지했을 때', () => {
      expect(posting).toContain("releaseGap('사용자 중지')");
    });

    test('오류로 끝났을 때', () => {
      expect(posting).toContain("releaseGap('발행 실패')");
    });

    test('에이전트 모드에서 중지했을 때 — 여기는 throw 로 온다', () => {
      expect(posting).toContain("releaseGap('사용자 중지(에이전트)')");
    });

    test('헬퍼가 없어도 발행이 깨지지 않는다', () => {
      expect(fn).toContain('window._releasePublishGap &&');
      expect(fn).toContain('try {');
    });

    test('성공했을 때는 풀지 않는다 — 연속 발행 보호는 그대로다', () => {
      // 성공 분기(품질 리포트를 띄우는 쪽)에는 해제가 없어야 한다
      const 성공분기 = blockBetween(posting, 'accumulateQualityReport(', '} else if (result?.canceled)');
      expect(성공분기).not.toContain('releaseGap(');
    });
  });

  describe('거미줄 발행', () => {
    test('발행까지 갔을 때만 대기를 물려준다', () => {
      const fn = blockBetween(links, 'async function generateAndPublishSpiderWeb()', 'async function _syncSpiderBacklinks');
      expect(fn).toContain('let _spiderPublished = false;');
      expect(fn).toContain('_spiderPublished = true;');
      expect(fn).toContain("if (!_spiderPublished) _releasePublishGap(");
    });

    test('예외로 튀어나가도 반드시 풀린다 — finally 여야 한다', () => {
      const fn = blockBetween(links, 'async function generateAndPublishSpiderWeb()', 'async function _syncSpiderBacklinks');
      const catch위치 = fn.indexOf('} catch (error) {');
      const finally위치 = fn.indexOf('} finally {');
      expect(finally위치).toBeGreaterThan(catch위치);
      expect(fn.indexOf('_releasePublishGap(')).toBeGreaterThan(finally위치);
    });
  });
});
