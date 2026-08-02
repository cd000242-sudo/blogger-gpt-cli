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
 * ③ "핵심 바로가기" 버튼이 사용자 링크가 아니었다 (v3.8.416) → 완전히 뺐다 (v3.8.419)
 *
 * v3.8.416: 사용자 "핵심 바로가기도 내링크여야되는데 이것도 자동링크네" — 링크 출처를 고쳤다.
 * v3.8.419: 사용자 "핵심바로가기는 꺼주세요 이미지포함한 CTA를 배치해주시면됩니다
 *   이미지 보시면 중복이라 겹칩니다." — 링크는 맞았지만 insertCtaCards()가 만드는
 *   이미지+가격+버튼 카드와 완전히 중복이었다. 텍스트 버튼(topCtaHtml)을 아예 비운다.
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

  it('⭐ 쇼핑모드 + 링크가 있으면 일반 후보 로직도, 텍스트 CTA 렌더링도 타지 않는다 (v3.8.419)', () => {
    expect(shoppingCtaBlock).not.toContain('topCandidates');
    expect(shoppingCtaBlock).not.toContain('renderFinalCtaBlock');
  });

  it('⭐ 왜 뺐는지 — 이미지 CTA 카드와의 중복이 근거로 남아 있다', () => {
    expect(shoppingCtaBlock).toContain('중복');
    expect(shoppingCtaBlock).toContain('insertCtaCards');
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

/**
 * ⑥⑦ renderFinalCtaBlock 5개 호출부 전수 조사 — 두 곳이 더 새고 있었다 (v3.8.417)
 *
 * 사용자: "좀더 심층분석해서 완벽한 결과가나오게끔해줘" — 요청을 받고
 * renderFinalCtaBlock() 을 부르는 모든 지점을 다시 훑었다.
 *
 * 실측(Blogger API 로 갤럭시 Z Flip8 발행글 원문 재확인):
 *   class="cta-btn" 2개, 각각
 *   href="https://www.samsung.com/sec/search/?searchvalue=..."  (공식 사이트)
 *   href="https://plan.danawa.com/info/?nPlanSeq=..."           (가격비교 포털)
 * — 둘 다 사용자의 쿠팡 링크가 아니다.
 *
 * renderFinalCtaBlock 호출부는 그 시점 총 5곳이었다:
 *   ① sectionCta(본문 중간)   — v3.8.413 에서 이미 shopping 제외 완료
 *   ② topCta(글 맨 위)        — v3.8.416 에서 coupangLink 로 재연결 완료
 *   ③ 보충 CTA("최소 2개 보장") — adsense 만 제외, shopping 은 안 걸러졌다 ← 신규 발견
 *   ④ 하단 최종 CTA(글 끝 직전) — adsense 만 제외, shopping 은 안 걸러졌다 ← 신규 발견
 *
 * ③④ 는 renderedCtaUrls.size(=currentCtaCount)로 "CTA 가 부족한지"를 판단하는데,
 * 이 카운트는 insertCtaCards()(요약 직후·본문 중간·글 끝에 구매 버튼 3개를 넣는
 * 별도 메커니즘)를 전혀 보지 못한다. v3.8.413 에서 sectionCta 를 껐더니
 * currentCtaCount 가 더 자주 0에 가까워져 ③이 오히려 더 자주 발동하게 됐다 —
 * 앞선 수정이 이 문제를 더 잘 드러낸 셈이다.
 *
 * v3.8.418 추가 — ③ "보충 CTA" 는 Gemini Search Grounding(편당 ₩500~1,500)을 매 글
 *   자동으로 태웠다("글 5개만 써도 만원 가까이" 사용자 보고). 게다가 그 결과를 받는
 *   isRenderableCta()는 URL 형식만 보고 실제 살아있는지 확인하지 않는다 — Grounding만
 *   빼면 지어낸 URL이 검증 없이 나갈 위험이 있었다. 그래서 shopping/adsense 만 걸러내던
 *   구조를 버리고 **모든 모드에서 이 자동 검색-삽입 자체를 없앴다**. sectionCta(검증 포함)는
 *   그대로 살아 있어 손해가 크지 않다. 이 변경으로 renderFinalCtaBlock 호출부는 4곳으로 준다.
 */
describe('⑥⑦ 보충 CTA·하단 CTA 도 사용자 링크 아닌 곳으로 새지 않는다', () => {
  it('⭐ "보충 CTA"(최소 2개 보장) 자동 검색이 모든 모드에서 꺼졌다 (v3.8.418)', () => {
    const block = blockBetween(orch, "// 🔥 CTA 최소 2개 보장", "// 🔥 실행 플랜 섹션 제거됨");
    expect(block).toContain("if (contentMode === 'adsense') {");
    expect(block).toContain("} else if (contentMode === 'shopping') {");
    expect(block).toContain("} else if (currentCtaCount < 2) {");
    expect(block).toContain('보충 CTA 검색 생략');
  });

  it('⭐ 완전히 끈 근거(비용 위험 + 검증 안전망 부재)가 소스에 남아 있다', () => {
    const block = blockBetween(orch, "// 🔥 CTA 최소 2개 보장", "// 🔥 실행 플랜 섹션 제거됨");
    expect(block).toContain('비용 위험');
    expect(block).toContain('isCtaUrlShapeSafe');
  });

  it('adsense 는 여전히 별도 분기로 차단된다 (분기 순서가 안 깨졌다)', () => {
    const block = blockBetween(orch, "// 🔥 CTA 최소 2개 보장", "// 🔥 실행 플랜 섹션 제거됨");
    const adsenseIdx = block.indexOf("if (contentMode === 'adsense') {");
    const shoppingIdx = block.indexOf("} else if (contentMode === 'shopping') {");
    const restIdx = block.indexOf("} else if (currentCtaCount < 2) {");
    expect(adsenseIdx).toBeGreaterThan(-1);
    expect(shoppingIdx).toBeGreaterThan(adsenseIdx);
    expect(restIdx).toBeGreaterThan(shoppingIdx);
  });

  it('⭐ 다른 모드(외부유입 등)도 이제는 보충 검색을 하지 않는다 (v3.8.418 — 동작이 바뀐 지점)', () => {
    const block = blockBetween(orch, "// 🔥 CTA 최소 2개 보장", "// 🔥 실행 플랜 섹션 제거됨");
    expect(block).toContain('currentCtaCount < 2');
    expect(block).not.toContain('Gemini로 CTA 관련 URL 심층 검색');
    expect(block).not.toContain('callGeminiWithGrounding');
    expect(block).toContain('sectionCta 로 충분');
  });

  it('⭐ "하단 최종 CTA"(글이 끝나기 직전)가 쇼핑모드에서 생략된다', () => {
    const block = blockBetween(orch, "// 💰 하단 최종 CTA 버튼", "💎 백서 컨테이너 닫기");
    expect(block).toContain("if (contentMode === 'shopping') {");
    expect(block).toContain('하단 CTA 생략');
  });

  it('⭐ 하단 CTA 도 insertCtaCards 와의 중복이 근거로 남아 있다', () => {
    const block = blockBetween(orch, "// 💰 하단 최종 CTA 버튼", "💎 백서 컨테이너 닫기");
    expect(block).toContain('insertCtaCards');
  });

  it('adsense 도 여전히 하단 CTA 가 없다 — shopping 분기가 adsense 분기를 가리지 않는다', () => {
    const block = blockBetween(orch, "// 💰 하단 최종 CTA 버튼", "💎 백서 컨테이너 닫기");
    // 구조: if (shopping) { 생략 } else if (contentMode !== 'adsense') { 렌더링 }
    // → adsense 는 두 조건 모두 해당 없어 렌더링 분기에 못 들어간다.
    expect(block).toContain("if (contentMode === 'shopping') {");
    expect(block).toContain("} else if (contentMode !== 'adsense') {");
    const shoppingAt = block.indexOf("if (contentMode === 'shopping') {");
    const elseAt = block.indexOf("} else if (contentMode !== 'adsense') {");
    expect(elseAt).toBeGreaterThan(shoppingAt);
  });

  it('일반 모드는 하단 CTA 를 그대로 렌더링한다 (동작을 안 바꾼다)', () => {
    const block = blockBetween(orch, "// 💰 하단 최종 CTA 버튼", "💎 백서 컨테이너 닫기");
    expect(block).toContain('마무리 추천');
    expect(block).toContain('finalCandidates');
  });

  it('⭐ renderFinalCtaBlock 호출부가 3곳으로 줄었다 (v3.8.418~419)', () => {
    // v3.8.417 까지 5곳: ①sectionCta ②topCta(일반) ②'topCta(쇼핑) ③보충CTA ④하단최종CTA
    //   (②가 일반/쇼핑 두 분기로 나뉘어 있어 5곳이었다)
    // v3.8.418: ③ 보충 CTA(자동 검색) 삭제 → 4곳.
    // v3.8.419: ②'topCta(쇼핑, 텍스트 버튼)를 insertCtaCards()의 이미지 카드와 중복이라 삭제 → 3곳.
    //   남은 3곳: sectionCta, topCta(일반 모드 전용), 하단 최종 CTA.
    const callSites = (orch.match(/renderFinalCtaBlock\(\{/g) || []).length;
    expect(callSites).toBe(3);
  });
});

/**
 * ⑧ generateCTAsFinal 이 쇼핑 글에서 쓰지도 않을 CTA 를 유료로 찾아오고 있었다 (v3.8.417)
 *
 * generateCTAsFinal 의 "쇼핑 모드 CTA 특화 지시" 프롬프트를 보면, 애초에
 * "쿠팡/네이버쇼핑/브랜드 공식몰/다나와 등"을 **일부러** 찾도록 설계돼 있었다.
 * 실측 danawa.com·samsung.com CTA 가 바로 이 지시의 결과물이었다.
 * 그런데 v3.8.413 이후 쇼핑 글은 sectionCta 를 렌더링하지 않는다 —
 * 즉 Gemini Search Grounding 까지 불러서 찾아온 결과를 매번 버리고 있었다.
 */
describe('⑧ 쇼핑 글은 안 쓸 CTA 를 검색하지 않는다 (비용 절감)', () => {
  const generationSrc = read('src', 'core', 'final', 'generation.ts');

  it('⭐ generateCTAsFinal 이 쇼핑 모드에서 즉시 빈 배열을 반환한다', () => {
    const block = blockBetween(
      generationSrc,
      'export async function generateCTAsFinal(',
      "console.log(`[CTA] 🌐 Search Grounding으로",
    );
    expect(block).toContain("if (contentMode === 'shopping') {");
    expect(block).toContain('return [];');
  });

  it('⭐ 왜 버려지고 있었는지 근거가 남아 있다 (sectionCta 가 렌더링 안 됨)', () => {
    const block = blockBetween(
      generationSrc,
      'export async function generateCTAsFinal(',
      "console.log(`[CTA] 🌐 Search Grounding으로",
    );
    expect(block).toContain('한 번도 렌더링되지 않는다');
  });

  it('쇼핑 모드 전용 프롬프트 지시가 다나와/공식몰을 유도하고 있었다는 사실이 남아 있다', () => {
    expect(generationSrc).toContain('다나와');
    expect(generationSrc).toContain('브랜드 공식몰');
  });

  it('adsense 는 여전히 먼저 차단된다 (분기 순서가 안 깨졌다)', () => {
    const adsenseIdx = generationSrc.indexOf("if (contentMode === 'adsense') {");
    const shoppingIdx = generationSrc.indexOf('쇼핑 모드 — 본문 CTA 는 사용자 제휴 링크만 쓴다');
    expect(adsenseIdx).toBeGreaterThan(-1);
    expect(shoppingIdx).toBeGreaterThan(adsenseIdx);
  });

  it('다른 모드(내부·페러프레이징 등)는 여전히 Gemini 검색을 탄다 (동작을 안 바꾼다)', () => {
    expect(generationSrc).toContain('📝 **내부 정보 전달 모드 CTA 특화 지시**');
    expect(generationSrc).toContain('🔄 **페러프레이징 모드 CTA 특화 지시**');
  });
});

/**
 * ⑨ 이미지 포함 CTA 카드가 대가성 문구보다 위로 꽂히던 버그 (v3.8.419)
 *
 * 사용자: "공정위 문구는 항상 제일 상단에 올라가야되구요" — 실측 스크린샷에서
 *   "최저가 확인하고 구매하기" 카드(이미지+가격+버튼)가 대가성 문구보다도 위,
 *   글의 맨 첫머리에 떠 있었다.
 *
 * 원인 — insertCtaCards()의 "③ 글 끝" 로직은 "대가성 문구 바로 앞에 넣는다"였다.
 *   이건 고지문이 글 끝에 있던 시절(v3.8.375 이전) 얘기다. v3.8.375부터 고지문은
 *   항상 H1 바로 뒤(최상단)로 고정됐는데, v3.8.417에서 이 검색 정규식이
 *   "coupang-disclosure" 클래스까지 넓게 잡도록 고쳐지면서 — 이제 "글 끝" 카드가
 *   최상단 고지문 바로 앞, 즉 글의 첫머리에 꽂히게 됐다.
 *
 * 고침 — 고지문 위치를 더 이상 찾지 않는다. "글 끝" 카드는 무조건 HTML 맨 끝에 붙는다.
 */
describe('⑨ 이미지 CTA 카드가 대가성 문구 위로 올라가지 않는다', () => {
  const ctaCardSrc = read('src', 'core', 'affiliate', 'cta-card.ts');
  const insertBlock = blockBetween(ctaCardSrc, 'export function insertCtaCards(', 'export function providerLabel(');

  it('⭐ "글 끝" 카드는 더 이상 대가성 문구 위치를 검색하지 않는다', () => {
    expect(insertBlock).not.toContain('discIdx');
    expect(insertBlock).not.toContain('affiliate|coupang');
  });

  it('⭐ 실측 재현 — 대가성 문구가 이미 최상단에 있어도 카드는 그 앞이 아니라 진짜 끝에 붙는다', () => {
    const disclosureP = '<p class="coupang-disclosure">이 포스팅은 쿠팡 파트너스 활동의 일환으로...</p>';
    const html = [
      disclosureP,
      '<h2>1. 첫 섹션</h2><p>본문</p>',
      '<h2>2. 둘째 섹션</h2><p>본문</p>',
    ].join('\n');
    const { insertProductCtaCards } = requireInsertCtaCards();
    const result = insertProductCtaCards(html, {
      name: '테스트 상품', priceKrw: 10000, imageUrl: 'https://example.com/a.png',
      url: 'https://coupa.ng/abc', provider: null,
    });
    // 카드가 대가성 문구 앞이 아니라, 대가성 문구보다 뒤(진짜 끝)에 나와야 한다
    const discIdx = result.html.indexOf('coupang-disclosure');
    const cardIdx = result.html.lastIndexOf('data-orbit-cta');
    expect(cardIdx).toBeGreaterThan(discIdx);
  });

  it('⭐ "요약 직후" 카드는 TOP_SUMMARY_CTA_PLACEHOLDER가 아직 안 풀린 시점에도 자리를 잡는다', () => {
    // orchestration.ts는 insertCtaCards()를 요약/서론이 TOP_SUMMARY_CTA_PLACEHOLDER에
    // 실제로 끼워지기 전에 부른다 — 그래서 "핵심 요약" 헤딩 텍스트 검색은 항상 실패한다.
    // 그 대체 앵커(자리표시자 자체)가 남아 있는지 확인한다.
    expect(insertBlock).toContain("TOP_SUMMARY_CTA_PLACEHOLDER");
    expect(insertBlock).toContain('placeholderIdx');
  });
});

function requireInsertCtaCards() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../src/core/affiliate/cta-card');
  return { insertProductCtaCards: mod.insertCtaCards };
}
