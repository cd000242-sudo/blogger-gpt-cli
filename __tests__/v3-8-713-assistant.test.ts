const fs = require('fs');
const path = require('path');

import { redactText, redactLogLines, redactDeep } from '../src/core/assistant/redact';
import { buildAssistantPrompt, cleanAssistantAnswer } from '../src/core/assistant/prompt';
import { braceBlock, blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.713 — AI 비서 1단계 (진단 비서).
 *
 * 사장님: "에이전트 자체가 붙으면어떠니?? … 사용자들의 문제점도 알수있자나"
 *         "사용자들이 문제가있거나 궁금증이있다면 나한테 묻는거나 다름이없어지지"
 *
 * 비서는 앱의 상태와 최근 로그를 읽어 답한다. 그 내용이 **에이전트/API 로 나가므로**
 * 마스킹이 이 기능의 관문이다 — 새는 패턴 하나가 곧 키 유출 사고다. 그래서 여기부터 잰다.
 */
describe('v3.8.713 AI 비서', () => {
  // 여러 describe 가 같이 읽는 소스들
  const main = read('electron/main.ts');
  const ui = read('electron/ui/modules/assistant.js');
  const gate = read('electron/ui/index.html');
  describe('🔒 마스킹 — 비밀은 한 글자도 나가지 않는다', () => {
    /** [무엇, 로그 한 줄, 그 줄에서 절대 나가면 안 되는 값] */
    const 유출들: Array<[string, string, string]> = [
      ['OpenAI 키', 'Bearer sk-proj-AbCd1234EfGh5678IjKl', 'sk-proj-AbCd1234EfGh5678IjKl'],
      ['Google 키', '[ENV] GEMINI_API_KEY=AIzaSyD-1234567890abcdefg 로드', 'AIzaSyD-1234567890abcdefg'],
      ['Perplexity 키', 'pplx-9f8e7d6c5b4a3210zyxw', 'pplx-9f8e7d6c5b4a3210zyxw'],
      ['리프레시 토큰', 'refresh_token=1//0eXaMpLe-Token_Value_1234567890', '1//0eXaMpLe-Token_Value_1234567890'],
      ['구글 액세스 토큰', 'Authorization: Bearer ya29.a0AfH6SMBx1234567890abcdef', 'ya29.a0AfH6SMBx1234567890abcdef'],
      ['비밀번호 대입', 'wordpressPassword: hunter2secret', 'hunter2secret'],
      ['주소 쿼리 키', 'https://api.example.com/v1?api_key=abcdef1234567890&x=1', 'abcdef1234567890'],
      ['주소 안 자격증명', 'https://admin:s3cr3tpw@blog.example.com/xmlrpc.php', 's3cr3tpw'],
      ['이메일', '계정 someone@example.com 으로 로그인', 'someone@example.com'],
      ['전화번호', '인증번호를 010-1234-5678 로 보냈습니다', '010-1234-5678'],
    ];

    test.each(유출들)('%s 가 원문 그대로 남지 않는다', (_label, line, secret) => {
      const out = redactText(line);
      expect(out).not.toContain(secret);
      expect(out).toContain('***');
    });

    test('문장은 남긴다 — 지우되 맥락은 보여야 비서가 진단한다', () => {
      const out = redactText('[DISPATCH] ⚠️ 나노바나나2 실패: BILLING_REQUIRED (key=AIzaSyD-1234567890abcdefg)');
      expect(out).toContain('나노바나나2 실패');
      expect(out).toContain('BILLING_REQUIRED');
      expect(out).not.toContain('AIzaSyD-1234567890abcdefg');
    });

    test('평범한 로그는 건드리지 않는다 — 과잉 마스킹은 진단을 눈멀게 한다', () => {
      const plain = '[PROGRESS] 45% - 본문을 만드는 중 (3/7 구간)';
      expect(redactText(plain)).toBe(plain);
    });

    test('로그 꼬리는 줄 수·길이를 함께 자른다', () => {
      const lines = Array.from({ length: 400 }, (_, i) => 'line ' + i + ' ' + 'x'.repeat(500));
      const out = redactLogLines(lines, { maxLines: 90, maxChars: 240 });
      expect(out).toHaveLength(90);
      expect(out.every((l) => l.length <= 240)).toBe(true);
      expect(out[out.length - 1]).toContain('line 399');
    });

    test('진단 객체는 키 이름이 비밀을 가리키면 값을 통째로 지운다', () => {
      const out: any = redactDeep({
        app: { version: '3.8.713' },
        apiKeys: { openai: true, gemini: false },   // 불리언은 그대로 — 비서가 알아야 한다
        nested: { openaiKey: 'sk-proj-LiveKey1234567890', note: '정상' },
      });
      expect(out.app.version).toBe('3.8.713');
      expect(out.apiKeys).toEqual({ openai: true, gemini: false });
      expect(out.nested.openaiKey).toBe('***');
      expect(out.nested.note).toBe('정상');
    });
  });

  describe('프롬프트 — 아는 것만 말하게 못박는다', () => {
    const prompt = buildAssistantPrompt({
      knowledge: '# 매뉴얼\n티스토리 세션이 만료되면 다시 로그인한다.',
      diagnostics: { app: { version: '3.8.713' }, apiKeys: { openai: true } },
      history: [{ role: 'user', text: '이전 질문' }, { role: 'assistant', text: '이전 답' }],
      question: '발행이 안 돼요',
    });

    test('매뉴얼·상태·질문이 모두 실린다', () => {
      expect(prompt).toContain('티스토리 세션이 만료되면');
      expect(prompt).toContain('"version": "3.8.713"');
      expect(prompt).toContain('발행이 안 돼요');
      expect(prompt).toContain('이전 답');
    });

    /** v3.8.714: "앱 사실"에 한해서만 근거 밖 답변을 막는다 (그 밖의 일은 비서답게 돕는다) */
    test('앱 기능을 지어내지 못하게 한다 — 없는 화면을 찾아다니게 된다', () => {
      expect(prompt).toContain('앱에 대한 사실');
      expect(prompt).toContain('지어내지 마세요');
      expect(prompt).toContain('확인할 수 없습니다');
    });

    test('개발자용 답을 막는다 — 사용자는 코드를 모른다', () => {
      expect(prompt).toContain('코드·파일 경로·함수 이름·터미널 명령을 답에 쓰지 마세요');
    });

    test('길이 상한을 넘지 않는다 — 넘치면 매뉴얼부터 줄인다', () => {
      const big = buildAssistantPrompt({
        knowledge: 'ㄱ'.repeat(80000),
        diagnostics: { a: 1 },
        question: '질문',
        maxChars: 12000,
      });
      expect(big.length).toBeLessThanOrEqual(12100);
      expect(big).toContain('질문');
    });

    test('답에서 통째 코드블록·인사말을 걷어낸다', () => {
      expect(cleanAssistantAnswer('```\n답입니다\n```')).toBe('답입니다');
      expect(cleanAssistantAnswer('안녕하세요! 티스토리 로그인이 만료됐습니다')).toBe('티스토리 로그인이 만료됐습니다');
    });

    /*
     * v3.8.714 — 사장님: "답변마다 뒤에 Client.listTools() … 이거 안붙게해"
     * --disallowed-tools 를 주면 CLI 가 MCP 점검 로그를 stdout 으로 흘려 답에 붙었다.
     */
    test('CLI 가 흘리는 MCP 잡음을 답에서 걷어낸다', () => {
      const raw = '티스토리 로그인이 만료됐습니다.\n'
        + 'Client.listTools() called but server does not advertise tools capability - returning empty list';
      const out = cleanAssistantAnswer(raw);
      expect(out).toBe('티스토리 로그인이 만료됐습니다.');
      expect(out).not.toContain('listTools');
    });

    test('화면에서도 한 겹 더 거른다 — 경로가 달라도 사용자 눈에는 안 보여야 한다', () => {
      expect(ui).toContain('function stripCliNoise');
      expect(ui).toContain('Client\\.listTools');
      expect(ui).toContain('esc(stripCliNoise(text))');
    });

    test('안내문은 접어 둔다 — 매번 세 줄이 펼쳐져 있으면 화면이 반쯤 찬다', () => {
      expect(ui).toContain('<details class="as-intro">');
      expect(ui).toContain('<summary>무엇이든 물어보세요');
      expect(ui).toContain('.as-intro > summary');
    });
  });

  /*
   * v3.8.714 — 사장님: "에이전트 내에 모델선택이 가능하자나 페이블이나 오푸스 소넷 등등 …
   *            코덱스도 이번에 아스트라나온것처럼" / "홈에도 배찌로 선택가능하자나"
   * 목록은 한 곳(src/core/agent-models)에만 두고, 화면 셋(홈 배지·시작 게이트·비서)이 그걸 읽는다.
   * 값은 전부 실제 CLI 에 넣어 돌려 본 것만 담는다 — 없는 모델을 고르게 하면 그 자리에서 죽는다.
   */
  describe('v3.8.714 에이전트 안 모델 선택', () => {
    const { AGENT_MODELS, agentModelsFor, normalizeAgentModel, agentModelLabel } = require('../src/core/agent-models');

    test('실측으로 확인한 모델만 담는다', () => {
      expect(agentModelsFor('claude').map((m: any) => m.value))
        .toEqual(['', 'claude-fable-5', 'claude-opus-5', 'claude-sonnet-5']);
      expect(agentModelsFor('codex').map((m: any) => m.value))
        .toEqual(['', 'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']);
      // gemini 는 모델 이름을 확인하지 못했다 — 기본값만 둔다
      expect(agentModelsFor('gemini').map((m: any) => m.value)).toEqual(['']);
    });

    test('목록에 없는 값은 기본값으로 되돌린다 — 없는 모델을 넘기면 실행이 죽는다', () => {
      expect(normalizeAgentModel('claude', 'claude-fable-5')).toBe('claude-fable-5');
      expect(normalizeAgentModel('claude', 'gpt-6-astra')).toBe('');   // 남의 집 모델
      expect(normalizeAgentModel('codex', '없는모델')).toBe('');
      expect(agentModelLabel('codex', 'gpt-6-astra')).toBe('GPT-6 Astra');
      expect(AGENT_MODELS.claude[0].value).toBe('');                   // 첫 줄은 "설정 그대로"
    });

    test('메인이 목록을 주고, 실행 인자로 모델을 넘긴다', () => {
      expect(main).toContain("ipcMain.handle('agent:models'");
      const task = braceBlock(main, 'async function runAgentTextTask');
      expect(task).toContain("['-m', opts.model]");        // codex·gemini
      expect(task).toContain("'--model', opts.model");     // claude
    });

    test('화면 셋이 같은 목록을 읽고 같은 곳에 저장한다 — 목록·저장 두 벌 금지', () => {
      const badges = read('electron/ui/modules/header-badges.js');
      const workshop = read('electron/ui/modules/codex-workshop.js');
      expect(badges).toContain('data-hb-agent-model');
      expect(badges).toContain('window.setAgentModel');
      expect(ui).toContain("invoke?.('agent:models')");       // 비서 패널
      expect(gate).toContain("invoke('agent:models')");       // 시작 게이트
      expect(workshop).toContain("AGENT_MODELS_KEY = 'leadernamAgentModels'");
      expect(workshop).toContain('window.setAgentModel = setAgentModel');
    });

    test('발행에도 그 모델이 실린다 — 화면에만 있고 안 먹으면 유령 설정이다', () => {
      expect(main).toContain("(request?.payload as any)?.agentModel");
      // claude 분기에 --model 이 붙는다 (이 문자열은 파일에서 한 번만 나온다)
      expect(main).toContain("...(model ? ['--model', model] : [])");
      expect((main.match(/\.\.\.\(model \? \['--model', model\] : \[\]\)/g) || []).length).toBe(1);
    });
  });

  /*
   * v3.8.714 — 사장님: "말그대로 비서야 … 개발영역외에는 전부다 되어야된다고 대화가되어야되 llm처럼"
   * 앱 사실관계는 매뉴얼·상태 안에서만, 그 밖의 일(글감·제목·상담)은 자유롭게 돕는다.
   */
  describe('v3.8.714 대화형 비서 + 대신 눌러주기', () => {
    test('앱 사실은 근거 안에서, 나머지는 비서답게 돕는다', () => {
      const built = buildAssistantPrompt({ knowledge: 'ㄱ', diagnostics: {}, question: 'ㄴ' });
      expect(built).toContain('앱에 대한 사실');
      expect(built).toContain('그 밖의 일은 비서답게 다 돕습니다');
      expect(built).toContain('앱 매뉴얼에 없다고 거절하지 마세요');
      expect(built).toContain('개발 이야기는 하지 않습니다');
      expect(built).toContain('한 번에 하나씩');
    });

    test('행동 목록이 프롬프트와 화면에서 같다 — 없는 행동을 말하면 버튼이 안 나온다', () => {
      const built = buildAssistantPrompt({ knowledge: 'ㄱ', diagnostics: {}, question: 'ㄴ' });
      for (const act of ['open_posting', 'fill_keyword', 'open_schedule', 'open_settings', 'open_published', 'refresh_briefing']) {
        expect(built).toContain(`[ACTION:${act}`);
        expect(ui).toContain(act);
      }
    });

    /*
     * v3.8.714 — 사장님: "ai 비서 옆에 배찌도 코덱스로 할지 클로드코드로할지 선택가능하게해야지"
     * 비서의 에이전트 선택은 **글 생성용과 별개**다 — 비서를 코덱스로 바꿨다고
     * 글까지 코덱스로 나가면 사장님이 모르는 사이에 바뀐다.
     */
    test('비서 패널에서 에이전트를 고른다 — 글 생성용 설정과 별개로 저장한다', () => {
      expect(ui).toContain('as-agent');
      expect(ui).toContain("ASSISTANT_AGENT_KEY = 'leadernamAssistantAgent'");
      expect(ui).toContain('function setAssistantAgent');
      // 글 생성용 저장소(leadernamActiveAgentProvider)를 덮어쓰지 않는다
      expect(ui).not.toContain("setItem('leadernamActiveAgentProvider'");
      expect(ui).not.toContain('window.setAgentProvider');
    });

    test('고른 에이전트가 1순위로 실제 호출에 쓰인다', () => {
      expect(ui).toContain('preferred: assistantAgent()');
      const handler = blockBetween(main, "ipcMain.handle('assistant:ask'", '📝 v3.8.711 — 사이트(LEWORD)');
      expect(handler).toContain("String(args?.preferred || '').trim()");
      expect(handler).toContain('ASSISTANT_AGENT_ORDER');
    });

    test('로그인 안 된 에이전트는 그렇게 표시하고, 준비된 쪽으로 맞춰 준다', () => {
      expect(ui).toContain('(로그인 필요)');
      expect(ui).toContain('setAssistantAgent(readyAgents[0].provider)');
    });

    /*
     * v3.8.714 — 사장님: "비서로 비평 개선이 가능하게 해주고"
     * 비평·개선 로직을 여기 다시 쓰지 않는다 — 목록 화면이 쓰는 채널을 그대로 부른다.
     */
    test('비서가 최근 발행글을 비평하고, 고치기까지 이어진다', () => {
      expect(ui).toContain('critique_latest');
      expect(ui).toContain('function runCritiqueLatest');
      expect(ui).toContain("invoke('assistant:latest-post'");
      expect(ui).toContain("invoke('critique-published-post'");
      // 개선은 목록 화면과 **같은 채널**로 (없는 채널을 부르면 조용히 죽는다)
      expect(ui).toContain("invoke('apply-post-improvement'");
      expect(read('electron/ui/modules/published-posts.js')).toContain("invoke('apply-post-improvement'");
      expect(main).toContain("ipcMain.handle('assistant:latest-post'");
      expect(main).toContain("ipcMain.handle('apply-post-improvement'");
    });

    test('고치기는 사장님이 누른 뒤에만 — 글이 저절로 바뀌면 안 된다', () => {
      const fn = braceBlock(ui, 'async function runCritiqueLatest');
      expect(fn).toContain('이대로 고치기');
      expect(fn).toContain("addEventListener('click'");
      // 비평 함수가 개선을 자기 손으로 부르지 않는다
      expect(fn).not.toContain("invoke('apply-post-improvement'");
    });

    test('행동은 버튼으로만 — 비서가 혼자 실행하지 않는다', () => {
      expect(ui).toContain('splitActions');
      expect(ui).toContain("addEventListener('click'");
      expect(ui).toContain('as-act');
    });
  });

  describe('배선 — 없는 채널·없는 버튼은 조용히 죽는다', () => {
    const sidebar = read('electron/ui/modules/sidebar.js');
    const mainModule = read('electron/ui/modules/main.js');

    test('IPC 두 개가 등록되고 화면이 실제로 부른다', () => {
      expect(main).toContain("ipcMain.handle('assistant:diagnostics'");
      expect(main).toContain("ipcMain.handle('assistant:ask'");
      expect(ui).toContain("invoke('assistant:ask'");
      expect(ui).toContain("invoke?.('assistant:diagnostics')");
    });

    test('사이드바 버튼 → openAssistant 까지 이어진다', () => {
      expect(sidebar).toContain("window.openAssistant?.()");
      expect(ui).toContain('window.openAssistant = openAssistant');
      expect(mainModule).toContain('initAssistant()');
    });

    /*
     * v3.8.714 — 사장님: "비서는 무조건 에이전트로만 움직이게해줘 코덱스나 클로드코드 안티그래비티"
     * 비서는 막혔을 때 여러 번 부르는 기능이라, 조용히 API 로 떨어지면 도움을 받을수록 요금이 붙는다.
     * 에이전트가 없으면 답하지 않고 로그인하라고 말한다.
     */
    test('에이전트 전용이다 — API 로 몰래 넘어가지 않는다', () => {
      // braceBlock 은 인자 타입 주석의 중괄호를 먼저 잡는다 — 다음 절까지로 자른다
      const handler = blockBetween(main, "ipcMain.handle('assistant:ask'", '📝 v3.8.711 — 사이트(LEWORD)');
      expect(handler).toContain('runAgentTextTask(');
      expect(handler).toContain('needsAgent: true');
      // API 폴백이 남아 있으면 안 된다 — 이 한 줄이 이번 요청의 핵심이다
      expect(handler).not.toContain('callGeminiWithRetry');
      expect(handler).not.toContain('applyEngineChoice');
    });

    test('로그인된 에이전트가 없으면 시작도 안 한다 — 프롬프트를 만들지도 않는다', () => {
      const handler = blockBetween(main, "ipcMain.handle('assistant:ask'", '📝 v3.8.711 — 사이트(LEWORD)');
      expect(handler.indexOf('needsAgent: true')).toBeLessThan(handler.indexOf('buildAssistantPrompt'));
    });

    /*
     * v3.8.714 실측 사고 — 비서에게 물었더니 이렇게 답했다:
     *   "현재 작업 디렉터리(C:\\…\\lba)에서 앱 코드나 설정을 아직 확인하지 않았습니다"
     *   "코드 작업 — Orbit 앱 자체의 기능 추가·수정·디버깅"
     * 클로드 코드의 기본 정체성(코딩 에이전트)이 우리 프롬프트를 눌러 버린 것이다.
     * 사장님: "클로드 코드로 하는게맞니? 기본값 페이블 폴백값 오푸스5로해"
     */
    test('클로드 코드의 정체성을 시스템 프롬프트로 갈아끼운다 — 코딩 에이전트로 답하면 안 된다', () => {
      expect(main).toContain('ASSISTANT_SYSTEM_PROMPT');
      expect(main).toContain('코딩 에이전트가 아닙니다');
      expect(main).toContain('작업 디렉터리');
      const task = braceBlock(main, 'async function runAgentTextTask');
      expect(task).toContain("'--system-prompt'");
    });

    test('모델은 페이블, 막히면 오푸스 5 (사장님 지정)', () => {
      expect(main).toContain("ASSISTANT_MODEL = 'claude-fable-5'");
      expect(main).toContain("ASSISTANT_FALLBACK_MODEL = 'claude-opus-5'");
      const task = braceBlock(main, 'async function runAgentTextTask');
      expect(task).toContain("'--model'");
      expect(task).toContain("'--fallback-model'");
    });

    /*
     * 실측(2026-09-10) — 페이블 한도가 찼을 때 CLI 에 --fallback-model 을 줘도
     * 자동으로 안 넘어갔다. 종료코드 1 + "You've reached your Fable 5 limit."
     * 그래서 폴백을 우리가 직접 돌린다. 이게 없으면 한도 찬 날 비서가 통째로 죽는다.
     */
    test('한도가 차면 우리가 직접 오푸스 5 로 넘긴다 — CLI 플래그만 믿지 않는다', () => {
      expect(main).toContain('function askAssistantViaClaude');
      // braceBlock 은 반환 타입 Promise<{…}> 의 중괄호를 먼저 잡는다 — 다음 절까지로 자른다
      const fn = blockBetween(main, 'async function askAssistantViaClaude', "ipcMain.handle('assistant:ask'");
      // 고른 모델 → 페이블 → 오푸스 5 순으로 후보를 만든다 (v3.8.714: 화면 선택이 1순위)
      expect(fn).toContain('ASSISTANT_MODEL, ASSISTANT_FALLBACK_MODEL');
      expect(fn).toContain('chosenModel');
      expect(fn).toContain('isModelUnavailableError');
      // 한도가 아닌 진짜 오류까지 두 번 부르면 안 된다
      expect(fn).toContain('throw error');
    });

    test('한도·과부하 메시지를 실측 문구로 알아본다', () => {
      const src = braceBlock(main, 'function isModelUnavailableError');
      expect(src).toMatch(/limit/);
      expect(src).toMatch(/switch to another model/i);
      expect(src).toMatch(/overload/);
    });

    test('비서는 도구를 못 쓴다 — 파일·터미널을 만지면 읽기 전용이 아니다', () => {
      expect(main).toContain('ASSISTANT_BLOCKED_TOOLS');
      for (const tool of ['Bash', 'Read', 'Write', 'Edit', 'WebFetch']) {
        expect(main).toContain(`'${tool}'`);
      }
      const task = braceBlock(main, 'async function runAgentTextTask');
      expect(task).toContain("'--disallowed-tools'");
    });

    test('시스템 프롬프트가 없는 에이전트를 위해 프롬프트 본문에도 못박는다', () => {
      const built = buildAssistantPrompt({ knowledge: '매뉴얼', diagnostics: {}, question: '질문' });
      expect(built).toContain('코딩 에이전트가 아닙니다');
      expect(built).toContain('작업 디렉터리');
      expect(built).toContain('되묻기로 시작하지 말고');
    });

    test('클로드 코드를 먼저 쓴다 — 로그인이 없을 때만 다른 에이전트로', () => {
      expect(main).toContain("ASSISTANT_AGENT_ORDER = ['claude', 'codex', 'gemini']");
    });

    /*
     * v3.8.714 — 사장님: "모달로 보여주지말고 … 사이드로 열리게해"
     * 화면을 덮으면 비서를 보는 동안 앱을 못 쓴다. 오른쪽 서랍이라야 설정을 보며 묻는다.
     */
    test('모달이 아니라 오른쪽 사이드 패널로 열린다', () => {
      expect(ui).toContain('position:fixed; top:0; right:0; bottom:0');
      expect(ui).toContain('background:transparent');       // 뒤 화면을 가리지 않는다
      expect(ui).not.toContain('backdrop-filter:blur(3px)');
      // 바깥 클릭으로 닫으면 뒤 화면을 만지려다 닫힌다
      expect(ui).not.toContain('if (e.target === overlay) close()');
    });

    test('에이전트가 없을 때 화면이 로그인으로 안내한다', () => {
      expect(ui).toContain('res?.needsAgent');
      expect(ui).toContain('구독 에이전트로만 동작합니다');
      expect(ui).toContain('openSettingsModal');
      // v3.8.714: 에이전트 이름은 드롭다운으로 옮겨서 배지는 상태만 말한다
      expect(ui).toContain("badge.textContent = '로그인 필요'");
    });

    /*
     * v3.8.714 실측 — 사장님이 비서에게 "이 앱 어떻게 쓰는 거예요?" 를 물었더니
     * "현재 글 엔진은 OpenAI GPT-4.1" 이라고 답했다. 화면에는 그런 이름이 없다.
     * 내부 id(openai-gpt41)를 그대로 넘긴 탓이고, 실제 모델은 GPT-5.6 Terra 다.
     * 사용자는 화면에서 그 이름을 못 찾고 앱이 틀린 줄 안다.
     */
    test('엔진 이름은 화면 라벨로 준다 — 내부 id 를 그대로 넘기면 없는 모델명이 나온다', () => {
      expect(main).toContain('function assistantTextEngineLabel');
      const fn = braceBlock(main, 'function assistantTextEngineLabel');
      // 라벨의 단일 출처는 pricing 표 — 화면도 같은 표를 읽는다
      expect(fn).toContain("require('../dist/core/llm/pricing')");
      expect(fn).toContain('tier?.title');
      const diag = braceBlock(main, 'function collectAssistantDiagnostics');
      expect(diag).toContain('text: assistantTextEngineLabel(env)');
    });

    test('그 표가 실제로 옛 id 를 지금 이름으로 바꿔 준다', () => {
      const { findTier } = require('../src/core/llm/pricing');
      expect(findTier('openai-gpt41')?.title).toBe('GPT-5.6 Terra');
      expect(findTier('gemini-2.5-flash')?.title).toBe('Gemini 3.8 Flash');
    });

    test('진단은 마스킹을 거친다 — 키 값이 프롬프트에 실리면 그 순간 유출이다', () => {
      const fn = braceBlock(main, 'function collectAssistantDiagnostics');
      expect(fn).toContain('redactDeep(');
      expect(fn).toContain('redactLogLines(');
      // 키는 유무만 — 값을 담는 코드가 있으면 안 된다
      expect(fn).toContain('openai: filled(');
      expect(fn).not.toMatch(/openai:\s*(String\(|env\[)/);
    });

    test('매뉴얼이 동봉되고, 소스가 아니라 사용법이 적혀 있다', () => {
      const manual = read('electron/assets/assistant-knowledge.md');
      expect(manual.length).toBeGreaterThan(1200);
      expect(manual.length).toBeLessThan(15000);           // 프롬프트 예산을 지킨다
      expect(manual).toContain('자주 나는 문제와 답');
      expect(manual).toContain('비서가 하지 말아야 할 것');
      expect(main).toContain("path.join(__dirname, 'assets', 'assistant-knowledge.md')");
      // 실행파일은 누구나 연다 — 계정·경로가 매뉴얼에 박히면 안 된다
      expect(manual).not.toMatch(/@gmail\.com|[A-Z]:\\Users/);
    });

    test('1단계는 읽기 전용 — 비서가 명령을 실행하지 않는다', () => {
      // braceBlock 은 인자 타입 주석의 중괄호를 먼저 잡는다 — 다음 절까지로 자른다
      const handler = blockBetween(main, "ipcMain.handle('assistant:ask'", '📝 v3.8.711 — 사이트(LEWORD)');
      expect(handler).not.toContain('exec(');
      expect(handler).not.toContain('spawn(');
    });
  });
});
