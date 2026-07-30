/**
 * 공공기관 출처 수집 — 첫 생성 프롬프트에 실제 기관 근거를 넣는다 (v3.8.389)
 *
 * 왜 필요한가 (실측 2026-07-30):
 *   실속 규칙(v3.8.385) 적용 전후를 발행글로 비교했더니
 *     두루뭉실 표현  0.60 → 0.28 /1000자   -52.8%  ✅
 *     구체 수치      0.59 → 0.75           +26.2%
 *     기관 출처      1.36 → 1.41           +3.5%   ← 사실상 변화 없음
 *
 *   기관 출처만 안 늘었다. 그런데 원인은 프롬프트가 약해서가 아니다.
 *   같은 규칙 파일의 규칙 6이 "숫자를 확인할 수 없으면 지어내지 말라"고 명령한다.
 *   즉 자료에 기관 근거가 없으면 모델은 **안 쓰는 게 규칙을 지키는 것**이다.
 *   프롬프트를 더 세게 쓰면 규칙 6을 어기고 기관명을 지어내게 된다 — 최악의 방향이다.
 *
 *   실제로 크롤링 소스는 티스토리·워드프레스·뉴스·카페·네이버·RSS 뿐이었다.
 *   전부 블로그·커뮤니티·뉴스이고 공공기관 소스가 하나도 없었다.
 *   그래서 없는 걸 쓰라고 압박하는 대신, **있는 걸 찾아서 준다.**
 *
 * Princeton GEO (KDD 2024, 피어리뷰):
 *   구체 수치 + 기관 출처 + 인용은 생성형 검색 가시성을 +22~41% 올리고
 *   하위 랭킹 문서에서는 최대 +115%. 도메인 권위가 낮은 사이트에 가장 크게 작용한다.
 *
 * 수율 실측 (키워드 4개):
 *   제도·법령 주제는 잘 잡힌다 — "전세 보증금 증액 확정일자" 기관 4곳·문장 12개
 *     (「주택임대차보호법」 제7조 제1항, 증액 후 1년 이내 제한, 20분의 1 상한 …)
 *   민사·보험 분쟁 주제는 공공 자료가 애초에 없다 — "윗집 누수 감가상각" 0곳
 *   → 4개 중 2개 성공. **없으면 아무것도 추가하지 않으므로 악화는 없다.**
 *
 * 비용: CSE 1쿼리 + 최대 4페이지 fetch. **LLM 호출 0.** 비용 고정 원칙을 지킨다.
 */

/** 도메인 → 기관명. 매핑에 없는 도메인은 채택하지 않는다(출처 표기가 부정확해지므로). */
const AGENCY_BY_DOMAIN: Record<string, string> = {
  'easylaw.go.kr': '찾기쉬운 생활법령정보',
  'law.go.kr': '국가법령정보센터',
  'bokjiro.go.kr': '복지로',
  'gov.kr': '정부24',
  'work24.go.kr': '고용24',
  'minwon.go.kr': '민원24',
  'mohw.go.kr': '보건복지부',
  'moel.go.kr': '고용노동부',
  'molit.go.kr': '국토교통부',
  'mois.go.kr': '행정안전부',
  'moef.go.kr': '기획재정부',
  'moj.go.kr': '법무부',
  'msit.go.kr': '과학기술정보통신부',
  'nts.go.kr': '국세청',
  'kostat.go.kr': '통계청',
  'nhis.or.kr': '국민건강보험공단',
  'nps.or.kr': '국민연금공단',
  'comwel.or.kr': '근로복지공단',
  'fss.or.kr': '금융감독원',
  'fsc.go.kr': '금융위원회',
  'kca.go.kr': '한국소비자원',
  'ftc.go.kr': '공정거래위원회',
  'hf.go.kr': '한국주택금융공사',
  'lh.or.kr': '한국토지주택공사',
  'kinfa.or.kr': '서민금융진흥원',
  'kisa.or.kr': '한국인터넷진흥원',
  'pipc.go.kr': '개인정보보호위원회',
  'acrc.go.kr': '국민권익위원회',
  'nhic.or.kr': '국민건강보험공단',
  'kra.go.kr': '한국도로공사',
  'koroad.or.kr': '도로교통공단',
};

/** 문서 파일·다운로드 링크 — 받아도 바이너리 쓰레기가 된다(실측: PDF 본문이 깨진 문자로 들어옴) */
const BAD_URL = /\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip|txt)(\?|#|$)|\/download|flDownload|fileDown|\/attach|attachment/i;

/** 구체 수치 신호 — 금액·비율·기간·수량·법조문 */
const CONCRETE_NUMBER = /\d[\d,]*\s*(?:원|만원|억원|%|퍼센트|개월|일|년|주|회|명|건|배|㎡|평|분의)|\d{4}년|제\s*\d+\s*조/;

/** 페이지 네비게이션·UI 텍스트 — 문장이 아니라 껍데기다 */
const NAV_NOISE = /(인쇄|체크|메뉴|바로가기|로그인|검색하기|목록보기|다운로드|공유하기|글자크기|사이트맵|이전글|다음글|본문영역|스크랩)/;

export type OfficialSource = {
  agency: string;
  url: string;
  sentences: string[];
};

const hangulRatio = (value: string): number => {
  const text = String(value || '');
  if (!text) return 0;
  return (text.match(/[가-힣]/g) || []).length / text.length;
};

const stripHtml = (html: string): string => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** 도메인으로 기관명을 찾는다. 매핑에 없으면 빈 문자열(= 채택하지 않음). */
export function resolveAgency(url: string): string {
  try {
    const host = new URL(String(url)).hostname.replace(/^www\.|^m\./i, '').toLowerCase();
    for (const [domain, name] of Object.entries(AGENCY_BY_DOMAIN)) {
      if (host === domain || host.endsWith('.' + domain)) return name;
    }
    return '';
  } catch {
    return '';
  }
}

/** 수치가 든 깨끗한 한국어 문장만 골라낸다. */
export function extractNumericSentences(text: string, limit = 3): string[] {
  const clean = stripHtml(text);
  if (hangulRatio(clean) < 0.25) return [];   // 바이너리·영문 문서

  const seen = new Set<string>();
  const picked: string[] = [];
  for (const rawSentence of clean.split(/(?<=니다\.)\s*|(?<=[.!?])\s+|(?<=습니다)\s+/)) {
    let s = rawSentence.trim().replace(/^[◇☞▶·•\-\s]+/, '').trim();
    // HTML 속성 잔재 제거 — 실측: `어떻게 해야 하나요?"> 보증금 1억원…` 처럼
    //   title/alt 속성 끝이 문장 앞에 붙어 들어온다. 앞부분만 자르고 내용은 살린다.
    const attrEnd = Math.max(s.lastIndexOf('">', 80), s.lastIndexOf("'>", 80));
    if (attrEnd >= 0) s = s.slice(attrEnd + 2).replace(/^[◇☞▶·•\-\s]+/, '').trim();
    if (s.length < 25 || s.length > 200) continue;
    if (!CONCRETE_NUMBER.test(s)) continue;
    if (hangulRatio(s) < 0.35) continue;
    if (NAV_NOISE.test(s)) continue;
    if (s.includes('|')) continue;             // "제목 | 사이트명" 형태의 껍데기
    const key = s.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(s);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * 공공기관 출처를 수집한다.
 * 실패·미확보 시 빈 배열 — 호출부는 아무것도 추가하지 않으면 된다(악화 없음).
 */
export async function collectOfficialSources(
  keyword: string,
  cseKey: string,
  cseCx: string,
  onLog?: (msg: string) => void,
  options: { maxAgencies?: number; maxPages?: number } = {},
): Promise<OfficialSource[]> {
  const kw = String(keyword || '').trim();
  if (!kw || !cseKey || !cseCx) return [];
  const maxAgencies = options.maxAgencies ?? 3;
  const maxPages = options.maxPages ?? 4;

  // 시민 안내 성격 도메인을 앞세우고, 문서 파일은 검색 단계에서 제외한다
  const query = `${kw} (site:easylaw.go.kr OR site:law.go.kr OR site:bokjiro.go.kr OR site:gov.kr OR site:go.kr OR site:or.kr) -filetype:pdf -filetype:hwp`;

  let items: Array<{ link?: string; title?: string }> = [];
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(cseKey)}`
      + `&cx=${encodeURIComponent(cseCx)}&q=${encodeURIComponent(query)}&num=10&hl=ko`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      onLog?.(`   [공공출처] 검색 실패 HTTP ${res.status} — 건너뜀`);
      return [];
    }
    const body: any = await res.json();
    items = Array.isArray(body?.items) ? body.items : [];
  } catch (error: any) {
    onLog?.(`   [공공출처] 검색 예외 — 건너뜀: ${String(error?.message || error).slice(0, 60)}`);
    return [];
  }

  const candidates = items
    .map(it => ({ url: String(it?.link || ''), agency: resolveAgency(String(it?.link || '')) }))
    .filter(c => c.url && c.agency && !BAD_URL.test(c.url))
    .slice(0, maxPages);

  if (candidates.length === 0) {
    onLog?.(`   [공공출처] 채택 가능한 기관 페이지 없음 — 건너뜀`);
    return [];
  }

  const sources: OfficialSource[] = [];
  for (const candidate of candidates) {
    if (sources.length >= maxAgencies) break;
    try {
      const res = await fetch(candidate.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      if (!/text\/html/i.test(String(res.headers.get('content-type') || ''))) continue;
      const sentences = extractNumericSentences(await res.text());
      if (sentences.length === 0) continue;
      sources.push({ agency: candidate.agency, url: candidate.url, sentences });
    } catch {
      // 개별 페이지 실패는 무시한다 — 하나라도 건지면 이득이다
    }
  }

  // 같은 기관이 여러 페이지로 잡히면 하나로 합친다 (프롬프트 가독성 + 토큰 절약).
  //   실측: "찾기쉬운 생활법령정보" 가 3번 따로 표기됐다.
  const merged = mergeByAgency(sources);
  const total = merged.reduce((sum, s) => sum + s.sentences.length, 0);
  onLog?.(merged.length > 0
    ? `   [공공출처] 기관 ${merged.length}곳 · 근거 문장 ${total}개 확보 (${merged.map(s => s.agency).join(', ')})`
    : `   [공공출처] 수치가 든 문장을 찾지 못함 — 건너뜀`);
  return merged;
}

/** 같은 기관의 여러 페이지를 하나로 합치고 문장 중복을 없앤다. */
export function mergeByAgency(sources: OfficialSource[], maxPerAgency = 6): OfficialSource[] {
  const byAgency = new Map<string, { url: string; sentences: string[]; seen: Set<string> }>();
  (Array.isArray(sources) ? sources : []).forEach((source) => {
    if (!source?.agency || !Array.isArray(source.sentences)) return;
    const entry = byAgency.get(source.agency)
      || { url: source.url, sentences: [], seen: new Set<string>() };
    source.sentences.forEach((sentence) => {
      const key = String(sentence || '').replace(/\s+/g, '');
      if (!key || entry.seen.has(key) || entry.sentences.length >= maxPerAgency) return;
      entry.seen.add(key);
      entry.sentences.push(sentence);
    });
    byAgency.set(source.agency, entry);
  });
  return [...byAgency.entries()]
    .filter(([, v]) => v.sentences.length > 0)
    .map(([agency, v]) => ({ agency, url: v.url, sentences: v.sentences }));
}

/**
 * 프롬프트에 넣을 블록을 만든다.
 * crawledContents 는 12,000자에서 잘리므로 호출부는 이 블록을 **맨 앞**에 둬야 한다.
 */
export function buildOfficialSourceBlock(sources: OfficialSource[], maxChars = 2500): string {
  const list = (Array.isArray(sources) ? sources : []).filter(s => s?.agency && s.sentences?.length);
  if (list.length === 0) return '';

  const lines: string[] = [
    '===== 공공기관 확인 근거 (이 숫자와 기관명은 실제 확인된 것입니다) =====',
  ];
  list.forEach((source) => {
    lines.push(`▣ ${source.agency}`);
    source.sentences.forEach(s => lines.push(`   · ${s}`));
  });
  lines.push('=====');
  lines.push('');
  lines.push('위 근거는 실제 기관 페이지에서 확인된 문장입니다. 해당 내용을 다루는 단락에서는');
  lines.push('**숫자와 기관명을 함께** 쓰세요. 예: "증액은 1년 이내 청구할 수 없습니다(주택임대차보호법 제7조).".');
  lines.push('근거에 없는 숫자는 이 블록에 있는 것처럼 쓰지 마세요.');

  const block = lines.join('\n');
  return block.length > maxChars ? block.slice(0, maxChars) + '\n=====' : block;
}
