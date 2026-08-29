/**
 * post-regenerate — 발행된 글을 **제자리에서** 다시 만든다. (v3.8.600)
 *
 * ## 사장님 요청
 * "글목록에 글 다시생성이나 AI 이미지 다시생성하기 기능넣어달라니까 안했네"
 * "지금처럼 글이 안 나온 상태로 발행이 됐다면 다시 글 생성하고 이미지 넣고
 *  수정발행이 가능해야 되니까요"
 *
 * 실제로 그런 글이 나왔다 — 본문이 `and` 한 단어인 글(발행글 5441).
 * 그때 할 수 있는 일이 삭제뿐이면, 그 글이 가진 색인·유입이 통째로 날아간다.
 *
 * ## 왜 새 글이 아니라 제자리 교체인가
 * 새로 발행하면 주소가 바뀐다. 주소가 바뀌면 색인이 초기화되고 301 을 걸어야 한다.
 * 같은 postId 의 본문만 갈아끼우면 **주소·슬러그가 그대로**라 색인이 유지된다.
 * (사장님 확정: "A로 해줘")
 *
 * ## 여기 있는 것
 * 화면·IPC 가 아니라 **판단과 문자열 처리**만 둔다. 실제 생성·업로드·저장은
 * electron/main.ts 가 기존 함수들로 한다 — 그래야 이 파일이 테스트에서 네트워크를 안 탄다.
 */

/** 되살릴 가치가 있는 본문인가 — 이보다 짧으면 교체하지 않는다 */
export const MIN_REGENERATED_TEXT = 200;

export const htmlToText = (html: string): string => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * 새로 만든 본문이 쓸 만한가.
 *
 * 다시 만들었는데 더 나쁜 것으로 덮으면 되살리기가 아니라 두 번째 사고다.
 * 그래서 **길이 하한**과 **원본과의 비교** 를 함께 본다.
 */
export function judgeRegenerated(nextHtml: string, previousHtml = ''): { ok: boolean; reason: string; length: number } {
  const length = htmlToText(nextHtml).length;
  if (length < MIN_REGENERATED_TEXT) {
    return { ok: false, reason: `새 본문이 ${length}자뿐입니다 (최소 ${MIN_REGENERATED_TEXT}자)`, length };
  }
  const before = htmlToText(previousHtml).length;
  // 원본이 멀쩡했는데 새 것이 절반도 안 되면 퇴보다 — 덮지 않는다.
  if (before >= MIN_REGENERATED_TEXT && length < before * 0.5) {
    return { ok: false, reason: `새 본문(${length}자)이 기존(${before}자)의 절반도 안 됩니다`, length };
  }
  return { ok: true, reason: '', length };
}

export interface PostImage {
  /** 본문에서 몇 번째 이미지인가 (0부터) */
  index: number;
  /** <img ...> 태그 전체 */
  tag: string;
  src: string;
  alt: string;
  /** 이 이미지 바로 앞의 H2 제목 — 무엇을 그릴지의 단서 */
  sectionTitle: string;
}

const IMG_TAG = /<img\b[^>]*>/gi;
const ATTR = (tag: string, name: string): string => {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
  return m?.[1] || '';
};

/** 본문의 이미지들을 찾는다. 앞선 H2 제목을 함께 물어 온다 */
export function findPostImages(html: string): PostImage[] {
  const source = String(html || '');
  const out: PostImage[] = [];
  IMG_TAG.lastIndex = 0;
  for (let m = IMG_TAG.exec(source); m; m = IMG_TAG.exec(source)) {
    const before = source.slice(0, m.index);
    const headings = before.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi) || [];
    const lastHeading = headings.length > 0 ? headings[headings.length - 1]! : '';
    out.push({
      index: out.length,
      tag: m[0],
      src: ATTR(m[0], 'src'),
      alt: ATTR(m[0], 'alt'),
      sectionTitle: htmlToText(lastHeading),
    });
  }
  return out;
}

/**
 * 이미지 주소만 갈아끼운다. **태그의 나머지 속성은 건드리지 않는다** —
 * 발행기가 넣어 둔 클래스·스타일·loading 속성이 사라지면 글의 모양이 바뀐다.
 */
export function replaceImageSrcs(html: string, replacements: Map<number, string>): string {
  let seen = -1;
  return String(html || '').replace(IMG_TAG, (tag) => {
    seen += 1;
    const next = replacements.get(seen);
    if (!next) return tag;
    return /src\s*=\s*["'][^"']*["']/i.test(tag)
      ? tag.replace(/src\s*=\s*["'][^"']*["']/i, `src="${next}"`)
      : tag.replace(/<img\b/i, `<img src="${next}"`);
  });
}

/**
 * 이 이미지가 무엇을 그려야 하는가.
 * 소제목이 있으면 그것이 가장 좋은 단서이고, 없으면 글 제목으로 돌아간다.
 */
export function buildImagePromptFor(title: string, sectionTitle: string): string {
  const topic = String(title || '').trim();
  const section = String(sectionTitle || '').trim();
  return section && section !== topic ? `${topic} — ${section}` : topic;
}

/** 로그 한 줄 */
export function describeRegenerationPlan(mode: 'article' | 'images', images: PostImage[]): string {
  return mode === 'article'
    ? '본문을 다시 만들어 같은 주소에 덮어씁니다 (주소·슬러그 유지)'
    : `이미지 ${images.length}장을 다시 만들어 같은 주소에 덮어씁니다 (본문 글자는 그대로)`;
}
