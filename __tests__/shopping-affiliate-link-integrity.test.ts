/**
 * 쇼핑 글이 사용자의 링크가 아닌 다른 곳으로 새고 있었다 (v3.8.416)
 *
 * 사용자가 실제 발행된 글(갤럭시 Z Flip8 자급제 512GB 업그레이드) 스크린샷으로 지적한 4가지.
 * 전부 API 로 실제 발행글 HTML 을 뜯어 원인을 확인한 뒤 고쳤다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { normalizeParagraphs } from '../src/core/final/paragraph-normalizer';
import { braceBlock, blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const orch = read('src', 'core', 'final', 'orchestration.ts');
const sections = read('src', 'core', 'max-mode', 'mode-sections-extended.ts');

/**
 * ① 대가성 문구가 본문 첫 문장과 한 문단으로 합쳐졌다 (v3.8.416)
 *
 * 사용자: "이 문구는 제일 최상단으로 가야되는데 왜 여기에있니??
 *          그리고 h3따로 본문 따로 박스로 감싸줘야지 같이감쌋네??
 *          그리고 엉뚱하게 빨간색상 박스는 왜있는거니?"
 *
 * 실측(Blogger API 로 발행글 원문 확인):
 *   <p class="coupang-disclosure" ...>이 포스팅은 쿠팡 파트너스... 제공받습니다.<br>
 *   스마트폰 저장 공간은 부족해진 뒤에야...</p>
 *   <p class="coupang-disclosure" ...>촬영한 사진과 영상...</p>
 *
 * 원인 — 클래스명이 갈라져 있었다. compliance.ts(토스·네이버 등)는 "affiliate-disclosure"를
 *   쓰는데 coupang-partners.ts(쿠팡 전용)는 "coupang-disclosure"를 쓴다.
 *   paragraph-normalizer 의 "짧은 문단은 다음 문단과 합친다" 가드는 앞의 것만 알고 있어서
 *   쿠팡 고지문(40자 안팎, minChars=60 미만)이 본문 첫 문장과 강제로 합쳐졌고,
 *   합쳐진 문단이 길어 다시 쪼개지며 **두 번째 문단까지 고지문의 빨간 배경을 물려받았다**
 *   — 이게 "엉뚱한 빨간 박스"의 정체였다.
 */
describe('① 대가성 문구가 본문과 합쳐지지 않는다', () => {
  const disclosureP = '<p class="coupang-disclosure" style="color:#c62828;background:#fff5f5;">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>';

  it('⭐ 실측 재현 — 고지문 뒤에 짧은 본문 문단이 와도 합쳐지지 않는다', () => {
    const html = [
      disclosureP,
      '<h3>1-1. 용량 업그레이드 판단</h3>',
      '<p>스마트폰 저장 공간은 부족해진 뒤에야 중요성을 크게 느끼게 되는 항목이에요.</p>',
    ].join('\n');
    const r = normalizeParagraphs(html);
    expect((r.html.match(/class="coupang-disclosure"/g) || []).length).toBe(1);
    // 고지문 뒤에 본문 문장이 바로 붙어 있으면 안 된다(같은 <p> 안에 섞이면 안 된다)
    const discIdx = r.html.indexOf('class="coupang-disclosure"');
    const discClose = r.html.indexOf('</p>', discIdx);
    expect(r.html.slice(discIdx, discClose)).not.toContain('스마트폰');
  });

  it('⭐ 빨간 배경이 본문 문단에 번지지 않는다', () => {
    const html = [disclosureP, '<p>본문 첫 문장입니다.</p>'].join('\n');
    const r = normalizeParagraphs(html);
    // 고지문이 아닌 <p> 는 coupang-disclosure 클래스를 갖지 않는다
    const bodyP = r.html.split('\n').find((l) => l.includes('본문 첫 문장'));
    expect(bodyP).toBeDefined();
    expect(bodyP).not.toContain('coupang-disclosure');
  });

  it('일반(토스·네이버) 고지문 가드는 그대로 유지된다', () => {
    const html = '<p class="affiliate-disclosure">토스 제휴 고지문입니다.</p>\n<p>다음 문단.</p>';
    const r = normalizeParagraphs(html);
    expect((r.html.match(/class="affiliate-disclosure"/g) || []).length).toBe(1);
  });

  it('⭐ 소스에 두 클래스명이 모두 보호 대상으로 등록돼 있다', () => {
    const normSrc = read('src', 'core', 'final', 'paragraph-normalizer.ts');
    expect(normSrc).toContain('affiliate-disclosure|coupang-disclosure|data-orbit-cta');
  });
});

/**
 * ② "추천 상품 한눈에 보기"에 다른 상품이 섞였다 (v3.8.416)
 *
 * 사용자: "추천상품 한눈에보기는 다른 추천상품도 같이 뒀던데 이렇게하면
 *          지금 소개하는 상품말고 다른상품으로 유도하는 꼴이고
 *          내 링크를 안누르고 추천상품을 누르는 경우가 생기잖아"
 *
 * 원인 — payload.coupangProducts 를 두 곳에서 채웠다:
 *   ① H2 제목을 짜는 시점 — keyword 로 쿠팡 **텍스트 검색** → 최대 10개 '비슷한 상품'
 *   ② 그 뒤 3단계 시스템 — 1순위 사용자 링크 크롤링 → 2순위 키워드 검색 → 3순위 가드
 * ①이 먼저 coupangProducts 를 채워버리면 ②의 1순위 가드
 *   `if (manualUrls.length > 0 && !coupangProducts)` 가 거짓이 되어
 *   **사용자가 넣은 링크를 크롤링하는 코드가 통째로 스킵됐다.**
 */
describe('② 사용자 링크 크롤링이 더 이상 스킵되지 않는다', () => {
  it('⭐ 얼리 키워드 검색 블록이 제거됐다', () => {
    // 예전엔 37%/38% 로그로 "H2 제목 시점"에 키워드 검색이 또 돌았다 —
    // 3단계 시스템(41%/42%)과 중복이었고, coupangProducts 를 먼저 채워 1순위를 막았다.
    expect(orch).not.toContain("[PROGRESS] 37% - 🛒 쿠팡 파트너스 API: 실제 상품 데이터 조회 중...");
    expect(orch).not.toContain("[PROGRESS] 38% - ✅ 쿠팡 상품 ${products.length}개 수집 완료 (할루시네이션 방지)");
  });

  it('⭐ 왜 지웠는지 근거가 소스에 남아 있다', () => {
    const block = blockBetween(orch, "} else if (contentMode === 'shopping') {", "// 🛡️ 쿠팡 실제 데이터가 없으면");
    expect(block).toContain('1순위 가드');
    expect(block).toContain('사용자가 넣은 링크를 크롤링하는 코드가 통째로 스킵됐다');
  });

  it('⭐ 3단계 시스템(수동 URL 우선)은 그대로 살아 있다', () => {
    expect(orch).toContain('1순위: 사용자 수동 입력 URL');
    expect(orch).toContain('manualUrls.length > 0 && !(payload as any).coupangProducts');
    expect(orch).toContain('crawlCoupangProductsFromUrls(manualUrls');
  });

  it('실제 상품 데이터를 프롬프트에 주는 기능 자체는 남아 있다 (2순위에서)', () => {
    expect(orch).toContain('2순위: API 키 있는 경우 자동 검색');
    expect(orch).toContain('formatProductsForPrompt(products)');
  });
});

/**
 * ③ "핵심 바로가기" 버튼이 사용자 링크가 아니었다 (v3.8.416)
 *
 * 사용자: "핵심 바로가기도 내링크여야되는데 이것도 자동링크네"
 *
 * 원인 — topCta(글 맨 위 "핵심 바로가기" 버튼)는 ctas/supplementalCtas
 *   (검색·크롤링으로 찾은 일반 URL)에서 후보를 골랐다. v3.8.413 에서 본문 중간
 *   CTA(sectionCta)는 이미 쇼핑모드에서 껐는데, 이 상단 CTA는 같은 문제를 놓쳤다.
 */
describe('③ "핵심 바로가기"가 사용자의 제휴 링크를 가리킨다', () => {
  // ⚠️ braceBlock 은 if/else-if/else 사슬을 "같은 구문"으로 보고 뒤이은 else 블록까지
  //   이어 붙인다(의도된 동작 — } catch/else/finally { 는 한 문장이다). 그래서 여기서는
  //   "다음 else 블록 직전까지"로 정확히 자르는 blockBetween 을 쓴다.
  const shoppingCtaBlock = blockBetween(
    orch,
    "} else if (contentMode === 'shopping' && coupangLink) {",
    '} else {',
  );

  it('⭐ 쇼핑모드 + 링크가 있으면 일반 후보 로직을 타지 않는다', () => {
    expect(shoppingCtaBlock).toContain('url: coupangLink');
    expect(shoppingCtaBlock).not.toContain('topCandidates');
  });

  it('⭐ coupangLink 는 사용자가 입력한 원본 그대로다 (가공하지 않는다)', () => {
    expect(shoppingCtaBlock).toContain('사용자가 입력한 그대로의 원본 링크');
  });

  it('⭐ 제휴 링크이므로 sponsored 를 명시한다', () => {
    expect(shoppingCtaBlock).toContain("rel: 'nofollow sponsored noopener'");
  });

  it('⭐ renderFinalCtaBlock 이 rel 오버라이드를 지원한다 (기본값은 그대로)', () => {
    // 시그니처 자체에 타입 리터럴 중괄호(input: { ...; rel?: string; })가 있어
    // braceBlock 이 그걸 본문으로 오인한다 — 다음 함수 선언까지로 경계를 잡는다.
    const block = blockBetween(orch, 'function renderFinalCtaBlock(', 'function normalizeArticleBodySpacing(');
    expect(block).toContain("input.rel || 'nofollow noopener noreferrer'");
  });

  it('다른 모드는 기존 후보 로직을 그대로 쓴다 (동작을 안 바꾼다)', () => {
    // 새 쇼핑 전용 분기 "다음" else 블록에 기존 일반 후보 로직이 그대로 남아 있어야 한다
    const afterShoppingBranch = orch.slice(
      orch.indexOf("} else if (contentMode === 'shopping' && coupangLink) {"),
    );
    const fallbackBlock = afterShoppingBranch.slice(0, afterShoppingBranch.indexOf('end of non-adsense CTA block'));
    expect(fallbackBlock).toContain('topCandidates');
  });

  it('애드센스 모드는 여전히 상단 CTA 를 차단한다 (분기 순서가 안 깨졌다)', () => {
    expect(orch).toContain("if (contentMode === 'adsense') {");
    const adsenseIdx = orch.indexOf("if (contentMode === 'adsense') {");
    const shoppingIdx = orch.indexOf("} else if (contentMode === 'shopping' && coupangLink) {");
    expect(shoppingIdx).toBeGreaterThan(adsenseIdx);
  });
});

/**
 * ④⑤ 후기 0건을 단점으로 잘못 추론하고, 실제 후기가 프롬프트에 안 실렸다 (v3.8.416)
 *
 * 사용자: "이건 사전구매라서 후기가 당연히없고 스펙을 보고 단점과 장점을 설명해줘야되는데
 *          후기없으니까 후기없는게 단점이다라고 하는데 이건 추론이 문제있는거같은데??
 *          누가봐도 ai로 적은느낌이자나 … 후기가없으면 신상품인지,사전구매인지,
 *          후기가원래없는 상품인지 추론을해서 제품을 제대로 인지하고 작성해야되자나
 *          그리고 전혀 프롬프트를 안타는것같아"
 *
 * 원인 두 가지:
 *   · SHOPPING_CONVERSION_MODE_SECTIONS 의 'real_reviews'/'honest_cons' 섹션이
 *     후기 유무와 무관하게 "실제 구매 후기 카드 3개 이상(별점 포함)"을 무조건 요구했다.
 *   · coupang-enrich.ts 의 formatEnrichmentForPrompt() — 후기 0건을 정확히 다루도록
 *     이미 잘 설계돼 있었다("후기가 있는 것처럼 쓰지 마세요") — 를 부르는 코드가
 *     드문 "2순위 API 구제" 경로에만 있어서, 실제로 모은 후기·스펙이
 *     본문을 쓰는 프롬프트에는 거의 실리지 않았다.
 */
describe('④⑤ 후기 0건을 단점으로 추론하지 않고, 실제 데이터를 프롬프트에 싣는다', () => {
  it('⭐ 후기가 없으면 real_reviews 섹션이 후기 카드를 요구하지 않는다', () => {
    const block = braceBlock(orch, "if (hasNoReviews && sec.id === 'real_reviews') {");
    expect(block).toContain('지어내지 마세요');
    expect(block).toContain('왜 0건인지 판단');
    expect(block).toContain('신상품인지');
    expect(block).toContain('사전구매');
  });

  it('⭐ "후기 없음"을 단점으로 쓰지 말라고 명시한다', () => {
    const block = braceBlock(orch, "if (hasNoReviews && sec.id === 'real_reviews') {");
    expect(block).toContain('"후기가 없다" 자체는 단점이 아닙니다');
  });

  it('⭐ honest_cons 섹션도 "후기 없음"을 단점으로 쓰지 않는다', () => {
    const block = braceBlock(orch, "} else if (hasNoReviews && sec.id === 'honest_cons') {");
    expect(block).toContain('스펙·구조상 트레이드오프');
    expect(block).toContain('"후기가 없다/적다"를 단점으로 쓰지 마세요');
  });

  it('⭐ 원본 정적 템플릿을 변형 없이 그대로 두지 않는다 (사본만 바꾼다)', () => {
    // sec.requiredElements 를 직접 mutate 하면 다음 글에도 영향이 새어나간다
    const block = braceBlock(orch, 'const guides = SHOPPING_CONVERSION_MODE_SECTIONS.map((sec, idx) => {');
    expect(block).toContain('let reqs = sec.requiredElements');
    expect(block).not.toMatch(/sec\.requiredElements\s*=/);
  });

  it('⭐ 실제 후기·스펙 원문을 프롬프트에 싣는다 — 이전엔 이 호출이 없었다', () => {
    const block = blockBetween(orch, "// 섹션별 상세 지시 주입", "} else if (contentMode === 'paraphrasing')");
    expect(block).toContain('formatEnrichmentForPrompt');
    expect(block).toContain('shoppingEnrichment');
  });

  it('반영 실패해도 발행은 계속된다', () => {
    const block = blockBetween(orch, "if (shoppingEnrichment) {", "// 🛡️ 쿠팡 실제 데이터가 없으면");
    expect(block).toContain('catch { /* 반영 실패해도 발행은 계속된다 */ }');
  });

  it('후기가 있으면(reviewCount > 0) 원래의 후기 카드 지시를 그대로 쓴다', () => {
    // hasNoReviews 는 reviewCount === 0 일 때만 참이다 — 후기가 있으면 원본 유지
    expect(orch).toContain('const hasNoReviews = reviewCount === 0;');
  });
});

/**
 * formatEnrichmentForPrompt 자체 동작 확인 — 이미 잘 설계돼 있었음을 실측으로 재확인
 */
describe('formatEnrichmentForPrompt — 후기 0건을 정직하게 다룬다', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { formatEnrichmentForPrompt } = require('../src/core/affiliate/coupang-enrich');

  it('⭐ 후기 0건이면 있는 것처럼 쓰지 말라고 지시한다', () => {
    const block = formatEnrichmentForPrompt({
      productId: '1', pageTitle: '', reviews: [], totalReviewCount: 0,
      specs: ['용량: 512GB'], options: ['256GB', '512GB'], policy: [],
      imageUrl: '', verified: true, note: '',
    });
    expect(block).toContain('후기가 있는 것처럼 쓰지 마세요');
    expect(block).toContain('스펙 (확인된 사실)');
  });

  it('아무 데이터도 없으면 빈 문자열 (프롬프트에 빈 섹션을 넣지 않는다)', () => {
    expect(formatEnrichmentForPrompt(null)).toBe('');
    expect(formatEnrichmentForPrompt({
      productId: '1', pageTitle: '', reviews: [], totalReviewCount: 0,
      specs: [], options: [], policy: [], imageUrl: '', verified: true, note: '',
    })).toBe('');
  });
});

describe('섹션 템플릿 정의 자체 확인', () => {
  it('real_reviews/honest_cons 섹션 id 가 여전히 존재한다 (마커가 깨지지 않았다)', () => {
    expect(sections).toContain('id: "real_reviews"');
    expect(sections).toContain('id: "honest_cons"');
  });
});
