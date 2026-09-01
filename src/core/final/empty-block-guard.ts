/**
 * empty-block-guard — 내용이 빈 블록을 아예 그리지 않고, 그래도 남으면 발행을 멈춘다.
 *
 * ## 왜 비는가
 * 모델이 안 채워서가 아니다. 후처리(sanitizeFactUnsafeHtml)가 근거 없는 문장을
 * 통째로 지우고, 남는 게 없으면 빈 문자열을 돌려준다. 그게 FAQ 답변·요약표 셀·
 * 소제목에 그대로 들어가 "Q 만 있고 A 는 없는 아코디언", "제목만 있는 표" 가 나간다.
 *
 * ## 원칙
 * 깨진 걸 보여주는 것보다 없는 게 낫다. 빈 값을 그럴듯한 문구로 메우지도 않는다 —
 * 그건 지어내는 것이고, 그럴 바엔 그 블록이 없는 편이 독자에게 정직하다.
 */

export interface FaqLike { question: string; answer: string }

export interface EmptyBlock {
  kind: 'heading' | 'faq' | 'cell';
  /** 문제가 된 조각 (로그·에러 메시지용) */
  snippet: string;
}

/** 사람 눈에 보이는 글자만 남긴다 — 태그·엔티티만 남은 껍데기는 빈 것이다 */
function visibleText(html: unknown): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/[\s​ ]+/g, ' ')
    .trim();
}

function isBlank(html: unknown): boolean {
  return visibleText(html).length === 0;
}

/**
 * 질문이나 답변 한쪽이라도 비면 그 항목을 버린다.
 * 반쪽짜리 FAQ 는 구조화 데이터로도 나가기 때문에 검색엔진까지 빈 답변을 읽는다.
 */
export function dropEmptyFaqItems<T extends FaqLike>(faqs: T[]): T[] {
  try {
    if (!Array.isArray(faqs)) return [];
    return faqs.filter((f) => f && !isBlank(f.question) && !isBlank(f.answer));
  } catch {
    return Array.isArray(faqs) ? faqs : [];
  }
}

/** 요약표에서 이 비율을 넘게 비면 표 자체를 그리지 않는다 — 구멍 뚫린 표가 더 나쁘다 */
const MAX_EMPTY_CELL_RATIO = 0.5;

/**
 * 🕳️ v3.8.619 — 항목만 있고 값이 빈 줄은 버린다.
 *
 * 사장님 실물 검수: "표도 공란이 있는데 의도한 거면 이해하겠지만 문맥상 누락인 것 같아"
 * 실제로 발행글의 요약표에 `공통 인상률 | (빈칸)` 줄이 그대로 나갔다.
 *
 * 읽는 사람에게 빈 값은 "없다"가 아니라 **"만들다 만 표"** 로 읽힌다.
 * 항목 이름은 첫 칸이고 나머지가 값이다 — 값이 하나도 없으면 그 줄은 아무 말도 하지 않는다.
 * (전부 빈 줄만 걸러 내던 예전 규칙은 첫 칸이 차 있으면 통과시켰다. 그게 이 사고다.)
 */
export function dropValuelessRows(rows: string[][]): string[][] {
  try {
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => {
      if (!Array.isArray(row) || row.length === 0) return false;
      if (row.length === 1) return !isBlank(row[0] as string);
      return row.slice(1).some((cell) => !isBlank(cell as string));
    });
  } catch {
    return Array.isArray(rows) ? rows : [];
  }
}

/**
 * 요약표를 그릴 만한지 판단한다.
 * 셀 하나쯤 비는 건 통과시킨다 — 지나치게 엄하면 멀쩡한 표가 통째로 사라진다.
 */
export function isSummaryRenderable(headers: string[], rows: string[][]): boolean {
  try {
    const cleanHeaders = (headers || []).filter((h) => !isBlank(h));
    if (cleanHeaders.length === 0) return false;

    const allRows = (rows || []).filter((r) => Array.isArray(r) && r.length > 0);
    if (allRows.length === 0) return false;

    const cells = allRows.flat();
    if (cells.length === 0) return false;

    const emptyCount = cells.filter((c) => isBlank(c)).length;
    return emptyCount / cells.length <= MAX_EMPTY_CELL_RATIO;
  } catch {
    return true;   // 판단이 안 서면 그린다 — 멀쩡한 표를 지우는 쪽이 더 손해다
  }
}

/** 원래 글자가 없는 게 정상인 태그 — 이미지·구분선·표 셀은 비어도 깨진 게 아니다 */
const CONTENT_BEARING = /<(img|hr|br|iframe|video|source|svg|canvas|input)\b/i;

/**
 * 완성된 HTML 에서 눈에 띄게 깨진 블록을 찾는다.
 *
 * 오탐이 나면 멀쩡한 발행이 막히므로 **확실한 것만** 잡는다:
 *   · 글자가 하나도 없는 소제목(h2~h4)
 *   · 답변이 빈 FAQ 아코디언
 * 셀 하나가 빈 표 같은 건 여기서 잡지 않는다(위 isSummaryRenderable 가 미리 거른다).
 */
export function findEmptyBlocks(html: string): EmptyBlock[] {
  try {
    const source = String(html || '');
    const found: EmptyBlock[] = [];

    const headingRe = /<(h[2-4])\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(source)) !== null) {
      const inner = m[2] || '';
      if (isBlank(inner) && !CONTENT_BEARING.test(inner)) {
        found.push({ kind: 'heading', snippet: m[0].slice(0, 120) });
      }
    }

    const faqRe = /<details\b[^>]*>([\s\S]*?)<\/details>/gi;
    while ((m = faqRe.exec(source)) !== null) {
      const body = m[1] || '';
      const answer = body.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/gi, '');
      if (isBlank(answer) && !CONTENT_BEARING.test(answer)) {
        found.push({ kind: 'faq', snippet: m[0].slice(0, 120) });
      }
    }

    return found;
  } catch {
    return [];   // 검사기가 터져서 발행이 막히면 안 된다
  }
}

/**
 * 답변이 빈 FAQ 아코디언을 **HTML 에서 통째로 걷어낸다**. (v3.8.590)
 *
 * ## 왜 — 실제 발행 실패 (2026-08-29)
 *   "발행 실패: 빈 블록이 남아 발행을 중단했습니다 (FAQ 답변 1개)"
 * FAQ 답변 하나가 비었다고 **글 전체가 버려졌다.** 100초 걸려 만들고
 * 본문 생성비까지 치른 글이다. 나머지는 멀쩡했다.
 *
 * 빈 FAQ 는 **고칠 수 있는 결함**이다. 그 항목만 지우면 글은 성립한다.
 * 반쪽 FAQ 를 그냥 두면 구조화 데이터로도 나가 검색엔진이 빈 답변을 읽으므로
 * 지우는 게 맞고, 그렇다고 글을 통째로 버릴 이유는 없다.
 *
 * 빈 소제목(heading)은 다르다. 그건 섹션이 통째로 비었다는 뜻이라 지워도
 * 글의 뼈대가 무너진다 — 그때는 예전처럼 막는다.
 */
export function removeEmptyFaqBlocks(html: string): { html: string; removed: number } {
  try {
    const source = String(html || '');
    let removed = 0;
    const out = source.replace(/<details\b[^>]*>([\s\S]*?)<\/details>/gi, (whole, body: string) => {
      const answer = String(body || '').replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/gi, '');
      if (isBlank(answer) && !CONTENT_BEARING.test(answer)) {
        removed += 1;
        return '';
      }
      return whole;
    });
    return { html: removed > 0 ? out : source, removed };
  } catch {
    return { html: String(html || ''), removed: 0 };   // 고치다 글을 깨뜨리지 않는다
  }
}

/** 에러 메시지용 — 무엇이 비었는지 사람이 읽을 수 있게 */
export function describeEmptyBlocks(blocks: EmptyBlock[]): string {
  const label: Record<EmptyBlock['kind'], string> = {
    heading: '소제목',
    faq: 'FAQ 답변',
    cell: '표 항목',
  };
  const counts = blocks.reduce<Record<string, number>>((acc, b) => {
    acc[label[b.kind]] = (acc[label[b.kind]] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([k, v]) => `${k} ${v}개`).join(', ');
}
