import {
  findAssertedCrimes,
  findLegalOverreach,
  findUnsourcedReadings,
  findMoneyConfusion,
  findSettlementStretch,
  findUnverifiedFirstClaims,
  findPersonalVoice,
  findHedgeRepeats,
  findBloatedConclusion,
  auditClaimSafety,
} from '../src/core/final/claim-safety';

/*
 * v3.8.629 — 주장과 확정 사실을 가르는 검사.
 *
 * 사장님이 사건·분쟁 글에서 지킬 것을 열 가지로 정리해 주었다.
 * 핵심은 하나 — **수사·판결 전 사건을 확정된 것처럼 쓰면 안 된다.**
 * 품질 문제가 아니라 법적 위험이다. 확정형 문장 하나가 명예훼손이 된다.
 *
 * 그래서 이 검사들은 **틀리면 안 되는 쪽이 양쪽 다**이다:
 *   못 잡으면 → 위험한 글이 나간다
 *   헛것을 잡으면 → 멀쩡한 문장을 지우게 된다
 * 두 방향을 모두 시험한다.
 */
describe('v3.8.629 주장·사실 구분', () => {
  describe('① 확정형 범죄 표현', () => {
    test('판결 전인데 단정한 문장을 잡는다', () => {
      expect(findAssertedCrimes('A씨가 7억 원을 횡령했다.')).toHaveLength(1);
      expect(findAssertedCrimes('피해를 입혔다는 말이 나온다.')).toHaveLength(1);
      expect(findAssertedCrimes('돈을 가로챘다.')).toHaveLength(1);
    });

    test('주장형으로 쓴 문장은 통과 — 이게 올바른 형태다', () => {
      expect(findAssertedCrimes('A씨가 횡령 혐의를 주장했다.')).toHaveLength(0);
      expect(findAssertedCrimes('횡령이 있었다고 밝혔다.')).toHaveLength(0);
      expect(findAssertedCrimes('사기죄를 거론했다.')).toHaveLength(0);
    });

    test('같은 표현이 여러 번이어도 한 번만 지적한다 — 목록이 길면 안 읽는다', () => {
      expect(findAssertedCrimes('횡령했다. 또 횡령했다. 다시 횡령했다.')).toHaveLength(1);
    });
  });

  describe('④ 법률 용어 확대', () => {
    test('거론한 죄명을 적용된 것처럼 쓰면 잡는다', () => {
      expect(findLegalOverreach('사기죄가 적용됐다.')).toHaveLength(1);
      expect(findLegalOverreach('횡령죄가 성립된다.')).toHaveLength(1);
    });

    test('거론 수준의 표현은 통과', () => {
      expect(findLegalOverreach('사기죄를 거론했다.')).toHaveLength(0);
      expect(findLegalOverreach('법적 대응 의사를 밝혔다.')).toHaveLength(0);
    });
  });

  describe('② 출처 없는 해석', () => {
    test('누가 말했는지 없는 추측을 잡는다', () => {
      expect(findUnsourcedReadings('상황이 바뀐 것으로 보인다.')).toHaveLength(1);
      expect(findUnsourcedReadings('영향이 크다는 분석이다.')).toHaveLength(1);
    });

    /** 출처를 댔으면 그건 추측이 아니라 인용이다 */
    test('가까이에 출처가 있으면 통과', () => {
      expect(findUnsourcedReadings('경찰이 밝힌 바에 따르면 상황이 바뀐 것으로 보인다.')).toHaveLength(0);
      expect(findUnsourcedReadings('업계 관계자는 영향이 크다는 분석이다라고 전했다.')).toHaveLength(0);
    });
  });

  describe('⑦ 금액 성격 뒤섞임', () => {
    const 사례 = '전체 피해액은 8억 원 이상이라는 주장이다. 차용증에는 1억5천만 원이 적혀 있다.';

    test('전체 주장액과 증거 속 금액이 함께 나오면 확인하라고 알린다', () => {
      const found = findMoneyConfusion(사례);
      expect(found).toHaveLength(1);
      expect(found[0]!.title).toContain('8억 원');
    });

    /** 실측 실수: 앞 단위만 보다가 "1억5천만 원" 을 "5천만 원" 으로 읽었다 */
    test('"1억5천만 원" 처럼 단위가 이어져도 통째로 읽는다', () => {
      expect(findMoneyConfusion(사례)[0]!.title).toContain('1억5천만 원');
    });

    test('금액이 하나뿐이면 알리지 않는다', () => {
      expect(findMoneyConfusion('차용증에 1억5천만 원이 적혀 있고 전체 피해액도 같다.')).toHaveLength(0);
    });

    test('증거 자료 이야기가 없으면 알리지 않는다 — 아무 글이나 걸면 안 된다', () => {
      expect(findMoneyConfusion('지원금은 100만 원, 추가 지급은 50만 원입니다.')).toHaveLength(0);
    });
  });

  describe('⑤ 합의로 확대 · ⑥ 미확인 최초 표현 · ③ 개인 의견', () => {
    test('사과 요구를 합의로 넓히면 잡는다', () => {
      expect(findSettlementStretch('합의 가능성도 거론된다.')).toHaveLength(1);
      expect(findSettlementStretch('대화의 여지를 남겼다.')).toHaveLength(0);
    });

    test('과거 기록을 확인해야 쓸 수 있는 표현을 잡는다', () => {
      expect(findUnverifiedFirstClaims('최초 폭로 이후 상황이 바뀌었다.')).toHaveLength(1);
      expect(findUnverifiedFirstClaims('이번 SNS 글에서 밝힌 내용이다.')).toHaveLength(0);
    });

    test('작성자 개인 의견을 잡는다', () => {
      expect(findPersonalVoice('제 기준으로는 이렇습니다.')).toHaveLength(1);
      expect(findPersonalVoice('아무튼 정리하면 이렇다.')).toHaveLength(1);
      expect(findPersonalVoice('정리하면 이렇습니다.')).toHaveLength(0);
    });
  });

  describe('⑧ 같은 단서 되풀이', () => {
    test('세 번을 넘기면 잡는다 — 두 번까지는 정상이다', () => {
      expect(findHedgeRepeats('법적 판단 전이다. 법적 판단 전이다.')).toHaveLength(0);
      expect(findHedgeRepeats('법적 판단 전이다. 법적 판단 전이다. 법적 판단 전이다.')).toHaveLength(1);
    });

    test('몇 번 나왔는지 숫자로 말한다', () => {
      const [issue] = findHedgeRepeats('당사자 주장 '.repeat(5));
      expect(issue!.title).toContain('5번');
    });
  });

  describe('⑨ 결론 압축', () => {
    test('마지막 문단이 길면 잡는다', () => {
      expect(findBloatedConclusion(['앞', '가'.repeat(500)])).toHaveLength(1);
    });

    test('짧게 정리한 결론은 통과', () => {
      expect(findBloatedConclusion(['앞 내용', '현재 수사가 진행 중이며 피해 주장액은 8억 원입니다.'])).toHaveLength(0);
    });

    test('빈 문단은 결론으로 세지 않는다', () => {
      expect(findBloatedConclusion(['가'.repeat(500), '   ', ''])).toHaveLength(1);
    });
  });

  describe('묶어서', () => {
    test('위험한 글에서 열 가지가 함께 잡힌다', () => {
      const 위험 = 'A씨가 7억 원을 횡령했다. 피해를 입혔다. 차용증에는 1억5천만 원이 적혀 있다. '
        + '전체 피해액은 8억 원이다. 사기죄가 적용됐다. 합의 가능성도 있다는 분석이다. '
        + '최초 폭로 이후 바뀐 것으로 보인다. 제 기준으로는 아무튼 그렇다. '
        + '법적 판단 전이다. 법적 판단 전이다. 법적 판단 전이다.';
      const issues = auditClaimSafety(위험, [위험]);
      const kinds = new Set(issues.map((i) => i.kind));
      expect(kinds.has('asserted-crime')).toBe(true);
      expect(kinds.has('legal-overreach')).toBe(true);
      expect(kinds.has('unsourced-reading')).toBe(true);
      expect(kinds.has('money-confusion')).toBe(true);
      expect(kinds.has('settlement-stretch')).toBe(true);
      expect(kinds.has('unverified-first')).toBe(true);
      expect(kinds.has('personal-voice')).toBe(true);
      expect(kinds.has('hedge-repeat')).toBe(true);
    });

    test('정보성 글은 하나도 안 걸린다 — 헛것을 잡으면 멀쩡한 문장을 지우게 된다', () => {
      const 정상 = '국민연금 수령액은 가입 기간에 따라 달라집니다. 국민연금공단이 2026년 9월 발표한 자료에 따르면 '
        + '평균 수령액은 62만 원입니다. 신청은 지사 방문 또는 온라인으로 할 수 있습니다.';
      expect(auditClaimSafety(정상, [정상])).toHaveLength(0);
    });

    test('주장형으로 제대로 쓴 사건 글도 안 걸린다', () => {
      const 올바름 = 'A씨는 SNS 글에서 7억 원 상당의 피해를 주장했습니다. 이번에 공개한 차용증에는 '
        + '1억5천만 원이 적혀 있다고 밝혔습니다. A씨는 사기죄를 거론하며 법적 대응 의사를 밝혔습니다. '
        + '상대측은 아직 입장을 내지 않았습니다.';
      const issues = auditClaimSafety(올바름, [올바름]);
      const kinds = issues.map((i) => i.kind);
      expect(kinds).not.toContain('asserted-crime');
      expect(kinds).not.toContain('legal-overreach');
    });
  });
});
