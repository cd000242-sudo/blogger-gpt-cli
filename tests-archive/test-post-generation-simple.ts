/**
 * 간단한 글 생성 및 포스팅 테스트 스크립트
 * 환경 변수를 직접 읽어서 테스트하고 결과를 분석합니다.
 */

import { generateMaxModeArticle } from './src/core/index';
import { publishGeneratedContent } from './src/core/index';
import { loadEnvFromFile } from './src/env';

async function testPostGeneration() {
  console.log('🚀 글 생성 및 포스팅 테스트 시작...\n');

  // 환경 변수 로드
  const env = loadEnvFromFile();
  
  // Gemini API 키 찾기
  const geminiKey = process.env['GEMINI_API_KEY'] 
    || process.env['GEMINI_KEY']
    || env?.['geminiApiKey'] 
    || env?.['GEMINI_API_KEY']
    || env?.['geminiKey']
    || env?.['gemini'];
  
  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY를 찾을 수 없습니다.');
    console.log('💡 .env 파일에 GEMINI_API_KEY를 설정해주세요.');
    process.exit(1);
  }
  
  console.log(`✅ Gemini API 키 발견: ${geminiKey.substring(0, 15)}...\n`);

  // 테스트용 payload 생성
  const testPayload = {
    provider: 'gemini',
    geminiKey: geminiKey,
    topic: '2025년 인공지능 트렌드',
    keywords: ['인공지능', 'AI', '머신러닝', '딥러닝', '2025'],
    minChars: 2000, // 테스트이므로 짧게
    contentMode: 'external',
    platform: 'blogger',
    blogId: env?.['bloggerBlogId'] || env?.['BLOGGER_BLOG_ID'] || env?.['blogId'] || env?.['BLOG_ID'],
    googleClientId: env?.['googleClientId'] || env?.['GOOGLE_CLIENT_ID'],
    googleClientSecret: env?.['googleClientSecret'] || env?.['GOOGLE_CLIENT_SECRET'],
    redirectUri: env?.['googleRedirectUri'] || env?.['GOOGLE_REDIRECT_URI'] || 'http://localhost:3000/oauth2callback',
    postingMode: 'draft',
    thumbnailMode: 'text',
    sectionImageMode: 'none',
  };

  console.log('📝 테스트 설정:');
  console.log(`  - 주제: ${testPayload.topic}`);
  console.log(`  - 플랫폼: ${testPayload.platform}`);
  console.log(`  - 발행 모드: ${testPayload.postingMode}`);
  console.log(`  - Blog ID: ${testPayload.blogId || '없음'}\n`);

  // 간단한 로그 콜백 (중요한 것만)
  const onLog = (message: string) => {
    if (message.includes('완료') || message.includes('실패') || message.includes('오류') || message.includes('✅') || message.includes('❌')) {
      console.log(`[LOG] ${message}`);
    }
  };

  try {
    // 1. 글 생성
    console.log('📝 1단계: 글 생성 중...');
    const startTime = Date.now();
    
    const result = await generateMaxModeArticle(testPayload, env, onLog);
    
    const generationTime = Date.now() - startTime;
    console.log(`\n✅ 글 생성 완료 (${(generationTime / 1000).toFixed(1)}초)`);
    console.log(`📄 제목: ${result.title}`);
    console.log(`📏 HTML 길이: ${result.html.length.toLocaleString()}자`);
    console.log(`🏷️  라벨: ${result.labels.join(', ')}`);
    console.log(`🖼️  썸네일: ${result.thumbnail ? '생성됨' : '없음'}\n`);

    // 2. 생성된 HTML 검증
    console.log('🔍 2단계: 생성된 HTML 검증 중...');
    const html = result.html;
    const issues: string[] = [];
    const successes: string[] = [];
    
    // 흰색 배경 확인
    const whiteBgMatches = html.match(/background[^;]*#ffffff|background[^;]*white[^-]/gi);
    if (whiteBgMatches && whiteBgMatches.length > 0) {
      issues.push(`⚠️  흰색 배경 발견: ${whiteBgMatches.length}개`);
    } else {
      successes.push('✅ 흰색 배경 없음');
    }

    // 표 배경색 확인
    const tableMatches = html.match(/<table[^>]*>/gi);
    if (tableMatches) {
      const grayBgMatches = html.match(/background[^;]*#[fF][0-9a-fA-F]{5}/g);
      if (grayBgMatches) {
        successes.push(`✅ 표 배경색 정상: 연한 회색 사용 (${grayBgMatches.length}개)`);
      } else {
        issues.push('⚠️  표 배경색 확인 필요');
      }
    }

    // 체크리스트 앵커 확인
    if (html.includes('id="checklist"')) {
      successes.push('✅ 체크리스트 앵커 있음');
    } else {
      issues.push('⚠️  체크리스트 앵커 없음');
    }

    // 접근성 속성 확인
    const tableRoleMatches = html.match(/<table[^>]*role=["']table["']/gi);
    const thScopeMatches = html.match(/<th[^>]*scope=["']col["']/gi);
    if (tableRoleMatches && thScopeMatches) {
      successes.push(`✅ 접근성 속성: table role=${tableRoleMatches.length}개, th scope=${thScopeMatches.length}개`);
    } else {
      issues.push(`⚠️  접근성 속성 부족: table role=${tableRoleMatches?.length || 0}, th scope=${thScopeMatches?.length || 0}`);
    }

    // CTA 배치 확인
    const ctaMatches = html.match(/data-cta-role|section-cta/gi);
    if (ctaMatches) {
      successes.push(`✅ CTA 발견: ${ctaMatches.length}개`);
    } else {
      issues.push('⚠️  CTA 없음');
    }

    console.log('\n📋 검증 결과:');
    successes.forEach(s => console.log(`  ${s}`));
    if (issues.length > 0) {
      console.log('\n⚠️  발견된 문제점:');
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('\n✅ 모든 검증 항목 통과!');
    }

    // 3. 실제 포스팅
    if (testPayload.blogId) {
      console.log('\n📤 3단계: Blogger에 초안으로 발행 중...');
      
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
          console.log('\n💡 브라우저에서 위 URL을 열어 결과를 확인하세요.');
        } else {
          console.error('\n❌ 포스팅 실패:', publishResult.error);
          if (publishResult.needsAuth) {
            console.log('💡 인증이 필요합니다. OAuth 인증을 진행해주세요.');
          }
        }
      } catch (publishError: any) {
        console.error('\n❌ 포스팅 중 오류:', publishError?.message || publishError);
      }
    } else {
      console.log('\n⏭️  3단계: 포스팅 건너뜀 (blogId 없음)');
    }

    // HTML 파일로 저장
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(process.cwd(), 'test-output.html');
    fs.writeFileSync(outputPath, result.html, 'utf-8');
    console.log(`\n💾 생성된 HTML 저장: ${outputPath}`);

    console.log('\n✅ 테스트 완료!');
    
    // 문제점이 있으면 수정 제안
    if (issues.length > 0) {
      console.log('\n🔧 수정이 필요한 항목:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

  } catch (error: any) {
    console.error('\n❌ 테스트 실패:', error?.message || error);
    if (error?.stack) {
      console.error('스택 트레이스:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testPostGeneration().catch(console.error);
}

export { testPostGeneration };





