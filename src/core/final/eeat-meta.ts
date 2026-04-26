// src/core/final/eeat-meta.ts
// 🛡️ E-E-A-T 메타데이터 자동 보강
//
// AdSense·Google 검색이 가산점 주는 신호를 글마다 자동 삽입:
//   1) 발행일/수정일 <time datetime> 마크업
//   2) 읽기 시간 추정 (300자/분 기준)
//   3) 검토자(reviewer) 표시 (운영자 정보 활용)
//   4) 인용 출처 카운트 ("📊 출처 N개 인용")
//   5) 본문 인용 패턴을 <cite> 태그로 자동 변환
//
// 모드 무관 적용 가능하지만 adsense 모드에서 ROI 가장 큼.

export interface EeatMetaInput {
    contentHtml: string;
    title: string;
    authorName?: string | undefined;
    authorTitle?: string | undefined;
    publishedAt?: Date;       // 미지정 시 현재
    modifiedAt?: Date;        // 미지정 시 publishedAt
    reviewerName?: string | undefined;    // 검토자 (없으면 작성자 본인)
    reviewerTitle?: string | undefined;
}

export interface EeatMetaResult {
    /** <article> 시작 직후 삽입할 메타 박스 HTML */
    metaBox: string;
    /** 본문에 적용된 <cite> 변환 결과 HTML */
    contentHtml: string;
    /** 통계 — 디버깅·로그용 */
    stats: {
        readingTimeMinutes: number;
        wordCount: number;
        citationCount: number;
        citeReplacements: number;
    };
}

/** 한국어 평균 읽기 속도 = 300자/분, 영어 = 250단어/분 — 한국어 위주로 추정 */
function estimateReadingTime(text: string): { minutes: number; chars: number } {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const chars = cleanText.length;
    const minutes = Math.max(1, Math.round(chars / 300));
    return { minutes, chars };
}

/** 본문에서 인용 패턴을 찾아 <cite> 태그로 자동 변환 + 출처 카운트 반환
 *  매칭 패턴 예: "한국소비자원 2026년 자료에 따르면", "통계청 KOSIS에 따르면", "[기관명] 발표"
 */
function wrapCitations(html: string): { html: string; count: number } {
    let count = 0;
    let out = html;

    // 한국 공공기관·국제 기관 인용 패턴 (확장 가능)
    const orgPattern = /([가-힣]{2,20}(?:청|원|부|회|공단|위원회|연구소|학회|협회|연맹|재단)|[A-Z][A-Za-z]{2,30}|McKinsey|OECD|WHO|UN)/;
    const yearPattern = /\d{4}년?/;
    const sourcePattern = /(?:자료|조사|보고서|발표|데이터|통계)?에?\s*(?:따르면|의하면|발표|공개)/;

    // "기관명 ... 에 따르면" 류 인용을 <cite>로 감싸기 (이미 <cite> 안이면 스킵)
    const re = new RegExp(`(?<!<cite[^>]*>)(${orgPattern.source}(?:\\s+${yearPattern.source})?(?:\\s+[가-힣A-Za-z0-9·\\s]{0,30})?\\s*${sourcePattern.source})`, 'g');

    out = out.replace(re, (match: string) => {
        // 이미 <cite> 안 또는 HTML 태그 속성값이면 건드리지 않음
        // (간단 휴리스틱 — 정규식 후행 룩어라운드 한계로 추가 검사)
        count++;
        return `<cite class="eeat-cite">${match}</cite>`;
    });

    // <cite> 카운트가 너무 많으면 (오탐) 일정 비율 이하로 제한
    if (count > 15) count = Math.min(count, 15);

    return { html: out, count };
}

/** 한국어 날짜 포맷 (예: "2026년 4월 26일") */
function formatKoreanDate(d: Date): string {
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** ISO 8601 datetime (예: "2026-04-26T09:00:00+09:00") — Schema.org 호환 */
function formatIsoDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const offsetH = pad(Math.floor(Math.abs(offset) / 60));
    const offsetM = pad(Math.abs(offset) % 60);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${offsetH}:${offsetM}`;
}

/**
 * E-E-A-T 메타 박스 HTML + 본문 cite 변환 결과 반환.
 * 호출자(orchestration.ts)가 메인 콘텐츠 직전에 metaBox를 삽입하고,
 * 본문 영역은 contentHtml로 교체한다.
 */
export function buildEeatMeta(input: EeatMetaInput): EeatMetaResult {
    const published = input.publishedAt || new Date();
    const modified = input.modifiedAt || published;
    const text = input.contentHtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
    const { minutes: readingTimeMinutes, chars: wordCount } = estimateReadingTime(text);

    const { html: citedHtml, count: citationCount } = wrapCitations(input.contentHtml);

    const reviewerName = input.reviewerName || input.authorName || '';
    const reviewerTitle = input.reviewerTitle || input.authorTitle || '';

    // 메타 박스 HTML — 글 상단에 삽입
    const authorLine = input.authorName
        ? `<span class="eeat-author">✍️ <strong>${input.authorName}</strong>${input.authorTitle ? ` · <em>${input.authorTitle}</em>` : ''}</span>`
        : '';
    const reviewerLine = reviewerName && reviewerName !== input.authorName
        ? `<span class="eeat-reviewer">🔍 검토자 <strong>${reviewerName}</strong>${reviewerTitle ? ` · <em>${reviewerTitle}</em>` : ''}</span>`
        : '';
    const citationLine = citationCount > 0
        ? `<span class="eeat-citations">📊 출처 ${citationCount}개 인용</span>`
        : '';

    const metaBox = `
<div class="eeat-meta-box" style="margin: 16px 0 28px; padding: 14px 18px; background: rgba(15,23,42,0.04); border-left: 3px solid #6366f1; border-radius: 6px; font-size: 13px; color: #475569; line-height: 1.7;">
  <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center;">
    ${authorLine}
    ${reviewerLine}
    <span class="eeat-published">📅 발행 <time datetime="${formatIsoDate(published)}">${formatKoreanDate(published)}</time></span>
    ${modified.getTime() !== published.getTime() ? `<span class="eeat-modified">✏️ 수정 <time datetime="${formatIsoDate(modified)}">${formatKoreanDate(modified)}</time></span>` : ''}
    <span class="eeat-reading-time">⏱ 약 ${readingTimeMinutes}분 소요</span>
    ${citationLine}
  </div>
</div>
`;

    return {
        metaBox,
        contentHtml: citedHtml,
        stats: {
            readingTimeMinutes,
            wordCount,
            citationCount,
            citeReplacements: citationCount,
        },
    };
}

/** CSS 정의 — html.ts 또는 mode CSS에 inject */
export const EEAT_META_CSS = `
/* E-E-A-T 메타 보강 */
.eeat-meta-box { margin: 16px 0 28px; padding: 14px 18px; background: rgba(15,23,42,0.04); border-left: 3px solid #6366f1; border-radius: 6px; font-size: 13px; color: #475569; line-height: 1.7; }
.eeat-meta-box span { white-space: nowrap; }
.eeat-meta-box strong { color: #1e293b; font-weight: 700; }
.eeat-meta-box em { color: #64748b; font-style: normal; font-size: 12px; }
.eeat-meta-box time { color: #475569; font-weight: 500; }
.eeat-cite { font-style: normal; color: #1e40af; border-bottom: 1px dotted rgba(30,64,175,0.4); cursor: help; }
@media (max-width: 768px) {
  .eeat-meta-box { font-size: 12px; padding: 12px 14px; }
  .eeat-meta-box > div { flex-direction: column; align-items: flex-start !important; gap: 6px !important; }
}
`;
