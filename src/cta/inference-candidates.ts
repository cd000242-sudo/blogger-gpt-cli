/**
 * inference-candidates — CTA 를 "기억"이 아니라 "확인된 자료"에서 고르게 한다.
 *
 * ## 왜 필요한가
 * CTA 는 이미 AI 추론으로 만든다. 그런데 프롬프트에 **실제 자료를 안 줬다.**
 * 그래서 모델이 아는 주소를 짐작하고, 옛 주소(letskorail.com)나 없는 주소가 나왔다.
 *
 * 정작 글을 쓰는 동안 이 키워드의 기관 페이지를 이미 수집한다
 * (collectOfficialSources — 기관명·주소·실제 본문 문장까지 확보). 그걸 안 쓰고 있었다.
 * 이 목록을 주면 모델이 **확인된 주소 중에서** 고른다. 추가 호출이 없으니 비용도 0원이다.
 *
 * ## 많이 주지 않는다
 * 프롬프트가 길어지면 뒤쪽 규칙이 밀린다. 상위 몇 개만 준다.
 */

export interface OfficialSourceLike {
  agency?: string;
  url?: string;
}

/** 프롬프트에 넣을 최대 후보 수 — 더 주면 다른 규칙이 밀린다 */
const MAX_CANDIDATES = 8;

/**
 * 수집된 기관 근거를 CTA 추론용 후보 목록으로 만든다.
 * 재료가 없으면 빈 문자열 — 없는 목록을 지어내지 않는다(그때는 예전처럼 모델이 짐작한다).
 */
export function buildOfficialCtaCandidates(sources: OfficialSourceLike[]): string {
  try {
    if (!Array.isArray(sources) || sources.length === 0) return '';

    const seen = new Set<string>();
    const lines: string[] = [];
    for (const source of sources) {
      const url = String(source?.url || '').trim();
      if (!/^https?:\/\//i.test(url)) continue;   // 주소가 깨진 항목은 뺀다
      if (seen.has(url)) continue;
      seen.add(url);
      const agency = String(source?.agency || '').trim() || '기관';
      lines.push(`  · ${agency} — ${url}`);
      if (lines.length >= MAX_CANDIDATES) break;
    }
    if (lines.length === 0) return '';

    return [
      '',
      '📑 **이 글을 쓰면서 실제로 확인한 기관 페이지입니다. CTA 주소는 이 목록에서 고르세요.**',
      '   (기억에 있는 주소를 짐작하지 마세요 — 옛 주소이거나 없어진 경우가 많습니다.)',
      ...lines,
      '   목록에 이 글의 행동(신청·예매·조회 등)에 맞는 페이지가 없으면,',
      '   위 기관의 주소 중 가장 가까운 것을 고르거나 CTA 를 만들지 마세요.',
      '',
    ].join('\n');
  } catch {
    return '';
  }
}
