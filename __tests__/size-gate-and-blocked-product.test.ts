/**
 * 발행 크기 제한 · 차단 페이지 상품 (v3.8.400)
 *
 * 사용자 보고 (2026-08-01):
 *   ① "발행 실패: 콘텐츠 크기가 너무 큽니다: 797KB (제한: 488KB)"
 *      → "워드프레스나 블로그스팟, 티스토리인데 얼마나 길게 쓰든 상관없잖아. 왜 자꾸 막히는 거니?"
 *      488KB 는 우리가 스스로 정한 값이었다. Blogger 실제 한도는 페이지당 1MB.
 *      같은 파일 4155행은 이미 800KB 를 쓰고 있어 한 파일에 두 한도가 공존했다.
 *
 *   ② "내가 넣은 링크의 제품이 제대로 나오는 게 맞는지 의문"
 *      실측: 쿠팡이 403 → 오류 페이지 <title>("Access Denied")이 그대로 상품명이 됐다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { isBlockedPageTitle, resolveCoupangProductId } from '../src/core/affiliate/crawl';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const publisher = fs.readFileSync(path.join(ROOT, 'src', 'core', 'blogger-publisher.js'), 'utf8');

/** 게이트 블록만 잘라낸다 — 파일 전체에서 문자열을 찾으면 엉뚱한 곳에 걸린다 */
const sizeGate = publisher.slice(
  publisher.indexOf('// 🔒 크기 제한'),
  publisher.indexOf('// body 객체의 필수 필드 확인'),
);

describe('① 크기 제한 — 플랫폼 한도를 넘지 않는 한 막지 않는다', () => {
  it('한도를 Blogger 실제 값(1MB)으로 올렸다', () => {
    expect(sizeGate).toContain('const MAX_CONTENT_SIZE = 1000000');
  });

  it('⭐ 사용자가 겪은 797KB 는 이제 통과한다', () => {
    const m = sizeGate.match(/const MAX_CONTENT_SIZE = (\d+)/);
    expect(m).toBeTruthy();
    expect(797 * 1024).toBeLessThan(Number(m![1]));
  });

  it('500KB~1MB 는 막지 않고 알려만 준다', () => {
    expect(sizeGate).toContain('const WARN_CONTENT_SIZE = 500000');
    expect(sizeGate).toContain('발행은 계속합니다');
  });

  it('⭐ 글을 지워서 크기를 맞추지 않는다 — 예전 자동 트리밍은 제거됐다', () => {
    // 예전: body.content.split(/<h[23][^>]*>/gi) 로 잘라 마지막 섹션들을 삭제했다.
    //       split 은 구분자를 버리므로 남은 소제목 태그까지 통째로 사라졌다.
    expect(sizeGate).not.toContain('split(/<h[23]');
    expect(sizeGate).not.toContain('trimmedSections');
    expect(publisher).not.toContain('자동 트리밍 완료');
  });

  it('⭐ 한도를 넘으면 무엇이 용량을 먹는지 밝힌다 — "줄여주세요" 는 할 수 있는 게 없다', () => {
    expect(sizeGate).toContain('base64 이미지 ${b64.length}장');
    expect(sizeGate).toContain('인라인 스타일 ${Math.round(styleAttrBytes / 1024)}KB');
    expect(sizeGate).not.toContain('콘텐츠를 줄여주세요');
  });

  it('구성 분석이 실제로 계산된다 (문자열만 바꾼 게 아니다)', () => {
    expect(sizeGate).toContain("body.content.match(/src=['\"]data:image");
    expect(sizeGate).toContain('styleAttrBytes');
  });
});

describe('② 차단 페이지를 상품으로 받아들이지 않는다', () => {
  it('⭐ 사용자가 실제로 받은 값 — "Access Denied"', () => {
    expect(isBlockedPageTitle('Access Denied')).toBe(true);
  });

  it('다른 차단·오류 페이지도 잡는다', () => {
    ['Just a moment...', 'Attention Required! | Cloudflare', '403 Forbidden', 'Error',
      'Not Found', '페이지를 찾을 수 없습니다', '접근이 거부되었습니다', 'Service Unavailable']
      .forEach(t => expect(isBlockedPageTitle(t)).toBe(true));
  });

  it('빈 값·너무 짧은 값도 상품명으로 인정하지 않는다', () => {
    expect(isBlockedPageTitle('')).toBe(true);
    expect(isBlockedPageTitle('   ')).toBe(true);
    expect(isBlockedPageTitle('TV')).toBe(true);
  });

  it('⭐ 진짜 상품명은 통과시킨다 — 과잉 차단하면 정상 상품이 사라진다', () => {
    ['몽크로스 초강력 바디팬 MCF-500',
      '삼성전자 비스포크 냉장고 RF85B9111AP',
      'LG 그램 17인치 노트북 2026년형',
      '코멧 에러없는 3구 멀티탭 5m',              // '에러' 가 이름에 들어가도 통과해야 한다
      '노트북 파우치 (블랙)']
      .forEach(t => expect(isBlockedPageTitle(t)).toBe(false));
  });

  it('크롤러가 실제로 이 검사를 쓴다', () => {
    const crawl = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'crawl.ts'), 'utf8');
    expect(crawl).toContain('if (isBlockedPageTitle(product.title))');
    expect(crawl).toContain('return null;');
  });

  it('⭐ 차단됐을 때 조용히 넘어가지 않고 사용자에게 알린다', () => {
    const crawl = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'crawl.ts'), 'utf8');
    const i = crawl.indexOf('isBlockedPageTitle(product.title)');
    const block = braceBlock(crawl, 'isBlockedPageTitle(product.title)');
    expect(block).toContain('접근을 차단했습니다');
    expect(block).toContain('링크만 사용합니다');
  });
});

/**
 * ③ 쿠팡 구제 경로 (v3.8.400)
 *
 * 사용자 지적: "이거 맞아?? 제품이 다른데?? 이게 떠야 정상 아니니?"
 *   화면의 상품은 "수영장 에어 탱크 물총 튜브 … 52,700원" 인데
 *   툴은 상품 정보를 전혀 못 얻고 있었다.
 *
 * 실측으로 밝힌 사실 (2026-08-01):
 *   · 쿠팡 상품 페이지 = 403 (서버 요청·헤드리스 모두)
 *   · 오픈 API 에 "URL/ID → 상품" 조회 없음 (딥링크는 링크만 돌려준다)
 *   · 그러나 **리다이렉트는 인증 없이 따라갈 수 있다** → /vp/products/9665577597
 *   · 그 id 로 API 검색 결과를 대조하면 공식 상품명·가격·이미지를 얻는다
 */
describe('③ 링크 → productId → API 상품 매칭', () => {
  /** 실제 쿠팡 응답 형태를 흉내낸 fetch — 네트워크를 쓰지 않는다 */
  const fakeFetch = (chain: Record<string, string | null>) =>
    (async (url: any) => ({
      headers: { get: (h: string) => (h === 'location' ? chain[String(url)] ?? null : null) },
    })) as unknown as typeof fetch;

  it('⭐ 단축링크를 따라가 productId 를 뽑는다 (사용자 링크 실측 형태)', async () => {
    const short = 'https://link.coupang.com/a/fRAFqchLxY';
    const target = 'https://www.coupang.com/vp/products/9665577597?itemId=28897094299&lptag=AF7510899';
    const id = await resolveCoupangProductId(short, { fetchImpl: fakeFetch({ [short]: target }) });
    expect(id).toBe('9665577597');
  });

  it('이미 상품 URL 이면 네트워크를 타지 않는다', async () => {
    const spy = jest.fn();
    const id = await resolveCoupangProductId('https://www.coupang.com/vp/products/123456', {
      fetchImpl: (async () => { spy(); throw new Error('불려서는 안 된다'); }) as any,
    });
    expect(id).toBe('123456');
    expect(spy).not.toHaveBeenCalled();
  });

  it('⭐ 실패해도 절대 throw 하지 않는다 — 발행을 막지 않는다', async () => {
    await expect(resolveCoupangProductId('https://link.coupang.com/a/X', {
      fetchImpl: (async () => { throw new Error('네트워크 끊김'); }) as any,
    })).resolves.toBe('');
    await expect(resolveCoupangProductId('')).resolves.toBe('');
    await expect(resolveCoupangProductId('그냥텍스트')).resolves.toBe('');
  });

  it('무한 리다이렉트에 갇히지 않는다', async () => {
    const a = 'https://link.coupang.com/a/A';
    const id = await resolveCoupangProductId(a, { fetchImpl: fakeFetch({ [a]: a }), maxHops: 3 });
    expect(id).toBe('');
  });

  it('⭐ 본문 링크는 사용자가 준 원본 그대로 쓴다 (주소 변조 = 계약 위반)', () => {
    const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    const i = orch.indexOf('쿠팡 구제 경로');
    const block = braceBlock(orch, '쿠팡 구제 경로');
    expect(block).toContain('originalUrl: firstLink');       // API 링크로 바꿔치기하지 않는다
    expect(block).not.toContain('originalUrl: match.productUrl');
  });

  it('구제에 성공하면 프롬프트·상품카드·이미지에 모두 반영된다', () => {
    const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    const i = orch.indexOf('쿠팡 구제 경로');
    const block = braceBlock(orch, '쿠팡 구제 경로');
    expect(block).toContain('affiliateProducts');
    expect(block).toContain('productImages');
    expect(block).toContain('formatAffiliateProductsForPrompt');
  });

  it('⭐ 매칭 실패 시 지어내지 않고, 왜 안 됐는지 알려준다', () => {
    const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toContain('API 검색 결과에 없습니다');
    expect(orch).toContain('검색어를 상품명에 가깝게');
  });
});
