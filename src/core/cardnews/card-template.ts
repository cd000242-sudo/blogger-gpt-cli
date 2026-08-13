/**
 * card-template — 카드 한 장을 자기완결 HTML 로 그린다. 숨김 창이 이걸 캡처해 PNG 를 만든다.
 *
 * ## 왜 AI 이미지가 아니라 HTML 캡처인가
 * 카드뉴스는 글자가 전부다. AI 이미지는 한글이 깨지기 일쑤고 장당 비용이 든다.
 * HTML 캡처는 비용 0, 글자 선명, 결과가 항상 같다(재현 가능).
 *
 * ## 외부 리소스 금지
 * 폰트·이미지를 URL 로 부르면 오프라인이거나 응답이 느릴 때 캡처 결과가 달라진다.
 * 시스템 한글 폰트 스택만 쓴다.
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

export function renderCardHtml(card: CardItem, options: RenderOptions): string {
  const format = CARD_FORMATS[options.format];
  const skin = SKINS[card.kind] || SKINS.body;
  const isHook = card.kind === 'hook';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${format.width}px; height:${format.height}px; overflow:hidden; }
  body {
    background:${skin.bg};
    color:#f8fafc;
    font-family:'Pretendard Variable','Pretendard','Noto Sans KR','Malgun Gothic',sans-serif;
    display:flex; flex-direction:column; justify-content:space-between;
    padding:${Math.round(format.height * 0.07)}px ${Math.round(format.width * 0.08)}px;
    word-break:keep-all; overflow-wrap:break-word;
  }
  .kicker { font-size:30px; font-weight:700; color:${skin.accent}; letter-spacing:0.02em; }
  .title {
    font-size:${isHook ? 76 : 64}px; font-weight:900; line-height:1.28;
    margin-top:28px; white-space:pre-wrap;
  }
  .body {
    font-size:40px; font-weight:500; line-height:1.55; color:#cbd5e1;
    margin-top:36px; white-space:pre-wrap;
  }
  .footer { display:flex; align-items:center; justify-content:space-between; }
  .pager { font-size:30px; font-weight:700; color:#94a3b8; letter-spacing:0.08em; }
  .bar { height:10px; border-radius:5px; background:rgba(148,163,184,0.25); flex:1; margin-right:28px; overflow:hidden; }
  .bar > div { height:100%; width:${Math.round(((options.index + 1) / Math.max(options.total, 1)) * 100)}%; background:${skin.accent}; }
  .swipe { font-size:30px; font-weight:700; color:${skin.accent}; }
  </style></head><body>
    <div>
      <div class="kicker">${escapeHtml(skin.label || options.keyword)}</div>
      <div class="title">${escapeHtml(card.title)}</div>
      <div class="body">${escapeHtml(card.body)}</div>
    </div>
    <div class="footer">
      <div class="bar"><div></div></div>
      <div class="pager">${options.index + 1} / ${options.total}</div>
      ${options.index + 1 < options.total ? '<div class="swipe">밀어서 계속 →</div>' : ''}
    </div>
  </body></html>`;
}
