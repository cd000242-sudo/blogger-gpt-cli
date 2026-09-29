/**
 * 🔗 v3.8.755 — 크롤러 항목 → orchestration 글 목록 → 근거 초안, 두 경계를 한 곳에서 지킨다.
 *
 * 실제 run f607bc(2026-09-29): 추출기가 보존한 fullText(754)가 orchestration 의 "고정 필드로 다시 만드는" 매핑에서
 * 떨어져 네이버 블로그 3편이 1,223자 발췌 그대로 근거 장부에 들어갔다. 매핑이 인라인 객체 리터럴이라
 * 테스트가 그 경계를 지나지 못했고, 필드 하나가 빠져도 아무 오류가 없었다(조용한 미배선).
 *
 * 여기서는 필요한 필드를 **이름을 적어** 옮긴다 — 런타임 객체 전체를 spread 하지 않는다.
 *   · content       : 예전 그대로 발췌(1,200자). 다른 소비자(CTA 추출·검색 스냅샷)의 입력은 바뀌지 않는다
 *   · fullText      : 추출기가 보존한 정제 본문(RETAINED_TEXT_CHARS 까지). 있을 때만 싣는다
 *   · fullTextTruncatedAt : 보존 상한에서 잘렸으면 그 위치. fullText 가 없으면 싣지 않는다(잘리지 않았다고 표시하지 않기 위해)
 */
import { cleanEvidenceText, type CleanResult } from '../crawlers/evidence-clean';
import type { EvidenceDraft } from './evidence';
import type { FinalCrawledPost } from './types';

export interface CrawledItemLike {
  title?: unknown; url?: unknown; content?: unknown; subheadings?: unknown; source?: unknown;
  pubDate?: unknown; postdate?: unknown; originalLink?: unknown; hasBody?: unknown;
  fullText?: unknown; fullTextTruncatedAt?: unknown;
}

/** orchestration 의 crawledPosts 항목 — FinalCrawledPost 에 근거 장부가 쓰는 필드를 더한 꼴 */
export type BridgedCrawledPost = FinalCrawledPost & {
  pubDate: string | null;
  originalLink: string;
  hasBody: boolean;
  fullText?: string;
  fullTextTruncatedAt?: number | null;
};

export function toFinalCrawledPost(item: CrawledItemLike): BridgedCrawledPost {
  const fullText = typeof item.fullText === 'string' && item.fullText.trim() ? item.fullText : undefined;
  const truncatedAt = typeof item.fullTextTruncatedAt === 'number' ? item.fullTextTruncatedAt : null;
  return {
    title: String(item.title || ''),
    url: String(item.url || ''),
    content: String(item.content || ''),
    subheadings: Array.isArray(item.subheadings) ? (item.subheadings as string[]) : [],
    source: (item.source as FinalCrawledPost['source']) || 'external',
    // v3.8.734 — 날짜·원문 주소·본문 확보 여부를 버리지 않는다(근거 항목이 이걸 들고 Writer 까지 간다)
    pubDate: (item.pubDate as string) || (item.postdate as string) || null,
    originalLink: String(item.originalLink || ''),
    hasBody: item.hasBody === true,
    ...(fullText ? { fullText, fullTextTruncatedAt: truncatedAt } : {}),
  };
}

export function evidenceTagOf(source: string): string {
  return /news/.test(source) ? '뉴스' : /official/.test(source) ? '공식' : /blog/.test(source) ? '블로그' : '웹';
}

export interface BridgedDraft {
  draft: EvidenceDraft;
  cleaned: CleanResult;
  /** relevantPosts 에 남길 본문 — fullText 로 판정했어도 발췌 길이로 묶는다(다른 소비자 입력 불변) */
  relevantContent: string;
}

/**
 * 크롤러 글 하나를 근거 초안으로 만든다. 판정·선택·검증은 보존 본문(fullText)으로, 없으면 발췌로.
 * `trusted`(사용자 직접 주소·유료 요약)면 관련도를 묻지 않는다 — 호출부가 mainKeyword 를 '' 로 넘긴다.
 */
export function bridgeCrawledPost(post: Partial<BridgedCrawledPost> & { url?: string }, keyword: string): BridgedDraft {
  const content = String(post.content || '');
  const hasFull = typeof post.fullText === 'string' && post.fullText.trim().length > 0;
  const cleaned = cleanEvidenceText(hasFull ? post.fullText : content);
  const draft: EvidenceDraft = {
    title: String(post.title || ''),
    url: String(post.originalLink || post.url || ''),
    tag: evidenceTagOf(String(post.source || '')),
    query: keyword,
    text: cleaned.text,
    pubDate: post.pubDate || null,
    hasBody: post.hasBody === true || cleaned.cleanLength > 600,
    ...(hasFull ? { truncatedAt: post.fullTextTruncatedAt ?? null } : {}),
  };
  return { draft, cleaned, relevantContent: hasFull ? cleaned.text.slice(0, content.length) : cleaned.text };
}
