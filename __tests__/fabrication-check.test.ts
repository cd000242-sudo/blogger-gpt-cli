/**
 * 날조 검사 — 글에만 있고 재료에는 없는 수치·고유명사 (2026-08-12, 네이버 앱에서 이식)
 *
 * 사용자 지적: "AI 통해서 없는 내용 지어내고 내용도 부실하면 비웃고 지나가버리지"
 *
 * 이 검사의 생사는 오탐에 달려 있다 — "3가지 방법"을 날조라고 부르는 순간 아무도 안 본다.
 * 그래서 탐지 테스트만큼 비탐지 테스트를 촘촘히 둔다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  checkFabrication,
  extractVerifiableClaims,
  stripHtmlForCheck,
} from '../src/core/fabrication-check';

/** 대조가 켜지려면 재료가 200자를 넘어야 한다 */
const pad = (text: string) => text + '이 문단은 재료 길이를 채우기 위한 배경 설명이다. '.repeat(12);

describe('지어낸 사실 탐지', () => {
  it('재료에 없는 금액을 잡는다', () => {
    const result = checkFabrication(
      pad('지원 사업 안내문이다. 대상은 만 39세 이하 청년이며 신청은 온라인으로 받는다.'),
      '지원금은 최대 500만원까지 받을 수 있습니다.',
    );
    expect(result.checked).toBe(true);
    expect(result.findings.map(f => f.claim)).toContain('500만원');
    expect(result.warnings[0]).toContain('재료에 없는 금액');
  });

  it('재료에 없는 날짜·비율·인원을 잡는다', () => {
    const result = checkFabrication(
      pad('사업 개요만 담긴 안내문이다.'),
      '마감은 3월 31일이고 만족도는 92% 였으며 1,200명이 참여했습니다.',
    );
    const claims = result.findings.map(f => f.claim);
    expect(claims).toContain('3월 31일');
    expect(claims).toContain('92%');
    expect(claims).toContain('1,200명');
  });

  it('지어낸 기관명을 잡는다', () => {
    const result = checkFabrication(
      pad('시청 홈페이지에서 접수한다고만 적혀 있다.'),
      '자세한 내용은 청년창업진흥원에서 확인하세요.',
    );
    expect(result.findings.some(f => f.kind === 'org')).toBe(true);
  });
});

describe('오탐 방어 — 이게 무너지면 검사 자체가 무용지물', () => {
  const source = pad('안내문에는 신청 방법과 대상만 적혀 있다.');

  it('서수·개수는 재료에 없어도 정상이다', () => {
    const result = checkFabrication(source, '준비물은 3가지입니다. 두 번째로 신분증을 챙기세요. 1단계부터 시작합니다.');
    expect(result.findings).toHaveLength(0);
  });

  it('일반적인 기간 표현은 정상이다', () => {
    const result = checkFabrication(source, '처리에는 3일 정도 걸립니다. 하루면 끝나기도 합니다. 일주일 안에 연락이 옵니다.');
    expect(result.findings).toHaveLength(0);
  });

  it('재료에 있는 수치는 표기가 달라도 잡지 않는다', () => {
    const withNumbers = pad('지원금은 1,200만원이며 신청 마감은 3월 31일이다. 선정 인원은 50명이다.');
    const result = checkFabrication(withNumbers, '지원금 1200만원, 마감 3월 31일, 총 50명을 뽑습니다.');
    expect(result.findings).toHaveLength(0);
  });

  it('재료가 너무 짧으면 대조하지 않는다', () => {
    const result = checkFabrication('부산 청년 지원', '지원금은 500만원입니다.');
    expect(result.checked).toBe(false);
  });
});

describe('HTML 본문 처리 — Orbit 은 섹션이 HTML 이다', () => {
  it('태그를 걷어내고 대조한다', () => {
    const result = checkFabrication(
      pad('지원금은 1,200만원이다.'),
      '<p>지원금은 <strong>1,200만원</strong>입니다.</p>',
    );
    expect(result.findings).toHaveLength(0);
  });

  it('태그가 숫자 사이에 끼어도 지어냄을 놓치지 않는다', () => {
    const result = checkFabrication(
      pad('금액 언급이 없는 안내문이다.'),
      '<p>지원금은 <b>500만원</b>입니다.</p>',
    );
    expect(result.findings.map(f => f.claim)).toContain('500만원');
  });

  it('stripHtmlForCheck 가 태그와 개체를 지운다', () => {
    expect(stripHtmlForCheck('<p>가&nbsp;나</p>').trim()).toBe('가 나');
  });
});

describe('추출 규칙', () => {
  it('같은 주장을 여러 번 써도 한 번만 센다', () => {
    const claims = extractVerifiableClaims('500만원을 받습니다. 그 500만원은 분할 지급됩니다.');
    expect(claims.filter(c => c.claim.includes('500만')).length).toBe(1);
  });

  it('빈 입력에서 터지지 않는다', () => {
    expect(extractVerifiableClaims('')).toEqual([]);
    expect(checkFabrication('', '')).toMatchObject({ checked: false, findings: [] });
  });
});

describe('배선 — 발행 흐름을 바꾸지 않는다', () => {
  const orchestration = readFileSync(
    join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8',
  );

  it('생성 파이프라인이 날조 검사를 부른다', () => {
    expect(orchestration).toContain("require('../fabrication-check')");
    expect(orchestration).toContain('checkFabrication');
  });

  it('재료는 근거 장부(factEvidence.context)를 쓴다', () => {
    expect(orchestration).toContain('checkFabrication(factEvidence.context');
  });

  it('검사가 터져도 생성이 멈추지 않는다', () => {
    expect(orchestration).toContain("console.warn('[Fabrication] 검사 스킵:'");
  });
});
