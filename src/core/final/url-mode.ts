// 🔗 URL 전용 생성 모드 판정 헬퍼 — 무거운 의존성 없이 단독 테스트 가능하도록 분리

/**
 * URL 전용 모드에서 실제로 사용할 키워드를 결정한다.
 *
 * UI의 키워드 입력란은 "URL로 생성" 탭에서 화면에만 숨겨질 뿐 직전 발행 때 쓴 값이 그대로 남는다.
 * 그 값이 payload.topic으로 넘어오면 url-content-generator의
 * `effectiveKeyword = keyword || 크롤링 제목`이 stale 키워드를 우선 채택해
 * 제목·H2·본문·태그·썸네일이 전부 이전 키워드 기준으로 생성된다
 * ("URL로 썼는데 예전에 키워드로 발행했던 글이 다시 나옴" 증상).
 *
 * urlBasedGeneration === true 는 "URL로 생성" 명시 요청이므로,
 * 키워드를 버리고 URL 본문에서 주제를 추출하게 한다.
 * 느슨한 비교를 쓰지 않는 이유: 문자열 'true'나 1 같은 값이 키워드 모드를 잘못 무력화하면
 * 정상적인 키워드 발행이 통째로 깨지기 때문.
 */
export function resolveUrlModeKeyword(urlBasedGeneration: unknown, keyword: string): string {
  return urlBasedGeneration === true ? '' : keyword;
}
