/**
 * 🔧 발행 전 자동 수정 — 코드가 스스로 고칠 수 있는 것만 (v3.8.629)
 *
 * ## 왜 만들었나
 * 사장님: "애초에 비평이나 개선을 하려고 버튼을 누르면 개선할게없을정도로
 *         글이 발행되어야한다고"
 *
 * 지금 구조는 전부 **알리기만** 한다 — structure-guard 도, title-answer-gate 도,
 * substance-gate 도 로그만 찍고 그대로 발행한다. 그래서 실측한 발행글에
 * 붙은 문장 6건이 그대로 나갔다. 아무도 안 고쳤기 때문이다.
 *
 * ## 이 파일이 하는 일과 안 하는 일
 * **한다**: 뜻을 바꾸지 않고 기계적으로 되돌릴 수 있는 것만 고친다.
 *   · 마침표 뒤에 공백이 없어 붙은 문장
 *   · 글쓴이 개인 의견 군더더기("아무튼", "제 기준으로는")
 *
 * **안 한다**: 판단이 필요한 것은 손대지 않는다.
 *   · 말투 통일 — "해요"를 "합니다"로 기계 치환하면 문장이 깨진다
 *   · 확정형 범죄 표현 — "횡령했다"를 뭐로 바꿀지는 사실관계를 알아야 한다
 *   · 구간 반복 — 어느 쪽을 지울지는 글의 흐름을 봐야 한다
 *   이것들은 AI 가 문단 단위로 다시 쓰는 쪽(fact-guard 패턴)이 맡는다.
 *
 * ## 절대 원칙
 * 고치다 망가뜨리지 않는다. 손댄 결과가 원본보다 나빠 보이면 원본을 그대로 둔다.
 * 개선 안 하는 것보다 망가뜨리는 것이 나쁘다.
 */

export interface RepairResult {
  html: string;
  /** 무엇을 몇 개 고쳤는지 — 로그와 테스트가 읽는다 */
  repairs: { kind: string; count: number; note: string }[];
}

/* ────────────────────────────────────────────────────────────────
 * ① 마침표 뒤에 붙은 문장
 *
 * 목록을 문단으로 합칠 때 생긴다. 공백 하나를 넣으면 끝이고, 뜻이 바뀔 일이 없다.
 * 소수점(3.5)·날짜(2026.09.04)·영문 약어는 건드리면 안 된다.
 * ──────────────────────────────────────────────────────────────── */
const GLUED = /(?<![\d])([.!?])(?=[가-힣])/g;

/** 태그 안(속성값)은 건드리지 않는다 — style·href 에 마침표가 흔하다 */
function outsideTags(html: string, fix: (text: string) => { text: string; count: number }): { html: string; count: number } {
  let total = 0;
  const out = String(html || '').replace(/>([^<]+)</g, (whole, inner: string) => {
    const r = fix(inner);
    total += r.count;
    return '>' + r.text + '<';
  });
  return { html: out, count: total };
}

export function repairGluedSentences(html: string): { html: string; count: number } {
  return outsideTags(html, (text) => {
    let count = 0;
    const fixed = text.replace(GLUED, (m) => { count += 1; return m + ' '; });
    return { text: fixed, count };
  });
}

/* ────────────────────────────────────────────────────────────────
 * ② 글쓴이 개인 의견 군더더기
 *
 * 지워도 문장이 성립하는 것만 고른다. "아무튼 정리하면" → "정리하면".
 * 문장 전체가 의견인 경우("제 생각에는 이게 맞아요")는 지우면 뜻이 사라지므로
 * 여기서 다루지 않는다 — 앞머리에 붙은 군더더기만 뗀다.
 * ──────────────────────────────────────────────────────────────── */
const FILLER = /(?:^|(?<=[.!?]\s)|(?<=>))\s*(?:아무튼|제\s*기준으로는|개인적으로는|솔직히\s*말해)\s*/g;

export function repairPersonalFiller(html: string): { html: string; count: number } {
  return outsideTags(html, (text) => {
    let count = 0;
    const fixed = text.replace(FILLER, (whole) => {
      count += 1;
      // 문장 사이였다면 공백 하나는 남긴다
      return /^\s*$/.test(whole) ? whole : ' ';
    });
    return { text: fixed.replace(/\s{2,}/g, ' '), count };
  });
}

/* ──────────────────────────────────────────────────────────────── */

/** 본문 글자수 — 고치다 내용이 사라지지 않았는지 보는 데 쓴다 */
function textLength(html: string): number {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
}

/**
 * 발행 직전에 부른다. 고칠 것이 없으면 원본을 그대로 돌려준다.
 *
 * 손댄 뒤 본문이 눈에 띄게 줄었으면(3% 넘게) 되돌린다 — 치환이 잘못 걸려
 * 문장을 먹은 경우다. 이 저장소는 그런 사고를 겪은 적이 있다.
 */
export function autoRepairBeforePublish(html: string): RepairResult {
  const source = String(html || '');
  if (!source.trim()) return { html: source, repairs: [] };

  const before = textLength(source);
  const repairs: RepairResult['repairs'] = [];
  let working = source;

  const glued = repairGluedSentences(working);
  if (glued.count > 0) {
    working = glued.html;
    repairs.push({ kind: 'glued-sentence', count: glued.count, note: '마침표 뒤에 공백을 넣었습니다' });
  }

  const filler = repairPersonalFiller(working);
  if (filler.count > 0) {
    working = filler.html;
    repairs.push({ kind: 'personal-voice', count: filler.count, note: '글쓴이 군더더기를 뗐습니다' });
  }

  /**
   * 되돌림 판정 — **큰 사고만** 잡는다.
   *
   * 실측 실수: 72자짜리 표본에서 "아무튼" 세 글자를 뗐더니 4% 감소로 걸려
   * 되돌려졌다. 정상 동작인데 안전장치가 막은 것이다. 표본이 짧으면 몇 글자만
   * 지워도 비율이 커진다.
   *
   * 그래서 두 조건을 함께 본다: 판단할 만큼 긴 글이고(500자 이상), 그런데도
   * 3% 넘게 줄었을 때만 되돌린다. 치환이 문장을 통째로 먹은 경우가 그렇다.
   */
  const after = textLength(working);
  const REVERT_MIN_CHARS = 500;
  const REVERT_SHRINK = 0.97;
  if (before >= REVERT_MIN_CHARS && after < before * REVERT_SHRINK) {
    return { html: source, repairs: [{ kind: 'reverted', count: 0, note: `본문이 ${before}→${after}자로 줄어 되돌렸습니다` }] };
  }

  return { html: working, repairs };
}

/** 로그 한 줄 */
export function describeRepairs(result: RepairResult): string {
  if (result.repairs.length === 0) return '자동 수정할 것이 없었습니다';
  return result.repairs.map((r) => (r.count > 0 ? `${r.note} (${r.count}곳)` : r.note)).join(' · ');
}
