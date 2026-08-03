/**
 * 구매자 리뷰 사진을 쓰지 않는다 + 썸네일 중복 방지 (v3.8.439)
 *
 * 사용자 지적(2026-08-03):
 *   ① "썸네일 이미지 1번이미지로 그대로 사용하는 버그 발견"
 *   ② "상세이미지가 없으면 리뷰이미지를 들고오게끔 했구나..?? 근데 이렇게하면
 *      중복문서나 저작권에 위험하지않을까"
 *
 * 실측(2026-08-03, toss.shopping 상품 페이지)으로 확인한 사실 —
 *   수집된 6장 중 3장이 `shopping.toss.im/product.review/…` 였다.
 *   즉 **구매자가 직접 찍어 올린 사진**을 퍼오고 있었다.
 *   또 1장은 og:image 와 같은 파일인데 CDN 래핑 주소라 중복 판정을 빠져나갔다 —
 *   이게 "썸네일이 본문 1번에 또 나오는" 버그의 정체였다.
 *
 * 수정 후 실측: 6장 → 2장 (판매자 상세컷만 남음)
 */
import * as fs from 'fs';
import * as path from 'path';
import { extractDetailImageUrls, canonicalImageKey } from '../src/core/affiliate/crawl';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

/** 실측 구조를 그대로 옮긴 픽스처 */
const OG = 'https://shopping.toss.im/live/temp/2026-07-03/6b083d0c.png';
const HTML = `
<img src="https://resources-fe.toss.im/image-optimize/width=800,quality=75/https%3A%2F%2Fshopping.toss.im%2Flive%2Ftemp%2F2026-07-03%2F6b083d0c.png">
<img src="https://resources-fe.toss.im/image-optimize/width=800,quality=75/https%3A%2F%2Fshopping.toss.im%2Flive%2Ftemp%2F2026-07-03%2F4eb5888c.jpeg">
<img src="https://shopping.toss.im/live/temp/2026-07-03/47887cff.jpeg">
<img src="https://shopping.toss.im/product.review/2faa7b59.jpeg">
<img src="https://shopping.toss.im/product.review/0731d2e3.jpeg">
<img src="https://resources-fe.toss.im/image-optimize/width=800/https%3A%2F%2Fshopping.toss.im%2Fproduct.review%2Fc88df0cb.jpeg">
`;

describe('① 구매자 리뷰 사진은 수집하지 않는다 (저작권·중복문서)', () => {
  it('⭐ product.review 경로는 전부 걸러진다', () => {
    const imgs = extractDetailImageUrls(HTML, OG);
    expect(imgs.some((u) => /product\.review/i.test(canonicalImageKey(u)))).toBe(false);
  });

  it('⭐ CDN 으로 래핑된 리뷰 사진도 걸러진다 (주소만 보면 안 보인다)', () => {
    const wrapped = '<img src="https://resources-fe.toss.im/image-optimize/width=800/https%3A%2F%2Fshopping.toss.im%2Fproduct.review%2Fabc.jpeg">';
    expect(extractDetailImageUrls(wrapped)).toEqual([]);
  });

  it('판매자 상세컷은 그대로 쓴다 (상품 소개용으로 제공된 것이라 성격이 다르다)', () => {
    const imgs = extractDetailImageUrls(HTML, OG);
    expect(imgs.length).toBe(2);
    imgs.forEach((u) => expect(canonicalImageKey(u)).toContain('live/temp'));
  });

  it('다른 표기의 리뷰 경로도 막는다', () => {
    for (const p of ['/reviews/a.jpg', '/review_photo/b.jpg', '/user-photo/c.jpg', '/buyer_image/d.jpg']) {
      expect(extractDetailImageUrls(`<img src="https://x.com${p}">`)).toEqual([]);
    }
  });
});

describe('② 썸네일이 본문에 다시 나오지 않는다', () => {
  it('⭐ CDN 래핑 주소와 원본 주소를 같은 파일로 알아본다 (이게 원인이었다)', () => {
    const wrapped = 'https://resources-fe.toss.im/image-optimize/width=800,quality=75/https%3A%2F%2Fshopping.toss.im%2Flive%2Ftemp%2F2026-07-03%2F6b083d0c.png';
    expect(canonicalImageKey(wrapped)).toBe(canonicalImageKey(OG));
  });

  it('⭐ 대표 이미지가 상세 목록에서 빠진다', () => {
    const imgs = extractDetailImageUrls(HTML, OG);
    expect(imgs.some((u) => canonicalImageKey(u) === canonicalImageKey(OG))).toBe(false);
  });

  it('쿼리스트링·프로토콜 차이는 무시한다', () => {
    expect(canonicalImageKey('https://x.com/a.jpg?w=1')).toBe(canonicalImageKey('http://x.com/a.jpg?w=999'));
  });

  it('빈 값에도 죽지 않는다', () => {
    expect(canonicalImageKey('')).toBe('');
  });
});

describe('③ 배치 로직도 정규화 키를 쓴다', () => {
  it('⭐ 썸네일을 정규화 키로 선점한다', () => {
    expect(orch).toContain('usedProductImages.add(imgKey(thumbCandidate))');
  });

  it('⭐ 고를 때도 정규화 키로 비교한다', () => {
    expect(orch).toContain('productPool.find((u) => u && !usedProductImages.has(imgKey(u)))');
    expect(orch).toContain('usedProductImages.add(imgKey(picked))');
  });

  it('⭐ 수집 사진 판별(잘림 방지)도 정규화 키로 한다', () => {
    expect(orch).toContain('const finalKey = imgKey(finalImageUrl);');
    expect(orch).toContain('usedProductImages.has(finalKey)');
  });

  it('imgKey 가 crawl.ts 의 canonicalImageKey 를 쓴다 (판정 기준 단일화)', () => {
    expect(orch).toContain("require('../affiliate/crawl').canonicalImageKey(u)");
  });
});
