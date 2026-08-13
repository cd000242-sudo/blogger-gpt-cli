/**
 * v3.8.494 — 광고 자리가 코드로 안 바뀌고 안내 문구가 발행되던 사고
 *
 * 사장님(스크린샷): 발행된 글 본문에
 *   "client ca-pub-4008574892672964 · slot 6129452437 · format auto"
 * 가 그대로 보이고 광고는 안 나온다.
 *
 * ## 내가 낸 버그다 (v3.8.489)
 * 식별 정보를 보여주려고 자리표시자를 두 겹(제목 줄 + 안내 줄)으로 바꿨는데,
 * 변환 정규식은 비탐욕 `</div>` 라 **첫 닫힘에서 멈췄다.** 바깥 껍데기+첫 줄만
 * 광고 코드로 바뀌고 안내 줄이 본문에 그대로 남아 발행됐다.
 *
 * ## 고침
 * 여닫이 개수를 세는 균형 매칭(replaceBalancedDivs)으로 요소 전체를 소비한다.
 * 광고 코드가 div 를 품는 경우(네트워크에 따라)를 위해 되접기(collapse)도 같이 바꿨다.
 * 이미 발행된 글의 잔해(bgpt-ad-slot-detail 홀로 남은 것)는 수정발행 때 걷어낸다.
 */
import * as fs from 'fs';
import * as path from 'path';

const source = fs.readFileSync(
  path.join(__dirname, '..', 'electron/ui/modules/ad-slots.js'), 'utf-8',
);

/** 브라우저 ES 모듈 — localStorage 만 채워 평가한다 */
function loadAdSlots(): any {
  const body = source.replace(/^\s*export\s+/gm, '').replace(/^\s*import\s.*$/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function('localStorage', `${body}; return { makeAdSlotHtml, expandAdSlots, collapseAdBlocks };`)(
    { getItem: () => null, setItem: () => {} },
  );
}

const { makeAdSlotHtml, expandAdSlots, collapseAdBlocks } = loadAdSlots();

const UNIT = {
  id: 'ad-1',
  name: '수동광고',
  code: '<ins class="adsbygoogle" data-ad-client="ca-pub-4008574892672964" data-ad-slot="6129452437"></ins>'
    + '<script>(adsbygoogle=window.adsbygoogle||[]).push({})</script>',
};

describe('① 두 겹 자리표시자가 통째로 광고 코드가 된다', () => {
  const html = `<p>앞 문단</p>${makeAdSlotHtml(UNIT)}<p>뒤 문단</p>`;
  const r = expandAdSlots(html, [UNIT]);

  it('⭐⭐ 안내 줄이 발행물에 남지 않는다 (사장님이 본 그 문구)', () => {
    expect(r.html).not.toContain('bgpt-ad-slot-detail');
    expect(r.html).not.toContain('· slot');
  });

  it('⭐⭐ 광고 코드가 실제로 들어간다', () => {
    expect(r.expanded).toBe(1);
    expect(r.html).toContain('data-ad-slot="6129452437"');
    expect(r.html).toContain('adsbygoogle');
  });

  it('⭐⭐ 앞뒤 문단은 글자 하나 안 바뀐다', () => {
    expect(r.html).toContain('<p>앞 문단</p>');
    expect(r.html).toContain('<p>뒤 문단</p>');
  });

  it('⭐⭐ 잉여 닫힘 태그를 남기지 않는다 (남으면 이후 레이아웃이 통째로 어긋난다)', () => {
    const opens = (r.html.match(/<div\b/g) || []).length;
    const closes = (r.html.match(/<\/div>/g) || []).length;
    expect(opens).toBe(closes);
  });
});

describe('② 되접기(다시 열기)도 왕복이 맞는다', () => {
  it('⭐⭐ 발행물 → 편집기 → 발행물이 같은 결과를 낸다', () => {
    const published = expandAdSlots(`<p>본문</p>${makeAdSlotHtml(UNIT)}`, [UNIT]).html;
    const reopened = collapseAdBlocks(published, [UNIT]);
    expect(reopened).toContain('bgpt-ad-slot');
    expect(reopened).not.toContain('adsbygoogle');   // 편집기에 스크립트 원문이 깔리면 안 된다
    const republished = expandAdSlots(reopened, [UNIT]).html;
    expect(republished).toContain('data-ad-slot="6129452437"');
    expect(republished).not.toContain('bgpt-ad-slot-detail');
  });

  it('⭐⭐ 광고 코드가 div 를 품어도 깨지지 않는다 (일부 네트워크 코드)', () => {
    const divUnit = { id: 'ad-2', name: 'div광고', code: '<div class="net-wrap"><div class="net-inner">AD</div></div>' };
    const published = expandAdSlots(makeAdSlotHtml(divUnit), [divUnit]).html;
    const reopened = collapseAdBlocks(published, [divUnit]);
    expect(reopened).toContain('bgpt-ad-slot');
    expect(reopened).not.toContain('net-inner');
  });
});

describe('③ 이미 발행된 글의 잔해를 청소한다', () => {
  it('⭐⭐ v3.8.489 로 발행된 글의 안내 줄 잔해가 수정발행 때 사라진다', () => {
    const legacy = '<p>본문</p><div class="bgpt-ad-slot-detail">client ca-pub-… · slot … · format auto</div>';
    const r = expandAdSlots(legacy + makeAdSlotHtml(UNIT), [UNIT]);
    expect(r.html).not.toContain('bgpt-ad-slot-detail');
    expect(r.html).toContain('<p>본문</p>');
  });

  it('⭐ 등록이 삭제된 단위의 자리표시자는 통째로 지운다 (안내 문구 발행 금지)', () => {
    const r = expandAdSlots(makeAdSlotHtml(UNIT), []);   // 단위 목록이 비어 있다
    expect(r.missing).toBe(1);
    expect(r.html).not.toContain('광고 자리');
    expect(r.html).not.toContain('· slot');
  });
});
