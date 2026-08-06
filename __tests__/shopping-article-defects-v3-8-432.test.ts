/**
 * 실제 토스 발행글에서 나온 결함 6건 (v3.8.432)
 *
 * 사용자 실측 보고(2026-08-03, 토스 쉐어링크로 발행한 글):
 *   ① "토스로했는데 쿠팡 공정위 문구가 하드코딩되어있는것같네요 없애주세요
 *      네이버 브랜드커넥트에서도 마찬가지입니다."
 *   ② "CTA 사진 우측에 제품명이 중복인데 수정안했네요 수정해주시고 중앙으로 정렬"
 *   ③ "H3도 박스로 감싸달라니까 언제 감쌀 건가요?? 박스 테투리 선은 두껍게"
 *   ④ "생성된 이미지는 크고 차량·집에 놓는 용도인데 실제는 작고 목에걸거나 옷에 착용"
 *   ⑤ "용도별 비교기준의 본문이 또빠져있네요 … 장바구니 가격 확인도 빠져있구요"
 *   ⑥ "소개한 상품은 … 아래에 얘를 없애버리고 상품보러가기를 다른 CTA처럼 중앙에 크게"
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';
import { dedupeProductNote } from '../src/core/affiliate/cta-card';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const gen = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'generation.ts'), 'utf8');
const gemini = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'gemini-engine.ts'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'html.ts'), 'utf8');
const cta = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'cta-card.ts'), 'utf8');
const render = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'render.ts'), 'utf8');

describe('① 쿠팡 고지문은 쿠팡 글에만 넣는다', () => {
  it('⭐ isCoupangArticle 판정이 있다 — 고른 제휴사 우선, 없으면 기존 방식', () => {
    // v3.8.436: 판정을 **제휴 링크 파싱 직후 한 곳**으로 모았다.
    //   예전엔 렌더 시점에서 다시 계산해, 그보다 앞선 쿠팡 상품 검색은 못 막았다
    //   (실측 로그: 토스 글인데 "쿠팡 상품 5개 수집 완료").
    expect(orch).toContain('const isCoupangArticle = explicitProvider');
    expect(orch).not.toContain('let isCoupangArticle = false;');
    expect(orch).toContain("explicitProvider === 'coupang'");
    /**
     * v3.8.465 — 여기에 **쇼핑 모드 조건이 붙었다.**
     *
     * 예전 판정은 `!hasSpecificProductLink`(제휴 링크가 하나도 없음)만 봤다.
     * 그 조건은 쇼핑 모드에서 "링크는 없지만 키워드로 찾은 쿠팡 상품이 수익원"
     * 이라는 뜻이었는데, 정보성 글·애드센스 글도 링크가 없으니 그대로 참이 됐다.
     * 사용자 지적: "왜 어떤모드이든 쿠팡 공정위 문구가 하드코딩되어있나요??"
     */
    expect(orch).toContain('(!!coupangLink || (isCoupangShoppingMode && !hasSpecificProductLink))');
  });

  it('⭐ 쿠팡 글이 아니면 쿠팡 상품 위젯도 안 그린다', () => {
    expect(orch).toContain('const hasProducts = isCoupangArticle && Array.isArray(coupangProducts)');
  });

  it('⭐ 링크만 있는 경로도 쿠팡 글일 때만 고지문을 넣는다', () => {
    expect(orch).toContain('} else if (isCoupangArticle && coupangLink) {');
  });

  it('토스/네이버 고지문 경로(enforceAffiliateCompliance)는 그대로 살아 있다', () => {
    expect(orch).toContain('enforceAffiliateCompliance(html,');
  });
});

describe('②⑥ 상품명 중복 제거 + 중앙 정렬', () => {
  it('⭐ 설명이 상품명으로 시작하면 겹치는 앞부분을 떼어낸다', () => {
    const name = '몽크로스 초강력 바디팬, 다크그레이, 2개';
    const desc = '몽크로스 초강력 바디팬, 다크그레이, 2개, 리뷰 5개 · 평점 4.6점. 모레 도착 예정';
    expect(dedupeProductNote(desc, name)).toBe('리뷰 5개 · 평점 4.6점. 모레 도착 예정');
  });

  it('⭐ 설명이 상품명과 완전히 같으면 아예 표시하지 않는다', () => {
    const name = '몽크로스 초강력 바디팬';
    expect(dedupeProductNote(name, name)).toBe('');
  });

  it('떼고 남은 게 너무 짧으면 표시하지 않는다 (의미 없는 꼬리)', () => {
    expect(dedupeProductNote('상품명 A, 2개', '상품명 A')).toBe('');
  });

  it('상품명으로 시작하지 않으면 그대로 둔다', () => {
    expect(dedupeProductNote('무료배송 · 당일출고', '몽크로스 바디팬')).toBe('무료배송 · 당일출고');
  });

  it('빈 값에도 죽지 않는다', () => {
    expect(dedupeProductNote('', '이름')).toBe('');
    expect(dedupeProductNote('설명', '')).toBe('설명');
  });

  it('⭐ CTA 카드가 중복 제거를 실제로 쓴다', () => {
    const fn = braceBlock(cta, 'export function renderProductCtaCard(');
    expect(fn).toContain('dedupeProductNote(String(product.note');
  });

  it('⭐ CTA 카드가 가운데 정렬이다', () => {
    const fn = braceBlock(cta, 'export function renderProductCtaCard(');
    expect(fn).toContain('text-align:center');
    // 예전 좌측 정렬 flex 레이아웃이 남아 있으면 안 된다
    expect(fn).not.toContain('flex:1 1 220px');
  });

  it('⭐ 소개한 상품 위젯도 중복 제거 + 가운데 정렬 + 큰 버튼', () => {
    const fn = braceBlock(render, 'export function renderAffiliateProductBlock(');
    expect(fn).toContain('dedupeProductNote(String(p.description');
    expect(fn).toContain('text-align:center');
    // 작은 인라인 버튼이 아니라 폭 전체 큰 버튼
    expect(fn).toContain('display:block;background:#2563eb');
    expect(fn).not.toContain('display:inline-block;background:#3b82f6');
  });
});

describe('③ H3 박스 + 두꺼운 테두리', () => {
  it('⭐ H3 인라인 스타일이 더 이상 배경·테두리를 죽이지 않는다 (이게 원인이었다)', () => {
    const block = blockBetween(orch, 'const h3Palette = [', '// 💰 본문 —');
    expect(block).toContain('border:3px solid ${tone.bd} !important');
    expect(block).toContain('background:${tone.bg} !important');
    // 예전에 CSS 를 죽이던 선언이 남아 있으면 안 된다
    expect(block).not.toContain('background:none !important;border:none !important');
  });

  it('⭐ 색은 글 전체를 관통하는 카운터로 돈다 (같은 글에서 튀지 않게)', () => {
    expect(orch).toContain('let h3BoxCounter = 0;');
    expect(orch).toContain('h3Palette[h3BoxCounter % h3Palette.length]');
    expect(orch).toContain('h3BoxCounter += 1;');
  });

  it('⭐ 사진 클릭 안내문이 박스로 감싸진다', () => {
    expect(orch).toContain('📸 이 글의 사진을 누르면');
    const idx = orch.indexOf('const imageClickNotice =');
    const line = blockBetween(orch, 'const imageClickNotice =', '\n');
    expect(idx).toBeGreaterThan(-1);
    expect(line).toContain('border:3px solid');
    // 예전엔 그냥 <p> 한 줄이었다
    expect(line).not.toContain('<p style="font-size:13px');
  });

  it('⭐ 본문 콘텐츠 박스 테두리가 두꺼워졌다', () => {
    for (const color of ['#fecaca', '#bbf7d0', '#bae6fd', '#fde047']) {
      expect(html).toContain(`border: 3px solid ${color} !important;`);
    }
  });

  it('인용 박스도 두껍다', () => {
    expect(html).toContain('border: 3px solid #1a1a1a !important;');
  });
});

describe('④ AI 이미지가 실제 제품 특성을 따른다', () => {
  it('⭐ 상세 이미지에서 읽은 사실을 이미지 프롬프트용으로 남긴다', () => {
    expect(orch).toContain('(payload as any).detailImageFacts = allFacts.slice(0, 8);');
  });

  it('⭐ 이미지 프롬프트가 상품명 외에 실제 특징을 함께 넘긴다', () => {
    expect(orch).toContain('const visionFacts = ((payload as any).detailImageFacts || []) as string[];');
    expect(orch).toContain('const prodDesc = String((payload as any).affiliateProducts?.[0]?.description');
    expect(orch).toContain('이 제품의 실제 특징:');
  });

  it('⭐ 크기·용도를 바꾸지 말라고 못 박는다 (사용자가 겪은 바로 그 문제)', () => {
    expect(orch).toContain('크기·착용 방식·사용 장소');
    expect(orch).toContain('실제보다 크게 그리거나 용도를 바꾸지 마세요');
  });

  it('특징이 없으면 예전처럼 상품명만 넘긴다 (없는 걸 지어내지 않는다)', () => {
    expect(orch).toContain('const traitLine = traits.length');
  });
});

describe('⑤ 본문이 빈 채로 나가지 않는다', () => {
  it('⭐ 출력 토큰 상한을 올렸다 — 잘림이 근본 원인이었다', () => {
    // v3.8.433: 두 경로가 같은 함수를 쓰도록 바꿨다 (한쪽만 올리는 실수 방지)
    expect(gemini).toContain("envInt('GEMINI_MAX_OUTPUT_TOKENS', 32768)");
    expect(gemini).toContain('maxOutputTokens: resolveMaxOutputTokens()');
    // 예전 고정값이 남아 있으면 안 된다
    expect(gemini).not.toContain('maxOutputTokens: 16384');
  });

  it('⭐ 그래도 비면 그 소제목만 다시 채운다 (전체 재생성 아님)', () => {
    expect(gen).toContain('빈 소제목');
    expect(gen).toContain('const repairPrompt = [');
    expect(gen).toContain('아래 소제목들의 **본문만** 작성하세요');
  });

  it('⭐ 채운 내용이 여전히 부실하면 반영하지 않는다', () => {
    expect(gen).toContain('if (!t || textLength(body) < 50) continue;');
  });

  it('⭐ 수리 실패가 발행을 막지 않는다', () => {
    expect(gen).toContain('빈 소제목 보충 실패 (계속 진행)');
  });

  it('보강 결과 검증(v3.8.430)은 그대로 살아 있다', () => {
    expect(gen).toContain('const candidate = safeParseJson(improvedJson);');
    expect(gen).toContain('emptyContentCount(candidate) > emptyContentCount(allSectionsObj)');
  });
});
