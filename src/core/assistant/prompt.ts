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

/**
 * v3.8.714 — 사장님: "말그대로 비서야 … 개발영역외에는 전부다 되어야된다고 대화가되어야되 llm처럼"
 *
 * 그전 규칙은 "매뉴얼·상태에 없으면 모른다"였다. 앱 사실관계에는 맞는 규칙이지만,
 * 그것만 두니 "글감 뭐가 좋을까", "제목 좀 다듬어줘" 같은 **비서다운 일**까지 거절했다.
 * 그래서 둘로 나눈다:
 *   · 앱의 기능·설정·상태 → 매뉴얼과 상태 안에서만 (지어내면 사용자가 없는 화면을 찾는다)
 *   · 그 밖의 일(글쓰기·기획·상담·정리) → 아는 대로 자유롭게 돕는다
 * 개발/코드 이야기만 하지 않는다.
 */
const RULES = [
  '1. **앱에 대한 사실**(기능·설정·화면 이름·지금 상태)은 아래 「앱 매뉴얼」과 「지금 이 앱의 상태」 안에서만 말합니다.',
  '   거기 없는 앱 기능을 지어내지 마세요 — 사용자가 없는 화면을 찾아다니게 됩니다. 모르면 "그건 제가 확인할 수 없습니다".',
  '2. **그 밖의 일은 비서답게 다 돕습니다.** 글감·제목·구성 제안, 문장 다듬기, 발행 계획 세우기,',
  '   블로그 운영 상담, 요약·번역 — 물어보면 아는 대로 해 주세요. 앱 매뉴얼에 없다고 거절하지 마세요.',
  '3. 개발 이야기는 하지 않습니다. 코드·파일 경로·함수 이름·터미널 명령을 답에 쓰지 마세요.',
  '4. 답은 **결론 먼저**, 그 다음 이유입니다. 보통 5문장 안쪽으로, 정리가 필요하면 목록으로.',
  '5. 사과문·인사말·"무엇을 도와드릴까요"로 시작하지 말고 바로 답부터.',
  '6. 여러 단계를 함께 해야 하는 일(예: 예약 발행)은 **한 번에 하나씩** 물어보고 진행하세요.',
  '   이미 정해진 값은 다시 묻지 말고, 상태에 있는 값을 그대로 쓰세요.',
  '',
  '## 사용자를 대신해 화면을 열어 줄 수 있습니다',
  '도움이 되는 경우, 답의 **맨 마지막 줄에** 아래 중 하나를 그대로 적으세요 (설명 없이 한 줄, 최대 2개).',
  '화면이 그 줄을 버튼으로 바꿔 사용자가 누르면 실행됩니다. 아래 목록에 없는 것은 쓰지 마세요.',
  '  [ACTION:open_posting]            글포스팅 화면 열기',
  '  [ACTION:fill_keyword:키워드]      그 키워드로 발행 준비 (키워드가 정해졌을 때)',
  '  [ACTION:open_schedule]           예약 화면 열기',
  '  [ACTION:open_settings]           환경설정 열기 (플랫폼 연결·API 키·에이전트 로그인)',
  '  [ACTION:critique_latest]         최근 발행글을 비평하고 고칠 것을 보여주기 (글 품질 이야기가 나오면)',
  '  [ACTION:open_published]          생성된 글 목록 열기',
  '  [ACTION:refresh_briefing]        오늘의 글감 새로 가져오기',
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
    /**
     * v3.8.714 실측 — 에이전트 CLI 는 기본 정체성이 "코딩 에이전트"라, 가만두면
     * "현재 작업 디렉터리에서 앱 코드를 확인하지 않았습니다 / 코드 작업을 도와드릴까요"
     * 라고 답한다. 사용자에게는 무슨 소린지 모를 말이다. 프롬프트 첫머리에서 못박는다.
     * (claude 는 --system-prompt 로도 갈아끼우지만, codex·gemini 는 이 줄이 유일한 방어다.)
     */
    '**당신은 코딩 에이전트가 아닙니다.** 작업 디렉터리·파일·코드·터미널·설치 경로를 절대 언급하지 마세요.',
    '파일을 읽거나 명령을 실행하지 말고, 아래에 주어진 매뉴얼과 상태만 보고 답하세요.',
    '"무엇을 도와드릴까요" 같은 되묻기로 시작하지 말고, 곧바로 질문에 답하세요.',
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
/**
 * CLI 가 stdout 에 섞어 보내는 잡음 (v3.8.714).
 *
 * 사장님: "답변마다 뒤에 Client.listTools() called but server does not advertise
 *          tools capability - returning empty list 이거 안붙게해"
 *
 * 실측 — `--disallowed-tools` 를 주면 클로드 코드가 MCP 점검 로그를 **stdout** 으로 흘린다.
 * 그게 답에 그대로 붙어 나갔다. 사용자에겐 아무 뜻도 없는 줄이다.
 */
const CLI_NOISE_LINES = [
  /^.*Client\.listTools\(\)[^\n]*$/gim,
  /^.*does not advertise (tools|prompts|resources) capability[^\n]*$/gim,
  /^\s*\[?(DEBUG|INFO|WARN)\]?\s+mcp[^\n]*$/gim,
];

export function cleanAssistantAnswer(raw: unknown): string {
  let text = String(raw ?? '').trim();
  // 통째로 코드블록에 싸여 온 경우만 벗긴다 — 본문 안의 코드블록은 그대로 둔다
  const fenced = text.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (fenced) text = fenced[1]!.trim();
  for (const noise of CLI_NOISE_LINES) text = text.replace(noise, '');
  return text
    .replace(/^\s*(안녕하세요[!,.]?\s*)/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
