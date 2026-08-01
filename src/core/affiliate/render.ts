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

    // 가격 대신 확인된 정보를 보여준다 (토스는 배송·판매자가 og:description 에 온다)
    const infoHtml = !p.priceKrw && p.description
      ? `<div style="font-size:13px;color:#6b7280;margin:8px 0;line-height:1.5;">${esc(p.description).slice(0, 90)}</div>`
      : '';

    const imgHtml = img
      ? `<a href="${url}" target="_blank" rel="sponsored nofollow noopener" style="flex-shrink:0;">
    <img src="${img}" alt="${name}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;display:block;" loading="lazy" />
  </a>`
      : '';

    return `
<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;background:#fff;display:flex;gap:16px;align-items:flex-start;">
  ${imgHtml}
  <div style="flex:1;min-width:0;">
    <a href="${url}" target="_blank" rel="sponsored nofollow noopener" style="font-size:16px;font-weight:700;color:#111827;text-decoration:none;line-height:1.4;display:block;margin-bottom:8px;">${name}</a>
    ${priceHtml}${infoHtml}
    <a href="${url}" target="_blank" rel="sponsored nofollow noopener" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;margin-top:8px;">상품 보러가기 →</a>
  </div>
</div>`;
  }).join('');

  return `
<div class="affiliate-product-showcase" data-affiliate-provider="${policy.id}" style="margin:48px 0;padding:24px;background:#f9fafb;border-radius:16px;">
  <h2 style="font-size:22px;font-weight:800;color:#111;margin:0 0 20px;padding:0;border:none;">🛒 소개한 상품</h2>
  ${cards}
</div>
`;
}
