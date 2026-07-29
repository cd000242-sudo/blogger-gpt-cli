/**
 * dropshot(리더스 나노바나나 프로) 본문 이미지 프롬프트 회귀 테스트 (v3.8.385)
 *
 * 사고(2026-07-29, tjdgus24280.blogspot.com/2026/07/cdr.html):
 *   치매 보험금 글의 본문 이미지 8장이
 *     ① 전부 동일한 한국 여성 인물 사진이고
 *     ② 뭉개진 한글 글자가 그림 안에 잔뜩 박혀 나왔다(사용자는 "중국어"로 인식).
 *   본문 텍스트에는 한자가 0개였으므로 문제는 전적으로 이미지였다.
 *
 * 원인 두 가지가 겹쳤다:
 *   (a) dropshot 이 inferImagePrompt(제목 → 시각 장면 묘사) 대상에서 제외돼 있어
 *       프롬프트가 H2 제목 문장 그대로였다. 장면 지시가 없으니 모델이 기본값
 *       인물 사진으로 채웠다 → 8장이 전부 같은 사람.
 *   (b) 텍스트 지시 분기가 (텍스트미포함 / 썸네일 / 그 외) 3갈래인데
 *       본문 이미지는 '그 외'로 빠져 아무 지시도 못 받았다.
 *       코드 주석 자체가 "dropshot 은 지시가 없으면 제목을 임의로 그려 넣는 경향"이라고
 *       적어두고도 본문 경로에는 금지를 안 걸었다.
 */
import * as fs from 'fs';
import * as path from 'path';

const dispatcherSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'core', 'imageDispatcher.ts'), 'utf8');
const inferenceSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'core', 'imagePromptInference.ts'), 'utf8');

describe('원인 (a) — dropshot 도 장면 추론을 거친다', () => {
  it('추론 skip 목록에 dropshot 이 없다', () => {
    const m = dispatcherSrc.match(/const skipInference\s*=\s*([\s\S]*?);/);
    expect(m).not.toBeNull();
    const list = m![1];
    expect(list).not.toContain('dropshot');
  });

  it('한국어 OK 엔진(나노바나나 계열)은 여전히 skip 한다 — 불필요한 LLM 호출 방지', () => {
    const m = dispatcherSrc.match(/const skipInference\s*=\s*([\s\S]*?);/);
    const list = m![1];
    for (const e of ['nanobanana', 'nanobanana2', 'nanobananapro', 'gptimage2', 'flow']) {
      expect(list).toContain(e);
    }
  });

  it('추론을 건너뛴 이유가 "언어"였음을 주석이 남기고 있다 — 재발 시 판단 근거', () => {
    // 언어 변환과 장면 추론을 혼동한 것이 원인이었다
    expect(dispatcherSrc).toContain('장면 추론');
  });
});

describe('원인 (b) — 본문 이미지는 텍스트를 금지한다', () => {
  it('본문 이미지(isThumbnail=false)에 enforceNoTextPrompt 가 걸린다', () => {
    expect(dispatcherSrc).toContain('userWantsNoText || !isThumbnail');
  });

  it('썸네일 오버레이 경로는 유지된다 — 썸네일에는 제목이 필요하다', () => {
    expect(dispatcherSrc).toContain('TEXT OVERLAY (MANDATORY)');
    expect(dispatcherSrc).toContain('isThumbnail && prompt');
  });

  it('세 갈래 분기에서 본문이 "지시 없음"으로 빠지지 않는다', () => {
    // dropshot case 블록 안에서 dropshotPrompt 가 무조건 한 번은 가공되어야 한다
    const start = dispatcherSrc.indexOf("case 'dropshot': {");
    const end = dispatcherSrc.indexOf('makeDropshotImage(', start);
    expect(start).toBeGreaterThan(-1);
    const block = dispatcherSrc.slice(start, end);
    expect(block).toContain('enforceNoTextPrompt');
    // else 로 아무 처리 없이 떨어지는 경로가 없어야 한다
    expect(block).not.toMatch(/}\s*else\s*{\s*}/);
  });
});

describe('추론 프롬프트가 본문 이미지에 맞는 지시를 준다', () => {
  it('섹션 이미지 지시에 text-free 가 명시돼 있다', () => {
    expect(inferenceSrc).toContain('Pure visual — text-free');
  });

  it('다양한 구도를 요구한다 — 8장이 같은 사진이 되지 않도록', () => {
    expect(inferenceSrc).toContain('Diverse visual approaches');
  });

  it('제목을 영어 장면 묘사로 바꾸는 것이 목적이라고 선언돼 있다', () => {
    expect(inferenceSrc).toContain('Convert a blog heading into an optimal English image generation prompt');
  });
});

describe('dropshot 비용 정책은 그대로 — 유료 API 폴백 차단 유지', () => {
  it('dropshot 선택 시 폴백 체인이 비어 있다', () => {
    // 사용자가 "무제한(비용 0)" 의도로 고른 엔진이라 유료 API 를 대신 소진하면 안 된다
    expect(dispatcherSrc).toContain(
      "if (chosen === 'dropshot' || chosen === 'dropshot-nanobanana-pro') return [];");
  });
});
