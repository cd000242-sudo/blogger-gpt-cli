/**
 * card-template — 카드 한 장을 자기완결 HTML 로 그린다. 숨김 창이 이걸 캡처해 PNG 를 만든다.
 *
 * ## 글자는 왜 끝까지 HTML 이 그리는가
 * 카드뉴스는 숫자가 생명이다. 이미지 모델은 "8월 31일"을 "8월 3l일"로 그려 놓고도
 * 그럴듯해 보여서 검수 전엔 안 걸린다. 사장님 사이트는 세금·보험 기준을 다루니
 * 그건 곧 사실 오류다. 그래서 배경만 AI 에 맡기고 글자는 여기서 얹는다.
 * (카드 전체를 AI 가 그리는 모드는 따로 있다 — card-image.ts 의 full 모드)
 *
 * ## 외부 리소스 금지
 * 폰트를 URL 로 부르면 오프라인이거나 응답이 느릴 때 캡처 결과가 달라진다.
 * 시스템 한글 폰트 스택만 쓴다. 배경 이미지는 data URI 로 받아 넣는다.
 */
import type { CardItem } from './card-plan';

export interface CardFormat {
  width: number;
  height: number;
  /** 내보내기 폴더 이름 */
  dir: string;
}

/** 리서치 반영: 인스타 4:5(피드 점유 최대), 카카오채널 1:1 */
export const CARD_FORMATS: Record<'insta45' | 'kakao11', CardFormat> = {
  insta45: { width: 1080, height: 1350, dir: 'instagram' },
  kakao11: { width: 1080, height: 1080, dir: 'kakao' },
};

export interface RenderOptions {
  format: keyof typeof CARD_FORMATS;
  /** 0부터 시작하는 카드 순번 */
  index: number;
  total: number;
  keyword: string;
  /** 배경 이미지 data URI. 없으면 지금까지 쓰던 그라데이션으로 돌아간다. */
  backdrop?: string;
}

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 카드 종류별 배경 — 훅·저장 카드는 눈에 띄게, 본문은 차분하게 */
const SKINS: Record<CardItem['kind'], { bg: string; accent: string; label: string }> = {
  hook: { bg: 'linear-gradient(150deg,#0f172a 0%,#1e293b 55%,#312e81 100%)', accent: '#a5b4fc', label: '' },
  body: { bg: 'linear-gradient(150deg,#0f172a 0%,#111827 100%)', accent: '#67e8f9', label: '' },
  save: { bg: 'linear-gradient(150deg,#312e81 0%,#1e293b 60%,#0f172a 100%)', accent: '#fbbf24', label: '📌 저장해 두세요' },
  /** 클릭 유도 — 인스타는 캡션 링크가 눌리지 않으므로 프로필 링크로 보낸다 */
  cta: { bg: 'linear-gradient(150deg,#052e16 0%,#065f46 55%,#0f172a 100%)', accent: '#6ee7b7', label: '👆 프로필 링크에서 전체 글' },
};

/**
 * 카드 전체를 AI 가 그린 경우(full 모드) — 글자는 이미 그림 안에 있다.
 * 여기서 또 얹으면 같은 문장이 두 번 나오고, 어둠 막까지 깔면 AI 가 그린 글자가 묻힌다.
 * 그래서 이 함수는 이미지만 규격에 맞춰 놓는다. 글자도 막도 없다.
 *
 * 규격을 맞추는 일만 남기는 이유: 모델이 내주는 크기가 1080×1350 이 아니라
 * 그대로 저장하면 인스타 업로드에서 다시 잘린다.
 */
export function renderImageOnlyHtml(dataUrl: string, format: CardFormat): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; }
  html,body { width:${format.width}px; height:${format.height}px; overflow:hidden; background:#0b1220; }
  img { width:100%; height:100%; object-fit:cover; display:block; }
  </style></head><body><img src="${dataUrl}"></body></html>`;
}

export function renderCardHtml(card: CardItem, options: RenderOptions): string {
  const format = CARD_FORMATS[options.format];
  const skin = SKINS[card.kind] || SKINS.body;
  const isHook = card.kind === 'hook';
  const backdrop = String(options.backdrop || '').trim();

  /**
   * 배경 사진 위에 흰 글씨를 그냥 얹으면 밝은 부분에서 글자가 사라진다.
   * 그래서 검은 막(스크림)을 깔되, 전체를 고르게 덮으면 사진을 넣은 의미가 없다.
   * 글자가 앉는 위쪽 30% 와 진행 막대가 있는 아래쪽만 짙게 하고
   * 가운데는 얇게 덮어 사진이 그대로 보이게 한다.
   */
  const scrim = 'linear-gradient(180deg,'
    + 'rgba(8,12,20,0.90) 0%,'
    + 'rgba(8,12,20,0.80) 26%,'
    + 'rgba(8,12,20,0.34) 46%,'
    + 'rgba(8,12,20,0.30) 68%,'
    + 'rgba(8,12,20,0.86) 100%)';
  const layers = backdrop
    ? `${scrim}, url("${backdrop}") center/cover no-repeat`
    : skin.bg;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${format.width}px; height:${format.height}px; overflow:hidden; }
  body {
    background:${layers};
    color:#f8fafc;
    font-family:'Pretendard Variable','Pretendard','Noto Sans KR','Malgun Gothic',sans-serif;
    display:flex; flex-direction:column; justify-content:space-between;
    padding:${Math.round(format.height * 0.07)}px ${Math.round(format.width * 0.08)}px;
    word-break:keep-all; overflow-wrap:break-word;
  }
  /* 사진 위 흰 글씨는 스크림만으로는 덜 또렷하다. 얇은 그림자를 깔아 획을 살린다. */
  ${backdrop ? '.title,.body,.kicker { text-shadow: 0 2px 18px rgba(0,0,0,0.55); }' : ''}
  .kicker { font-size:30px; font-weight:700; color:${skin.accent}; letter-spacing:0.02em; }
  .title {
    font-size:${isHook ? 76 : 64}px; font-weight:900; line-height:1.28;
    margin-top:28px; white-space:pre-wrap;
  }
  .body {
    font-size:40px; font-weight:500; line-height:1.55; color:#e2e8f0;
    margin-top:36px; white-space:pre-wrap;
  }
  /* 저장 카드는 한 눈에 "챙겨둘 것"으로 보여야 저장수가 오른다 — 저장수가 배포를 결정한다 */
  .body.keep {
    border-left:8px solid ${skin.accent}; padding-left:26px;
    background:rgba(255,255,255,0.06); border-radius:0 14px 14px 0;
    padding-top:22px; padding-bottom:22px; padding-right:22px;
  }
  /* gap 이 없어 "7"과 "밀어서"가 붙어 보였다 */
  .footer { display:flex; align-items:center; justify-content:space-between; gap:26px; }
  .pager { font-size:30px; font-weight:700; color:#cbd5e1; letter-spacing:0.08em; white-space:nowrap; }
  .bar { height:10px; border-radius:5px; background:rgba(148,163,184,0.28); flex:1; overflow:hidden; }
  .bar > div { height:100%; width:${Math.round(((options.index + 1) / Math.max(options.total, 1)) * 100)}%; background:${skin.accent}; }
  .swipe { font-size:30px; font-weight:700; color:${skin.accent}; white-space:nowrap; }
  </style></head><body>
    <div>
      <div class="kicker">${escapeHtml(skin.label || options.keyword)}</div>
      <div class="title">${escapeHtml(card.title)}</div>
      <div class="body${card.kind === 'save' ? ' keep' : ''}">${escapeHtml(card.body)}</div>
    </div>
    <div class="footer">
      <div class="bar"><div></div></div>
      <div class="pager">${options.index + 1} / ${options.total}</div>
      ${options.index + 1 < options.total ? '<div class="swipe">밀어서 계속 →</div>' : ''}
    </div>
  </body></html>`;
}
