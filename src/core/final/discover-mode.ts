/**
 * 🔎 구글 디스커버 모드 — 제목·본문 규칙 (v3.8.478)
 *
 * 사용자 요구: "워드프레스와 블로그스팟은 구글 디스커버에 노출될수있도록
 *              제목과 이미지 본문을 최적화시킨모드가있어야되거든 …
 *              그럴럴려면 심층리서 해야되거든"
 *
 * ## 디스커버는 검색과 다르다
 * 검색은 사용자가 **쿼리를 친다** — 그래서 키워드를 앞에 배치하는 게 유리하다.
 * 디스커버는 **쿼리가 없다.** 관심사에 맞춰 카드가 밀어넣어지고, 사용자는 제목과
 * 이미지만 보고 누를지 말지 정한다. 그래서 최적화 방향이 정반대인 지점이 생긴다.
 *
 * ## 공식 문서에서 그대로 가져온 규칙
 * (Google Search Central — "Discover and your website")
 *
 *   · "Avoid clickbait and similar tactics to artificially inflate engagement by using
 *      misleading or exaggerated details in preview content (title, snippets, or images)
 *      to increase appeal, or by **withholding crucial information** required to
 *      understand what the content is about."
 *   · "Use page titles and headlines that **capture the essence** of the content."
 *   · "Avoid sensationalism tactics that manipulate appeal by catering to
 *      **morbid curiosity, titillation, or outrage**."
 *   · "Provide content that's **timely** for current interests, **tells a story well**,
 *      or provides **unique insights**."
 *
 * 특별한 태그나 구조화 데이터는 요구하지 않는다("No special tags or structured data
 * are required"). 즉 디스커버 대응은 **기술이 아니라 글 자체**의 문제다 —
 * 이미지 요건은 discover-readiness.ts 가 따로 진단한다.
 *
 * ## 기본 모드와 무엇이 다른가
 * 기본 제목 생성기는 "대한민국 최고의 바이럴 마케터" 페르소나에 아키타입 10개 중
 * 3개를 무작위로 뽑아 쓴다. 그중 '놓치면 손실'형은 디스커버가 명시적으로 경계하는
 * outrage/공포 자극과 경계가 붙어 있고, 키워드 앞배치는 쿼리가 없는 지면에서
 * 아무 이득이 없다. 그래서 디스커버 모드에서는 아키타입을 **통째로 갈아끼운다.**
 */

/** 디스커버에서 감점 요인이 되는 제목 상투구 — 프롬프트에 금지 목록으로 넣는다 */
export const DISCOVER_BANNED_TITLE_PATTERNS: RegExp[] = [
  /충격|경악|소름|반전|발칵|파문/,
  /했더니\s*(?:놀라운|대박|충격)/,
  /이것만은|이것도\s*모르면|아직도\s*모르|모르면\s*손해/,
  /절대\s*하지\s*마|큰일\s*납니다|난리\s*났/,
  /진짜\s*미쳤|레전드|역대급/,
];

/**
 * 제목 생성기에 끼워 넣을 디스커버 전용 지시문.
 * 기본 아키타입 대신 이 블록이 들어간다.
 */
export function buildDiscoverTitleDirective(currentYear: number): string {
  return `
🔎🔎🔎 **구글 디스커버 제목 규칙 (검색 제목과 다릅니다)** 🔎🔎🔎

이 글은 검색 결과가 아니라 **디스커버 피드**에 카드로 뜹니다.
독자는 검색하지 않았습니다 — 관심사에 맞아서 화면에 나타났고, 제목만 보고 누릅니다.

✅ 반드시 지킬 것
1. **제목이 글의 결론을 담을 것.** 무슨 내용인지 제목만 읽고 알 수 있어야 합니다.
   구글 공식 기준이 "capture the essence of the content" 입니다.
2. **핵심 정보를 감추지 마세요.** "그 이유는?", "결과는 충격적", "○○했더니…" 처럼
   답을 숨겨 클릭을 유도하는 방식은 디스커버가 명시적으로 감점하는 행위입니다.
3. **구체적인 사실을 앞에 두세요.** 금액·기간·비율·대상처럼 이 글에만 있는 값이
   제목에 들어가면 과장 없이도 눌러야 할 이유가 생깁니다.
4. **${currentYear}년 기준으로 무엇이 달라졌는지**가 있으면 그것을 쓰세요.
   디스커버는 시의성(timely)을 크게 봅니다.

🚫 절대 쓰지 말 것 (디스커버 공식 정책 위반)
- 충격·경악·소름·반전·발칵 같은 자극어
- "아직도 모르면 손해", "이것만은 꼭", "절대 하지 마세요" 류의 공포·압박
- 과장된 수식(역대급·레전드·진짜 미쳤다)
- 궁금증만 남기고 답을 숨기는 제목
- 본문에 없는 내용을 제목에서 약속하기

📌 키워드를 굳이 맨 앞에 두지 마세요. 디스커버에는 검색어가 없습니다.
   자연스러운 한국어 문장 순서가 더 잘 읽히고 더 눌립니다.
`.trim();
}

/**
 * 본문 생성 프롬프트에 붙일 디스커버 전용 블록.
 * contentMode === 'discover' 일 때만 들어간다.
 */
export function buildDiscoverBodyBlock(currentYear: number): string {
  return `

🔎🔎🔎 [구글 디스커버 모드 — 피드에서 읽히는 글] 🔎🔎🔎

🎯 **이 글은 검색이 아니라 디스커버 피드로 옵니다.**
독자는 특정 정보를 찾아온 게 아니라, 관심사에 맞아 흘러들어온 사람입니다.
그래서 "검색어에 답하는 글"이 아니라 **끝까지 읽히는 글**이어야 합니다.

🔴 **핵심 규칙** (구글 공식 기준: timely · tells a story well · unique insights)

1. **첫 문단에서 결론을 말하세요.** 검색으로 온 독자는 답을 찾아 스크롤하지만,
   피드로 온 독자는 답이 안 보이면 그냥 나갑니다. 서론에서 뜸 들이지 마세요.

2. **시점을 명시하세요.** "${currentYear}년 기준", "○월부터 달라진 점" 처럼
   언제 기준인지 본문에 드러내세요. 디스커버는 시의성을 크게 봅니다.
   자료에 날짜가 있으면 그대로 쓰고, 없으면 지어내지 마세요.

3. **이 글에만 있는 것을 넣으세요.** 어디서나 볼 수 있는 일반론은 피드에서
   버려집니다. 자료에서 확인된 수치·조건·예외·실패 사례를 구체적으로 쓰세요.

4. **이야기로 이어지게 쓰세요.** 항목 나열만으로는 끝까지 안 읽힙니다.
   "왜 이게 문제가 되는지 → 어떻게 갈리는지 → 그래서 무엇을 하면 되는지" 순으로
   한 편의 흐름을 만드세요.

5. **소제목도 사람에게 말하듯 쓰세요.** 제목은 사람에게 말하는데 소제목만
   검색어를 늘어놓으면 톤이 어긋나 신뢰가 깨집니다. 디스커버에는 검색어가 없으므로
   소제목에 키워드를 반복해 넣을 이유가 없습니다.
   - 이렇게 쓰지 마세요: "가족 일상생활중 배상책임 II 누수 보장 한도와 특약"
   - 이렇게 쓰세요: "한도가 1억이어도 다 안 나오는 경우"
   - 이렇게 쓰지 마세요: "○○ 자기부담금 계산법"
   - 이렇게 쓰세요: "자기부담금 얼마 떼고 받나"
   같은 키워드를 소제목마다 반복하지 말고, 소제목만 훑어도 글의 흐름이 읽히게 하세요.

🚫 **디스커버가 감점하는 것** (공식 정책 — 어기면 노출 자체가 막힙니다)
- 제목·도입부에서 과장하거나 핵심을 감추고 클릭만 유도하기
- 자극적 소재로 관심 끌기(공포·분노·선정성)
- 본문이 제목의 약속을 지키지 않기 — 제목에 쓴 결론은 본문에서 반드시 다루세요

📌 **이미지 캡션/설명은 사실만 쓰세요.** 디스커버 카드에는 큰 이미지가 함께 뜹니다.
   이미지와 본문이 어긋나면 신뢰가 깨집니다.
`;
}

/** 디스커버 모드인가 */
export function isDiscoverMode(contentMode?: string): boolean {
  return String(contentMode || '').trim().toLowerCase() === 'discover';
}

/**
 * 소제목이 키워드 나열로 굳었는지 본다.
 *
 * 실측 배경: leadernam.com 의 디스커버 모드 글에서 제목은 "부모님 집 누수인데
 * 내 일상생활배상책임으로 될까" 로 사람에게 말하는데, 소제목은
 * "가족 일상생활중 배상책임 II 누수 보장 한도와 특약" 처럼 검색어를 늘어놓고 있었다.
 * 톤이 어긋나면 2026-02 디스커버 업데이트의 제목·본문 정합성 분류기에 불리하다.
 *
 * 발행을 막지 않는다 — 로그로 알리는 용도다(품질 때문에 발행이 멈추면 안 된다).
 */
export function findDiscoverHeadingIssues(html: string, keyword?: string): string[] {
  const headings = [...String(html || '').matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => String(m[1] || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!headings.length) return [];

  const issues: string[] = [];

  // ① 키워드가 소제목마다 되풀이되는가 (검색용 반복의 전형)
  const core = String(keyword || '').trim().split(/\s+/).filter((w) => w.length >= 2);
  if (core.length) {
    const repeated = headings.filter((h) => core.every((w) => h.includes(w))).length;
    if (repeated >= 3) issues.push(`소제목 ${repeated}개가 키워드를 그대로 반복합니다`);
  }

  // ② 서술어 없이 명사만 늘어놓은 소제목 (…법/…정리/…포인트 로 끝나는 꼴)
  const nounOnly = headings.filter((h) =>
    /(방법|계산법|정리|포인트|기준|조건|한도와|특약|총정리)$/.test(h.replace(/^\d+[.)]\s*/, '').trim())
  );
  if (nounOnly.length >= 3) {
    issues.push(`명사로 끝나는 소제목 ${nounOnly.length}개 — 사람에게 말하는 문장으로 바꾸면 좋습니다`);
  }

  return issues;
}

/**
 * 생성된 제목이 디스커버 정책에 걸리는 표현을 담고 있는지 본다.
 * 발행을 막지 않는다 — 로그로 알리는 용도다.
 */
export function findDiscoverTitleViolations(title: string): string[] {
  const text = String(title || '');
  const hits: string[] = [];
  for (const pattern of DISCOVER_BANNED_TITLE_PATTERNS) {
    const found = text.match(pattern);
    if (found) hits.push(found[0]);
  }
  return hits;
}
