/**
 * 🤖 AI 비서 프롬프트 (v3.8.713)
 *
 * 사장님: "사용자들이 문제가있거나 궁금증이있다면 나한테 묻는거나 다름이없어지지
 *          왜냐 어차피 난 너한테 또물어보거든"
 *
 * 그 구도를 그대로 옮긴다 — 앱을 만든 사람을 대신하는 비서. 다만 **아는 것만 말한다.**
 * 지식(매뉴얼)과 진단(앱의 실제 상태) 밖의 것을 지어내면, 사용자는 그 말을 믿고
 * 엉뚱한 곳을 고치다 시간을 버린다. 그래서 "모르면 모른다"를 규칙 1번에 둔다.
 */

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantPromptInput {
  /** 앱 사용 매뉴얼 (빌드에 동봉된 지식 파일) */
  knowledge: string;
  /** 앱이 스스로 보고한 상태 — 이미 마스킹된 것이어야 한다 */
  diagnostics: unknown;
  /** 최근 대화 (오래된 것부터) */
  history?: AssistantTurn[];
  /** 이번 질문 */
  question: string;
  /** 프롬프트 전체 상한 — 넘으면 지식부터 줄인다 */
  maxChars?: number;
}

const RULES = [
  '1. **아는 것만 말합니다.** 아래 「앱 매뉴얼」과 「지금 이 앱의 상태」에 없는 것은 지어내지 말고,',
  '   "그건 제가 확인할 수 없습니다"라고 말한 뒤 무엇을 확인하면 되는지 알려주세요.',
  '2. 답은 **결론 먼저**, 그 다음 근거입니다. 근거는 상태·로그에서 본 것을 그대로 인용하세요.',
  '3. 마지막에 **다음에 누를 것**을 화면의 실제 이름으로 알려주세요 (예: 환경설정 → API 키 탭).',
  '4. 사용자는 개발자가 아닙니다. 코드·파일 경로·함수 이름을 답에 쓰지 마세요.',
  '5. 짧게. 5문장을 넘기지 마세요. 목록이 필요하면 3줄까지.',
  '6. 사과문·인사말로 시작하지 마세요. 바로 답부터.',
].join('\n');

function trimTurns(history: AssistantTurn[] | undefined, maxTurns: number): AssistantTurn[] {
  return (Array.isArray(history) ? history : [])
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .slice(-maxTurns);
}

/**
 * 비서에게 보낼 프롬프트 한 덩어리를 만든다.
 *
 * 길이가 넘치면 **지식부터** 줄인다 — 진단과 질문은 이번 답의 근거라 못 줄인다.
 */
export function buildAssistantPrompt(input: AssistantPromptInput): string {
  const maxChars = input.maxChars ?? 24000;
  const question = String(input.question || '').trim().slice(0, 2000);
  const turns = trimTurns(input.history, 6);

  const diagText = (() => {
    try { return JSON.stringify(input.diagnostics ?? {}, null, 1).slice(0, 6000); }
    catch { return '{}'; }
  })();

  const historyText = turns.length
    ? turns.map((t) => (t.role === 'user' ? '사용자: ' : '비서: ') + t.text.slice(0, 600)).join('\n')
    : '(없음)';

  const fixed = [
    '당신은 블로그 자동화 앱 "LEADERNAM Orbit" 을 만든 개발자를 대신하는 **앱 안의 비서**입니다.',
    '사용자가 앱을 쓰다 막혔을 때, 앱의 실제 상태를 보고 한국어로 도와줍니다.',
    '',
    '## 지켜야 할 것',
    RULES,
    '',
    '## 지금 이 앱의 상태 (사용자 PC 에서 방금 읽은 값)',
    '```json',
    diagText,
    '```',
    '',
    '## 최근 대화',
    historyText,
    '',
    '## 사용자의 질문',
    question,
    '',
    '위 규칙대로, 한국어로 답하세요.',
  ].join('\n');

  const room = Math.max(1000, maxChars - fixed.length - 60);
  const knowledge = String(input.knowledge || '').slice(0, room);

  return [
    fixed.slice(0, fixed.indexOf('## 지금 이 앱의 상태')),
    '## 앱 매뉴얼',
    knowledge,
    '',
    fixed.slice(fixed.indexOf('## 지금 이 앱의 상태')),
  ].join('\n');
}

/**
 * 에이전트 CLI 가 답을 코드블록이나 잡음과 함께 뱉는 경우가 있다 — 사람이 읽을 부분만 남긴다.
 * (에이전트 발행 경로에서 겪은 것과 같은 청소다.)
 */
export function cleanAssistantAnswer(raw: unknown): string {
  let text = String(raw ?? '').trim();
  // 통째로 코드블록에 싸여 온 경우만 벗긴다 — 본문 안의 코드블록은 그대로 둔다
  const fenced = text.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (fenced) text = fenced[1]!.trim();
  return text
    .replace(/^\s*(안녕하세요[!,.]?\s*)/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
