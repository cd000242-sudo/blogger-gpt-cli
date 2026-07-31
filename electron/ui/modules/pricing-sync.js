/**
 * 금액 표기 통일 (v3.8.392)
 *
 * 왜 필요한가 — 2026-07-31 실측으로 3중 불일치를 확인했다:
 *   Gemini 3.5 Flash    pricing.ts costKrw=80 / index.html data-cost=20 / 화면 라벨 "~₩20/글"
 *   Gemini Flash-Lite   costKrw=15 / data-cost=15 / 화면 라벨 "~₩12/글"
 * 화면이 자기 숫자를 하드코딩해 들고 있으면 백엔드 단가를 고쳐도 절대 따라오지 않는다.
 *
 * 그래서 화면의 숫자를 지우지 않고 **덮어쓴다** — 백엔드 pricing.ts 하나만 고치면
 * 선택창·배지·data-cost 가 전부 같이 움직인다.
 *
 * 실패해도 화면을 망가뜨리지 않는다(기존 하드코딩 값이 그대로 남을 뿐).
 */

let cachedTiers = null;

/** 백엔드에서 금액표를 가져온다. 실패 시 null. */
async function fetchPricingTable() {
  if (cachedTiers) return cachedTiers;
  try {
    const res = await window.electronAPI?.invoke?.('pricing:table');
    if (!res?.ok || !Array.isArray(res.tiers) || res.tiers.length === 0) return null;
    cachedTiers = res.tiers;
    return cachedTiers;
  } catch {
    return null;
  }
}

/** 라디오 value 로 티어를 찾는다 (UI value ↔ pricing value 는 같은 키를 쓴다). */
function findTierByValue(tiers, value) {
  const v = String(value || '').trim();
  if (!v) return null;
  return tiers.find(t => t.value === v || t.modelId === v) || null;
}

/**
 * 선택창의 모든 카드 금액을 백엔드 값으로 맞춘다.
 * 카드 구조: label.tier-card > input[type=radio][value] + ... + div(마지막 = 금액 라벨)
 */
export async function syncPricingLabels() {
  const tiers = await fetchPricingTable();
  if (!tiers) return { ok: false, synced: 0 };

  let synced = 0;
  document.querySelectorAll('label.tier-card').forEach((card) => {
    const radio = card.querySelector('input[type="radio"]');
    const tier = findTierByValue(tiers, radio?.value);
    if (!tier) return;

    // data-cost 속성 (다른 스크립트가 참조할 수 있다)
    card.setAttribute('data-cost', String(tier.costKrw));

    // 금액 라벨 — "₩" 가 들어간 마지막 div 를 금액 줄로 본다
    const divs = Array.from(card.querySelectorAll('div'));
    const costEl = divs.reverse().find(d => /₩/.test(d.textContent || ''));
    if (costEl) {
      costEl.textContent = tier.costLabel;
      costEl.title = tier.derived
        ? `토큰 단가로 계산한 값 — ${tier.priceSource}`
        : `단가 미확인(선언값) — ${tier.priceSource}`;
      synced += 1;
    }
  });

  syncCurrentBadge(tiers);
  return { ok: true, synced };
}

/** 상단 "현재: ○○ · ~₩N/글" 배지도 같은 값으로 맞춘다. */
export function syncCurrentBadge(tiers) {
  const badge = document.getElementById('textEngineCurrent');
  if (!badge || !tiers) return;
  const checked = document.querySelector('input[name="primaryGeminiTextModel"]:checked');
  const tier = findTierByValue(tiers, checked?.value);
  if (tier) badge.textContent = `현재: ${tier.title} · ${tier.costLabel}`;
}

/** 라디오 변경 시 배지를 다시 맞춘다. */
export function bindPricingBadgeUpdates() {
  document.querySelectorAll('input[name="primaryGeminiTextModel"]').forEach((radio) => {
    radio.addEventListener('change', async () => {
      const tiers = await fetchPricingTable();
      if (tiers) syncCurrentBadge(tiers);
    });
  });
}

/** 화면 로드 시 1회 호출. 실패해도 조용히 넘어간다. */
export async function initPricingSync() {
  try {
    const result = await syncPricingLabels();
    bindPricingBadgeUpdates();
    if (result.ok) console.log(`[PRICING] 금액 라벨 ${result.synced}개를 단일 출처와 동기화`);
    return result;
  } catch (e) {
    console.warn('[PRICING] 동기화 실패(화면 기존 값 유지):', e?.message || e);
    return { ok: false, synced: 0 };
  }
}
