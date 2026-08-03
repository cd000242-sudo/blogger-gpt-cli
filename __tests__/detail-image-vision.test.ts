/**
 * 상세정보 이미지 → 스펙 추출 + 소제목 배치 (v3.8.431)
 *
 * 사용자 요구: "상세정보가 이미지로 되어있는데 완벽히 추론해서 글이 생성되게
 *   해주시고 이미지 추론이 가능하면 이 이미지들중에서 소제목에 어울리는
 *   이미지를 활용해주세요 그럼 토스랑 네이버 브랜드 커넥트는 수집한 이미지로
 *   이미지 배치가 가능합니다"
 *
 * 비용이 핵심 제약이다 — 이미지 1장당 호출 1번(O(n))이고, 장수 상한이 있다.
 * "소제목마다 모든 이미지를 훑는" 방식(O(이미지×소제목))이면 안 된다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';
import {
  analyzeDetailImages, buildDetailPrompt, parseDetailJson, buildPlacementMap,
  formatDetailFactsForPrompt, MAX_VISION_IMAGES, PLACEMENT_CONFIDENCE_MIN,
} from '../src/core/affiliate/detail-image-vision';
import { extractDetailImageUrls, MAX_DETAIL_IMAGES } from '../src/core/affiliate/crawl';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const crawl = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'crawl.ts'), 'utf8');

const H2 = ['1. 크기와 무게', '2. 실제 사용 후기', '3. 구매 전 단점'];

describe('① 상세 이미지 수집 (토스 — 정적 HTML)', () => {
  it('⭐ 상세 이미지 주소를 뽑는다', () => {
    const html = `
      <img src="https://cdn.example.com/detail-1.jpg">
      <img data-src="https://cdn.example.com/detail-2.jpg">
      <img src="//cdn.example.com/detail-3.jpg">`;
    const out = extractDetailImageUrls(html);
    expect(out).toContain('https://cdn.example.com/detail-1.jpg');
    expect(out).toContain('https://cdn.example.com/detail-2.jpg');
    expect(out).toContain('https://cdn.example.com/detail-3.jpg');   // // → https 보정
  });

  it('⭐ 아이콘·로고·배너는 버린다', () => {
    const html = `
      <img src="https://cdn.example.com/icon-cart.png">
      <img src="https://cdn.example.com/logo.png">
      <img src="https://cdn.example.com/banner_top.jpg">
      <img src="https://cdn.example.com/real-product.jpg">`;
    expect(extractDetailImageUrls(html)).toEqual(['https://cdn.example.com/real-product.jpg']);
  });

  it('⭐ 대표 이미지(og:image)는 제외한다 — 썸네일로 이미 쓴다', () => {
    const og = 'https://cdn.example.com/main.jpg';
    const html = `<img src="${og}"><img src="https://cdn.example.com/sub.jpg">`;
    expect(extractDetailImageUrls(html, og)).toEqual(['https://cdn.example.com/sub.jpg']);
  });

  it('중복 주소는 한 번만 (쿼리스트링 달라도 같은 파일이면 하나)', () => {
    const html = `<img src="https://x.com/a.jpg?w=100"><img src="https://x.com/a.jpg?w=200">`;
    expect(extractDetailImageUrls(html)).toHaveLength(1);
  });

  it('data: URI 는 무시한다 (인라인 아이콘)', () => {
    expect(extractDetailImageUrls('<img src="data:image/png;base64,AAAA">')).toEqual([]);
  });

  it('⭐ 수집 단계에서부터 장수 상한을 건다 (비용 폭주 방지)', () => {
    const many = Array.from({ length: 40 }, (_, i) => `<img src="https://x.com/p${i}.jpg">`).join('');
    expect(extractDetailImageUrls(many)).toHaveLength(MAX_DETAIL_IMAGES);
  });
});

describe('② 프롬프트 — 한 번에 사실 + 소제목을 같이 묻는다 (비용 핵심)', () => {
  const p = buildDetailPrompt(H2, '몽크로스 초강력 바디팬');

  it('⭐ 소제목 목록을 번호와 함께 넣는다', () => {
    H2.forEach((t, i) => expect(p).toContain(`${i}. ${t}`));
  });

  it('⭐ facts 와 bestH2Index 를 한 응답에서 받는다', () => {
    expect(p).toContain('"facts"');
    expect(p).toContain('"bestH2Index"');
    expect(p).toContain('"confidence"');
  });

  it('⭐ 지어내지 말라고 못 박는다 (이 앱 전반의 원칙)', () => {
    expect(p).toContain('실제로 보이는 것만');
    expect(p).toContain('지어내지 마세요');
  });

  it('상품명을 문맥으로 준다', () => {
    expect(p).toContain('몽크로스 초강력 바디팬');
  });
});

describe('③ 응답 파싱 — 깨진 응답에도 죽지 않는다', () => {
  it('⭐ 정상 응답을 파싱한다', () => {
    const r = parseDetailJson('{"facts":["무게 320g","3단 풍량"],"bestH2Index":0,"confidence":85}', H2);
    expect(r.facts).toEqual(['무게 320g', '3단 풍량']);
    expect(r.bestH2).toBe(H2[0]);
    expect(r.confidence).toBe(85);
  });

  it('⭐ 코드펜스가 붙어 와도 판다', () => {
    const r = parseDetailJson('```json\n{"facts":["a"],"bestH2Index":1,"confidence":70}\n```', H2);
    expect(r.bestH2).toBe(H2[1]);
  });

  it('⭐ bestH2Index 가 범위 밖이면 배치하지 않는다', () => {
    expect(parseDetailJson('{"facts":["a"],"bestH2Index":99,"confidence":90}', H2).bestH2).toBeNull();
  });

  it('null / 빈 값 / 잘린 JSON 도 예외 없이 넘어간다', () => {
    expect(parseDetailJson('{"facts":[],"bestH2Index":null,"confidence":0}', H2).bestH2).toBeNull();
    expect(parseDetailJson('', H2).facts).toEqual([]);
    expect(parseDetailJson('{"facts":["a"', H2).facts).toEqual([]);
    expect(parseDetailJson('설명만 하고 JSON이 없음', H2).facts).toEqual([]);
  });

  it('confidence 는 0-100 으로 조인다', () => {
    expect(parseDetailJson('{"facts":["a"],"bestH2Index":0,"confidence":999}', H2).confidence).toBe(100);
    expect(parseDetailJson('{"facts":["a"],"bestH2Index":0,"confidence":-5}', H2).confidence).toBe(0);
  });
});

describe('④ 배치 — 확신 없으면 안 붙이고, 한 사진은 한 곳만', () => {
  const key = (s: string) => s.trim().toLowerCase();

  it('⭐ 확신도가 기준 미만이면 배치하지 않는다 (엉뚱한 사진보다 없는 게 낫다)', () => {
    const map = buildPlacementMap(
      [{ imageUrl: 'a.jpg', facts: ['x'], bestH2: H2[0]!, confidence: PLACEMENT_CONFIDENCE_MIN - 1 }],
      key,
    );
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('⭐ 같은 소제목에 둘이 오면 확신도 높은 쪽이 이긴다', () => {
    const map = buildPlacementMap([
      { imageUrl: 'low.jpg', facts: ['x'], bestH2: H2[0]!, confidence: 65 },
      { imageUrl: 'high.jpg', facts: ['x'], bestH2: H2[0]!, confidence: 95 },
    ], key);
    expect(map[key(H2[0]!)]).toBe('high.jpg');
  });

  it('⭐ 한 사진이 두 소제목에 중복 배치되지 않는다', () => {
    const map = buildPlacementMap([
      { imageUrl: 'same.jpg', facts: ['x'], bestH2: H2[0]!, confidence: 90 },
      { imageUrl: 'same.jpg', facts: ['x'], bestH2: H2[1]!, confidence: 88 },
    ], key);
    expect(Object.values(map).filter((v) => v === 'same.jpg')).toHaveLength(1);
  });
});

describe('⑤ 프롬프트 주입 — 어느 소제목 것인지 표시한다', () => {
  it('⭐ 사실에 소제목 태그를 붙인다 (본문은 한 번에 전 섹션을 만든다)', () => {
    const block = formatDetailFactsForPrompt([
      { imageUrl: 'a.jpg', facts: ['무게 320g'], bestH2: H2[0]!, confidence: 90 },
    ]);
    expect(block).toContain(`[${H2[0]} 관련]`);
    expect(block).toContain('무게 320g');
  });

  it('⭐ 여기 없는 값은 지어내지 말라고 다시 못 박는다', () => {
    const block = formatDetailFactsForPrompt([
      { imageUrl: 'a.jpg', facts: ['재질 ABS'], bestH2: null, confidence: 0 },
    ]);
    expect(block).toContain('지어내지 마세요');
  });

  it('사실이 하나도 없으면 빈 문자열 — 프롬프트를 더럽히지 않는다', () => {
    expect(formatDetailFactsForPrompt([
      { imageUrl: 'a.jpg', facts: [], bestH2: H2[0]!, confidence: 90 },
    ])).toBe('');
  });
});

describe('⑥ 실행 — 비용 상한과 실패 격리', () => {
  const png = Buffer.from('89504e470d0a1a0a', 'hex');

  it('⭐ 이미지 수가 많아도 상한까지만 호출한다 (비용 상한의 본체)', async () => {
    // ⚠️ fetchImageImpl 을 주입해 **네트워크를 타지 않는다.** 예전엔 실제 fetch 를 타서
    //   전체 게이트에서 CPU 가 붐빌 때 타임아웃으로 깨졌다 — 동작은 멀쩡한데 테스트만
    //   깨지면 진짜 회귀와 구분할 수 없다.
    let calls = 0;
    const urls = Array.from({ length: 40 }, (_, i) => `https://x.com/${i}.png`);
    const r = await analyzeDetailImages(urls, H2, '상품', {
      apiKeys: {},
      fetchImageImpl: async () => png,
      askImpl: async () => { calls += 1; return '{"facts":["a"],"bestH2Index":0,"confidence":80}'; },
    } as any);
    expect(calls).toBe(MAX_VISION_IMAGES);
    expect(r).toHaveLength(MAX_VISION_IMAGES);
  });

  it('⭐ 소제목이 없으면 아예 호출하지 않는다 (돈 낭비 방지)', async () => {
    let calls = 0;
    const r = await analyzeDetailImages(['https://x.com/a.png'], [], '상품', {
      apiKeys: {}, askImpl: async () => { calls += 1; return '{}'; },
    } as any);
    expect(calls).toBe(0);
    expect(r).toEqual([]);
  });

  it('⭐ 이미지가 없으면 아예 호출하지 않는다', async () => {
    let calls = 0;
    const r = await analyzeDetailImages([], H2, '상품', {
      apiKeys: {}, askImpl: async () => { calls += 1; return '{}'; },
    } as any);
    expect(calls).toBe(0);
    expect(r).toEqual([]);
  });

  it('상수가 의도한 값이다 (무심코 커지면 비용이 뛴다)', () => {
    expect(MAX_VISION_IMAGES).toBeLessThanOrEqual(15);
    expect(PLACEMENT_CONFIDENCE_MIN).toBeGreaterThanOrEqual(50);
    expect(png.length).toBeGreaterThan(0);
  });
});

describe('⑦ 배선 — 크롤러·orchestration 에 실제로 연결돼 있다', () => {
  it('⭐ 토스 크롤러가 상세 이미지를 담아 돌려준다', () => {
    const fn = blockBetween(crawl, 'async function crawlToss(', 'async function crawlNaver(');
    expect(fn).toContain('extractDetailImageUrls(html, ogImage)');
    expect(fn).toContain('detailImageUrls,');
  });

  it('⭐ 네이버 크롤러도 상세 이미지를 모은다 (지연로딩 속성까지 본다)', () => {
    const fn = blockBetween(crawl, 'async function crawlNaver(', '쿠팡 — 상품 크롤은');
    expect(fn).toContain('.se-main-container img');
    expect(fn).toContain("getAttribute('data-src')");
    // v3.8.444: 대표 갤러리 + 상세 + (부족 시) 포토리뷰를 합쳐 naverDetail 로 넘긴다
    expect(fn).toContain('detailImageUrls: naverDetail');
    expect(fn).toContain('const sellerShots = [...naverGallery,');
  });

  it('⭐ 쿠팡은 이 기능에서 제외된다 (상품 페이지 수집이 차단돼 있다)', () => {
    const block = braceBlock(orch, 'let detailVisionPromise: Promise<any[]> | null = null;\n    if (contentMode === \'shopping\') {');
    expect(block).toContain("prov === 'toss-sharelink' || prov === 'naver-shopping-connect'");
    expect(block).not.toContain("=== 'coupang'");
  });

  it('⭐ 분석을 착수만 하고 기다리지 않는다 (제목·CTA 작업을 붙잡지 않게)', () => {
    const idx = orch.indexOf('detailVisionPromise = (async () => {');
    expect(idx).toBeGreaterThan(-1);
    // 착수 지점에서 await 로 붙잡으면 안 된다
    expect(orch.slice(idx - 400, idx)).not.toContain('await analyzeDetailImages');
  });

  it('⭐ 결과 수신은 scopedSectionBlock 복사 "이전"이다 (v3.8.424 사고 재발 방지)', () => {
    const recvIdx = orch.indexOf('if (detailVisionPromise) {');
    const copyIdx = orch.indexOf("let scopedSectionBlock = modeResult.sectionPromptBlock || '';");
    expect(recvIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeGreaterThan(-1);
    expect(recvIdx).toBeLessThan(copyIdx);
  });

  it('⭐ 분석이 늦어도 발행을 붙잡지 않는다 (제한 시간)', () => {
    const block = braceBlock(orch, 'if (detailVisionPromise) {');
    expect(block).toContain('Promise.race');
    expect(block).toContain('setTimeout');
  });

  it('⭐ 매칭된 사진이 있으면 그 소제목은 유료 생성을 건너뛴다', () => {
    expect(orch).toContain('const detailPlacements = (payload as any).detailImagePlacements');
    expect(orch).toContain('usedDetailImageUrls.add(placedUrl)');
    // 기존 전략은 "매칭이 없을 때만" 돈다
    expect(orch).toContain('if (!imageResult.ok && contentMode === \'shopping\' && productPool.length > 0) {');
  });

  it('⭐ 같은 사진을 두 소제목에 쓰지 않는다', () => {
    expect(orch).toContain('const usedDetailImageUrls = new Set<string>();');
    expect(orch).toContain('!usedDetailImageUrls.has(placedUrl)');
  });

  it('실패해도 발행을 막지 않는다', () => {
    const block = braceBlock(orch, 'if (detailVisionPromise) {');
    expect(block).toContain('catch');
    expect(block).toContain('계속 진행');
  });
});
