/**
 * 상품 CTA 카드 — 이미지 + 상품명 + 가격 + 버튼 (v3.8.404)
 *
 * ## 왜 만드나 — 실측(2026-08-02, 사용자 발행글)
 *   구매링크로 감싼 이미지: 8개   ← 링크는 걸려 있었다
 *   버튼형 CTA: 4개 → 카카오·네이버·X·Facebook (전부 공유 버튼)
 * 즉 **눈에 보이는 구매 버튼이 하나도 없었다.** 이미지를 눌러야 한다는 걸 독자는 모른다.
 * 사용자 판단도 같았다: "CTA가 버튼으로 구현되어야 하는데 전혀 구현되어 있지 않다."
 *
 * ## 설계 근거 (2026 CTA 벤치마크)
 *   · 버튼을 크게    → 클릭률 +90%
 *   · 구체적인 문구  → 전환 +161% ("여기 클릭" 금지, "최저가 확인하기" 처럼 무엇이 일어나는지)
 *   · 글 끝에 배치   → 전환 +70%
 *   · **주요 CTA 하나로 통일** → 선택지가 많으면 결정 마비가 온다. 그래서 문구·색을 통일한다.
 *   · 신뢰 요소를 버튼 근처에 → 가격·배송조건을 카드 안에 함께 둔다
 *
 * ## 지키는 원칙
 *   · 가격은 **확인된 값만**. 모르면 아예 쓰지 않는다(추정 금지).
 *   · 링크는 사용자가 준 원본 그대로. 주소를 바꾸면 제휴 계약 위반이다.
 *   · rel="sponsored nofollow noopener" 를 반드시 붙인다.
 */
import { getPolicy, type AffiliateProviderId } from './policies';

export interface CtaProduct {
  name: string;
  /** 확인된 가격만. 모르면 null */
  priceKrw: number | null;
  imageUrl: string;
  /** 사용자가 준 원본 링크 — 절대 바꾸지 않는다 */
  url: string;
  provider: AffiliateProviderId | null;
  /** 무료배송·로켓배송 같은 한 줄 정보 */
  note?: string;
}

/** 버튼 문구 — 위치마다 독자의 마음 상태가 다르다 */
const BUTTON_LABEL: Record<string, string> = {
  summary: '👉 지금 최저가 확인하기',
  mid: '🛒 실제 판매가 보러 가기',
  final: '✅ 최저가 확인하고 구매하기',
};

const esc = (s: string) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 설명문에서 **상품명 중복을 걷어낸다.**
 *
 * 사용자 보고(2026-08-03): "CTA 사진 우측에 제품명이 중복인데 수정안했네요"
 *
 * 원인: 제휴사가 주는 설명(og:description)이 상품명으로 시작한다. 실측 —
 *   제목 : "몽크로스 초강력 바디팬, 다크그레이, 2개"
 *   설명 : "몽크로스 초강력 바디팬, 다크그레이, 2개, 리뷰 5개 · 평점 4.6점. 모레 도착 예정"
 * 그대로 나란히 두면 같은 문장이 두 줄 겹쳐 보인다. 앞의 겹치는 부분만 떼고
 * **남는 정보(리뷰·평점·배송)만** 보여준다. 남는 게 없으면 아예 표시하지 않는다.
 */
export function dedupeProductNote(note: string, name: string): string {
  let out = String(note || '').trim();
  const base = String(name || '').trim();
  if (!out) return '';
  if (!base) return out;
  if (out === base) return '';
  if (out.startsWith(base)) {
    // 상품명 뒤에 붙은 구분자(, · | - 공백)까지 함께 떼어낸다
    out = out.slice(base.length).replace(/^[\s,·|/–—-]+/, '').trim();
  }
  // 떼고 났는데 너무 짧으면(의미 없는 꼬리) 표시하지 않는다
  return out.length >= 4 ? out : '';
}

/**
 * 카드 하나를 그린다.
 * 인라인 스타일만 쓴다 — 블로그 플랫폼마다 외부 CSS 가 먹지 않는 경우가 많다.
 */
export function renderProductCtaCard(
  product: CtaProduct,
  variant: 'summary' | 'mid' | 'final' = 'mid',
): string {
  const url = String(product.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return '';        // 링크가 없으면 카드도 없다

  const label = BUTTON_LABEL[variant] || BUTTON_LABEL['mid']!;
  const name = esc(product.name || '상품 보러가기');
  const priceLine = product.priceKrw && product.priceKrw > 0
    ? `<div style="font-size:20px;font-weight:900;color:#e11d48;margin:4px 0 2px;">${product.priceKrw.toLocaleString('ko-KR')}원</div>`
    : '';                                            // 모르는 가격은 쓰지 않는다
  // v3.8.432: 설명이 상품명으로 시작하면 겹치는 부분을 떼어낸다
  const cleanNote = dedupeProductNote(String(product.note || ''), String(product.name || ''));
  const noteLine = cleanNote
    ? `<div style="font-size:13.5px;color:#64748b;text-align:center;margin-top:6px;">${esc(cleanNote)}</div>`
    : '';
  const img = String(product.imageUrl || '').trim();
  // v3.8.432: 가운데 정렬 — 사진도 글도 버튼도 한 축에 놓는다.
  //   사용자 요구: "중앙으로 정렬시켜주세요", "제품명도 크게 중앙정렬로 배치해주세요"
  const imgBox = img
    ? `<a href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener"
         style="display:block;margin:0 auto 14px;width:180px;"><img src="${esc(img)}" alt="${name}"
         style="width:180px;height:180px;object-fit:contain;border-radius:12px;display:block;background:#f1f5f9;"></a>`
    : '';

  return `
<div style="margin:32px 0;padding:22px 18px;border:3px solid #fda4af;border-radius:18px;background:#fff7f8;text-align:center;">
  ${imgBox}
  <div style="font-size:19px;font-weight:900;color:#0f172a;line-height:1.45;text-align:center;word-break:keep-all;">${name}</div>
  ${priceLine}
  ${noteLine}
  <a href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener"
     style="display:block;margin-top:16px;padding:18px 20px;background:#e11d48;color:#ffffff;
            font-size:18px;font-weight:900;text-align:center;text-decoration:none;border-radius:14px;
            box-shadow:0 6px 18px rgba(225,29,72,0.28);">${label}</a>
</div>`.trim();
}

/**
 * 본문에 카드를 심는다.
 *
 * 자리 세 곳 — 독자가 움직이는 순간마다 하나씩:
 *   1) 핵심 요약 직후 — 급한 사람은 요약만 보고 바로 누른다(사용자 지적)
 *   2) 본문 중간      — 장점·후기를 읽고 마음이 기운 지점
 *   3) 글 끝          — 다 읽고 결정하는 지점 (전환 +70%)
 *
 * 이미 카드가 있으면 다시 넣지 않는다(중복 삽입 방지).
 */
export function insertCtaCards(html: string, product: CtaProduct): { html: string; inserted: number } {
  const src = String(html || '');
  if (!src.trim()) return { html: src, inserted: 0 };
  if (src.includes('data-orbit-cta')) return { html: src, inserted: 0 };

  const card = (v: 'summary' | 'mid' | 'final') => {
    const c = renderProductCtaCard(product, v);
    return c ? c.replace('<div style="margin:32px 0;', '<div data-orbit-cta="1" style="margin:32px 0;') : '';
  };
  if (!card('mid')) return { html: src, inserted: 0 };

  let out = src;
  let inserted = 0;

  /**
   * ① 핵심 요약 직후 — 요약 섹션의 끝을 찾는다.
   *
   * v3.8.419 — 이 함수는 orchestration.ts 에서 TOP_SUMMARY_CTA_PLACEHOLDER 가
   *   아직 실제 요약/서론 HTML로 치환되기 **전**에 불린다(호출 순서상 이 함수가 먼저
   *   실행되고, 요약·서론은 나중에 자리표시자 위치에 끼워 넣어진다). 그래서 실제 "핵심
   *   요약" 헤딩 텍스트를 찾는 정규식은 이 시점엔 항상 실패한다 — 아직 헤딩 자체가
   *   존재하지 않는다. 예전엔 이 조건이 그냥 조용히 실패해서 "요약 직후" 카드가
   *   한 번도 삽입되지 않는 죽은 코드였다.
   *   사용자: "핵심바로가기는 꺼주세요 이미지포함한 CTA를 배치해주시면됩니다" — 쇼핑모드
   *   상단의 텍스트뿐인 "핵심 바로가기" 버튼을 빼고 그 자리를 이미지 포함 카드로 채우려면,
   *   자리표시자 뒤(=나중에 요약·서론이 들어갈 자리 바로 다음)를 직접 앵커로 쓴다.
   */
  const summaryHead = out.search(/<h[23][^>]*>[^<]*(성급한|핵심 요약|한눈에|3줄 요약)[^<]*<\/h[23]>/i);
  if (summaryHead >= 0) {
    // 요약 블록 다음에 오는 첫 번째 h2 앞에 넣는다
    const nextH2 = out.indexOf('<h2', summaryHead + 10);
    const at = nextH2 > 0 ? nextH2 : -1;
    if (at > 0) {
      out = out.slice(0, at) + card('summary') + '\n' + out.slice(at);
      inserted += 1;
    }
  } else {
    const placeholder = '<!-- TOP_SUMMARY_CTA_PLACEHOLDER -->';
    const placeholderIdx = out.indexOf(placeholder);
    if (placeholderIdx >= 0) {
      const at = placeholderIdx + placeholder.length;
      out = out.slice(0, at) + '\n' + card('summary') + out.slice(at);
      inserted += 1;
    }
  }

  // ② 본문 중간 — h2 들의 가운데 지점
  const h2s = [...out.matchAll(/<h2\b/gi)].map((m) => m.index!).filter((i) => i >= 0);
  if (h2s.length >= 4) {
    const mid = h2s[Math.floor(h2s.length / 2)]!;
    out = out.slice(0, mid) + card('mid') + '\n' + out.slice(mid);
    inserted += 1;
  }

  /**
   * ③ 글 끝 — 항상 진짜 끝(HTML 맨 마지막)에 붙인다.
   *
   * v3.8.419 — 예전엔 "대가성 문구 바로 앞"을 찾아 거기 끼워 넣었다. 그건 고지문이
   *   글 "끝"에 있던 시절(v3.8.375 이전) 얘기다. v3.8.375 이후 대가성 문구는 항상
   *   H1 바로 뒤(최상단)로 고정됐는데, v3.8.417 에서 이 검색이 "coupang-disclosure"
   *   클래스까지 찾도록 넓히면서 — 그때부터 이 카드가 최상단 고지문 바로 앞, 즉
   *   **글의 첫머리**에 꽂히게 됐다. 실제 발행글 스크린샷으로 확인: "최저가 확인하고
   *   구매하기" 카드가 대가성 문구보다 위에, 본문보다도 위에 떠 있었다 — 사용자 지적
   *   ("공정위 문구는 항상 제일 상단에 올라가야 되는데")의 정체가 이거였다.
   *   고지문 위치를 더 이상 찾지 않는다 — 늘 진짜 끝에 붙인다.
   */
  out += `\n${card('final')}`;
  inserted += 1;

  return { html: out, inserted };
}

/** 제휴사 이름을 카드 밑 한 줄 정보로 (정책 라벨 재사용) */
export function providerLabel(provider: AffiliateProviderId | null): string {
  return provider ? (getPolicy(provider)?.label || '') : '';
}
