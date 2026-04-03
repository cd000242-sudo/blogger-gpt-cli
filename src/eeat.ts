export function insertEEATTags(text: string): string {
  return `
※ 이 글은 실제 사례와 전문가의 조언을 기반으로 작성되었습니다.  
※ 결과는 개인의 상황에 따라 달라질 수 있으며, 신뢰할 수 있는 정보를 바탕으로 구성되었습니다.

${text}
`;
}
