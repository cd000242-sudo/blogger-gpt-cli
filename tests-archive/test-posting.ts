// test-posting.ts
// 포스팅 발행 테스트 파일

import { generateMaxModeArticle } from './src/core/index';
import { EnvironmentManager } from './src/utils/environment-manager';

// 환경변수 관리자 사용
const envManager = EnvironmentManager.getInstance();
const envConfig = envManager.getConfig();

// 테스트용 설정 (환경변수 관리자에서 로드)
const testConfig = {
  provider: 'gemini' as const,
  geminiKey: envConfig.geminiApiKey || '',
  topic: '인스타그램 스토리 알림 끄기',
  keywords: ['인스타그램', '스토리', '알림', '끄기'],
  minChars: 2000,
  contentMode: 'external',
  platform: 'blogger',
  naverClientId: envConfig.naverClientId || '',
  naverClientSecret: envConfig.naverClientSecret || '',
  googleCseKey: envConfig.googleApiKey || '',
  googleCseCx: envConfig.googleCseId || '',
  // 🔥 빠른 테스트를 위한 설정
  skipImages: true,    // 이미지 생성 완전 스킵
  fastMode: true,      // 빠른 모드 활성화
};

// 성능 측정 헬퍼
class PerformanceMonitor {
  private startTime: number = 0;
  private checkpoints: Map<string, number> = new Map();

  start(label: string = '전체') {
    this.startTime = Date.now();
    this.checkpoints.set(label, this.startTime);
    console.log(`\n⏱️ [${label}] 시작: ${new Date().toLocaleTimeString()}`);
  }

  checkpoint(label: string) {
    const now = Date.now();
    const elapsed = now - (this.checkpoints.get('전체') || this.startTime);
    this.checkpoints.set(label, now);
    console.log(`✅ [${label}] 완료: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}초)`);
  }

  end(label: string = '전체') {
    const endTime = Date.now();
    const elapsed = endTime - (this.checkpoints.get('전체') || this.startTime);
    console.log(`\n🏁 [${label}] 종료: 총 ${elapsed}ms (${(elapsed / 1000).toFixed(2)}초)`);
    return elapsed;
  }

  getElapsed(): number {
    return Date.now() - (this.checkpoints.get('전체') || this.startTime);
  }
}

// 로그 콜백
function onLog(message: string) {
  console.log(`[LOG] ${message}`);
}

// 메인 테스트 함수
async function testPosting() {
  const monitor = new PerformanceMonitor();
  monitor.start('포스팅 생성 테스트');

  console.log('='.repeat(60));
  console.log('📝 포스팅 발행 테스트 시작');
  console.log('='.repeat(60));
  console.log(`📋 주제: ${testConfig.topic}`);
  const keywords = Array.isArray(testConfig.keywords) ? testConfig.keywords : [testConfig.keywords];
  console.log(`🔑 키워드: ${keywords.join(', ')}`);
  console.log(`📏 최소 글자수: ${testConfig.minChars || 2000}자`);
  console.log('='.repeat(60));

  // API 키 확인
  console.log('\n🔑 API 키 상태 확인:');
  console.log(`- Gemini: ${testConfig.geminiKey ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`- Naver: ${testConfig.naverClientId && testConfig.naverClientSecret ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`- Google CSE: ${testConfig.googleCseKey && testConfig.googleCseCx ? '✅ 설정됨' : '❌ 없음'}`);

  // 환경변수 관리자에서 로드된 설정 확인
  console.log('\n📋 환경변수 관리자에서 로드된 설정:');
  console.log(`- Gemini API Key: ${envConfig.geminiApiKey ? `✅ (${envConfig.geminiApiKey.substring(0, 10)}...)` : '❌ 없음'}`);
  console.log(`- Naver Client ID: ${envConfig.naverClientId ? `✅ (${envConfig.naverClientId.substring(0, 10)}...)` : '❌ 없음'}`);
  console.log(`- Naver Client Secret: ${envConfig.naverClientSecret ? `✅ (${envConfig.naverClientSecret.substring(0, 10)}...)` : '❌ 없음'}`);
  console.log(`- Google API Key: ${envConfig.googleApiKey ? `✅ (${envConfig.googleApiKey.substring(0, 10)}...)` : '❌ 없음'}`);
  console.log(`- Google CSE ID: ${envConfig.googleCseId ? `✅ (${envConfig.googleCseId})` : '❌ 없음'}`);

  // API 키 검증 및 경고
  if (!testConfig.geminiKey) {
    console.warn('\n⚠️ 경고: Gemini API 키가 없습니다!');
    console.warn('config.json 파일이나 .env 파일에 geminiApiKey를 추가하세요.');
    console.warn('API 키가 없어도 크롤링 테스트는 진행됩니다.');
  }
  
  if (!testConfig.naverClientId || !testConfig.naverClientSecret) {
    console.warn('\n⚠️ 경고: 네이버 API 키가 없습니다!');
    console.warn('config.json 파일이나 .env 파일에 naverClientId, naverClientSecret를 추가하세요.');
    console.warn('네이버 크롤링은 건너뜁니다.');
  }
  
  if (!testConfig.googleCseKey || !testConfig.googleCseCx) {
    console.warn('\n⚠️ 경고: Google CSE API 키가 없습니다!');
    console.warn('config.json 파일이나 .env 파일에 googleApiKey, googleCseId를 추가하세요.');
    console.warn('Google CSE 크롤링은 건너뜁니다.');
  }

  try {
    monitor.checkpoint('초기화');
    
    // 환경 설정
    const env = {
      contentMode: testConfig.contentMode || 'external',
      postingMode: 'immediate',
      thumbnailMode: 'text',
      massCrawlingEnabled: true,
      skipImages: true,  // 🔥 테스트 시 이미지 생성 스킵 (API 테스트에 집중)
      fastMode: true     // 🔥 빠른 모드 활성화
    };

    console.log('\n🚀 포스팅 생성 시작...');
    monitor.checkpoint('포스팅 생성 시작');

    // 포스팅 생성
    const result = await generateMaxModeArticle(testConfig, env, onLog);
    const html = result.html;

    monitor.checkpoint('포스팅 생성 완료');

    // 결과 검증
    console.log('\n📊 결과 검증:');
    console.log(`- 제목: ${result.title}`);
    console.log(`- HTML 길이: ${html.length}자`);
    console.log(`- HTML이 비어있는지: ${html.length === 0 ? '❌ 예' : '✅ 아니오'}`);

    // HTML 내용 검증
    const hasH2 = /<h2[^>]*>/i.test(html);
    const hasH3 = /<h3[^>]*>/i.test(html);
    const hasP = /<p[^>]*>/i.test(html);
    const hasCTA = /cta|CTA|후킹|hook/i.test(html);
    const hasSummary = /요약|summary|핵심/i.test(html);

    console.log(`- H2 태그 포함: ${hasH2 ? '✅' : '❌'}`);
    console.log(`- H3 태그 포함: ${hasH3 ? '✅' : '❌'}`);
    console.log(`- P 태그 포함: ${hasP ? '✅' : '❌'}`);
    console.log(`- CTA 포함: ${hasCTA ? '✅' : '❌'}`);
    console.log(`- 핵심 요약 포함: ${hasSummary ? '✅' : '❌'}`);

    // 텍스트 길이 검증
    const textContent = html.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    const minChars = testConfig.minChars || 2000;
    console.log(`- 실제 텍스트 길이: ${textContent.length}자`);
    console.log(`- 최소 글자수 충족: ${textContent.length >= minChars ? '✅' : '❌'} (필요: ${minChars}자, 실제: ${textContent.length}자)`);

    // 성능 검증
    const totalTime = monitor.end('포스팅 생성');
    const totalSeconds = totalTime / 1000;
    console.log(`\n⏱️ 성능 평가:`);
    console.log(`- 총 소요 시간: ${totalSeconds.toFixed(2)}초`);
    console.log(`- 2분 이내 달성: ${totalSeconds <= 120 ? '✅' : '❌'} (목표: 120초 이내)`);
    
    if (totalSeconds > 120) {
      console.warn(`⚠️ 경고: 포스팅 생성이 2분을 초과했습니다!`);
    }

    // HTML 샘플 출력 (처음 500자)
    console.log('\n📄 HTML 샘플 (처음 500자):');
    console.log('-'.repeat(60));
    console.log(html.substring(0, 500));
    console.log('-'.repeat(60));

    // 크롤링 통계 분석
    const crawlStats = {
      hasImages: /<img[^>]*>/i.test(html),
      hasTables: /<table[^>]*>/i.test(html),
      hasLists: /<ul[^>]*>|<ol[^>]*>/i.test(html),
      hasLinks: /<a[^>]*href/i.test(html),
      linkCount: (html.match(/<a[^>]*href/gi) || []).length
    };

    console.log('\n📊 콘텐츠 품질 분석:');
    console.log(`- 이미지 포함: ${crawlStats.hasImages ? '✅' : '❌'}`);
    console.log(`- 표 포함: ${crawlStats.hasTables ? '✅' : '❌'}`);
    console.log(`- 리스트 포함: ${crawlStats.hasLists ? '✅' : '❌'}`);
    console.log(`- 링크 포함: ${crawlStats.hasLinks ? '✅' : '❌'} (${crawlStats.linkCount}개)`);

    // 최종 결과
    console.log('\n' + '='.repeat(60));
    const isSuccess = html.length > 0 && hasH2 && hasP && totalSeconds <= 120; // 2분 이내 허용
    if (isSuccess) {
      console.log('✅ 테스트 성공!');
      console.log('='.repeat(60));
      console.log('\n📋 요약:');
      console.log(`- 생성 시간: ${totalSeconds.toFixed(2)}초`);
      console.log(`- HTML 길이: ${html.length}자`);
      console.log(`- 텍스트 길이: ${textContent.length}자`);
      console.log(`- 링크 수: ${crawlStats.linkCount}개`);
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.log('❌ 테스트 실패!');
      if (html.length === 0) console.log('  - HTML이 비어있습니다');
      if (!hasH2) console.log('  - H2 태그가 없습니다');
      if (!hasP) console.log('  - P 태그가 없습니다');
      if (totalSeconds > 120) console.log(`  - 생성 시간이 2분을 초과했습니다 (${totalSeconds.toFixed(2)}초)`);
      console.log('='.repeat(60));
      process.exit(1);
    }

  } catch (error: any) {
    monitor.end('에러 발생');
    console.error('\n❌ 테스트 중 오류 발생:');
    console.error('='.repeat(60));
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// 타임아웃 설정 (180초 - 안정적인 테스트)
const TIMEOUT = 180000; // 180초 (3분)

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new Error(`테스트 타임아웃: ${TIMEOUT / 1000}초를 초과했습니다.`));
  }, TIMEOUT);
});

// 테스트 실행
Promise.race([testPosting(), timeoutPromise])
  .catch((error) => {
    console.error('\n❌ 테스트 실패:', error.message);
    process.exit(1);
  });

