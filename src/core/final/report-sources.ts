/**
 * 📰 리포트 출처 본문을 근거 장부 맨 앞에 (v3.8.665)
 *
 * ## 왜
 * 키워드 리포트에는 제목이 만들어진 출처 주소가 있다. 지금까지는 그 주소가 프롬프트에
 * **글자로만** 실렸다("출처 — 여기부터 읽고 씁니다"). 모델은 주소를 못 연다.
 * 실측(v3.8.663·664): 제목이 "9·4 서민금융 복합지원센터" 를 약속했는데 그날 소식이 본문에 없었다.
 * 근거는 그날그날 네이버 검색이 주는 것에 따라 달라졌고(회차마다 편차), 정작 제목의 출처는 안 읽혔다.
 *
 * ## 무엇을
 * 출처 페이지의 본문을 긁어 근거 맨 앞에 둔다. 단 리포트 주소는 슬롯 셋의 출처가 섞여 있으므로
 * **제목·키워드 낱말이 둘 이상 든 본문만** 고른다 — 다른 슬롯의 소식(삼성전자 사내 대출 같은 것)이
 * 이 글에 섞이는 일을 막는다. AI 호출은 0회. 실패하면 조용히 빈 결과 — 예전과 같아진다.
 */

export interface ReportSourceBody {
  url: string;
  body: string;
  /** 제목·키워드 낱말 가운데 본문에 든 수 */
  hits: number;
}

export interface ReportSourcesResult {
  used: ReportSourceBody[];
  /** 관련 없어(낱말 미달) 뺀 수 */
  skipped: number;
  /** 못 긁은 수 */
  failed: number;
}

export type FetchBodyFn = (url: string) => Promise<string | null>;

const STOP = new Set([
  '여부', '방법', '기준', '절차', '조건', '대상', '정리', '총정리', '안내', '확인', '가이드', '경우', '지점', '이유',
  '완벽', '최신', '그리고', '때문', '이번', '오늘', '내가', '우리', '위한', '하는', '되는', '있는', '없는', '같은',
]);

/** 제목·키워드에서 주제 낱말 — 2자 이상 한글·숫자, 조사 제거, 정지어 제외 */
export function topicWords(keyword: string, title: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of `${keyword || ''} ${title || ''}`.replace(/[^가-힣0-9\s]/g, ' ').split(/\s+/)) {
    const w = raw.replace(/(은|는|이|가|을|를|의|에|로|와|과|도|에서|으로|까지|부터)$/, '');
    if (w.length < 2 || STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

function countHits(body: string, words: string[]): number {
  const flat = String(body || '').replace(/\s+/g, '');
  return words.filter((w) => flat.includes(w)).length;
}

export async function fetchReportSourceBodies(
  urls: unknown,
  topic: { keyword: string; title: string },
  fetchBody: FetchBodyFn,
  opts: { maxPages?: number; charsPerPage?: number; maxAttempts?: number } = {},
): Promise<ReportSourcesResult> {
  const maxPages = opts.maxPages ?? 3;
  const charsPerPage = opts.charsPerPage ?? 1800;
  const maxAttempts = opts.maxAttempts ?? 8;
  const list = [...new Set(
    (Array.isArray(urls) ? urls : [])
      .map((u) => String(u || '').trim())
      .filter((u) => /^https?:\/\//i.test(u)),
  )].slice(0, maxAttempts);
  if (list.length === 0) return { used: [], skipped: 0, failed: 0 };

  const words = topicWords(topic.keyword, topic.title);
  const minHits = words.length >= 2 ? 2 : (words.length === 1 ? 1 : 0);

  const bodies = await Promise.all(list.map(async (url) => {
    try {
      const body = await fetchBody(url);
      return body && body.trim().length >= 200 ? { url, body: body.trim() } : null;
    } catch {
      return null;   // 한 장을 못 긁어도 나머지는 간다
    }
  }));

  let skipped = 0;
  let failed = 0;
  const scored: ReportSourceBody[] = [];
  bodies.forEach((b) => {
    if (!b) { failed += 1; return; }
    const hits = countHits(b.body, words);
    if (hits < minHits) { skipped += 1; return; }
    scored.push({ url: b.url, body: b.body.slice(0, charsPerPage), hits });
  });
  scored.sort((a, b) => b.hits - a.hits);
  return { used: scored.slice(0, maxPages), skipped, failed };
}

/** 프롬프트 블록 — 근거 장부 맨 앞에 둔다. 쓸 것이 없으면 빈 문자열. */
export function buildReportSourcesBlock(result: ReportSourcesResult): string {
  if (!result || result.used.length === 0) return '';
  return [
    '[리포트 출처 원문 — 이 제목이 만들어진 자료입니다. 날짜·수치·기관명은 여기서 그대로 옮깁니다]',
    ...result.used.map((b) => `[출처] ${b.url}\n${b.body}`),
  ].join('\n\n');
}
