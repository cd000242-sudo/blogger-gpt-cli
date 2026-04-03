/**
 * 샌드박스 테스트: 2026년 연말정산 미리보기 글 생성
 * 발행된 글과 동일한 주제로 테스트하여 문제점 파악
 */

import { generateMaxModeArticle } from './src/core/index';
import * as fs from 'fs';
import * as path from 'path';

async function testYearEndTaxContent() {
  console.log('🚀 2026년 연말정산 미리보기 글 생성 테스트 시작...\n');
  
  // 더미 Gemini 키 (테스트용)
  const dummyGeminiKey = 'AIzaSyDUMMY_TEST_KEY_FOR_SANDBOX';

  // 발행된 글과 동일한 payload 구성
  const testPayload = {
    provider: 'gemini' as const,
    geminiKey: dummyGeminiKey,
    topic: '2026년 연말정산 미리보기',
    keywords: ['2026년', '연말정산', '미리보기', '절세', '환급'],
    minChars: 5000,
    contentMode: 'external',
    platform: 'blogger',
    blogId: 'test-blog-id',
    postingMode: 'draft',
    thumbnailMode: 'none',
    sectionImageMode: 'none',
  };

  console.log('📝 테스트 주제:', testPayload.topic);
  console.log('🔑 키워드:', testPayload.keywords.join(', '));
  console.log('📌 플랫폼:', testPayload.platform);
  console.log('📌 콘텐츠 모드:', testPayload.contentMode);
  console.log('📌 최소 글자수:', testPayload.minChars);
  console.log('');

  // 상세 로그 수집용 배열
  const detailedLogs: string[] = [];
  
  // 로그 콜백 함수 (콘솔 + 파일 저장)
  const onLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    detailedLogs.push(logMessage);
  };

  try {
    // 환경 변수 설정 (테스트용)
    const env = {
      geminiKey: dummyGeminiKey,
      geminiApiKey: dummyGeminiKey,
      GEMINI_API_KEY: dummyGeminiKey,
    };

    // 1. 글 생성
    console.log('📝 1단계: 글 생성 시작...');
    console.log('⏰ 시작 시간:', new Date().toLocaleString('ko-KR'));
    const startTime = Date.now();
    
    onLog('='.repeat(80));
    onLog('글 생성 시작');
    onLog(`주제: ${testPayload.topic}`);
    onLog(`키워드: ${testPayload.keywords.join(', ')}`);
    onLog(`플랫폼: ${testPayload.platform}`);
    onLog(`콘텐츠 모드: ${testPayload.contentMode}`);
    onLog('='.repeat(80));
    
    const result = await generateMaxModeArticle(testPayload, env, onLog);
    
    const generationTime = Date.now() - startTime;
    
    onLog('='.repeat(80));
    onLog('글 생성 완료');
    onLog(`소요 시간: ${(generationTime / 1000).toFixed(2)}초`);
    onLog(`제목: ${result.title}`);
    onLog(`HTML 길이: ${result.html.length}자`);
    onLog(`순수 텍스트 길이: ${result.html.replace(/<[^>]*>/g, '').length}자`);
    onLog(`라벨: ${result.labels.join(', ')}`);
    onLog('='.repeat(80));
    
    console.log(`\n✅ 글 생성 완료 (소요 시간: ${(generationTime / 1000).toFixed(2)}초)`);
    console.log(`📄 제목: ${result.title}`);
    console.log(`📏 HTML 길이: ${result.html.length.toLocaleString()}자`);
    console.log(`📏 순수 텍스트 길이: ${result.html.replace(/<[^>]*>/g, '').length.toLocaleString()}자`);
    console.log(`🏷️  라벨: ${result.labels.join(', ')}`);
    console.log(`🖼️  썸네일: ${result.thumbnail ? '생성됨' : '없음'}`);

    // 2. HTML 구조 분석
    console.log('\n📊 2단계: HTML 구조 분석...');
    
    const h2Count = (result.html.match(/<h2[^>]*>/gi) || []).length;
    const h3Count = (result.html.match(/<h3[^>]*>/gi) || []).length;
    const pCount = (result.html.match(/<p[^>]*>/gi) || []).length;
    const sectionCount = (result.html.match(/class="[^"]*section[^"]*"/gi) || []).length;
    
    onLog('\n📊 HTML 구조 분석:');
    onLog(`  - H2 제목 개수: ${h2Count}개 (예상: 5개)`);
    onLog(`  - H3 소제목 개수: ${h3Count}개`);
    onLog(`  - 문단(P) 개수: ${pCount}개`);
    onLog(`  - 섹션(div.section) 개수: ${sectionCount}개`);
    
    console.log(`  - H2 제목 개수: ${h2Count}개 (예상: 5개)`);
    console.log(`  - H3 소제목 개수: ${h3Count}개`);
    console.log(`  - 문단(P) 개수: ${pCount}개`);
    console.log(`  - 섹션(div.section) 개수: ${sectionCount}개`);
    
    // H2 제목 추출
    const h2Titles: string[] = [];
    const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
    let h2Match;
    while ((h2Match = h2Regex.exec(result.html)) !== null) {
      if (h2Match[1]) {
        const cleanTitle = h2Match[1].replace(/<[^>]*>/g, '').trim();
        h2Titles.push(cleanTitle);
      }
    }
    
    onLog('\n📋 H2 제목 목록:');
    h2Titles.forEach((title, idx) => {
      onLog(`  ${idx + 1}. ${title}`);
    });
    
    console.log('\n📋 H2 제목 목록:');
    h2Titles.forEach((title, idx) => {
      console.log(`  ${idx + 1}. ${title}`);
    });
    
    // 3. 결과 파일 저장
    console.log('\n💾 3단계: 결과 파일 저장...');
    
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // HTML 파일 저장
    const htmlPath = path.join(outputDir, `연말정산-테스트-${timestamp}.html`);
    fs.writeFileSync(htmlPath, result.html, 'utf-8');
    onLog(`HTML 파일 저장: ${htmlPath}`);
    console.log(`  ✅ HTML 저장: ${htmlPath}`);
    
    // 로그 파일 저장
    const logPath = path.join(outputDir, `연말정산-로그-${timestamp}.txt`);
    fs.writeFileSync(logPath, detailedLogs.join('\n'), 'utf-8');
    onLog(`로그 파일 저장: ${logPath}`);
    console.log(`  ✅ 로그 저장: ${logPath}`);
    
    // 분석 리포트 저장
    const reportPath = path.join(outputDir, `연말정산-분석-${timestamp}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      topic: testPayload.topic,
      keywords: testPayload.keywords,
      generationTime: generationTime,
      title: result.title,
      htmlLength: result.html.length,
      textLength: result.html.replace(/<[^>]*>/g, '').length,
      labels: result.labels,
      structure: {
        h2Count,
        h3Count,
        pCount,
        sectionCount,
        h2Titles
      },
      expectedStructure: {
        h2Count: 5,
        sections: ['서론', '핵심 내용 1', '핵심 내용 2', '핵심 내용 3', '결론']
      }
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    onLog(`분석 리포트 저장: ${reportPath}`);
    console.log(`  ✅ 분석 리포트 저장: ${reportPath}`);
    
    // 4. 문제점 분석
    console.log('\n🔍 4단계: 문제점 분석...');
    
    const issues: string[] = [];
    
    if (h2Count !== 5) {
      const issue = `⚠️ H2 개수 불일치: 예상 5개, 실제 ${h2Count}개`;
      issues.push(issue);
      console.log(`  ${issue}`);
      onLog(issue);
    }
    
    if (result.html.length < testPayload.minChars) {
      const issue = `⚠️ 글자수 부족: 목표 ${testPayload.minChars}자, 실제 ${result.html.length}자`;
      issues.push(issue);
      console.log(`  ${issue}`);
      onLog(issue);
    }
    
    // 중복 내용 체크 (간단한 패턴)
    const textOnly = result.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const words = textOnly.split(' ').filter(w => w.length > 3);
    const wordSet = new Set(words);
    const duplicateRate = ((words.length - wordSet.size) / words.length * 100).toFixed(1);
    
    if (parseFloat(duplicateRate) > 30) {
      const issue = `⚠️ 중복 단어 비율 높음: ${duplicateRate}%`;
      issues.push(issue);
      console.log(`  ${issue}`);
      onLog(issue);
    }
    
    if (issues.length === 0) {
      console.log('  ✅ 문제점 없음');
      onLog('✅ 문제점 없음');
    } else {
      onLog(`\n발견된 문제: ${issues.length}개`);
      issues.forEach(issue => onLog(`  - ${issue}`));
    }
    
    console.log('\n✅ 테스트 완료!');
    console.log(`📁 결과 파일: ${outputDir}`);
    
    // 최종 로그 저장
    fs.writeFileSync(logPath, detailedLogs.join('\n'), 'utf-8');
    
  } catch (error: any) {
    const errorMessage = `❌ 오류 발생: ${error.message}`;
    console.error(errorMessage);
    console.error('스택 트레이스:', error.stack);
    onLog(errorMessage);
    onLog(`스택: ${error.stack}`);
    
    // 오류 로그 저장
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const errorLogPath = path.join(outputDir, `연말정산-오류-${timestamp}.txt`);
    fs.writeFileSync(errorLogPath, `${errorMessage}\n\n${error.stack}\n\n${detailedLogs.join('\n')}`, 'utf-8');
    console.log(`오류 로그 저장: ${errorLogPath}`);
    
    process.exit(1);
  }
}

// 테스트 실행
testYearEndTaxContent().catch(error => {
  console.error('치명적 오류:', error);
  process.exit(1);
});




