/**
 * v3.8.566~567 — 영어 생성기 배선 (하네스 E2, 2단계)
 *
 * ## 여기까지 온 경위 — 세 번 규모를 잘못 봤다
 * 1차: "언어 지시문 5곳만 고치면 된다"  → 프롬프트 **자체**가 한국어였다(본문 135줄 중 한글 67%)
 * 2차: "껍데기 135줄만 영어로 쓰면 된다" → 모드 블록(한글 78%)이 "일반 지시보다 우선"이라 덮었다
 * 3차: "모드까지 만들면 된다"            → **생성기가 12개**이고 각자 한국어 프롬프트를 갖고 있었다
 *
 * 매번 배선만 확인하고 "됐다"고 했다가 실물에서 틀렸다. 실측으로 바닥을 봤다:
 *   generateAllSectionsFinal 7,477 · generateH1TitleFinal 6,345 · generateCTAsFinal 6,068
 *   generateH3ContentFinal 2,711 · generateH2TitlesFinal 1,495 · generateFAQFinal 1,205
 *   generateSectionTitlesFromRoles 787 · generateSummaryTableFinal 676 · 그 외 574
 *   = 약 27,000자
 *
 * ## 이 릴리스가 가른 것 (본문·제목·소제목·요약표·FAQ)
 * 나머지(CTA·H3·해시태그)는 아직이다. §④ 가 그 사실을 고정한다.
 *
 * ## 가장 중요한 불변식
 * **한국어 경로는 한 글자도 바뀌지 않았다.** 전부 "문자열만 고르는" 방식이라
 * 한국어 템플릿 자체는 그대로다. 수백 편이 그 문장으로 나가고 있다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { setActiveLanguage } from '../src/core/final/language-rules';
import {
  buildEnglishTitlePrompt,
  buildEnglishH2Prompt,
  buildEnglishFaqPrompt,
  buildEnglishSummaryTablePrompt,
  buildEnglishBodyPrompt,
} from '../src/core/final/prompt-en';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const generation = read('src/core/final/generation.ts');

afterEach(() => { setActiveLanguage('ko'); });

/** 영어 프롬프트에 한글이 섞이면 모델이 흔들린다 */
const noHangul = (s: string) => expect(s).not.toMatch(/[가-힣]/);

describe('① 영어 프롬프트에 한글이 없다', () => {
  it('⭐⭐ 다섯 생성기 프롬프트 전부', () => {
    noHangul(buildEnglishTitlePrompt({ keyword: 'shin ramyun', currentYear: 2026 }));
    noHangul(buildEnglishH2Prompt({ keyword: 'shin ramyun', targetCount: 5, currentYear: 2026 }));
    noHangul(buildEnglishFaqPrompt({ keyword: 'shin ramyun', h2Titles: ['A', 'B'], todayStr: '2026-08-28' }));
    noHangul(buildEnglishSummaryTablePrompt('plain text', '2026-08-28'));
    noHangul(buildEnglishBodyPrompt({
      keyword: 'shin ramyun', todayStr: '2026-08-28', h2List: '1. A', h2Count: 1,
      contentReference: '', draftReference: '', modePromptBlock: '', sectionGuideBlock: '',
      minCharsPerH3: 600,
    }));
  });
});

describe('② 번역투 제거가 최우선으로 박혀 있다', () => {
  const body = buildEnglishBodyPrompt({
    keyword: 'x', todayStr: '2026-08-28', h2List: '1. A', h2Count: 1,
    contentReference: '', draftReference: '', modePromptBlock: '', sectionGuideBlock: '',
    minCharsPerH3: 600,
  });

  /**
   * 사장님: "외국인이 영어를 한국어로 번역하면 어색한 것처럼 우리가 영어로 번역하면
   *          어색할 수 있거든. 그런 느낌을 완전히 지워야 돼."
   * 이 항목이 그 요구를 코드에 고정한다.
   */
  it('⭐⭐ 번역투 규칙이 [2]번 = 최우선 자리에 있다', () => {
    expect(body).toContain('[2. 🚨 HIGHEST PRIORITY — this must not read like a translation]');
    // 가독성([1])보다 뒤, 나머지([3] 이후)보다 앞이어야 한다
    expect(body.indexOf('[2. 🚨')).toBeGreaterThan(body.indexOf('[1. Readability'));
    expect(body.indexOf('[2. 🚨')).toBeLessThan(body.indexOf('[3. Sound like'));
  });

  it('⭐ 한국어 파이프가 내는 티를 구체적으로 짚는다', () => {
    for (const tell of [
      'Connector padding', 'Softening and hedging', 'Passive voice',
      'Over-explaining', 'Sentence rhythm', 'Korean context assumed', 'Units and money',
    ]) {
      expect(body).toContain(tell);
    }
  });

  it('⭐ 한국어 용어는 로마자 + 뜻풀이를 요구한다', () => {
    expect(body).toContain('romanize');
    expect(body).toContain('gochugaru (Korean chili flakes)');
  });
});

describe('③ 다섯 생성기가 언어로 갈린다 — 한국어 경로는 그대로', () => {
  const cases: Array<[string, string]> = [
    ['본문', 'buildEnglishBodyPrompt'],
    ['제목', 'buildEnglishTitlePrompt'],
    ['소제목', 'buildEnglishH2Prompt'],
    ['요약표', 'buildEnglishSummaryTablePrompt'],
    ['FAQ', 'buildEnglishFaqPrompt'],
  ];

  it.each(cases)('⭐⭐ %s 생성기가 영어 분기를 탄다', (_label, fn) => {
    expect(generation).toContain(fn);
  });

  it('⭐⭐ 한국어 프롬프트 문장이 그대로 남아 있다', () => {
    // 문자열만 고르는 방식이므로 한국어 템플릿은 손대지 않았다
    expect(generation).toContain('당신은 대한민국 최고의 바이럴 마케터입니다');
    expect(generation).toContain('🔴🔴🔴 **핵심 규칙 - 중복 금지 & 다양성 확보!**');
    expect(generation).toContain('위 본문 내용을 기반으로 핵심 요약표를 만드세요');
    expect(generation).toContain('자주 묻는 질문(FAQ) 5개를 만들어주세요');
  });

  it('⭐ 분기는 getActiveLanguage() 하나로만 판단한다', () => {
    const branches = generation.match(/getActiveLanguage\(\) === 'en'/g) || [];
    expect(branches.length).toBeGreaterThanOrEqual(5);
  });

  it('⭐ 영어 제목이 비면 조용히 빈 제목을 내보내지 않는다', () => {
    expect(generation).toContain('영어 제목이 비어 한국어 경로로 되돌립니다');
  });
});

describe('④ overseas 모드', () => {
  const overseas = read('src/core/content-modes/overseas/overseas-mode.ts');
  const registerAll = read('src/core/content-modes/register-all.ts');
  const orchestration = read('src/core/final/orchestration.ts');

  it('⭐⭐ 레지스트리에 등록된다 (import 를 빼먹으면 조용히 미등록된다)', () => {
    expect(registerAll).toContain("import './overseas/overseas-mode'");
    expect(overseas).toContain('registerMode(overseasModePlugin)');
    expect(overseas).toContain("id: 'overseas'");
  });

  it('⭐⭐ 모드 프롬프트가 영어다 (한국어면 껍데기를 덮어 본문이 한국어가 된다)', () => {
    // 주석은 한국어여도 되지만 프롬프트 문자열은 영어여야 한다
    const prompts = [
      overseas.slice(overseas.indexOf('buildSectionPrompt'), overseas.indexOf('buildTitlePrompt')),
      overseas.slice(overseas.indexOf('buildTitlePrompt'), overseas.indexOf('buildOutlinePrompt')),
    ].join('\n').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(prompts).not.toMatch(/[가-힣]/);
  });

  it('⭐⭐ generation.ts 의 모드 블록도 영어다', () => {
    const block = generation.slice(
      generation.indexOf("const overseasModePromptBlock = contentMode === 'overseas'"),
      generation.indexOf('const todayStr = new Date()'),
    );
    expect(block).toContain('OVERSEAS MODE');
    // 주석 줄을 뺀 프롬프트 본문에 한글이 없어야 한다
    const promptOnly = block.slice(block.indexOf('🌍🌍🌍'));
    expect(promptOnly).not.toMatch(/[가-힣]/);
  });

  it('⭐⭐ overseas 모드는 언어를 영어로 강제한다 (모드↔언어 어긋남 방지)', () => {
    expect(orchestration).toContain("(payload as any)?.contentMode === 'overseas'");
    expect(orchestration).toContain("? 'en'");
  });

  it('⭐ 원산지 우위를 매 섹션에서 쓰라고 지시한다', () => {
    expect(overseas).toContain('You are writing from inside Korea');
    expect(overseas).toContain('never been to Korea');
  });
});

describe('⑤ 아직 안 된 것 — 다 됐다고 착각하지 않기', () => {
  /**
   * CTA·H3 본문·해시태그 생성기는 아직 한국어 전용이다.
   * 이 테스트가 초록이면 아직 남았다는 뜻이고, 그것들을 영어로 가르면 빨간불이 되어
   * 이 파일을 갱신하게 된다.
   */
  it('⭐ CTA·H3·해시태그 생성기는 아직 한국어 전용이다', () => {
    const kor = (fnName: string) => {
      const s = generation.indexOf(`export async function ${fnName}`);
      expect(s).toBeGreaterThan(-1);
      const next = generation.indexOf('\nexport async function ', s + 10);
      const body = generation.slice(s, next > -1 ? next : undefined);
      return (body.match(/[가-힣]/g) || []).length;
    };
    expect(kor('generateCTAsFinal')).toBeGreaterThan(1000);
    expect(kor('generateH3ContentFinal')).toBeGreaterThan(500);
  });
});
