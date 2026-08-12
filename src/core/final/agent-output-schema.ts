/**
 * agent-output-schema — 에이전트의 마지막 응답 형태를 강제한다.
 *
 * ## 무엇을 고치는가
 * 제목이 키워드 그대로 나오던 버그의 뿌리는 **제목을 못 받아오는 것**이었다.
 * 지금은 metadata.json 의 title 을 읽고, 없으면 본문 H1 을 긁고, 그것도 없으면
 * 키워드로 떨어진다. 에이전트가 metadata.json 을 빠뜨리면 키워드가 제목이 된다.
 *
 * Codex 의 `--output-schema` 는 **마지막 응답**이 이 형태를 따르게 만든다(파일이 아니다).
 * 그래서 파일을 빠뜨려도 제목이 구조화된 채로 돌아온다.
 *
 * ## articleHtml 을 굳이 넣는 이유
 * 지금 지시서에는 "파일 쓰기가 막히면 ARTICLE_HTML_BEGIN/END 사이에 출력하라" 는
 * 최후 수단이 있다. 스키마를 강제하면 그 자유 텍스트 통로가 막힌다.
 * 그래서 같은 역할을 하는 선택 필드를 스키마 안에 둔다 — 최후 수단을 잃지 않는다.
 */

export const AGENT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary'],
  properties: {
    title: {
      type: 'string',
      description: '최종 H1 제목. 키워드를 그대로 옮겨 적지 말 것.',
    },
    summary: {
      type: 'string',
      description: '이 글이 무엇을 알려주는지 300자 이내 요약.',
    },
    sources: {
      type: 'array',
      items: { type: 'string' },
      description: '검색으로 실제 확인한 주소. 확인하지 않았으면 빈 배열.',
    },
    articleHtml: {
      type: 'string',
      description: 'result/article.html 파일을 쓰지 못한 경우에만 본문 HTML 을 여기 넣는다. 파일을 썼으면 빈 문자열.',
    },
  },
} as const;

export interface AgentFinalResponse {
  title: string;
  summary: string;
  sources: string[];
  articleHtml: string;
}

const EMPTY: AgentFinalResponse = { title: '', summary: '', sources: [], articleHtml: '' };

/**
 * 마지막 응답에서 구조화된 값을 건져낸다.
 *
 * 스키마를 못 쓰는 실행(Claude Code 등)에서는 자유 텍스트가 오므로 빈 값을 돌려준다 —
 * 그때는 기존 경로(metadata.json → H1)가 그대로 동작한다. 어느 쪽이든 던지지 않는다.
 */
export function parseAgentFinalResponse(text: string): AgentFinalResponse {
  try {
    const raw = String(text || '').trim();
    if (!raw) return EMPTY;

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return EMPTY;

    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object') return EMPTY;

    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.filter((s: unknown) => typeof s === 'string' && /^https?:\/\//i.test(s))
        : [],
      articleHtml: typeof parsed.articleHtml === 'string' ? parsed.articleHtml : '',
    };
  } catch {
    return EMPTY;   // JSON 이 아니면 그냥 아닌 것이다 — 기존 경로로 넘어간다
  }
}
