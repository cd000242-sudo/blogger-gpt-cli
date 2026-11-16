/**
 * claude-seo review pass - wiring in the agent job (electron/main.ts and its compiled main.js).
 * Sliced by markers (never by fixed length) so unrelated edits above or below cannot make these vacuous.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string): string => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const between = (src: string, start: string, end: string): string => {
  const a = src.indexOf(start);
  expect(a).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b).toBeGreaterThan(a);
  return src.slice(a, b);
};

describe.each([['electron/main.ts'], ['electron/main.js']])('%s', (file) => {
  const main = read(file);
  const block = between(main, "require('../dist/core/final/seo-skill-review')", 'catch (seoReviewErr');

  test('the review runs once, after the pre-publish self-fix and before shopping widgets, skin and voice', () => {
    const at = (needle: string): number => main.indexOf(needle);
    expect(main.split("require('../dist/core/final/seo-skill-review')")).toHaveLength(2);
    expect(at("require('../dist/core/final/seo-skill-review')")).toBeGreaterThan(at("[AGENT-PREFLIGHT] 건너뜀"));
    expect(at("require('../dist/core/final/seo-skill-review')")).toBeLessThan(at("attachAgentShoppingBlocks } = require('../dist/core/final/agent-shopping')"));
    expect(at("require('../dist/core/final/seo-skill-review')")).toBeLessThan(at("require('../dist/core/final/agent-skin')"));
    expect(at("require('../dist/core/final/seo-skill-review')")).toBeLessThan(at("require('../dist/core/final/voice-softener')"));
  });

  test('text-only call on the same CLI: no tools, stdin prompt, no paid API, skill folder next to main', () => {
    expect(block).toContain('runAgentTextTask(');
    expect(block).toContain('noTools: true');
    expect(block).toContain('promptViaStdin: true');
    expect(block).not.toContain('callGeminiWithRetry');
    expect(block).toMatch(/path\.join\(__dirname, 'assets', 'claude-seo'\)/);
    // the engine the user picked is used, with no silent fallback model
    expect(block).not.toContain('fallbackModel');
  });

  test('author requirements travel with the prompt and can veto the result; the draft is replaced only by the runner output', () => {
    expect(block).toContain('agentReqMod.withRequirements(prompt, agentReq)');
    expect(block).toContain("agentStageRegressions(agentReq, before, after, 'seo-skill-review')");
    expect(block).toContain('result.content = seoReview.html');
  });

  test('a stopped job skips the step, and the user sees the log line', () => {
    const guard = between(main, "if (!run.canceled && !agentCanceled()) {", "require('../dist/core/final/seo-skill-review')");
    expect(guard.length).toBeLessThan(200);
    expect(block).toContain('tellRenderer(`[PROGRESS] ${line}`)');
  });
});

test('main.js is the compiled twin of main.ts for this block', () => {
  const norm = (s: string): number => (s.match(/seo-skill-review|SEO_REVIEW_SYSTEM_PROMPT|runSeoSkillReview|AGENT-SEO-SKILL/g) || []).length;
  expect(norm(read('electron/main.js'))).toBe(norm(read('electron/main.ts')));
});
