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
export const EXTRA_HOST_NAMES: Record<string, string> = {
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

  /**
   * v3.8.619 — 금융·정책 글에서 매번 폴백으로 떨어지던 곳들.
   *
   * 실측: 발행글의 CTA 버튼이 "🔗 공식 사이트 바로가기" 로 나갔다. 목적지가 어디인지
   * 한 글자도 말하지 않는 문구다. 원인은 이 사전에 그 기관이 없어서였다
   * (fss.or.kr 은 있어서 "🔗 금융감독원 바로가기" 로 제대로 나온다).
   *
   * 이름은 전부 **해당 사이트에 직접 접속해 <title> 로 확인**했다(2026-09-02).
   * 그러다 두 곳이 개편된 것을 알았다 — 추측했으면 틀린 이름을 내보낼 뻔했다:
   *   · kostat.go.kr 은 통계청이 아니라 **국가데이터처**
   *   · me.go.kr 은 환경부가 아니라 **기후에너지환경부**
   */
  'fsc.go.kr': '금융위원회',
  'mpm.go.kr': '인사혁신처',
  // KDI 본원(kdi.re.kr)이 아니라 경제교육·정보센터가 실제 자리다 — 응답 확인 완료
  'eiec.kdi.re.kr': 'KDI 경제교육·정보센터',
  'bok.or.kr': '한국은행',
  'kostat.go.kr': '국가데이터처',
  'kosis.kr': '국가통계포털',
  'moel.go.kr': '고용노동부',
  'nts.go.kr': '국세청',
  'hf.go.kr': '한국주택금융공사',
  'lh.or.kr': '한국토지주택공사',
  'mois.go.kr': '행정안전부',
  'mfds.go.kr': '식품의약품안전처',
  'data.go.kr': '공공데이터포털',
  'me.go.kr': '기후에너지환경부',
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

/**
 * 받침에 따라 이/가를 고른다.
 *
 * 실측에서 "정부기관가 안내하는 원문입니다" 가 나왔다. 조사 하나가 틀리면
 * 읽는 사람은 그 문장을 쓴 사람이 사람이 아니라는 걸 바로 안다.
 */
function withSubjectParticle(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${word},`;
  return (code - 0xac00) % 28 === 0 ? `${word}가` : `${word}이`;
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
  /**
   * v3.8.586 — "확인하세요"를 훅에서 뺀다.
   *
   * ## 왜 (발행글 5429 실측)
   * 섹션 3 한복판에 이 문장이 뜬금없이 박혀 있었다:
   *   "워크넷 공식 사이트에서 바로 확인하세요."
   * 독자에겐 문맥 없는 명령문이고, 실속 게이트에는 **회피(deferral)** 로 잡힌다.
   * DEFERRAL_PATTERNS 의 `공식\s*사이트[^.]{0,25}확인` 에 정확히 걸린다.
   *
   * v3.8.584 에서 CTA 의 `microcopy` 는 고쳤는데 **`hookingMessage` 를 놓쳤다.**
   * 같은 병이 필드만 바꿔 남아 있었다 — 한쪽만 고치면 이렇게 된다.
   *
   * ## 어떻게
   * "네가 가서 확인해라"가 아니라 **거기 무엇이 있는지**를 말한다.
   * 훅은 버튼 위 한 줄이므로, 링크의 값을 알려 주는 편이 클릭 이유도 분명해진다.
   */
  if (site) {
    return {
      buttonText: `🔗 ${site} 바로가기`,
      hookingMessage: `${site}에 원문 안내가 있습니다.`,
    };
  }
  if (action) {
    return {
      buttonText: `🚀 ${action} 바로가기`.slice(0, 30),
      hookingMessage: `${withTopicParticle(action)} 아래에서 이어서 하실 수 있습니다.`,
    };
  }
  /**
   * v3.8.619 — 이름을 몰라도 **도메인은 성격을 말해 준다.**
   *
   * 실측 사고: 버튼이 "🔗 공식 사이트 바로가기", 훅이 "운영 기관의 원문 안내로 이어집니다"
   * 로 나갔다. 둘 다 목적지에 대해 아무것도 알려주지 않아 누를 이유가 생기지 않는다.
   *
   * 기관 이름은 지어내면 안 되지만(엉뚱한 곳으로 부르는 셈이다), `.go.kr` 이 정부기관이고
   * `.or.kr` 이 공공기관이라는 건 **지어낸 것이 아니라 주소가 가진 사실**이다.
   * 이름 대신 그 사실만 써도 "공식 사이트"보다는 클릭할 이유가 분명해진다.
   */
  const kind = officialKindOf(input.url || '');
  if (kind) {
    return {
      buttonText: `🔗 ${kind} 원문 확인하기`,
      hookingMessage: `${withSubjectParticle(kind)} 안내하는 원문입니다.`,
    };
  }

  return {
    buttonText: '🔗 공식 사이트 바로가기',
    hookingMessage: '운영 기관의 원문 안내로 이어집니다.',
  };
}

/**
 * 주소만 보고 알 수 있는 기관 성격.
 *
 * 이름은 모르지만 도메인 규칙은 확실하다 — 한국 인터넷주소자원 관리 규정상
 * `go.kr` 은 정부기관, `or.kr` 은 비영리·공공기관, `re.kr` 은 연구기관에만 준다.
 * 확실하지 않은 것(`co.kr`·일반 도메인)에는 아무 말도 붙이지 않는다.
 */
export function officialKindOf(url: string): string {
  const host = hostOf(url);
  if (!host) return '';
  if (/\.go\.kr$/.test(host)) return '정부기관';
  if (/\.or\.kr$/.test(host)) return '공공기관';
  if (/\.re\.kr$/.test(host)) return '연구기관';
  return '';
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
