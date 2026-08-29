/**
 * url-topic-recovery — 제목을 못 뽑았으면 **본문에서 주제를 되찾는다.** (v3.8.597)
 *
 * ## 사장님 지적
 * "URL 모드에서 실패할 수가 있니?? 그럼 크롤링이 잘못된 거 아니냐??
 *  글 하나의 주소를 당연히 넣는 건데 뭔 소리야"
 *
 * 맞는 지적이다. v3.8.595 에서 내가 넣은 메시지가 틀렸다 —
 * "블로그 홈이 아니라 글 하나의 주소를 넣어 주세요" 는 **사용자 탓으로 돌리는 문구**다.
 * 사용자는 당연히 글 주소를 넣는다. 제목을 못 뽑았으면 그건 **우리 수집이 실패한 것**이다.
 *
 * ## 그래서 멈추기 전에 한 번 더 한다
 * 제목만 없고 **본문은 있는** 경우가 있다. 그러면 주제는 본문 안에 있다 —
 * 사람이 읽으면 바로 아는 것을 모델에게 물어보면 된다. 여기서 멈출 이유가 없다.
 *
 * 호출은 **제목을 못 뽑았을 때만** 한 번. 평소에는 0회다.
 *
 * ## 그래도 안 되면
 * 본문조차 비어 있으면 그때는 진짜 수집 실패다. 그때의 메시지는
 * **무엇을 시도했고 무엇이 실패했는지**를 말한다. 사용자에게 다른 주소를 넣으라고 하지 않는다.
 */

/** 본문이 이만큼은 있어야 주제를 물어볼 수 있다 */
export const RECOVERABLE_CONTENT_MIN = 200;

/** 주제로 쓸 수 없는 답 — 모델이 얼버무렸거나 빈손인 경우 */
const UNUSABLE = /^(알\s*수\s*없|모르겠|확인\s*불가|없음|unknown|n\/a)/i;

export function buildTopicRecoveryPrompt(content: string): string {
  return [
    '아래는 어떤 글의 본문입니다. 이 글이 **무엇에 대한 글인지** 한 줄로 말해 주세요.',
    '',
    '- 검색창에 칠 법한 말로 쓰세요 (예: "혁신성장촉진자금 신청 조건").',
    '- 글쓴이·블로그·사이트 이름을 넣지 마세요. **주제만** 말합니다.',
    '- 설명·따옴표·번호 없이 그 한 줄만 출력하세요.',
    '',
    '[본문]',
    String(content || '').replace(/\s+/g, ' ').slice(0, 3000),
  ].join('\n');
}

/** 모델 답을 주제로 쓸 수 있게 다듬는다. 못 쓰면 빈 문자열 */
export function cleanRecoveredTopic(raw: string): string {
  const value = String(raw || '')
    .split('\n')[0]!
    .replace(/^["'\d.)\s-]+/, '')
    .replace(/["']+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value || value.length < 4 || value.length > 60) return '';
  return UNUSABLE.test(value) ? '' : value;
}

/**
 * 제목이 없을 때 본문에서 주제를 되찾는다.
 * 본문이 너무 짧거나 모델이 못 답하면 빈 문자열 — 그때는 부르는 쪽에서 판단한다.
 */
export async function recoverTopicFromContent(
  content: string,
  callLLM: (prompt: string) => Promise<string>,
): Promise<string> {
  const body = String(content || '').trim();
  if (body.length < RECOVERABLE_CONTENT_MIN) return '';
  try {
    return cleanRecoveredTopic(await callLLM(buildTopicRecoveryPrompt(body)));
  } catch {
    return '';   // 되찾기 실패가 발행을 막는 이유가 되면 안 된다
  }
}

/**
 * 진짜로 아무것도 못 가져왔을 때의 메시지.
 * **우리가 무엇을 시도했는지**를 말한다 — 사용자에게 주소를 바꾸라고 하지 않는다.
 */
export function describeCrawlFailure(url: string, isNaverBlog: boolean): string {
  const tried = isNaverBlog
    ? '모바일 주소 · PostView · RSS · 네이버 검색 API'
    : '직접 요청 · 브라우저 폴백';
  return `이 주소에서 본문을 가져오지 못했습니다 (시도: ${tried}). `
    + `주소 문제가 아니라 수집 실패입니다 — 원문이 로그인·차단을 걸어 두었을 수 있습니다.\n${url}`;
}
