#!/usr/bin/env node
// dry-run-adsense-pipeline.js
// AdSense 강화 모듈을 실제 호출하여 출력 검증 (LLM 호출 없음).
// 정적 문자열 검증과 다르게 — 함수가 진짜 실행되어 KOSIS/JSON-LD/cite 등을 만드는지 확인.

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FAILED = [];
const PASSED = [];

function expect(label, condition, detail = '') {
  if (condition) {
    PASSED.push(label);
    console.log(`  ✅ ${label}`);
  } else {
    FAILED.push({ label, detail });
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function section(name) {
  console.log(`\n[${name}]`);
}

(async function main() {
  console.log('🧪 AdSense 파이프라인 dry-run (LLM 호출 없음 — 함수 실제 실행 검증)');

  // ═══════════════════════════════════════════════
  // ① buildEeatMeta — 본문 인용 → cite 변환 + 메타박스 생성
  // ═══════════════════════════════════════════════
  section('① buildEeatMeta — 인용 패턴 cite 변환 + 메타박스');
  const { buildEeatMeta } = require(path.join(ROOT, 'dist/core/final/eeat-meta.js'));

  const sampleHtml = `
    <p>청년도약계좌에 대해 알아봅시다.</p>
    <p>통계청 KOSIS 자료에 따르면 가입자 수가 증가했습니다.</p>
    <p>한국소비자원 2026년 조사에 의하면 만족도가 높습니다.</p>
    <p>한국은행 ECOS 데이터 발표에 따르면 금리도 영향을 받습니다.</p>
    <article>본문 텍스트가 충분히 길어야 읽기 시간이 측정됩니다. ${'본문 더미 내용 '.repeat(50)}</article>
  `.trim();

  const eeatResult = buildEeatMeta({
    contentHtml: sampleHtml,
    title: '청년도약계좌 정부기여금 총정리',
    authorName: '리더남',
    authorTitle: '디지털노마드',
    publishedAt: new Date('2026-04-29T09:00:00+09:00'),
  });

  expect('citation 카운트 ≥ 3 (KOSIS/한국소비자원/한국은행)',
    eeatResult.stats.citationCount >= 3,
    `실제: ${eeatResult.stats.citationCount}`);
  expect('contentHtml에 <cite class="eeat-cite"> 포함',
    eeatResult.contentHtml.includes('<cite class="eeat-cite">'));
  expect('metaBox에 작성자 "리더남" 포함',
    eeatResult.metaBox.includes('리더남'));
  expect('metaBox에 발행일 한국어 포맷 포함 (2026년)',
    eeatResult.metaBox.includes('2026년'));
  expect('readingTimeMinutes ≥ 1',
    eeatResult.stats.readingTimeMinutes >= 1,
    `실제: ${eeatResult.stats.readingTimeMinutes}분`);

  // ═══════════════════════════════════════════════
  // ② buildSchemaJsonLd — Schema.org @graph 풀팩
  // ═══════════════════════════════════════════════
  section('② buildSchemaJsonLd — Article + Person + Organization + WebSite + Breadcrumb');
  const { buildSchemaJsonLd } = require(path.join(ROOT, 'dist/core/final/schema-jsonld.js'));

  const schemaResult = buildSchemaJsonLd({
    title: '청년도약계좌 정부기여금 총정리',
    description: '2026년 청년도약계좌 정부기여금 정책의 핵심',
    canonicalUrl: 'https://example.com/post-1',
    imageUrl: 'https://example.com/thumb.jpg',
    publishedAt: new Date('2026-04-29T09:00:00+09:00'),
    keywords: ['청년도약계좌', '정부기여금', '2026년'],
    wordCount: 5000,
    authorName: '리더남',
    authorTitle: '디지털노마드',
    siteName: '리더남의 경제이야기',
    siteUrl: 'https://example.com',
  });

  expect('scriptTag가 <script type="application/ld+json">로 시작',
    schemaResult.scriptTag.startsWith('<script type="application/ld+json">'));
  expect('JSON-LD 본문에 "@graph" 포함',
    schemaResult.scriptTag.includes('"@graph"'));
  expect('JSON-LD에 Article/BlogPosting 엔티티 포함',
    /"@type"\s*:\s*"(Article|BlogPosting)"/.test(schemaResult.scriptTag));
  expect('JSON-LD에 Person 엔티티 포함',
    /"@type"\s*:\s*"Person"/.test(schemaResult.scriptTag));
  expect('JSON-LD에 Organization 엔티티 포함',
    /"@type"\s*:\s*"Organization"/.test(schemaResult.scriptTag));
  expect('JSON-LD에 BreadcrumbList 엔티티 포함',
    /"@type"\s*:\s*"BreadcrumbList"/.test(schemaResult.scriptTag));
  expect('JSON-LD가 valid JSON으로 파싱 가능',
    (() => {
      try {
        const jsonStr = schemaResult.scriptTag
          .replace(/^<script type="application\/ld\+json">\s*/, '')
          .replace(/\s*<\/script>$/, '');
        JSON.parse(jsonStr);
        return true;
      } catch (e) { return false; }
    })());
  expect('nodeCount ≥ 4 (Article + Person + Organization + Breadcrumb)',
    schemaResult.nodeCount >= 4,
    `실제: ${schemaResult.nodeCount}`);

  // ═══════════════════════════════════════════════
  // ③ scanAdsensePolicy — 정책 위반 사전 스캔
  // ═══════════════════════════════════════════════
  section('③ scanAdsensePolicy — prohibited / YMYL / misleading / deceptive');
  const { scanAdsensePolicy } = require(path.join(ROOT, 'dist/core/final/policy-scanner.js'));

  // 정상 콘텐츠 — safe=true 기대
  const safeHtml = '<article><p>청년도약계좌는 만 19세 이상 청년이 가입할 수 있습니다. 통계청 KOSIS 자료에 따르면 가입자 수가 증가했습니다.</p></article>';
  const safeResult = scanAdsensePolicy(safeHtml);
  expect('정상 콘텐츠 → safe = true',
    safeResult.safe === true,
    `violations: ${safeResult.violations?.length || 0}`);

  // 위반 콘텐츠 — safe=false 기대
  const violationHtml = '<article><p>이 글에서는 무료로 다운로드 가능한 영화 토렌트 사이트를 소개합니다. 무조건 100% 수익 보장!</p></article>';
  const violationResult = scanAdsensePolicy(violationHtml);
  expect('위반 콘텐츠 → violations 배열에 항목 ≥ 1',
    Array.isArray(violationResult.violations) && violationResult.violations.length >= 1,
    `violations: ${violationResult.violations?.length || 0}`);
  expect('violation 각 항목에 severity / category / pattern / matched 필드',
    violationResult.violations?.every(v => v.severity && v.category && v.pattern && v.matched));
  expect('summary 문자열 반환',
    typeof violationResult.summary === 'string' && violationResult.summary.length > 0);

  // ═══════════════════════════════════════════════
  // ④ buildAdsenseSectionPrompt — KOSIS/한국소비자원 인용 강제 프롬프트
  // ═══════════════════════════════════════════════
  section('④ buildAdsenseSectionPrompt — sourceMandate 실제 결합');
  const { buildAdsenseSectionPrompt } = require(path.join(ROOT, 'dist/core/content-modes/adsense/adsense-prompt-builder.js'));

  const promptResult = buildAdsenseSectionPrompt({
    section: {
      id: 'main_content',
      title: '청년도약계좌 핵심 정보',
      role: '정책 가이드 작성자',
      contentFocus: '제도 개요와 가입 조건',
      minChars: 1000,
    },
    subtopic: '가입 조건과 정부기여금',
    keywords: ['청년도약계좌', '정부기여금'],
    topic: '청년도약계좌',
    uniqueId: 'test-001',
    yearGuide: '2026년 기준',
    toneGuide: '전문적이면서 친근한 톤',
    authorInfo: { name: '리더남', title: '디지털노마드' },
    trendKeywords: [],
    draftContext: '',
  });

  expect('프롬프트가 문자열 반환',
    typeof promptResult === 'string' && promptResult.length > 500);
  expect('프롬프트에 "통계청 KOSIS" 인용 강제 명시',
    promptResult.includes('통계청 KOSIS'));
  expect('프롬프트에 "한국소비자원" 인용 강제 명시',
    promptResult.includes('한국소비자원'));
  expect('프롬프트에 "한국은행" 인용 예시 포함',
    promptResult.includes('한국은행'));
  expect('프롬프트에 "외부 출처 인용 필수" 헤더',
    promptResult.includes('외부 출처 인용 필수'));
  expect('프롬프트에 "가짜 통계 절대 금지" 환각 방지',
    promptResult.includes('가짜 통계 절대 금지') || promptResult.includes('추측·가짜 통계 절대 금지'));
  expect('프롬프트에 키워드 "청년도약계좌" 포함',
    promptResult.includes('청년도약계좌'));
  expect('프롬프트에 저자 "리더남" 포함',
    promptResult.includes('리더남'));

  // ═══════════════════════════════════════════════
  // ⑤ End-to-end: HTML → eeat → schema 통합 시뮬
  // ═══════════════════════════════════════════════
  section('⑤ End-to-end — orchestration.ts 흐름 시뮬');
  let htmlPipeline = '<!-- EEAT_META_PLACEHOLDER -->\n<article><p>청년도약계좌. 통계청 KOSIS 자료에 따르면 가입자 수 증가.</p></article>';
  const eeatStep = buildEeatMeta({
    contentHtml: htmlPipeline,
    title: '청년도약계좌 총정리',
    authorName: '리더남',
    publishedAt: new Date('2026-04-29'),
  });
  htmlPipeline = eeatStep.contentHtml.replace('<!-- EEAT_META_PLACEHOLDER -->', eeatStep.metaBox);

  const schemaStep = buildSchemaJsonLd({
    title: '청년도약계좌 총정리',
    publishedAt: new Date('2026-04-29'),
    authorName: '리더남',
    siteName: '리더남의 경제',
    siteUrl: 'https://example.com',
  });
  htmlPipeline = htmlPipeline.includes('<article')
    ? htmlPipeline.replace(/(<article[^>]*>)/, `${schemaStep.scriptTag}\n$1`)
    : `${schemaStep.scriptTag}\n${htmlPipeline}`;

  expect('최종 HTML에 EEAT_META_PLACEHOLDER 잔존 없음',
    !htmlPipeline.includes('<!-- EEAT_META_PLACEHOLDER -->'));
  expect('최종 HTML에 메타박스 작성자 "리더남" 포함',
    htmlPipeline.includes('리더남'));
  expect('최종 HTML에 cite 변환 결과 포함',
    htmlPipeline.includes('<cite class="eeat-cite">'));
  expect('최종 HTML에 JSON-LD <script> 태그 삽입',
    htmlPipeline.includes('<script type="application/ld+json">'));
  expect('최종 HTML에 Article/BlogPosting Schema 포함',
    /"@type"\s*:\s*"(Article|BlogPosting)"/.test(htmlPipeline));

  // 정책 스캔 — adsense 모드 강제 분기
  const policyStep = scanAdsensePolicy(htmlPipeline);
  expect('정책 스캔 결과 safe 또는 violations 배열',
    typeof policyStep.safe === 'boolean' && Array.isArray(policyStep.violations));

  // ═══════════════════════════════════════════════
  // 결과 출력
  // ═══════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log(`✅ 통과: ${PASSED.length}`);
  console.log(`❌ 실패: ${FAILED.length}`);
  console.log('═'.repeat(70));

  if (FAILED.length > 0) {
    console.log('\n❌ 실패 항목:');
    FAILED.forEach(f => console.log(`   - ${f.label}${f.detail ? ' (' + f.detail + ')' : ''}`));
    process.exit(1);
  } else {
    console.log('\n🎉 모든 함수가 실제로 호출되어 기대 출력을 생성했습니다.');
    process.exit(0);
  }
})().catch(err => {
  console.error('\n💥 dry-run 실패:', err);
  process.exit(2);
});
