/**
 * "공식 사이트"라며 엉뚱한 곳으로 보내던 CTA · 테두리만 남은 빈 상자 (v3.8.719)
 *
 * ## 실물 검수 (발행글 5710 — 변호사 손님께 보여드릴 글)
 *   · 버튼: "🔗 공식 사이트 바로가기 — 운영 주체가 직접 안내하는 페이지입니다"
 *     실제 목적지: postmate.waffle-gl.org/link/detail/... (정체불명 링크 중계)
 *   · 사장님: "이거 공란도" → 빈 `<blockquote class="bgpt-s11"></blockquote>` 4개
 *
 * 두 건 다 **막는 코드는 이미 있었다.**
 *   · host-trust 는 그 주소를 넣으면 {ok:false, reason:'redirector'} 를 돌려준다
 *   · empty-block-guard 는 빈 블록을 걷어낸다
 * 문제는 **이 글을 만든 경로가 둘 다 안 불렀다**는 것. 그래서 이 테스트는 기능보다
 * **배선**을 잠근다 — 오늘 아침 wpautop 건과 같은 실패 모양이기 때문이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { removeEmptyDecorativeBoxes } from '../src/core/final/empty-block-guard';
import { judgeCtaHost, ctaDestinationAllowed } from '../src/cta/host-trust';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const BAD_URL = 'https://postmate.waffle-gl.org/link/detail/sowa10/224329434927';

describe('① 판정기는 원래 맞았다 (고장난 건 배선이었다)', () => {
  it('⭐⭐ 그 주소를 중계 사이트로 판정한다', () => {
    const verdict = judgeCtaHost(BAD_URL);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('redirector');
  });
});

describe('② CTA 목적지 문지기', () => {
  it('⭐⭐ 믿을 수 없는 목적지는 막는다', () => {
    const gate = ctaDestinationAllowed(BAD_URL);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('redirector');
  });

  it('⭐⭐ 진짜 기관 주소는 통과시킨다', () => {
    expect(ctaDestinationAllowed('https://www.law.go.kr/').allowed).toBe(true);
    expect(ctaDestinationAllowed('https://www.scourt.go.kr/').allowed).toBe(true);
    expect(ctaDestinationAllowed('https://www.gov.kr/').allowed).toBe(true);
  });

  it('⭐⭐ 제휴 링크는 기관 검사 대상이 아니다 (쇼핑 CTA 가 죽으면 안 된다)', () => {
    const gate = ctaDestinationAllowed('https://link.coupang.com/a/abc', 'nofollow sponsored noopener');
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBe('sponsored');
  });

  it('⭐⭐ 근거를 못 찾은 도메인은 막지 않는다 (문맥을 아는 앞 단계가 골랐을 수 있다)', () => {
    const gate = ctaDestinationAllowed('https://some-private-official.com/');
    expect(gate.allowed).toBe(true);
  });

  it('⭐ 주소가 없으면 예전과 똑같이 지나간다', () => {
    expect(ctaDestinationAllowed(undefined).allowed).toBe(true);
    expect(ctaDestinationAllowed('#').allowed).toBe(true);
  });

  it('⭐⭐ 문지기는 HTML 을 만드는 자리에 있다 — 경로가 늘어도 못 빠져나간다', () => {
    const orch = read('src/core/final/orchestration.ts');
    const renderer = orch.slice(
      orch.indexOf('export function renderFinalCtaBlock'),
      orch.indexOf('const badge = input.badge'),
    );
    expect(renderer).toContain('ctaDestinationAllowed');
    expect(renderer).toMatch(/if \(!gate\.allowed\)/);
    expect(renderer).toMatch(/return '';/);
  });

  it('⭐⭐ 판단은 테스트가 읽을 수 있는 자리에 둔다 (렌더러 안에 숨기지 않는다)', () => {
    // orchestration 은 ESM 의존성 때문에 테스트가 못 읽는다.
    // 판단이 그 안에 있으면 아무도 검증할 수 없다 — 그래서 host-trust 가 갖는다.
    const ht = read('src/cta/host-trust.ts');
    expect(ht).toContain('export function ctaDestinationAllowed');
  });
});

describe('③ 테두리만 남은 빈 상자를 걷는다', () => {
  it('⭐⭐ 빈 blockquote 는 지우고 내용 있는 것은 남긴다', () => {
    const result = removeEmptyDecorativeBoxes(
      '<p>글</p><blockquote class="bgpt-s11"></blockquote><blockquote>인용문</blockquote><blockquote>   </blockquote>',
    );
    expect(result.removed).toBe(2);
    expect(result.html).toContain('인용문');
    expect(result.html).not.toMatch(/<blockquote[^>]*>\s*<\/blockquote>/);
  });

  it('⭐⭐ 글자가 없어도 이미지·표가 들어 있으면 빈 것이 아니다', () => {
    expect(removeEmptyDecorativeBoxes('<blockquote><img src="x.jpg"></blockquote>').removed).toBe(0);
    expect(removeEmptyDecorativeBoxes('<blockquote><table><tr><td>1</td></tr></table></blockquote>').removed).toBe(0);
  });

  it('⭐ 지울 게 없으면 원본을 그대로 돌려준다', () => {
    const src = '<p>멀쩡한 글</p>';
    expect(removeEmptyDecorativeBoxes(src).html).toBe(src);
    expect(removeEmptyDecorativeBoxes(src).removed).toBe(0);
  });

  it('⭐⭐ 발행 경로에 배선돼 있고, 조건 없이 매번 돈다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain('removeEmptyDecorativeBoxes');
    const call = orch.slice(orch.indexOf('const boxes = removeEmptyDecorativeBoxes(html)'));
    expect(call).toMatch(/html = boxes\.html/);
    // findEmptyBlocks 가 세지 않는 종류라, FAQ 복구 조건 안에 들어가면 영영 안 돈다
    const faqBlock = orch.slice(
      orch.indexOf('const beforeRepair = findEmptyBlocks(html)'),
      orch.indexOf('const boxes = removeEmptyDecorativeBoxes(html)'),
    );
    expect(faqBlock).not.toContain('removeEmptyDecorativeBoxes');
  });
});
