/**
 * 발행 자동 수리 테스트 (v3.8.384)
 *
 * 최우선 불변식 (사용자 지시): **검수 때문에 발행이 막히는 일은 절대 없어야 한다.**
 *   - repairBeforePublish 는 어떤 입력에도 throw 하지 않는다.
 *   - 어떤 경우에도 "발행 불가" 신호를 내지 않는다 — 수리하거나 경고할 뿐이다.
 *   - 수리기가 죽으면 원본을 그대로 돌려준다 (내용 유실 금지).
 *
 * 두 번째 불변식: **멀쩡한 글을 망가뜨리지 않는다.**
 *   오탐 수리는 차단보다 나쁘다 — 차단은 눈에 보이지만 잘못된 수리는 조용히 글을 망친다.
 */
import {
  repairBeforePublish,
  buildMetaDescription,
  stripBadgeBar,
} from '../src/core/publish-repair';
import { stripNonProse } from '../src/core/publish-verifier';

const LONG = '서울시 청년월세지원은 서울주거포털에서 신청합니다. '.repeat(40);
const GOOD_HTML =
  '<h2>청년월세지원 신청 방법</h2>' +
  '<img src="https://leadernam.com/wp-content/uploads/a.jpg" alt="안내">' +
  `<p>${LONG}</p>` +
  '<a href="https://leadernam.com/금융-보험/related/">관련 글</a>';

const SITE = 'https://leadernam.com';

// ───────────────────────── 최우선 불변식 ─────────────────────────

describe('발행은 절대 막히지 않는다', () => {
  it.each([
    ['빈 입력', {}],
    ['html null', { html: null as any }],
    ['html 숫자', { html: 12345 as any }],
    ['siteUrl 이 URL 아님', { html: GOOD_HTML, siteUrl: 'not a url' }],
    ['metaDescription 객체', { html: GOOD_HTML, metaDescription: {} as any }],
    ['본문이 결함 범벅', {
      html: '<a href="https://yourdomain.com/x">죽은링크</a><a href="#">빈앵커</a>'
        + '<p>색인(노출) 신호를 강화했습니다.</p>',
      metaDescription: '{"@context":"https://schema.org"',
      siteUrl: SITE,
    }],
  ])('%s → throw 없이 항상 html 을 돌려준다', (_name, input) => {
    expect(() => repairBeforePublish(input as any)).not.toThrow();
    const r = repairBeforePublish(input as any);
    expect(typeof r.html).toBe('string');
    expect(Array.isArray(r.repairs)).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
    // "막는다"는 개념 자체가 반환값에 없어야 한다
    expect(r).not.toHaveProperty('blocked');
    expect(r).not.toHaveProperty('ok');
  });

  it('수리 불가 결함(이미지 0·본문 과소)도 경고일 뿐 내용을 보존한다', () => {
    const thin = '<p>노인 일자리 신청 바로가기</p>';
    const r = repairBeforePublish({ html: thin, siteUrl: SITE });
    expect(r.html).toBe(thin); // 원본 그대로
    expect(r.warnings.map(w => w.code)).toEqual(expect.arrayContaining(['NO_IMAGE', 'THIN_BODY']));
    expect(r.repairs).toEqual([]);
  });
});

// ───────────────────────── 멀쩡한 글 보존 ─────────────────────────

describe('멀쩡한 글은 한 글자도 건드리지 않는다', () => {
  it('정상 글 → 수리 0건, html 동일', () => {
    const r = repairBeforePublish({
      html: GOOD_HTML,
      metaDescription: '서울 청년월세지원 결과는 서울주거포털 마이페이지에서 확인합니다.',
      siteUrl: SITE,
    });
    expect(r.repairs).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.html).toBe(GOOD_HTML);
    expect(r.summary).toBe('결함 없음');
  });

  it('정상 JSON-LD 스키마는 보존한다 (제거 대상이 아니다)', () => {
    const withSchema = GOOD_HTML +
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>';
    const r = repairBeforePublish({ html: withSchema, siteUrl: SITE });
    expect(r.html).toContain('"@type":"Article"');
    expect(r.repairs).toEqual([]);
  });

  it('onclick=return false 장식 배지는 유지한다 (온누리상품권 3편 실사례)', () => {
    const deco = GOOD_HTML + '<a href="#" onclick="return false;" style="background:#9B59B6">배지</a>';
    const r = repairBeforePublish({ html: deco, siteUrl: SITE });
    expect(r.html).toContain('onclick="return false;"');
    expect(r.repairs.find(x => x.code === 'EMPTY_ANCHOR')).toBeUndefined();
  });

  it('정상 메타디스크립션은 재생성하지 않는다', () => {
    const desc = '서울 청년월세지원 결과 확인 방법과 차수별 지급일을 정리했습니다.';
    const r = repairBeforePublish({ html: GOOD_HTML, metaDescription: desc, siteUrl: SITE });
    expect(r.metaDescription).toBe(desc);
  });
});

// ───────────────────────── 실제 사고 패턴 수리 ─────────────────────────

describe('실제 사고 패턴을 고쳐서 통과시킨다', () => {
  it('메타 JSON 오염 → 본문에서 재생성 (2026-07-26 11편)', () => {
    const r = repairBeforePublish({
      html: GOOD_HTML,
      metaDescription: '{"@context":"https://schema.org","@graph":[{"@type":"HowTo"',
      siteUrl: SITE,
    });
    expect(r.repairs.find(x => x.code === 'META_JSON')).toBeDefined();
    expect(r.metaDescription).not.toMatch(/^[{[]/);
    expect(r.metaDescription!.length).toBeGreaterThanOrEqual(40);
    expect(r.metaDescription!.length).toBeLessThanOrEqual(156);
  });

  it('yourdomain.com CTA → 래퍼 div 까지 제거 (29건 사고)', () => {
    const withCta = GOOD_HTML +
      '<div style="text-align:center"><a class="btn" href="https://yourdomain.com/x"><b>상담 신청</b></a></div>';
    const r = repairBeforePublish({ html: withCta, siteUrl: SITE });
    expect(r.html).not.toContain('yourdomain.com');
    expect(r.html).not.toContain('상담 신청');
    expect(r.repairs.find(x => x.code === 'DEAD_CTA')).toBeDefined();
  });

  it('JSON-LD @id 가짜 도메인 → 실제 사이트 URL (5편 사고)', () => {
    const bad = GOOD_HTML +
      '<script type="application/ld+json">{"mainEntityOfPage":{"@id":"https://example.com/foo"}}</script>';
    const r = repairBeforePublish({ html: bad, siteUrl: SITE });
    expect(r.html).toContain('"@id":"https://leadernam.com"');
    expect(r.html).not.toContain('example.com');
    expect(r.repairs.find(x => x.code === 'FAKE_SCHEMA_URL')).toBeDefined();
  });

  it('SEO 서술 문단 → 통째 제거 (문장만 지우면 깨진 문장이 남는다)', () => {
    const bad = GOOD_HTML +
      '<p style="margin:8px">본 글은 <strong>가평펜션</strong>을 자연 배치해 <strong>색인(노출) 신호</strong>를 강화했습니다.</p>';
    const r = repairBeforePublish({ html: bad, siteUrl: SITE });
    expect(r.html).not.toContain('색인(노출)');
    expect(r.html).not.toContain('자연 배치해'); // 문단 전체가 사라져야 한다
    expect(r.repairs.find(x => x.code === 'SEO_NARRATION')).toBeDefined();
  });

  it('빈 앵커 → 링크만 벗기고 텍스트는 보존 (41건 사고)', () => {
    const bad = GOOD_HTML + '<li><a href="#">신한라이프 공식 운세 메뉴</a></li>';
    const r = repairBeforePublish({ html: bad, siteUrl: SITE });
    expect(r.html).toContain('신한라이프 공식 운세 메뉴'); // 텍스트 보존
    expect(r.html).not.toMatch(/<a[^>]*href\s*=\s*["']#["'](?![^>]*onclick)/);
    expect(r.repairs.find(x => x.code === 'EMPTY_ANCHOR')).toBeDefined();
  });

  it('여러 결함이 동시에 있어도 전부 수리한다', () => {
    const bad = GOOD_HTML +
      '<div><a href="https://yourdomain.com/a">CTA</a></div>' +
      '<a href="#">빈앵커</a>' +
      '<p>키워드를 자연 배치해 색인(노출) 신호를 강화했습니다.</p>';
    const r = repairBeforePublish({ html: bad, metaDescription: '{"@context":"x"', siteUrl: SITE });
    expect(r.repairs.map(x => x.code).sort()).toEqual(
      ['DEAD_CTA', 'EMPTY_ANCHOR', 'META_JSON', 'SEO_NARRATION'].sort());
    expect(r.html).not.toMatch(/yourdomain|색인\(노출\)/);
  });
});

// ───────────────────────── 안전 상한 ─────────────────────────

describe('안전 상한 — 과도한 삭제는 보류한다', () => {
  it('본문의 30% 넘게 지우는 수리는 포기하고 경고로 강등한다', () => {
    // 본문 대부분이 죽은 CTA인 극단 케이스
    const mostlyCta = '<p>짧은 본문</p>' +
      '<div><a href="https://yourdomain.com/x">' + '아주 긴 CTA 텍스트입니다. '.repeat(50) + '</a></div>';
    const r = repairBeforePublish({ html: mostlyCta, siteUrl: SITE });
    expect(r.repairs.find(x => x.code === 'DEAD_CTA')).toBeUndefined();
    expect(r.warnings.find(w => w.code === 'DEAD_CTA_SKIPPED')).toBeDefined();
    expect(r.html).toContain('yourdomain.com'); // 원본 보존 — 손대지 않았다
  });
});

// ───────────────────────── 멱등성 ─────────────────────────

describe('멱등성 — 두 번 돌려도 같은 결과', () => {
  it('수리된 결과를 다시 수리해도 변화가 없다', () => {
    const bad = GOOD_HTML +
      '<div><a href="https://yourdomain.com/a">CTA</a></div><a href="#">빈앵커</a>' +
      '<p>색인(노출) 신호를 강화했습니다.</p>';
    const first = repairBeforePublish({ html: bad, siteUrl: SITE });
    const second = repairBeforePublish({ html: first.html, siteUrl: SITE });
    expect(second.html).toBe(first.html);
    expect(second.repairs).toEqual([]);
  });
});

// ───────────────────────── 메타 생성 품질 ─────────────────────────

describe('buildMetaDescription — 실측으로 잡은 품질 문제', () => {
  it('메타 배지 바로 시작하지 않는다 (티빙 5편 사고)', () => {
    const prose = '🔄 최신 업데이트 2026년 6월 8일 · 본 정보는 정기적으로 검토·갱신됩니다 📅 발행 2026년 6월 8일 '
      + '⏱ 약 32분 소요 📊 출처 2개 인용 '
      + 'OTT 서비스를 매일 쓰는 시대에 개인정보 유출 소식은 불안합니다. '.repeat(4);
    const d = buildMetaDescription(prose);
    expect(d).not.toContain('최신 업데이트');
    expect(d).not.toContain('출처 2개 인용');
    expect(d.startsWith('OTT')).toBe(true);
  });

  it('접속어로 시작하지 않는다 — \\b 는 한글 뒤에서 안 먹는다', () => {
    const prose = '여기에 격락손해까지 함께 검토할 수 있는지 묻는 경우가 많습니다. '
      + '핵심은 견적서 금액만으로 보상 범위가 정해지지 않는다는 점입니다. '.repeat(4);
    const d = buildMetaDescription(prose);
    expect(d.startsWith('여기에')).toBe(false);
    expect(d.startsWith('핵심은')).toBe(true);
  });

  it('길이가 155자를 넘지 않는다', () => {
    const d = buildMetaDescription('아주 긴 문장입니다. '.repeat(80));
    expect(d.length).toBeLessThanOrEqual(155);
  });

  it('stripBadgeBar 는 배지가 없으면 원본을 보존한다', () => {
    expect(stripBadgeBar('평범한 본문입니다.')).toBe('평범한 본문입니다.');
  });
});

// ───────────────────────── 배선 가드 ─────────────────────────

describe('index.ts 배선 가드 — 차단 코드가 되살아나면 실패한다', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'core', 'index.ts'), 'utf8');

  it('자동 수리를 호출한다', () => {
    expect(src).toContain('repairBeforePublish');
  });

  it('검수 결과로 조기 return 하지 않는다 (발행 차단 금지)', () => {
    // AUTO-REPAIR 블록 안에 "return { ok: false" 가 있으면 차단형으로 회귀한 것이다
    const start = src.indexOf('v3.8.384: 발행 자동 수리');
    const end = src.indexOf("[AUTO-REPAIR] 수리 스킵");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end);
    expect(block).not.toMatch(/return\s*\{[^}]*ok:\s*false/);
    expect(block).not.toContain('verifyIssues');
  });

  it('본문에서 stripNonProse 를 쓴다 (JSON-LD 오염 근본 원인 봉인)', () => {
    const pub = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src', 'wordpress', 'wordpress-publisher.ts'), 'utf8');
    expect(pub).toContain("import { stripNonProse } from '../core/publish-verifier'");
    const offenders = pub.split('\n').filter((l: string) =>
      /content\s*\.?\s*replace\(\/<\[\^>\]\*>\/g/.test(l) && !l.trim().startsWith('//'));
    expect(offenders).toEqual([]);
  });
});

// stripNonProse 재수출 확인 (수리기가 의존한다)
describe('의존성', () => {
  it('stripNonProse 가 script 블록을 제거한다', () => {
    expect(stripNonProse('<script>{"@context":"x"}</script><p>본문</p>')).toBe('본문');
  });
});
