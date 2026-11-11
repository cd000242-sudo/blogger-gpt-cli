import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { buildSpiderAgentInstructions } from '../src/core/spider/agent-instructions';
import { finishSpiderHtml } from '../src/core/spider/finish';

const theme = { gradientStart: '#111111', gradientEnd: '#222222', primary: '#333333', heading: '#444444', ctaShadow: 'rgba(0,0,0,.1)', surfaceAlt: '#555555', borderSoft: '#666666' };
const sheet = buildSpiderAgentInstructions({
  prompt: 'PROMPT-BODY', theme, sourceCount: 4, ctaBoxStyle: 'BOX-STYLE', ctaButtonStyle: 'BTN-STYLE', today: '2026-11-10',
});
const lines = sheet.split('\n');
const NEW_RULE_LINES = (l: string) => l.includes('ORIGINAL_URL_여기에_그대로_쓰기" target') || l.startsWith('- 버튼 문구는') || l.startsWith('- 버튼 글자 크기는');
// sha256 of the sheet recorded BEFORE this change, with its one CTA button line removed (same inputs as above)
const SHEET_WITHOUT_CTA_BUTTON_LINES_SHA = '412d20af3dac8723f9b545aa5b88809e4ba9d3afabca941ec03aa24903e36fc4';

describe('거미줄 Agent 지시서 — CTA 버튼 문구 규칙', () => {
  it('새 규칙: 주제 낱말 + 행동, 20자 안쪽, 제목 전체 금지, 이모지는 없거나 맨 앞 하나, 17px', () => {
    expect(sheet).toContain('- 버튼 문구는 그 글의 주제 낱말 + 행동으로 **20자 안쪽**');
    expect(sheet).toContain('"자격조건 자세히 보기 →"');
    expect(sheet).toContain('"신청방법 순서 보기 →"');
    expect(sheet).toContain('원본 글 제목 전체를 넣지 않는다');
    expect(sheet).toContain('이모지는 넣지 않거나 맨 앞 하나만');
    expect(sheet).toContain('- 버튼 글자 크기는 위 스타일의 17px 를 그대로 쓴다');
  });

  it('옛 규칙(원본 글 제목 + 자세히 보기)이 없다', () => {
    expect(sheet).not.toContain('[원본 글 제목]');
    expect(sheet).not.toContain('📖');
    expect(lines.filter((l) => l.includes('ORIGINAL_URL_여기에_그대로_쓰기" target'))).toEqual([
      '    <a href="ORIGINAL_URL_여기에_그대로_쓰기" target="_blank" rel="noopener" style="BTN-STYLE">[주제 낱말] 자세히 보기 →</a>',
    ]);
  });

  it('그 밖의 지시문은 한 글자도 바뀌지 않았다 (바꾸기 전 해시와 같다)', () => {
    const rest = lines.filter((l) => !NEW_RULE_LINES(l)).join('\n');
    expect(crypto.createHash('sha256').update(rest).digest('hex')).toBe(SHEET_WITHOUT_CTA_BUTTON_LINES_SHA);
    // the hook line above the button is untouched
    expect(sheet).toContain('독자가 클릭하고 싶어지는 강한 한 줄 후킹 (예: "정확한 신청 조건이 따로 있어요. 확인해보세요!")');
  });
});

describe('main.ts — Gemini 작업지시서와 버튼 스타일', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf8');
  const styleFn = main.slice(main.indexOf('function buildSpiderCtaButtonStyle'), main.indexOf('function applySpiderEyeComfortColors'));

  it('버튼 글자 크기는 17px 하나다 (15·16px 가 없다)', () => {
    expect(styleFn).toContain("'font-size:17px !important'");
    expect(styleFn).not.toMatch(/'15px'|'16px'/);
  });

  it('작업지시서의 버튼 예시가 제목형·이모지형이 아니라 새 규칙이다', () => {
    expect(main).not.toContain('2026년 청년내일저축계좌 혜택 상세 보기 🔥');
    expect(main).toContain('[버튼 텍스트 — 그 글의 주제 낱말 + 행동, 20자 안쪽.');
    expect(main).toContain('- 버튼 문구는 글 제목 전체를 넣지 않는다. 이모지는 넣지 않거나 맨 앞 하나만.');
  });
});

describe('finishSpiderHtml — CTA 버튼 글자 크기 안전망 (서식만, 문구는 안 건드림)', () => {
  const button = (size: string, text = '자격조건 자세히 보기 →') =>
    `<p><a href="https://a.example/1" target="_blank" rel="noopener" style="display:inline-block !important;padding:14px 28px !important;color:#ffffff !important;text-decoration:none !important;font-size:${size} !important;font-weight:800 !important;word-break:keep-all !important;white-space:normal !important;max-width:100% !important">${text}</a></p>`;
  const wrap = (inner: string) => `<div class="sw-cornerstone"><h2>제목</h2>${inner}</div>`;
  const run = (html: string) => finishSpiderHtml(html, { platform: 'wordpress' });

  it.each(['15px', '16px', '14.5px'])('%s 버튼은 17px 로 올리고 !important 는 그대로 둔다', (size) => {
    const out = run(wrap(button(size)));
    expect(out.html).toContain('font-size:17px !important');
    expect(out.html).not.toContain(`font-size:${size}`);
    expect(out.changes.join(' ')).toMatch(/CTA 버튼 글자 크기/);
  });

  it('버튼 문구는 한 글자도 바꾸지 않는다 (긴 제목형 문구도 코드가 고쳐 쓰지 않는다)', () => {
    const long = '📖 인천 산후조리원 지원금 자격조건, 모든 산모가 150만원은 아닙니다 자세히 보기 →';
    expect(run(wrap(button('15px', long))).html).toContain(`>${long}</a>`);
  });

  it('이미 17px 이상이면 그대로 (줄이지도 않는다)', () => {
    const html = wrap(button('17px') + button('18px'));
    const out = run(html);
    expect(out.html).toContain('font-size:17px !important');
    expect(out.html).toContain('font-size:18px !important');
    expect(out.changes.join(' ')).not.toMatch(/CTA 버튼 글자 크기/);
  });

  it('CTA 버튼이 아닌 링크·글자는 건드리지 않는다', () => {
    const other = '<p><a href="https://b.example" style="font-size:14px;color:#2563eb;">출처 링크</a></p><p style="font-size:15px;">본문</p>';
    const out = run(wrap(other));
    expect(out.html).toContain('style="font-size:14px;color:#2563eb;"');
    expect(out.html).toContain('<p style="font-size:15px;">본문</p>');
  });

  it('두 번 돌려도 같다', () => {
    const once = run(wrap(button('15px'))).html;
    expect(run(once).html).toBe(once);
  });
});
