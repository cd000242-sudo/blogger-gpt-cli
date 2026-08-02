/**
 * 쿠팡 상품 보강 — 후기·스펙 (v3.8.400)
 *
 * 사용자 요구:
 *   "후기까지 가져와야 정말 사용한 사람처럼 작성을 한다고"
 *   "후기는 짤리지않게 밀도높게 추출해야되"
 *   "API를 이용하면 당연히 정확하지만 크롬으로 하면 부정확하면안된다고 서로보완할수없을까"
 *
 * 실측 근거 (2026-08-01):
 *   · API 응답 필드 10개뿐 — 후기·스펙 없음. 후기 엔드포인트는 404.
 *   · 크롬 가격은 5개 상품 중 1개만 API 와 일치 → 가격은 절대 크롬에서 쓰지 않는다.
 *   · /vp/product/reviews 는 size=30 상한, 페이지 무제한, 본문 잘림 0건.
 *   · 실제 수집: 후기 60개 54,148자, 최장 1,861자, 5초.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  stripAutoTranslation, isSameProduct, packReviews, formatEnrichmentForPrompt,
  type CoupangReview, type CoupangEnrichment,
} from '../src/core/affiliate/coupang-enrich';
import { braceBlock, linesAfter } from './helpers/source-block';

const review = (body: string, rating: number | null = 5, date = '2026.07.25'): CoupangReview =>
  ({ body, rating, date });

describe('후기를 자르지 않는다', () => {
  it('⭐ 개별 후기는 절대 잘리지 않는다 — 총량은 개수로 조절한다', () => {
    const long = review('가'.repeat(1800));
    const all = [long, review('나'.repeat(1800)), review('다'.repeat(1800))];
    const { picked, chars } = packReviews(all, 4000);

    expect(picked).toHaveLength(2);                       // 3개째는 상한 초과라 제외
    picked.forEach(r => expect(r.body).toHaveLength(1800)); // 담긴 것은 원문 그대로
    expect(chars).toBe(3600);
  });

  it('첫 후기가 상한보다 길어도 최소 1개는 담는다 (빈손으로 끝나면 안 된다)', () => {
    const { picked } = packReviews([review('가'.repeat(9000))], 1000);
    expect(picked).toHaveLength(1);
    expect(picked[0]!.body).toHaveLength(9000);
  });

  it('상한에 안 걸리면 전부 담는다', () => {
    const all = [review('짧은 후기입니다'), review('이것도 짧습니다')];
    expect(packReviews(all, 60000).picked).toHaveLength(2);
    expect(packReviews(all, 60000).dropped).toBe(0);
  });

  it('빈 입력에 안전하다', () => {
    expect(packReviews([], 1000).picked).toEqual([]);
  });
});

describe('쿠팡 자동 영어번역만 걷어낸다', () => {
  it('⭐ 실측 형태 — 한글 후기 뒤에 영어 번역본이 통째로 붙는다', () => {
    const ko = '【내돈내산 후기】 쿠쿠 밥솥 구매해서 사용해보고 후기 남겨요. 보온 기능이 오래 유지되고 자동세척이 편합니다. 소가족에게 추천합니다.';
    const en = '【My Own Purchase Review】 Hello~ I bought the Cuckoo Electric Warming Rice Cooker on Coupang and would like to share my honest review with everyone here today.';
    const out = stripAutoTranslation(`${ko} ${en}`);
    expect(out).toBe(ko);
    expect(out).not.toMatch(/My Own Purchase Review/);
  });

  it('머리표 없이 영어만 길게 이어져도 걷어낸다', () => {
    const ko = '아이가 정말 좋아해요. 물놀이할 때 안전하고 튼튼합니다. 재구매 의사 있습니다.';
    const en = ' My child really loves this product very much and it feels sturdy and safe in the water for a long time of playing every single weekend.';
    expect(stripAutoTranslation(ko + en)).toBe(ko);
  });

  it('⭐ 영어가 섞인 정상 한글 후기는 건드리지 않는다 (과잉 제거 금지)', () => {
    const t = '쿠쿠 CR-0675FW 모델 샀어요. IH 방식은 아니지만 가성비 좋습니다. AS도 친절했어요.';
    expect(stripAutoTranslation(t)).toBe(t);
  });

  it('영어 후기만 있는 경우를 통째로 지우지 않는다', () => {
    const t = 'Very good product. I use it every day and it works well for my family.';
    expect(stripAutoTranslation(t)).toBe(t);
  });

  it('빈 값에 안전하다', () => {
    expect(stripAutoTranslation('')).toBe('');
    expect(stripAutoTranslation(null as any)).toBe('');
  });
});

describe('교차검증 — 다른 상품 후기가 섞이면 안 된다', () => {
  it('⭐ 옵션 접미사 차이는 같은 상품으로 본다 (실측 불일치 2건의 정체)', () => {
    expect(isSameProduct('스윔어바웃 어린이 파도타기 모양튜브', '스윔어바웃 어린이 파도타기 모양튜브, 블루, 1개')).toBe(true);
  });

  it('페이지 제목의 " - 카테고리 | 쿠팡" 꼬리를 무시한다', () => {
    expect(isSameProduct('쿠쿠 전기보온 에그밥솥 6인용', '쿠쿠 전기보온 에그밥솥 6인용 - 전기밥솥 | 쿠팡')).toBe(true);
  });

  it('⭐ 전혀 다른 상품은 걸러낸다', () => {
    expect(isSameProduct('쿠쿠 전기보온 에그밥솥 6인용', '삼성 갤럭시 Z폴드8 1TB - 휴대폰 | 쿠팡')).toBe(false);
    expect(isSameProduct('위크위크 베트남 로부스타 원두', 'CBHV 남성용 등산화 트레킹화')).toBe(false);
  });

  it('빈 값이면 검증 실패로 본다 (모르면 쓰지 않는다)', () => {
    expect(isSameProduct('', '쿠쿠 밥솥')).toBe(false);
    expect(isSameProduct('쿠쿠 밥솥', '')).toBe(false);
  });
});

describe('프롬프트 블록', () => {
  const base: CoupangEnrichment = {
    productId: '1868813621',
    pageTitle: '쿠쿠 전기보온 에그밥솥 6인용 - 전기밥솥 | 쿠팡',
    reviews: [review('보온이 오래가고 자동세척이 편합니다. 6인용이라 넉넉해요.')],
    totalReviewCount: 15191,
    specs: ['아이템 높이: 110cm'],
    options: ['110CM 소형 탱크 41,200원'],
    policy: ['배송사 CJ 대한통운', '교환/반품 비용 40,000원'],
    imageUrl: 'https://img.example/product.jpg',   // v3.8.404 신설 — 썸네일용 상품 사진
    verified: true,
    note: '',
  };

  it('후기를 원문 그대로 넣는다 (요약하지 않는다)', () => {
    const b = formatEnrichmentForPrompt(base);
    expect(b).toContain('보온이 오래가고 자동세척이 편합니다. 6인용이라 넉넉해요.');
    expect(b).toContain('별점 5');
    expect(b).toContain('15,191');
  });

  it('⭐ 가격은 API 값만 쓰라고 못 박는다 — 크롬 가격은 5개 중 1개만 맞았다', () => {
    expect(formatEnrichmentForPrompt(base)).toContain('가격은 위 API 상품 데이터의 값만');
  });

  it('⭐ 후기를 베끼지 말고 지어내지도 말라고 지시한다', () => {
    const b = formatEnrichmentForPrompt(base);
    expect(b).toContain('그대로 베끼지 말고');
    expect(b).toContain('후기에 없는 내용을 지어내지 마세요');
  });

  it('재료가 하나도 없으면 빈 문자열', () => {
    expect(formatEnrichmentForPrompt({ ...base, reviews: [], specs: [], options: [], policy: [] })).toBe('');
    expect(formatEnrichmentForPrompt(null)).toBe('');
  });

  /**
   * v3.8.400 — 사용자 제안: "스펙을 구매욕구를 끌어와서 스펙을 보고 스토리텔링을 하면 어때"
   * 후기가 0개인 신상품·해외직구가 실제로 있다(사용자가 넣은 상품이 그랬다).
   * 그때 빈손으로 두지 않고 스펙·옵션·배송조건으로 쓰게 한다.
   */
  it('⭐ 후기가 없어도 스펙·옵션·배송조건으로 쓸 재료를 준다', () => {
    const b = formatEnrichmentForPrompt({ ...base, reviews: [], totalReviewCount: 0 });
    expect(b).toContain('아이템 높이: 110cm');
    expect(b).toContain('110CM 소형 탱크');
    expect(b).toContain('배송사 CJ 대한통운');
  });

  it('⭐ 후기가 없을 때 "후기가 있는 것처럼" 쓰지 못하게 막는다', () => {
    const b = formatEnrichmentForPrompt({ ...base, reviews: [], totalReviewCount: 0 });
    expect(b).toContain('후기가 있는 것처럼 쓰지 마세요');
    expect(b).toContain('"후기를 보니"');
    expect(b).not.toContain('실제 구매자가 쓴 글입니다');   // 후기 있을 때만 나오는 문구
  });

  it('⭐ 숫자를 생활 언어로 옮기라고 지시한다 (스펙 나열은 구매로 안 이어진다)', () => {
    const b = formatEnrichmentForPrompt({ ...base, reviews: [], totalReviewCount: 0 });
    expect(b).toContain('생활에서 무슨 뜻인지');
    expect(b).toContain('옵션 차이가 곧 독자의 고민');
    expect(b).toContain('숨기지 말고 먼저 말하세요');
  });
});

describe('설계 원칙이 코드에 박혀 있다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'affiliate', 'coupang-enrich.ts'), 'utf8');

  it('⭐ 실제 Chrome 을 창 띄워 쓴다 — 헤드리스는 4가지 모두 403 이었다', () => {
    expect(src).toContain("channel: 'chrome'");
    expect(src).toContain('headless: false');
  });

  it('⭐ 블루스크린 방지 인자를 쓴다 (v3.8.395 에서 하루 3번 재부팅했다)', () => {
    expect(src).toContain('CHROMIUM_GPU_SAFE_ARGS');
  });

  it('사용자의 기존 Chrome 프로필을 건드리지 않는다', () => {
    expect(src).toContain('orbit-coupang-profile');
  });

  it('size=30 상한을 지킨다 (50·100 은 빈 응답)', () => {
    expect(src).toContain('const REVIEW_PAGE_SIZE = 30');
  });

  it('⭐ 실패해도 throw 하지 않는다 — 발행을 막지 않는다', () => {
    expect(src).toContain('catch (e: any)');
    expect(src).toContain('return null;');
  });

  it('교차검증 실패 시 후기를 비운다', () => {
    const i = src.indexOf('if (!verified)');
    expect(braceBlock(src, 'if (!verified)')).toContain('reviews: []');
  });

  it('orchestration 이 실제로 호출한다', () => {
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toContain('enrichCoupangProduct');
    expect(orch).toContain('formatEnrichmentForPrompt');
    expect(orch).toContain('후기 보강 건너뜀');       // 실패해도 발행 계속
  });
});

/**
 * 차단 자동 복구 (v3.8.400)
 *
 * 실측(2026-08-02): 기존 프로필로 403 이 계속 나던 상황에서
 *   **새 프로필**로 같은 상품을 열자 바로 HTTP 200 이었다.
 *   → 차단은 IP 가 아니라 브라우저 프로필(쿠키)에 걸린다. 버리고 다시 열면 풀린다.
 */
describe('쿠팡 차단 자동 복구', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'affiliate', 'coupang-enrich.ts'), 'utf8');

  it('⭐ 403 이면 프로필을 버리고 한 번 더 시도한다', () => {
    expect(src).toContain('for (let attempt = 1; attempt <= 2; attempt += 1)');
    expect(src).toContain('rmSync(profileDir');
    expect(src).toContain('브라우저 기록을 비우고 다시 시도합니다');
  });

  it('두 번째도 막히면 포기하고 발행은 계속한다', () => {
    const i = src.indexOf("if (attempt === 1)");
    expect(braceBlock(src, "if (attempt === 1)")).toContain('return null');
  });

  it('⭐ 재시도는 매번 새 폴더를 쓴다 (같은 폴더면 같은 쿠키를 다시 쓴다)', () => {
    expect(src).toContain('`${baseProfile}-${Date.now()}`');
  });

  it('⭐ 새 프로필은 메타가 늦게 차서 제목을 기다린다', () => {
    // 안 기다렸더니 og:title 이 비어 교차검증이 실패하고 후기·스펙이 0개가 됐다
    expect(src).toContain('waitForFunction');
    expect(src).toContain("meta[property=\"og:title\"]");
  });

  it('기다리다 실패해도 진행한다 — 발행을 막지 않는다', () => {
    // waitForFunction 뒤 첫 중괄호는 `{ timeout: 10000 }` 옵션 객체라 블록이 너무 좁다.
    // 이 호출을 감싼 try/catch 가 바로 아래에 있으므로 줄 단위로 본다.
    expect(linesAfter(src, 'waitForFunction', 8)).toContain('catch');
  });
});
