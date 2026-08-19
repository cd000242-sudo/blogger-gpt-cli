/**
 * StoryScope 구조 규칙 주입 테스트 (v3.8.529)
 *
 * 배경 — StoryScope (COLM 2026): 문체를 안 보고 이야기 구조만으로 AI 글을
 *   macro-F1 93.2 로 가려낸다. 발행글 실측(2026-08-19)에서도 가장 AI 같았던 글은
 *   곁가지 0건 · 실명 근거 0건이었고, 기존의 "결론적으로 금지" 같은 단어 방어는
 *   지시형 종결("~하시면 됩니다")로 변형돼 새는 걸 못 막았다.
 *
 * 설계 결정 — 게이트가 아니라 첫 생성 프롬프트에 넣는다 (substance-rules 와 동일):
 *   사용자 원칙 "검수로 발행이 막히면 절대 안 된다 · 비용 고정".
 *   이 테스트는 규칙 내용과 6개 모드 공통 배선이 끊기지 않게 못 박는다.
 */
import {
  STORYSCOPE_STRUCTURE_RULES,
  STORYSCOPE_FAQ_ENDING_RULE,
  hasStoryscopeRules,
} from '../src/core/final/storyscope-rules';
import * as fs from 'fs';
import * as path from 'path';

const generationSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'core', 'final', 'generation.ts'), 'utf8');

describe('구조 규칙 내용 — 논문 4항목(정보글 유효분)이 전부 있다', () => {
  it('1. 곁가지 — 흐름 꺾기를 요구한다', () => {
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('곁가지');
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('흐름을 최소 한 번 꺾으세요');
    // 무엇으로 꺾는지 선택지를 준다 — 규칙만 있고 방법이 없으면 모델이 못 지킨다
    for (const way of ['예외 대상', '반대인 경우', '흔한 오해']) {
      expect(STORYSCOPE_STRUCTURE_RULES).toContain(way);
    }
  });

  it('2. 교훈 떠먹이기를 금지한다', () => {
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('교훈을 떠먹이지 마세요');
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('~이 중요합니다');
  });

  it('3. 마무리 버릇 — H3 를 정리·당부로 닫는 것을 금지한다 (지시형 종결 포함)', () => {
    // 실측: 마무리 버릇은 "정리하면"이 아니라 지시형("~하시면 됩니다")으로 샌다
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('~하시면 됩니다');
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('~해 나가세요');
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('마지막 문장');
  });

  it('3-예외. 글 전체의 결론 섹션은 예외로 명시한다 — 기존 결론부 지시와 충돌 방지', () => {
    // generation.ts 의 "결론부 여운 강화"(클로징 지시)와 모순되면 모델이 아무 쪽이나 고른다
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('결론 섹션 하나만 예외');
  });

  it('4. 실명 호명 — 익명 표현을 금지하되, 이름 날조는 더 강하게 금지한다', () => {
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('익명 표현');
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('전문가들에 따르면');
    // fact-integrity 원칙과의 안전선: 실명 호명이 날조 유도가 되면 안 된다
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('지어내는 것은 절대 금지');
    expect(STORYSCOPE_STRUCTURE_RULES).toContain('그 문장 자체를 빼세요');
  });

  it('❌/✅ 대비 예시를 포함한다 — 규칙만 있고 예시가 없으면 모델이 못 지킨다', () => {
    expect((STORYSCOPE_STRUCTURE_RULES.match(/❌/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((STORYSCOPE_STRUCTURE_RULES.match(/✅/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('장르 보정 — 소설용 항목(시간 흔들기·애매한 선택)은 들어가지 않았다', () => {
    // 검색 유입 독자에게 답을 미루면 이탈한다 (스킬 3절)
    expect(STORYSCOPE_STRUCTURE_RULES).not.toContain('시간을 흔들');
    expect(STORYSCOPE_STRUCTURE_RULES).not.toContain('회상');
  });

  it('hasStoryscopeRules 가 주입 여부를 판정한다', () => {
    expect(hasStoryscopeRules(STORYSCOPE_STRUCTURE_RULES)).toBe(true);
    expect(hasStoryscopeRules('아무 프롬프트')).toBe(false);
    expect(hasStoryscopeRules(null as any)).toBe(false);
  });
});

describe('배선 — 6개 모드 공통 프롬프트에 들어간다', () => {
  it('generation.ts 가 규칙을 import 하고 본문 프롬프트에 삽입한다', () => {
    expect(generationSrc).toContain("from './storyscope-rules'");
    expect(generationSrc).toContain('${STORYSCOPE_STRUCTURE_RULES}');
  });

  it('모드 블록 뒤, 기존 공유 규칙과 같은 자리에 붙는다 — 6개 모드 전부에 닿는 위치', () => {
    // 모드별 블록(external/internal/shopping/adsense/paraphrasing/discover)은 이 앞에서
    // 조립되고, 공유 규칙은 그 뒤 한 자리에 나란히 들어간다. 이 순서가 곧 "전 모드 공통"이다.
    const modeIdx = generationSrc.indexOf('${paraphrasingModePromptBlock}');
    const storyIdx = generationSrc.indexOf('${STORYSCOPE_STRUCTURE_RULES}');
    const substIdx = generationSrc.indexOf('${SUBSTANCE_FIRST_PASS_RULES}');
    expect(modeIdx).toBeGreaterThan(-1);
    expect(storyIdx).toBeGreaterThan(modeIdx);
    expect(Math.abs(storyIdx - substIdx)).toBeLessThan(200); // 같은 주입 지점에 나란히
  });

  it('FAQ 프롬프트에도 마무리 버릇 규칙이 들어간다 — FAQ 는 별도 프롬프트라 본문 블록이 안 닿는다', () => {
    expect(generationSrc).toContain('${STORYSCOPE_FAQ_ENDING_RULE}');
    expect(STORYSCOPE_FAQ_ENDING_RULE).toContain('정리·당부 문장으로 끝내지 마세요');
  });

  it('교훈 떠먹이기를 가르치던 예시 문구가 프롬프트에서 사라졌다', () => {
    // "이 부분이 가장 중요한 포인트예요"는 공감 어조 예시로 들어 있었지만
    // StoryScope 1번 항목(교훈 직접 말하기)의 전형이라 규칙과 정면 충돌했다.
    // 충돌하는 프롬프트는 모델이 아무 쪽이나 고른다 — 예시를 교체해 한 방향으로 정렬.
    expect(generationSrc).not.toContain('이 부분이 가장 중요한 포인트예요');
  });
});
