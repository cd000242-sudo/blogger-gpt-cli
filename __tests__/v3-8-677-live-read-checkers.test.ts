import { findProcessLeak, findMissingLegalBasis, findTermFloods } from '../src/core/final/article-audit';
import { findFlowGaps } from '../src/core/final/narrative-flow';
import { toPlainText } from '../src/core/final/article-audit';
import { sanitizeAnswerText } from '../src/core/final/answer-block';
import { repairEscapedQuotes, autoRepairBeforePublish } from '../src/core/final/auto-repair';

/*
 * v3.8.677 — 676 빌드 라이브 1편(양육비, 66점)을 읽고. 글은 좋았고 검사기가 넷을 오탐했다 + 진짜 결함 하나.
 *  · "양육비이행관리원이 지급 약속을 확인할 근거가 없기 때문이에요" → 작성 과정 노출(-12)로 오탐. 제3자 주어면 독자의 상황이다
 *  · 법률 정식 명칭을 세 번 불렀는데 "제○조" 가 없다고 -10. 이름이 근거다(번호는 확인된 것만)
 *  · "있어요" 21번이 낱말 되풀이(-6). 종결 어미는 낱말이 아니다
 *  · 법령 이름이 절마다 나와 절차 반복(-6). 이름은 지우고 센다
 *  · 진짜 결함: 서론의 독자 속말이 `\"…\"` 로 나갔다 — 모델의 JSON 이스케이프
 */
describe('v3.8.677 라이브 읽기 — 검사기 오탐 넷과 이스케이프 따옴표', () => {
  test('제3자가 주어인 "확인할 근거가 없다" 는 작성 과정 노출이 아니다', () => {
    expect(findProcessLeak('집행권원 없이 신청한 경우라면 판결문부터 마련하는 쪽이 맞아요. 양육비이행관리원이 지급 약속을 확인할 근거가 없기 때문이에요.')).toHaveLength(0);
    expect(findProcessLeak('심사 담당자가 소득을 확인할 근거가 부족하면 보완을 요구해요.')).toHaveLength(0);
    // 글쓴이의 자료 부족은 여전히 잡는다
    expect(findProcessLeak('이 부분은 확인할 근거가 없어 다루지 않습니다.')).toHaveLength(1);
    expect(findProcessLeak('제공된 근거에는 부결 사유가 없으므로 넘어갑니다.')).toHaveLength(1);
  });

  test('법령 정식 명칭은 근거다', () => {
    const t = '이 제도의 적용 법령은 양육비 이행확보 및 지원에 관한 법률이에요. 지침에 따라 회수해요.';
    expect(findMissingLegalBasis(t)).toHaveLength(0);
    expect(findMissingLegalBasis('소득세법 시행령에 따라 계산해요. 지침도 있어요.')).toHaveLength(0);
    expect(findMissingLegalBasis('지침과 판례에 따르면 그렇습니다. 법률상 근거가 있습니다.')).toHaveLength(1);   // "법률상" 은 이름이 아니다
    expect(findMissingLegalBasis('제14조에 따라 그렇습니다. 지침도 그렇습니다.')).toHaveLength(0);
  });

  test('종결 어미는 낱말 되풀이가 아니다', () => {
    const body = ('신청 서류가 있어요. ' + '이 절은 다른 내용이에요. '.repeat(3)).repeat(25);
    expect(findTermFloods(body, 100).some((i) => /있어요|이에요/.test(i.title))).toBe(false);
    const flood = ('월출페이 카드로 결제해요. 월출페이 가맹점이에요. 월출페이 충전이에요. ' + '다른 문장이에요. '.repeat(2)).repeat(25);
    expect(findTermFloods(flood, 125).some((i) => /월출페이/.test(i.title))).toBe(true);
  });

  test('법령 이름은 절마다 불러도 절차 반복이 아니다', () => {
    const sec = (n: number, extra: string) => `<h2>${n}. 절 ${n}</h2><p>${Array.from({ length: 12 }, (_, i) => `${n}절${i + 1}호 설명문장${n}${i + 1}이에요. `).join('')}${extra}</p>`;
    const html = '<h1>양육비 선지급 탈락 사유</h1>' + [1, 2, 3, 4, 5].map((n) => sec(n, `${n}번 요건은 양육비 이행확보 및 지원에 관한 법률에 적혀 있어요.`)).join('');
    expect(findFlowGaps(html, toPlainText, { title: '양육비 선지급 탈락 사유' }).issues.find((i) => i.kind === 'procedure-repeat')).toBeUndefined();
  });

  test('답 상자 문장 사이 공백 · 본문의 이스케이프 따옴표', () => {
    expect(sanitizeAnswerText('요건을 충족해야 해요.최근 3개월 지급액을 봐요.자녀가 18세를 넘으면 빠져요.', 400))
      .toBe('요건을 충족해야 해요. 최근 3개월 지급액을 봐요. 자녀가 18세를 넘으면 빠져요.');
    expect(sanitizeAnswerText('금리는 3.5%예요.', 400)).toBe('금리는 3.5%예요.');
    const r = repairEscapedQuotes('<p>이런 생각이 들 수 있어요. \\"소득기준이 없어지면 모두 되는 것 아닌가요?\\" \\"탈락인가요?\\"</p><a href="x" title="a\\"b">z</a>');
    expect(r.count).toBe(4);
    expect(r.html).toContain('"소득기준이 없어지면 모두 되는 것 아닌가요?" "탈락인가요?"');
    expect(r.html).toContain('title="a\\"b"');   // 태그 안은 그대로
    const all = autoRepairBeforePublish('<h1>t</h1><p>' + '속말 \\"왜 탈락이지?\\" 가 떠올라요. '.repeat(12) + '</p>');
    expect(all.repairs.map((x) => x.kind)).toContain('escaped-quote');
    expect(all.html).not.toContain('\\"');
  });
});
