/**
 * 발행된 글 HTML 분석 스크립트
 * https://tjdgus24280.blogspot.com/2025/11/2026_01767046436.html 분석
 */

import * as fs from 'fs';
import * as path from 'path';

// 웹에서 복사한 HTML 내용 (발행된 글의 본문)
const publishedHTML = `
<!-- 발행된 글의 HTML을 여기에 붙여넣기 -->
<div class="max-mode-article blogger-skin blogger-hologram-skin" style="max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;">
  <div class="article-content" style="max-width: 100% !important; width: 100% !important; min-width: 100% !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; overflow: visible !important;">
    
<div style="margin:40px 0; padding:18px 24px; background:linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(236, 253, 245, 0.45) 100%); border-radius:20px; box-shadow:0 20px 42px rgba(16, 185, 129, 0.18); border:1px solid rgba(16, 185, 129, 0.32); position:relative; overflow:hidden;">
  <h2 style="font-size:clamp(1.52rem, 1.8vw + 1rem, 1.9rem); margin:0; padding:0; color:#064e3b; text-align:left; font-weight:800; letter-spacing:-0.01em; line-height:1.28; word-break:keep-all; overflow-wrap:break-word; white-space:normal; position:relative; z-index:1;"><span class="heading-number h2-number">1.</span> 연말정산, 놓치면 손해! 절세 꿀팁</h2>
</div>

<div style="margin:30px 0 20px 0; padding:18px 22px; background:linear-gradient(135deg, #fd79a8 0%, #ffeaa7 100%); border-radius:15px; box-shadow:0 6px 20px rgba(253,121,168,0.3); border-left:6px solid #ffffff; position:relative;">
  <div style="position:absolute; bottom:0; left:0; width:100px; height:100px; background:radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); border-radius:50%; transform:translate(-20%, 20%);"></div>
  <h3 style="font-size:24px; font-weight:700; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 8px rgba(0,0,0,0.15); position:relative; z-index:1;"><span class="heading-number h3-number">1-1.</span> 서론 - 사용자 가이드</h3>
</div>

<p style="font-size:20px; line-height:1.9; color:#2c3e50; margin:0 0 28px 0; font-weight:400;">2026년, 13월의 월급이라 불리는 연말정산 시즌이 다가옵니다...</p>

<!-- ... 더 많은 내용 ... -->

  </div>
</div>
`;

function analyzePublishedPost() {
  console.log('🔍 발행된 글 HTML 구조 분석 시작...\n');
  
  const html = publishedHTML;
  
  // 1. 기본 통계
  console.log('📊 기본 통계:');
  console.log(`  - 전체 길이: ${html.length.toLocaleString()}자`);
  console.log(`  - 순수 텍스트: ${html.replace(/<[^>]*>/g, '').length.toLocaleString()}자`);
  
  // 2. H2 제목 추출
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const h2Titles: string[] = [];
  let h2Match;
  
  while ((h2Match = h2Regex.exec(html)) !== null) {
    if (h2Match[1]) {
      const cleanTitle = h2Match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&[^;]+;/g, '')
        .trim();
      h2Titles.push(cleanTitle);
    }
  }
  
  console.log(`\n📋 H2 제목 (총 ${h2Titles.length}개):`);
  h2Titles.forEach((title, idx) => {
    console.log(`  ${idx + 1}. ${title}`);
  });
  
  // 3. H3 소제목 추출
  const h3Regex = /<h3[^>]*>(.*?)<\/h3>/gi;
  const h3Titles: string[] = [];
  let h3Match;
  
  while ((h3Match = h3Regex.exec(html)) !== null) {
    if (h3Match[1]) {
      const cleanTitle = h3Match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&[^;]+;/g, '')
        .trim();
      h3Titles.push(cleanTitle);
    }
  }
  
  console.log(`\n📋 H3 소제목 (총 ${h3Titles.length}개):`);
  h3Titles.forEach((title, idx) => {
    console.log(`  ${idx + 1}. ${title}`);
  });
  
  // 4. 문단 개수
  const pCount = (html.match(/<p[^>]*>/gi) || []).length;
  console.log(`\n📝 문단(P) 개수: ${pCount}개`);
  
  // 5. 섹션 개수
  const sectionCount = (html.match(/<div[^>]*class="[^"]*section[^"]*"/gi) || []).length;
  console.log(`📦 섹션(div.section) 개수: ${sectionCount}개`);
  
  // 6. 테이블 개수
  const tableCount = (html.match(/<table[^>]*>/gi) || []).length;
  console.log(`📊 테이블 개수: ${tableCount}개`);
  
  // 7. CTA 버튼 개수
  const ctaCount = (html.match(/cta-button|cta-responsive-button/gi) || []).length;
  console.log(`🔗 CTA 버튼 개수: ${ctaCount}개`);
  
  // 8. 문제점 분석
  console.log('\n🚨 문제점 분석:');
  
  const issues: string[] = [];
  
  if (h2Titles.length !== 5) {
    issues.push(`⚠️ H2 개수 불일치: 예상 5개 (서론, 핵심1, 핵심2, 핵심3, 결론), 실제 ${h2Titles.length}개`);
  }
  
  // H2 제목 패턴 분석
  const expectedSections = ['서론', '핵심 내용 1', '핵심 내용 2', '핵심 내용 3', '결론'];
  const missingSections: string[] = [];
  
  expectedSections.forEach((expected, idx) => {
    const h2Title = h2Titles[idx];
    if (!h2Title || !h2Title.includes(expected.split(' ')[0])) {
      missingSections.push(`${idx + 1}번 섹션 ("${expected}")`);
    }
  });
  
  if (missingSections.length > 0) {
    issues.push(`⚠️ 누락된 섹션: ${missingSections.join(', ')}`);
  }
  
  // H3 번호 체계 확인
  const h3NumberPattern = /^(\d+)-(\d+)\./;
  const h3NumberIssues: string[] = [];
  
  h3Titles.forEach((title, idx) => {
    const match = title.match(h3NumberPattern);
    if (!match) {
      h3NumberIssues.push(`${idx + 1}번: "${title}" (번호 패턴 없음)`);
    }
  });
  
  if (h3NumberIssues.length > 0) {
    issues.push(`⚠️ H3 번호 체계 문제: ${h3NumberIssues.slice(0, 3).join(', ')}${h3NumberIssues.length > 3 ? ` 외 ${h3NumberIssues.length - 3}개` : ''}`);
  }
  
  // 내용 중복 체크
  const textOnly = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const paragraphs = textOnly.split(/\.[\s]+/).filter(p => p.trim().length > 20);
  const uniqueParagraphs = new Set(paragraphs);
  const duplicateRate = ((paragraphs.length - uniqueParagraphs.size) / paragraphs.length * 100).toFixed(1);
  
  if (parseFloat(duplicateRate) > 10) {
    issues.push(`⚠️ 중복 문장 비율: ${duplicateRate}% (10% 이상)`);
  }
  
  // 짧은 섹션 체크 (H2 사이 텍스트 길이)
  const h2Positions: number[] = [];
  let pos = 0;
  while ((pos = html.indexOf('<h2', pos)) !== -1) {
    h2Positions.push(pos);
    pos++;
  }
  
  const shortSections: string[] = [];
  for (let i = 0; i < h2Positions.length - 1; i++) {
    const start = h2Positions[i];
    const end = h2Positions[i + 1];
    if (start !== undefined && end !== undefined) {
      const sectionHtml = html.substring(start, end);
      const sectionText = sectionHtml.replace(/<[^>]*>/g, '').trim();
      if (sectionText.length < 500) {
        shortSections.push(`${i + 1}번 섹션 (${sectionText.length}자)`);
      }
    }
  }
  
  if (shortSections.length > 0) {
    issues.push(`⚠️ 너무 짧은 섹션: ${shortSections.join(', ')}`);
  }
  
  if (issues.length === 0) {
    console.log('  ✅ 문제점 없음');
  } else {
    console.log(`  발견된 문제: ${issues.length}개`);
    issues.forEach(issue => console.log(`    ${issue}`));
  }
  
  // 9. 예상 구조 vs 실제 구조 비교
  console.log('\n📐 예상 구조 vs 실제 구조:');
  console.log('  예상:');
  console.log('    1. 서론 (introduction)');
  console.log('    2. 핵심 내용 1 (core1)');
  console.log('    3. 핵심 내용 2 (core2)');
  console.log('    4. 핵심 내용 3 (core3)');
  console.log('    5. 결론 (conclusion)');
  console.log('  실제:');
  h2Titles.forEach((title, idx) => {
    console.log(`    ${idx + 1}. ${title}`);
  });
  
  // 10. 분석 리포트 저장
  const report = {
    timestamp: new Date().toISOString(),
    url: 'https://tjdgus24280.blogspot.com/2025/11/2026_01767046436.html',
    analysis: {
      totalLength: html.length,
      textLength: html.replace(/<[^>]*>/g, '').length,
      h2Count: h2Titles.length,
      h3Count: h3Titles.length,
      pCount,
      sectionCount,
      tableCount,
      ctaCount
    },
    structure: {
      h2Titles,
      h3Titles,
      expectedSections,
      missingSections
    },
    issues,
    recommendations: [
      '1. 5개 섹션 구조가 제대로 생성되도록 AI 프롬프트 개선 필요',
      '2. 섹션 후처리 로직에서 내용이 잘리지 않도록 수정 필요',
      '3. H2/H3 번호 체계가 일관되게 유지되도록 수정 필요',
      '4. 각 섹션의 최소 글자수 보장 로직 강화 필요'
    ]
  };
  
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDir, `발행된글-분석-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  
  console.log(`\n💾 분석 리포트 저장: ${reportPath}`);
  console.log('\n✅ 분석 완료!');
}

// 실행
analyzePublishedPost();




