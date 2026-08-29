/**
 * v3.8.594 — 제목이 약속한 수치를 본문이 갖고 있는가.
 *
 * 실측 사고: https://leadernam.com/subsidy/local-business/…-it-용어-20개인/
 *   제목 `혁신성장촉진자금 비즈스캔 2026년 신청때 IT 용어 20개인가`
 *   본문의 IT 용어는 4개, "20개"는 본문에 0회. 제목에만 있었다.
 */

import { containsValueToken, normalizeForMatch } from '../src/core/final/number-token';
import {
  findUnkeptTitleClaims,
  stripUnkeptClaims,
  describeUnkeptClaims,
} from '../src/core/final/title-claim-check';
import { isQuestionTitle } from '../src/core/final/title-answer-gate';
import { sanitizeFactUnsafeHeading, type FactEvidence } from '../src/core/final/fact-integrity';

const BROKEN_TITLE = '혁신성장촉진자금 비즈스캔 2026년 신청때 IT 용어 20개인가';

/** 실제 발행된 본문에서 IT 용어 섹션만 옮겨 왔다 — 용어는 4개다 */
const REAL_BODY = [
  '비즈스캔은 정책자금과 정부지원사업을 1분 무료 진단으로 안내하는 서비스예요.',
  '디지털 전환은 사업 운영에 디지털 기술을 접목하는 흐름을 말해요.',
  '스마트기술은 2026년 일반형과 혁신형 대상 설명에 등장하는 기술 도입 범주예요.',
  '스마트공장은 2026년 혁신형에서 언급되는 도입 대상 범주예요.',
  'DX는 디지털 전환을 영어로 줄여 부르는 표현이에요.',
  '2026년 혁신성장촉진자금은 약 4,800억원 규모로 운전자금과 시설자금을 나눠 지원해요.',
].join(' ');

describe('number-token — 경계까지 보고 대조한다', () => {
  test('남의 숫자 꼬리는 근거가 아니다 (120개월 ⊅ 20개)', () => {
    const hay = normalizeForMatch('상환 기간은 120개월 이내입니다');
    expect(containsValueToken(hay, '20개')).toBe(false);
  });

  test('단위가 늘어나면 다른 단위다 (20개월 ⊅ 20개)', () => {
    expect(containsValueToken(normalizeForMatch('거치 20개월'), '20개')).toBe(false);
  });

  test('진짜로 있으면 통과한다', () => {
    expect(containsValueToken(normalizeForMatch('서류 20개를 준비'), '20개')).toBe(true);
    expect(containsValueToken(normalizeForMatch('한도 4,800억원'), '4800억원')).toBe(true);
  });

  test('수치 뒤에 다른 말이 붙는 것은 막지 않는다 (오탐 방지)', () => {
    // 공백을 지운 문자열에서 뒷글자만 보고 막으면 멀쩡한 수치가 미확인이 된다
    expect(containsValueToken(normalizeForMatch('일자리 20개 일반형'), '20개')).toBe(true);
  });
});

describe('title-claim-check — 못 지킨 약속을 찾는다', () => {
  test('본문에 없는 "20개"를 잡아낸다', () => {
    const claims = findUnkeptTitleClaims({
      title: BROKEN_TITLE,
      bodyText: REAL_BODY,
      keyword: '혁신성장촉진자금 비즈스캔',
    });
    expect(claims.map((c) => c.token)).toEqual(['20개']);
    expect(claims[0]?.phrase).toBe('20개인가');
    expect(describeUnkeptClaims(claims)).toContain('20개');
  });

  test('연도는 시스템이 넣는 값이라 묻지 않는다', () => {
    const claims = findUnkeptTitleClaims({ title: '2027년 지원금 안내', bodyText: '내용', keyword: '지원금' });
    expect(claims).toHaveLength(0);
  });

  test('본문에 있는 수치는 건드리지 않는다', () => {
    const claims = findUnkeptTitleClaims({
      title: '혁신성장촉진자금 4,800억원 어디까지 받나',
      bodyText: REAL_BODY,
      keyword: '혁신성장촉진자금',
    });
    expect(claims).toHaveLength(0);
  });

  test('키워드에 든 숫자는 사용자가 넣은 말이라 건드리지 않는다', () => {
    const claims = findUnkeptTitleClaims({
      title: '갤럭시탭 S10 256GB 3년 쓴 후기',
      bodyText: '태블릿 이야기',
      keyword: '갤럭시탭 S10 3년',
    });
    expect(claims).toHaveLength(0);
  });

  test('거짓 약속만 덜어내고 제목은 남긴다', () => {
    const claims = findUnkeptTitleClaims({
      title: BROKEN_TITLE,
      bodyText: REAL_BODY,
      keyword: '혁신성장촉진자금 비즈스캔',
    });
    const fixed = stripUnkeptClaims(BROKEN_TITLE, claims);
    expect(fixed).not.toContain('20개');
    expect(fixed).toContain('혁신성장촉진자금');
    expect(fixed.length).toBeGreaterThanOrEqual(8);
  });

  test('덜어내면 너무 짧아지는 제목은 그대로 둔다 (발행을 막지 않는다)', () => {
    const title = '용어 20개';
    const claims = findUnkeptTitleClaims({ title, bodyText: '내용만 있고 숫자는 없다', keyword: '용어' });
    expect(claims).toHaveLength(1);
    expect(stripUnkeptClaims(title, claims)).toBe(title);
  });
});

describe('title-answer-gate — ~인가 도 질문이다', () => {
  test('"20개인가"를 질문으로 본다', () => {
    expect(isQuestionTitle(BROKEN_TITLE)).toBe(true);
  });

  test('질문이 아닌 제목은 그대로 아니다', () => {
    expect(isQuestionTitle('2026년 혁신성장촉진자금 신청 절차 정리')).toBe(false);
  });
});

describe('키워드 맨 앞 옵션이 프롬프트까지 간다', () => {
  /**
   * 사용자 지적: "키워드를 제목맨앞으로 체크하고한거야 그렇다면 키워드를 제목맨앞에넣고
   * 자연스러우면서 SEO에 최적화된 제목을 생성해줘야 정상아니니"
   *
   * 예전에는 옵션이 프롬프트에 전달되지 않고 사후 문자열 재조립만 했다.
   * 여기서는 **옵션이 실제로 프롬프트에 실리는지** 를 본다 (LLM 호출은 가로챈다).
   */
  const loadWithCapture = () => {
    jest.resetModules();
    const captured: string[] = [];
    jest.doMock('../src/core/final/gemini-engine', () => ({
      callGeminiWithRetry: jest.fn(async (prompt: string) => {
        captured.push(prompt);
        return '혁신성장촉진자금 비즈스캔, 2026년에 달라진 게 뭔가요';
      }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const generation = require('../src/core/final/generation');
    return { generation, captured };
  };

  afterEach(() => {
    jest.dontMock('../src/core/final/gemini-engine');
    jest.resetModules();
  });

  test('옵션이 켜지면 "키워드로 시작한다"는 지시가 프롬프트에 실린다', async () => {
    const { generation, captured } = loadWithCapture();
    await generation.generateH1TitleFinal(
      '혁신성장촉진자금 비즈스캔', [], undefined, undefined, undefined, undefined, undefined, true,
    );
    const prompt = captured.join('\n');
    expect(prompt).toContain('"혁신성장촉진자금 비즈스캔" 로 시작합니다');
    expect(prompt).toContain('한 문장으로 자연스럽게 이어져야');
    // 연도를 맨 앞에 두라는 상반된 지시가 같이 실리면 안 된다
    expect(prompt).not.toContain('"2026년"을 제목 맨 앞에');
  });

  test('옵션이 꺼지면 예전 규칙(연도 맨 앞)이 그대로다', async () => {
    const { generation, captured } = loadWithCapture();
    await generation.generateH1TitleFinal('혁신성장촉진자금 비즈스캔', []);
    const prompt = captured.join('\n');
    expect(prompt).toContain('제목 맨 앞에');
    expect(prompt).not.toContain('로 시작합니다');
  });

  test('참고 제목의 숫자를 옮겨 적지 말라는 지시가 실린다', async () => {
    const { generation, captured } = loadWithCapture();
    await generation.generateH1TitleFinal('혁신성장촉진자금 비즈스캔', ['정책자금 신청 때 알아야 할 IT 용어 20개']);
    const prompt = captured.join('\n');
    expect(prompt).toContain('숫자·서비스명·상표를 옮겨 적지 마세요');
    expect(prompt).toContain('제목에 개수를 약속하지 마세요');
  });
});

describe('에이전트 모드에도 같은 검사가 걸린다', () => {
  // 에이전트 모드는 orchestration 을 안 탄다 — API 경로에만 달면 같은 제목이 그대로 나간다
  test('normalizeAgentTitle 이 못 지킨 약속을 덜어낸다', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { normalizeAgentTitle } = require('../src/core/final/agent-harness');
    const out = normalizeAgentTitle(BROKEN_TITLE, '혁신성장촉진자금 비즈스캔', REAL_BODY);
    expect(out).not.toContain('20개');
    expect(out).toContain('혁신성장촉진자금');
  });

  test('본문을 안 주면 예전 동작 그대로다', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { normalizeAgentTitle } = require('../src/core/final/agent-harness');
    expect(normalizeAgentTitle('2026년 지원금 4,800억원 규모', '지원금')).toContain('4,800억원');
  });
});

describe('fact-integrity — 잘린 단위로 통과하지 않는다', () => {
  const evidence: FactEvidence = {
    // "120개월"만 있는 근거로 "20개"가 확인된 것처럼 통과하던 구멍
    context: '소상공인 정책자금의 상환 기간은 최대 120개월이며 신청은 온라인으로 접수합니다. '.repeat(6),
    provider: 'naver',
    trustLevel: 'weak',
    topic: '혁신성장촉진자금',
  };

  test('근거에 없는 개수는 제목에서 도려낸다', () => {
    const cleaned = sanitizeFactUnsafeHeading('신청 서류 20개 정리', evidence, '혁신성장촉진자금');
    expect(cleaned).not.toContain('20개');
  });

  test('근거에 있는 값은 살려 둔다', () => {
    const cleaned = sanitizeFactUnsafeHeading('상환 기간 120개월 신청 안내', evidence, '혁신성장촉진자금');
    expect(cleaned).toContain('120개월');
  });
});
