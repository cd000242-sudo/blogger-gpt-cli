'use strict';

function buildTitleInstructionBlock() {
  return `[네이버 블로그 제목 생성]
제목 후보 10개를 만든다.
각 제목은 검색 의도와 클릭 이유가 함께 있어야 한다.
낚시성 제목, 과장 제목, 다른 주제에도 붙일 수 있는 generic 제목은 금지한다.

제목 후보는 아래 요소 중 2~4개를 자연스럽게 포함한다.
- 핵심 키워드
- 대상 독자
- 궁금증
- 조건/방법/주의사항/정리/체크리스트
- 최신 또는 기준 시점
- 독자가 얻을 정보

제목 유형 예시:
1. 검색 정리형: 핵심 키워드 조건과 확인방법 정리
2. 궁금증 해결형: 핵심 키워드, 어디서 헷갈릴까?
3. 체크리스트형: 핵심 키워드 확인 전 체크할 부분
4. 경험/공감형: 핵심 키워드를 알아보다가 막히는 부분
5. 이슈 정리형: 핵심 이슈의 쟁점과 반응 정리

제목 점수 100점 기준:
- 핵심 키워드가 자연스럽게 포함됨: 20
- 검색 의도와 맞음: 25
- 클릭할 만큼 구체적임: 20
- 낚시성/과장 없음: 15
- generic 제목이 아님: 10
- 원문 내용과 정확히 맞음: 10`;
}

function scoreTitleLocally(title, context) {
  const text = String(title || '').trim();
  const primary = context && context.primaryKeyword ? String(context.primaryKeyword) : '';
  let score = 45;
  if (primary && text.includes(primary)) score += 18;
  if (/(조건|방법|정리|확인|주의|체크|기준|조회|신청|대상)/.test(text)) score += 16;
  if (text.length >= 18 && text.length <= 42) score += 12;
  if (/[!?！？]{2,}|충격|대박|무조건|100%|바로 클릭/.test(text)) score -= 24;
  if (/(총정리|완벽정리)$/.test(text)) score -= 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
  buildTitleInstructionBlock,
  scoreTitleLocally,
};
