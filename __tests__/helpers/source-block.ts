/**
 * 소스 검사용 블록 추출기 (v3.8.405)
 *
 * ## 왜 만드나
 * 이 저장소의 테스트 상당수가 "소스에 이 문자열이 있나"로 배선을 검증한다.
 * 파이프라인 전체를 돌려야만 확인되는 배선이 많아 그 자체는 합리적이다.
 *
 * 문제는 **범위를 고정 길이로 잘랐다는 것**이다:
 *     const i = src.indexOf('표식');
 *     const block = src.slice(i, i + 900);   // ← 주석 몇 줄만 늘어도 밖으로 밀려난다
 *
 * 2026-08-02 하루에만 이 이유로 여섯 번 깨졌다(2200·1500·900·600자 등).
 * 전부 동작은 멀쩡했는데 테스트만 깨졌다. 그러면 **진짜 회귀와 구분할 수 없다** —
 * 테스트가 늑대를 외치기 시작하면 아무도 안 믿는다.
 *
 * 그래서 길이가 아니라 **경계**로 자른다.
 */

/** 표식이 없으면 명확히 실패시킨다 — 조용히 빈 문자열을 돌려주면 통과해버린다 */
function requireIndex(src: string, marker: string | RegExp, from = 0): number {
  const i = typeof marker === 'string'
    ? src.indexOf(marker, from)
    : (() => {
        const m = src.slice(from).match(marker);
        return m?.index === undefined ? -1 : from + m.index;
      })();
  if (i < 0) {
    throw new Error(`소스에서 표식을 찾지 못했습니다: ${String(marker)}`);
  }
  return i;
}

/**
 * 시작 표식부터 끝 표식 직전까지.
 *
 * 끝 표식은 **시작 표식 뒤에서만** 찾는다. 앞에서 먼저 나오는 같은 문구에 걸리면
 * 범위가 뒤집혀 빈 블록이 되고, 그러면 테스트가 통과해버린다(실제로 겪었다 —
 * '썸네일 생성' 문구가 URL 빠른경로에 먼저 있어 내부링크 블록이 비었다).
 */
export function blockBetween(src: string, startMarker: string | RegExp, endMarker: string | RegExp): string {
  const start = requireIndex(src, startMarker);
  const end = requireIndex(src, endMarker, start + 1);
  return src.slice(start, end);
}

/**
 * 표식이 속한 **중괄호 블록**을 통째로.
 *
 * 표식 뒤 첫 `{` 를 찾아 짝이 맞는 `}` 까지 돌려준다.
 * 함수·if·try 안의 배선을 확인할 때 쓴다. 블록이 길어져도 안 깨진다.
 */
export function braceBlock(src: string, marker: string | RegExp): string {
  const at = requireIndex(src, marker);
  const open = src.indexOf('{', at);
  if (open < 0) return src.slice(at);

  let cursor = open;
  for (;;) {
    let depth = 0;
    let close = -1;
    for (let i = cursor; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) { close = i; break; }
      }
    }
    if (close < 0) return src.slice(at);      // 짝이 안 맞으면 끝까지

    // ⭐ `} catch (...) {` · `} else {` · `} finally {` 는 **같은 구문**이다.
    //   여기서 멈추면 "실패해도 발행을 막지 않는다"류 테스트가 catch 를 못 봐서 헛되이 깨진다.
    //   (코드모드 후 실제로 여러 스위트가 이 이유로 깨졌다 — 동작은 멀쩡했다)
    const rest = src.slice(close + 1);
    const cont = rest.match(/^\s*(catch\s*(\([^)]*\))?|else(\s+if\s*\([^)]*\))?|finally)\s*\{/);
    if (!cont) return src.slice(at, close + 1);
    cursor = close + 1 + cont[0].length - 1;   // 이어지는 블록의 여는 중괄호로 이동
  }
}

/**
 * 표식부터 N줄.
 *
 * 문자 수가 아니라 **줄 수**로 센다. 주석을 붙여도 줄 수는 의도한 만큼만 늘어나고,
 * 무엇보다 "이 근처"라는 의도가 코드에 그대로 드러난다.
 */
export function linesAfter(src: string, marker: string | RegExp, lines: number): string {
  const at = requireIndex(src, marker);
  return src.slice(at).split('\n').slice(0, lines).join('\n');
}

/**
 * 표식 근처(앞뒤 N줄)를 본다 — 호출부보다 위에 있는 선언을 확인할 때.
 */
export function around(src: string, marker: string | RegExp, before: number, after: number): string {
  const at = requireIndex(src, marker);
  const head = src.slice(0, at).split('\n');
  const tail = src.slice(at).split('\n');
  return [...head.slice(Math.max(0, head.length - before - 1)), ...tail.slice(0, after)].join('\n');
}
