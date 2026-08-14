/**
 * card-image — 카드뉴스에 실제 생성 이미지를 붙인다.
 *
 * ## 두 가지 모드를 왜 다 두는가
 * - backdrop : AI 는 배경만 그리고 글자는 HTML 이 얹는다.
 *              숫자·날짜가 절대 안 틀리고, 배경 한 장으로 인스타(4:5)·카카오(1:1) 를 함께 쓴다.
 * - full     : 카드 한 장을 통째로 AI 가 그린다. 사장님 요청 — 직접 비교해 보고 고르시라고 남긴다.
 *              글자 렌더링이 되는 엔진(덕테이프·dropshot)에서만 의미가 있고,
 *              "8월 31일" 이 "8월 3l일" 로 나와도 그럴듯해 보이므로 반드시 눈으로 검수해야 한다.
 *
 * ## 톤이 흔들리지 않게 하는 법
 * 캐러셀은 7장이 한 벌로 읽힌다. 장마다 프롬프트를 따로 지으면 배경색·질감이 제각각이 된다.
 * 그래서 키워드에서 "화면 톤" 한 줄을 먼저 뽑아 모든 장에 같은 문장을 넣는다.
 */
import type { CardItem } from './card-plan';

export type CardImageMode = 'none' | 'backdrop' | 'full';

/** UI 드롭다운에 그대로 쓰는 목록. value 는 imageDispatcher 의 엔진명과 같아야 한다. */
export const CARD_IMAGE_ENGINES: Array<{ value: string; label: string; note: string; textCapable: boolean }> = [
  { value: 'gptimage2', label: 'GPT 이미지 2 (덕테이프)', note: '글자 렌더링 가장 좋음 · 장당 과금', textCapable: true },
  { value: 'dropshot-nanobanana-pro', label: 'dropshot 나노바나나 프로 무제한', note: '비용 0 · 장당 30~60초 · 보드 무제한 토글 필요', textCapable: true },
  { value: 'nanobanana2', label: '나노바나나2', note: 'Gemini 3.1 Flash · 빠름 · 장당 과금', textCapable: false },
  { value: 'nanobananapro', label: '나노바나나 프로', note: 'Gemini 3 Pro · 품질 최상 · 비용 높음', textCapable: false },
  { value: 'gptimage1', label: 'GPT 이미지 1', note: '구형 · 장당 과금', textCapable: false },
  { value: 'none', label: '이미지 없이 (그라데이션)', note: '비용 0 · 즉시 · 지금까지 쓰던 방식', textCapable: false },
];

const TEXT_CAPABLE = new Set(CARD_IMAGE_ENGINES.filter((e) => e.textCapable).map((e) => e.value));

/** 기본값 — 사장님 지정(2026-08-14). 글자 렌더링이 되는 엔진이라 두 모드 다 쓸 수 있다. */
export const DEFAULT_CARD_ENGINE = 'gptimage2';

export function normalizeCardImageMode(raw: unknown): CardImageMode {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'full') return 'full';
  if (v === 'none') return 'none';
  return 'backdrop';
}

/**
 * full 모드는 글자를 그릴 수 있는 엔진에서만 의미가 있다. 아니면 backdrop 으로 내린다.
 *
 * "이미지 없음"을 가장 먼저 본다 — 순서를 바꾸면 engine='none' + mode='full' 이
 * backdrop 으로 빠져서 만들지 말라고 한 이미지를 만든다(테스트가 잡은 실제 버그).
 */
export function resolveCardImageMode(mode: CardImageMode, engine: string): CardImageMode {
  if (mode === 'none') return 'none';
  if (engine === 'none' || engine === 'skip') return 'none';
  if (mode === 'full' && !TEXT_CAPABLE.has(engine)) return 'backdrop';
  return mode;
}

/**
 * 카드 종류별 화면 구성.
 * safeArea 는 "글자가 올라갈 자리" — 그 자리를 비우라고 이미지 쪽에 미리 알려야
 * 배경 위에 글자를 얹었을 때 얼굴이나 핵심 사물이 가려지지 않는다.
 */
const KIND_SHOT: Record<CardItem['kind'], { shot: string; mood: string }> = {
  hook: {
    shot: 'a real person in their 40s-50s pausing with a worried, questioning expression, upper body, shot slightly off-center to the right',
    mood: 'tense but not alarming, the moment right before someone realizes something about money',
  },
  body: {
    shot: 'a clean desk scene with documents, a calculator and a laptop, shot from above at a slight angle, no hands covering the center',
    mood: 'calm, factual, like a quiet weekday afternoon',
  },
  save: {
    shot: 'a hand holding a phone showing a blank checklist screen, or a notebook with a pen resting on it',
    mood: 'organized, reassuring, something worth keeping',
  },
  cta: {
    shot: 'a person in their 40s-50s looking relieved while checking a phone, warm indoor light',
    mood: 'resolved, a problem just handled',
  },
};

/**
 * 키워드에서 캐러셀 전체가 공유할 톤 한 줄을 만든다.
 * 무작위가 아니라 키워드 글자에서 뽑는다 — 같은 글로 다시 만들면 같은 톤이 나와야
 * 재생성 결과가 앞 장과 어울린다.
 */
export function buildVisualTheme(keyword: string): string {
  const PALETTES = [
    'deep navy and warm gold accents',
    'cool slate blue with soft amber highlights',
    'charcoal and muted teal with cream light',
    'midnight indigo with warm copper light',
  ];
  let sum = 0;
  const k = String(keyword || '');
  for (let i = 0; i < k.length; i++) sum += k.charCodeAt(i);
  const palette = PALETTES[sum % PALETTES.length];
  return `editorial documentary photograph, Korean setting, ${palette}, soft directional light, shallow depth of field, muted and premium, absolutely no cartoon or 3D render look`;
}

/**
 * 배경 이미지 프롬프트 (모드: backdrop).
 * 글자는 HTML 이 얹으므로 이미지에는 글자가 없어야 한다 —
 * 그 강제는 imageDispatcher 의 enforceNoTextPrompt 가 맡는다(여기서 중복으로 넣지 않는다).
 */
export function buildBackdropPrompt(card: CardItem, keyword: string): string {
  const kind = KIND_SHOT[card.kind] || KIND_SHOT.body;
  return [
    buildVisualTheme(keyword),
    kind.shot + '.',
    `Mood: ${kind.mood}.`,
    // 글자가 올라갈 자리를 비워 둬야 배경 위에 얹었을 때 얼굴·핵심 사물이 안 가려진다
    'Composition: leave the upper-left third and the bottom strip visually calm and uncluttered — plain wall, blurred background or empty surface — so that a text overlay can sit there without covering the subject.',
    'The subject must stay in the center or right side of the frame.',
  ].join('\n');
}

/**
 * 카드 한 장을 통째로 그리는 프롬프트 (모드: full).
 * 넣어야 할 글자를 따옴표로 정확히 박아 준다. 그래도 틀릴 수 있으므로
 * UI 는 반드시 미리보기와 "이미지 다시" 버튼을 함께 준다.
 */
export function buildFullCardPrompt(
  card: CardItem,
  keyword: string,
  opts: { index: number; total: number; ratio: '4:5' | '1:1' },
): string {
  const kind = KIND_SHOT[card.kind] || KIND_SHOT.body;
  return [
    `A Korean social media carousel card, aspect ratio ${opts.ratio}, slide ${opts.index + 1} of ${opts.total}.`,
    buildVisualTheme(keyword),
    `Background scene: ${kind.shot}. Mood: ${kind.mood}.`,
    'A dark translucent gradient covers the upper half so white text stays readable.',
    '',
    'Render EXACTLY this Korean text, spelled character for character, with no additions and no substitutions:',
    `  Headline (large, heavy weight, white): "${card.title}"`,
    `  Subtext (smaller, light gray, below the headline): "${card.body}"`,
    '',
    'Every digit and every date must match the given text exactly. Do not invent extra words, labels, logos or watermarks.',
    'Typography: modern Korean sans-serif, generous line spacing, left aligned, wide margins.',
  ].join('\n');
}

/** 캐러셀 안에서 이 카드가 이미지를 받을 자격이 있는지 (비용 절감용 축약 모드에 대비) */
export function shouldRenderImage(card: CardItem, mode: CardImageMode): boolean {
  return mode !== 'none' && !!card;
}
