// 🔗 URL 전용 생성 모드 판정 헬퍼 — 무거운 의존성 없이 단독 테스트 가능하도록 분리

import { buildUpgradeBrief, URL_UPGRADE_RULES, type UpgradeSource } from './url-upgrade';

/**
 * URL 전용 모드에서 실제로 사용할 키워드를 결정한다.
 *
 * UI의 키워드 입력란은 "URL로 생성" 탭에서 화면에만 숨겨질 뿐 직전 발행 때 쓴 값이 그대로 남는다.
 * 그 값이 payload.topic으로 넘어오면 url-content-generator의
 * `effectiveKeyword = keyword || 크롤링 제목`이 stale 키워드를 우선 채택해
 * 제목·H2·본문·태그·썸네일이 전부 이전 키워드 기준으로 생성된다
 * ("URL로 썼는데 예전에 키워드로 발행했던 글이 다시 나옴" 증상).
 *
 * urlBasedGeneration === true 는 "URL로 생성" 명시 요청이므로,
 * 키워드를 버리고 URL 본문에서 주제를 추출하게 한다.
 * 느슨한 비교를 쓰지 않는 이유: 문자열 'true'나 1 같은 값이 키워드 모드를 잘못 무력화하면
 * 정상적인 키워드 발행이 통째로 깨지기 때문.
 */
export function resolveUrlModeKeyword(urlBasedGeneration: unknown, keyword: string): string {
  return urlBasedGeneration === true ? '' : keyword;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * v3.8.749 — URL 로 만든 글도 키워드 글과 **같은 파이프라인**을 탄다.
 *
 * 사장님: "URL로 글생성하면 이미지와 표 CTA 등 삽입이 안되고 소제목과 본문만 나오는 버그가 있어"
 *
 * 예전 URL 모드는 url-content-generator 로 h2·h3·p 만 만들고 썸네일을 붙여 **바로 반환**했다.
 * 본 파이프라인(소제목 이미지·표·CTA·FAQ·요약·스킨·Final Judge)을 한 번도 타지 않았다.
 * 이제 URL 은 근거 자료가 되고, 주제는 원문에서 뽑아 메인 키워드로 쓴다. 나머지는 키워드 글과 같다.
 * ───────────────────────────────────────────────────────────────────────────── */

/** 수집기가 돌려주는 원문 한 건 (deepCrawlUrl 의 UrlCrawlResult 와 같은 모양) */
export interface UrlSourceLike {
  url: string;
  title: string;
  content: string;
  subheadings?: string[];
  publishDate?: string;
}

export interface UrlModeDeps {
  /** 1차 수집기 — deepCrawlUrl (유튜브·네이버 블로그·기사 JSON) */
  deepCrawl: (url: string) => Promise<UrlSourceLike>;
  /** 1차가 본문을 못 읽었을 때 한 번 더 — crawlSingleUrlFast (쇼핑 주소 등) */
  fallbackCrawl?: (url: string) => Promise<{ title: string; content: string; subheadings?: string[] } | null>;
  /** 원문에서 검색어 꼴 주제를 뽑는다 (못 뽑으면 빈 문자열) */
  recoverTopic: (text: string) => Promise<string>;
  /** 끝내 못 읽었을 때의 안내 — 무엇을 시도했는지 말한다 */
  describeFailure: (url: string) => string;
  /** 이 밑이면 본문을 못 읽은 것으로 본다 (EMPTY_BODY_THRESHOLD) */
  minBodyChars?: number;
  onLog?: (msg: string) => void;
}

/** 본 파이프라인의 근거 자료 한 건 (FinalCrawledPost + v3.8.734 확장 필드) */
export interface UrlModePost {
  title: string;
  url: string;
  content: string;
  subheadings: string[];
  source: 'external';
  pubDate: string | null;
  originalLink: string;
  hasBody: boolean;
}

export interface UrlModeSources {
  topic: string;
  posts: UrlModePost[];
  upgradeSources: UpgradeSource[];
}

/** 원문 제목을 주제로 다듬는다 — 사이트 이름 꼬리를 떼고, 없으면 빈 문자열(지어내지 않는다) */
export function topicFromTitle(title: string): string {
  const raw = String(title || '').replace(/\s+/g, ' ').trim();
  if (!raw || raw === '제목 없음') return '';
  const head = raw.split(/\s+[|｜:·–—-]\s+/)[0]!.trim();
  return head.length >= 4 ? head.slice(0, 60) : '';
}

/**
 * URL 들을 읽어 근거 자료로 만들고 주제를 정한다.
 * 본문을 하나도 못 읽으면 멈춘다 — 제목 한 줄로 글을 지어내면 사실이 하나도 없는 글이 된다(v3.8.627).
 */
export async function collectUrlModeSources(urls: string[], deps: UrlModeDeps): Promise<UrlModeSources> {
  const min = deps.minBodyChars ?? 200;
  const read: UrlSourceLike[] = [];
  for (const url of urls) {
    let item: UrlSourceLike | null = null;
    try {
      item = await deps.deepCrawl(url);
    } catch (err: any) {
      deps.onLog?.(`   ⚠️ URL 읽기 실패 (${String(err?.message || err).slice(0, 60)}) — 다른 방법으로 한 번 더 읽습니다`);
    }
    if ((!item || String(item.content || '').trim().length < min) && deps.fallbackCrawl) {
      try {
        const again = await deps.fallbackCrawl(url);
        if (again && String(again.content || '').trim().length >= min) {
          const publishDate = item?.publishDate;
          item = { url, title: again.title, content: again.content, subheadings: again.subheadings || [], ...(publishDate ? { publishDate } : {}) };
        }
      } catch { /* 두 번째 시도도 실패하면 아래에서 판단한다 */ }
    }
    if (item && String(item.content || '').trim().length >= min) {
      read.push(item);
      deps.onLog?.(`   ✅ 원문 확보: "${String(item.title || '').slice(0, 40)}" (본문 ${item.content.length}자)`);
    } else {
      deps.onLog?.(`   ⚠️ 본문을 못 읽은 주소는 빼고 씁니다: ${url}`);
    }
  }
  if (read.length === 0) throw new Error(deps.describeFailure(urls[0] || ''));

  const first = read[0]!;
  const recovered = await deps.recoverTopic(`${first.title}\n${first.content}`).catch(() => '');
  const topic = String(recovered || '').trim() || topicFromTitle(first.title);
  if (!topic) throw new Error(deps.describeFailure(first.url));

  return {
    topic,
    posts: read.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      subheadings: r.subheadings || [],
      source: 'external' as const,
      pubDate: r.publishDate || null,
      originalLink: r.url,
      hasBody: true,
    })),
    upgradeSources: read.map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      subheadings: r.subheadings || [],
      ...(r.publishDate ? { publishDate: r.publishDate } : {}),
    })),
  };
}

/**
 * 작가 지시문에 싣는 "원문의 상위호환" 블록 (v3.8.596 규칙 · v3.8.633 날짜 경고).
 * 규칙 문장은 URL 생성기와 **같은 상수**를 쓴다 — 한쪽만 고치면 경로에 따라 결과가 조용히 달라진다.
 * 원문 본문은 다시 싣지 않는다 — 근거 자료로 이미 들어가 있어 두 번 내면 비용만 는다.
 */
export function buildUrlUpgradeWriterBlock(sources: UpgradeSource[]): string {
  if (!sources.length) return '';
  const briefs = sources.map((s) => buildUpgradeBrief({ ...s, content: '' }, 0));
  return `\n\n${briefs.join('\n\n')}\n\n${URL_UPGRADE_RULES}\n`;
}
