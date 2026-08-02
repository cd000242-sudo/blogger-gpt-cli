/**
 * 문단 길이 고르기 (v3.8.404)
 *
 * 사용자 요구(2026-08-02):
 *   "줄바꿈도 한 문단~두 문단씩 깔끔하게 바뀌면 좋겠어요.
 *    한 문단이 너무 길면 줄바꿈, 한 문단이 짧으면 두 문단, 이런 식으로요."
 *
 * ## 왜 필요한가 — 실측
 *   사용자 발행글: 문단 46개, 평균 203자, 최장 310자.
 *   **모바일에서 6줄을 넘는 문단이 42개(91%)** 였다. 읽기 전에 부담부터 준다.
 *   2026 권장은 한 문단 6줄 이내(모바일 한 줄 ≒ 25자 → 약 150자).
 *
 * ## 어떻게 나누나
 *   · 문장 경계에서만 자른다. 문장 중간을 자르면 뜻이 깨진다.
 *   · **태그 깊이 0에서만** 자른다. <strong>이나 <a> 안에서 자르면 HTML 이 깨진다.
 *   · 짧은 문단은 다음 문단과 합친다 — 한 줄짜리가 이어지면 그것도 산만하다.
 *   · 목록·표·제목·CTA 카드는 건드리지 않는다. 이미 구조가 잡혀 있다.
 */

export interface NormalizeOptions {
  /** 이 길이를 넘으면 쪼갠다 (모바일 6줄 ≒ 150자) */
  maxChars?: number;
  /** 이 길이보다 짧으면 다음 문단과 합친다 */
  minChars?: number;
  /** 한 문단에 넣을 문장 수 상한 */
  maxSentences?: number;
  /**
   * 문장마다 <br> 로 줄을 바꾼다 (모바일 기준). (v3.8.406)
   * 사용자 요구: "모바일 기준으로 깔끔하게 문단 정리가 되어 있는 것"
   * 문단만 나누면 데스크톱에선 한 줄이 60자가 넘어 여전히 답답하다.
   */
  breakSentences?: boolean;
  /** 한 줄이 이보다 길면 쉼표에서 한 번 더 끊는다 */
  maxLineChars?: number;
}

/**
 * 한 문장이 길면 쉼표에서 끊는다 — 모바일 한 줄(25~35자)에 맞춘다.
 * 태그 안의 쉼표에서는 끊지 않는다(속성값에 쉼표가 흔하다).
 */
export function breakLongLine(sentence: string, maxLineChars: number): string {
  if (visibleLength(sentence) <= maxLineChars) return sentence;

  const out: string[] = [];
  let buf = '';
  let inTag = false;
  for (let i = 0; i < sentence.length; i += 1) {
    const ch = sentence[i]!;
    buf += ch;
    if (ch === '<') { inTag = true; continue; }
    if (ch === '>') { inTag = false; continue; }
    if (inTag) continue;
    if (ch === ',' && visibleLength(buf) >= maxLineChars * 0.6) {
      out.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.join('<br>\n');
}

/**
 * 문장 단위로 자른다 — **태그 밖에서만**.
 *
 * 한국어 문장은 "다." "요." "죠." "까?" "!" 로 끝난다.
 * `<a href="...">` 안의 마침표(예: 도메인)에서 자르면 링크가 두 동강 난다.
 * 그래서 `<` 와 `>` 를 세어 태그 안인지 보고, 태그 밖일 때만 경계로 인정한다.
 */
export function splitSentencesSafe(inner: string): string[] {
  const s = String(inner || '');
  if (!s) return [];

  const out: string[] = [];
  let buf = '';
  let inTag = false;
  let depth = 0;              // 열린 인라인 태그 깊이

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    buf += ch;

    if (ch === '<') { inTag = true; continue; }
    if (ch === '>') {
      inTag = false;
      // 방금 닫힌 태그가 여는 태그인지 닫는 태그인지 센다
      const tagStart = buf.lastIndexOf('<');
      const tag = buf.slice(tagStart);
      if (/^<\//.test(tag)) depth = Math.max(0, depth - 1);
      else if (!/\/>$/.test(tag) && !/^<(br|img|hr|input|meta)\b/i.test(tag)) depth += 1;
      continue;
    }
    if (inTag || depth > 0) continue;      // 태그 안 · 인라인 태그 안에서는 안 자른다

    // 문장 끝인가 — 뒤가 공백이거나 끝이어야 한다(소수점·약어 오검출 방지)
    const isEnd = (ch === '.' || ch === '!' || ch === '?')
      && /[다요죠까함음됨\)\]"'」』]$|[!?]$/.test(buf.slice(-2, -1) + ch === '..' ? buf.slice(-2) : buf.trimEnd().slice(-2, -1) + ch);
    const next = s[i + 1];
    if ((ch === '.' || ch === '!' || ch === '?') && (next === undefined || /\s/.test(next))) {
      // 한국어 종결(…다. …요.) 또는 물음표·느낌표
      const tail = buf.trimEnd();
      const prev = tail.slice(-2, -1);
      if (ch !== '.' || /[다요죠까함음됨\)\]"'」』0-9]/.test(prev)) {
        out.push(buf.trim());
        buf = '';
      }
    }
    void isEnd;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/** 태그를 뺀 실제 글자 수 */
export function visibleLength(html: string): number {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim().length;
}

/**
 * 문단들을 고르게 다시 묶는다.
 *   긴 문단 → 문장 2~3개씩 끊어 여러 문단으로
 *   짧은 문단 → 다음 문단과 합쳐 한 문단으로
 */
export function regroupParagraph(inner: string, opts: NormalizeOptions = {}): string[] {
  const maxChars = opts.maxChars ?? 150;
  const maxSentences = opts.maxSentences ?? 3;

  const sentences = splitSentencesSafe(inner);

  // v3.8.406: 짧은 문단이어도 문장이 둘 이상이면 줄은 바꿔준다.
  //   (예전엔 여기서 바로 반환해 짧은 문단은 한 줄로 뭉쳐 있었다)
  if (visibleLength(inner) <= maxChars) {
    if (opts.breakSentences === false || sentences.length <= 1) return [inner.trim()];
    const maxLine0 = opts.maxLineChars ?? 38;
    return [sentences.map((s) => breakLongLine(s, maxLine0)).join('<br>\n').trim()];
  }

  if (sentences.length <= 1) return [inner.trim()];   // 한 문장이면 못 나눈다 — 그대로 둔다

  // v3.8.406: 모바일에서는 문장마다 줄을 바꾼다. 문단만 나누면 한 줄이 여전히 길다.
  const joiner = opts.breakSentences === false ? ' ' : '<br>\n';
  const maxLine = opts.maxLineChars ?? 38;
  const shape = (s: string) => (opts.breakSentences === false ? s : breakLongLine(s, maxLine));

  const groups: string[] = [];
  let cur: string[] = [];
  let curLen = 0;
  for (const sent of sentences) {
    const len = visibleLength(sent);
    const wouldOverflow = curLen > 0 && (curLen + len > maxChars || cur.length >= maxSentences);
    if (wouldOverflow) {
      groups.push(cur.join(joiner));
      cur = [];
      curLen = 0;
    }
    cur.push(shape(sent));
    curLen += len;
  }
  if (cur.length) groups.push(cur.join(joiner));
  return groups.filter((g) => g.trim());
}

/**
 * 본문 전체의 <p> 를 고르게 만든다.
 * 실패하면 원본을 그대로 돌려준다 — 정리하다가 글을 깨뜨리면 안 된다.
 */
export function normalizeParagraphs(html: string, opts: NormalizeOptions = {}): { html: string; split: number; merged: number } {
  const src = String(html || '');
  if (!src.trim()) return { html: src, split: 0, merged: 0 };

  const minChars = opts.minChars ?? 60;
  let split = 0;
  let merged = 0;

  try {
    // <p ...>...</p> 만 다룬다. 목록·표·제목·CTA 카드는 건드리지 않는다.
    const parts = [...src.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)];
    if (parts.length === 0) return { html: src, split: 0, merged: 0 };

    let out = '';
    let cursor = 0;
    let carry: { attrs: string; inner: string } | null = null;   // 합칠 짧은 문단

    for (const m of parts) {
      const [full, attrs = '', inner = ''] = m as unknown as [string, string, string];
      const at = m.index!;
      out += src.slice(cursor, at);
      cursor = at + full.length;

      // CTA 카드·고지문은 손대지 않는다
      if (/affiliate-disclosure|data-orbit-cta/i.test(attrs)) {
        if (carry) { out += `<p${carry.attrs}>${carry.inner}</p>`; carry = null; }
        out += full;
        continue;
      }

      let workInner = inner;
      let workAttrs = attrs;
      if (carry) {
        // 앞 문단이 짧았다 → 지금 것과 합친다
        workInner = `${carry.inner} ${inner}`.trim();
        workAttrs = carry.attrs;
        carry = null;
        merged += 1;
      }

      const len = visibleLength(workInner);
      if (len > 0 && len < minChars) {
        carry = { attrs: workAttrs, inner: workInner };   // 다음 문단과 합치려고 들고 간다
        continue;
      }

      const groups = regroupParagraph(workInner, opts);
      if (groups.length > 1) split += groups.length - 1;
      out += groups.map((g) => `<p${workAttrs}>${g}</p>`).join('\n');
    }

    if (carry) out += `<p${carry.attrs}>${carry.inner}</p>`;   // 마지막에 남은 짧은 문단
    out += src.slice(cursor);
    return { html: out, split, merged };
  } catch {
    return { html: src, split: 0, merged: 0 };
  }
}
