/**
 * v3.8.488 — 에이전트 쇼핑 모드를 API 경로와 같은 결과로
 *
 * 사장님: "지금 api로 쇼핑모드 돌리는 결과가 에이전트모드로 나와도 만족해"
 *
 * ## 왜 두 시점으로 나누나
 * 에이전트는 텍스트만 만들고 외부 API 를 못 쓴다.
 *   실행 **전** — 쿠팡에서 실제 상품을 조회해 지시서에 넣는다. 안 주면 지어낸다.
 *   실행 **후** — 상품 위젯·대가성 문구를 앱이 붙인다. 에이전트가 만든 제휴링크는 죽은 링크다.
 *
 * ## 이미지 저작권
 * 사장님 지적: "실사용 사진이 내가 사용한 사진이 아니라면 저작권에 문제가 될 텐데"
 * 맞는 지적이라 크롤링 사진 자동 수집은 넣지 않았다.
 * 상품 이미지는 쿠팡 파트너스가 제휴사에게 **제공하는** productImage 만 쓴다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { isShoppingMode, fetchAgentShoppingMaterial, attachAgentShoppingBlocks } from '../src/core/final/agent-shopping';

const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf-8');

const PRODUCT = {
  productName: '테스트 무선 이어폰',
  productPrice: 89000,
  productImage: 'https://static.coupangcdn.com/test.jpg',
  productUrl: 'https://link.coupang.com/a/TEST',
  isRocket: true,
};

describe('① 쇼핑 모드일 때만 움직인다', () => {
  it('⭐⭐ 모드 판정', () => {
    expect(isShoppingMode('shopping')).toBe(true);
    expect(isShoppingMode('adsense')).toBe(false);
    expect(isShoppingMode(undefined)).toBe(false);
  });

  it('⭐⭐ 쇼핑이 아니면 상품을 조회하지 않는다 (정보성 글에 남의 상품이 붙던 사고 방지)', async () => {
    const r = await fetchAgentShoppingMaterial('실업급여', 'adsense', { accessKey: 'a', secretKey: 'b' });
    expect(r.products).toHaveLength(0);
    expect(r.promptBlock).toBe('');
  });

  it('⭐⭐ 쇼핑이 아니면 글에 아무것도 안 붙인다', () => {
    const html = '<p>정보성 글입니다.</p>';
    const r = attachAgentShoppingBlocks(html, [PRODUCT], 'adsense');
    expect(r.html).toBe(html);
    expect(r.attached).toHaveLength(0);
  });
});

describe('② 키가 없거나 실패해도 글은 나온다', () => {
  it('⭐⭐ 키가 없으면 조용히 넘어간다 (발행을 막지 않는다)', async () => {
    const r = await fetchAgentShoppingMaterial('무선 이어폰', 'shopping', {});
    expect(r.products).toHaveLength(0);
    expect(r.note).toContain('키가 없어');
  });

  it('⭐⭐ 상품이 0개면 위젯도 문구도 안 붙는다', () => {
    const html = '<p>본문</p>';
    const r = attachAgentShoppingBlocks(html, [], 'shopping');
    expect(r.html).toBe(html);
    expect(r.attached).toHaveLength(0);
  });

  it('⭐⭐ 어떤 입력에도 던지지 않는다 (에이전트 결과가 통째로 날아가면 안 된다)', () => {
    expect(() => attachAgentShoppingBlocks(null as any, null as any, 'shopping')).not.toThrow();
    expect(attachAgentShoppingBlocks('', [], 'shopping').html).toBe('');
  });
});

describe('③ 상품이 있으면 API 경로와 같은 것들을 붙인다', () => {
  const result = attachAgentShoppingBlocks('<p>본문입니다.</p>', [PRODUCT], 'shopping');

  it('⭐⭐ 상품 위젯이 붙는다', () => {
    expect(result.html).toContain('테스트 무선 이어폰');
    expect(result.attached.join(' ')).toContain('상품 위젯');
  });

  it('⭐⭐ 쿠팡이 제공한 상품 이미지를 쓴다 (크롤링한 남의 사진이 아니다)', () => {
    expect(result.html).toContain('coupangcdn.com');
  });

  it('⭐⭐ 공정위 대가성 문구가 붙는다', () => {
    expect(result.attached.join(' ')).toContain('공정위');
  });

  it('⭐⭐ 컴플라이언스를 건다 (제휴링크 rel 보강 등)', () => {
    expect(result.attached.join(' ')).toContain('컴플라이언스');
  });

  it('⭐⭐ 원본 본문은 그대로 남는다', () => {
    expect(result.html).toContain('본문입니다.');
  });

  it('⭐⭐ 상품이 없으면 대가성 문구를 붙이지 않는다 (사실과 다른 고지가 된다)', () => {
    const r = attachAgentShoppingBlocks('<p>본문</p>', [], 'shopping');
    expect(r.attached.join(' ')).not.toContain('공정위');
  });
});

describe('④ 실행 경로에 배선돼 있다', () => {
  it('⭐⭐ 에이전트 실행 전에 상품을 조회한다', () => {
    expect(mainTs).toContain('fetchAgentShoppingMaterial(');
  });

  it('⭐⭐ 에이전트 결과에 상품 블록을 붙인다', () => {
    expect(mainTs).toContain('attachAgentShoppingBlocks(');
  });

  it('⭐⭐ 조회한 상품 데이터가 지시서에 실제로 들어간다 (안 주면 에이전트가 지어낸다)', () => {
    expect(mainTs).toContain('shoppingPromptBlock');
  });
});
