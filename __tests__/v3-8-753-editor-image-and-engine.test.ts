/**
 * v3.8.753 — 사장님 신고 3건
 *
 *  ① "편집기에 소제목 이미지 생성버튼 여전히 누락되어있고"
 *     → generateEditorImage('section') 과 IPC(generate-editor-image kind:'section')는 살아 있는데
 *       v3.8.729 에서 **부르는 버튼만** 뺐다. 되살리고, id 실존·배선을 여기서 못박는다.
 *
 *  ② "비평 개선도 제대로된 기능을 못하는것같아"
 *     → 근거 앞 30자를 한 덩어리로만 찾아, AI 가 한 글자만 바꿔 적어도 문단을 못 찾고 건너뛰었다.
 *       모델은 안 불리고 본문은 그대로고 해결로 기록되지 않아 다음 비평에 또 나왔다(세 증상 한 뿌리).
 *
 *  ③ "소넷5로 선택했는데 오픈api로 발행이되네요"
 *     → 실행 모드(executionMode·agentProvider)를 payload 에 싣는 코드가 없어 에이전트 경로가 죽어 있었고,
 *       화면에 숨은 옛 select(#generationEngine, 첫 옵션 openai)가 편집기·대량 포스팅의 엔진을 정했다.
 *
 * 이 저장소의 단골 사고는 "조용한 미배선" 이다 — 그래서 ①③은 **id 실존 + 읽는 쪽 일치**로 잰다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { improveDraft } from '../src/core/final/editor-draft';
import { loosenedProbes } from '../src/core/final/critique-targeted-edit';
import { rewriteAbility, type CritiqueIssue } from '../src/core/final/post-critique';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const editorJs = read('electron/ui/modules/editor.js');
const postingJs = read('electron/ui/modules/posting.js');
const headerBadgesJs = read('electron/ui/modules/header-badges.js');
const scriptJs = read('electron/ui/script.js');
const indexHtml = read('electron/ui/index.html');
const mainTs = read('electron/main.ts');

/* ────────────────────────────────────────────────────────────────
 * ① 편집기 소제목 이미지 버튼 — 만들어 놓고 안 부르던 기능
 * ──────────────────────────────────────────────────────────────── */
describe('① 소제목 이미지 생성 버튼 (AI)', () => {
  it('도구막대에 버튼이 있다', () => {
    expect(editorJs).toContain('id="veSectionImgBtn"');
    expect(editorJs).toContain('🖼️ 소제목 이미지');
  });

  it('modalRefs 가 그 id 를 잡는다 — 없는 id 를 잡으면 배선이 조용히 죽는다', () => {
    expect(editorJs).toContain("sectionImgBtn: overlay.querySelector('#veSectionImgBtn')");
  });

  it('누르면 generateEditorImage(\'section\') 을 부른다', () => {
    expect(editorJs).toMatch(/modalRefs\.sectionImgBtn\?\.addEventListener\('click', \(\) => generateEditorImage\('section'\)\)/);
  });

  it('생성 중에는 다른 생성 버튼과 함께 잠긴다 (이중 호출 = 이중 과금)', () => {
    const line = editorJs.split('\n').find((l) => l.includes('draftButtons = () => [modalRefs.')) || '';
    expect(line).toContain('modalRefs.sectionImgBtn');
  });

  it("백엔드가 kind:'section' 을 그대로 받는다 — 프런트만 고치면 조용히 실패한다", () => {
    expect(editorJs).toContain("invoke('generate-editor-image', { title, sectionTitle, kind, payload })");
    expect(mainTs).toContain("kind?: 'thumbnail' | 'section'");
  });

  it('"이미지가 0장" 지적의 안내가 이 버튼을 가리킨다 — 예전 안내의 두 버튼은 내 PC 파일만 넣는다', () => {
    const ability = rewriteAbility({ id: 'structure-noimage', title: '이미지가 한 장도 없습니다' });
    expect(ability.fixable).toBe(false);
    expect(ability.hint).toContain('🖼️ 소제목 이미지');
  });
});

/* ────────────────────────────────────────────────────────────────
 * ② 비평 개선 — 근거를 바꿔 적어도 고칠 문단을 찾는다
 * ──────────────────────────────────────────────────────────────── */
const TITLE = '실손보험 입원 거절 이의신청 방법';
const S1 = '입원이 필요했다는 판단은 주치의 소견서가 가장 강한 근거가 됩니다.';

const ARTICLE = [
  '<p>실손보험 입원 치료비를 청구했다가 통원 기준으로 깎였다면 먼저 거절 통지서의 사유 문구를 읽어야 합니다. 통지서에는 적용한 약관 조항과 심사 판단이 적혀 있습니다.</p>',
  '<h2>1. 거절 사유 확인</h2>',
  `<p>${S1} 소견서에는 입원 기간과 치료 내용이 함께 적혀야 합니다.</p>`,
  '<h2>2. 이의신청 순서</h2>',
  '<p>이의신청은 보험사 고객센터에 서면으로 먼저 냅니다. 답이 없거나 같은 결론이면 금융감독원 민원으로 넘어갑니다.</p>',
].join('\n');

/** 편집 프롬프트에서 [B1] 문단들을 꺼낸다 (v3.8.750 테스트와 같은 방식) */
function blocksIn(prompt: string): Array<{ id: string; inner: string }> {
  return [...prompt.matchAll(/^\[(B\d+)\]\n([\s\S]*?)\n {2}(?:지적 1|\()/gm)].map((m) => ({ id: m[1]!, inner: m[2]! }));
}

const aiIssue = (over: Partial<CritiqueIssue>): CritiqueIssue => ({
  id: 'ai-0', area: 'substance', severity: 'high', title: '근거 없이 단정합니다',
  detail: '', evidence: '', fix: '', sectionIndex: -1, origin: 'ai', blocking: true,
  aiType: 'unsupported-claim', ...over,
} as CritiqueIssue);

/** 프롬프트를 모아 두고, 문단은 지적된 문장만 지워 돌려주는 가짜 편집기 */
function fakeEditor() {
  const prompts: string[] = [];
  const callModel = async (prompt: string): Promise<string> => {
    prompts.push(prompt);
    return JSON.stringify({
      blocks: blocksIn(prompt).map((b) => ({ id: b.id, html: b.inner.replace(`${S1} `, '') })),
    });
  };
  return { prompts, callModel };
}

describe('② 근거를 바꿔 적은 AI 지적도 그 문단을 찾아 고친다 (loosenedProbes)', () => {
  it('찾는 말을 20자·12자로 줄여 가며 다시 찾는다 — 30자보다 짧으면 사다리가 그만큼만 생긴다', () => {
    expect(loosenedProbes('가'.repeat(30))).toEqual(['가'.repeat(20), '가'.repeat(12)]);
    expect(loosenedProbes('가'.repeat(15))).toEqual(['가'.repeat(12)]);
    expect(loosenedProbes('가'.repeat(12))).toEqual([]);   // 더 줄일 것이 없다
  });

  it('⭐ 글자 그대로 옮기지 않은 근거로도 모델이 그 문단을 받는다 (예전에는 통째로 건너뛰었다)', async () => {
    const { prompts, callModel } = fakeEditor();
    const issue = aiIssue({ evidence: '입원이 필요했다는 판단은 주치의 소견서로만 증명됩니다' });
    const r: any = await improveDraft({
      title: TITLE, html: ARTICLE, issues: [issue], mode: 'critiqueTargeted', verify: false, callModel,
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain(S1);            // 고칠 문단이 실제로 모델에 갔다
    expect(r.revised).toBe(1);
    expect(r.html).not.toContain(S1);            // 그 문장만 사라졌다
    expect(r.html).toContain('소견서에는 입원 기간과 치료 내용이 함께 적혀야 합니다.');   // 같은 문단의 다른 문장은 그대로
    expect(r.html).toContain('금융감독원 민원으로 넘어갑니다.');                        // 다른 문단은 손대지 않았다
  });

  it('근거가 글자 그대로 있으면 예전처럼 한 번에 찾는다 (회귀 방지)', async () => {
    const { prompts, callModel } = fakeEditor();
    const r: any = await improveDraft({
      title: TITLE, html: ARTICLE, issues: [aiIssue({ evidence: S1 })],
      mode: 'critiqueTargeted', verify: false, callModel,
    });
    expect(prompts).toHaveLength(1);
    expect(r.revised).toBe(1);
  });
});

describe('② 느슨하게 찾은 것은 모호하면 받지 않는다 — 엉뚱한 문단을 고치는 쪽이 훨씬 나쁘다', () => {
  const TWIN_A = '<p>준비할 서류는 진단서와 입원 확인서 두 가지입니다. 원무과에서 한 번에 받습니다.</p>';
  const TWIN_B = '<p>준비할 서류는 진단서와 입원 확인서 외에 세부 내역서도 필요합니다. 비용은 병원마다 다릅니다.</p>';
  const TWIN = [TWIN_A, '<h2>1. 서류 준비</h2>', TWIN_B].join('\n');
  // 앞 12자가 두 문단에 똑같이 들어 있는 근거 (글자 그대로는 어느 문단에도 없다)
  const EVIDENCE = '준비할 서류는 진단서와 입원 확인서만 있으면 됩니다';

  it('⭐ 두 문단에 걸리고 지적이 구간도 가리키지 않으면 손대지 않는다', async () => {
    const { prompts, callModel } = fakeEditor();
    const r: any = await improveDraft({
      title: TITLE, html: TWIN, issues: [aiIssue({ evidence: EVIDENCE, sectionIndex: -1 })],
      mode: 'critiqueTargeted', verify: false, callModel,
    });
    expect(prompts).toHaveLength(0);          // 모델을 부르지 않았다 = 비용 0
    expect(r.html).toBe(TWIN);
    expect(r.revised).toBe(0);
    expect(r.skipped.some((s: string) => s.includes('고칠 문단을 본문에서 특정하지 못해'))).toBe(true);
  });

  it('⭐ 지적이 구간을 가리키면 그 구간의 문단만 고친다', async () => {
    const { prompts, callModel } = fakeEditor();
    const r: any = await improveDraft({
      title: TITLE, html: TWIN, issues: [aiIssue({ evidence: EVIDENCE, sectionIndex: 1 })],
      mode: 'critiqueTargeted', verify: false, callModel,
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('세부 내역서도 필요합니다');      // 2번째(구간 1) 문단
    expect(prompts[0]).not.toContain('원무과에서 한 번에 받습니다');  // 도입부 쌍둥이 문단은 안 보냈다
  });
});

/* ────────────────────────────────────────────────────────────────
 * ② AI 비평이 실패하면 반쪽 리포트라고 말한다 (조용히 코드 진단만 내지 않는다)
 * ──────────────────────────────────────────────────────────────── */
describe('② AI 비평 실패를 숨기지 않는다', () => {
  const critiqueModalJs = read('electron/ui/modules/post-critique-modal.js');

  it('critiqueDraft 가 실패 이유를 aiFailed 로 돌려준다 — 예전에는 로그 한 줄만 남았다', async () => {
    const r: any = await critiqueDraftWithFailingModel();
    expect(r.aiFailed).toContain('키가 죽었습니다');
    // 부르기로 결정은 했으니 aiSkipped 는 false 다 — 그래서 이 필드가 따로 있어야 한다
    expect(r.aiSkipped).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);   // 코드 진단은 그대로 낸다 (리포트가 비지 않는다)
  });

  it('비평 창이 그 사실을 맨 위에 띄운다', () => {
    expect(critiqueModalJs).toContain('function aiFailedBanner(critique)');
    expect(critiqueModalJs).toContain('AI 비평이 실패해 <u>코드 진단만</u> 담긴 반쪽 리포트입니다');
    expect(critiqueModalJs).toContain('${aiFailedBanner(critique)}');
  });

  it('지적이 0건이어도 "모두 통과" 라고 말하지 않는다', () => {
    expect(critiqueModalJs).toContain('AI 비평은 실패했습니다');
  });
});

/** 코드 진단은 나오고 AI 호출만 실패하는 상황 (누출 문장이 있어 AI 를 반드시 부른다) */
async function critiqueDraftWithFailingModel() {
  const { critiqueDraft } = await import('../src/core/final/editor-draft');
  const LEAK = '제공된 근거에는 세부 심사 기준이 제시돼 있지 않으므로 이 부분은 따로 확인이 필요합니다.';
  const html = [
    '<p>실손보험 입원 치료비를 청구했다가 통원 기준으로 깎였다면 거절 통지서의 사유 문구를 먼저 읽어야 합니다.</p>',
    '<h2>1. 거절 사유 확인</h2>',
    `<p>${S1} ${LEAK}</p>`,
  ].join('\n');
  return critiqueDraft({
    title: TITLE, html,
    callModel: async () => { throw new Error('HTTP 401 | 키가 죽었습니다'); },
  });
}

/* ────────────────────────────────────────────────────────────────
 * ③ 고른 모델대로 — 실행 모드 배선 + 유령 기본값 제거
 * ──────────────────────────────────────────────────────────────── */
describe('③ 실행 모드(API/에이전트)를 payload 가 싣는다', () => {
  it('createPayload 가 executionMode·agentProvider 를 넣는다', () => {
    expect(postingJs).toContain('executionMode: agentExecution.mode');
    expect(postingJs).toContain('agentProvider: agentExecution.mode === \'agent\' ? agentExecution.provider : \'\'');
  });

  it('정본은 codex-workshop 의 getAgentExecutionState — 못 쓰면 localStorage 폴백', () => {
    expect(postingJs).toContain("typeof window.getAgentExecutionState === 'function'");
    expect(postingJs).toContain("localStorage.getItem('leadernamExecutionMode')");
    // 값이 JSON 문자열("agent")로 저장돼 있어 따옴표를 벗기지 않으면 판정이 늘 빗나간다 (v3.8.733 함정)
    expect(postingJs).toContain('replace(/^"|"$/g');
  });

  it('비평·개선이 읽는 이름과 똑같다 — 이름이 어긋나면 에이전트 경로가 통째로 죽는다', () => {
    expect(mainTs).toContain("payload?.executionMode === 'agent' && !!payload?.agentProvider");
    expect(mainTs).toContain("args?.payload?.executionMode === 'agent' && !!args?.payload?.agentProvider");
  });
});

describe('③ 유령 기본값(#generationEngine = openai) 제거', () => {
  it('generationEngine 동기화가 에이전트 모드에서도 돈다 — 라디오에서 파생시킨다', () => {
    expect(indexHtml).toContain("const checkedTier = document.querySelector('input[name=\"primaryGeminiTextModel\"]:checked');");
    expect(indexHtml).toContain('if (genSelect && checkedTier) genSelect.value = deriveProvider(checkedTier.value);');
    // 예전의 조건부 동기화(카드 루프 안 `!agentMode` 갈래)는 남아 있으면 안 된다 — 두 곳이면 또 갈라진다
    expect(indexHtml).not.toContain('genSelect.value = deriveProvider(input.value)');
  });

  it('배지에서 모델을 골라도 카드·select 가 따라온다', () => {
    expect(headerBadgesJs).toContain('window.refreshTierCards?.()');
  });

  it('편집기 엔진 칸은 티어 라디오(정본)에서 목록을 만든다 — 회사 단위 옛 select 가 아니다', () => {
    expect(editorJs).toContain('function fillTextEngineFromTiers(target)');
    expect(editorJs).toContain("fillTextEngineFromTiers(refs?.textEngine)");
    expect(editorJs).not.toContain("cloneEngineOptions(refs?.textEngine, 'generationEngine')");
  });

  it('편집기 payload 는 회사는 파생시키고 고른 모델을 따로 보낸다 (모델 값을 provider 에 넣으면 설정값으로 떨어진다)', () => {
    expect(editorJs).toContain('primaryGeminiTextModel: textEngine');
    expect(editorJs).toContain('provider: engineProvider');
  });

  it('대량 포스팅도 라디오를 보고, 고른 모델을 싣는다', () => {
    expect(scriptJs).toContain("const bulkTierModel = document.querySelector('input[name=\"primaryGeminiTextModel\"]:checked')?.value || '';");
    expect(scriptJs).toContain('provider: bulkProvider');
    expect(scriptJs).toContain('primaryGeminiTextModel: currentSettings.primaryGeminiTextModel');
  });
});
