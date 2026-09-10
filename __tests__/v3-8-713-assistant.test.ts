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

    test('근거 밖 답변 금지가 규칙 1번이다 — 지어내면 사용자가 엉뚱한 곳을 고친다', () => {
      expect(prompt).toContain('아는 것만 말합니다');
      expect(prompt).toContain('확인할 수 없습니다');
    });

    test('개발자용 답을 막는다 — 사용자는 코드를 모른다', () => {
      expect(prompt).toContain('코드·파일 경로·함수 이름을 답에 쓰지 마세요');
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
  });

  describe('배선 — 없는 채널·없는 버튼은 조용히 죽는다', () => {
    const main = read('electron/main.ts');
    const ui = read('electron/ui/modules/assistant.js');
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

    test('엔진은 에이전트 우선 — 구독 할당량이라 추가 비용이 0이다', () => {
      // braceBlock 은 인자 타입 주석의 중괄호를 먼저 잡는다 — 다음 절까지로 자른다
      const handler = blockBetween(main, "ipcMain.handle('assistant:ask'", '📝 v3.8.711 — 사이트(LEWORD)');
      expect(handler).toContain("['claude', 'codex', 'gemini']");
      expect(handler).toContain('runAgentTextTask(');
      // 에이전트가 없을 때만 API 로 떨어진다
      expect(handler.indexOf('runAgentTextTask(')).toBeLessThan(handler.indexOf('callGeminiWithRetry'));
      expect(handler).toContain('needsEngine: true');
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
