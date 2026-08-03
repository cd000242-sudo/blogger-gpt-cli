/**
 * 제휴 상품 카드 렌더 + 프롬프트 주입 (v3.8.396)
 *
 * 쿠팡(coupang-partners.ts)의 검증된 패턴을 따르되, 제휴사 공용으로 만든다.
 *
 * ⚠️ 가장 중요한 차이: **가격이 없을 수 있다.**
 *   실측(2026-08-01) 토스쇼핑은 웹 페이지에 가격을 노출하지 않는다(정적·렌더 모두).
 *   쿠팡 렌더러는 가격이 0이면 "가격 확인"으로 때웠지만, 제휴 상품 카드에서
 *   가격 자리를 비워두면 독자가 오해한다. 그래서 **가격 줄 자체를 빼고**
 *   대신 확인된 정보(배송·판매자)를 보여준다. 없는 가격을 만들지 않는다.
 *
 * ⚠️ 링크는 사용자가 준 원본(originalUrl)만 쓴다.
 *   토스 정책: "제공하지 않은 링크를 임의로 수정하면 계약 해지."
 */
import { AffiliateProduct } from './crawl';
import { getPolicy } from './policies';
import { dedupeProductNote } from './cta-card';

const esc = (v: string): string => String(v || '')
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 프롬프트용 상품 정보. 모델이 없는 사실을 지어내지 않도록
 * "확인된 것"과 "확인 안 된 것"을 명시한다.
 */
export function formatAffiliateProductsForPrompt(products: AffiliateProduct[]): string {
  const list = (Array.isArray(products) ? products : []).filter(p => p?.title);
  if (list.length === 0) return '';

  const label = getPolicy(list[0]!.provider)?.label || '제휴';
  const lines = list.map((p, i) => {
    const rows = [`${i + 1}. **${p.title}**`];
    if (p.priceKrw) rows.push(`   - 가격: ${p.priceKrw.toLocaleString('ko-KR')}원 (확인됨)`);
    else rows.push('   - 가격: **확인되지 않음 — 본문에 가격을 쓰지 마세요**');
    if (p.description) rows.push(`   - 상품 정보: ${p.description}`);
    rows.push(`   - 링크: ${p.originalUrl}`);
    return rows.join('\n');
  });

  return `

===== ${label} 실제 상품 데이터 =====
${lines.join('\n\n')}
=====

⚠️ 위 상품명·가격·링크는 **실제로 확인된 데이터**입니다. 그대로 쓰세요.
⚠️ "가격: 확인되지 않음" 인 상품은 **가격을 추측해서 쓰지 마세요.** 대신 사용 상황·장단점·
   어떤 사람에게 맞는지를 다루세요. 없는 숫자를 쓰면 독자를 속이는 것이고 제휴 정책 위반입니다.
⚠️ 위에 없는 상품을 만들어내지 마세요.
`;
}

/**
 * 상품 카드 HTML. 모델이 본문에 링크를 안 붙여도 이 블록이 최종 HTML 에 들어가
 * 수익 누수를 막는다(쿠팡 렌더러와 같은 이유).
 */
export function renderAffiliateProductBlock(products: AffiliateProduct[]): string {
  const list = (Array.isArray(products) ? products : []).filter(p => p?.title).slice(0, 6);
  if (list.length === 0) return '';

  const policy = getPolicy(list[0]!.provider);
  if (!policy) return '';

  const cards = list.map((p) => {
    const name = esc(p.title);
    const url = esc(p.originalUrl);
    const img = esc(p.imageUrl);

    // 가격은 확인된 것만 — 없으면 줄 자체를 넣지 않는다
    const priceHtml = p.priceKrw
      ? `<div style="font-size:20px;font-weight:800;color:#ef4444;margin:8px 0;">${p.priceKrw.toLocaleString('ko-KR')}원</div>`
      : '';

    /**
     * v3.8.432 — 상품명이 두 번 나오던 문제.
     *
     * 사용자 보고: "소개한 상품은 우측 글이 … 이 두개중 아래에 얘를 없애버리고
     *   상품보러가기를 다른 CTA처럼 중앙에 크게 배치하고 제품명도 크게 중앙정렬로"
     *
     * 제휴사 설명(og:description)이 상품명으로 시작해서 제목과 겹쳤다.
     * 겹치는 앞부분을 떼고 남는 정보(리뷰·평점·배송)만 보여준다.
     */
    const cleanInfo = dedupeProductNote(String(p.description || ''), String(p.title || ''));
    const infoHtml = !p.priceKrw && cleanInfo
      ? `<div style="font-size:14px;color:#6b7280;margin:8px 0;line-height:1.6;text-align:center;">${esc(cleanInfo).slice(0, 90)}</div>`
      : '';

    // 가운데 정렬 — 사진·상품명·버튼을 한 축에 놓는다
    const imgHtml = img
      ? `<a href="${url}" target="_blank" rel="sponsored nofollow noopener" style="display:block;margin:0 auto 16px;width:220px;">
    <img src="${img}" alt="${name}" style="width:220px;height:220px;object-fit:contain;border-radius:10px;display:block;background:#f8fafc;" loading="lazy" />
  </a>`
      : '';

    return `
<div style="border:3px solid #dbe4ee;border-radius:14px;padding:22px 18px;margin-bottom:16px;background:#fff;text-align:center;">
  ${imgHtml}
  <a href="${url}" target="_blank" rel="sponsored nofollow noopener" style="font-size:20px;font-weight:900;color:#111827;text-decoration:none;line-height:1.45;display:block;margin-bottom:8px;text-align:center;word-break:keep-all;">${name}</a>
  ${priceHtml}${infoHtml}
  <a href="${url}" target="_blank" rel="sponsored nofollow noopener" style="display:block;background:#2563eb;color:#fff;font-size:18px;font-weight:900;padding:18px 20px;border-radius:14px;text-decoration:none;margin-top:16px;text-align:center;box-shadow:0 6px 18px rgba(37,99,235,0.28);">🛒 상품 보러가기 →</a>
</div>`;
  }).join('');

  return `
<div class="affiliate-product-showcase" data-affiliate-provider="${policy.id}" style="margin:48px 0;padding:24px;background:#f9fafb;border-radius:16px;">
  <h2 style="font-size:22px;font-weight:800;color:#111;margin:0 0 20px;padding:0;border:none;">🛒 소개한 상품</h2>
  ${cards}
</div>
`;
}
