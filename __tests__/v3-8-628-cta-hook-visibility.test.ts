const fs = require('fs');
const path = require('path');

export {};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.628 — CTA 카드의 훅 문구가 배경에 묻혀 안 보이던 문제.
 *
 * 사장님 실물 검수: "문단정리랑 후킹문구 잘보이게 해달라했는데 제대로안해놧네?"
 *
 * ## 원인 두 가지 — 둘 다 발행 시점에서 생겼다
 *
 * ① orchestration 의 FINAL_CTA_HOOK_STYLE 은 훅에 **흰 알약**(배경·여백·둥근모서리)을
 *    씌운다. 그런데 워드프레스 퍼블리셔가 <p class="cta-hook"> 의 style 을 통째로
 *    다시 쓰면서 **배경만 빠뜨렸다.** 진한 남색 글자(#0f172a)가 진한 초록 카드 위에
 *    얹히니 읽을 수가 없었다.
 *
 * ② 알약 안의 <strong> 에 본문용 형광펜(아래 40% 색띠)이 그어져 **취소선처럼** 보였다.
 *
 * 알약은 카드 바탕색이 무엇이든 대비를 보장한다 — 그래서 배경을 되살리는 쪽으로 고쳤다.
 */
describe('v3.8.628 CTA 훅 문구는 어떤 카드 위에서도 읽힌다', () => {
  const publisher = read('src/wordpress/wordpress-publisher.ts');

  /** 파일에 적힌 정규식을 그대로 꺼내 쓴다 — 베껴 쓰면 실물과 어긋난다. */
  function hookStrongRegex(): RegExp {
    const line = publisher
      .split('\n')
      .find((l: string) => l.includes('cta-hook') && l.includes('<strong') && l.includes('/gi,'));
    expect(line).toBeTruthy();
    const m = String(line).match(/^\s*\/(.+)\/gi,\s*$/);
    expect(m).toBeTruthy();
    return new RegExp(String(m![1]), 'gi');
  }

  describe('① 흰 알약이 살아 있다', () => {
    const style = (() => {
      const at = publisher.indexOf('const ctaHookStyle =');
      expect(at).toBeGreaterThan(-1);
      return publisher.slice(at, publisher.indexOf('`;', at));
    })();

    test('배경을 준다 — 이것이 빠져서 글자가 묻혔다', () => {
      expect(style).toContain('background: #ffffff !important');
    });

    test('글자색은 진하게 — 흰 알약 위에서 읽혀야 한다', () => {
      expect(style).toContain('color: #0f172a !important');
      expect(style).toContain('-webkit-text-fill-color: #0f172a !important');
    });

    test('알약 모양을 갖춘다 — 배경만 있고 여백이 없으면 글자가 끼인다', () => {
      expect(style).toContain('display: inline-block !important');
      expect(style).toContain('padding: 8px 14px !important');
      expect(style).toContain('border-radius: 8px !important');
    });

    test('여러 줄로 접혀도 알약이 이어진다', () => {
      expect(style).toContain('box-decoration-break: clone !important');
      expect(style).toContain('-webkit-box-decoration-break: clone !important');
    });
  });

  describe('② 알약 안의 강조에는 형광펜을 긋지 않는다', () => {
    const re = hookStrongRegex();
    const 훅 = '<p class="cta-hook" style="display: inline-block">\n  <strong style="color: #0f172a !important; background: linear-gradient(180deg, transparent 60%, #d1fae5 40%) !important;">운영 기관의 원문 안내로 이어집니다.</strong></p>';
    const 바꾸기 = (html: string) => html.replace(
      new RegExp(re.source, 'gi'),
      '$1<strong style="color: inherit !important; -webkit-text-fill-color: inherit !important; background: none !important; font-weight: 800 !important;">',
    );

    test('훅 안의 strong 이 실제로 걸린다', () => {
      expect(바꾸기(훅)).not.toBe(훅);
    });

    test('형광펜이 사라지고 색을 물려받는다', () => {
      const out = 바꾸기(훅);
      expect(out).not.toContain('linear-gradient');
      expect(out).toContain('color: inherit');
      expect(out).toContain('background: none');
    });

    test('줄바꿈이 사이에 있어도 걸린다 — \\s 가 깨지면 여기서 잡힌다', () => {
      const 붙은것 = '<p class="cta-hook"><strong>훅</strong></p>';
      const 띄운것 = '<p class="cta-hook">\n\n   <strong>훅</strong></p>';
      expect(바꾸기(붙은것)).not.toBe(붙은것);
      expect(바꾸기(띄운것)).not.toBe(띄운것);
    });

    test('본문 강조는 그대로 둔다 — 형광펜은 본문에서 쓸모가 있다', () => {
      const 본문 = '<p class="article-p"><strong style="background: linear-gradient(180deg, transparent 60%, #d1fae5 40%)">본문 강조</strong></p>';
      expect(바꾸기(본문)).toBe(본문);
    });

    test('비슷한 이름의 클래스에 잘못 걸리지 않는다', () => {
      const 남 = '<p class="cta-hooking-x"><strong>다른 것</strong></p>';
      expect(바꾸기(남)).toBe(남);
    });
  });

  describe('③ 순서 — 형광펜을 그은 뒤에 벗겨야 한다', () => {
    test('strong 규칙보다 뒤에 온다', () => {
      const strong규칙 = publisher.indexOf("styledHtml.replace(/<strong\\b([^>]*)>/gi");
      const 벗기기 = publisher.indexOf('cta-hook');
      const 벗기기줄 = publisher.split('\n').findIndex((l: string) => l.includes('cta-hook') && l.includes('<strong') && l.includes('/gi,'));
      const strong줄 = publisher.split('\n').findIndex((l: string) => l.includes('replace(/<strong'));
      expect(strong규칙).toBeGreaterThan(-1);
      expect(벗기기).toBeGreaterThan(-1);
      // 앞에 두면 곧바로 덮인다
      expect(벗기기줄).toBeGreaterThan(strong줄);
    });
  });

  describe('④ 만드는 쪽도 알약을 준다 — 미리보기와 발행이 같아야 한다', () => {
    const orchestration = read('src/core/final/orchestration.ts');
    const at = orchestration.indexOf('const FINAL_CTA_HOOK_STYLE');
    const style = orchestration.slice(at, orchestration.indexOf(';\n', at));

    test('미리보기에도 배경·여백·둥근모서리가 있다', () => {
      expect(style).toContain('display:inline-block');
      expect(style).toContain('border-radius:8px');
      expect(style).toMatch(/background:[^;]*rgba\(255,255,255/);
    });
  });
});
