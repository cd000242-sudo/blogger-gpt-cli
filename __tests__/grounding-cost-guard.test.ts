/**
 * Gemini Search Grounding 비용 가드 (v3.8.418)
 *
 * ## 왜 만드나
 * 사용자 보고: "Gemini Search Grounding 유료 호출은 선택형이니까 자동으로 하는구간은
 *   전부다 끊어줘 비용이비싸기때문에 과금의 원인이되버려 글 5개만 써도
 *   10000원가까이나와서 자동으로 절대안돼"
 *
 * Grounding은 편당 ₩500~1,500이 붙는 유료 호출이다. 자동 생성 파이프라인 안에
 * 사용자가 모르는 새 이 호출이 섞여 들어가면 "글 5개 = 만원 가까이" 같은 일이
 * 조용히 재발한다. 이 스위트는 그 재발을 막는 3개 지점을 소스 레벨로 고정한다:
 *
 *   1) generation.ts  — CTA 링크 발견(모든 모드에서 매 글 자동 실행)은 이제 일반 호출
 *   2) orchestration.ts — "CTA 최소 2개 보장" 보충 검색은 아예 꺼졌다(Grounding 호출 삭제)
 *   3) perplexityFactCheck.ts — auto 팩트체크 체인은 grounding으로 자동 전환되지 않는다
 *
 * 남겨둔 유일한 진짜 호출(generation.ts 본문 생성, 1484행 부근)은 orchestration.ts의
 * DISABLE_GEMINI_GROUNDING 게이트로 보호된다 — payload.factCheckMode==='grounding'을
 * 사용자가 드롭다운에서 직접 골랐을 때만 켜진다. 그 게이트 자체도 여기서 검증한다.
 */
import fs from 'fs';
import path from 'path';
import { blockBetween } from './helpers/source-block';

const generationSrc = fs.readFileSync(
  path.join(process.cwd(), 'src', 'core', 'final', 'generation.ts'),
  'utf8',
);
const orchestrationSrc = fs.readFileSync(
  path.join(process.cwd(), 'src', 'core', 'final', 'orchestration.ts'),
  'utf8',
);
const factCheckSrc = fs.readFileSync(
  path.join(process.cwd(), 'src', 'core', 'perplexityFactCheck.ts'),
  'utf8',
);

describe('Grounding cost guard — automatic call sites stay cut off', () => {
  test('CTA link discovery (runs on every article, every mode) uses a plain call, not Grounding', () => {
    expect(generationSrc).toContain("const ctaResponse = await callGeminiWithRetry(ctaPrompt);");
    expect(generationSrc).not.toContain('callGeminiWithGrounding(ctaPrompt)');
  });

  test('the one remaining Grounding call (main body generation) is still present and gated upstream', () => {
    // 이 호출 자체를 지우면 "선택형 Grounding" 기능 자체가 없어진다 — 그건 사용자 요구가 아니다.
    // orchestration.ts가 DISABLE_GEMINI_GROUNDING을 통해 기본 차단하고,
    // factCheckMode==='grounding' 명시 선택 시에만 연다.
    expect(generationSrc).toContain('let response = await callGeminiWithGrounding(prompt);');
  });

  test('orchestration.ts no longer imports or calls callGeminiWithGrounding at all', () => {
    expect(orchestrationSrc).not.toContain('callGeminiWithGrounding');
  });

  test('"보충 CTA" (최소 2개 보장) automatic search block is disabled, not just rerouted', () => {
    const block = blockBetween(
      orchestrationSrc,
      "} else if (currentCtaCount < 2) {",
      '// 🔥 실행 플랜 섹션 제거됨',
    );
    expect(block).toContain('supplementalCtas = [];');
    // v3.8.418 이전엔 이 분기 안에서 Gemini 검색을 돌리고 결과를 렌더링했다 — 그 흔적이 없어야 한다.
    expect(block).not.toContain('searchPrompt');
    expect(block).not.toContain('renderFinalCtaBlock(');
  });

  test('DISABLE_GEMINI_GROUNDING gate still requires an explicit factCheckMode==="grounding" choice', () => {
    const block = blockBetween(
      orchestrationSrc,
      'const groundingExplicitlyRequested',
      'let factEnrichedContents = contents;',
    );
    expect(block).toContain("rawFactMode === 'grounding'");
    expect(block).toContain("process.env['DISABLE_GEMINI_GROUNDING'] = '1'");
    expect(block).toContain("delete process.env['DISABLE_GEMINI_GROUNDING']");
  });

  test('fact-check auto chain never assigns mode to grounding (no automatic fallback path)', () => {
    // 실제 대입문(세미콜론까지)만 잡는다 — 히스토리를 설명하는 주석 속 백틱 인용은 세미콜론이 없어 걸리지 않는다.
    expect(factCheckSrc).not.toContain("mode = 'grounding';");
    // 명시 선택 시에만 타는 비교문은 그대로 남아 있어야 한다.
    expect(factCheckSrc).toContain("if (mode === 'grounding')");
  });
});
