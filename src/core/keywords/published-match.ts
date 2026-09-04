/**
 * ✅ 이 키워드, 이미 썼나 (v3.8.635)
 *
 * ## 왜 만들었나
 * 사장님: "발행된건 자연스럽게 이전으로 해주고 달력이있으니까 달력별로 어떤키워드를
 *          올려놧는지보여주고 발행됫으면 자연스럽게 발행된키워드는 숨겨지게"
 *
 * 리포트 카드·달력·글목록이 **같은 질문**에 걸려 있다. 그 판단이 세 곳에 따로
 * 있으면 셋이 조금씩 다르게 답하고, 결국 "숨겨졌는데 달력엔 없는" 상태가 된다.
 * 그래서 판단은 여기 하나만 둔다.
 *
 * ## 어떻게 맞추나
 * 발행 기록에는 키워드가 있는 것도 있고 없는 것도 있다(재발행 경로·손으로 쓴 글).
 * 그래서 두 갈래로 본다:
 *   ① 기록된 키워드가 같다        — 가장 확실하다
 *   ② 발행한 제목 안에 키워드가 있다 — 키워드로 쓴 글은 제목에 그 말이 들어간다
 *
 * ## 헛detect 를 막는 선
 * ②는 짧은 말에서 위험하다. "환불" 같은 두 글자는 아무 제목에나 걸려서
 * **아직 안 쓴 키워드를 썼다고 숨겨 버린다.** 그러면 사장님은 그 키워드를
 * 영영 못 본다 — 조용히 사라지는 종류의 사고다.
 * 그래서 ②는 **정규화 후 6자 이상**일 때만 쓴다.
 */

/** 제목 안에서 찾는 방식은 이 길이 이상일 때만 — 짧은 말은 아무 데나 걸린다 */
export const MIN_CONTAINS_CHARS = 6;

export interface PublishedRecord {
  title?: string;
  keyword?: string;
  reportKeyword?: string;
  url?: string;
  time?: string;
  platform?: string;
  timestamp?: number;
}

/** 날짜별로 묶인 발행 기록 (localStorage 의 publishedPosts 모양) */
export type PublishedStore = Record<string, PublishedRecord[]>;

/**
 * 띄어쓰기·기호·대소문자를 지운다.
 *
 * "실업 급여 조건" 과 "실업급여조건" 은 사람에게 같은 말이다. 이걸 다르게 보면
 * 이미 쓴 키워드가 안 숨겨진다.
 */
export function normalizeKeyword(text: unknown): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s ]+/g, '')
    .replace(/[[\]()（）{}<>·・,.!?"'“”‘’·:;~\-–—_/\\|]/g, '');
}

interface PublishedIndex {
  keywords: Set<string>;
  titles: string[];
}

/** 발행 기록에서 "이미 쓴 것" 목록을 만든다 */
export function buildPublishedIndex(store: PublishedStore | null | undefined): PublishedIndex {
  const keywords = new Set<string>();
  const titles: string[] = [];

  for (const list of Object.values(store || {})) {
    if (!Array.isArray(list)) continue;
    for (const rec of list) {
      for (const k of [rec?.keyword, rec?.reportKeyword]) {
        const n = normalizeKeyword(k);
        if (n) keywords.add(n);
      }
      const t = normalizeKeyword(rec?.title);
      if (t) titles.push(t);
    }
  }
  return { keywords, titles };
}

/**
 * 이 슬롯을 이미 발행했나.
 *
 * 키워드와 확정 제목 둘 다 본다 — 리포트가 준 제목 그대로 발행하면
 * 기록에 키워드가 안 남는 경로가 있기 때문이다.
 */
export function isSlotPublished(
  slot: { keyword?: string; title?: string },
  index: PublishedIndex,
): boolean {
  const candidates = [slot?.keyword, slot?.title].map(normalizeKeyword).filter(Boolean);
  if (candidates.length === 0) return false;

  for (const c of candidates) {
    if (index.keywords.has(c)) return true;
    if (c.length >= MIN_CONTAINS_CHARS && index.titles.some((t) => t.includes(c))) return true;
  }
  return false;
}

/**
 * 슬롯을 **아직 쓸 것**과 **이미 쓴 것**으로 가른다.
 *
 * 지우지 않고 나눈다 — 사장님이 "그거 언제 썼더라" 를 물을 수 있어야 한다.
 */
export function splitSlotsByPublished<T extends { keyword?: string; title?: string }>(
  slots: T[],
  store: PublishedStore | null | undefined,
): { todo: T[]; done: T[] } {
  const index = buildPublishedIndex(store);
  const todo: T[] = [];
  const done: T[] = [];
  for (const s of slots || []) {
    (isSlotPublished(s, index) ? done : todo).push(s);
  }
  return { todo, done };
}

/**
 * 그날 무엇을 올렸나 — 달력 한 칸에 쓸 말.
 *
 * 제목이 아니라 **키워드**를 앞세운다. 사장님이 달력에서 보고 싶은 것은
 * "무슨 제목으로 썼나" 가 아니라 "이 주제를 언제 썼나" 이기 때문이다.
 * 키워드가 안 적힌 옛 기록은 제목으로 대신한다.
 */
export function dayKeywords(records: PublishedRecord[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rec of records || []) {
    const label = String(rec?.keyword || rec?.reportKeyword || rec?.title || '').trim();
    if (!label) continue;
    const key = normalizeKeyword(label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}
