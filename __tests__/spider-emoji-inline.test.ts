/**
 * Spider post — emoji must stay inline on WordPress.
 *
 * Measured on the published post (2026-11-11): WordPress swaps every emoji for `<img class="emoji">` in the browser,
 * and the spider's own rule `.max-mode-article img{display:block;margin:18px auto}` then put each emoji on a line of
 * its own (📊 above "핵심 통계", 📖 above the CTA label). The post's `<style>` now survives publishing (pass-through),
 * so it has to exempt emoji images itself.
 */
import fs from 'fs';
import path from 'path';

const MAIN = fs.readFileSync(path.join(__dirname, '../electron/main.ts'), 'utf8');

describe('spider post style — emoji images', () => {
  const blockRule = MAIN.indexOf('.max-mode-article img{');
  const emojiRule = MAIN.search(/\.max-mode-article img\.emoji\s*,\s*\.max-mode-article img\.wp-smiley\s*\{/);

  it('keeps the block rule for real pictures', () => {
    expect(blockRule).toBeGreaterThan(-1);
    // the rule body only: from its selector to its own closing brace
    expect(MAIN.slice(blockRule, MAIN.indexOf('}', blockRule))).toMatch(/display:block !important/);
  });

  it('has an emoji exemption after the block rule so it wins on equal importance', () => {
    expect(emojiRule).toBeGreaterThan(blockRule);
  });

  it('makes emoji inline, text sized, without the picture margin or rounding', () => {
    const rule = MAIN.slice(emojiRule, MAIN.indexOf('}', emojiRule) + 1);
    expect(rule).toMatch(/display:inline !important/);
    expect(rule).toMatch(/width:1em !important/);
    expect(rule).toMatch(/height:1em !important/);
    expect(rule).toMatch(/margin:0 \.07em !important/);
    expect(rule).toMatch(/vertical-align:-0\.1em !important/);
    expect(rule).toMatch(/border-radius:0 !important/);
    expect(rule).toMatch(/box-shadow:none !important/);
  });
});
