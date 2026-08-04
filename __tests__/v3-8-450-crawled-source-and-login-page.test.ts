/**
 * v3.8.450 — 네이버 쇼핑모드 발행이 통째로 차단되던 오류
 *
 * 사용자 실측 오류:
 *   "발행 실패: 🛡️ 엔진 고정 모드 — 이미지 생성 실패로 발행 차단됨:
 *    STRICT_ENGINE_FAILED:unknown:알 수 없는 오류: 알 수 없는 엔진: crawled"
 *
 * 로그로 확인한 원인 사슬:
 *   ① 네이버 링크가 로그인 페이지로 떨어짐 → "🛒 링크 상품 확인: \"NAVER 로그인\""
 *      그대로 제목까지 만들어졌다 → "NAVER 로그인, 보안 설정 없이 써도 될까"
 *   ② 상품 이미지 0장 → orchestration 의 crawled 분기(productImages.length > 0)를 건너뜀
 *   ③ dispatchH2ImageGeneration('crawled') 호출
 *   ④ 디스패처 switch 에 crawled case 없음 → "알 수 없는 엔진"
 *   ⑤ 엔진 고정(strict) 모드가 발행 차단으로 승격
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const orch = read('src/core/final/orchestration.ts');
const dispatcher = read('src/core/imageDispatcher.ts');
const crawl = read('src/core/affiliate/crawl.ts');

describe('① crawled 는 디스패처로 가지 않는다', () => {
  it('⭐⭐ 생성 엔진이 아닌 소스는 디스패치 전에 걸러진다', () => {
    expect(orch).toContain("const NON_GENERATIVE_SOURCES = new Set(['crawled', 'none', 'skip']);");
    expect(orch).toContain('NON_GENERATIVE_SOURCES.has(String(imageSource).toLowerCase())');
  });

  it('⭐⭐ 걸러지면 빈 자리로 두고 발행은 계속된다 (차단 금지 원칙)', () => {
    const block = blockBetween(orch, 'const NON_GENERATIVE_SOURCES', 'if (!imageResult.ok && !leaveBlank) {');
    expect(block).toContain('leaveBlank = true;');
    expect(block).toContain('발행은 계속');
  });

  it('⭐ 이 검사는 디스패치 분기보다 앞에 있어야 한다', () => {
    const guard = orch.indexOf('const NON_GENERATIVE_SOURCES');
    const dispatch = orch.indexOf('🎯 이미지 디스패치 (소스:');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(dispatch);
  });
});

describe('② 디스패처도 crawled 를 알아본다 (이중 방어)', () => {
  it('⭐⭐ crawled 전용 case 가 있다 — default 로 떨어지면 안 된다', () => {
    expect(dispatcher).toContain("case 'crawled':");
    expect(dispatcher).toContain('NON_GENERATIVE_SOURCE:crawled');
  });

  it('⭐ 오류 문구가 원인을 정확히 말한다', () => {
    const block = blockBetween(dispatcher, "case 'crawled':", 'default:');
    expect(block).toContain('생성 엔진이 아님');
    expect(block).toContain('발행은 계속됩니다');
    // "알 수 없는 엔진" 으로 새면 strict 가 다시 차단한다
    expect(block).not.toContain('알 수 없는 엔진');
  });
});

describe('③ 로그인 페이지를 상품으로 착각하지 않는다', () => {
  it('⭐⭐ 로그인 화면이면 크롤이 실패로 알린다', () => {
    const block = blockBetween(crawl, 'const loginish =', 'return {');
    // 소스에는 정규식이라 이스케이프된 형태로 들어 있다
    expect(block).toContain('nid\\.naver\\.com');
    expect(block).toContain('로그인 화면을 돌려줬습니다');
    expect(block).toContain('throw new Error(');
  });

  it('⭐ 첫 줄만으로도 원인이 전달된다 (로그가 60자에서 잘린다)', () => {
    const m = crawl.match(/'(네이버가 로그인 화면을 돌려줬습니다[^']*)\\n'/);
    expect(m).not.toBeNull();
    expect(m![1]!.length).toBeLessThanOrEqual(60);
  });

  it('⭐ 그래도 발행 자체를 죽이지는 않는다 (호출부가 잡아서 계속 진행)', () => {
    expect(orch).toContain('링크에서 상품명을 얻지 못했습니다 (계속 진행)');
  });
});
