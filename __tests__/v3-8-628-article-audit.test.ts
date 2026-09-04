import {
  auditArticle,
  summarizeAudit,
  toPlainText,
  splitAuditSections,
  findGluedSentences,
  findCrossSectionEchoes,
  findTermFloods,
  findMissingLegalBasis,
  findToneMix,
  findBrokenTitles,
} from '../src/core/final/article-audit';

/*
 * v3.8.628 — 글 품질 하네스.
 *
 * 사장님: "글이 개판이면 이탈률이 어마어마해서안되 확인제대로해"
 *
 * 발행글 하나(2026-09-04, 성과급 파업 지침)를 손으로 읽어 결함 여섯을 찾았고,
 * 이 하네스가 그 여섯을 자동으로 잡는지 확인한다. 손으로 찾은 것을 못 잡으면
 * 하네스가 아니라 장식이다.
 *
 * 실측 결과: 45점 — 붙은 문장 6 · 구간 반복 2 · 낱말 도배 1 · 근거 없음 1 · 말투 섞임 1
 */
describe('v3.8.628 글 품질 하네스', () => {
  describe('① 마침표 뒤에 붙은 문장', () => {
    test('실제로 발행된 그 대목을 잡는다', () => {
      const 실물 = '산식에 들어갔는지부터 보세요.영업이익 N% 요구라면 자율 협의 영역입니다.';
      expect(findGluedSentences(실물)).toHaveLength(1);
    });

    test('정상 문장은 안 잡는다 — 마침표 뒤에 공백이 있으면 통과', () => {
      expect(findGluedSentences('첫 문장입니다. 둘째 문장입니다.')).toHaveLength(0);
      expect(findGluedSentences('첫 문장입니다.\n둘째 문장입니다.')).toHaveLength(0);
    });

    test('소수점과 날짜를 문장으로 착각하지 않는다', () => {
      expect(findGluedSentences('금리가 3.5퍼센트입니다.')).toHaveLength(0);
      expect(findGluedSentences('2026.09.04기준으로 바뀝니다.')).toHaveLength(0);
    });

    test('영문 뒤 마침표는 잡지 않는다 — 한글이 이어질 때만 본다', () => {
      expect(findGluedSentences('Inc. 라는 표기를 씁니다.')).toHaveLength(0);
    });
  });

  describe('② 구간끼리 같은 말 — 이탈의 주범', () => {
    const 같은말 = [
      { heading: '1. 기준', text: '영업이익과 매출 등 기업이익의 일정 비율을 요구하는 성과급은 의무 교섭 대상이 아닙니다.' },
      { heading: '2. 판단', text: '영업이익과 매출 등 기업이익의 일정 비율을 요구하는 성과급은 의무 교섭 대상이 아닙니다.' },
    ];

    test('두 구간이 같은 문장을 반복하면 잡는다', () => {
      const found = findCrossSectionEchoes(같은말);
      expect(found).toHaveLength(1);
      expect(found[0]!.title).toContain('1. 기준');
      expect(found[0]!.title).toContain('2. 판단');
    });

    test('증거로 양쪽 문장을 함께 보여준다 — 지어내지 않는다', () => {
      const [issue] = findCrossSectionEchoes(같은말);
      expect(issue!.evidence).toContain('앞:');
      expect(issue!.evidence).toContain('뒤:');
    });

    test('주제가 같아도 내용이 다르면 안 잡는다', () => {
      const 다른말 = [
        { heading: '1', text: '영업이익 연동 성과급은 교섭 대상에서 빠집니다. 산식이 판단의 출발점입니다.' },
        { heading: '2', text: '취업규칙에 지급 기준이 적혀 있으면 이행을 요구할 수 있습니다. 문서를 먼저 확인하세요.' },
      ];
      expect(findCrossSectionEchoes(다른말)).toHaveLength(0);
    });

    /**
     * 실측 오탐: "근거: 고용노동부 2026년 9월 3일"(5낱말)이 날짜를 언급한 모든 문장과
     * 겹쳐 5건이 잘못 잡혔다. 짧은 쪽 기준(min)으로 재던 것을 합집합 기준으로 바꿔 고쳤다.
     */
    test('짧은 문구가 아무 데나 걸리지 않는다', () => {
      const 짧은것 = [
        { heading: '요약', text: '근거: 고용노동부 2026년 9월 3일 발표한 내용입니다.' },
        { heading: '본문', text: '2026년 9월 3일 고용노동부 지침은 기업이익 연동형 성과급을 둘러싼 파업의 목적을 따져 보게 합니다.' },
      ];
      expect(findCrossSectionEchoes(짧은것)).toHaveLength(0);
    });
  });

  describe('② 한 낱말 도배', () => {
    test('같은 낱말이 1,000자당 2.4회를 넘으면 잡는다', () => {
      // 1,500자 문턱을 넘겨야 검사가 돈다 (짧은 글은 표본이 적어 우연이다)
      const 도배 = '기업이익 배분 요구는 신중하게 살펴야 합니다. '.repeat(80);
      const found = findTermFloods(도배, 80);
      expect(found.length).toBeGreaterThan(0);
      expect(found[0]!.title).toContain('기업이익');
    });

    test('짧은 글에는 적용하지 않는다 — 표본이 적으면 우연이다', () => {
      expect(findTermFloods('성과급 성과급 성과급', 3)).toHaveLength(0);
    });

    test('주제어가 정상 빈도면 안 잡는다', () => {
      // 주제어가 나오되 같은 낱말이 몰리지 않는 글
      const 어휘 = ['지급 기준을 살핍니다', '문서를 대조합니다', '요구안을 펼칩니다', '산식을 확인합니다', '규정을 읽습니다', '조항을 찾습니다', '사례를 봅니다', '절차를 밟습니다'];
      let 정상 = '성과급 기준을 설명합니다. ';
      for (let i = 0; i < 120; i++) 정상 += 어휘[i % 어휘.length] + '. ';
      expect(findTermFloods(정상, 120)).toHaveLength(0);
    });
  });

  describe('④ 근거 조항', () => {
    test('제도 글에 조문이 하나도 없으면 잡는다', () => {
      expect(findMissingLegalBasis('고용노동부 지침에 따르면 대상이 아닙니다.')).toHaveLength(1);
    });

    test('조문이 있으면 통과', () => {
      expect(findMissingLegalBasis('노동조합법 제2조에 따라 판단합니다. 지침도 같은 취지입니다.')).toHaveLength(0);
    });

    test('판례 번호도 근거로 인정한다', () => {
      expect(findMissingLegalBasis('대법원 2022다12345 판결이 기준입니다. 지침도 같습니다.')).toHaveLength(0);
    });

    test('제도 글이 아니면 조문을 요구하지 않는다', () => {
      expect(findMissingLegalBasis('오늘 저녁 메뉴를 골랐습니다.')).toHaveLength(0);
    });
  });

  describe('⑤ 말투 섞임', () => {
    test('해요체와 합니다체가 비슷하게 섞이면 잡는다', () => {
      const 섞임 = '이렇게 해요. '.repeat(15) + '이렇게 합니다. '.repeat(15);
      const { issues, polite, formal } = findToneMix(섞임);
      expect(issues).toHaveLength(1);
      expect(polite).toBeGreaterThan(10);
      expect(formal).toBeGreaterThan(10);
    });

    test('한쪽으로 굳어진 문체는 통과 — 취향을 강요하지 않는다', () => {
      const 통일 = '이렇게 합니다. '.repeat(30) + '가끔 이래요. ';
      expect(findToneMix(통일).issues).toHaveLength(0);
    });

    test('표본이 적으면 판단하지 않는다', () => {
      expect(findToneMix('해요. 합니다.').issues).toHaveLength(0);
    });
  });

  describe('⑥ 제목 손상', () => {
    test('앞이 잘려 숫자로 시작하는 소제목을 잡는다', () => {
      // 실측: "9·3 노동부 지침 확인 요령" 이 "3 노동부 지침 확인 요령" 으로 잘렸다
      expect(findBrokenTitles(['3 노동부 지침 확인 요령'])).toHaveLength(1);
      expect(findBrokenTitles(['·3 노동부 지침'])).toHaveLength(1);
    });

    test('정상 번호 매김은 잡지 않는다', () => {
      expect(findBrokenTitles(['1. 성과급 요구 파업 적법선 보기', '2) 확인 요령'])).toHaveLength(0);
    });

    test('평범한 소제목은 통과', () => {
      expect(findBrokenTitles(['산식에서 갈리는 경계', 'FAQ'])).toHaveLength(0);
    });
  });

  describe('묶어서 — 점수와 요약', () => {
    test('깨끗한 글은 100점', () => {
      const 좋은글 = '<h2>기준</h2><p>노동조합법 제2조에 따라 판단합니다. 산식이 출발점입니다.</p>';
      const r = auditArticle(좋은글);
      expect(r.score).toBe(100);
      expect(summarizeAudit(r)).toContain('잡은 것이 없습니다');
    });

    test('문제가 많을수록 점수가 낮다 — 감점식이라 되짚을 수 있다', () => {
      const 나쁜글 = '<h2>기준</h2><p>고용노동부 지침입니다.그래서 이렇게 합니다.또 이렇습니다.</p>';
      const r = auditArticle(나쁜글);
      expect(r.score).toBeLessThan(100);
      expect(r.issues.length).toBeGreaterThan(0);
      // 감점의 합이 정확히 100 에서 깎인 만큼이어야 한다
      const 합 = r.issues.reduce((s, i) => s + i.penalty, 0);
      expect(r.score).toBe(Math.max(0, 100 - 합));
    });

    test('요약은 무엇이 몇 건인지 말한다', () => {
      const r = auditArticle('<h2>기준</h2><p>고용노동부 지침입니다.그래서 이렇습니다.</p>');
      expect(summarizeAudit(r)).toMatch(/점 —/);
    });

    test('통계에 재는 데 쓴 값이 남는다 — 판정만 주면 못 믿는다', () => {
      const r = auditArticle('<h2>기준</h2><p>노동조합법 제2조입니다.</p>');
      expect(r.stats.chars).toBeGreaterThan(0);
      expect(r.stats.legalRefs).toBe(1);
    });

    test('빈 입력에도 터지지 않는다', () => {
      expect(auditArticle('').score).toBe(100);
      expect(toPlainText('')).toBe('');
      expect(splitAuditSections('')).toEqual([]);
    });
  });

  describe('평문 변환 — 재는 대상이 정확해야 한다', () => {
    test('태그를 걷고 문단 경계는 줄바꿈으로 남긴다', () => {
      const out = toPlainText('<p>첫 문단</p><p>둘째 문단</p>');
      expect(out).toContain('첫 문단');
      expect(out).toContain('둘째 문단');
      expect(out).not.toContain('<p>');
      // 문단이 붙어버리면 ① 검사가 헛것을 잡는다
      expect(out).toMatch(/첫 문단\s*\n\s*둘째 문단/);
    });

    test('스크립트·스타일 안의 글자는 본문으로 세지 않는다', () => {
      const out = toPlainText('<style>.a{color:red}</style><script>var x=1</script><p>본문</p>');
      expect(out).not.toContain('color');
      expect(out).not.toContain('var x');
      expect(out).toContain('본문');
    });
  });
});
