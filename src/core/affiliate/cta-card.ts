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
  const noteLine = product.note
    ? `<div style="font-size:12.5px;color:#64748b;">${esc(product.note)}</div>`
    : '';
  const img = String(product.imageUrl || '').trim();
  const imgBox = img
    ? `<a href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener"
         style="flex:0 0 120px;display:block;"><img src="${esc(img)}" alt="${name}"
         style="width:120px;height:120px;object-fit:cover;border-radius:12px;display:block;background:#f1f5f9;"></a>`
    : '';

  return `
<div style="margin:32px 0;padding:18px;border:2px solid #fecdd3;border-radius:18px;background:#fff7f8;">
  <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
    ${imgBox}
    <div style="flex:1 1 220px;min-width:200px;">
      <div style="font-size:15px;font-weight:800;color:#0f172a;line-height:1.45;">${name}</div>
      ${priceLine}
      ${noteLine}
    </div>
  </div>
  <a href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener"
     style="display:block;margin-top:14px;padding:18px 20px;background:#e11d48;color:#ffffff;
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

  // ① 핵심 요약 직후 — 요약 섹션의 끝을 찾는다
  const summaryHead = out.search(/<h[23][^>]*>[^<]*(성급한|핵심 요약|한눈에|3줄 요약)[^<]*<\/h[23]>/i);
  if (summaryHead >= 0) {
    // 요약 블록 다음에 오는 첫 번째 h2 앞에 넣는다
    const nextH2 = out.indexOf('<h2', summaryHead + 10);
    const at = nextH2 > 0 ? nextH2 : -1;
    if (at > 0) {
      out = out.slice(0, at) + card('summary') + '\n' + out.slice(at);
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

  // ③ 글 끝 — 대가성 문구보다 앞에 둔다(고지문이 마지막이어야 자연스럽다)
  const discIdx = out.search(/<p[^>]*class="[^"]*affiliate-disclosure/i);
  if (discIdx > 0) {
    out = out.slice(0, discIdx) + card('final') + '\n' + out.slice(discIdx);
  } else {
    out += `\n${card('final')}`;
  }
  inserted += 1;

  return { html: out, inserted };
}

/** 제휴사 이름을 카드 밑 한 줄 정보로 (정책 라벨 재사용) */
export function providerLabel(provider: AffiliateProviderId | null): string {
  return provider ? (getPolicy(provider)?.label || '') : '';
}
