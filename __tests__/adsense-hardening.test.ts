import { scanAdsenseHardening } from '../src/core/final/adsense-hardening';

describe('scanAdsenseHardening', () => {
  it('flags CTA and affiliate residue as a hard AdSense issue', () => {
    const html = `
      <article>
        <h2>Guide</h2>
        <p>This paragraph is informational and neutral.</p>
        <div class="cta-box affiliate-banner">
          <a class="cta-btn" href="https://example.com" rel="nofollow sponsored" onclick="track()">Apply now</a>
        </div>
      </article>
    `;

    const result = scanAdsenseHardening(html);

    expect(result.ok).toBe(false);
    expect(result.warnings.some(w => w.metric === 'ctaResidue' && w.severity === 'hard')).toBe(true);
  });

  it('passes a varied informational article shape', () => {
    const html = `
      <article>
        <h2>Overview</h2><p>Readers need a clear first explanation. This section gives context and avoids hype.</p>
        <h2>Checklist</h2><p>Preparation starts with a visible list of required items. The wording stays practical.</p>
        <table><tr><th>Item</th><th>Check</th></tr><tr><td>Source</td><td>Verified</td></tr></table>
        <h2>Common Mistakes</h2><p>Many sites fail because the navigation is unclear. This paragraph explains the risk.</p>
        <h2>Examples</h2><p>A useful example shows what to inspect before publishing. The reader gets a concrete path.</p>
        <h2>FAQ</h2><p>Questions should be answered directly. Short answers still need enough supporting detail.</p>
        <p>Evidence and dates help users judge reliability. The article should feel reviewed.</p>
        <p>Tables, headings, and paragraphs each play a different role. That variety matters.</p>
        <p>The closing should summarize without pushing a click. It stays educational and calm.</p>
      </article>
    `;

    const result = scanAdsenseHardening(html);

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('warns when paragraph openings and endings are too repetitive', () => {
    const repeatedParagraphs = Array.from({ length: 10 }, () =>
      `<p>Important note repeats the same structure today. Important note repeats the same rhythm today.</p>`
    ).join('');
    const html = `
      <article>
        <h2>One</h2><h2>Two</h2><h2>Three</h2><h2>Four</h2><h2>Five</h2>
        <table><tr><td>A</td></tr></table>
        ${repeatedParagraphs}
      </article>
    `;

    const result = scanAdsenseHardening(html);

    expect(result.ok).toBe(false);
    expect(result.warnings.some(w => w.metric === 'paragraphOpeners')).toBe(true);
    expect(result.warnings.some(w => w.metric === 'sentenceEndings')).toBe(true);
  });
});
