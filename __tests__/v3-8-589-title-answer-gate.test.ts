/**
 * v3.8.589 — 제목이 물으면 본문이 답하게 한다
 *
 * ## 실측 사고 (발행글 5429)
 * 제목: `2026년 청년일자리도약장려금 비즈스캔 사업소득 있으면 가능한지`
 * 본문의 답: **"단정하기 어려워요. 서류를 명의별로 분리 보관하세요."**
 * 남은 여섯 섹션은 전부 "상호·대표자명 대조하고 파일명 통일하라"의 변주였다.
 * 맨 위 "핵심 요약"도 답이 아니라 사실 표였다(지원 내용·채용 조건·확인 서류).
 *
 * ## 왜 기존 검사로는 못 잡나
 * **지어낸 게 하나도 없다.** 그래서 fact-guard 도, 실속 게이트도, 구조 검사도 통과한다.
 * 근거에 답이 없을 때 모델은 날조하지 않고 **주변 이야기로 공전한다** —
 * 날조보다 낫지만 독자는 빈손으로 나간다. 이 검사만 그걸 본다.
 *
 * ## 두 군데서 막는다
 *   ① 쓰기 전 — 제목이 질문이면 "첫 화면에서 판정부터"라고 지시
 *   ② 근거 모을 때 — 권위 출처가 얇으면 유료로 올린다.
 *      정부 지침은 hwp·pdf 라 우리가 못 읽는다(실측: 기관 결과 18건 중 15건이 첨부파일).
 *      퍼플렉시티는 그걸 읽는다 — PDF 파서를 새로 들이는 것보다 확실하다.
 */
import {
  isQuestionTitle, auditTitleAnswer, describeAnswerAudit, buildAnswerDirective,
} from '../src/core/final/title-answer-gate';

const 사고제목 = '2026년 청년일자리도약장려금 비즈스캔 사업소득 있으면 가능한지';

describe('① 제목이 질문인지 안다', () => {
  test('실측에서 문제가 된 그 제목을 질문으로 본다', () => {
    expect(isQuestionTitle(사고제목)).toBe(true);
  });

  test('흔한 질문 꼴을 알아본다', () => {
    for (const t of [
      '실업급여 얼마나 받나요', '전세보증금 반환 언제까지 되나요',
      '도수치료 실비 되는지', '폐업 후에도 신청 가능할까',
      '위약금 면제 여부', '청년내일저축 어떻게 신청하나요',
    ]) expect(isQuestionTitle(t)).toBe(true);
  });

  test('질문이 아니면 건드리지 않는다 (프롬프트를 괜히 늘리지 않는다)', () => {
    for (const t of ['해외 항공권 취소 수수료 면제 조건 정리', '2026년 실손보험 세대별 비교']) {
      expect(isQuestionTitle(t)).toBe(false);
      expect(buildAnswerDirective(t)).toBe('');
    }
  });
});

describe('② 앞부분에서 답했는지 본다', () => {
  test('⭐ 실측에서 나갔던 그 본문을 잡는다', () => {
    const a = auditTitleAnswer({
      title: 사고제목,
      bodyText: '사업소득이 있는 경우 참여 가능 여부는 단정하기 어려워요. '
        + '서류를 명의별로 분리 보관하세요. 상호와 대표자명을 대조하고 파일명을 통일하는 편이 좋아요.',
    });
    expect(a.asked).toBe(true);
    expect(a.answered).toBe(false);
    expect(describeAnswerAudit(a)).toContain('⚠️');
  });

  test('판정을 내리면 통과시킨다', () => {
    const a = auditTitleAnswer({
      title: 사고제목,
      bodyText: '사업자등록이 있어도 폐업 상태면 참여가 가능합니다. '
        + '영업 중인 사업자는 대상에서 제외됩니다. 판단은 채용일 기준 사업자 상태로 갈립니다.',
    });
    expect(a.answered).toBe(true);
  });

  /** 뒤에 답이 있어도 소용없다 — 독자는 앞에서 못 찾으면 나간다 */
  test('답이 한참 뒤에 있으면 못 찾은 것으로 본다', () => {
    const filler = '서류를 정리하는 방법을 먼저 살펴봅니다. '.repeat(60);
    const a = auditTitleAnswer({ title: 사고제목, bodyText: `${filler} 폐업 상태면 가능합니다.` });
    expect(a.answered).toBe(false);
  });

  test('회피 문장을 그대로 집어 준다 (무엇이 문제인지 보여야 고친다)', () => {
    const a = auditTitleAnswer({
      title: 사고제목,
      bodyText: '이 조건은 상황에 따라 달라질 수 있어요. 서류부터 정리해 두세요.',
    });
    expect(a.evasion).toContain('달라질 수 있');
  });

  test('질문이 아닌 제목은 항상 통과 (검사 대상이 아니다)', () => {
    const a = auditTitleAnswer({ title: '실손보험 세대별 비교', bodyText: '아무 말이나 적혀 있습니다.' });
    expect(a.asked).toBe(false);
    expect(a.answered).toBe(true);
  });

  test('빈 값·깨진 값에 던지지 않는다', () => {
    for (const bad of ['', null, undefined]) {
      expect(() => auditTitleAnswer({ title: bad as any, bodyText: bad as any })).not.toThrow();
    }
  });
});

describe('③ 쓰기 전 지시가 실제 실패를 겨냥한다', () => {
  const d = buildAnswerDirective(사고제목);

  test('첫 화면에서 판정하라고 한다', () => {
    expect(d).toContain('서론이 끝나기 전에 판정');
  });

  test('갈리면 무엇이 가르는지 그 자리에서 말하라고 한다', () => {
    expect(d).toContain('상황에 따라 달라질 수 있습니다');   // 나쁜 예
    expect(d).toContain('폐업 상태면 가능하고');              // 고친 예
  });

  /** 이 문을 안 열어 두면 모델이 없는 답을 지어내거나 주변 얘기로 공전한다 */
  test('모르면 모른다고 쓸 길을 열어 둔다', () => {
    expect(d).toContain('명시돼 있지 않습니다');
    expect(d).toContain('답을 피해 다른 얘기로 채우지도 마세요');
  });

  test('실제 사고를 예시로 박아 둔다', () => {
    expect(d).toContain('단정하기 어려워요');
    expect(d).toContain('빈손으로 나갔습니다');
  });
});

describe('④ 발행 경로에 배선돼 있다', () => {
  const fs = require('fs');
  const path = require('path');
  const orch = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf-8',
  );

  test('import 한다', () => {
    expect(orch).toContain("from './title-answer-gate'");
  });

  test('쓰기 전 지시가 프롬프트에 들어간다', () => {
    expect(orch).toContain('buildAnswerDirective(keyword)');
    expect(orch).toContain('...(answerDirective ? [answerDirective] : [])');
  });

  /** 답을 못 구할 상황이면 원문을 읽을 수 있는 창구로 올린다 */
  test('질문형 제목이면 권위 출처가 얇을 때 유료로 올린다', () => {
    expect(orch).toContain('isQuestionTitle(keyword) && authoritative < 3');
    expect(orch).toContain('제목이 질문인데 권위 출처');
  });

  test('쓴 뒤 검사도 돈다', () => {
    expect(orch).toContain('auditTitleAnswer({');
    expect(orch).toContain('[ANSWER]');
  });

  test('발행을 막지 않는다 (다시 쓰면 비용이 두 배가 된다)', () => {
    const at = orch.indexOf('auditTitleAnswer({');
    const block = orch.slice(orch.lastIndexOf('try {', at), at + 800);
    expect(block).toContain('catch');
    expect(block).not.toContain('throw new Error');
  });
});
