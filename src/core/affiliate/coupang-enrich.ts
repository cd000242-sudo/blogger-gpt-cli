/**
 * 쿠팡 상품 보강 — API 가 못 주는 것만 브라우저로 가져온다 (v3.8.400)
 *
 * ## 왜 이렇게 나눴나 (전부 2026-08-01 실측)
 *
 * 쿠팡 오픈 API 응답 필드는 정확히 10개다:
 *   productId · productName · productPrice · productImage · productUrl
 *   categoryName · keyword · rank · isRocket · isFreeShipping
 * 후기·별점·상세스펙은 **응답에 아예 없고**, 후기 엔드포인트는 404 다
 *   (`/v1/products/reviews` → PRECONDITION_FAILED, 상품 단건 조회도 없음).
 *
 * 그렇다고 브라우저로 전부 긁으면 안 된다. 서로 다른 카테고리 5개로 대조한 결과:
 *   페이지 접근  5/5  · 상품명 읽힘 5/5
 *   상품명 일치  3/5  (불일치 2건은 ", 블루, 1개" 같은 옵션 접미사 차이)
 *   **가격 일치  1/5** ← 위크위크 원두 API 13,200원 vs 크롬 26,290원
 * 가격이 어긋나는 이유는 API 는 링크가 가리키는 itemId 가격을, 페이지는 대표 옵션
 * 가격을 보기 때문이다. 어느 쪽도 "틀린" 게 아니라 기준이 다르다.
 *
 * 그래서 역할을 못 박는다:
 *   상품명·가격·대표이미지·제휴링크 → **API 전용** (숫자는 전부 여기서 온다)
 *   후기·별점·상세스펙            → **브라우저 전용** (API 에 없는 것만)
 *
 * ## 브라우저는 창을 띄워야 한다
 * 서버요청(403) · Playwright 헤드리스(403) · patchright 스텔스 헤드리스(403) ·
 * 실제 Chrome 헤드리스(403) — 네 가지 모두 막혔고 **창을 띄운 실제 Chrome 만 200** 이다.
 * 사용자 확인: "브라우저 창이 뜨는건 상관없어 오히려 사용자한테 신뢰를 줄 수 있어".
 *
 * ## 후기는 자르지 않는다
 * `/vp/product/reviews` 는 size=30 이 상한이고(50·100 은 빈 응답) 페이지는 계속 넘어간다.
 * 본문은 잘리지 않고 통째로 온다(최장 1,892자, 잘림 0건).
 * 사용자 지시: "후기는 짤리지않게 밀도높게 추출해야되"
 *   → 개별 후기는 **절대** 자르지 않는다. 총량이 상한에 닿으면 그 다음 후기부터 넣지 않는다.
 */
import { CHROMIUM_GPU_SAFE_ARGS } from '../../utils/chromium-safe-args';
import { normalizeImageUrl } from './product-image';

export interface CoupangReview {
  body: string;
  rating: number | null;
  date: string;
}

export interface CoupangEnrichment {
  productId: string;
  /** 교차검증용 — 브라우저가 읽은 상품명 (본문에는 쓰지 않는다) */
  pageTitle: string;
  reviews: CoupangReview[];
  totalReviewCount: number;
  /** 상품 자체 스펙 — 크기·재질·사용대상 등 (배송정책과 섞지 않는다) */
  specs: string[];
  /** 판매 옵션 — 구성별 가격차. 후기 없는 상품의 최고 소재다 */
  options: string[];
  /** 배송·반품 조건 — 해외직구 여부, 반품비 같은 '사기 전에 알아야 할' 것 */
  policy: string[];
  /**
   * 상품 대표 이미지(og:image). (v3.8.404)
   * 실측 사고(2026-08-02): 발행된 글의 이미지 10장이 전부 AI 생성이고 쿠팡 상품 사진은 0장이었다.
   * 상품명만 확보하고 **이미지를 안 가져왔기 때문**이다. 썸네일이 상품 사진이 되려면 이게 필요하다.
   */
  imageUrl: string;
  /** 브라우저가 다른 상품을 보고 있었으면 false — 이때 reviews 는 비운다 */
  verified: boolean;
  note: string;
}

/**
 * 쿠팡 페이지에 섞여 들어오는 **추천상품 광고**인가.
 *
 * 실측(2026-08-01): 후기 없는 상품에서 스펙을 긁었더니 15개 중 9개가 남의 상품 광고였다.
 *   "SUUNI 신형 불빛 전기 물총 … 17,800(1개당 17,800원)내일(일) 도착(4)"
 *   "회오리 분수 물총 PRO-X 63cm 초대형 블루, 1개28,00070%8,240…"
 * 이게 본문에 들어가면 **남의 상품을 소개하는 글**이 된다. 반드시 걸러야 한다.
 */
export function isAdLine(text: string): boolean {
  const t = String(text || '');
  if (!t) return true;
  const prices = (t.match(/[0-9][0-9,]{2,}\s*원?/g) || []).length;
  // 광고 카드는 '가격 + 할인율 + 도착예정' 이 한 줄에 뭉쳐 온다
  if (prices >= 2 && /\d{1,2}%/.test(t)) return true;
  if (/\(1개당\s|1개당\s*[0-9]/.test(t)) return true;
  if (/(내일|오늘|모레)\s*\(?[월화수목금토일]?\)?\s*도착/.test(t)) return true;
  if (/특가진행중|와우할인|%\s*남음/.test(t)) return true;
  return false;
}

export interface EnrichOptions {
  onLog?: ((msg: string) => void) | undefined;
  /** 몇 페이지까지 넘길지 (한 페이지 30개) */
  maxPages?: number;
  /** 후기 총량 상한. 개별 후기를 자르는 게 아니라 '여기까지만 담는다' */
  maxTotalChars?: number;
  timeoutMs?: number;
  /**
   * 캐시 폴더. 주면 같은 상품을 다시 긁지 않는다.
   * 실측(2026-08-01): 15회 넘게 반복 조회하자 실제 Chrome 도 403 이 됐다.
   * 두드리는 횟수를 줄이는 것이 가장 확실한 차단 회피다.
   */
  cacheDir?: string | undefined;
}

const REVIEW_PAGE_SIZE = 30;   // 실측 상한. 50·100 은 빈 응답이 온다

/**
 * 쿠팡 자동 영어번역 덩어리를 걷어낸다.
 *
 * 실측: 후기 뒤에 같은 내용의 영어 번역이 통째로 붙어 온다
 *   "…추천합니다. 【My Own Purchase Review】 Hello~ I bought the Cuckoo…"
 * 같은 내용을 두 번 넣는 셈이라 토큰을 두 배로 먹는다. 이건 원문 손실이 아니라 중복 제거다.
 */
export function stripAutoTranslation(text: string): string {
  const s = String(text || '');
  /** 뒷부분이 '한글 거의 없고 영문 위주'인가 — 자동번역본의 특징 */
  const isEnglishTail = (tail: string): boolean => {
    if (tail.length < 60) return false;
    const han = (tail.match(/[가-힣]/g) || []).length;
    const eng = (tail.match(/[A-Za-z]/g) || []).length;
    return eng > tail.length * 0.35 && han < tail.length * 0.05;
  };

  // 1) 【My Own Purchase Review】 같은 번역 머리표
  const marker = s.search(/【[^】]*(Review|Purchase|Translated)[^】]*】/i);
  if (marker > 0 && isEnglishTail(s.slice(marker))) {
    const head = s.slice(0, marker).trim();
    if (head.length >= 30) return head;      // 남는 본문이 있을 때만 자른다
  }

  // 2) 머리표가 없으면 '한글이 끊기고 영어만 길게 이어지는 지점'
  //    길이 문턱은 100자 — 판정은 isEnglishTail(영문 35% 초과 & 한글 5% 미만)이 맡는다.
  //    (200자로 잡았더니 135자짜리 번역본이 그대로 남았다)
  const m = s.match(/[가-힣][^가-힣]{100,}$/);
  if (m && m.index !== undefined) {
    const cut = m.index + 1;
    // 마지막 한글 뒤의 구두점(".", "!", "~" 등)은 한글 문장의 일부다 — 같이 남긴다
    const tailPunct = s.slice(cut).match(/^[\s.!?~…"')\]]+/);
    const keepTo = cut + (tailPunct ? tailPunct[0].length : 0);
    if (cut >= 30 && isEnglishTail(s.slice(keepTo))) return s.slice(0, keepTo).trim();
  }
  return s.trim();
}

/**
 * 브라우저가 읽은 상품명과 API 상품명이 같은 상품인지 판정한다.
 *
 * 실측상 페이지 제목에는 옵션이 덧붙는다:
 *   API  "스윔어바웃 어린이 파도타기 모양튜브"
 *   페이지 "스윔어바웃 어린이 파도타기 모양튜브, 블루, 1개"
 * 그래서 완전일치를 요구하면 멀쩡한 상품이 탈락한다. 한쪽이 다른 쪽을 품으면 같은 상품으로 본다.
 * 반대로 전혀 겹치지 않으면 **다른 상품을 보고 있다는 뜻**이라 후기를 통째로 버려야 한다.
 * (엉뚱한 상품 후기가 본문에 들어가는 것이 최악이다.)
 */
export function isSameProduct(apiName: string, pageName: string): boolean {
  const norm = (s: string) => String(s || '')
    .replace(/\s+/g, '')
    .replace(/[,\-–—()[\]{}'"·|/]/g, '')
    .toLowerCase();
  const a = norm(apiName);
  const b = norm(pageName).replace(/쿠팡$/, '');
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  // 페이지 제목은 " - 카테고리 | 쿠팡" 이 붙는다 — 앞부분만 다시 본다
  const head = b.slice(0, Math.max(10, a.length));
  return a.startsWith(head) || head.startsWith(a.slice(0, Math.min(a.length, 20)));
}

/**
 * 후기를 모은다 — 개별 후기는 자르지 않고, 총량 상한에서 담기를 멈춘다.
 */
export function packReviews(
  all: CoupangReview[],
  maxTotalChars: number,
): { picked: CoupangReview[]; chars: number; dropped: number } {
  const picked: CoupangReview[] = [];
  let chars = 0;
  for (const r of all) {
    if (chars + r.body.length > maxTotalChars && picked.length > 0) break;
    picked.push(r);
    chars += r.body.length;
  }
  return { picked, chars, dropped: all.length - picked.length };
}

/**
 * 창을 띄운 실제 Chrome 으로 후기·스펙을 가져온다.
 * 실패해도 절대 throw 하지 않는다 — 보강이 안 돼도 발행은 그대로 진행한다.
 */
export async function enrichCoupangProduct(
  productId: string,
  apiProductName: string,
  opts: EnrichOptions = {},
): Promise<CoupangEnrichment | null> {
  const pid = String(productId || '').trim();
  if (!/^\d+$/.test(pid)) return null;

  const maxPages = Math.max(1, Math.min(opts.maxPages ?? 2, 6));
  const maxTotalChars = Math.max(2000, opts.maxTotalChars ?? 60000);
  const log = opts.onLog;

  // 캐시 먼저 — 브라우저를 띄우지 않는 게 가장 빠르고 가장 안전하다
  if (opts.cacheDir) {
    try {
      const { getCached } = require('./enrich-cache');
      const hit = getCached(opts.cacheDir, pid);
      if (hit) {
        log?.(`   💾 저장해 둔 상품 정보 사용 (후기 ${hit.reviews.length}개) — 쿠팡을 다시 조회하지 않습니다`);
        return hit;
      }
    } catch { /* 캐시 실패는 무시하고 정상 경로로 간다 */ }
  }

  let ctx: any = null;
  try {
    const { chromium } = require('patchright');
    const os = require('os');
    const path = require('path');
    const fsMod = require('fs');
    // 사용자의 기존 Chrome 프로필은 건드리지 않는다 — 전용 프로필을 쓴다
    const baseProfile = path.join(os.tmpdir(), 'orbit-coupang-profile');

    log?.(`   🛒 쿠팡 상품 정보 확인 중 (창이 잠깐 뜹니다)...`);

    /**
     * 차단은 **프로필(쿠키)** 에 걸린다 — IP 가 아니다.
     * 실측(2026-08-02): 기존 프로필로 403 이 계속 나던 상황에서
     *   새 프로필로 같은 상품을 열자 **바로 HTTP 200** 이었다.
     * 그래서 막히면 프로필을 버리고 한 번 더 시도한다. 이걸로 대부분 복구된다.
     */
    let page: any = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const profileDir = attempt === 1 ? baseProfile : `${baseProfile}-${Date.now()}`;
      ctx = await chromium.launchPersistentContext(profileDir, {
        channel: 'chrome',          // 번들 Chromium 은 403. 실제 Chrome 이어야 한다
        headless: false,            // 헤드리스는 실제 Chrome 이어도 403
        locale: 'ko-KR',
        viewport: { width: 1280, height: 900 },
        args: [...CHROMIUM_GPU_SAFE_ARGS],   // 블루스크린 방지 (v3.8.395 참조)
      });
      page = ctx.pages()[0] || await ctx.newPage();
      const res = await page.goto(`https://www.coupang.com/vp/products/${pid}`, {
        waitUntil: 'domcontentloaded',
        timeout: opts.timeoutMs ?? 40000,
      });
      const status = res ? res.status() : 0;
      if (status === 200) break;

      // 막혔다 — 이 프로필은 버린다
      try { await ctx.close(); } catch { /* noop */ }
      ctx = null;
      try { fsMod.rmSync(profileDir, { recursive: true, force: true }); } catch { /* noop */ }

      if (attempt === 1) {
        log?.(`   ↻ 쿠팡이 막았습니다 (HTTP ${status}) — 브라우저 기록을 비우고 다시 시도합니다`);
      } else {
        log?.(`   ⚠️ 쿠팡이 상품 페이지를 막았습니다 (HTTP ${status}) — 후기 없이 진행합니다`);
        return null;
      }
    }
    // 새 프로필로 처음 열면 메타 태그가 늦게 채워진다(실측: og:title 이 비어 교차검증이 실패했다).
    // 제목이 들어올 때까지 기다린다 — 못 기다려도 그대로 진행한다(발행을 막지 않는다).
    try {
      await page.waitForFunction(
        () => !!document.querySelector('meta[property="og:title"]')?.getAttribute('content')
          || (document.title && !/access denied/i.test(document.title)),
        { timeout: 10000 },
      );
    } catch { /* 타임아웃이어도 계속 — 아래에서 교차검증이 걸러준다 */ }
    await page.waitForTimeout(1500);

    // ── 페이지 정보 (교차검증용 제목 + 스펙 + 옵션) ──
    const pageInfo = await page.evaluate(() => {
      const clean = (el: any) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
      const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title;
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      // 상품마다 템플릿이 달라 클래스가 바뀐다 — 넓게 긁고 뒤에서 분류·정제한다
      const rawLines = [...new Set(Array.from(document.querySelectorAll('li,tr,dd,.prod-attr-item'))
        .filter((el) => el.children.length <= 3)
        .map(clean)
        .filter((t) => t.length >= 5 && t.length <= 200))];

      // 상품 자체 스펙 — 크기·재질·사용대상 (실측: "아이템 높이: 110cm", "사용대상: 여성용")
      const specs = rawLines.filter((t) =>
        /(사용\s*대상|높이|너비|길이|크기|사이즈|무게|중량|재질|소재|용량|색상|구성품|모델|원산지|제조|인증|정격|출력)/.test(t)
        && !/(배송|반품|교환)/.test(t));

      // 배송·반품 — 사기 전에 알아야 하는 것 (해외직구·반품비)
      const policy = rawLines.filter((t) => /(배송|반품|교환|도착 예정)/.test(t) && !/^\s*$/.test(t));

      const options = Array.from(document.querySelectorAll('.select-item, [class*="select-item"]'))
        .map(clean).filter((t) => t.length > 5);

      return {
        title,
        ogImage,
        specs: [...new Set(specs)].slice(0, 20),
        policy: [...new Set(policy)].slice(0, 8),
        options: [...new Set(options)].slice(0, 12),
      };
    });

    // 추천상품 광고를 걷어낸다 — 안 걸러내면 남의 상품을 소개하는 글이 된다
    const cleanSpecs = pageInfo.specs.filter((t: string) => !isAdLine(t));
    const cleanOptions = pageInfo.options.filter((t: string) => !isAdLine(t));
    const cleanPolicy = pageInfo.policy.filter((t: string) => !isAdLine(t));

    // v3.8.403 — apiProductName 이 비어 있으면 "아직 상품명을 모른다"는 뜻이다.
    //   이때는 이 페이지가 **이름의 출처**이므로 대조할 대상이 없다(대조 실패로 보면 안 된다).
    //   링크만 받은 상태에서 상품명을 먼저 알아내는 경로가 여기다.
    const verified = apiProductName ? isSameProduct(apiProductName, pageInfo.title) : true;
    if (!verified) {
      // 다른 상품을 보고 있다 — 후기를 가져오면 독자를 속이게 된다
      log?.(`   ⚠️ 페이지 상품이 API 상품과 다릅니다 — 후기를 쓰지 않습니다`);
      return {
        productId: pid,
        pageTitle: pageInfo.title,
        reviews: [],
        totalReviewCount: 0,
        specs: cleanSpecs,
        options: cleanOptions,
        policy: cleanPolicy,
        imageUrl: normalizeImageUrl(String(pageInfo.ogImage || '')),   // v3.8.413: //host → https://host
        verified: false,
        note: '페이지 상품과 API 상품이 일치하지 않아 후기를 제외했습니다',
      };
    }

    // ── 후기 수집 (size=30 이 상한, 페이지는 계속 넘어간다) ──
    const collected: CoupangReview[] = [];
    let totalReviewCount = 0;

    for (let p = 1; p <= maxPages; p += 1) {
      const batch = await page.evaluate(async (args: { pid: string; page: number; size: number }) => {
        const url = `/vp/product/reviews?productId=${args.pid}&page=${args.page}&size=${args.size}`
          + '&sortBy=ORDER_SCORE_ASC&ratings=&q=&viRoleCode=3&ratingSummary=true';
        const r = await fetch(url, { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!r.ok) return { total: 0, items: [] as any[] };
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const totalEl = doc.querySelector('[data-total-count], [data-count]');
        const total = Number(totalEl?.getAttribute('data-total-count') || totalEl?.getAttribute('data-count') || 0);

        const arts = Array.from(doc.querySelectorAll('article[class*="review__article__list"]'));
        const items = arts.map((a) => {
          const t = (sel: string) => (a.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
          const body = t('.sdp-review__article__list__review__content') || t('[class*="review__content"]');
          const ratingRaw = a.querySelector('[class*="star-orange"]')?.getAttribute('data-rating') || '';
          return {
            body,
            rating: ratingRaw ? Number(ratingRaw) : null,
            date: t('[class*="reg-date"]'),
          };
        }).filter((x) => x.body.length > 20);
        return { total, items };
      }, { pid, page: p, size: REVIEW_PAGE_SIZE });

      if (p === 1) totalReviewCount = batch.total;
      if (!batch.items.length) break;

      for (const it of batch.items) {
        collected.push({
          body: stripAutoTranslation(it.body),
          rating: it.rating,
          date: it.date,
        });
      }
      // 이미 충분히 모았으면 더 넘기지 않는다 (창 떠 있는 시간을 줄인다)
      if (collected.reduce((n, r) => n + r.body.length, 0) >= maxTotalChars) break;
    }

    const { picked, chars, dropped } = packReviews(collected, maxTotalChars);

    if (picked.length === 0) {
      log?.(`   ℹ️ 이 상품은 후기가 없습니다 (총 ${totalReviewCount}개) — 후기 없이 진행합니다`);
    } else {
      log?.(`   ✅ 후기 ${picked.length}개 확보 (${chars.toLocaleString('ko-KR')}자, 잘라내지 않음`
        + `${dropped > 0 ? `, 분량 상한으로 ${dropped}개 제외` : ''}) · 스펙 ${cleanSpecs.length}개`);
    }

    const result: CoupangEnrichment = {
      productId: pid,
      pageTitle: pageInfo.title,
      reviews: picked,
      totalReviewCount,
      specs: cleanSpecs,
      options: cleanOptions,
      policy: cleanPolicy,
      imageUrl: normalizeImageUrl(String(pageInfo.ogImage || '')),   // v3.8.413: //host → https://host
      verified: true,
      note: '',
    };

    // 다음에 같은 상품을 쓸 때 쿠팡을 다시 두드리지 않도록 저장한다.
    // 후기가 0개여도 저장한다 — "후기가 없다"는 사실도 확인된 정보다.
    if (opts.cacheDir) {
      try { require('./enrich-cache').putCached(opts.cacheDir, pid, result); } catch { /* noop */ }
    }
    return result;
  } catch (e: any) {
    log?.(`   ⚠️ 쿠팡 후기 수집 실패 (계속 진행): ${String(e?.message || e).slice(0, 60)}`);
    return null;
  } finally {
    try { if (ctx) await ctx.close(); } catch { /* noop */ }
  }
}

/**
 * 프롬프트에 넣을 블록으로 만든다.
 * 후기는 **원문 그대로** 넣는다 — 요약하면 "실제 써본 사람" 의 결이 사라진다.
 */
export function formatEnrichmentForPrompt(e: CoupangEnrichment | null): string {
  if (!e) return '';
  const hasAnything = e.reviews.length || e.specs.length || e.options.length || e.policy.length;
  if (!hasAnything) return '';

  const lines: string[] = [];

  if (e.reviews.length) {
    lines.push('\n\n===== 쿠팡 실제 구매자 후기 (원문) =====');
    lines.push(`총 ${e.totalReviewCount.toLocaleString('ko-KR')}개 중 ${e.reviews.length}개를 그대로 옮겼습니다.`);
    e.reviews.forEach((r, i) => {
      const head = [r.rating ? `별점 ${r.rating}` : '', r.date].filter(Boolean).join(' · ');
      lines.push(`\n[후기 ${i + 1}${head ? ` · ${head}` : ''}]\n${r.body}`);
    });
  } else {
    // 후기 0개 — 신상품이나 해외직구에서 흔하다.
    //   없는 후기를 지어내면 독자를 속이는 것이고 제휴 정책 위반이다.
    //   대신 **스펙·옵션·배송조건**으로 쓴다. 사용자 제안:
    //   "스펙을 구매욕구를 끌어와서 스펙을 보고 스토리텔링을 하면 어때"
    lines.push('\n\n===== 이 상품은 아직 후기가 없습니다 =====');
    lines.push('구매자 후기가 0개입니다. **후기가 있는 것처럼 쓰지 마세요.**');
    lines.push('"후기를 보니", "많은 분들이", "재구매율이" 같은 표현을 절대 쓰지 마세요.');
    lines.push('아래 확인된 사실만으로 글을 씁니다.');
  }

  if (e.specs.length) {
    lines.push('\n----- 상품 스펙 (확인된 사실) -----');
    e.specs.forEach((s) => lines.push(`· ${s}`));
  }
  if (e.options.length) {
    lines.push('\n----- 판매 옵션과 구성별 가격 -----');
    e.options.forEach((s) => lines.push(`· ${s}`));
  }
  if (e.policy.length) {
    lines.push('\n----- 배송·반품 조건 -----');
    e.policy.forEach((s) => lines.push(`· ${s}`));
  }

  if (e.reviews.length) {
    lines.push(
      '\n⚠️ 위 후기는 실제 구매자가 쓴 글입니다.',
      '   · 후기에서 드러난 **구체적인 사용 상황·장점·불만**을 본문에 녹이세요.',
      '   · 후기 문장을 그대로 베끼지 말고, 거기 담긴 사실을 근거로 쓰세요.',
      '   · 후기에 없는 내용을 지어내지 마세요.',
    );
  } else {
    lines.push(
      '\n⚠️ 후기가 없을 때 쓰는 법 — 스펙을 독자의 상황으로 번역하세요.',
      '   · 숫자를 그대로 나열하지 마세요. **그 숫자가 생활에서 무슨 뜻인지**로 바꾸세요.',
      '     (예: "길이 180cm" → "성인이 다리를 뻗고 누울 수 있는 길이")',
      '   · **옵션 차이가 곧 독자의 고민**입니다. 구성별로 무엇이 더 들었고 값이 얼마나 차이 나는지,',
      '     어떤 사람에게 어느 옵션이 맞는지 짚어주세요. 이게 이 글의 핵심 가치입니다.',
      '   · 배송·반품 조건에 불리한 점이 있으면 **숨기지 말고 먼저 말하세요.**',
      '     (해외직구라 오래 걸린다, 반품비가 비싸다 등 — 이걸 먼저 밝히는 글이 신뢰를 얻습니다)',
      '   · 써보지 않은 것을 써본 것처럼 쓰지 마세요. "제품 정보를 정리했다"는 태도로 쓰세요.',
    );
  }
  lines.push(
    '   · **가격은 위 API 상품 데이터의 값만** 쓰세요. 다른 곳의 가격은 옛날 값일 수 있습니다.',
    '=====',
  );
  return lines.join('\n');
}

/**
 * 페이지 제목에서 순수 상품명만 뽑는다. (v3.8.403)
 *
 * 실측 형태: "수영장 에어 탱크 물총 튜브 워터파크 물놀이 바닷가 - 대형/패밀리풀장 | 쿠팡"
 *   뒤의 " - 카테고리 | 쿠팡" 은 쿠팡이 붙이는 꼬리다. 제목 소재로 쓰면 어색해진다.
 */
export function cleanProductName(pageTitle: string): string {
  return String(pageTitle || '')
    .replace(/\s*\|\s*쿠팡\s*$/, '')
    .replace(/\s*-\s*[^-]{1,20}$/, '')     // " - 대형/패밀리풀장"
    .trim();
}
