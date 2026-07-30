/**
 * 실속 규칙 첫 생성 주입 테스트 (v3.8.385)
 *
 * 배경 — GSC 실측(2026-07-28): "크롤링됨 – 현재 색인이 생성되지 않음" 108편.
 *   크롤 예산·태그·내부링크와 무관한 순수 품질 거부다. 본문이 바뀌어야 들어온다.
 *
 * 설계 결정 — 재생성이 아니라 첫 생성에 넣는다:
 *   v3.8.376 실측에서 자동 재생성은 편당 LLM 호출 +1 인데 점수가 되레 하락(41→29)해
 *   결과가 버려졌다. 사용자 원칙은 "비용은 고정되어야 한다".
 *   같은 규칙을 첫 호출에 넣으면 호출 수는 그대로이면서 결과만 좋아진다.
 *   이 테스트는 그 결정이 뒤집히지 않게 못 박는다.
 */
import {
  SUBSTANCE_FIRST_PASS_RULES,
  FRESHNESS_RULES,
  buildUniquenessBlock,
  hasSubstanceRules,
  hasFreshnessRules,
} from '../src/core/final/substance-rules';
import * as fs from 'fs';
import * as path from 'path';

const generationSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'core', 'final', 'generation.ts'), 'utf8');
const orchestrationSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

describe('실속 규칙 내용', () => {
  it('구체 정보의 정의를 열거한다 — 형용사를 정보로 착각하지 않게', () => {
    for (const kind of ['금액', '비율', '기간', '수량', '날짜', '기관명', '법조문', '메뉴 경로', '서류 이름']) {
      expect(SUBSTANCE_FIRST_PASS_RULES).toContain(kind);
    }
  });

  // v3.8.391: 사용자 결정 — "출처가 굳이 본문에 들어갈 필요가 없다".
  //   괄호 출처 부기를 요구하던 규칙 2 를 뒤집었다. 숫자의 정확성은 유지하고
  //   (official-sources 가 실제 기관 자료를 프롬프트에 넣어준다) 표기만 없앤다.
  it('괄호 출처 부기를 금지한다', () => {
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('출처 표기는 본문에 넣지 마세요');
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('괄호 출처는 넣지 않습니다');
  });

  it('그래도 확인 안 된 숫자는 쓰지 말라는 원칙은 유지한다', () => {
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('확인할 수 없는 숫자는 아예 쓰지 마세요');
  });

  it('법령·제도 이름은 정보이므로 문장에 녹이도록 허용한다', () => {
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('법령·제도의 **이름 자체**는 정보');
  });

  it('"공식 사이트에서 확인하세요"로 끝내는 것을 금지한다', () => {
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('공식 사이트에서 확인하세요');
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('무엇을 준비해서');
  });

  it('"상황에 따라 달라집니다"로 끝내는 것을 금지하고 대안을 준다', () => {
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('상황에 따라 달라');
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('가구원 수로 갈립니다'); // 구체 대안 예시
  });

  it('숫자 날조를 금지하고 대체 항목을 지정한다', () => {
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('지어내지 말고');
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('판단 기준');
    expect(SUBSTANCE_FIRST_PASS_RULES).toContain('흔한 실수');
  });

  it('❌/✅ 대비 예시를 포함한다 — 규칙만 있고 예시가 없으면 모델이 못 지킨다', () => {
    expect((SUBSTANCE_FIRST_PASS_RULES.match(/❌/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((SUBSTANCE_FIRST_PASS_RULES.match(/✅/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('hasSubstanceRules 가 주입 여부를 판정한다', () => {
    expect(hasSubstanceRules(SUBSTANCE_FIRST_PASS_RULES)).toBe(true);
    expect(hasSubstanceRules('아무 프롬프트')).toBe(false);
    expect(hasSubstanceRules(null as any)).toBe(false);
  });
});

describe('배선 — 첫 생성 프롬프트에 들어간다', () => {
  it('generation.ts 가 규칙을 import 하고 프롬프트에 삽입한다', () => {
    expect(generationSrc).toContain("from './substance-rules'");
    expect(generationSrc).toContain('${SUBSTANCE_FIRST_PASS_RULES}');
    expect(generationSrc).toContain('${FRESHNESS_RULES}');
  });

  it('모드별 지시 블록 뒤에 붙는다 — 모드 규칙을 덮어쓰지 않는 위치', () => {
    const modeIdx = generationSrc.indexOf('${paraphrasingModePromptBlock}');
    const substIdx = generationSrc.indexOf('${SUBSTANCE_FIRST_PASS_RULES}');
    expect(modeIdx).toBeGreaterThan(-1);
    expect(substIdx).toBeGreaterThan(modeIdx);
  });
});

describe('최신성 규칙', () => {
  it('기준 시점 명기를 요구한다 — 다만 괄호가 아니라 문장 안에', () => {
    expect(FRESHNESS_RULES).toContain('언제 기준인지');
    expect(FRESHNESS_RULES).toContain('문장 안에 녹이세요');
    // v3.8.391: 괄호 부기 예시를 ❌ 로 뒤집었다 (사용자 결정: 출처·부기를 본문에 넣지 않는다)
    expect(FRESHNESS_RULES).toContain('괄호 부기는 쓰지 않습니다');
    expect(FRESHNESS_RULES).toContain('2026년 기준 지원금은 월 20만 원입니다');
  });

  it('끝난 사업을 현재형으로 쓰지 못하게 한다', () => {
    expect(FRESHNESS_RULES).toContain('마감된 일정을 현재형으로');
  });

  it('내용은 그대로 두고 제목 연도만 바꾸는 것을 금지한다', () => {
    // Mueller 공식 입장: 날짜만 갱신하는 가짜 최신화는 "노이즈이며 무용"
    expect(FRESHNESS_RULES).toContain('제목만 올해로 바꾸는');
  });

  it('hasFreshnessRules 가 주입 여부를 판정한다', () => {
    expect(hasFreshnessRules(FRESHNESS_RULES)).toBe(true);
    expect(hasFreshnessRules('아무거나')).toBe(false);
    expect(hasFreshnessRules(null as any)).toBe(false);
  });
});

describe('중복 회피 블록', () => {
  const titles = [
    '2026년 청년내일저축계좌, 달라진 혜택과 신청방법 완벽 분석',
    '청년월세지원 결과 확인 — 차수별 지급일',
  ];

  it('기존 글 제목을 프롬프트에 넣는다', () => {
    const b = buildUniquenessBlock(titles);
    titles.forEach(t => expect(b).toContain(t));
    expect(b).toContain('[중복 회피');
  });

  it('각도를 다르게 잡으라고 지시한다', () => {
    const b = buildUniquenessBlock(titles);
    expect(b).toContain('각도를 다르게');
    expect(b).toContain('자기잠식');
  });

  it('수식어만 다른 제목을 금지한다 (실제 사고 패턴)', () => {
    // 실측: 청년내일저축계좌 4편이 "완벽 분석 / 목돈 마법 / 목돈 마련 완벽 / 목돈 마련의"
    // 로 수식어만 달랐고 본문 유사도 0.399~0.549 였다.
    const b = buildUniquenessBlock(titles);
    expect(b).toContain('수식어만 다르면');
    expect(b).toContain('총정리');
  });

  it('기존 글이 없으면 빈 문자열 — 프롬프트를 오염시키지 않는다', () => {
    expect(buildUniquenessBlock([])).toBe('');
    expect(buildUniquenessBlock(null as any)).toBe('');
    expect(buildUniquenessBlock(undefined as any)).toBe('');
  });

  it('최대 8개까지만 넣는다 — 프롬프트 비대화 방지', () => {
    const many = Array.from({ length: 20 }, (_, i) => `글 ${i + 1}`);
    const b = buildUniquenessBlock(many);
    expect((b.match(/^   · /gm) || []).length).toBe(8);
  });

  it('빈 문자열·공백 제목은 걸러낸다', () => {
    const b = buildUniquenessBlock(['정상 제목', '', '   ', null as any]);
    expect((b.match(/^   · /gm) || []).length).toBe(1);
  });
});

describe('중복 회피 배선 — 차단하지 않는다', () => {
  it('orchestration 이 기존 글을 조회해 프롬프트에 붙인다', () => {
    expect(orchestrationSrc).toContain('buildUniquenessBlock(');
    expect(orchestrationSrc).toContain('findRelatedPosts(dupSiteUrl, keyword, 8)');
  });

  it('조회 실패가 발행을 막지 않는다 (try/catch)', () => {
    const start = orchestrationSrc.indexOf('v3.8.385: 중복 회피');
    const end = orchestrationSrc.indexOf("[UNIQUENESS] 기존 글 조회 스킵");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = orchestrationSrc.slice(start, end);
    // 이 블록에서 return/throw 로 발행을 중단하면 안 된다
    expect(block).not.toMatch(/return\s*\{[^}]*ok:\s*false/);
    expect(block).not.toMatch(/throw new Error/);
  });
});

describe('비용 원칙 — 자동 재생성은 여전히 opt-in 이어야 한다', () => {
  it('substanceAutoRegen 기본값이 켜지지 않았다', () => {
    // 사용자 원칙: "비용은 고정되어야 한다".
    // 실측(v3.8.376): 재생성이 매 편 발동 + 점수 하락(41→29)으로 결과 폐기 = 비용 100% 낭비.
    // 첫 생성에 규칙을 넣었으므로 재생성을 켤 이유가 더더욱 없다.
    expect(orchestrationSrc).toContain("(payload as any)?.substanceAutoRegen === true");
    expect(orchestrationSrc).toContain("process.env['SUBSTANCE_AUTO_REGEN'] === '1'");
    // 무조건 true 로 바꾸는 회귀 차단
    expect(orchestrationSrc).not.toMatch(/const substanceAutoRegen\s*=\s*true/);
  });

  it('실속 게이트는 측정·경고 역할로 남아 있다', () => {
    expect(orchestrationSrc).toContain('실속 미달 경고만 기록');
  });
});
