/**
 * card-plan — 발행 글을 카드뉴스 문안으로 바꾸는 설계(프롬프트 + 파싱).
 *
 * ## 리서치 근거가 설계다 (2026-08-13 실측 리서치)
 * · 인스타 캐러셀은 저장·공유 1위 형식. **저장수가 배포를 결정**한다.
 * · 리서브: 끝까지 안 넘긴 사람에게 2~3일 뒤 **첫 장이 재노출**된다 → 훅에 품질 집중.
 * · 해시태그 영향력은 미미해졌고, 캡션·이미지 속 글자·**Alt 텍스트**를 검색이 분석한다.
 * 그래서 이 프롬프트는 "예쁘게 요약해줘"가 아니라 위 세 가지를 지시로 박는다.
 */

export interface CardItem {
  kind: 'hook' | 'body' | 'save' | 'cta';
  title: string;
  body: string;
  alt: string;
}

export interface CardPlan {
  cards: CardItem[];
  caption: string;
}

/** 카드 수 범위 — 리서치 권장 6~8장, 최소 4장(그 밑은 카드뉴스가 아니다) */
const MIN_CARDS = 4;
const MAX_CARDS = 10;

/** 본문 전송 상한 — 카드 문안에 글 전체는 필요 없다(토큰 낭비) */
const MAX_ARTICLE_CHARS = 9000;

/** 발행 HTML 에서 사람이 읽는 글자만 뽑는다 */
export function extractArticleText(html: string): string {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    // 인라인 서식 태그는 공백 없이 지운다 — 공백을 넣으면 "강조입니다"가 "강조 입니다"로 쪼개진다
    .replace(/<\/?(strong|em|b|i|u|span|a|mark|code|sub|sup)\b[^>]*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ARTICLE_CHARS);
}

export function buildCardPlanPrompt(
  keyword: string,
  title: string,
  articleText: string,
  options?: { productMode?: boolean },
): string {
  if (options?.productMode) return buildProductCardPlanPrompt(keyword, title, articleText);
  return `당신은 인스타그램 캐러셀(카드뉴스)로 팔로워를 모으는 운영자입니다.
아래 발행 글을 카드뉴스 6~8장으로 다시 설계하세요. 키워드: "${keyword}"

## 발행 글
제목: ${title}
본문: ${String(articleText || '').slice(0, MAX_ARTICLE_CHARS)}

## 반드시 지킬 것 (2026 알고리즘 실측 근거)
1. **첫 장(kind: "hook")이 승부처입니다.** 끝까지 안 넘긴 사람에게 2~3일 뒤 첫 장이
   다시 노출됩니다(리서브). 스크롤을 멈추게 하는 한 줄 — 결론이나 반전을 먼저 보여주세요.
   "OO 총정리" 같은 상투어 금지.
2. **슬라이드 하나에 메시지 하나만.** 두 가지를 넣으면 둘 다 안 읽힙니다.
   title 은 14자 이내, body 는 2줄(60자) 이내.
3. **카드가 전부를 알려주면 아무도 링크를 누르지 않습니다.**
   카드에는 핵심을 진짜로 주되, **본문에만 있는 것 하나**(계산표·체크리스트·
   단계별 캡처·예외 케이스 등)는 이름만 보여주고 내용은 남겨두세요.
   단, 그것이 실제로 본문에 있어야 합니다 — 없는 걸 미끼로 쓰면 신뢰가 무너집니다.
4. **끝에서 두 번째 장(kind: "save")은 저장 유도.** 저장수가 배포를 결정합니다.
   "예매 당일 이 순서대로" 처럼 다시 열어볼 이유를 구체적으로.
5. **마지막 장(kind: "cta")은 클릭 유도.** 인스타는 캡션 링크가 눌리지 않으므로
   "프로필 링크" 로 보냅니다. 3번에서 남겨둔 그것을 지목하세요:
   "전체 계산표는 본문에 — 프로필 링크 👆" 처럼 **무엇을 얻는지**가 보여야 누릅니다.
6. **카드마다 alt(대체 텍스트)를 씁니다.** 인스타 검색이 Alt 를 분석해 노출을 정합니다.
   키워드를 자연스럽게 넣은 한 문장 — 카드에 뭐가 있는지 설명.
7. **캡션(caption)은 검색 키워드를 문장 안에 녹여** 3~4문장으로 쓰고,
   마지막 줄은 "전체 글은 프로필 링크에서 👆" 로 끝냅니다. 해시태그는 2~3개만 끝에.
8. **본문에 없는 수치·날짜를 지어내지 마세요.** 위 발행 글에 있는 것만 씁니다.
   글에 수치가 없으면 수치 없는 문안으로 갑니다.

## 출력 — JSON 만, 설명 금지
{
  "cards": [
    { "kind": "hook", "title": "…", "body": "…", "alt": "…" },
    { "kind": "body", "title": "…", "body": "…", "alt": "…" },
    { "kind": "save", "title": "…", "body": "…", "alt": "…" },
    { "kind": "cta", "title": "…", "body": "…", "alt": "…" }
  ],
  "caption": "…"
}`;
}

/**
 * v3.8.518 — 상품 카드뉴스 (구매 심리 프레임).
 * 배경은 크롤링된 실제 상품 사진이다 (실사용컷=전환 요소, AI컷=역신호 — 전환 리서치 2026-08).
 * 사진 위에 글자가 얹히므로 문안은 정보글 카드보다 더 짧아야 한다.
 */
function buildProductCardPlanPrompt(keyword: string, title: string, articleText: string): string {
  return `당신은 상품을 파는 카드뉴스를 설계하는 커머스 마케터입니다.
아래 상품 글을 카드뉴스 6~7장으로 다시 설계하세요. 키워드: "${keyword}"

## 상품 글
제목: ${title}
본문: ${String(articleText || '').slice(0, MAX_ARTICLE_CHARS)}

## 구매 심리 순서 (이 순서를 지키세요)
1. **1장(kind: "hook") — 상품명 금지, 욕구/문제 먼저.** "설거지 30분, 아직도 손으로?"처럼
   스크롤을 멈추는 문제 제기 또는 결과 한 줄. 상품명이 먼저 나오면 광고로 읽혀 넘겨버립니다.
2. **2장 — 공감/비포.** 그 문제가 얼마나 성가신지 독자의 언어로.
3. **3장 — 제품 등장 + 핵심 가치 하나만.** 스펙 나열 금지, "그래서 뭐가 좋아지는데"를 한 줄로.
4. **4장 — 근거.** 본문에 있는 실측 수치·후기 평점·리뷰 수만 씁니다.
   본문에 없는 숫자를 지어내면 안 됩니다 — 없으면 이 장은 사용 장면 묘사로 대체.
5. **5장 — 가격·혜택.** 본문에 할인·가격 정보가 있으면 여기서. 없으면 차별점 한 가지.
6. **끝에서 두 번째(kind: "save") — "사기 전 체크리스트" 저장 유도.** 구매 직전에 다시 열어볼 이유.
7. **마지막(kind: "cta") — 구매 유도.** "가격·실사용 후기는 링크에서"처럼
   눌러야 얻는 것을 지목. 조르는 톤("사세요") 금지 — 확인하는 톤("맞는지 보고 결정하세요").

## 반드시 지킬 것
- 배경이 실제 상품 사진이므로 title 12자 이내, body 1~2줄(50자) 이내 — 길면 사진을 가립니다.
- 과장·최상급("최고", "1위", "무조건") 금지 — 본문에 근거 있는 표현만.
- 카드마다 alt: 키워드를 넣은 한 문장 (검색 노출 요소).
- caption: 3~4문장, 검색 키워드 자연 배치, 마지막 줄 "가격·후기는 프로필 링크에서 👆", 해시태그 2~3개.

## 출력 — JSON 만, 설명 금지
{
  "cards": [
    { "kind": "hook", "title": "…", "body": "…", "alt": "…" },
    { "kind": "body", "title": "…", "body": "…", "alt": "…" },
    { "kind": "save", "title": "…", "body": "…", "alt": "…" },
    { "kind": "cta", "title": "…", "body": "…", "alt": "…" }
  ],
  "caption": "…"
}`;
}

/** AI 응답에서 계획을 건진다. 못 건지면 null — 호출부가 사용자에게 알리고 멈춘다. */
export function parseCardPlan(raw: string): CardPlan | null {
  try {
    const text = String(raw || '').replace(/```(?:json)?/gi, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;

    const parsed = JSON.parse(text.slice(start, end + 1));
    const rawCards = Array.isArray(parsed?.cards) ? parsed.cards : [];

    const cards: CardItem[] = rawCards
      .map((c: any): CardItem | null => {
        const title = String(c?.title || '').trim();
        const body = String(c?.body || '').trim();
        if (!title && !body) return null;
        const kind: CardItem['kind'] = c?.kind === 'hook' || c?.kind === 'save' || c?.kind === 'cta' ? c.kind : 'body';
        return {
          kind,
          title,
          body,
          // Alt 가 비면 제목으로 채운다 — 빈 Alt 로 나가면 노출 요소를 버리는 셈이다
          alt: String(c?.alt || '').trim() || `${title} 카드뉴스`,
        };
      })
      .filter((c: CardItem | null): c is CardItem => c !== null)
      .slice(0, MAX_CARDS);

    if (cards.length < MIN_CARDS) return null;

    // 첫 장 훅, 마지막 장 클릭 유도, 그 앞 저장 유도 — AI 가 어겼으면 종류만 바로잡는다
    cards[0] = { ...cards[0]!, kind: 'hook' };
    cards[cards.length - 1] = { ...cards[cards.length - 1]!, kind: 'cta' };
    if (cards.length >= 4) cards[cards.length - 2] = { ...cards[cards.length - 2]!, kind: 'save' };

    const caption = String(parsed?.caption || '').trim();
    if (!caption) return null;

    return { cards, caption };
  } catch {
    return null;
  }
}
