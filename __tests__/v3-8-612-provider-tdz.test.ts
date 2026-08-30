/**
 * v3.8.612 — "Cannot access 'provider' before initialization"
 *
 * 사장님: "실행 준비 확인 실패: Cannot access 'provider' before initialization
 *          클로드 코드는 왜자꾸 이지랄인데"
 *
 * ## 내가 낸 버그다
 * v3.8.608 에서 제공자 삼항 30여 곳을 **정규식으로 일괄 치환**했다:
 *   `X === 'claude' ? 'claude' : 'codex'` → `normalizeAgentProviderId(X)`
 * 그런데 한 줄이 이랬다:
 *   const provider = profile?.provider === 'claude' ? 'claude' : 'codex';
 * 정규식이 `profile?.` 뒤의 `provider` 만 집어서 이렇게 만들었다:
 *   const provider = profile?.normalizeAgentProviderId(provider);   ← 자기 자신을 참조
 * 선언 중인 변수를 오른쪽에서 읽으니 TDZ 에러가 났고, 에이전트 실행 준비가 통째로 막혔다.
 *
 * ## 교훈
 * 일괄 치환은 **멤버 접근(`a?.b`)을 구분하지 못한다.** 문법 검사(node --check)로도
 * 안 잡힌다 — 문법은 멀쩡하고 실행할 때만 터지기 때문이다.
 * 그래서 이 검사를 남긴다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const FILES = [
  'electron/ui/modules/codex-workshop.js',
  'electron/ui/modules/header-badges.js',
  'electron/ui/script.js',
];

/** `const X = … X …` 처럼 선언 중인 이름을 오른쪽에서 쓰는 줄을 찾는다 */
function findSelfReferences(source: string): string[] {
  const bad: string[] = [];
  source.split('\n').forEach((line, i) => {
    const m = /^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/.exec(line);
    if (!m) return;
    const [, name, rhsRaw] = m;
    if (!name || !rhsRaw) return;
    /**
     * 문자열·정규식 리터럴은 뺀다 — 그 안의 낱말이 오탐을 만든다.
     *   createElement('style')            → 'style' 이 변수명과 같아 걸린다
     *   .match(/data-ad-slot="…"/)        → 'slot' 이 걸린다
     * (실제로 두 경우 다 겪었다)
     */
    const rhs = rhsRaw
      .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""')
      .replace(/\/(?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+\/[gimsuyd]*/g, 'RE');
    // 멤버 접근(.name)은 자기 참조가 아니다
    if (new RegExp(`(^|[^\\w$.])${name}([^\\w$]|$)`).test(rhs)) {
      bad.push(`${i + 1}: ${line.trim().slice(0, 110)}`);
    }
  });
  return bad;
}

describe.each(FILES)('%s — 선언 중인 변수를 자기가 읽지 않는다', (file) => {
  test('자기참조 선언이 없다 (TDZ 런타임 오류의 원인)', () => {
    const found = findSelfReferences(fs.readFileSync(path.join(root, file), 'utf-8'));
    expect(found).toEqual([]);
  });
});

describe('검사기 자체를 검증한다', () => {
  test('사고를 낸 그 줄을 실제로 잡는다', () => {
    const broken = "  const provider = profile?.normalizeAgentProviderId(provider);";
    expect(findSelfReferences(broken)).toHaveLength(1);
  });

  test('고친 형태는 통과한다', () => {
    const fixed = "  const provider = normalizeAgentProviderId(profile?.provider);";
    expect(findSelfReferences(fixed)).toEqual([]);
  });

  test('문자열 안의 같은 낱말은 오탐이 아니다', () => {
    const ok = "  const style = document.createElement('style');";
    expect(findSelfReferences(ok)).toEqual([]);
  });

  test('멤버 접근은 자기 참조가 아니다', () => {
    const ok = "  const provider = payload.provider;";
    expect(findSelfReferences(ok)).toEqual([]);
  });

  test('정규식 리터럴 안의 같은 낱말도 오탐이 아니다', () => {
    const ok = String.raw`  const slot = (String(u.code).match(/data-ad-slot="([^"]+)"/) || [])[1] || '';`;
    expect(findSelfReferences(ok)).toEqual([]);
  });
});

/**
 * v3.8.612 — 환경설정에도 Gemini 가 보여야 한다
 *
 * 사장님: "제미나이 cli가 배찌에는 연동되고 추가한것같은데 환경설정에는왜없니"
 *
 * v3.8.608 에서 배지·엔진 선택기에는 넣었는데 **설정 화면 쪽 표들을 안 고쳤다.**
 * 그 표가 없으면 계정을 추가할 화면 자체가 안 그려져서, 골라도 로그인을 할 수 없다.
 */
describe('환경설정 Agent 계정에 Gemini 가 있다', () => {
  const workshop = fs.readFileSync(path.join(root, 'electron/ui/modules/codex-workshop.js'), 'utf-8');
  const main = fs.readFileSync(path.join(root, 'electron/main.ts'), 'utf-8');

  test('제공자 정보 표에 gemini 항목이 있다', () => {
    expect(workshop).toMatch(/gemini:\s*\{[\s\S]{0,200}label: 'Gemini CLI'/);
    expect(workshop).toContain('Gemini 계정 준비');
  });

  test('제공자 탭을 손으로 두 개 적어두지 않는다', () => {
    expect(workshop).not.toContain("id=\"agentProviderTabCodex\"");
    expect(workshop).toContain('data-agent-provider-tab');
  });

  test('탭 배선도 표를 돈다', () => {
    expect(workshop).toContain("querySelectorAll('[data-agent-provider-tab]')");
  });

  test('활성 탭 표시가 옛 id 를 찾지 않는다', () => {
    expect(workshop).not.toContain("$('agentProviderTabClaude')");
  });

  test('설치 감지 카드가 표를 돈다', () => {
    expect(workshop).not.toContain('const claudeTool = renderToolStatus');
    expect(workshop).toContain('AGENT_PROVIDER_IDS.map');
  });

  test('main 이 세 제공자를 모두 감지한다 — 안 하면 항상 "미설치" 로 보인다', () => {
    expect(main).not.toContain("detectAgentBinary('claude'),");
    expect(main).toContain('providerIds.map((id) => detectAgentBinary(AGENT_PROVIDERS[id].binary))');
  });

  test('안 깔린 제공자를 고르면 깔린 쪽으로 옮긴다', () => {
    expect(workshop).toContain('const fallback = AGENT_PROVIDER_IDS.find');
  });
});
