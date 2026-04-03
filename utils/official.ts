// utils/official.ts
// 네이버 오픈API(웹문서 검색)로 공식 사이트 후보를 찾고, 공식성 점수로 랭킹해 1개를 반환합니다.
// - .env: NAVER_API_KEY="YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" 형태(콜론 구분) 권장
// - 또는 인자로 clientId, clientSecret을 각각 넘겨도 됩니다.

type NaverWebDoc = {
  title: string;      // HTML 태그 포함됨
  link: string;
  description: string;
};

type NaverWebSearchResp = {
  items?: NaverWebDoc[];
};

const OFFICIAL_HINT_DOMAINS: Record<string, string> = {
  // 자주 쓰는 것들 힌트 (키워드 포함 시 강한 가산점/직접 지정)
  // 예: SRT 예매/좌석변경 → etk.srail.kr
  'srt': 'https://etk.srail.kr',
  'srt예매': 'https://etk.srail.kr',
  '좌석변경': 'https://etk.srail.kr',
  '코레일': 'https://etk.srail.kr',  // ※ 코레일 예매는 letskorail.com 이지만,
                                     //   SRT/좌석변경 맥락에서는 SRT를 우선 힌트로 둡니다.
  'ktx': 'https://etk.srail.kr',
};

const OFFICIAL_DOMAIN_BONUS: Array<[RegExp, number]> = [
  [/\.go\.kr$/i, 8],       // 정부
  [/\.or\.kr$/i, 4],       // 공익/기관
  [/\.re\.kr$/i, 3],
  [/\.kr$/i, 1],
  [/\.gov$/i, 6],
  [/\.org$/i, 2],
];

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function scoreByDomain(host: string): number {
  let s = 0;
  for (const [rx, bonus] of OFFICIAL_DOMAIN_BONUS) {
    if (rx.test(host)) s += bonus;
  }
  // 철도/예매 계열 가산
  if (/srail\.kr$/i.test(host)) s += 6;
  if (/letskorail\.com$/i.test(host)) s += 5;
  if (/korea|gov|go|official/i.test(host)) s += 2;
  return s;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function fuzzyIncludes(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function bestHintUrl(query: string, hints?: string[]): string | null {
  const hay = query.toLowerCase();
  for (const k of Object.keys(OFFICIAL_HINT_DOMAINS)) {
    if (hay.includes(k)) return OFFICIAL_HINT_DOMAINS[k];
  }
  if (hints) {
    for (const h of hints) {
      const key = h.toLowerCase();
      for (const k of Object.keys(OFFICIAL_HINT_DOMAINS)) {
        if (key.includes(k)) return OFFICIAL_HINT_DOMAINS[k];
      }
    }
  }
  return null;
}

/**
 * NAVER_API_KEY="clientId:clientSecret" 또는 clientId/secret 인자 제공
 */
export async function searchOfficialViaNaver(
  query: string,
  keyOrClientId?: string,           // "id:secret" 지원
  clientSecret?: string,
  opts?: { hints?: string[]; timeoutMs?: number }
): Promise<{ title: string; link: string } | null> {
  // 0) 힌트로 바로 확정할 수 있으면 즉시 반환
  const hinted = bestHintUrl(query, opts?.hints);
  if (hinted) {
    return { title: '공식 사이트', link: hinted };
  }

  // 1) 자격 확인
  if (!keyOrClientId) return null;

  let clientId = keyOrClientId;
  let secret = clientSecret || '';

  // NAVER_API_KEY="id:secret" 형태 지원
  if (!clientSecret && keyOrClientId.includes(':')) {
    const [id, sec] = keyOrClientId.split(':', 2);
    clientId = id;
    secret = sec || '';
  }

  if (!clientId || !secret) return null;

  // 2) 호출
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), Math.min(opts?.timeoutMs ?? 6000, 30000));
  try {
    const url = `https://openapi.naver.com/v1/search/webkr.json?query=${encodeURIComponent(query)}&display=20`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': secret,
      },
      signal: ctrl.signal,
    });
    if (!resp.ok) return null;

    const json = (await resp.json()) as NaverWebSearchResp;
    const items = json.items || [];
    if (!items.length) return null;

    // 3) 스코어링
    const qTokens = tokenize(query);
    let best = { item: null as NaverWebDoc | null, score: -1 };

    items.forEach((it, idx) => {
      const title = stripTags(it.title || '');
      const host = hostnameOf(it.link);
      let s = 0;

      // 포지션 보정(상위 노출 가점)
      s += Math.max(0, 12 - idx); // 1등 12점, 2등 11점 …

      // 제목/도메인 키워드 매칭
      for (const t of qTokens) {
        if (!t) continue;
        if (fuzzyIncludes(title, t)) s += 2;
        if (fuzzyIncludes(host, t)) s += 2;
      }

      // '공식' 키워드
      if (/공식|official/i.test(title)) s += 3;

      // 도메인 공식성
      s += scoreByDomain(host);

      // 철도/예매 맥락 가중
      if (/etk\.srail\.kr$/i.test(host)) s += 8;
      if (/letskorail\.com$/i.test(host)) s += 6;
      if (/srt|예매|예약|좌석|발권|환불|취소/i.test(title)) s += 2;

      if (s > best.score) best = { item: it, score: s };
    });

    if (!best.item) return null;

    return {
      title: stripTags(best.item.title || '공식 사이트'),
      link: best.item.link,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}
