/**
 * 👁️ 실제로 보이는 글 (748-quality-fix-2 C)
 *
 * ## 왜
 * Final Judge 는 초안 객체(allSectionsObj)를 봤다. 그 뒤 HTML 조립 → 되풀이 정리 → 말투 → 자동 수리 → 97% 발행 전 자가 수정이
 * 본문을 또 바꿨다. 748a 실측: Judge 가 MANUAL_REVIEW 로 막은 문장이 자가 수정에서 이미 고쳐져 있었다(낡은 판정).
 * 심사는 **독자가 보는 최종 HTML** 로 해야 한다.
 *
 * ## 무엇을 하나 (LLM 호출 0)
 * 조립된 HTML 을 다시 글 구조로 읽는다: 제목 · 도입(답 상자 + intro-section) · 절(h2/h3) · FAQ(details) · CTA(cta-box) · 결론(conclusion-section) · 요약표.
 * 조립기가 쓰는 class 이름(intro-section·conclusion-section·answer-first·cta-box·summary-container)에 기댄다 — 그 이름이 바뀌면 여기도 바뀌어야 한다.
 */

export interface VisibleH3 { h3: string; content: string }
export interface VisibleSection { h2: string; h3Sections: VisibleH3[] }
export interface VisibleArticle {
  title: string;
  /** 답 상자(질문·답·근거) + 도입 문단 — Judge 가 "보이는 도입" 으로 읽는다 */
  introduction: string;
  sections: VisibleSection[];
  conclusion: string;
  faqItems: Array<{ question: string; answer: string }>;
  ctaText: string;
  summaryText: string;
  /** 파서가 못 찾은 것 — 로그용 */
  notes: string[];
}

const FAQ_HEADING = /자주\s*묻는|FAQ/i;

function plain(html: string): string {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

/** 여는 태그부터 짝이 맞는 닫는 태그까지 — 중첩 div 를 세며 자른다 */
function blockAt(html: string, openIndex: number, tag: string): string {
  const openRe = new RegExp(`<${tag}\\b`, 'gi');
  const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
  let depth = 0;
  let pos = openIndex;
  for (;;) {
    openRe.lastIndex = pos; closeRe.lastIndex = pos;
    const o = openRe.exec(html); const c = closeRe.exec(html);
    if (!c) return html.slice(openIndex);
    if (o && o.index < c.index) { depth += 1; pos = o.index + 1; continue; }
    depth -= 1; pos = c.index + c[0].length;
    if (depth === 0) return html.slice(openIndex, pos);
  }
}

function findBlock(html: string, classMarker: RegExp, tag: string): { html: string; start: number; end: number } | null {
  const m = classMarker.exec(html);
  if (!m) return null;
  const start = html.lastIndexOf(`<${tag}`, m.index);
  if (start < 0) return null;
  const block = blockAt(html, start, tag);
  return { html: block, start, end: start + block.length };
}

/** 절 안의 "<div class="content">…" 껍데기와 조립기가 끼운 장식(이미지·광고·목차)을 뺀 본문 조각 */
function sectionBodyOf(chunk: string): string {
  return chunk
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<div class="ad-safe-zone"[\s\S]*?<\/div>/gi, '');
}

export function parseVisibleArticle(html: string): VisibleArticle {
  const src = String(html || '');
  const notes: string[] = [];
  const titleM = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleM ? plain(titleM[1] || '') : '';
  if (!title) notes.push('h1 없음');

  const answer = findBlock(src, /<section[^>]*class="[^"]*answer-first[^"]*"/i, 'section');
  const intro = findBlock(src, /<div[^>]*class="[^"]*intro-section[^"]*"/i, 'div');
  if (!intro) notes.push('intro-section 없음');
  const conclusion = findBlock(src, /<div[^>]*class="[^"]*conclusion-section[^"]*"/i, 'div');
  if (!conclusion) notes.push('conclusion-section 없음');
  const summary = findBlock(src, /<div[^>]*class="[^"]*summary-container[^"]*"/i, 'div');

  // 절: 첫 <h2> 부터 결론 앞까지. FAQ h2 는 절이 아니다(details 로 따로 읽는다)
  const bodyStart = intro ? intro.end : (answer ? answer.end : 0);
  const bodyEnd = conclusion ? conclusion.start : src.length;
  const body = src.slice(bodyStart, bodyEnd);
  const h2Parts = body.split(/(?=<h2\b)/i).slice(1);
  const sections: VisibleSection[] = [];
  let faqHtml = '';
  for (const part of h2Parts) {
    const h2M = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const h2 = plain(h2M ? h2M[1] || '' : '');
    const rest = part.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, '');
    if (FAQ_HEADING.test(h2)) { faqHtml = rest; continue; }
    const h3Parts = sectionBodyOf(rest).split(/(?=<h3\b)/i);
    const h3Sections: VisibleH3[] = [];
    for (const hp of h3Parts) {
      const h3M = hp.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const content = hp.replace(/<h3[^>]*>[\s\S]*?<\/h3>/i, '').trim();
      if (!h3M && !plain(content)) continue;
      h3Sections.push({ h3: plain(h3M ? h3M[1] || '' : ''), content });
    }
    if (h2 || h3Sections.length) sections.push({ h2, h3Sections });
  }
  if (sections.length === 0) notes.push('h2 절 없음');

  // FAQ — <details><summary>Q…</summary><div>답</div></details>. FAQ h2 가 없어도 details 는 찾는다
  const faqSource = faqHtml || src;
  const faqItems: Array<{ question: string; answer: string }> = [];
  for (const m of faqSource.matchAll(/<details[^>]*>([\s\S]*?)<\/details>/gi)) {
    const sm = m[1]!.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    const question = plain(sm ? sm[1] || '' : '').replace(/^Q\.\s*/i, '').replace(/\s*▼\s*$/, '');
    const answer = plain(m[1]!.replace(/<summary[^>]*>[\s\S]*?<\/summary>/i, ''));
    if (question) faqItems.push({ question, answer });
  }

  // CTA — 후크 문장 + 버튼 글자 + 주소. 조립기 형식(cta-box)이 없으면 빈 문자열
  const ctaLines: string[] = [];
  for (const m of src.matchAll(/<div[^>]*class="[^"]*cta-box[^"]*"/gi)) {
    const box = blockAt(src, m.index!, 'div');
    const hook = plain((box.match(/<p[^>]*class="[^"]*cta-hook[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '');
    const btns = [...box.matchAll(/<a[^>]*class="[^"]*cta-btn[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].map((b) => `[${plain(b[2] || '')}] ${b[1]}`);
    ctaLines.push(`${hook} ${btns.join(' ')}`.trim());
  }

  const introduction = [answer ? answer.html : '', intro ? intro.html : ''].filter(Boolean).join('\n');
  const summaryText = [answer ? plain(answer.html) : '', summary ? plain(summary.html) : ''].filter(Boolean).join('\n');
  return { title, introduction, sections, conclusion: conclusion ? conclusion.html : '', faqItems, ctaText: ctaLines.join('\n'), summaryText, notes };
}

/** Judge·값 대조가 읽는 평문 — 제목은 뺀다(제목은 따로 본다) */
export function visiblePlainText(a: VisibleArticle): string {
  return [a.introduction, ...a.sections.flatMap((s) => [s.h2, ...s.h3Sections.flatMap((h) => [h.h3, h.content])]), a.conclusion].map(plain).filter(Boolean).join('\n');
}
