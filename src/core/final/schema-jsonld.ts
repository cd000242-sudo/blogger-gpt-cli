// src/core/final/schema-jsonld.ts
// 🛡️ Schema.org JSON-LD 풀팩 자동 생성기
//
// 구글 검색·AdSense가 신뢰도 평가에 직접 사용하는 구조화 데이터.
// Article + Person + Organization + BreadcrumbList를 글마다 자동 삽입.
// 기존 FAQPage(adsense-prompt-builder)는 그대로 두고 보완.

export interface SchemaInput {
    title: string;
    description?: string | undefined;
    canonicalUrl?: string | undefined;
    imageUrl?: string | undefined;
    publishedAt?: Date | undefined;
    modifiedAt?: Date | undefined;
    keywords?: string[] | undefined;
    wordCount?: number | undefined;
    /** 작성자 정보 — Person Schema에 사용 */
    authorName?: string | undefined;
    authorTitle?: string | undefined;
    authorSameAs?: string[] | undefined;
    /** 사이트 정보 — Organization Schema에 사용 */
    siteName?: string | undefined;
    siteUrl?: string | undefined;
    siteLogoUrl?: string | undefined;
    /** Breadcrumb 경로 — 미지정 시 [홈] → [글 제목] */
    breadcrumbs?: Array<{ name: string; url: string }> | undefined;
}

export interface SchemaResult {
    /** <script type="application/ld+json"> 단일 블록 (그래프 포함) */
    scriptTag: string;
    /** 디버그용 — 포함된 노드 수 */
    nodeCount: number;
}

/**
 * Schema.org JSON-LD @graph 형식으로 다수 엔티티를 한 블록에 묶어서 반환.
 * 단일 <script> 태그로 head 또는 article 직전에 삽입.
 */
export function buildSchemaJsonLd(input: SchemaInput): SchemaResult {
    const published = input.publishedAt || new Date();
    const modified = input.modifiedAt || published;
    const url = (input.canonicalUrl || '').trim();
    const siteUrl = (input.siteUrl || '').replace(/\/$/, '');
    const siteName = input.siteName || '블로그';

    // ─── Person (작성자) ───
    const personId = `${siteUrl || ''}#author-${(input.authorName || 'author').replace(/\s+/g, '-')}`;
    const person = input.authorName ? {
        '@type': 'Person',
        '@id': personId,
        name: input.authorName,
        ...(input.authorTitle ? { jobTitle: input.authorTitle } : {}),
        ...(input.authorSameAs && input.authorSameAs.length > 0 ? { sameAs: input.authorSameAs } : {}),
    } : null;

    // ─── Organization (사이트) ───
    const orgId = siteUrl ? `${siteUrl}#organization` : '';
    const organization = orgId ? {
        '@type': 'Organization',
        '@id': orgId,
        name: siteName,
        url: siteUrl,
        ...(input.siteLogoUrl ? {
            logo: {
                '@type': 'ImageObject',
                url: input.siteLogoUrl,
            },
        } : {}),
    } : null;

    // ─── WebSite ───
    const websiteId = siteUrl ? `${siteUrl}#website` : '';
    const website = websiteId ? {
        '@type': 'WebSite',
        '@id': websiteId,
        url: siteUrl,
        name: siteName,
        ...(organization ? { publisher: { '@id': orgId } } : {}),
    } : null;

    // ─── BreadcrumbList ───
    const breadcrumbItems = input.breadcrumbs && input.breadcrumbs.length > 0
        ? input.breadcrumbs
        : siteUrl
            ? [{ name: '홈', url: siteUrl }, { name: input.title, url: url || siteUrl }]
            : [];
    const breadcrumb = breadcrumbItems.length > 0 ? {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: item.name,
            item: item.url,
        })),
    } : null;

    // ─── Article ───
    const article: any = {
        '@type': 'Article',
        ...(url ? { '@id': `${url}#article` } : {}),
        ...(url ? { mainEntityOfPage: { '@type': 'WebPage', '@id': url } } : {}),
        headline: input.title.slice(0, 110),
        ...(input.description ? { description: input.description.slice(0, 250) } : {}),
        ...(input.imageUrl ? {
            image: {
                '@type': 'ImageObject',
                url: input.imageUrl,
            },
        } : {}),
        datePublished: published.toISOString(),
        dateModified: modified.toISOString(),
        ...(person ? { author: { '@id': personId } } : input.authorName ? { author: { '@type': 'Person', name: input.authorName } } : {}),
        ...(organization ? { publisher: { '@id': orgId } } : {}),
        ...(input.keywords && input.keywords.length > 0 ? { keywords: input.keywords.join(', ') } : {}),
        ...(input.wordCount ? { wordCount: input.wordCount } : {}),
        inLanguage: 'ko-KR',
    };

    // ─── @graph 묶기 ───
    const graph: any[] = [article];
    if (person) graph.push(person);
    if (organization) graph.push(organization);
    if (website) graph.push(website);
    if (breadcrumb) graph.push(breadcrumb);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': graph,
    };

    const scriptTag = `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`;
    return { scriptTag, nodeCount: graph.length };
}
