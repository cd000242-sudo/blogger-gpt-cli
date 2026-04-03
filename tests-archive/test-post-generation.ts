/**
 * 글 생성 및 포스팅 테스트 스크립트
 * 실제 API 키를 사용하여 글을 생성하고 포스팅한 후 결과를 확인합니다.
 */

import { generateMaxModeArticle } from './src/core/index';
import { publishGeneratedContent } from './src/core/index';
import { loadEnvFromFile } from './src/env';

async function testPostGeneration() {
  console.log('🚀 글 생성 및 포스팅 테스트 시작...\n');

  // 환경 변수 로드 (모든 소스에서)
  const env = loadEnvFromFile();
  
  // 모든 가능한 키 이름으로 검색
  const getAllKeys = (obj: Record<string, any>): string[] => {
    const keys: string[] = [];
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        keys.push(key);
        keys.push(key.toLowerCase());
        keys.push(key.toUpperCase());
      }
    }
    return keys;
  };
  
  // 필수 API 키 확인 (모든 가능한 키 이름 확인)
  const geminiKey = process.env['GEMINI_API_KEY'] 
    || process.env['GEMINI_KEY']
    || process.env['geminiApiKey']
    || process.env['geminiKey']
    || env?.['geminiApiKey'] 
    || env?.['GEMINI_API_KEY']
    || env?.['geminiKey']
    || env?.['gemini']
    || env?.['GEMINI_KEY']
    || env?.['GEMINI']
    || (env && Object.values(env).find((v: any) => typeof v === 'string' && v.length > 30 && v.startsWith('AI'))) as string | undefined;
  
  console.log('🔍 환경 변수 검색 결과:');
  console.log(`  - process.env.GEMINI_API_KEY: ${process.env['GEMINI_API_KEY'] ? `있음 (${process.env['GEMINI_API_KEY'].substring(0, 10)}...)` : '없음'}`);
  console.log(`  - env 객체 키 개수: ${Object.keys(env || {}).length}개`);
  console.log(`  - env에서 gemini 관련 키: ${Object.keys(env || {}).filter(k => /gemini/i.test(k)).join(', ') || '없음'}`);
  
  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY를 찾을 수 없습니다.');
    console.log('💡 .env 파일에 다음 중 하나를 설정해주세요:');
    console.log('   - GEMINI_API_KEY=your_key');
    console.log('   - geminiApiKey=your_key');
    console.log('   - geminiKey=your_key');
    console.log(`💡 현재 env 객체의 키: ${Object.keys(env || {}).slice(0, 20).join(', ')}`);
    process.exit(1);
  }
  
  console.log(`✅ Gemini API 키 발견: ${geminiKey.substring(0, 15)}...`);

  // 테스트용 payload 생성
  const testPayload = {
    provider: 'gemini',
    geminiKey: geminiKey,
    topic: '2025년 인공지능 트렌드',
    keywords: ['인공지능', 'AI', '머신러닝', '딥러닝', '2025'],
    minChars: 3000,
    contentMode: 'external',
    platform: 'blogger', // 또는 'wordpress'
    blogId: process.env['BLOGGER_BLOG_ID'] || env?.['bloggerBlogId'] || env?.['BLOGGER_BLOG_ID'],
    googleClientId: process.env['GOOGLE_CLIENT_ID'] || env?.['googleClientId'] || env?.['GOOGLE_CLIENT_ID'],
    googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] || env?.['googleClientSecret'] || env?.['GOOGLE_CLIENT_SECRET'],
    redirectUri: process.env['GOOGLE_REDIRECT_URI'] || env?.['googleRedirectUri'] || env?.['GOOGLE_REDIRECT_URI'] || 'http://localhost:3000/oauth2callback',
    postingMode: 'draft', // 테스트이므로 draft로 설정
    thumbnailMode: 'text',
    sectionImageMode: 'none',
  };

  console.log('📝 테스트 주제:', testPayload.topic);
  console.log('🔑 API 키 확인:', geminiKey ? `있음 (${geminiKey.substring(0, 10)}...)` : '없음');
  console.log('📌 플랫폼:', testPayload.platform);
  console.log('📌 발행 모드:', testPayload.postingMode);
  console.log('');

  // 로그 콜백 함수
  const onLog = (message: string) => {
    console.log(`[LOG] ${message}`);
  };

  try {
    // 1. 글 생성
    console.log('📝 1단계: 글 생성 중...');
    const startTime = Date.now();
    
    const result = await generateMaxModeArticle(testPayload, env, onLog);
    
    const generationTime = Date.now() - startTime;
    console.log(`\n✅ 글 생성 완료 (소요 시간: ${(generationTime / 1000).toFixed(2)}초)`);
    console.log(`📄 제목: ${result.title}`);
    console.log(`📏 HTML 길이: ${result.html.length}자`);
    console.log(`🏷️  라벨: ${result.labels.join(', ')}`);
    console.log(`🖼️  썸네일: ${result.thumbnail ? '생성됨' : '없음'}`);
    console.log('');

    // 2. 생성된 HTML 검증
    console.log('🔍 2단계: 생성된 HTML 검증 중...');
    const html = result.html;
    
    // 흰색 배경 확인
    const whiteBackgroundMatches = html.match(/background[^;]*#ffffff|background[^;]*white[^-]/gi);
    if (whiteBackgroundMatches && whiteBackgroundMatches.length > 0) {
      console.warn(`⚠️  흰색 배경 발견: ${whiteBackgroundMatches.length}개`);
      console.warn('   발견된 위치:', whiteBackgroundMatches.slice(0, 3).join(', '));
    } else {
      console.log('✅ 흰색 배경 없음 (정상)');
    }

    // 표 배경색 확인
    const tableBackgroundMatches = html.match(/<table[^>]*background[^>]*>/gi);
    if (tableBackgroundMatches) {
      console.log(`📊 표 발견: ${tableBackgroundMatches.length}개`);
      // 연한 회색 배경 확인
      const grayBackgroundMatches = html.match(/background[^;]*#[fF][0-9a-fA-F]{5}/g);
      if (grayBackgroundMatches) {
        console.log(`✅ 연한 회색 배경 사용: ${grayBackgroundMatches.length}개`);
      }
    }

    // 체크리스트 앵커 확인
    if (html.includes('id="checklist"')) {
      console.log('✅ 체크리스트 앵커 있음');
    } else {
      console.warn('⚠️  체크리스트 앵커 없음');
    }

    // 접근성 속성 확인
    const tableRoleMatches = html.match(/<table[^>]*role=["']table["']/gi);
    const thScopeMatches = html.match(/<th[^>]*scope=["']col["']/gi);
    if (tableRoleMatches && thScopeMatches) {
      console.log(`✅ 접근성 속성: table role=${tableRoleMatches.length}개, th scope=${thScopeMatches.length}개`);
    } else {
      console.warn('⚠️  접근성 속성 부족');
    }

    // CTA 배치 확인
    const ctaMatches = html.match(/data-cta-role|section-cta/gi);
    if (ctaMatches) {
      console.log(`✅ CTA 발견: ${ctaMatches.length}개`);
    }

    console.log('');

    // 3. 실제 포스팅 (환경 변수에서 blogId 확인)
    const blogId = testPayload.blogId || env?.['bloggerBlogId'] || env?.['BLOGGER_BLOG_ID'] || env?.['blogId'] || env?.['BLOG_ID'];
    const googleClientId = testPayload.googleClientId || env?.['googleClientId'] || env?.['GOOGLE_CLIENT_ID'];
    const googleClientSecret = testPayload.googleClientSecret || env?.['googleClientSecret'] || env?.['GOOGLE_CLIENT_SECRET'];
    
    if (testPayload.postingMode === 'draft' && blogId) {
      console.log('\n📤 3단계: Blogger에 초안으로 발행 중...');
      console.log(`📌 Blog ID: ${blogId}`);
      console.log(`📌 Google Client ID: ${googleClientId ? '있음' : '없음'}`);
      
      // payload 업데이트
      testPayload.blogId = blogId;
      if (googleClientId) testPayload.googleClientId = googleClientId;
      if (googleClientSecret) testPayload.googleClientSecret = googleClientSecret;
      
      try {
        const publishResult = await publishGeneratedContent(
          testPayload,
          result.title,
          result.html,
          result.thumbnail,
          onLog
        );

        if (publishResult.ok) {
          console.log('\n✅ 포스팅 성공!');
          console.log(`🔗 URL: ${publishResult.url || 'N/A'}`);
          console.log(`📝 포스트 ID: ${publishResult.id || 'N/A'}`);
          if (publishResult.thumbnail) {
            console.log(`🖼️  썸네일 URL: ${publishResult.thumbnail}`);
          }
          
          // 포스팅 결과 분석
          console.log('\n📊 포스팅 결과 분석:');
          if (publishResult.url) {
            console.log(`✅ 포스팅 URL 확인: ${publishResult.url}`);
            console.log('💡 브라우저에서 위 URL을 열어 결과를 확인하세요.');
          }
        } else {
          console.error('\n❌ 포스팅 실패:', publishResult.error);
          if (publishResult.needsAuth) {
            console.log('💡 인증이 필요합니다. OAuth 인증을 진행해주세요.');
          }
        }
      } catch (publishError: any) {
        console.error('\n❌ 포스팅 중 오류:', publishError?.message || publishError);
        console.error('스택:', publishError?.stack);
      }
    } else {
      console.log('\n⏭️  3단계: 포스팅 건너뜀');
      if (!blogId) {
        console.log('⚠️  blogId가 설정되지 않았습니다.');
        console.log('💡 .env 파일에 다음을 설정해주세요:');
        console.log('   - BLOGGER_BLOG_ID=your_blog_id');
        console.log('   - 또는 blogId=your_blog_id');
      }
      if (testPayload.postingMode !== 'draft') {
        console.log(`⚠️  postingMode가 'draft'가 아닙니다: ${testPayload.postingMode}`);
      }
    }

    console.log('\n✅ 테스트 완료!');
    
    // HTML 파일로 저장 (검토용)
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(process.cwd(), 'test-output.html');
    fs.writeFileSync(outputPath, result.html, 'utf-8');
    console.log(`\n💾 생성된 HTML 저장: ${outputPath}`);
    console.log('💡 브라우저에서 위 파일을 열어 결과를 확인할 수 있습니다.');
    
    // 문제점 분석 리포트 생성
    console.log('\n📋 문제점 분석 리포트:');
    const issues: string[] = [];
    
    // 흰색 배경 체크
    const whiteBgMatches = result.html.match(/background[^;]*#ffffff|background[^;]*white[^-]/gi);
    if (whiteBgMatches && whiteBgMatches.length > 0) {
      issues.push(`⚠️  흰색 배경 발견: ${whiteBgMatches.length}개`);
    } else {
      console.log('✅ 흰색 배경 없음');
    }
    
    // 표 스타일 체크
    const tableMatches = result.html.match(/<table[^>]*>/gi);
    if (tableMatches) {
      const grayBgMatches = result.html.match(/background[^;]*#[fF][0-9a-fA-F]{5}/g);
      if (grayBgMatches) {
        console.log(`✅ 표 배경색 정상: 연한 회색 사용 (${grayBgMatches.length}개)`);
      } else {
        issues.push('⚠️  표 배경색 확인 필요');
      }
    }
    
    // 체크리스트 앵커 체크
    if (!result.html.includes('id="checklist"')) {
      issues.push('⚠️  체크리스트 앵커 없음');
    } else {
      console.log('✅ 체크리스트 앵커 있음');
    }
    
    // 접근성 체크
    const tableRoleCount = (result.html.match(/<table[^>]*role=["']table["']/gi) || []).length;
    const thScopeCount = (result.html.match(/<th[^>]*scope=["']col["']/gi) || []).length;
    if (tableRoleCount === 0 || thScopeCount === 0) {
      issues.push(`⚠️  접근성 속성 부족: table role=${tableRoleCount}, th scope=${thScopeCount}`);
    } else {
      console.log(`✅ 접근성 속성 정상: table role=${tableRoleCount}, th scope=${thScopeCount}`);
    }
    
    // CTA 배치 체크
    const ctaCount = (result.html.match(/data-cta-role|section-cta/gi) || []).length;
    if (ctaCount === 0) {
      issues.push('⚠️  CTA 없음');
    } else {
      console.log(`✅ CTA 발견: ${ctaCount}개`);
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️  발견된 문제점:');
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('\n✅ 모든 검증 항목 통과!');
    }

  } catch (error: any) {
    console.error('\n❌ 테스트 실패:', error?.message || error);
    console.error('스택 트레이스:', error?.stack);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testPostGeneration().catch(console.error);
}

export { testPostGeneration };

