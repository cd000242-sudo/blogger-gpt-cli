/**
 * claude-seo review pass — criteria extraction.
 *
 * The app copies two third-party SKILL.md files untouched and lifts only the sections that apply to a single
 * article. These tests pin (1) the exact sections lifted from the real bundle, (2) verbatim copying, and
 * (3) the failure behavior when a heading disappears after a skill update.
 */
import * as fs from 'fs';
import * as path from 'path';
import { extractSeoCriteria, loadSeoCriteria, SEO_CRITERIA_SPECS } from '../src/core/final/seo-skill-criteria';

const BUNDLE = path.join(__dirname, '..', 'electron', 'assets', 'claude-seo');
const readSkill = (name: string): string => fs.readFileSync(path.join(BUNDLE, 'skills', name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const CONTENT = readSkill('seo-content');
const GEO = readSkill('seo-geo');

describe('bundle shipped with the app', () => {
  test('both skill files, the license and the notice are in electron/assets (electron/**/* ships them)', () => {
    for (const rel of ['LICENSE', 'NOTICE.md', 'skills/seo-content/SKILL.md', 'skills/seo-geo/SKILL.md']) {
      expect(fs.existsSync(path.join(BUNDLE, rel))).toBe(true);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.build.files).toContain('electron/**/*');
    expect(fs.readFileSync(path.join(__dirname, '..', 'electron-builder.yml'), 'utf8')).toContain('electron/**/*');
  });
});

describe('extractSeoCriteria — real bundle', () => {
  const result = extractSeoCriteria({ content: CONTENT, geo: GEO });

  test('all 11 requested sections are found and nothing is missing', () => {
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.found).toHaveLength(11);
    expect(SEO_CRITERIA_SPECS).toHaveLength(11);
  });

  test('every extracted block is a verbatim slice of its SKILL.md (no rewording)', () => {
    for (const spec of SEO_CRITERIA_SPECS) {
      const source = spec.file === 'content' ? CONTENT : GEO;
      const start = source.split('\n').find((l) => l.startsWith(spec.heading)) as string;
      expect(start).toBeDefined();
      expect(result.text).toContain(start);
    }
    // Multi-line verbatim checks on blocks that contain lists and a blockquote note
    expect(result.text).toContain('- Primary keyword in title, H1, first 100 words\n- Natural use of the topic, entities, and close variations');
    expect(result.text).toContain('> **Note:** Flesch Reading Ease is a useful proxy');
    expect(result.text).toContain('**Strong signals:**\n- Clear, quotable sentences with specific facts/statistics');
  });

  test('the Who / How / Why test and the E-E-A-T sub-sections that apply to one article are present', () => {
    expect(result.text).toContain('## Google\'s "Who / How / Why" Test');
    expect(result.text).toContain('### Experience (first-hand signals)');
    expect(result.text).toContain('### Expertise');
    expect(result.text).toContain('### Readability');
    expect(result.text).toContain('### Keyword Optimization');
    expect(result.text).toContain('### Content Structure');
  });

  test('AI Content Assessment keeps both sub-sections but stops before the trailing blockquote notes', () => {
    expect(result.text).toContain('### Acceptable AI Content');
    expect(result.text).toContain('### Low-Quality AI Content Markers');
    expect(result.text).toContain('- Factual inaccuracies');
    expect(result.text).not.toContain('Helpful Content System (March 2024)');
    expect(result.text).not.toContain('Honest scoping');
  });

  test('AI Citation Readiness stops right before "### AI Search Visibility"', () => {
    expect(result.text).toContain('## AI Citation Readiness (GEO signals)');
    expect(result.text).toContain('- Clear attribution and source citations');
    expect(result.text).not.toContain('### AI Search Visibility');
    expect(result.text).not.toContain('Google AI Mode');
  });

  test('seo-geo contributes the primary source, citability and structural readability only', () => {
    expect(result.text).toContain('## Primary Source: Google\'s AI Optimization Guide');
    expect(result.text).toContain('### 1. Citability Score (25%)');
    expect(result.text).toContain('### 2. Structural Readability (20%)');
    expect(result.text).not.toContain('### 3. Multi-Modal Content');
    expect(result.text).not.toContain('## Key Statistics');
  });

  test('site-level and tool sections are not lifted (scripts, word-count floors, internal links, cleanup, DataForSEO)', () => {
    for (const banned of [
      'content_humanize.py', 'scripts/claude-seo', '### Word Count Analysis', '### Internal Linking', '### Trustworthiness',
      '## Draft Cleanup', '## DataForSEO', '## Security', '## AI Crawler Detection', '## llms.txt Standard',
    ]) {
      expect(result.text).not.toContain(banned);
    }
  });
});

describe('extractSeoCriteria — skill updates and odd input', () => {
  test('a vanished heading is skipped with a warning; the rest still comes out', () => {
    const content = CONTENT.replace('### Expertise', '### Know-how');
    const r = extractSeoCriteria({ content, geo: GEO });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual(['### Expertise']);
    expect(r.found).toHaveLength(10);
    expect(r.text).not.toContain('- Author credentials, certifications, bio');
  });

  test('headings match by prefix, so a changed parenthetical (date / weight) still matches', () => {
    const content = CONTENT.replace('## AI Content Assessment (QRG: generative-AI guidance added January 2025; current version September 11, 2025)', '## AI Content Assessment (QRG 2027)');
    const geo = GEO.replace('### 1. Citability Score (25%)', '### 1. Citability Score (30%)');
    const r = extractSeoCriteria({ content, geo });
    expect(r.missing).toEqual([]);
    expect(r.text).toContain('## AI Content Assessment (QRG 2027)');
    expect(r.text).toContain('### 1. Citability Score (30%)');
  });

  test('nothing found at all means failure', () => {
    const r = extractSeoCriteria({ content: '# empty\n', geo: '' });
    expect(r.ok).toBe(false);
    expect(r.text).toBe('');
    expect(r.found).toEqual([]);
    expect(r.missing).toHaveLength(11);
  });

  test('CRLF files give the same result as LF files', () => {
    const lf = extractSeoCriteria({ content: CONTENT, geo: GEO });
    const crlf = extractSeoCriteria({ content: CONTENT.replace(/\n/g, '\r\n'), geo: GEO.replace(/\n/g, '\r\n') });
    expect(crlf.text).toBe(lf.text);
  });

  test('a "## " line inside a code fence does not end a section', () => {
    const content = [
      '## Google\'s "Who / How / Why" Test (x)', 'before', '```', '## fake heading', '```', 'after fence', '## Next', 'other',
    ].join('\n');
    const r = extractSeoCriteria({ content, geo: '' });
    expect(r.text).toContain('after fence');
    expect(r.text).not.toContain('other');
  });
});

describe('loadSeoCriteria', () => {
  test('reads the real bundle folder', () => {
    const r = loadSeoCriteria(BUNDLE);
    expect(r.ok).toBe(true);
    expect(r.found).toHaveLength(11);
    expect(r.fileErrors).toEqual([]);
  });

  test('a missing folder is a failure, not an exception', () => {
    const r = loadSeoCriteria(path.join(BUNDLE, 'does-not-exist'));
    expect(r.ok).toBe(false);
    expect(r.fileErrors).toHaveLength(2);
  });

  test('one unreadable file still lets the other contribute', () => {
    const read = (p: string): string => {
      if (p.includes('seo-geo')) throw new Error('ENOENT');
      return fs.readFileSync(p, 'utf8');
    };
    const r = loadSeoCriteria(BUNDLE, read);
    expect(r.ok).toBe(true);
    expect(r.fileErrors).toHaveLength(1);
    expect(r.found.length).toBe(8);
  });
});
