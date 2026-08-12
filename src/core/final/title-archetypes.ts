/**
 * title-archetypes — 제목이 취할 수 있는 "형태" 목록.
 *
 * 상투어 예시를 일부러 넣지 않는다. 예전에는 "OO 완벽 가이드" · "OO 핵심 정리" 같은
 * 본보기를 보여줬는데, 그러면 모든 사용자의 제목이 그 몇 개로 수렴한다.
 * (실측 2026-08-06: 같은 키워드 3편이 12자를 통째로 공유했다.)
 * 무엇을 말할지만 정해주고, 어떤 낱말로 쓸지는 그 글의 내용에서 뽑게 한다.
 *
 * generation.ts(API 경로)와 에이전트 모드가 **같은 목록**을 쓴다.
 * 한쪽에만 있으면 엔진을 바꿨을 때 제목 품질이 조용히 달라진다.
 */

export interface TitleArchetype { name: string; hint: string }

export function getTitleArchetypes(currentYear: number): TitleArchetype[] {
  return [
    { name: '결론 선공개', hint: '읽기 전에 답부터 알려준다. 결론이나 판단을 제목에 넣는다.' },
    { name: '조건 한정', hint: '누구에게 해당되는지를 못 박는다. 대상·상황을 앞세운다.' },
    { name: '숫자 기준', hint: '금액·기간·비율 등 이 글에만 있는 구체적 수치를 제목에 넣는다.' },
    { name: '질문 그대로', hint: '검색자가 실제로 던진 질문을 거의 그대로 제목으로 쓴다.' },
    { name: '오해 교정', hint: '흔히 잘못 아는 내용을 제목에서 바로잡는다.' },
    { name: '갈림길', hint: '두 선택지 중 무엇이 나은지를 제목에서 묻거나 답한다.' },
    { name: '놓치면 손실', hint: '모르고 지나치면 잃는 것을 구체적으로 적는다. 겁주기가 아니라 사실로.' },
    { name: '변경점', hint: `${currentYear}년에 무엇이 달라졌는지를 구체적으로 짚는다.` },
    { name: '순서 안내', hint: '무엇부터 해야 하는지 첫 단계를 제목에 드러낸다.' },
    { name: '경계 사례', hint: '되는 경우와 안 되는 경우가 갈리는 지점을 제목에 담는다.' },
  ];
}

/** 매번 다른 형태가 뽑히게 섞어서 몇 개만 준다 — 전부 주면 또 한 곳으로 수렴한다 */
export function buildArchetypeGuide(currentYear: number, count = 3): string {
  const shuffled = [...getTitleArchetypes(currentYear)].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count)
    .map((a, i) => `${i + 1}. **${a.name}형**: ${a.hint}`)
    .join('\n');
}
