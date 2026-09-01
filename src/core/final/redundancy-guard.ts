/**
 * redundancy-guard — 같은 주장을 몇 번이나 되풀이했는지 재고, 지나친 것만 덜어낸다. (v3.8.619)
 *
 * ## 사장님 지적
 * "정보가 구체적이면 좋긴 한데 의도적으로 반복시킨 건 SEO 때문인 거니?"
 *
 * SEO 때문이 아니었다. 키워드 밀도 규칙은 발행 경로에 없다.
 * 원인은 **구조**다 — 상단 답변블록·요약표·도입부·본문 구간·FAQ 가 각각 따로 생성되고,
 * 저마다 그 글의 핵심 사실을 다시 말한다. 아무도 앞에서 뭐라고 했는지 모른다.
 *
 * 실측(발행글 2편):
 *   · "스트레스 금리 하한 3.0%가 적용돼요" 계열 문장 8회
 *   · "지방 규제지역 외 주담대는 1.5%" 계열 4회
 *   · 완전히 똑같은 문장 2쌍
 *
 * ## 왜 전부 지우지 않는가
 * 같은 사실이 두 번 나오는 건 낭비가 아니다. 독자는 글을 위에서 아래로 읽지 않고
 * 소제목을 훑다 필요한 구간만 본다. 그 구간이 혼자서도 말이 되려면 핵심 사실은 다시 나와야 한다.
 * 문제는 두 번이 아니라 **여덟 번**이다.
 *
 * 그래서 규칙은 하나다 — **같은 주장은 두 번까지. 세 번째부터 덜어낸다.**
 *
 * ## 안전 장치
 * 고치려다 글을 망가뜨리는 게 반복보다 나쁘다. 아래 중 하나라도 걸리면 그 문장은 그냥 둔다.
 *   · 링크·이미지가 들어 있는 문장 (지우면 CTA 가 사라진다)
 *   · 지우면 그 문단에 남는 문장이 없어지는 경우
 *   · 표·제목·스크립트 안 (문단이 아니다)
 * 그리고 전체 분량이 10% 넘게 줄면 **아무것도 적용하지 않고 원본을 돌려준다.**
 */

import { splitSentencesSafe } from './paragraph-normalizer';

/** 이보다 짧은 문장은 보지 않는다 — 짧은 말은 되풀이돼도 자연스럽다 */
export const MIN_SENTENCE_CHARS = 25;

/**
 * 이만큼 닮았으면 같은 주장으로 본다.
 *
 * 발행글 2편의 문장 쌍을 전수로 재서 잡은 값이다. 같은 사실을 다시 말한 쌍은
 * **0.44 부터 1.00** 에 몰려 있고, 주제만 같고 내용이 다른 쌍은 **0.02** 수준이었다.
 * 사이가 크게 벌어져 있어 어디를 잘라도 되지만, 멀쩡한 문장을 지우는 쪽이 더 큰 손해라
 * 실측 하단(0.44)보다 위인 0.5 로 둔다.
 */
export const SAME_CLAIM_SIMILARITY = 0.5;

/** 같은 주장이 나와도 되는 횟수 — 훑어 읽는 독자를 위해 두 번까지 남긴다 */
export const MAX_REPEATS = 2;

/** 이보다 많이 줄면 덜어내기 자체를 포기한다 */
export const MAX_SHRINK_RATIO = 0.1;

/**
 * 이 거리 안에서 같은 말이 또 나오면 횟수와 상관없이 덜어낸다.
 *
 * 사장님이 실제로 불편해한 자리는 3회차가 아니라 **바로 위에서 방금 읽은 말**이었다.
 * 상단 답변블록이 "스트레스 DSR 은 심사금리를 높이는 장치입니다" 라고 하고,
 * 바로 아래 도입부가 같은 말을 다시 한다. 둘 다 2회차라 횟수 규칙에는 걸리지 않는다.
 *
 * 화면 하나 분량(HTML 기준 약 2,500자) 안에서의 되풀이는 독자가 눈으로 바로 알아챈다.
 * 반대로 한참 뒤 구간에서 다시 나오는 건 그 구간을 처음 보는 사람에게 필요한 정보다.
 */
export const ADJACENT_DISTANCE = 2500;

export interface RepeatedClaim {
  /** 0~1. 1이면 글자까지 같다 */
  similarity: number;
  /** 처음 나온 문장 (평문) */
  first: string;
  /** 다시 나온 문장 (평문) */
  repeat: string;
  /** 이 주장이 글 전체에서 몇 번째로 나왔는가 (1부터) */
  occurrence: number;
}

const stripTags = (html: string): string => String(html || '').replace(/<[^>]+>/g, '');

/**
 * 분량을 잴 때 쓰는 글자수 — **사람이 읽는 글자만** 센다.
 *
 * 발행 HTML 에는 JSON-LD 스키마가 통째로 들어 있어(실측 80,000자 중 대부분) 이걸 같이 세면
 * "10% 넘게 줄면 포기한다"는 안전장치가 사실상 꺼진다. 본문 몇 백 자를 지워도 0.1% 로 보인다.
 */
function readableLength(html: string): number {
  return stripTags(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' '),
  ).replace(/\s+/g, ' ').trim().length;
}

/** 비교용 정규화 — 조사·문장부호·공백 차이로 다른 문장이 되지 않게 한다 */
function normalizeClaim(sentence: string): string {
  return stripTags(sentence)
    .replace(/[\s,.·\-—…"'()\[\]]/g, '')
    .toLowerCase();
}

function shingles(value: string, size = 3): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + size <= value.length; i += 1) out.add(value.slice(i, i + size));
  return out;
}

/** 두 문장이 얼마나 닮았는가 (자카드) */
export function claimSimilarity(a: string, b: string): number {
  const left = shingles(normalizeClaim(a));
  const right = shingles(normalizeClaim(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  const union = left.size + right.size - shared;
  return union > 0 ? shared / union : 0;
}

/**
 * 문단이 아닌 구간(표·제목·스크립트·스타일)의 위치를 모은다.
 * 이 안에 있는 <p>·<li> 는 건드리지 않는다 — 표 셀은 문장이 아니라 라벨이다.
 */
function protectedRanges(html: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const patterns = [
    /<table[\s\S]*?<\/table>/gi,
    /<script[\s\S]*?<\/script>/gi,
    /<style[\s\S]*?<\/style>/gi,
    /<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi,
    /**
     * FAQ 아코디언 — 실측에서 이게 제일 위험했다.
     *
     * 질문은 <summary> 에 있고 답은 <details> 안 <p> 에 있다. 답 문단만 보면
     * 앞에서 이미 한 말이라 "되풀이"로 잡히는데, 지우면 **질문만 남고 답이 사라진다.**
     * FAQ 는 앞의 내용을 다시 묻고 다시 답하는 자리다 — 되풀이가 곧 그 블록의 일이다.
     */
    /<details[\s\S]*?<\/details>/gi,
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let m = pattern.exec(html); m; m = pattern.exec(html)) ranges.push([m.index, m.index + m[0].length]);
  }
  // 질문 제목 아래의 답변 구간도 손대지 않는다
  return ranges.concat(questionHeadingRanges(html));
}

const inside = (ranges: Array<[number, number]>, at: number): boolean =>
  ranges.some(([from, to]) => at >= from && at < to);

/**
 * 질문 제목 뒤에 오는 문단은 **답변**이다 — 되풀이로 보고 지우면 안 된다.
 *
 * 실측: FAQ 가 두 가지 꼴로 나온다.
 *   · <details><summary>질문</summary>…답…</details>   (위에서 통째로 보호)
 *   · <h3>…인가요</h3><p>답변</p>                        ← 이쪽이 이 함수가 막는 것
 * 뒤쪽 꼴에서 답변 문단만 지우면 **질문만 남고 답이 사라진다.** 글이 더 나빠진다.
 */
function questionHeadingRanges(html: string): Array<[number, number]> {
  const HEADING = /<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/gi;
  const heads: Array<{ at: number; end: number; question: boolean }> = [];
  HEADING.lastIndex = 0;
  for (let m = HEADING.exec(html); m; m = HEADING.exec(html)) {
    heads.push({
      at: m.index,
      end: m.index + m[0].length,
      question: QUESTION_FORM.test(stripTags(m[1] || '')),
    });
  }

  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < heads.length; i += 1) {
    if (!heads[i]!.question) continue;
    // 이 질문 제목부터 다음 제목 전까지가 그 질문의 답이다
    const to = i + 1 < heads.length ? heads[i + 1]!.at : html.length;
    ranges.push([heads[i]!.end, to]);
  }
  return ranges;
}

/**
 * 묻고 답하는 문장 — 지우면 안 된다.
 *
 * 실측에서 걸렸다: "9급 1호봉 월 300만원은 봉급인가요. 봉급과 수당을 합친 보수예요."
 * FAQ 에서 같은 사실을 다시 말하는 건 되풀이가 아니라 **그게 답**이다.
 * 이걸 빼면 질문만 남아 글이 더 나빠진다.
 */
const QUESTION_FORM = /[?？]|(?:인가요|나요|까요|을까|ㄹ까요|무엇|어떻게|얼마)/;

/** 이 문장을 지워도 되는가 — 링크·이미지·질문을 품고 있으면 안 된다 */
function isRemovable(sentenceHtml: string): boolean {
  if (/<a\b|<img\b/i.test(sentenceHtml)) return false;
  return !QUESTION_FORM.test(stripTags(sentenceHtml));
}

const BLOCK = /<(p|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

interface Seen { normalized: string; text: string; count: number; lastAt: number }

/**
 * 되풀이된 주장을 찾는다. **아무것도 바꾸지 않는다** — 비평·로그용.
 */
export function findRepeatedClaims(html: string): RepeatedClaim[] {
  const source = String(html || '');
  const guarded = protectedRanges(source);
  const seen: Seen[] = [];
  const out: RepeatedClaim[] = [];

  BLOCK.lastIndex = 0;
  for (let m = BLOCK.exec(source); m; m = BLOCK.exec(source)) {
    if (inside(guarded, m.index)) continue;
    for (const sentence of splitSentencesSafe(m[3]!)) {
      const text = stripTags(sentence).trim();
      if (text.length < MIN_SENTENCE_CHARS) continue;
      const normalized = normalizeClaim(sentence);

      const hit = seen.find((s) => claimSimilarity(s.normalized, normalized) >= SAME_CLAIM_SIMILARITY);
      if (!hit) { seen.push({ normalized, text, count: 1, lastAt: m.index }); continue; }

      hit.count += 1;
      out.push({
        similarity: Number(claimSimilarity(hit.normalized, normalized).toFixed(2)),
        first: hit.text,
        repeat: text,
        occurrence: hit.count,
      });
    }
  }
  return out;
}

export interface DedupeResult {
  html: string;
  /** 실제로 덜어낸 문장 수 */
  removed: number;
  /** 몇 번째 되풀이였는지까지 담은 기록 */
  report: RepeatedClaim[];
  /** 적용을 포기했다면 그 이유 */
  skipped: string;
}

/**
 * 세 번째부터의 되풀이를 덜어낸다.
 *
 * 어떤 경우에도 예외를 던지지 않는다. 판단이 안 서면 원본을 그대로 돌려준다.
 */
export function dedupeRepeatedClaims(html: string): DedupeResult {
  const source = String(html || '');
  if (!source.trim()) return { html: source, removed: 0, report: [], skipped: '' };

  try {
    const guarded = protectedRanges(source);
    const seen: Seen[] = [];
    const report: RepeatedClaim[] = [];
    let removed = 0;

    BLOCK.lastIndex = 0;
    const next = source.replace(BLOCK, (whole, tag: string, attrs: string, inner: string, offset: number) => {
      if (inside(guarded, offset)) return whole;

      const sentences = splitSentencesSafe(inner);
      if (sentences.length === 0) return whole;

      const kept: string[] = [];
      let droppedHere = 0;
      for (const sentence of sentences) {
        const text = stripTags(sentence).trim();
        if (text.length < MIN_SENTENCE_CHARS) { kept.push(sentence); continue; }

        const normalized = normalizeClaim(sentence);
        const hit = seen.find((s) => claimSimilarity(s.normalized, normalized) >= SAME_CLAIM_SIMILARITY);
        if (!hit) { seen.push({ normalized, text, count: 1, lastAt: offset }); kept.push(sentence); continue; }

        hit.count += 1;
        report.push({
          similarity: Number(claimSimilarity(hit.normalized, normalized).toFixed(2)),
          first: hit.text,
          repeat: text,
          occurrence: hit.count,
        });

        // 두 번까지는 남긴다. 세 번째부터가 덜어낼 대상이다.
        /**
         * 덜어낼 이유는 두 가지다.
         *   ① 세 번을 넘겼다 — 전체적으로 너무 여러 번 말했다
         *   ② 바로 위에서 방금 한 말이다 — 횟수와 상관없이 눈에 띈다
         * ②가 사장님이 실제로 짚은 자리다(답변블록 바로 아래 도입부).
         */
        const tooMany = hit.count > MAX_REPEATS;
        const tooClose = offset - hit.lastAt < ADJACENT_DISTANCE;
        hit.lastAt = offset;

        if ((!tooMany && !tooClose) || !isRemovable(sentence)) { kept.push(sentence); continue; }
        droppedHere += 1;
      }

      /**
       * 문단에 읽을 글자가 안 남으면 덜어내지 않은 셈 친다.
       *
       * `kept.length === 0` 만 보면 부족하다. 문장 분리가 남긴 마침표 한 개도
       * "문장 하나"로 세어져 `<p>.</p>` 가 그대로 발행된다 — 실제로 시험에서 9개가 나왔다.
       * 그래서 개수가 아니라 **글자가 남았는지**를 본다.
       */
      const keptText = stripTags(kept.join(' ')).replace(/[\s.,·!?"'()]/g, '');
      if (kept.length === 0 || keptText.length === 0) return whole;
      removed += droppedHere;
      return `<${tag}${attrs}>${kept.join(' ')}</${tag}>`;
    });

    const before = readableLength(source);
    const after = readableLength(next);
    if (before > 0 && after < before * (1 - MAX_SHRINK_RATIO)) {
      return { html: source, removed: 0, report, skipped: `분량이 ${Math.round((1 - after / before) * 100)}% 줄어 적용하지 않았습니다` };
    }

    return { html: next, removed, report, skipped: '' };
  } catch {
    return { html: source, removed: 0, report: [], skipped: '검사 중 예외 — 원본을 그대로 둡니다' };
  }
}

/** 로그 한 줄 */
export function describeRedundancy(report: RepeatedClaim[], removed: number): string {
  if (report.length === 0) return '되풀이된 주장 없음';
  const worst = report.reduce((max, r) => (r.occurrence > max ? r.occurrence : max), 0);
  return `같은 주장 되풀이 ${report.length}건 (최대 ${worst}회) · ${removed}문장 정리`;
}
