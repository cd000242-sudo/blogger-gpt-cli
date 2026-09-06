import { findTermFloods, auditArticle } from '../src/core/final/article-audit';
import { repairGluedQuotes, autoRepairBeforePublish } from '../src/core/final/auto-repair';

/*
 * v3.8.680 — 679 빌드 라이브 1편(양육비, 86점)을 읽고 남은 셋.
 *  · "선지급" 31번이 낱말 되풀이(-6) — 제목의 낱말은 주제어다(소제목 낱말만 봐주고 있었다)
 *  · 서론 속말 따옴표가 `"…했지""상대가…"` 로 붙어 나갔다 — 닫는 따옴표와 여는 따옴표 사이에 공백
 *  · 서론↔절 되풀이 1건은 자가 수정 몫(이번엔 다른 구간을 골랐다) — 코드로는 안 건드린다
 */
describe('v3.8.680 네 번째 라이브 읽기 — 제목 낱말은 주제어 · 붙은 따옴표', () => {
  test('제목의 낱말은 소제목 낱말과 같은 상한(6.0/1000자)을 받는다', () => {
    const body = ('양육비 선지급 탈락은 이렇게 갈려요. ' + '다른 설명 문장이에요. '.repeat(3)).repeat(30);   // 선지급 30번, 약 3,900자 → 7.7/1000
    const withTitle = findTermFloods(body, 120, ['1. 신청 요건', '양육비 선지급 탈락 사유 소득기준 폐지 후에도 남는 신청 요건']);
    expect(withTitle.some((i) => /선지급/.test(i.title))).toBe(true);    // 주제어라도 7.7 은 과하다
    const light = ('양육비 선지급 탈락은 이렇게 갈려요. ' + '다른 설명 문장이에요. '.repeat(12)).repeat(30);   // 선지급 30번 / 약 5,300자 → 5.7/1000
    expect(findTermFloods(light, 210, ['1. 신청 요건', '양육비 선지급 탈락 사유']).some((i) => /선지급/.test(i.title))).toBe(false);
    expect(findTermFloods(light, 210, ['1. 신청 요건']).some((i) => /선지급/.test(i.title))).toBe(true);   // 제목 없이는 일반 낱말 상한
    const html = '<h1>양육비 선지급 탈락 사유</h1><h2>1. 절</h2><p>' + light + '</p>';
    expect(auditArticle(html, [], { title: '양육비 선지급 탈락 사유' }).issues.some((i) => i.kind === 'term-flood' && /선지급/.test(i.title))).toBe(false);
  });

  test('붙은 따옴표 사이에 공백을 넣는다 — 태그 안은 그대로', () => {
    const r = repairGluedQuotes('<p>이런 생각이 먼저 들어요."소득기준이 없어졌는데 왜 탈락했지""상대가 조금 보냈는데 끊기는 건가"</p><a href="x" title="a""b">z</a>');
    expect(r.count).toBe(2);   // 마침표 뒤 여는 따옴표 하나 + 닫는·여는 따옴표 사이 하나
    expect(r.html).toContain('들어요. "소득기준이 없어졌는데 왜 탈락했지" "상대가 조금 보냈는데 끊기는 건가"');
    expect(r.html).toContain('title="a""b"');
    expect(repairGluedQuotes('<p>"하나" "둘"</p>').count).toBe(0);
    const all = autoRepairBeforePublish('<h1>t</h1><p>' + '속말이에요."왜 탈락이지""다시 내야 하나" 하고요. '.repeat(12) + '</p>');
    expect(all.repairs.map((x) => x.kind)).toContain('glued-quote');
  });
});
