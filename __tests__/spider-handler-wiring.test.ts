/**
 * 거미줄 종합글 핸들러 배선 잠금 (묶음 A + B)
 *
 * generate-internal-consistency 핸들러는 19,000줄짜리 main.ts 안에 있어 직접 부를 수 없다.
 * 그래서 판단 로직은 src/core/spider 로 빼고, 여기서는 "핸들러가 그 판단을 실제로 따르는지"를
 * 소스 블록 단언으로 잠근다. 길이로 자르지 않고 경계로 자른다(helpers/source-block).
 *
 * 이 파일이 지키는 사고: 발행된 종합글 = AI 글이 아니라 기계식 대체 틀(buildSpiderWebFallbackHtml).
 */
import fs from 'fs';
import path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const MAIN = fs.readFileSync(path.join(process.cwd(), 'electron/main.ts'), 'utf8');
const UI = fs.readFileSync(path.join(process.cwd(), 'electron/ui/modules/internal-links.js'), 'utf8');

const HANDLER = blockBetween(
  MAIN,
  "ipcMain.handle('generate-internal-consistency', async",
  "ipcMain.handle('save-image-as-png'",
);

describe('A. 조용한 대체 발행 중지', () => {
  it('대체 틀 함수가 main.ts 어디에도 남아 있지 않다 (어디서도 안 쓰이면 지운다)', () => {
    expect(MAIN).not.toMatch(/buildSpiderWebFallbackHtml/);
    expect(MAIN).not.toMatch(/class="sw-cornerstone"\s+style="max-width:760px/);
  });

  it('핸들러의 성공 응답은 맨 끝 한 곳뿐이다 — catch 안에서 success:true 를 만들지 않는다', () => {
    expect((HANDLER.match(/success:\s*true/g) || []).length).toBe(1);
  });

  it('안쪽·바깥 catch 는 둘 다 실패 응답 빌더로 끝난다', () => {
    const marker = "console.error('[INTERNAL-CONSISTENCY] AI 종합글 생성 실패:'";
    const spots: number[] = [];
    for (let at = HANDLER.indexOf(marker); at >= 0; at = HANDLER.indexOf(marker, at + 1)) spots.push(at);
    expect(spots.length).toBe(2); // 안쪽 catch(글 생성) + 바깥 catch(그 밖의 단계)
    for (const at of spots) {
      // from the log line to the closing brace of that catch block
      const near = blockBetween(HANDLER.slice(at), marker, /\n\s*\}/);
      expect(near).toMatch(/buildSpiderFailure\(/);
      expect(near).not.toMatch(/success:\s*true/);
    }
  });

  it("'종합 가이드' 같은 일반어가 핸들러의 제목이 되지 않는다", () => {
    expect(HANDLER).not.toMatch(/['"`]종합 가이드['"`]/);
    expect(HANDLER).not.toMatch(/payload\.title\s*\|\|/);
  });

  it('제목은 사용자 제목 → AI H1 순서로만 정해지고, 없으면 멈춘다', () => {
    expect(HANDLER).toMatch(/resolveSpiderTitle\(\{[^}]*userTitle:\s*payload\.title[^}]*aiTitles:\s*\[extractedTitleFromH1,\s*agentMetaTitle\]/);
    expect(HANDLER).toMatch(/stage:\s*'title'/);
  });

  it('이미지 단계 앞에서 제목이 확정되고, 본문이 비면 이미지 단계에 들어가지 않는다', () => {
    const titleAt = HANDLER.indexOf('resolveSpiderTitle(');
    const bodyAt = HANDLER.indexOf('checkSpiderBody(');
    const imageAt = HANDLER.indexOf("const imagePolicy = (payload.imagePolicy");
    expect(bodyAt).toBeGreaterThan(-1);
    expect(titleAt).toBeGreaterThan(-1);
    expect(imageAt).toBeGreaterThan(titleAt);
    expect(imageAt).toBeGreaterThan(bodyAt);
  });

  it('실패한 단계를 추적해 catch 가 단계 이름을 넘긴다', () => {
    expect(HANDLER).toMatch(/spiderStage\s*=\s*'generate'/);
    expect(HANDLER).toMatch(/spiderStage\s*=\s*'image'/);
    expect(HANDLER).toMatch(/spiderStage\s*=\s*'meta'/);
    expect(HANDLER).toMatch(/stage:\s*spiderStage/);
  });
});

describe('B. 선택 엔진 존중', () => {
  it('엔진 결정이 Gemini 키 관문보다 앞에 있고, 관문은 API 모드에서만 돈다', () => {
    const decideAt = HANDLER.indexOf('decideSpiderEngine(');
    const gateAt = HANDLER.indexOf('Gemini API 키가 필요합니다');
    expect(decideAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(decideAt);
    expect(HANDLER).toMatch(/spiderEngine\.usesGemini\s*&&\s*\(!geminiKey/);
    expect(HANDLER).toMatch(/spiderEngine\.usesGemini\s*&&\s*geminiKey\.length\s*<\s*20/);
  });

  it('selectGeminiModel 은 핸들러에서 직접 부르지 않고, API 모드 분기 안에서만 준비한다', () => {
    expect(HANDLER).not.toMatch(/selectGeminiModel\(/);
    const guarded = HANDLER.match(/if\s*\(spiderEngine\.usesGemini\)\s*\{[^}]*prepareSpiderGeminiModel\(/);
    expect(guarded).not.toBeNull();
    const ready = braceBlock(MAIN, 'async function prepareSpiderGeminiModel');
    expect(ready).toMatch(/selectGeminiModel\(/);
  });

  it('Agent 모드는 Gemini 로 폴백하지 않는다 (프로필 없음 · 권한 없음 · 응답 부족 · 예외 전부)', () => {
    expect(HANDLER).not.toMatch(/Gemini API로 폴백/);
    const agentJob = blockBetween(MAIN, 'async function runSpiderAgentJob', '통합 모듈 경로 해석기');
    expect(agentJob).not.toMatch(/Gemini/);
    expect(agentJob).toMatch(/judgeSpiderAgentRun\(/);
    expect(agentJob).toMatch(/ok:\s*false/);
  });

  it('Agent 모드는 글이 짧아도 Agent 를 다시 돌리지 않는다 (길이는 기준이 아니다)', () => {
    const callLLM = braceBlock(HANDLER, 'const callLLM = async');
    expect(callLLM).not.toMatch(/runAgentGeneration/);
    expect(HANDLER).toMatch(/runSpiderDraftLoop\(\{\s*mode:\s*spiderEngine\.mode/);
  });

  it('Agent 모드에서 이어쓰기·태그·메타가 몰래 Gemini 를 부르지 않는다', () => {
    // 이어쓰기: Agent 모드에서는 model.generateContent 이어쓰기 블록에 들어가지 않는다
    expect(HANDLER).toMatch(/!isSpiderAgentMode\s*&&\s*looksTruncated\(generatedContent\)/);
    // 태그(라벨): Gemini 호출은 usesGemini 분기 안
    expect(HANDLER).toMatch(/if\s*\(spiderEngine\.usesGemini\)\s*\{[\s\S]{0,400}generateSpiderGeminiLabels\(/);
    // 메타: 별도 Gemini 클라이언트·키를 만들지 않는다 (geminiKey 는 API 모드에서만 쓰인다)
    expect(HANDLER).not.toMatch(/GGA_META|new GoogleGenerativeAI\(geminiKey\)/);
    expect(HANDLER).toMatch(/spiderEngine\.usesGemini[\s\S]{0,200}generateSpiderGeminiMeta\(/);
    // model.generateContent 는 API 전용 callLLM 과 API 전용 이어쓰기 블록 안에서만 나온다
    const count = (text: string) => (text.match(/model\.generateContent/g) || []).length;
    const apiOnly = count(braceBlock(HANDLER, 'const callLLM = async'))
      + count(braceBlock(HANDLER, 'if (!isSpiderAgentMode && looksTruncated(generatedContent)'));
    expect(count(HANDLER)).toBe(apiOnly);
    expect(apiOnly).toBeGreaterThanOrEqual(2);
  });

  it('로그에 Gemini 키 조각(앞 8자·끝 4자)을 남기지 않는다', () => {
    expect(MAIN).not.toMatch(/trimmedKey\.substring\(0,\s*8\)/);
  });
});

describe('화면(internal-links.js) — 멈춤과 제목', () => {
  it("일반어 '거미줄치기 통합글' 이 제목 기본값(|| 대체값)으로 쓰이지 않는다", () => {
    expect(UI).not.toMatch(/\|\|\s*'거미줄치기 통합글'/);
  });

  it('실패 응답의 문구와 단계를 그대로 보여 주고 멈춘다', () => {
    const failBlock = UI.slice(UI.indexOf('if (!genResult || !genResult.success)'));
    const head = failBlock.slice(0, failBlock.indexOf('return;') + 7);
    expect(head).toMatch(/_swFinishError\(genResult\?\.error/);
    expect(head).toMatch(/genResult\.stage/);
  });

  it('성공 응답이어도 본문·제목·이미지 정보가 없으면 경고만 하고 가지 않고 멈춘다', () => {
    // from the check to the closing brace of its `if (!genCheck.ok) { … }` block
    const after = blockBetween(UI, '= _swValidateGenResult(genResult', /\n\s*\}/);
    expect(after).toMatch(/_swFinishError\(/);
    expect(after).toMatch(/return;/);
    expect(UI).not.toMatch(/imageStats를 반환하지 않음 — 이미지 생성 코드 미통합\?'?,\s*'warn'/);
  });
});

describe('후속 — 중지·시간 초과 · 끝 잘림 · 제한 시간 표시 · 설정 읽기 배선', () => {
  it('Agent 결과는 run 의 중지·시간 초과 상태와 함께 판정하고, 제한 시간은 코드의 값을 표시한다', () => {
    const agentJob = blockBetween(MAIN, 'async function runSpiderAgentJob', '통합 모듈 경로 해석기');
    expect(agentJob).toMatch(/judgeSpiderAgentRun\(\s*\{[^}]*canceled:[^}]*timedOut:/);
    expect(agentJob).toMatch(/AGENT_JOB_TIMEOUT_MS/);
    expect(MAIN).not.toMatch(/최대 12분 대기/);
    // the displayed limit and the real kill timer come from the same constant
    expect(MAIN).toMatch(/const TIMEOUT_MS = AGENT_JOB_TIMEOUT_MS;/);
    expect(MAIN).not.toMatch(/const TIMEOUT_MS = 25 \* 60 \* 1000;/);
  });

  it('Agent 모드에서 끝이 구조적으로 잘린 글은 실패, 오탐 쉬운 신호는 경고로만 쓴다', () => {
    const block = blockBetween(HANDLER, 'const completeness = spider.judgeSpiderCompleteness', 'if (!isSpiderAgentMode && looksTruncated');
    expect(block).toMatch(/judgeSpiderCompleteness\(/);
    expect(block).toMatch(/completeness\.hard\.length/);
    expect(block).toMatch(/buildSpiderFailure\(/);
    expect(block).toMatch(/spiderWarnings\.push\(/);
  });

  it('성공 응답에 경고 목록(warnings)이 실려 화면이 완료 문구에 보여 줄 수 있다', () => {
    expect(HANDLER).toMatch(/success:\s*true,[\s\S]{0,400}warnings:\s*spiderWarnings/);
    expect(UI).toMatch(/_swCompletionDetail\('모든 작업이 끝났습니다 ✨',\s*_swPendingWarnings\)/);
  });

  it('실행 방식 설정을 못 읽으면 조용히 API 로 가지 않고 멈춘다', () => {
    expect(UI).not.toMatch(/JSON\.parse\(localStorage\.getItem\('leadernamExecutionMode'\)/);
    // from the read to the first statement after its try/catch
    const near = blockBetween(UI, '_swReadEngineSettings();', 'payload.executionMode = engineSettings.executionMode');
    expect(near).toMatch(/_swFinishError\(/);
    expect(near).not.toMatch(/catch\s*\{\s*\}/);
  });
});
