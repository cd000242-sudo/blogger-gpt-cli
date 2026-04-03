/**
 * 빠른 검증 스크립트 - 이미 생성된 HTML 파일만 검증
 * 실제 글 생성 없이 test-output.html만 확인
 */

import * as fs from 'fs';
import * as path from 'path';

function quickValidation() {
  console.log('🔍 빠른 검증 시작 (생성된 HTML 파일 분석)...\n');

  const outputPath = path.join(process.cwd(), 'test-output.html');
  
  if (!fs.existsSync(outputPath)) {
    console.error('❌ test-output.html 파일을 찾을 수 없습니다.');
    console.log('💡 먼저 npm run test:post-simple을 실행하여 HTML을 생성하세요.');
    process.exit(1);
  }

  const html = fs.readFileSync(outputPath, 'utf-8');
  console.log(`✅ HTML 파일 로드 완료 (${(html.length / 1024).toFixed(1)}KB)\n`);

  const issues: string[] = [];
  const successes: string[] = [];

  // 1. 홀로그램 성능 최적화 확인
  console.log('📊 1. 홀로그램 성능 최적화 확인...');
  
  const hasWillChange = /will-change/.test(html);
  const hasTranslateZ = /translateZ\(0\)/.test(html);
  const hasBackfaceVisibility = /backface-visibility:\s*hidden/.test(html);
  const hasOptimizedBlur = /blur\(20px\)/.test(html);
  const hasOldBlur = /blur\(40px\)/.test(html);

  if (hasWillChange) {
    successes.push('✅ will-change 속성 사용');
  } else {
    issues.push('⚠️  will-change 속성 없음');
  }

  if (hasTranslateZ) {
    successes.push('✅ translateZ(0) GPU 가속 적용');
  } else {
    issues.push('⚠️  translateZ(0) 없음');
  }

  if (hasBackfaceVisibility) {
    successes.push('✅ backface-visibility: hidden 적용');
  } else {
    issues.push('⚠️  backface-visibility 없음');
  }

  if (hasOptimizedBlur) {
    successes.push('✅ backdrop-filter blur(20px) 최적화 적용');
  } else {
    issues.push('⚠️  blur(20px) 최적화 없음');
  }

  if (hasOldBlur) {
    issues.push('⚠️  구버전 blur(40px) 발견 (성능 저하)');
  }

  // 2. 텍스트 가독성 확인
  console.log('\n📊 2. 텍스트 가독성 확인...');
  
  const hasHighOpacity = /rgba\(255,\s*255,\s*255,\s*0\.99\)/.test(html);
  const hasZIndex2 = /z-index:\s*2/.test(html);
  const hasArticleContent = /\.article-content/.test(html);

  if (hasHighOpacity) {
    successes.push('✅ 배경 불투명도 0.99 적용 (텍스트 가독성 향상)');
  } else {
    issues.push('⚠️  배경 불투명도 낮음 (0.99 미적용)');
  }

  if (hasZIndex2) {
    successes.push('✅ z-index: 2 적용 (텍스트 레이어 분리)');
  } else {
    issues.push('⚠️  z-index: 2 없음');
  }

  if (hasArticleContent) {
    successes.push('✅ .article-content 클래스 사용');
  }

  // 3. CTA URL 확인
  console.log('\n📊 3. CTA URL 확인...');
  
  const ctaMatches = html.match(/href=["'](https?:\/\/[^"']+)["']/gi);
  const ctaCount = ctaMatches ? ctaMatches.length : 0;
  
  if (ctaCount > 0) {
    successes.push(`✅ CTA 링크 발견: ${ctaCount}개`);
    
    // 공식 사이트 확인
    const officialSites = ctaMatches?.filter(url => 
      /gov\.kr|go\.kr|nhis\.or\.kr|kca\.go\.kr|news\.naver\.com/.test(url)
    ).length || 0;
    
    if (officialSites > 0) {
      successes.push(`✅ 공식 사이트 링크: ${officialSites}개`);
    }
    
    // 비공식 사이트 확인
    const unofficialSites = ctaMatches?.filter(url => 
      /blog\.naver\.com|cafe\.naver\.com|tistory\.com|blogspot\.com/.test(url)
    ).length || 0;
    
    if (unofficialSites > 0) {
      issues.push(`⚠️  비공식 사이트 링크 발견: ${unofficialSites}개 (차단되어야 함)`);
    } else {
      successes.push('✅ 비공식 사이트 링크 없음 (필터링 정상 작동)');
    }
  } else {
    issues.push('⚠️  CTA 링크 없음');
  }

  // 4. 흰색 배경 확인
  console.log('\n📊 4. 흰색 배경 제거 확인...');
  
  const whiteBgMatches = html.match(/background[^;]*#ffffff|background[^;]*white[^-]/gi);
  if (whiteBgMatches && whiteBgMatches.length > 0) {
    issues.push(`⚠️  흰색 배경 발견: ${whiteBgMatches.length}개`);
  } else {
    successes.push('✅ 흰색 배경 없음 (연한 회색 사용)');
  }

  // 5. 체크리스트 앵커 확인
  console.log('\n📊 5. 체크리스트 앵커 확인...');
  
  if (html.includes('id="checklist"')) {
    successes.push('✅ 체크리스트 앵커 있음');
  } else {
    issues.push('⚠️  체크리스트 앵커 없음');
  }

  // 6. 접근성 속성 확인
  console.log('\n📊 6. 접근성 속성 확인...');
  
  const tableRoleMatches = html.match(/<table[^>]*role=["']table["']/gi);
  const thScopeMatches = html.match(/<th[^>]*scope=["']col["']/gi);
  
  if (tableRoleMatches && thScopeMatches) {
    successes.push(`✅ 접근성 속성: table role=${tableRoleMatches.length}개, th scope=${thScopeMatches.length}개`);
  } else {
    issues.push(`⚠️  접근성 속성 부족: table role=${tableRoleMatches?.length || 0}, th scope=${thScopeMatches?.length || 0}`);
  }

  // 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('📋 검증 결과');
  console.log('='.repeat(60));
  
  console.log('\n✅ 성공 항목:');
  successes.forEach(s => console.log(`  ${s}`));
  
  if (issues.length > 0) {
    console.log('\n⚠️  발견된 문제점:');
    issues.forEach(issue => console.log(`  ${issue}`));
  } else {
    console.log('\n✅ 모든 검증 항목 통과!');
  }

  const successRate = (successes.length / (successes.length + issues.length) * 100).toFixed(1);
  console.log(`\n📊 통과율: ${successRate}% (${successes.length}/${successes.length + issues.length})`);

  if (issues.length === 0) {
    console.log('\n🎉 모든 최적화가 정상적으로 적용되었습니다!');
    process.exit(0);
  } else {
    console.log('\n🔧 수정이 필요한 항목이 있습니다.');
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  quickValidation();
}

export { quickValidation };





