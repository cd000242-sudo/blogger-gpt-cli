/**
 * 적대 감사 회귀 테스트 (v3.8.384)
 *
 * 2026-07-28 적대 감사(11 에이전트, 실제 실행 재현)가 P0 5건을 찾았다.
 * 판정은 "릴리스 금지"였고, 이 파일은 그 5건이 되살아나지 않게 못 박는다.
 *
 *   P0-1 SEO_NARRATION 이 <p> 경계를 추측해 정상 섹션(H2·이미지·표·산문 400자+)을 삭제하고
 *        닫히지 않은 <div> 를 남겼다. 경고 0건 + "수리 성공" 로그와 함께 조용히 통과했다.
 *   P0-2 stripBadgeBar 의 [^·|]* 가 본문 20,800자를 1자로 만들어 META_JSON 수리를 무력화했다.
 *        트리거는 배지바가 아니라 <h2>📅 발행일정 안내</h2> 같은 평범한 소제목이었다.
 *   P0-3 DEAD_CTA 가 닫는 태그를 대소문자 구분 indexOf 로 찾아 무제한 구간을 삭제했다.
 *   P0-4 META_JSON 이 "[2026 최신] …" 같은 정상 한국어 메타를 오염으로 오인해 덮어썼다.
 *   P0-5 siteUrl 을 payload 에서만 찾아 주력 발행 경로에서 수리가 상시 무동작이었다.
 */
import {
  repairBeforePublish,
  stripBadgeBar,
  tagBalance,
  balanceChanged,
} from '../src/core/publish-repair';
import { looksLikeJsonPollution } from '../src/core/publish-verifier';

const SITE = 'https://leadernam.com';
const JSON_META = '{"@context":"https://schema.org","@graph":[{"@type":"HowTo"}]}';

/** 앱이 실제로 조립하는 형태의 본문 (h2 → figure → 산문 → 표) */
function appSection(i: number): string {
  return (
    `<h2>📌 ${i}. 신청 자격과 준비 서류</h2>` +
    `<figure><img src="https://leadernam.com/wp-content/uploads/s${i}.webp" alt="안내"><figcaption>▲ 안내 이미지</figcaption></figure>` +
    `<div class="content"><p>${'서울시 청년월세지원은 서울주거포털에서 신청합니다. '.repeat(12)}</p></div>` +
    `<div class="table-wrap"><table><tr><td>구분</td><td>내용</td></tr></table></div>`
  );
}
const BIG_BODY = Array.from({ length: 10 }, (_, i) => appSection(i + 1)).join('') +
  `<p><a href="${SITE}/related/">관련 글</a></p>`;

// ───────────────────────── P0-1 ─────────────────────────

describe('P0-1 SEO_NARRATION — <p> 밖 문구는 손대지 않는다', () => {
  it('<p> 안일 때는 그 문단 하나만 제거하고 섹션 자산은 보존한다', () => {
    const html = BIG_BODY + '<p>키워드를 자연 배치해 색인(노출) 신호를 강화했습니다.</p>';
    const r = repairBeforePublish({ html, siteUrl: SITE });
    expect(r.repairs.find(x => x.code === 'SEO_NARRATION')).toBeDefined();
    expect(r.html).not.toContain('색인(노출)');
    // 섹션 자산 불변
    const count = (s: string, re: RegExp) => (s.match(re) || []).length;
    expect(count(r.html, /<h2/gi)).toBe(count(html, /<h2/gi));
    expect(count(r.html, /<img/gi)).toBe(count(html, /<img/gi));
    expect(count(r.html, /<table/gi)).toBe(count(html, /<table/gi));
  });

  it.each([
    ['콜아웃 div 안', '<div style="background:#fff8e1"><span>⚠️ 주의</span> 색인(노출) 신호를 강화했습니다.</div>'],
    ['표 셀 안', '<div class="t"><table><tr><td>색인(노출) 신호를 강화했습니다.</td></tr></table></div>'],
    ['목록 안', '<ul><li>색인(노출) 신호를 강화했습니다.</li></ul>'],
    ['소제목 안', '<h3>색인(노출) 신호를 강화했습니다.</h3>'],
  ])('%s 이면 건드리지 않고 SKIPPED 경고만 남긴다', (_n, snippet) => {
    const html = BIG_BODY + snippet;
    const r = repairBeforePublish({ html, siteUrl: SITE });
    expect(r.repairs.find(x => x.code === 'SEO_NARRATION')).toBeUndefined();
    expect(r.warnings.find(w => w.code === 'SEO_NARRATION_SKIPPED')).toBeDefined();
    // 원문이 그대로 보존돼야 한다 — 조용한 섹션 삭제보다 문구 잔존이 낫다
    expect(r.html).toBe(html);
  });

  it('어떤 경우에도 태그 균형을 깨지 않는다', () => {
    for (const snippet of [
      '<p>색인(노출) 신호를 강화했습니다.</p>',
      '<div><span>색인(노출) 신호를 강화했습니다.</span></div>',
      '<td>색인(노출) 신호를 강화했습니다.</td>',
      '색인(노출) 신호를 강화했습니다.',
    ]) {
      const html = BIG_BODY + snippet;
      const r = repairBeforePublish({ html, siteUrl: SITE });
      expect(balanceChanged(html, r.html)).toBe(false);
    }
  });
});

// ───────────────────────── P0-2 ─────────────────────────

describe('P0-2 stripBadgeBar — 평범한 본문을 삼키지 않는다', () => {
  const LONG_PROSE = '온누리상품권은 전통시장에서 사용할 수 있습니다. '.repeat(400);

  it.each([
    '📅 발행일정 안내',
    '📅 발행일',
    '🔄 최신 업데이트 안내',
    '📊 출처 3개 인용',
    '💰 발행 규모',
  ])('"%s" 가 본문에 있어도 90%% 이상 보존한다', (heading) => {
    const out = stripBadgeBar(heading + ' ' + LONG_PROSE);
    expect(out.length).toBeGreaterThan(LONG_PROSE.length * 0.9);
  });

  it('평범한 이모지 소제목이 있어도 META_JSON 수리가 동작한다 (핵심 회귀)', () => {
    const html = '<img src="a.webp"><h2>📅 발행일정 안내</h2><p>' + LONG_PROSE + '</p>' +
      `<a href="${SITE}/x/">관련</a>`;
    const r = repairBeforePublish({ html, metaDescription: JSON_META, siteUrl: SITE });
    expect(r.repairs.find(x => x.code === 'META_JSON')).toBeDefined();
    expect(r.metaDescription).not.toBe(JSON_META);
    expect(r.metaDescription!.length).toBeGreaterThanOrEqual(40);
  });

  it('진짜 배지바는 여전히 제거한다 (티빙 5편 사고)', () => {
    const badge = '🔄 최신 업데이트 2026년 6월 8일 · 본 정보는 정기적으로 검토·갱신됩니다 ' +
      '📅 발행 2026년 6월 8일 ⏱ 약 32분 소요 📊 출처 2개 인용 ';
    const out = stripBadgeBar(badge + LONG_PROSE);
    expect(out).not.toContain('최신 업데이트');
    expect(out).not.toContain('출처 2개 인용');
    expect(out.startsWith('온누리상품권')).toBe(true);
  });

  it('고아 서로게이트를 남기지 않는다 — 남으면 encodeURIComponent 가 throw 한다', () => {
    const out = stripBadgeBar('🔄 최신 업데이트 2026 · ' + LONG_PROSE);
    expect(() => encodeURIComponent(out)).not.toThrow();
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false);
  });
});

// ───────────────────────── P0-3 ─────────────────────────

describe('P0-3 DEAD_CTA — 짝 없는 닫는 태그로 무제한 삭제하지 않는다', () => {
  it('대문자 <A>…</A> 도 안전하게 처리한다', () => {
    const html = BIG_BODY +
      '<div class="cta"><A HREF="https://yourdomain.com/apply" class="btn">지금 신청</A></div>' +
      '<p>먼저 <a href="https://realsite.co.kr/check">자격 확인</a>을 하세요.</p>';
    const r = repairBeforePublish({ html, siteUrl: SITE });
    expect(balanceChanged(html, r.html)).toBe(false);
    expect(r.html).toContain('realsite.co.kr/check'); // 정상 링크 보존
    expect(r.html).toContain('자격 확인');
  });

  it('</a> 가 아예 없으면 손대지 않고 SKIPPED 로 알린다', () => {
    const html = BIG_BODY + '<div><a href="https://yourdomain.com/x">깨진 CTA</div>';
    const r = repairBeforePublish({ html, siteUrl: SITE });
    expect(balanceChanged(html, r.html)).toBe(false);
    expect(r.warnings.find(w => w.code === 'DEAD_CTA_SKIPPED')).toBeDefined();
  });

  it('본문 중간 인라인 앵커는 텍스트를 살린 채 제거된다', () => {
    const html = BIG_BODY +
      '<p>자세한 내용은 <a href="https://example.com/apply">복지로 신청 페이지</a>에서 확인하세요.</p>';
    const r = repairBeforePublish({ html, siteUrl: SITE });
    expect(balanceChanged(html, r.html)).toBe(false);
    expect(r.html).not.toContain('example.com/apply');
  });
});

// ───────────────────────── P0-4 ─────────────────────────

describe('P0-4 META_JSON — 정상 한국어 메타를 오염으로 오인하지 않는다', () => {
  const good = ['<img src="a.webp">', '<p>' + '정상 본문입니다. '.repeat(80) + '</p>',
    `<a href="${SITE}/x/">관련</a>`].join('');

  it.each([
    '[2026 최신] 청년월세 지원금 신청 방법과 조건, 지급일까지 정리했습니다.',
    '[속보] 5세대 실손보험 출시 — 전환 조건을 정리했습니다.',
    '{청년월세} 신청 자격과 서류를 한눈에 정리했습니다.',
  ])('"%s" 는 보존한다', (meta) => {
    const r = repairBeforePublish({ html: good, metaDescription: meta, siteUrl: SITE });
    expect(r.repairs.find(x => x.code === 'META_JSON')).toBeUndefined();
    expect(r.metaDescription).toBe(meta);
  });

  it.each([
    ['완전한 JSON', JSON_META],
    ['잘린 JSON', '{"@context":"https://sche'],
    ['배열 JSON', '["a","b"]'],
  ])('%s 는 여전히 수리한다', (_n, meta) => {
    const r = repairBeforePublish({ html: good, metaDescription: meta, siteUrl: SITE });
    expect(r.repairs.find(x => x.code === 'META_JSON')).toBeDefined();
  });

  it('verifier 와 repair 의 오염 판정이 일치한다', () => {
    const cases = [
      '[2026 최신] 청년월세 지원금', '[속보] 실손보험', '{청년월세} 안내',
      JSON_META, '{"@context":"https://sche', '["a","b"]',
      '서울 청년월세지원 결과는 서울주거포털에서 확인합니다.',
    ];
    for (const meta of cases) {
      const polluted = looksLikeJsonPollution(meta);
      const r = repairBeforePublish({ html: good, metaDescription: meta, siteUrl: SITE });
      const repaired = !!r.repairs.find(x => x.code === 'META_JSON');
      expect(repaired).toBe(polluted);
    }
  });
});

// ───────────────────────── P0-5 ─────────────────────────

describe('P0-5 siteUrl — 모를 때 "결함 없음"이라고 거짓 보고하지 않는다', () => {
  it('siteUrl 없으면 SITEURL_UNKNOWN 경고를 남긴다', () => {
    const r = repairBeforePublish({ html: BIG_BODY });
    expect(r.warnings.find(w => w.code === 'SITEURL_UNKNOWN')).toBeDefined();
    expect(r.summary).not.toBe('결함 없음');
  });

  it('index.ts 가 env 로 폴백한다', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src', 'core', 'index.ts'), 'utf8');
    expect(src).toContain("envForRepair['WORDPRESS_SITE_URL']");
  });
});

// ───────────────────────── 공통 안전망 ─────────────────────────

describe('공통 안전망 — 어떤 수리도 태그 균형을 깨지 않는다', () => {
  const DEFECTS = [
    '<p>색인(노출) 신호를 강화했습니다.</p>',
    '<td>색인(노출) 신호를 강화했습니다.</td>',
    '<div><a href="https://yourdomain.com/a">CTA</a></div>',
    '<div><A HREF="https://yourdomain.com/a">CTA</div>',
    '<li><a href="#">빈앵커</a></li>',
    '<a href="#" onclick="return false;">배지</a>',
  ];

  it('결함 6종 각각에서 균형 불변', () => {
    for (const d of DEFECTS) {
      const html = BIG_BODY + d;
      const r = repairBeforePublish({ html, siteUrl: SITE });
      expect(tagBalance(r.html)).toEqual(tagBalance(html));
    }
  });

  it('결함 전체를 한 번에 넣어도 균형 불변 + 멱등', () => {
    const html = BIG_BODY + DEFECTS.join('');
    const first = repairBeforePublish({ html, metaDescription: JSON_META, siteUrl: SITE });
    expect(tagBalance(first.html)).toEqual(tagBalance(html));
    const second = repairBeforePublish({ html: first.html, siteUrl: SITE });
    expect(second.html).toBe(first.html);
  });

  it('현실 규모(산문 10,000자+)에서도 성능이 발행 경로에 맞는다', () => {
    const html = BIG_BODY + BIG_BODY + DEFECTS.join('');
    const t0 = Date.now();
    repairBeforePublish({ html, metaDescription: JSON_META, siteUrl: SITE });
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});
