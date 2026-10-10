/**
 * 🔎 젠스파크 딥 리서치 결과 → 근거 후보 (v3.8.760)
 *
 * 사장님 결정(2026-10-10): 결과는 **근거로만** 쓴다. 글은 앱이 쓴다.
 * 그래서 AI 가 쓴 보고서(article_content)·페이지별 답(answer_content)은 버리고,
 * 젠스파크가 **실제로 읽은 페이지 원문**(url_analysis_list[].page_content)만 근거 후보로 넘긴다.
 * 후보는 네이버 검색 결과와 같은 관련도 심사(judgeEvidence)를 거친다 — 젠스파크라고 통과시키지 않는다.
 *
 * 실측(2026-10-10, 청년미래적금 2차 조건·서류): GET /api/project?id=<작업번호> 한 번에
 *   data.status='FINISHED' · 검색 15개 · 읽은 페이지 30건(25주소, 금융위원회 3 · 서민금융진흥원 1 · 언론 · 블로그).
 */
import type { EvidenceDraft } from '../final/evidence';
import { cleanEvidenceText, RETAINED_TEXT_CHARS } from '../crawlers/evidence-clean';

export interface GensparkPage {
  url: string;
  title: string;
  /** 젠스파크가 읽은 페이지 원문(정리 전) */
  content: string;
  /** 검색 결과에 붙어 있던 날짜(있을 때만) */
  date: string | null;
}

export interface GensparkResearch {
  status: string;
  finished: boolean;
  pages: GensparkPage[];
  queries: string[];
}

const EMPTY: GensparkResearch = { status: '', finished: false, pages: [], queries: [] };

/** /api/project 응답을 읽는다. 모양이 다르면 빈 결과 — 던지지 않는다 */
export function parseGensparkProject(json: unknown): GensparkResearch {
  const data = (json as any)?.data;
  if (!data || typeof data !== 'object') return { ...EMPTY };
  const status = String(data.status || '');
  const state = data.session_state || {};
  const messages: any[] = Array.isArray(state.messages) ? state.messages : [];
  /**
   * 완료 = 조사가 "finished" 로 멈췄거나 최종 보고서가 생겼을 때. data.status 는 보지 않는다 —
   * 실측(2026-10-10): 시작 15초 만에, 페이지 0곳일 때도 status 는 'FINISHED' 였다. 그걸 믿고 창을 닫자 조사가 중간에 끊겼다.
   */
  const finished = state.stop_reason === 'finished' || messages.some((m) => !!m?.session_state?.article_content);

  const queries: string[] = [];
  const dateByUrl = new Map<string, string>();
  const titleByUrl = new Map<string, string>();
  const pages = new Map<string, GensparkPage>();
  for (const message of messages) {
    const s = message?.session_state || {};
    for (const [query, result] of Object.entries(s.batch_result_dict || {})) {
      if (!queries.includes(query)) queries.push(query);
      for (const hit of (result as any)?.organic_results || []) {
        if (hit?.link && hit?.date) dateByUrl.set(String(hit.link), String(hit.date));
        if (hit?.link && hit?.title) titleByUrl.set(String(hit.link), String(hit.title).trim());
      }
    }
    for (const page of s.url_analysis_list || []) {
      const url = String(page?.url || '').trim();
      const content = String(page?.page_content || '');
      if (!/^https?:\/\//i.test(url) || pages.has(url) || !content.trim()) continue;
      // 실측: title 칸에 주소가 들어 있다(30건 모두) — 그건 제목이 아니다
      const ownTitle = String(page?.title || '').trim();
      pages.set(url, { url, title: /^https?:\/\//i.test(ownTitle) ? '' : ownTitle, content, date: null });
    }
  }
  return {
    status,
    finished,
    pages: [...pages.values()].map((p) => ({ ...p, title: titleByUrl.get(p.url) || p.title, date: dateByUrl.get(p.url) || null })),
    queries,
  };
}

/** 마크다운·HTML 껍데기를 걷어 글만 남긴다(본문 줄 정리는 기존 cleanEvidenceText 가 한다) */
export function stripGensparkMarkup(raw: string): string {
  return String(raw || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')            // 그림
    .replace(/\[\s*\]\([^)]*\)/g, ' ')                 // 그림을 걷고 남은 빈 링크
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')           // 링크는 글자만
    .replace(/<(br|\/p|\/tr|\/li|\/h\d|\/div)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')                // 제목 기호
    .replace(/(\*\*|__)/g, '')                         // 굵게
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 주요 언론·포털 뉴스 — 주소로 출처 종류를 정한다. 공공기관·블로그는 judgeEvidence 의 classifySource 가 주소로 가린다 */
const NEWS_HOST = /(^|\.)(news\.|imnews\.)|(^|\.)(v\.daum\.net|mk\.co\.kr|hankyung\.com|chosun\.com|donga\.com|joongang\.co\.kr|yna\.co\.kr|hani\.co\.kr|khan\.co\.kr|mt\.co\.kr|edaily\.co\.kr|sedaily\.com|fnnews\.com|newsis\.com|news1\.kr|asiae\.co\.kr|heraldcorp\.com|wikitree\.co\.kr|kbs\.co\.kr|sbs\.co\.kr|ytn\.co\.kr|jtbc\.co\.kr|mbn\.co\.kr|hankookilbo\.com|seoul\.co\.kr|kmib\.co\.kr|segye\.com|munhwa\.com|etnews\.com|zdnet\.co\.kr|biz\.chosun\.com)$/i;

function tagOf(url: string): string {
  let host = '';
  try { host = new URL(url).hostname; } catch { return 'genspark'; }
  return NEWS_HOST.test(host) ? 'news' : 'genspark';
}

/** 읽은 페이지 → 근거 후보. 본문은 앱의 보존 상한까지, 잘렸으면 잘린 위치를 남긴다 */
export function gensparkDrafts(research: GensparkResearch): EvidenceDraft[] {
  const firstQuery = research.queries[0] || '';
  const drafts: EvidenceDraft[] = [];
  for (const page of research.pages) {
    const cleaned = cleanEvidenceText(stripGensparkMarkup(page.content)).text;
    if (cleaned.length < 80) continue;
    const truncated = cleaned.length > RETAINED_TEXT_CHARS;
    drafts.push({
      title: page.title || cleaned.split('\n')[0]!.slice(0, 80),
      url: page.url,
      tag: tagOf(page.url),
      query: `genspark:${firstQuery}`,
      text: truncated ? cleaned.slice(0, RETAINED_TEXT_CHARS) : cleaned,
      pubDate: page.date,
      hasBody: true,
      truncatedAt: truncated ? RETAINED_TEXT_CHARS : null,
    });
  }
  return drafts;
}
