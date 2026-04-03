/**
 * 상세 검증 스크립트 - 생성된 HTML의 모든 품질 항목 확인
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

interface ValidationResult {
  category: string;
  item: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string | undefined;
}

function detailedValidation() {
  console.log('🔍 상세 검증 시작 (생성된 HTML 파일 전체 분석)...\n');
  console.log('='.repeat(80));

  const outputPath = path.join(process.cwd(), 'test-output.html');
  
  if (!fs.existsSync(outputPath)) {
    console.error('❌ test-output.html 파일을 찾을 수 없습니다.');
    process.exit(1);
  }

  const html = fs.readFileSync(outputPath, 'utf-8');
  const $ = cheerio.load(html);
  
  console.log(`✅ HTML 파일 로드 완료 (${(html.length / 1024).toFixed(1)}KB)\n`);

  const results: ValidationResult[] = [];

  // 1. 홀로그램 성능 최적화
  console.log('📊 1. 홀로그램 성능 최적화 확인...');
  
  const hasWillChange = /will-change/.test(html);
  const hasTranslateZ = /translateZ\(0\)/.test(html);
  const hasBackfaceVisibility = /backface-visibility:\s*hidden/.test(html);
  const hasOptimizedBlur = /blur\(20px\)/.test(html);
  const hasOldBlur = /blur\(40px\)/.test(html);

  results.push({
    category: '성능 최적화',
    item: 'will-change 속성',
    status: hasWillChange ? 'pass' : 'fail',
    message: hasWillChange ? '✅ 적용됨' : '❌ 없음'
  });

  results.push({
    category: '성능 최적화',
    item: 'translateZ(0) GPU 가속',
    status: hasTranslateZ ? 'pass' : 'fail',
    message: hasTranslateZ ? '✅ 적용됨' : '❌ 없음'
  });

  results.push({
    category: '성능 최적화',
    item: 'backface-visibility',
    status: hasBackfaceVisibility ? 'pass' : 'fail',
    message: hasBackfaceVisibility ? '✅ 적용됨' : '❌ 없음'
  });

  results.push({
    category: '성능 최적화',
    item: 'blur(20px) 최적화',
    status: hasOptimizedBlur ? 'pass' : 'fail',
    message: hasOptimizedBlur ? '✅ 적용됨' : '❌ 없음'
  });

  if (hasOldBlur) {
    results.push({
      category: '성능 최적화',
      item: '구버전 blur(40px)',
      status: 'warning',
      message: '⚠️  발견됨 (성능 저하)'
    });
  }

  // 2. 텍스트 가독성
  console.log('\n📊 2. 텍스트 가독성 확인...');
  
  const hasHighOpacity = /rgba\(255,\s*255,\s*255,\s*0\.99\)/.test(html);
  const hasZIndex2 = /z-index:\s*2/.test(html);
  
  results.push({
    category: '텍스트 가독성',
    item: '배경 불투명도 0.99',
    status: hasHighOpacity ? 'pass' : 'fail',
    message: hasHighOpacity ? '✅ 적용됨' : '❌ 낮음'
  });

  results.push({
    category: '텍스트 가독성',
    item: 'z-index: 2',
    status: hasZIndex2 ? 'pass' : 'fail',
    message: hasZIndex2 ? '✅ 적용됨' : '❌ 없음'
  });

  // 3. 텍스트 크기 (어르신 가독성)
  console.log('\n📊 3. 텍스트 크기 확인 (어르신 가독성)...');
  
  const paragraphs = $('p');
  const h2s = $('h2');
  const h3s = $('h3');
  
  let smallTextCount = 0;
  paragraphs.each((_, el) => {
    const $el = $(el);
    const fontSize = $el.css('font-size') || '';
    const fontSizeNum = parseFloat(fontSize);
    if (fontSizeNum > 0 && fontSizeNum < 20) {
      smallTextCount++;
    }
  });

  results.push({
    category: '텍스트 크기',
    item: '본문 텍스트 크기 (최소 20px)',
    status: smallTextCount === 0 ? 'pass' : 'warning',
    message: smallTextCount === 0 
      ? '✅ 모든 본문이 20px 이상' 
      : `⚠️  20px 미만 텍스트 ${smallTextCount}개 발견`,
    details: smallTextCount > 0 ? '어르신 가독성을 위해 최소 20px 권장' : undefined
  });

  // H2, H3 크기 확인
  let smallH2Count = 0;
  h2s.each((_, el) => {
    const $el = $(el);
    const fontSize = $el.css('font-size') || '';
    const fontSizeNum = parseFloat(fontSize);
    if (fontSizeNum > 0 && fontSizeNum < 28) {
      smallH2Count++;
    }
  });

  results.push({
    category: '텍스트 크기',
    item: 'H2 제목 크기 (최소 28px)',
    status: smallH2Count === 0 ? 'pass' : 'warning',
    message: smallH2Count === 0 
      ? '✅ 모든 H2가 28px 이상' 
      : `⚠️  28px 미만 H2 ${smallH2Count}개 발견`
  });

  let smallH3Count = 0;
  h3s.each((_, el) => {
    const $el = $(el);
    const fontSize = $el.css('font-size') || '';
    const fontSizeNum = parseFloat(fontSize);
    if (fontSizeNum > 0 && fontSizeNum < 24) {
      smallH3Count++;
    }
  });

  results.push({
    category: '텍스트 크기',
    item: 'H3 제목 크기 (최소 24px)',
    status: smallH3Count === 0 ? 'pass' : 'warning',
    message: smallH3Count === 0 
      ? '✅ 모든 H3가 24px 이상' 
      : `⚠️  24px 미만 H3 ${smallH3Count}개 발견`
  });

  // 4. 년도 숫자 짤림 확인
  console.log('\n📊 4. 년도 숫자 짤림 확인...');
  
  const yearPattern = /20\d{2}/g;
  const allText = $('body').text();
  const years = allText.match(yearPattern) || [];
  const uniqueYears = [...new Set(years)];
  
  // 년도가 잘린 패턴 확인 (예: "202" 또는 "025")
  const brokenYearPattern = /(?:^|\s)(?:20[0-2]|025|026)(?:\s|$)/;
  const hasBrokenYear = brokenYearPattern.test(allText);
  
  results.push({
    category: '년도 표시',
    item: '년도 숫자 완전성',
    status: !hasBrokenYear ? 'pass' : 'fail',
    message: !hasBrokenYear 
      ? `✅ 년도 정상 표시 (${uniqueYears.join(', ')})` 
      : '❌ 년도 숫자 짤림 발견',
    details: hasBrokenYear ? 'word-break나 overflow로 인한 년도 숫자 짤림 확인 필요' : undefined
  });

  // 5. 문단 정리 확인
  console.log('\n📊 5. 문단 정리 확인...');
  
  const paragraphTexts: string[] = [];
  paragraphs.each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10) {
      paragraphTexts.push(text);
    }
  });

  // 문단 길이 확인 (너무 짧거나 너무 긴 문단)
  const shortParagraphs = paragraphTexts.filter(p => p.length < 50).length;
  const longParagraphs = paragraphTexts.filter(p => p.length > 500).length;
  
  results.push({
    category: '문단 정리',
    item: '문단 길이 적절성',
    status: shortParagraphs === 0 && longParagraphs === 0 ? 'pass' : 'warning',
    message: shortParagraphs === 0 && longParagraphs === 0
      ? `✅ 문단 길이 적절 (총 ${paragraphTexts.length}개 문단)`
      : `⚠️  짧은 문단 ${shortParagraphs}개, 긴 문단 ${longParagraphs}개`,
    details: paragraphTexts.length > 0 ? `평균 문단 길이: ${Math.round(paragraphTexts.reduce((a, b) => a + b.length, 0) / paragraphTexts.length)}자` : undefined
  });

  // 6. H2, H3 내용 확인
  console.log('\n📊 6. H2, H3 내용 확인...');
  
  const h2Texts: string[] = [];
  h2s.each((_, el) => {
    const text = $(el).text().trim();
    if (text) h2Texts.push(text);
  });

  const h3Texts: string[] = [];
  h3s.each((_, el) => {
    const text = $(el).text().trim();
    if (text) h3Texts.push(text);
  });

  results.push({
    category: '제목 구조',
    item: 'H2 제목',
    status: h2Texts.length >= 3 ? 'pass' : 'warning',
    message: `✅ H2 제목 ${h2Texts.length}개`,
    details: h2Texts.length > 0 ? h2Texts.slice(0, 5).join(', ') : undefined
  });

  results.push({
    category: '제목 구조',
    item: 'H3 제목',
    status: h3Texts.length >= 2 ? 'pass' : 'warning',
    message: `✅ H3 제목 ${h3Texts.length}개`,
    details: h3Texts.length > 0 ? h3Texts.slice(0, 5).join(', ') : undefined
  });

  // 7. 박스 스킨 확인
  console.log('\n📊 7. 박스 스킨 확인...');
  
  const hasHologramSkin = /hologram-skin|wp-hologram|blogger-hologram/.test(html);
  const hasBoxShadow = /box-shadow/.test(html);
  const hasBorderRadius = /border-radius/.test(html);
  
  results.push({
    category: '박스 스킨',
    item: '홀로그램 스킨',
    status: hasHologramSkin ? 'pass' : 'warning',
    message: hasHologramSkin ? '✅ 홀로그램 스킨 적용됨' : '⚠️  홀로그램 스킨 없음'
  });

  results.push({
    category: '박스 스킨',
    item: 'box-shadow 효과',
    status: hasBoxShadow ? 'pass' : 'warning',
    message: hasBoxShadow ? '✅ box-shadow 적용됨' : '⚠️  box-shadow 없음'
  });

  results.push({
    category: '박스 스킨',
    item: 'border-radius',
    status: hasBorderRadius ? 'pass' : 'warning',
    message: hasBorderRadius ? '✅ border-radius 적용됨' : '⚠️  border-radius 없음'
  });

  // 8. AI 느낌/자연스러운 말투 확인
  console.log('\n📊 8. AI 느낌/자연스러운 말투 확인...');
  
  const aiPatterns = [
    /이 글에서는/gi,
    /본 글에서는/gi,
    /이번 글에서는/gi,
    /다음과 같이/gi,
    /참고하시기 바랍니다/gi,
    /알아두시면 좋습니다/gi,
    /이러한/gi,
    /이러한 점을/gi,
  ];
  
  let aiPatternCount = 0;
  const foundPatterns: string[] = [];
  
  aiPatterns.forEach(pattern => {
    const matches = allText.match(pattern);
    if (matches) {
      aiPatternCount += matches.length;
      foundPatterns.push(pattern.source);
    }
  });

  results.push({
    category: '자연스러운 말투',
    item: 'AI 느낌 문구',
    status: aiPatternCount < 5 ? 'pass' : 'warning',
    message: aiPatternCount < 5 
      ? `✅ 자연스러운 말투 (AI 패턴 ${aiPatternCount}개)` 
      : `⚠️  AI 느낌 문구 다수 발견 (${aiPatternCount}개)`,
    details: foundPatterns.length > 0 ? `발견된 패턴: ${foundPatterns.slice(0, 3).join(', ')}` : undefined
  });

  // 9. 정보 전달 정확성 (기본 체크)
  console.log('\n📊 9. 정보 전달 정확성 확인...');
  
  // 중복 문구 확인
  const sentences = allText.split(/[.!?]\s+/).filter(s => s.length > 20);
  const duplicateSentences = new Set<string>();
  const duplicates: string[] = [];
  
  sentences.forEach(sentence => {
    const normalized = sentence.trim().toLowerCase();
    if (duplicateSentences.has(normalized)) {
      duplicates.push(sentence.substring(0, 50));
    } else {
      duplicateSentences.add(normalized);
    }
  });

  results.push({
    category: '정보 전달',
    item: '중복 문구',
    status: duplicates.length < 3 ? 'pass' : 'warning',
    message: duplicates.length < 3 
      ? `✅ 중복 문구 적음 (${duplicates.length}개)` 
      : `⚠️  중복 문구 다수 (${duplicates.length}개)`
  });

  // 10. CTA URL 검증
  console.log('\n📊 10. CTA URL 검증...');
  
  const ctaLinks = $('a[href^="http"]');
  const officialSites: string[] = [];
  const unofficialSites: string[] = [];
  
  ctaLinks.each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/gov\.kr|go\.kr|nhis\.or\.kr|kca\.go\.kr|news\.naver\.com/.test(href)) {
      officialSites.push(href);
    } else if (/blog\.naver\.com|cafe\.naver\.com|tistory\.com|blogspot\.com/.test(href)) {
      unofficialSites.push(href);
    }
  });

  results.push({
    category: 'CTA URL',
    item: '공식 사이트 링크',
    status: officialSites.length > 0 ? 'pass' : 'warning',
    message: `✅ 공식 사이트 링크 ${officialSites.length}개`
  });

  results.push({
    category: 'CTA URL',
    item: '비공식 사이트 필터링',
    status: unofficialSites.length === 0 ? 'pass' : 'fail',
    message: unofficialSites.length === 0 
      ? '✅ 비공식 사이트 차단됨' 
      : `❌ 비공식 사이트 ${unofficialSites.length}개 발견`
  });

  // 11. 흰색 배경 제거
  console.log('\n📊 11. 흰색 배경 제거 확인...');
  
  const whiteBgMatches = html.match(/background[^;]*#ffffff|background[^;]*white[^-]/gi);
  results.push({
    category: '배경색',
    item: '흰색 배경 제거',
    status: !whiteBgMatches || whiteBgMatches.length === 0 ? 'pass' : 'warning',
    message: !whiteBgMatches || whiteBgMatches.length === 0 
      ? '✅ 흰색 배경 없음' 
      : `⚠️  흰색 배경 ${whiteBgMatches.length}개 발견`
  });

  // 결과 출력
  console.log('\n' + '='.repeat(80));
  console.log('📋 상세 검증 결과');
  console.log('='.repeat(80));

  const categories = [...new Set(results.map(r => r.category))];
  
  categories.forEach(category => {
    console.log(`\n📁 ${category}:`);
    const categoryResults = results.filter(r => r.category === category);
    categoryResults.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`  ${icon} ${result.item}: ${result.message}`);
      if (result.details) {
        console.log(`     └─ ${result.details}`);
      }
    });
  });

  // 통계
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const totalCount = results.length;
  const passRate = ((passCount / totalCount) * 100).toFixed(1);

  console.log('\n' + '='.repeat(80));
  console.log('📊 통계');
  console.log('='.repeat(80));
  console.log(`✅ 통과: ${passCount}개`);
  console.log(`⚠️  경고: ${warningCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log(`📈 통과율: ${passRate}% (${passCount}/${totalCount})`);

  if (failCount === 0 && warningCount === 0) {
    console.log('\n🎉 모든 검증 항목 통과!');
    process.exit(0);
  } else {
    console.log('\n🔧 수정이 필요한 항목이 있습니다.');
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  detailedValidation();
}

export { detailedValidation };

