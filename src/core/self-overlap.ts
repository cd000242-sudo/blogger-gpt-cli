/**
 * 자기중복(self-cannibalization) 관측 — v3.8.390
 *
 * ⚠️ 절대 차단하지 않는다. 사용자 원칙: "검수 때문에 글이 통과가 안 되서 발행이 안 되면 절대 안 된다."
 *   이 모듈은 재고 측정만 한다. 판단과 조치는 사람이 한다.
 *
 * 왜 필요한가:
 *   v3.8.385 에 buildUniquenessBlock(기존 글 제목을 모델에 보여줘 각도를 다르게 잡게 하는 예방책)을
 *   넣었지만, **그게 실제로 먹혔는지 재는 계기판이 없다.** 효과를 모르면 개선도 못 한다.
 *   기존 유사도 검증은 페러프레이징 모드(원문 대비)뿐이고, "내 사이트 기존 글 대비"는 없었다.
 *
 * 임계값 0.35 는 추측이 아니라 실측 분포에서 나왔다.
 *   발행글 322편 전체 쌍(51,681개) 측정 (2026-07-30):
 *     중간값 0.069 · 90% 0.098 · 99% 0.168 · 99.9% 0.284 · 최대 0.549
 *     임계 0.30 → 28쌍 / 0.35 → 11쌍(0.02%) / 0.40 → 7쌍 / 0.55 → 0쌍
 *   0.35 를 넘는 11쌍이 정확히 실제 중복이다 —
 *     청년내일저축계좌 4편(0.40~0.55), 추석 연휴 진료 지역 시리즈(0.38~0.45).
 *   ※ 지역 시리즈는 정당한 분화이므로 경고가 떠도 그대로 발행하는 게 맞다.
 *     그래서 이 모듈은 판단하지 않고 사실만 보고한다.
 *
 *   (착각 기록: 템플릿 상용구가 기준선을 부풀릴 것이라 추측했으나 실측에서 틀렸다.
 *    템플릿은 대부분 마크업이고 텍스트 비중이 작아 stripToText 후 영향이 미미하다.)
 *
 * 비용: 워드프레스 REST 1회 호출(본문 8편 동시 수신). **LLM 호출 0.**
 *   유사도 계산은 paraphrasing-validator 의 trigram Jaccard 를 그대로 재사용한다
 *   (따로 구현하면 같은 현상에 다른 숫자가 나와 판단이 어긋난다).
 */
import { stripToText, trigramSet, jaccard } from './paraphrasing-validator';

export type OverlapHit = {
  id: number;
  title: string;
  url: string;
  similarity: number;
};

export type SelfOverlapReport = {
  /** 비교한 기존 글 수 */
  checked: number;
  /** 가장 비슷한 글 (없으면 null) */
  worst: OverlapHit | null;
  /** 임계값을 넘은 글들 (경고 대상) */
  flagged: OverlapHit[];
  threshold: number;
  /** 측정을 못 한 이유 (측정 성공 시 빈 문자열) */
  skipped: string;
};

const EMPTY = (skipped: string, threshold: number): SelfOverlapReport => ({
  checked: 0, worst: null, flagged: [], threshold, skipped,
});

/**
 * 새 글 본문을 사이트의 기존 글들과 비교한다.
 * 실패하면 skipped 에 이유를 담아 조용히 돌려준다 — 절대 throw 하지 않는다.
 */
export async function measureSelfOverlap(
  siteUrl: string,
  keyword: string,
  newBodyHtml: string,
  options: { threshold?: number; sampleSize?: number; timeoutMs?: number } = {},
): Promise<SelfOverlapReport> {
  const threshold = options.threshold ?? 0.35;
  const sampleSize = options.sampleSize ?? 8;
  const timeoutMs = options.timeoutMs ?? 12000;

  const base = String(siteUrl || '').trim().replace(/\/+$/, '');
  const kw = String(keyword || '').trim();
  const newText = stripToText(String(newBodyHtml || ''));
  if (!base) return EMPTY('사이트 URL 없음', threshold);
  if (!kw) return EMPTY('키워드 없음', threshold);
  if (newText.length < 500) return EMPTY(`새 본문이 너무 짧음(${newText.length}자)`, threshold);

  let posts: Array<{ id?: number; title?: any; link?: string; content?: any }> = [];
  try {
    const url = `${base}/wp-json/wp/v2/posts?search=${encodeURIComponent(kw)}`
      + `&per_page=${sampleSize}&status=publish&_fields=id,title,link,content`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return EMPTY(`기존 글 조회 실패 HTTP ${res.status}`, threshold);
    const body: any = await res.json();
    if (!Array.isArray(body)) return EMPTY('기존 글 응답 형식 예상과 다름', threshold);
    posts = body;
  } catch (error: any) {
    return EMPTY(`기존 글 조회 예외: ${String(error?.message || error).slice(0, 60)}`, threshold);
  }

  if (posts.length === 0) return EMPTY('비교할 기존 글 없음', threshold);

  const newGrams = trigramSet(newText);
  const hits: OverlapHit[] = [];
  posts.forEach((post) => {
    const html = String(post?.content?.rendered || '');
    const text = stripToText(html);
    if (text.length < 500) return;   // 태그 피드·빈 글은 비교 의미가 없다
    hits.push({
      id: Number(post?.id || 0),
      title: String(post?.title?.rendered || '').replace(/<[^>]+>/g, '').trim(),
      url: String(post?.link || ''),
      similarity: jaccard(newGrams, trigramSet(text)),
    });
  });

  if (hits.length === 0) return EMPTY('본문이 충분한 기존 글 없음', threshold);

  hits.sort((a, b) => b.similarity - a.similarity);
  return {
    checked: hits.length,
    worst: hits[0] ?? null,
    flagged: hits.filter(h => h.similarity >= threshold),
    threshold,
    skipped: '',
  };
}

/**
 * 로그 한 줄로 만든다. 관측 결과이므로 문구는 경고까지만 — 차단을 암시하지 않는다.
 */
export function formatSelfOverlapLog(report: SelfOverlapReport): string {
  if (!report) return '';
  if (report.skipped) return `   [자기중복] 측정 건너뜀 — ${report.skipped}`;
  if (!report.worst) return `   [자기중복] 비교 대상 없음`;

  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const head = `   [자기중복] 기존 ${report.checked}편과 비교 · 최고 ${pct(report.worst.similarity)}`;
  if (report.flagged.length === 0) {
    return `${head} (임계 ${pct(report.threshold)} 이하 — 양호)`;
  }
  const list = report.flagged
    .slice(0, 3)
    .map(h => `${pct(h.similarity)} "${h.title.slice(0, 28)}"`)
    .join(', ');
  return `${head} ⚠️ 임계 ${pct(report.threshold)} 초과 ${report.flagged.length}편: ${list}`
    + ` — 발행은 그대로 진행합니다(각도 차별화 검토 권장)`;
}
