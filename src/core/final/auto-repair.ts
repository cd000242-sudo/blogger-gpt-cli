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

/**
 * 숫자 안의 쉼표에서 줄이 갈린 것 (v3.8.657). 실측: "5,<br>\n087대, 약 2억2천만원"
 * 모델이 절 단위로 <br> 을 넣다가 천 단위 쉼표를 절 경계로 봤다. 기계로 붙인다.
 */
export function repairSplitNumbers(html: string): { html: string; count: number } {
  let count = 0;
  const fixed = String(html || '').replace(/(\d),\s*<br\s*\/?>\s*(?=\d{3}(?!\d))/gi, (_m, d) => { count += 1; return `${d},`; });
  return { html: fixed, count };
}

/**
 * 문장 끝의 꺾쇠 찌꺼기 (v3.8.661). 실측: "…적용될 예정이기 때문입니다></p>" — 모델이 흘린 '>' 하나가 그대로 찍혔다.
 * 한글·마침표 바로 뒤에 '>' 가 오고 그 뒤가 태그 경계면 글자가 아니라 찌꺼기다. 태그 안은 건드리지 않는다.
 */
export function repairStrayBrackets(html: string): { html: string; count: number } {
  let count = 0;
  const fixed = String(html || '').replace(/([가-힣.。!?])\s*>(?=\s*(?:<\/p>|<\/li>|<br\s*\/?>|\n|$))/g, (_m, ch) => { count += 1; return ch; });
  return { html: fixed, count };
}

/** 문장이 끝난 줄인가 — 마침표류, 또는 마침표 없이 끝난 한국어 종결어미 (v3.8.659) */
const SENTENCE_TERMINAL = /[.!?…。」』)\]]\s*$|(?:니다|습니다|해요|예요|에요|어요|아요|여요|네요|세요|돼요|봐요|줘요|와요|져요|나요|까요|죠|다|요)\s*$/;

/** 본문에 그대로 적힌 주소 — 마침표 뒤에 공백을 넣으면 주소가 깨진다 (실측: "www. globalepic. co. kr") */
const BARE_URL = /(?:https?:\/\/|www\.)[^\s<]+/g;

export function repairGluedSentences(html: string): { html: string; count: number } {
  return outsideTags(html, (text) => {
    let count = 0;
    // v3.8.657 — 주소 조각은 건너뛰고 나머지 글에만 적용한다
    const fixed = text.split(BARE_URL).length === 1
      ? text.replace(GLUED, (m) => { count += 1; return m + ' '; })
      : text.replace(/((?:https?:\/\/|www\.)[^\s<]+)|([^]*?)(?=(?:https?:\/\/|www\.)[^\s<]+|$)/g, (_w, url, plain) => {
        if (url) return url;
        return String(plain || '').replace(GLUED, (m) => { count += 1; return m + ' '; });
      });
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
// v3.8.664: "제 기준으로는·개인적으로는" 은 판단의 말머리라 떼지 않는다 — 떼면 판단이 근거 없는 단정으로 남는다
const FILLER = /(?:^|(?<=[.!?]\s)|(?<=>))\s*(?:아무튼|솔직히\s*말해)\s*/g;

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
/**
 * 🔁 앞에서 이미 한 말을 뒤에서 다시 하면 **그 문장을 지운다** (v3.8.648).
 *
 * ## 왜 기계로 하나
 * 실측 2026-09-05 (10편): 점수를 가르는 건 사실상 중복 하나였다.
 *   지적 41건 중 cross-section-echo 41 · 84점 글만 중복 0
 * 발행 전 자가 수정(AI)이 이걸 맡고 있었지만 **호출 상한이 2구간**이라
 * (사장님 요구: 비용 고정) 5~6건 중 대부분이 그대로 남았다.
 *
 * 중복 제거는 **판단이 아니라 삭제**다. AI 를 부를 이유가 없다.
 * 기계로 하면 비용 0, 그리고 실행마다 결과가 흔들리지 않는다
 * (같은 글이 어떤 실행은 중복 1, 어떤 실행은 5 였다).
 *
 * ## 지나치게 지우지 않도록
 *   · 문단이 절반 넘게 사라지면 그 문단은 건드리지 않는다
 *   · 지우는 문장 수에 상한을 둔다
 *   · 다 지운 뒤 본문이 8% 넘게 줄었으면 통째로 되돌린다
 * 근거 장부 사고(잘 쓴 문장이 지워져 글이 얕아진 일)를 되풀이하지 않기 위해서다.
 */
const ECHO_MIN_CHARS = 18;
const ECHO_RATIO = 0.55;
const ECHO_MAX_DELETIONS = 8;
const ECHO_MAX_SHRINK = 0.92;

function echoWordSet(sentence: string): Set<string> {
  return new Set(
    sentence.replace(/[^가-힣a-zA-Z0-9%\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1),
  );
}

function echoSimilarity(a: string, b: string): number {
  const A = echoWordSet(a);
  const B = echoWordSet(b);
  if (A.size < 6 || B.size < 6) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  const union = A.size + B.size - shared;
  return union === 0 ? 0 : shared / union;
}

export function removeEchoedSentences(html: string): { html: string; count: number } {
  const source = String(html || '');
  if (!source.trim()) return { html: source, count: 0 };

  const seen: string[] = [];
  let deleted = 0;

  /**
   * <p> 만 보다가 놓친 자리들 (실측 2026-09-05):
   *   "성급한 분들을 위한 핵심 요약" · "자주 묻는 질문(FAQ)" 이 본문과 겹치는데
   *   그 내용이 <li> 안에 있어서 하나도 못 걸렀다.
   * 목록 항목도 같은 자로 잰다.
   */
  /**
   * FAQ 는 건드리지 않는다 (v3.8.656).
   * 실측: FAQ 답의 첫 문장("기존 거주자는 10월 8일까지 신청할 수 있어요")이 본문과 겹친다고
   * 지워져 답이 "다만 실제 접수는…" 으로 시작했다. FAQ 는 본문을 되묻는 자리라 겹치는 게 정상이고,
   * 첫 문장이 곧 답이다. 그걸 지우면 질문에 답이 없어진다.
   */
  const faqStart = source.search(/자주\s*묻는\s*질문|<h2[^>]*>\s*FAQ/i);

  const out = source.replace(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi, (whole, _tag, inner, offset) => {
    if (deleted >= ECHO_MAX_DELETIONS) return whole;
    if (faqStart !== -1 && typeof offset === 'number' && offset >= faqStart) return whole;
    // 태그가 섞인 문단은 건드리지 않는다 — 링크·강조를 잘라먹을 수 있다
    // <li> 를 함께 보므로 ul/ol 자체는 막지 않는다. 링크·이미지·표만 건너뛴다
    if (/<(?:img|a|table)\b/i.test(inner)) return whole;

    /**
     * ⚠️ <br> 를 경계로 먼저 자른다 (실측 2026-09-05).
     *
     * 생성된 글은 한 문단 안에서 문장을 `…입니다.<br>온라인 접수는…` 처럼 잇는다.
     * 태그만 지우면 `입니다.온라인` 이 되어 **마침표 뒤 공백** 규칙에 안 걸리고,
     * 문단 전체가 한 문장으로 읽혀 중복을 하나도 못 잡았다.
     * (toPlainText 가 blockquote 를 빠뜨려 없는 결함을 만들던 것과 같은 계열이다.)
     */
    const segments = String(inner).split(/<br\s*\/?>/i);
    const plain = String(inner).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
    const rawParts = segments
      .map((seg) => seg.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .flatMap((seg) => seg.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean));
    /**
     * 쉼표로 끝나는 줄은 문장이 아니라 조각이다 (v3.8.659).
     * 모델은 절 단위로 <br> 을 넣는다: "…늦춘 것이지,<br>모든 기업의 상장유지를 보장하는 게 아닙니다."
     * 조각을 따로 재면 뒷조각만 겹친다고 지워져 "늦춘 것이지," 가 덩그러니 남았다(실측 2편).
     * 문장이 끝나지 않은 조각은 다음 조각과 한 문장으로 묶어서 잰다 — 지워도 문장째 지워진다.
     */
    const parts: string[] = [];
    for (const p of rawParts) {
      const prev = parts[parts.length - 1];
      if (prev !== undefined && !SENTENCE_TERMINAL.test(prev)) parts[parts.length - 1] = `${prev} ${p}`;
      else parts.push(p);
    }
    if (parts.length === 0) return whole;

    /**
     * 첫 문장은 지키고, "첫째·둘째" 같은 번호 문장도 지킨다 (v3.8.657).
     * 실측: 절의 첫 문장("신규 전입자는 7월 1일 이후 전입…")이 지워져 절이 "이때 기준이…" 로
     * 시작했고, 마무리의 "둘째" 문단이 통째로 사라져 "첫째, … 셋째, …" 만 남았다.
     * 첫 문장은 그 문단의 주장이고, 번호 문장은 빠지면 열거가 깨진다.
     * 문단이 한 문장뿐이고 통째로 겹치는 경우(아래)는 여전히 문단째 뺀다 — 번호 문장만 빼고.
     */
    const ORDINAL = /^(?:첫째|둘째|셋째|넷째|다섯째|여섯째|마지막으로)[,\s]/;
    const kept: string[] = [];
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi]!;
      const protectedSentence = (pi === 0 && parts.length > 1) || ORDINAL.test(part);
      const isEcho = !protectedSentence
        && part.length >= ECHO_MIN_CHARS
        && deleted < ECHO_MAX_DELETIONS
        && seen.some((s) => echoSimilarity(part, s) >= ECHO_RATIO);
      if (isEcho) { deleted++; continue; }
      kept.push(part);
      if (part.length >= ECHO_MIN_CHARS) seen.push(part);
    }
    if (parts.length === 1 && ORDINAL.test(parts[0]!)) return whole;

    if (kept.length === parts.length) return whole;

    /**
     * 문단이 통째로 겹치는 경우가 실제로 가장 많다 (실측 2026-09-05):
     *   앞 구간: "신청 기간은 9월 7일부터 10월 30일까지입니다."
     *   뒤 구간: "하반기 신청 기간은 9월 7일부터 10월 30일까지입니다."
     * 한 문장짜리 문단이라 "빈 문단이 되면 되돌린다" 규칙에 걸려 하나도 못 지웠다.
     * 짧은 문단이 통째로 되풀이면 그 문단을 없앤다 — 남겨봐야 같은 말을 두 번 읽는다.
     */
    const keptText = kept.join(' ');
    if (kept.length === 0) {
      if (plain.length <= 200) return '';   // 짧고 전부 겹침 → 문단째 제거
      deleted -= parts.length;
      for (const part of parts) if (part.length >= ECHO_MIN_CHARS) seen.push(part);
      return whole;
    }
    /**
     * 남는 게 알맹이 있는 문장 하나는 돼야 한다.
     *
     * 예전에는 "절반 넘게 사라지면 되돌린다" 였는데, 두 문장짜리 문단에서
     * 하나가 중복이면 그것만으로 50% 라 **정당한 제거가 전부 막혔다**.
     * 분량 보호는 아래 전체 8% 상한이 이미 한다 — 여기서 두 번 막을 이유가 없다.
     */
    if (keptText.length < ECHO_MIN_CHARS) {
      deleted -= (parts.length - kept.length);
      for (const part of parts) if (part.length >= ECHO_MIN_CHARS && !seen.includes(part)) seen.push(part);
      return whole;
    }
    // 원래 <br> 로 이어져 있던 글이니 그 모양으로 되돌려 놓는다
    return whole.replace(inner, kept.join('<br>'));
  });

  if (deleted === 0) return { html: source, count: 0 };

  /**
   * 분량 상한은 **판단할 만큼 긴 글에서만** 본다.
   *
   * 표본이 짧으면 문장 하나만 지워도 비율이 커진다 — 150자짜리에서 27자를 지우면
   * 18% 다. 정상 동작인데 안전장치가 막는다.
   * (autoRepairBeforePublish 가 72자 표본에서 겪은 것과 같은 함정이다.)
   */
  const before = textLength(source);
  if (before >= 500 && textLength(out) < before * ECHO_MAX_SHRINK) {
    return { html: source, count: 0 };
  }
  return { html: out, count: deleted };
}

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

  // v3.8.657 — 천 단위 쉼표에서 갈린 숫자를 붙인다 ("5,<br>087대")
  const splitNums = repairSplitNumbers(working);
  if (splitNums.count > 0) {
    working = splitNums.html;
    repairs.push({ kind: 'split-number', count: splitNums.count, note: '쉼표에서 갈린 숫자를 붙였습니다' });
  }

  // v3.8.661 — 문장 끝에 붙은 꺾쇠 찌꺼기 ("때문입니다></p>")
  const stray = repairStrayBrackets(working);
  if (stray.count > 0) {
    working = stray.html;
    repairs.push({ kind: 'stray-bracket', count: stray.count, note: '문장 끝의 꺾쇠 찌꺼기를 지웠습니다' });
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
