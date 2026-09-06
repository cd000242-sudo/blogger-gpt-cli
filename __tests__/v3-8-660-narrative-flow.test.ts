const fs = require('fs');
const path = require('path');

import { findFlowGaps, NARRATIVE_FLOW_RULES, DEFERRAL, FIRST_PERSON_STANCE } from '../src/core/final/narrative-flow';
import { auditArticle, toPlainText } from '../src/core/final/article-audit';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.660 — 흐름과 관점.
 *
 * 사장님: "도입에서 던진 문제를 끝까지 붙잡는 구성과 분명한 관점이 정말 중요해"
 *         "제목의 공감을 본문이 끝까지 이어받아야 해"
 *
 * 24편을 읽고 본 것: 절이 섬처럼 떠 있고, 절마다 "확인하세요" 로 닫히며, 필자의 판단이 한 문장도 없다.
 */
describe('v3.8.660 흐름·관점', () => {
  const p = (s: string) => `<p>${s}</p>`;
  // 실제 글은 6,000자 이상이다 — 판단 없음 검사는 2,000자부터 본다
  const long = (s: string, n = 24) => p(s.repeat(n));

  test('회피 표현과 1인칭 판단을 센다', () => {
    expect('고지서를 발급한 기관에 문의하세요. 상황에 따라 다릅니다. 단정하기 어렵습니다.'.match(DEFERRAL)).toHaveLength(3);
    expect('저는 이 경우 신청하는 쪽으로 봅니다. 제 판단은 자동이 아니라는 것입니다. 제가 보기엔 그렇습니다.'.match(FIRST_PERSON_STANCE)).toHaveLength(3);
    expect('신청 방법은 간단합니다.'.match(FIRST_PERSON_STANCE)).toBeNull();
  });

  test('회피가 넘치고 판단이 없으면 둘 다 잡힌다', () => {
    const html = '<h1>환경개선부담금 면제 자동 적용 여부와 신청 방법</h1>'
      + '<h2>1. 면제 대상</h2>' + long('면제 대상은 고지서를 발급한 기관에 문의하세요. 상황에 따라 다릅니다. ')
      + '<h2>2. 신청 방법</h2>' + long('신청은 확인해야 합니다. 판단하기 어렵습니다. 다시 확인하세요. ')
      + '<h2>3. 납부기한</h2>' + long('납부기한도 달라질 수 있습니다. 확인할 수 있어요. ');
    const r = findFlowGaps(html, toPlainText);
    const kinds = r.issues.map((i) => i.kind);
    expect(kinds).toContain('deferral-flood');
    expect(kinds).toContain('no-stance');
    expect(r.stats.firstPersonStance).toBe(0);
    expect(r.stats.deferralPer1000).toBeGreaterThan(3);
  });

  test('판단이 있고 회피가 적으면 안 잡힌다', () => {
    const html = '<h1>환경개선부담금 면제 자동 적용 여부와 신청 방법</h1>'
      + '<h2>1. 면제 대상</h2>' + long('면제 대상은 유로5·유로6 경유차와 저감장치 부착 차량입니다. 저는 이 경우 신청하는 쪽으로 봅니다. 자동 반영 사례가 자료에 없기 때문입니다. ')
      + '<h2>2. 신청 방법</h2>' + long('신청은 시군구 환경 부서에 면제 신청서를 냅니다. 제 판단은 고지서를 받기 전에 내는 쪽입니다. ')
      + '<h2>3. 납부기한</h2>' + long('납부기한은 9월 30일입니다. 면제 신청 중이라도 기한은 그대로입니다. ');
    const r = findFlowGaps(html, toPlainText);
    expect(r.issues.map((i) => i.kind)).not.toContain('deferral-flood');
    expect(r.issues.map((i) => i.kind)).not.toContain('no-stance');
    expect(r.stats.firstPersonStance).toBeGreaterThanOrEqual(2);
  });

  test('제목 낱말이 한 번도 안 나오는 절이 둘 이상이면 제목의 공감이 끊긴 것이다', () => {
    const html = '<h1>햇살론15 거절되는 지점과 보증심사</h1>'
      + '<h2>1. 거절 지점</h2>' + long('햇살론15 거절은 보증심사 단계에서 갈립니다. 저는 보증번호부터 보라고 봅니다. ')
      + '<h2>2. 나스닥 상장폐지 기준</h2>' + long('나스닥은 주가 1달러 기준을 씁니다. 뉴욕거래소도 통지를 냅니다. ')
      + '<h2>3. 코넥스 이전 절차</h2>' + long('코넥스 이전은 상장법인이 신청합니다. 지정자문인 선임이 필요합니다. ');
    const r = findFlowGaps(html, toPlainText);
    expect(r.stats.sectionsOffTitle).toBe(2);
    expect(r.issues.map((i) => i.kind)).toContain('title-thread-lost');
  });

  test('서론이 약속한 것이 마무리에 없으면 잡는다', () => {
    const html = '<h1>대출 갈아타기 부결 사유와 재신청 방법</h1>'
      + p('이 글은 부결 사유 분류, 재신청 순서, 전세대출 보증 반려를 정리합니다.')
      + '<h2>1. 부결</h2>' + long('부결은 대상 제외와 심사 거절로 나뉩니다. 저는 대상부터 보라고 봅니다. ')
      + '<h2>2. 재신청</h2>' + long('재신청은 사유를 고친 뒤에 합니다. 제 판단은 서두르지 않는 쪽입니다. ')
      + '<h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>'
      + p('날씨가 좋으면 산책을 가세요. 오늘도 좋은 하루 보내세요. 감사합니다. 다음 글에서 만나요.');
    const r = findFlowGaps(html, toPlainText);
    expect(r.issues.map((i) => i.kind)).toContain('intro-promise-unkept');
  });

  test('하네스에 실려 있다 — 점수와 통계', () => {
    const html = '<h1>환경개선부담금 면제 자동 적용 여부와 신청 방법</h1>'
      + '<h2>1. 면제 대상</h2>' + long('면제 대상은 고지서를 발급한 기관에 문의하세요. 상황에 따라 다릅니다. ')
      + '<h2>2. 신청 방법</h2>' + long('신청은 확인해야 합니다. 판단하기 어렵습니다. 다시 확인하세요. ')
      + '<h2>3. 납부기한</h2>' + long('납부기한도 달라질 수 있습니다. 확인할 수 있어요. ');
    const r = auditArticle(html);
    expect(r.issues.map((i) => i.kind)).toContain('no-stance');
    expect(r.stats.firstPersonStance).toBe(0);
    expect(typeof r.stats.deferralPer1000).toBe('number');
  });

  test('경험은 사람이 적은 것만 — 메모가 있으면 두 경로가 같은 experience-block 을 쓰고, 없으면 실제 질문으로 상황을 세운다', () => {
    const { buildAuthorExperienceBlock, buildRealSituationBlock } = require('../src/core/final/narrative-flow');
    expect(buildAuthorExperienceBlock('')).toBe('');
    expect(buildAuthorExperienceBlock('짧음')).toBe('');
    expect(buildAuthorExperienceBlock('작년 9월에 고지서를 받고 시청 환경과에 면제 신청서를 냈는데 2주 뒤 환급됐습니다.')).toContain('1인칭으로');
    expect(buildRealSituationBlock(['Q. 면제 대상인데 고지서가 왔어요. 따로 신청해야 하나요?'])).toContain('체험으로 꾸미지 마세요');
    expect(buildRealSituationBlock([])).toBe('');

    const { buildAgentHarnessRules } = require('../src/core/final/agent-harness');
    const withMemo = buildAgentHarnessRules({ keyword: '환경개선부담금 면제', currentYear: 2026, experience: { note: '작년 9월 시청 환경과에 면제 신청서를 내고 2주 뒤 환급받았습니다.' } });
    expect(withMemo).not.toContain('겪은 척');
    const without = buildAgentHarnessRules({ keyword: '환경개선부담금 면제', currentYear: 2026, demandQuestions: ['면제 대상인데 고지서가 왔어요. 따로 신청해야 하나요?'] });
    expect(without).toContain('[검색자가 실제로 올린 질문');

    // 화면 → 에이전트 경로로 메모가 넘어간다 (지금까지는 API 경로만 읽었다)
    expect(read('electron/main.ts')).toContain('experience: (payload as any)?.experience,');
    // API 경로는 육하원칙 메모가 있으면 겹치지 않게 43% 단계에 맡긴다
    expect(read('src/core/final/orchestration.ts')).toContain('const hasFormMemo = hasExperience(normalizeExperience((payload as any)?.experience));');
  });

  test('규칙이 두 경로에 다 실려 있고, storyscope 의 훈계 금지와 모순되지 않는다', () => {
    expect(NARRATIVE_FLOW_RULES).toContain('서론은 독자가 검색창에 친 질문 하나로 끝납니다');
    expect(NARRATIVE_FLOW_RULES).toContain('필자의 판단 한 문장으로 닫습니다');
    expect(read('src/core/final/generation.ts')).toContain('${NARRATIVE_FLOW_RULES}');
    // 제목이 절 프롬프트에 실린다 — "제목의 공감을 본문이 끝까지 이어받아야 해"
    // v3.8.672: 제목 블록은 실(thread) 블록 안으로 들어갔다 — orchestration 은 실을 만들고, 문구는 thread.ts 가 가진다
    expect(read('src/core/final/thread.ts')).toContain('📌 [이 글의 제목]');
    expect(read('src/core/final/orchestration.ts')).toContain('buildThreadBlock(articleThread');
    expect(read('src/core/final/agent-harness.ts')).toContain("require('./narrative-flow').NARRATIVE_FLOW_RULES");
    const s = read('src/core/final/storyscope-rules.ts');
    expect(s).toContain('근거 붙은 필자의 판단');
    expect(s).toContain('금지는 **근거 없는 훈계**입니다');
  });
});
