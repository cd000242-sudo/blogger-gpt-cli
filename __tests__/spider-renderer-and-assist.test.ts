/**
 * 거미줄 종합글 — 화면 검증 함수 + Agent 모드 보조 단계 (묶음 A + B)
 *
 * · 화면(internal-links.js)의 _swValidateGenResult 를 실제 소스에서 꺼내 그대로 돌린다.
 * · Agent 모드에서는 태그·메타를 Gemini 로 만들지 않는다 — 결정적 방법(제목 명사 / 본문 앞부분)을 쓴다.
 * 실제 LLM·앱·네트워크는 부르지 않는다. Gemini 모델은 가짜 객체다.
 */
import fs from 'fs';
import path from 'path';
import { braceBlock } from './helpers/source-block';
import {
  fallbackSpiderMetaDescription,
  generateSpiderGeminiLabels,
  generateSpiderGeminiMeta,
  buildSpiderAgentInstructions,
} from '../src/core/spider';

const UI = fs.readFileSync(path.join(process.cwd(), 'electron/ui/modules/internal-links.js'), 'utf8');

function loadValidator(): (genResult: any, userTitle: string) => any {
  const constSrc = (UI.match(/const SW_TITLE_MISSING_MESSAGE = [^;]+;/) || [''])[0];
  const genericList = (UI.match(/const SW_GENERIC_TITLES = \[[^\]]*\];/) || [''])[0];
  const fns = ['_swIsGenericTitle', '_swPlainTextLength', '_swValidateGenResult']
    .map((name) => braceBlock(UI, `function ${name}`));
  const src = `${constSrc}\n${genericList}\n${fns.map((f, i) => `function ${['_swIsGenericTitle', '_swPlainTextLength', '_swValidateGenResult'][i]}${f.slice(f.indexOf('('))}`).join('\n')}\nreturn _swValidateGenResult;`;
  // eslint-disable-next-line no-new-func
  return new Function(src)();
}

const BODY = `<div><h2>소제목</h2><p>${'본문 '.repeat(120)}</p></div>`;
const GOOD = { success: true, html: BODY, title: 'AI 가 쓴 제목', imageStats: { thumbnail: true, h2Generated: 3, h2Failed: 0, errors: [], hostProviders: [] }, labels: [] };

describe('화면 _swValidateGenResult — 성공 응답이어도 비면 멈춘다', () => {
  const validate = loadValidator();

  it('정상 응답은 통과하고 확정 제목을 돌려준다 (사용자 제목 우선)', () => {
    expect(validate(GOOD, '')).toEqual({ ok: true, title: 'AI 가 쓴 제목' });
    expect(validate(GOOD, '내가 쓴 제목')).toEqual({ ok: true, title: '내가 쓴 제목' });
  });
  it('본문이 없거나 스타일만 있으면 멈춘다', () => {
    expect(validate({ ...GOOD, html: '' }, '').ok).toBe(false);
    expect(validate({ ...GOOD, html: '<style>.a{color:red}</style>' }, '').ok).toBe(false);
  });
  it('제목이 비었거나 일반어면 멈추고 지정 문구를 보여 준다', () => {
    const empty = validate({ ...GOOD, title: '' }, '');
    expect(empty).toEqual({ ok: false, message: '제목을 만들지 못했습니다. 통합글 제목 칸에 직접 입력해 주세요.' });
    expect(validate({ ...GOOD, title: '종합 가이드' }, '').ok).toBe(false);
    expect(validate({ ...GOOD, title: '거미줄치기 통합글' }, '').ok).toBe(false);
  });
  it('이미지 정보(imageStats)가 없는 응답 = 대체 틀의 흔적이라 멈춘다', () => {
    const r = validate({ success: true, html: BODY, title: '제목' }, '');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/다시 시도/);
  });
});

describe('Agent 모드 보조 단계 — Gemini 없이 결정적으로', () => {
  it('메타 설명 폴백은 본문 앞 155자(152자+…)를 쓴다 — 기존 폴백과 같은 규칙', () => {
    const plain = '가'.repeat(400);
    const out = fallbackSpiderMetaDescription(plain);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(153);
    expect(fallbackSpiderMetaDescription('짧은 글')).toBe('짧은 글');
  });

  it('Gemini 라벨: 응답의 JSON 배열을 읽어 2~40자 라벨 5개까지', async () => {
    const model = { generateContent: jest.fn().mockResolvedValue({ response: { text: () => '```json\n["청년도약계좌","x","적금 비교","가입 조건","금리","여섯째"]\n```' } }) };
    const labels = await generateSpiderGeminiLabels(model, '제목', '<p>본문</p>');
    expect(labels).toEqual(['청년도약계좌', '적금 비교', '가입 조건', '금리', '여섯째']);
    expect(model.generateContent).toHaveBeenCalledTimes(1);
  });

  it('Gemini 메타: 100~200자가 아니면 던진다(호출자가 폴백으로 처리)', async () => {
    const make = (text: string) => async () => ({ generateContent: async () => ({ response: { text: () => text } }) });
    await expect(generateSpiderGeminiMeta(make('너무 짧음'), { title: 't', plainText: 'p', labels: [] })).rejects.toThrow(/길이/);
    const ok = '가'.repeat(150);
    await expect(generateSpiderGeminiMeta(make(`"${ok}"`), { title: 't', plainText: 'p', labels: ['a'] })).resolves.toBe(ok);
  });
});

describe('buildSpiderAgentInstructions — 지시서는 그대로, 값만 끼운다', () => {
  const theme = { gradientStart: '#111111', gradientEnd: '#222222', primary: '#333333', heading: '#444444', ctaShadow: 'rgba(0,0,0,.1)', surfaceAlt: '#555555', borderSoft: '#666666' };
  const text = buildSpiderAgentInstructions({
    prompt: 'PROMPT-BODY',
    theme,
    sourceCount: 4,
    ctaBoxStyle: 'BOX-STYLE',
    ctaButtonStyle: 'BTN-STYLE',
    today: '2026-11-10',
  });
  it('작업지시서·색상·CTA 스타일·날짜가 들어가고 필수 산출물 파일을 안내한다', () => {
    expect(text).toContain('PROMPT-BODY');
    expect(text).toContain('"primary": "#333333"');
    expect(text).toContain('BOX-STYLE');
    expect(text).toContain('BTN-STYLE');
    expect(text).toContain('Last updated: 2026-11-10');
    expect(text).toContain('(4개)');
    expect(text).toContain('`result/article.html`');
    expect(text).toContain('`result/metadata.json`');
  });
});
