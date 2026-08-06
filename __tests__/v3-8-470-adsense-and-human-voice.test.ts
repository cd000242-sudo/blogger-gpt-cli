/**
 * v3.8.470 — 애드센스 승인 리스크 + 사람 냄새 나는 문체
 *
 * 사용자 질문: "요즘 에드센스 승인받는게 정말어려운데 지금 내툴로는 글을쓰면
 * 에드센스 승인을 받을수있을까??" · "사람냄새가 심하게 나야되는데"
 *
 * ## 심층 리서치로 확인한 것 (구글·공정위 1차 문서 기준)
 * · 애드센스 공식 자격 요건은 3가지뿐이다. **"글 20~30편, 1500자" 같은 수치 기준은
 *   구글 문서 어디에도 없다** — 블로그 통설이다. UI 에 승인 요건으로 박으면 안 된다.
 * · 진짜 걸리는 조항은 게시자 정책 11112688:
 *   "Don't place ads on automatically generated content without manual review or
 *    curation." → AI 사용이 금지가 아니라 **사람 검토 없는 자동 생성물**이 금지다.
 * · 애드센스 Misrepresentative content > Misleading representation:
 *   콘텐츠 제작자·콘텐츠 자체에 대한 허위 서술 금지. 가짜 1인칭 체험담이 여기 걸린다.
 * · 공정위 「추천·보증 심사지침」 개정안 **2026-06-01 시행**: AI 생성 가상인물을
 *   추천·보증 주체로 추가. **"AI가 작성했습니다"라고 표시해도 면책되지 않는다** —
 *   경험에 근거한 것처럼 쓰면서 실제 경험적 사실에 부합하지 않으면 부당 표시광고.
 *
 * ## 코드에서 나온 실제 결함
 * 같은 프롬프트에 정반대 지시가 동시에 들어가고 있었다:
 *   personal_experience 섹션 → "Before & After 구체적 수치" 1,500자 요구
 *   NO_EXPERIENCE_GUARD      → "제가 직접 신청해보니 — 쓰지 마세요"
 * 게다가 가드는 `authorInfo.name` 으로 판정해서 **이름 한 글자만 있으면 통과**했고,
 * MAX 계열 모드는 가드를 아예 타지 않았다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { HUMAN_VOICE_RULES } from '../src/core/final/lived-voice';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const adsenseSections = read('src/core/content-modes/adsense/adsense-sections.ts');
const maxSections = read('src/core/max-mode/mode-sections-extended.ts');
const dispatcher = read('src/core/final/mode-dispatcher.ts');
const orchestration = read('src/core/final/orchestration.ts');
const essentialPages = read('src/core/content-modes/adsense/essential-pages.ts');

describe('① 겪지 않은 경험을 강제하던 지시를 걷어냈다', () => {
  /** 주석에는 사고 경위가 남아 있으므로 코드(요구사항 문자열)만 검사한다 */
  const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

  it('⭐⭐ 애드센스 경험 섹션이 가짜 수치를 요구하지 않는다', () => {
    const code = codeOnly(adsenseSections);
    expect(code).not.toContain('Before & After 구체적 수치');
    expect(code).not.toContain('사용 전 월 3만원 → 사용 후 월 8천원');
    expect(code).toContain('작성자가 적어준 경험 메모 안의 내용만 쓴다');
  });

  it('⭐⭐ MAX 계열도 마찬가지다 (여기는 가드조차 없었다)', () => {
    const code = codeOnly(maxSections);
    expect(code).not.toContain('실패 사례 3가지 솔직하게');
    expect(code).not.toContain('과정 사진 3-4장 (직접 촬영)');
    expect(code).not.toContain('"Before & After 비교"');
  });

  it('⭐⭐ 후기 섹션도 별점·레퍼런스를 지어내지 못하게 한다', () => {
    // 2026-07-24 갱신된 구글 리뷰 스니펫 문서: 실제 경험에 근거하지 않은 후기에 수동 조치
    const code = codeOnly(maxSections);
    expect(code).toContain('수집된 실제 데이터에 있는 값만');
    expect(code).toContain('자료에 실제로 있을 때만');
  });

  it('⭐ 분량을 채우려고 만들어내지 말라고 못 박는다', () => {
    for (const src of [adsenseSections, maxSections]) {
      expect(src).toContain('분량을 채우려고');
    }
  });
});

describe('② 경험 섹션 가드 — 이름이 아니라 실제 경험으로', () => {
  it('⭐⭐ 이름 유무가 아니라 경험 메모 유무로 판정한다', () => {
    expect(dispatcher).toContain('const hasWrittenExperience = !!(options?.hasExperienceNote)');
    // 이름으로 판정하던 예전 게이트가 남아 있으면 안 된다
    const code = dispatcher.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(code).not.toContain('authorInfo?.name && options.authorInfo.name.trim()');
  });

  it('⭐⭐ 애드센스 모드에만 걸지 않고 모든 모드에 적용한다', () => {
    const block = dispatcher.slice(
      dispatcher.indexOf('const hasWrittenExperience'),
      dispatcher.indexOf('const hasWrittenExperience') + 700,
    );
    expect(block).toContain('if (!hasWrittenExperience) {');
    expect(block).not.toContain("contentMode === 'adsense'");
  });

  it('⭐⭐ orchestration 이 그 값을 실제로 넘긴다 (안 넘기면 조용히 무효)', () => {
    expect(orchestration).toContain('hasExperienceNote,');
    expect(orchestration).toContain('hasExperience(normalizeExperience((payload as any).experience))');
  });
});

describe('③ 겪은 사람 말투는 항상 적용된다', () => {
  it('⭐⭐ 경험 메모가 있어도 lived-voice 를 함께 쓴다 (예전엔 else 분기에만 있었다)', () => {
    const block = orchestration.slice(
      orchestration.indexOf('const expInput = normalizeExperience'),
      orchestration.indexOf("} catch (expErr: any) {"),
    );
    const guardIdx = block.indexOf('NO_EXPERIENCE_GUARD');
    const livedIdx = block.indexOf('const livedSignals = extractLivedSignals');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(livedIdx).toBeGreaterThan(-1);
    // 가드는 else 안에, lived-voice 는 그 바깥에 있어야 한다
    expect(livedIdx).toBeGreaterThan(guardIdx);
    expect(block).toContain('겪은 사람의 말투는 어떤 경우에도 넣는다');
  });

  it('⭐⭐ 문체 규칙은 재료 유무와 무관하게 항상 붙는다', () => {
    expect(orchestration).toContain('scopedSectionBlock += HUMAN_VOICE_RULES;');
  });
});

describe('④ 문체 규칙 — 리서치 결과를 담았다', () => {
  it('⭐⭐ 기계 글과 사람 글을 가르는 장치를 지시한다', () => {
    expect(HUMAN_VOICE_RULES).toContain('순서를 매기세요');
    expect(HUMAN_VOICE_RULES).toContain('조건을 나누세요');
    expect(HUMAN_VOICE_RULES).toContain('안 해도 되는 경우를 정확히 한 번');
    expect(HUMAN_VOICE_RULES).toContain('모르는 건 모른다고 하세요');
  });

  it('⭐⭐ 3항목 나열 강박을 끊는다 (LLM 의 rule of three 과용)', () => {
    expect(HUMAN_VOICE_RULES).toContain('항목 수는 내용이 정합니다');
    expect(HUMAN_VOICE_RULES).toContain('억지로 3개를 맞추지 마세요');
  });

  it('⭐ AI 문체 지문은 금지가 아니라 빈도 상한으로 건다', () => {
    // 전면 금지는 글을 어색하게 만든다 — 출처 가이드 자신이 단서를 단다
    expect(HUMAN_VOICE_RULES).toContain('3회 이하');
  });

  it('⭐⭐ 숫자를 지어내지 말라고 못 박는다', () => {
    expect(HUMAN_VOICE_RULES).toContain('주어진 자료에 있는 것만');
  });

  it('⭐⭐ 목적이 탐지기 회피가 아님을 문서로 남긴다', () => {
    const src = read('src/core/final/lived-voice.ts');
    // 탐지기는 패러프레이즈 후 17%, 비원어민 오판 61% — 회피를 목표로 팔면 안 된다
    expect(src).toContain('AI 탐지기 회피가 아니다');
  });
});

describe('⑤ 개인정보처리방침 — 애드센스가 문구까지 지정한 고지', () => {
  it('⭐⭐ 제3자 쿠키 고지가 들어 있다', () => {
    expect(essentialPages).toContain('제3자 공급업체(Google 포함)는 쿠키를 사용하여');
  });

  it('⭐⭐ 맞춤광고 옵트아웃 안내가 들어 있다', () => {
    expect(essentialPages).toContain('https://www.google.com/settings/ads');
    expect(essentialPages).toContain('aboutads.info');
  });

  it('⭐⭐ CMP 없이 "동의를 받습니다"라고 단정하지 않는다 (그 자체가 허위 고지다)', () => {
    expect(essentialPages).not.toContain('TCF v2.3(투명성 및 동의 프레임워크)에 따라 개인정보 수집 전 명시적 동의를 받습니다');
    expect(essentialPages).toContain('동의 관리 도구(CMP)를 별도로 설치');
  });
});
