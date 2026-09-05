/**
 * 📊 본문 표 상한 (v3.8.664)
 *
 * ## 왜
 * v3.8.663 의 상한은 h3Sec.tables(JSON 표)만 셌다. 그런데 모델은 표를 content 안에 `<table>` 로 넣는다 —
 * 실측 5편 전부 JSON 표 0, 본문 표 3~4. 상한이 한 번도 안 걸렸고 "📊" 로그도 한 줄 없었다.
 *
 * ## 무엇을
 * 본문 HTML 의 `<table>` 을 세고, 넘치면 숫자가 가장 적은 표부터 목록(`<ul>`)으로 바꾼다.
 * 정보는 남기고 양식만 뺀다 — 표를 통째로 지우면 "아래 표에서…" 같은 앞 문장이 허공에 뜬다.
 * 입력 배열은 바꾸지 않는다.
 */

/** 표 하나를 목록으로 — 머리행(<th>)은 버리고, 행마다 첫 칸을 굵게 */
export function tableToList(tableHtml: string): string {
  const items: string[] = [];
  for (const row of String(tableHtml || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = row[1] || '';
    if (/<th\b/i.test(rowHtml)) continue;
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((c) => (c[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (cells.length === 0) continue;
    const [head, ...rest] = cells;
    items.push(rest.length > 0 ? `<li><strong>${head}</strong> — ${rest.join(' · ')}</li>` : `<li>${head}</li>`);
  }
  return items.length > 0 ? `<ul>${items.join('')}</ul>` : '';
}

export interface InlineTableCap {
  /** 바뀐 본문들 — 입력과 같은 순서 */
  contents: string[];
  /** 본문 표 전체 수 */
  total: number;
  /** 목록으로 바꾼 수 */
  demoted: number;
}

const TABLE_RE = /<table\b[\s\S]*?<\/table>/gi;

export function capInlineTables(contents: string[], max: number): InlineTableCap {
  const found: Array<{ ci: number; html: string; digits: number }> = [];
  contents.forEach((content, ci) => {
    for (const m of String(content || '').matchAll(TABLE_RE)) {
      found.push({ ci, html: m[0], digits: (m[0].replace(/<[^>]+>/g, ' ').match(/\d/g) || []).length });
    }
  });
  const limit = Math.max(0, Math.floor(Number(max) || 0));
  if (found.length <= limit) return { contents: [...contents], total: found.length, demoted: 0 };
  const drop = [...found].sort((a, b) => a.digits - b.digits).slice(0, found.length - limit);
  const next = contents.map((content, ci) => {
    let out = String(content || '');
    for (const d of drop) {
      if (d.ci !== ci) continue;
      const list = tableToList(d.html);
      out = out.replace(d.html, () => list);
    }
    return out;
  });
  return { contents: next, total: found.length, demoted: drop.length };
}
