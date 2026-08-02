/**
 * 제휴 상품 카드 렌더 + orchestration/UI 배선 (v3.8.396)
 *
 * ⚠️ 이 파일이 지키는 핵심 2가지
 *   1. **가격을 지어내지 않는다.** 실측(2026-08-01) 토스쇼핑은 웹에 가격을 노출하지 않는다.
 *      쿠팡 렌더러는 가격 0이면 "가격 확인"으로 때웠지만, 제휴 카드는 가격 줄 자체를 뺀다.
 *   2. **링크를 변조하지 않는다.** 토스 정책: "제공하지 않은 링크를 임의로 수정하면 계약 해지."
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  renderAffiliateProductBlock, formatAffiliateProductsForPrompt,
} from '../src/core/affiliate/render';
import type { AffiliateProduct } from '../src/core/affiliate/crawl';
import { braceBlock, blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => {
  try { return fs.readFileSync(path.join(ROOT, ...p), 'utf8'); } catch { return ''; }
};

const naverProduct: AffiliateProduct = {
  provider: 'naver-shopping-connect',
  originalUrl: 'https://naver.me/I5wXXXX',
  resolvedUrl: 'https://smartstore.naver.com/singlegadget/products/13655762284?NaPm=ct%3Dx',
  title: '삼성 갤럭시 Z폴드8 1TB 자급제',
  imageUrl: 'https://shop-phinf.pstatic.net/x.jpg',
  description: '삼성전자 공식 파트너',
  priceKrw: 3152600,
  priceNote: '',
};

const tossProduct: AffiliateProduct = {
  provider: 'toss-sharelink',
  originalUrl: 'https://toss.im/_m/bMxXXXX',
  resolvedUrl: 'https://toss.shopping/t/2526906561?k=uuid&referrer=affiliate',
  title: '몽크로스 초강력 바디팬, 다크그레이, 2개',
  imageUrl: 'https://shopping.toss.im/x.jpg',
  description: '몽크로스 초강력 바디팬, 8월 5일 도착 예정. 베스트 판매자',
  priceKrw: null,
  priceNote: '토스쇼핑은 웹 페이지에 가격을 노출하지 않습니다(실측 확인).',
};

describe('상품 카드 — 가격이 없을 때가 핵심이다', () => {
  it('가격이 확인되면 표시한다', () => {
    const html = renderAffiliateProductBlock([naverProduct]);
    expect(html).toContain('3,152,600원');
  });

  it('⭐ 가격이 없으면 가격 줄 자체를 넣지 않는다 — "0원"·"가격 확인" 같은 눈속임 금지', () => {
    const html = renderAffiliateProductBlock([tossProduct]);
    expect(html).not.toContain('0원');
    expect(html).not.toContain('가격 확인');
    expect(html).not.toMatch(/color:#ef4444[^>]*>\s*원/);
  });

  it('가격 대신 확인된 정보를 보여준다 (배송·판매자)', () => {
    expect(renderAffiliateProductBlock([tossProduct])).toContain('8월 5일 도착 예정');
  });

  it('⭐ 원본 링크를 그대로 쓴다 — resolvedUrl 을 쓰면 링크 변조가 된다', () => {
    const html = renderAffiliateProductBlock([tossProduct]);
    expect(html).toContain(tossProduct.originalUrl);
    expect(html).not.toContain('referrer=affiliate');   // resolvedUrl 이 새어나가면 안 된다
  });

  it('모든 링크에 rel="sponsored nofollow" 가 붙는다', () => {
    const html = renderAffiliateProductBlock([naverProduct]);
    const anchors = html.match(/<a\b[^>]*>/g) || [];
    expect(anchors.length).toBeGreaterThan(0);
    anchors.forEach(a => expect(a).toMatch(/rel="[^"]*sponsored[^"]*nofollow/));
  });

  it('HTML 특수문자를 이스케이프한다', () => {
    const evil = { ...naverProduct, title: '<script>alert(1)</script>"' };
    const html = renderAffiliateProductBlock([evil]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('이미지가 없어도 카드가 깨지지 않는다', () => {
    const noImg = { ...tossProduct, imageUrl: '' };
    const html = renderAffiliateProductBlock([noImg]);
    expect(html).toContain(noImg.title);
    expect(html).not.toContain('<img');
  });

  it('최대 6개까지만 렌더한다', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...naverProduct, title: `상품${i}` }));
    const html = renderAffiliateProductBlock(many);
    // 제목은 alt 와 앵커에 각각 나오므로 제목 개수로 세면 2배가 된다.
    // 카드마다 하나씩 있는 CTA 버튼으로 센다.
    expect((html.match(/상품 보러가기 →/g) || []).length).toBe(6);
    expect(html).toContain('상품5');
    expect(html).not.toContain('상품6');
  });

  it('빈 입력에 안전하다', () => {
    expect(renderAffiliateProductBlock([])).toBe('');
    expect(renderAffiliateProductBlock(null as any)).toBe('');
  });
});

describe('프롬프트 주입 — 없는 가격을 쓰지 말라고 못박는다', () => {
  it('확인된 가격은 "확인됨" 으로 표시한다', () => {
    expect(formatAffiliateProductsForPrompt([naverProduct])).toContain('3,152,600원 (확인됨)');
  });

  it('⭐ 가격 미확인 상품은 쓰지 말라고 명시한다', () => {
    const block = formatAffiliateProductsForPrompt([tossProduct]);
    expect(block).toContain('확인되지 않음');
    expect(block).toContain('본문에 가격을 쓰지 마세요');
    expect(block).toContain('추측해서 쓰지 마세요');
  });

  it('없는 상품을 만들지 말라고 한다', () => {
    expect(formatAffiliateProductsForPrompt([naverProduct])).toContain('만들어내지 마세요');
  });

  it('링크는 원본을 넘긴다', () => {
    const block = formatAffiliateProductsForPrompt([tossProduct]);
    expect(block).toContain(tossProduct.originalUrl);
    expect(block).not.toContain(tossProduct.resolvedUrl);
  });

  it('빈 입력이면 빈 문자열 — 프롬프트가 이전과 동일해진다', () => {
    expect(formatAffiliateProductsForPrompt([])).toBe('');
  });
});

describe('orchestration 배선', () => {
  const orch = read('src', 'core', 'final', 'orchestration.ts');

  it('제휴 링크를 크롤해 상품을 얻는다', () => {
    expect(orch).toContain('crawlAffiliateLinks');
    expect(orch).toContain('affiliateProducts');
  });

  it('프롬프트에 상품 정보를 주입한다', () => {
    expect(orch).toContain('formatAffiliateProductsForPrompt');
  });

  it('상품 이미지를 본문 이미지로 넘긴다', () => {
    // 'crawlAffiliateLinks' 는 `const { crawlAffiliateLinks } = await import(...)` 의
    // 구조분해 안에 있어 그 뒤 첫 중괄호가 엉뚱한 곳이다. 제휴 블록 경계로 자른다.
    expect(blockBetween(orch, 'v3.8.396: 네이버 쇼핑 커넥트', 'catch (affErr')).toContain('productImages');
  });

  it('한 글에 한 제휴사 — 첫 상품 기준으로 정한다', () => {
    expect(orch).toContain("affiliateProvider = products[0]!.provider");
  });

  it('상품 카드를 최종 HTML 에 넣는다', () => {
    expect(orch).toContain('renderAffiliateProductBlock');
  });

  it('컴플라이언스는 상품 카드가 없어도 돈다 — 링크만 넣었을 수도 있다', () => {
    const i = orch.indexOf('enforceAffiliateCompliance');
    expect(i).toBeGreaterThan(-1);
    const cardIdx = orch.indexOf('renderAffiliateProductBlock');
    expect(i).toBeGreaterThan(cardIdx);   // 카드 블록 밖(뒤)에서 호출된다
  });

  it('제휴 처리 실패가 발행을 막지 않는다', () => {
    // v3.8.400: 고정 길이(2200자) 슬라이스는 블록이 커지면 catch 에 못 닿아 헛되이 깨진다.
    //   (쿠팡 구제·후기 보강이 들어가며 실제로 깨졌다 — 동작은 그대로였다)
    //   실제 catch 위치를 찾아 그 앞까지를 블록으로 본다.
    const i = orch.indexOf('v3.8.396: 네이버 쇼핑 커넥트');
    expect(i).toBeGreaterThan(-1);
    const end = orch.indexOf('catch (affErr', i);
    expect(end).toBeGreaterThan(i);          // 바깥 try 를 받는 catch 가 있다
    const block = orch.slice(i, end);
    expect(block).toContain('try {');
    expect(block).not.toContain('throw');
  });

  it('가격 할루시 가드가 제휴 상품도 인정한다', () => {
    expect(orch).toContain("(payload as any).affiliateProducts) && (payload as any).affiliateProducts.length > 0");
  });
});

describe('UI 배선', () => {
  const html = read('electron', 'ui', 'index.html');
  const posting = read('electron', 'ui', 'modules', 'posting.js');

  it('제휴 링크 입력칸이 있다', () => {
    expect(html).toContain('id="affiliateLinks"');
    expect(html).toContain('id="affiliateLinkField"');
  });

  it('기본은 숨김이고 쇼핑모드에서만 보인다', () => {
    const i = html.indexOf('id="affiliateLinkField"');
    expect(html.slice(i, html.indexOf('>', i))).toContain('display: none');
    expect(html).toContain("if (affLinks) affLinks.style.display = mode === 'shopping' ? 'block' : 'none'");
  });

  it('링크를 바꾸지 않는다고 사용자에게 알린다', () => {
    expect(html).toContain('받은 그대로');
  });

  it('한 제휴사만 쓰라고 안내한다', () => {
    expect(html).toContain('한 글에는 한 제휴사만');
  });

  it('payload 가 링크를 배열로 넘긴다', () => {
    expect(posting).toContain('affiliateLinks:');
    expect(posting).toContain('/^https?:\\/\\//i.test(s)');
  });

  it('비우면 undefined — 이전과 동일 동작', () => {
    const i = posting.indexOf('affiliateLinks:');
    expect(braceBlock(posting, 'affiliateLinks:')).toContain('return undefined');
  });
});
