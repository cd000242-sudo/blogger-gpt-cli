export interface DiagnosticResult {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  checks: DiagnosticCheck[];
  summary: string;
}

export interface DiagnosticCheck {
  category: 'indexing' | 'seo' | 'performance' | 'content';
  name: string;
  passed: boolean;
  value: string;
  suggestion?: string;
  weight: number; // importance 1-10
}

function makeCheck(
  category: DiagnosticCheck['category'],
  name: string,
  passed: boolean,
  value: string,
  weight: number,
  suggestion?: string
): DiagnosticCheck {
  const base: DiagnosticCheck = { category, name, passed, value, weight };
  if (suggestion !== undefined) base.suggestion = suggestion;
  return base;
}

export async function diagnoseBlog(blogUrl: string, onLog?: (msg: string) => void): Promise<DiagnosticResult> {
  const checks: DiagnosticCheck[] = [];

  onLog?.('🔍 블로그 진단 시작...');

  // Normalize URL
  if (!blogUrl.startsWith('http')) blogUrl = 'https://' + blogUrl;

  // === 1. HTTPS 확인 ===
  onLog?.('🔒 HTTPS 확인 중...');
  checks.push(makeCheck(
    'seo', 'HTTPS 사용',
    blogUrl.startsWith('https://'),
    blogUrl.startsWith('https://') ? '✅ HTTPS' : '❌ HTTP',
    8,
    blogUrl.startsWith('https://') ? undefined : 'HTTPS로 전환하세요. 검색 순위에 영향을 줍니다.'
  ));

  // === 2. 사이트 접근 가능 확인 ===
  onLog?.('🌐 사이트 접근 확인 중...');
  let htmlContent = '';
  let loadTimeMs = 0;
  try {
    const start = Date.now();
    const resp = await fetch(blogUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });
    loadTimeMs = Date.now() - start;
    htmlContent = await resp.text();

    checks.push(makeCheck(
      'performance', '사이트 접근',
      resp.ok,
      `${resp.status} (${loadTimeMs}ms)`,
      10,
      resp.ok ? undefined : `HTTP ${resp.status} 오류. 사이트 설정을 확인하세요.`
    ));
  } catch (e: any) {
    checks.push(makeCheck(
      'performance', '사이트 접근',
      false,
      `접속 불가: ${(e.message as string | undefined)?.substring(0, 40) ?? ''}`,
      10,
      '사이트 URL이 올바른지, 서버가 작동 중인지 확인하세요.'
    ));
    // Can't continue without HTML
    return buildResult(checks);
  }

  // === 3. 페이지 로드 시간 ===
  checks.push(makeCheck(
    'performance', '페이지 로드 속도',
    loadTimeMs < 3000,
    `${loadTimeMs}ms`,
    7,
    loadTimeMs >= 3000 ? `${(loadTimeMs / 1000).toFixed(1)}초는 느립니다. 이미지 최적화, 캐싱을 확인하세요.` : undefined
  ));

  // === 4. Title 태그 ===
  onLog?.('📝 SEO 메타 태그 확인 중...');
  const titleMatch = htmlContent.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? '';
  const titleSuggestion = !title
    ? '제목 태그가 없습니다!'
    : title.length < 10
    ? '제목이 너무 짧습니다 (10자 이상 권장)'
    : title.length > 60
    ? '제목이 너무 깁니다 (60자 이하 권장)'
    : undefined;
  checks.push(makeCheck(
    'seo', '제목 태그 (title)',
    title.length >= 10 && title.length <= 60,
    title ? `"${title.substring(0, 40)}${title.length > 40 ? '...' : ''}" (${title.length}자)` : '없음',
    9,
    titleSuggestion
  ));

  // === 5. Meta Description ===
  const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    ?? htmlContent.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const desc = descMatch?.[1]?.trim() ?? '';
  const descSuggestion = !desc
    ? 'meta description이 없습니다! 검색 결과에 표시되는 설명문을 추가하세요.'
    : desc.length < 50
    ? '너무 짧습니다 (50자 이상 권장)'
    : desc.length > 160
    ? '너무 깁니다 (160자 이하 권장)'
    : undefined;
  checks.push(makeCheck(
    'seo', '메타 설명 (description)',
    desc.length >= 50 && desc.length <= 160,
    desc ? `"${desc.substring(0, 50)}..." (${desc.length}자)` : '없음',
    8,
    descSuggestion
  ));

  // === 6. H1 태그 ===
  const h1Matches = htmlContent.match(/<h1[^>]*>/gi) ?? [];
  const h1Suggestion = h1Matches.length === 0
    ? 'H1 태그가 없습니다. 페이지 제목을 H1으로 감싸세요.'
    : h1Matches.length > 1
    ? `H1이 ${h1Matches.length}개입니다. 1개만 사용하세요.`
    : undefined;
  checks.push(makeCheck(
    'seo', 'H1 태그',
    h1Matches.length === 1,
    `${h1Matches.length}개`,
    7,
    h1Suggestion
  ));

  // === 7. Viewport Meta (모바일 반응형) ===
  const hasViewport = /meta[^>]*name=["']viewport["']/i.test(htmlContent);
  checks.push(makeCheck(
    'seo', '모바일 반응형 (viewport)',
    hasViewport,
    hasViewport ? '✅ 설정됨' : '❌ 없음',
    8,
    hasViewport ? undefined : 'viewport meta 태그가 없습니다. 모바일 검색 순위가 낮아집니다.'
  ));

  // === 8. robots.txt 확인 ===
  onLog?.('🤖 robots.txt 확인 중...');
  try {
    const robotsUrl = new URL('/robots.txt', blogUrl).href;
    const robotsResp = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
    const robotsTxt = robotsResp.ok ? await robotsResp.text() : '';
    const blocksAll = robotsTxt.includes('Disallow: /') && !robotsTxt.includes('Disallow: /\n');
    const robotsSuggestion = blocksAll
      ? 'robots.txt가 모든 크롤링을 차단하고 있습니다! "Disallow: /" 규칙을 제거하세요.'
      : !robotsResp.ok
      ? 'robots.txt가 없습니다. 생성하는 것을 권장합니다.'
      : undefined;
    checks.push(makeCheck(
      'indexing', 'robots.txt',
      robotsResp.ok && !blocksAll,
      !robotsResp.ok ? '없음 (404)' : blocksAll ? '⚠️ 크롤링 차단됨!' : '✅ 정상',
      9,
      robotsSuggestion
    ));
  } catch {
    checks.push(makeCheck('indexing', 'robots.txt', false, '확인 불가', 5));
  }

  // === 9. sitemap.xml 확인 ===
  onLog?.('🗺️ sitemap.xml 확인 중...');
  try {
    const sitemapUrl = new URL('/sitemap.xml', blogUrl).href;
    const smResp = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000) });
    const smText = smResp.ok ? await smResp.text() : '';
    const urlCount = (smText.match(/<loc>/gi) ?? []).length;
    const sitemapSuggestion = !smResp.ok
      ? 'sitemap.xml이 없습니다! 검색엔진이 글을 찾기 어렵습니다.'
      : urlCount === 0
      ? 'sitemap은 있지만 URL이 없습니다.'
      : undefined;
    checks.push(makeCheck(
      'indexing', 'sitemap.xml',
      smResp.ok && urlCount > 0,
      smResp.ok ? `✅ ${urlCount}개 URL 발견` : '❌ 없음',
      9,
      sitemapSuggestion
    ));
  } catch {
    checks.push(makeCheck('indexing', 'sitemap.xml', false, '확인 불가', 5));
  }

  // === 10. Google 색인 확인 ===
  onLog?.('🔎 Google 색인 확인 중...');
  try {
    const host = new URL(blogUrl).hostname;
    const searchUrl = `https://www.google.com/search?q=site:${host}&num=1`;
    const gResp = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000)
    });
    const gHtml = await gResp.text();
    const hasResults = !gHtml.includes('did not match any documents') && !gHtml.includes('검색결과가 없습니다');
    const resultCount = gHtml.match(/약 ([\d,]+)개/)?.[1] ?? gHtml.match(/About ([\d,]+) results/)?.[1] ?? '';
    checks.push(makeCheck(
      'indexing', 'Google 색인',
      hasResults,
      hasResults ? `✅ 색인됨 ${resultCount ? '(' + resultCount + '페이지)' : ''}` : '❌ 색인 안 됨',
      10,
      hasResults ? undefined : 'Google에 색인되지 않았습니다! Google Search Console에서 사이트를 등록하세요.'
    ));
  } catch {
    checks.push(makeCheck('indexing', 'Google 색인', false, '확인 불가', 5));
  }

  // === 11. 이미지 alt 태그 ===
  onLog?.('🖼️ 이미지 최적화 확인 중...');
  const imgTags = htmlContent.match(/<img[^>]*>/gi) ?? [];
  const imgWithAlt = imgTags.filter(img => /alt=["'][^"']+["']/i.test(img));
  const altRatio = imgTags.length > 0 ? imgWithAlt.length / imgTags.length : 1;
  checks.push(makeCheck(
    'seo', '이미지 alt 태그',
    imgTags.length === 0 || altRatio >= 0.7,
    imgTags.length === 0 ? '이미지 없음' : `${imgWithAlt.length}/${imgTags.length} (${Math.round(altRatio * 100)}%)`,
    6,
    imgTags.length > 0 && altRatio < 0.7
      ? `이미지 ${imgTags.length - imgWithAlt.length}개에 alt 태그가 없습니다. SEO에 중요합니다.`
      : undefined
  ));

  // === 12. 내부 링크 ===
  const internalLinks = (htmlContent.match(new RegExp(`href=["'][^"']*${new URL(blogUrl).hostname}[^"']*["']`, 'gi')) ?? []).length;
  checks.push(makeCheck(
    'content', '내부 링크',
    internalLinks >= 3,
    `${internalLinks}개`,
    5,
    internalLinks < 3 ? '내부 링크가 부족합니다. 다른 글로의 링크를 추가하면 SEO에 도움됩니다.' : undefined
  ));

  // === 13. Open Graph 태그 (소셜 공유) ===
  const hasOG = /property=["']og:/i.test(htmlContent);
  checks.push(makeCheck(
    'seo', 'Open Graph 태그 (소셜)',
    hasOG,
    hasOG ? '✅ 설정됨' : '❌ 없음',
    5,
    hasOG ? undefined : 'og:title, og:description 등이 없으면 SNS 공유 시 미리보기가 안 나옵니다.'
  ));

  onLog?.('✅ 진단 완료!');
  return buildResult(checks);
}

function buildResult(checks: DiagnosticCheck[]): DiagnosticResult {
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passedWeight = checks.filter(c => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  const failedCritical = checks.filter(c => !c.passed && c.weight >= 8);
  let summary = `블로그 건강 점수: ${score}점 (${grade}등급)`;
  if (failedCritical.length > 0) {
    summary += `\n\n⚠️ 긴급 수정 필요:\n${failedCritical.map(c => `• ${c.name}: ${c.suggestion ?? c.value}`).join('\n')}`;
  }

  return { score, grade, checks, summary };
}
