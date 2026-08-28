// src/cta/cta-copy.ts
/**
 * CTA 문구 한 벌 — 버튼과 후킹을 **같은 자리에서** 만든다. (v3.8.570)
 *
 * ## 왜 만드나
 * 사장님 지적: "CTA 후킹이 여전히 제목이 붙는데, 연동시킬 사이트가 wetax면
 * 위택스 바로가기 이런식으로 해야되지 않니? 버튼생성이랑 후킹생성이랑 따로 노는 것 같은데."
 *
 * 실제로 따로 놀았다. generation.ts 한 곳(v3.8.569 기준 3513~3514)에서
 *
 *     buttonText = `🔗 ${catalogLink.name} 바로가기`   // 목적지를 말한다
 *     hookText   = `${keyword} 관련 공식 정보를 확인하세요.`  // 제목을 말한다
 *
 * 이렇게 **바로 옆줄에서 서로 다른 것을 말하고 있었다.** 발행된 글로 확인한 실물:
 *
 *   5310  훅 "오피스텔 이미 샀다면, 8·26 취득세 감면안 소급되나요? 관련 공식 사이트에서…"
 *         버튼 "🔗 위택스 바로가기"        ← 훅이 목적지를 안 알려준다
 *   5307  훅 "절차 관련 공식 정보를 확인하세요👇"   ← 긴 제목이 잘려 뜻 없는 조각이 됐다
 *   5295  훅 "2026년 12대 중과실 교통사고 형사합의금 적정 기준 (…) 관련 공식 정보를…"
 *
 * 제목을 훅에 넣으면 **길이도 통제가 안 되고**(잘리면 조각이 남는다) 독자가 이미 읽은
 * 말을 되풀이할 뿐 "왜 눌러야 하는지"를 못 준다.
 *
 * ## 규칙
 * 1. 훅에 글 제목·키워드를 넣지 않는다.
 * 2. 버튼과 훅은 **같은 목적지**를 말한다.
 * 3. 목적지 이름을 모르면 지어내지 않는다 — 무난한 문구로 내려간다.
 */
import { OFFICIAL_CATALOG } from './official-catalog';

export type CtaDocCopy = { buttonText: string; hookingMessage: string };

export type CtaCopyInput = {
  /** 목적지 주소 — 이름을 모를 때 여기서 유추한다 */
  url?: string;
  /** 목적지 이름('위택스'). 부르는 쪽이 알고 있으면 그게 우선이다 */
  siteName?: string;
  /** 거기서 할 일('취득세 환급 신청'). 없으면 '바로가기' 꼴로 나간다 */
  action?: string;
  /** PDF·HWP 같은 문서면 문서용 문구를 그대로 쓴다 (다운로드는 성격이 다르다) */
  doc?: CtaDocCopy | null;
};

export type CtaCopy = { buttonText: string; hookingMessage: string };

/** 주소에서 호스트만. 실패하면 빈 문자열 — 던지지 않는다 */
function hostOf(url: string): string {
  try {
    return new URL(String(url || '').trim()).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * 호스트 → 사이트 이름 색인.
 *
 * 카탈로그가 이미 이름(txt)을 들고 있으니 그걸 뒤집어 쓴다. 이름을 따로 적어 두면
 * 카탈로그가 늘 때마다 두 곳을 고쳐야 하고, 한 곳을 빠뜨리면 조용히 어긋난다.
 */
const HOST_TO_NAME: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const item of OFFICIAL_CATALOG) {
    const host = hostOf(item.url);
    // 먼저 등록된 이름을 이긴 것으로 둔다 — 카탈로그 앞쪽이 더 대표적인 표기다
    if (host && !map.has(host)) map.set(host, String(item.txt || '').trim());
  }
  return map;
})();

/**
 * 카탈로그에 없는데 CTA 로는 자주 나가는 곳.
 *
 * ⚠️ 여기 없는 호스트는 이름 없이 무난한 문구로 내려간다. 그게 지어내는 것보다 낫다 —
 *    "○○ 바로가기"의 ○○ 가 틀리면 독자를 엉뚱한 곳으로 부르는 셈이다.
 */
const EXTRA_HOST_NAMES: Record<string, string> = {
  'work24.go.kr': '고용24',
  'hometax.go.kr': '국세청 홈택스',
  'wetax.go.kr': '위택스',
  'fine.fss.or.kr': '금융감독원 파인',
  'minwon.molit.go.kr': '국토교통부 민원',
  'efine.go.kr': '교통민원24',
  'nhis.or.kr': '국민건강보험',
  'hira.or.kr': '건강보험심사평가원',
  'q-net.or.kr': '큐넷',
  'gov.kr': '정부24',
  'bokjiro.go.kr': '복지로',
  'nps.or.kr': '국민연금공단',
  'fss.or.kr': '금융감독원',
  'kca.go.kr': '한국소비자원',
  'law.go.kr': '국가법령정보센터',
  'iros.go.kr': '인터넷등기소',
  'scourt.go.kr': '대법원',
  'easylaw.go.kr': '찾기쉬운 생활법령정보',
};

/**
 * 주소를 보고 사이트 이름을 찾는다. 모르면 빈 문자열.
 *
 * `fine.fss.or.kr` 처럼 하위 도메인이면 상위 도메인으로 한 번 더 찾는다 —
 * 기관은 같은데 서비스만 다른 경우가 흔하다.
 */
export function siteNameFromUrl(url: string): string {
  const host = hostOf(url);
  if (!host) return '';
  if (EXTRA_HOST_NAMES[host]) return EXTRA_HOST_NAMES[host];
  if (HOST_TO_NAME.has(host)) return HOST_TO_NAME.get(host) || '';

  // 하위 도메인을 한 칸씩 벗겨 가며 찾는다 (etk.srail.kr → srail.kr)
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i += 1) {
    const parent = parts.slice(i).join('.');
    if (EXTRA_HOST_NAMES[parent]) return EXTRA_HOST_NAMES[parent];
    if (HOST_TO_NAME.has(parent)) return HOST_TO_NAME.get(parent) || '';
  }
  return '';
}

/**
 * 받침에 따라 은/는을 고른다.
 *
 * "취득세 조회은 위택스에서…" 처럼 조사가 틀리면 읽는 사람이 바로 알아챈다.
 * 한글 음절은 0xAC00 부터 28개 종성 단위로 배열돼 있어 나머지가 0이면 받침이 없다.
 * 마지막 글자가 한글이 아니면(영문·숫자) 판정이 애매하므로 조사 없이 쉼표로 끊는다.
 */
function withTopicParticle(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${word},`;
  return (code - 0xac00) % 28 === 0 ? `${word}는` : `${word}은`;
}

/** 앞뒤 군더더기와 이모지를 털어 낸다 — 버튼 이모지는 우리가 붙인다 */
function clean(text: string | undefined, max: number): string {
  return String(text || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * 버튼과 훅을 한 벌로 만든다.
 *
 * 이 함수가 유일한 창구다. 여기를 거치지 않고 문구를 조립하면 또 따로 놀게 된다.
 */
export function buildCtaCopy(input: CtaCopyInput): CtaCopy {
  // 문서(PDF·HWP)는 "가서 하는 것"이 아니라 "받는 것"이라 문구 성격이 다르다
  if (input.doc && input.doc.buttonText && input.doc.hookingMessage) {
    return { buttonText: input.doc.buttonText, hookingMessage: input.doc.hookingMessage };
  }

  const site = clean(input.siteName, 24) || siteNameFromUrl(input.url || '');
  const action = clean(input.action, 20);

  if (site && action) {
    return {
      buttonText: `${site}에서 ${action}`.slice(0, 30),
      hookingMessage: `${withTopicParticle(action)} ${site}에서 바로 하실 수 있습니다.`,
    };
  }
  if (site) {
    return {
      buttonText: `🔗 ${site} 바로가기`,
      hookingMessage: `${site} 공식 사이트에서 바로 확인하세요.`,
    };
  }
  if (action) {
    return {
      buttonText: `🚀 ${action} 바로가기`.slice(0, 30),
      hookingMessage: `${action}, 공식 사이트에서 바로 진행하세요.`,
    };
  }
  return {
    buttonText: '🔗 공식 사이트 바로가기',
    hookingMessage: '공식 사이트에서 바로 확인하세요.',
  };
}

/**
 * 훅이 글 제목을 되풀이하고 있는가.
 *
 * 12개나 되는 CTA 경로를 전부 손대는 대신, **내보내기 직전**에 한 번 걸러 낸다.
 * 이게 그물이다 — 새 경로가 생겨도 제목 훅은 못 빠져나간다.
 */
export function hookEchoesTitle(hook: string, title: string): boolean {
  const h = clean(hook, 200);
  const t = clean(title, 200);
  if (!h || !t) return false;

  // 제목을 통째로 품고 있다
  if (t.length >= 8 && h.includes(t)) return true;

  // 제목 앞부분(문장부호 앞까지)을 그대로 옮겨 적었다 — 긴 제목이 잘려 조각으로 남는 경우
  const head = t.split(/[?!.,·:—\-(]/)[0]?.trim() || '';
  if (head.length >= 10 && h.includes(head)) return true;

  return false;
}
