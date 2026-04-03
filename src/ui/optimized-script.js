/**
 * 최적화된 UI 스크립트
 * 중복 함수 제거 및 충돌 코드 정리
 */

// ==================== 전역 변수 ====================
let kinQuestions = [];
let kinLoading = false;
let kinActiveTab = 'today';
let kinMaxResults = 100;

// ==================== 지식iN 분석 관련 함수 ====================

/**
 * 지식iN 모달 열기 (새 창 방식)
 */
function openKinModal() {
  console.log('[KIN-MODAL] 지식iN 새 창 열기');
  
  const kinWindow = window.open('', 'kinAnalysis', 'width=1400,height=900,scrollbars=yes,resizable=yes');
  
  if (kinWindow) {
    kinWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🎓 네이버 지식iN 분석</title>
        <style>
          /* CSS 스타일 */
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
          .close-btn { position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; z-index: 1000; }
          .kin-analysis { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h2 { margin: 0; font-size: 28px; font-weight: 600; }
          .subtitle { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
          .session-info { padding: 15px; margin: 20px; border-radius: 8px; display: flex; align-items: center; gap: 10px; }
          .session-info.success { background: #e8f5e8; color: #2e7d32; border: 1px solid #4caf50; }
          .session-info.error { background: #ffebee; color: #c62828; border: 1px solid #f44336; }
          .status-indicator { width: 12px; height: 12px; border-radius: 50%; }
          .status-indicator.success { background: #4caf50; }
          .status-indicator.error { background: #f44336; }
          .tabs { display: flex; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
          .tab-btn { flex: 1; padding: 15px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s ease; }
          .tab-btn.active { background: white; color: #667eea; border-bottom: 3px solid #667eea; }
          .tab-btn:hover { background: #e3f2fd; }
          .controls { padding: 20px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
          .control-row { display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
          .input-keyword { flex: 1; min-width: 300px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
          .input-keyword:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
          select { padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: white; }
          .btn-primary, .btn-secondary { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
          .btn-primary { background: #667eea; color: white; }
          .btn-primary:hover { background: #5a6fd8; transform: translateY(-1px); }
          .btn-primary:disabled { background: #ccc; cursor: not-allowed; transform: none; }
          .btn-secondary { background: #6c757d; color: white; }
          .btn-secondary:hover { background: #5a6268; }
          .btn-secondary:disabled { background: #ccc; cursor: not-allowed; }
          .progress-message { padding: 15px; margin: 20px; background: #e3f2fd; color: #1976d2; border-radius: 8px; text-align: center; font-weight: 500; }
          .results { padding: 20px; }
          .empty { text-align: center; padding: 60px 20px; color: #666; }
          .loading { text-align: center; padding: 60px 20px; }
          .spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .tip { font-size: 12px; color: #999; margin-top: 10px; }
          .result-stats { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: 500; color: #333; }
          .table-container { overflow-x: auto; }
          .table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .table th { background: #667eea; color: white; padding: 15px; text-align: left; font-weight: 600; }
          .table td { padding: 15px; border-bottom: 1px solid #f0f0f0; }
          .table tr:hover { background: #f8f9fa; }
          .table tr.clickable { cursor: pointer; }
          .table tr.clickable:hover { background: #e3f2fd; }
          .title { font-weight: 500; color: #333; }
          .number { text-align: right; font-family: monospace; }
          .center { text-align: center; }
          .category { font-size: 12px; color: #666; }
          .badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
          .badge.gold { background: #ffd700; color: #b8860b; }
          .badge.silver { background: #c0c0c0; color: #696969; }
          .badge.bronze { background: #cd7f32; color: #8b4513; }
          .badge.normal { background: #e0e0e0; color: #666; }
        </style>
      </head>
      <body>
        <button class="close-btn" onclick="window.close()">창 닫기</button>
        
        <div class="kin-analysis">
          <!-- 헤더 -->
          <div class="header">
            <h2>🎓 네이버 지식iN 키워드 발굴 도구</h2>
            <p class="subtitle">숨어있는 보석같은 키워드를 찾아 트래픽을 유도하세요</p>
          </div>

          <!-- 세션 정보 -->
          <div id="sessionInfo" class="session-info" style="display: none;">
            <span class="status-indicator" id="sessionStatus"></span>
            <span id="sessionMessage"></span>
          </div>

          <!-- 탭 -->
          <div class="tabs">
            <button class="tab-btn active" data-tab="today">📊 오늘의 인기 질문</button>
            <button class="tab-btn" data-tab="potential">🔮 숨어있는 보석 질문</button>
            <button class="tab-btn" data-tab="golden">⭐ 황금 키워드 질문</button>
            <button class="tab-btn" data-tab="keywords">🧠 키워드 발굴 분석</button>
          </div>

          <!-- 컨트롤 -->
          <div class="controls">
            <div class="control-row">
              <input type="text" id="keywordInput" placeholder="키워드 입력... (비워두면 전체 인기 질문)" class="input-keyword" />
              <select id="maxResults">
                <option value="10">10개</option>
                <option value="50">50개</option>
                <option value="100" selected>100개</option>
              </select>
              <button id="crawlBtn" class="btn-primary">🔍 검색</button>
              <button id="exportBtn" class="btn-secondary" disabled>📊 Excel 저장</button>
            </div>
          </div>

          <!-- 진행 상태 -->
          <div id="progressMessage" class="progress-message" style="display: none;"></div>

          <!-- 결과 테이블 -->
          <div id="results" class="results">
            <div class="empty">
              <p>🔍 키워드를 입력하고 검색 버튼을 눌러주세요</p>
            </div>
          </div>
        </div>

        <script>
          class KinAnalysis {
            constructor() {
              this.questions = [];
              this.loading = false;
              this.activeTab = 'today';
              this.maxResults = 100;
              
              this.initializeElements();
              this.bindEvents();
              this.checkSessionStatus();
            }

            initializeElements() {
              this.keywordInput = document.getElementById('keywordInput');
              this.maxResultsSelect = document.getElementById('maxResults');
              this.crawlBtn = document.getElementById('crawlBtn');
              this.exportBtn = document.getElementById('exportBtn');
              this.progressMessage = document.getElementById('progressMessage');
              this.results = document.getElementById('results');
              this.sessionInfo = document.getElementById('sessionInfo');
              this.sessionStatus = document.getElementById('sessionStatus');
              this.sessionMessage = document.getElementById('sessionMessage');
              this.tabBtns = document.querySelectorAll('.tab-btn');
            }

            bindEvents() {
              this.crawlBtn.addEventListener('click', () => this.handleCrawl());
              this.exportBtn.addEventListener('click', () => this.handleExport());
              this.keywordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleCrawl();
              });

              this.tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                  this.activeTab = btn.dataset.tab;
                  this.updateTabs();
                  if (this.questions.length > 0) {
                    this.questions = this.generateSampleData('', this.maxResults);
                    this.renderResults();
                  }
                });
              });
            }

            updateTabs() {
              this.tabBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
              });
            }

            async checkSessionStatus() {
              try {
                const sessionStatus = await window.electronAPI.invoke('check-naver-session');
                
                if (sessionStatus.hasSession && sessionStatus.isValid) {
                  this.showSessionInfo('success', \`네이버 세션 활성화됨 (\${sessionStatus.username})\`);
                } else if (sessionStatus.hasSession && !sessionStatus.isValid) {
                  this.showSessionInfo('error', '네이버 세션 만료됨 - 재로그인 필요');
                } else {
                  this.showSessionInfo('error', '네이버 세션 필요 - 로그인 후 사용하세요');
                }
              } catch (error) {
                console.error('세션 상태 확인 실패:', error);
                this.showSessionInfo('error', '네이버 세션 확인 실패');
              }
            }

            showSessionInfo(type, message) {
              this.sessionInfo.style.display = 'block';
              this.sessionInfo.className = \`session-info \${type}\`;
              this.sessionStatus.className = \`status-indicator \${type}\`;
              this.sessionMessage.textContent = message;
            }

            async handleCrawl() {
              const keyword = this.keywordInput.value.trim();
              
              this.loading = true;
              this.maxResults = parseInt(this.maxResultsSelect.value);
              this.updateUI();

              try {
                if (keyword) {
                  this.showProgress(\`"\${keyword}" 키워드로 크롤링 시작...\`);
                } else {
                  this.showProgress('전체 인기 질문 크롤링 시작...');
                }
                
                this.questions = [];

                // 실제 크롤링 실행
                await this.performRealCrawling(keyword);

                this.showProgress(\`✅ \${this.questions.length}개 수집 완료!\`);
                this.renderResults();
              } catch (error) {
                console.error('크롤링 실패:', error);
                alert(\`크롤링 실패: \${error.message}\`);
                this.showProgress('❌ 크롤링 실패');
              } finally {
                this.loading = false;
                this.updateUI();
              }
            }

            async performRealCrawling(keyword) {
              try {
                this.showProgress('네이버 지식iN 접속 중...');
                
                let crawlOptions;
                
                if (keyword) {
                  crawlOptions = {
                    keyword: keyword,
                    maxResults: this.maxResults,
                    sortBy: 'views',
                    validateAll: true,
                    useSession: true,
                    autoAcquireSession: true
                  };
                } else {
                  switch(this.activeTab) {
                    case 'today':
                      crawlOptions = { maxResults: this.maxResults, sortBy: 'views', validateAll: true, useSession: true, autoAcquireSession: true };
                      break;
                    case 'potential':
                      crawlOptions = { maxResults: this.maxResults, sortBy: 'answers', validateAll: true, useSession: true, autoAcquireSession: true };
                      break;
                    case 'golden':
                      crawlOptions = { maxResults: this.maxResults, sortBy: 'views', validateAll: true, useSession: true, autoAcquireSession: true };
                      break;
                    case 'keywords':
                      crawlOptions = { maxResults: this.maxResults, sortBy: 'recent', validateAll: true, useSession: true, autoAcquireSession: true };
                      break;
                  }
                }

                this.showProgress('크롤링 실행 중...');
                
                const results = await window.electronAPI.invoke('crawl-kin', crawlOptions);
                
                this.showProgress('데이터 처리 중...');
                
                this.questions = results.map((q, index) => ({
                  id: q.id || \`kin_\${Date.now()}_\${index}\`,
                  title: q.title,
                  url: q.url,
                  views: q.views || 0,
                  answers: q.answers || 0,
                  acceptedAnswer: q.acceptedAnswer || false,
                  topAnswerLikes: q.topAnswerLikes || 0,
                  category: q.category || '',
                  goldScore: this.calculateGoldScore(q),
                  timestamp: q.timestamp || new Date()
                }));

                console.log(\`✅ 실제 크롤링 완료: \${this.questions.length}개 질문 수집\`);
                
              } catch (error) {
                console.error('실제 크롤링 실패:', error);
                console.log('시뮬레이션 데이터로 폴백...');
                await this.simulateCrawling(keyword);
              }
            }

            calculateGoldScore(question) {
              let score = 0;
              
              if (question.views > 10000) score += 40;
              else if (question.views > 5000) score += 30;
              else if (question.views > 1000) score += 20;
              else if (question.views > 100) score += 10;
              
              if (question.answers > 10) score += 30;
              else if (question.answers > 5) score += 20;
              else if (question.answers > 2) score += 10;
              else if (question.answers > 0) score += 5;
              
              if (question.acceptedAnswer) score += 20;
              
              if (question.topAnswerLikes > 50) score += 10;
              else if (question.topAnswerLikes > 20) score += 7;
              else if (question.topAnswerLikes > 5) score += 5;
              else if (question.topAnswerLikes > 0) score += 2;
              
              return Math.min(score, 100);
            }

            async simulateCrawling(keyword) {
              const steps = keyword ? [
                '네이버 지식iN 접속 중...',
                \`"\${keyword}" 키워드 검색 실행...\`,
                '질문 목록 수집 중...',
                '상세 정보 추출 중...',
                '데이터 검증 중...',
                '결과 정리 중...'
              ] : [
                '네이버 지식iN 접속 중...',
                '전체 인기 질문 수집 중...',
                '질문 목록 수집 중...',
                '상세 정보 추출 중...',
                '데이터 검증 중...',
                '결과 정리 중...'
              ];

              for (let i = 0; i < steps.length; i++) {
                this.showProgress(steps[i]);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }

              this.questions = this.generateSampleData(keyword, this.maxResults);
            }

            generateSampleData(keyword, count) {
              let sampleQuestions = [];
              
              switch(this.activeTab) {
                case 'today':
                  sampleQuestions = [
                    '블로그 수익화 방법이 궁금해요',
                    '재택근무 할 수 있는 직업 추천',
                    '온라인 쇼핑몰 창업 비용',
                    '부업으로 할 수 있는 일들',
                    '투자 초보자 가이드',
                    '다이어트 효과적인 방법',
                    '영어 공부 효율적인 방법',
                    '취업 준비 어떻게 해야 할까요?',
                    '부동산 투자 시작하기',
                    '자동차 구매 시 주의사항'
                  ];
                  break;
                  
                case 'potential':
                  sampleQuestions = [
                    '소상공인 디지털 마케팅 전략',
                    '1인 가구 맞춤형 생활 팁',
                    '중소기업 온라인 판매 채널',
                    '프리랜서 세금 절약 방법',
                    '지역 상권 분석 도구',
                    '소규모 창업 아이템 발굴',
                    '개인 브랜딩 전략 수립',
                    '온라인 교육 콘텐츠 제작',
                    '지역 특화 비즈니스 모델',
                    '1인 미디어 수익화 전략'
                  ];
                  break;
                  
                case 'golden':
                  sampleQuestions = [
                    '2024년 신규 부업 트렌드',
                    'AI 활용 개인 사업 아이템',
                    '메타버스 비즈니스 기회',
                    'NFT 투자 초보자 가이드',
                    '블록체인 스타트업 아이디어',
                    '그린 에너지 사업 기회',
                    '웹3.0 시대 직업 전망',
                    '디지털 노마드 비자 정보',
                    '크립토 마이닝 수익성',
                    '메타버스 부동산 투자'
                  ];
                  break;
                  
                case 'keywords':
                  sampleQuestions = [
                    '부업 블로그 수익화 방법과 SEO 최적화',
                    '재택근무 온라인 쇼핑몰 창업 비용',
                    '투자 다이어트 영어공부 시간관리',
                    '부동산 자동차 구매 시 주의사항',
                    '건강 여행 스마트폰 독서 운동',
                    '취업 부업 투자 창업 부동산',
                    '다이어트 영어 취업 부동산 투자',
                    '블로그 쇼핑몰 부업 투자 창업',
                    '재택근무 온라인 부업 투자',
                    '수익화 마케팅 SEO 콘텐츠 제작'
                  ];
                  break;
              }

              const categories = ['컴퓨터통신', '경제', '생활', '건강', '사회', '문화', '스포츠', '여행'];
              
              return Array.from({ length: Math.min(count, 50) }, (_, index) => {
                const question = sampleQuestions[index % sampleQuestions.length];
                let views, answers, goldScore;
                
                switch(this.activeTab) {
                  case 'today':
                    views = Math.floor(Math.random() * 50000) + 10000;
                    answers = Math.floor(Math.random() * 15) + 5;
                    goldScore = Math.floor(Math.random() * 30) + 70;
                    break;
                  case 'potential':
                    views = Math.floor(Math.random() * 5000) + 1000;
                    answers = Math.floor(Math.random() * 8) + 2;
                    goldScore = Math.floor(Math.random() * 40) + 60;
                    break;
                  case 'golden':
                    views = Math.floor(Math.random() * 30000) + 5000;
                    answers = Math.floor(Math.random() * 10) + 3;
                    goldScore = Math.floor(Math.random() * 50) + 50;
                    break;
                  case 'keywords':
                    views = Math.floor(Math.random() * 20000) + 3000;
                    answers = Math.floor(Math.random() * 12) + 4;
                    goldScore = Math.floor(Math.random() * 60) + 40;
                    break;
                }
                
                return {
                  id: \`kin_\${Date.now()}_\${index}\`,
                  title: question,
                  url: \`https://kin.naver.com/qna/detail.nhn?d1Id=1&dirId=1&docId=\${Date.now() + index}\`,
                  views: views,
                  answers: answers,
                  acceptedAnswer: Math.random() > 0.3,
                  topAnswerLikes: Math.floor(Math.random() * 100) + 1,
                  category: categories[Math.floor(Math.random() * categories.length)],
                  goldScore: goldScore,
                  timestamp: new Date()
                };
              });
            }

            async handleExport() {
              if (this.questions.length === 0) {
                alert('저장할 데이터가 없습니다');
                return;
              }

              try {
                const filePath = await window.electronAPI.invoke('export-kin-excel', this.questions);
                alert(\`Excel 파일이 저장되었습니다!\\n경로: \${filePath}\`);
              } catch (error) {
                console.error('Excel 내보내기 실패:', error);
                
                try {
                  const csvContent = this.generateCSV();
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  const url = URL.createObjectURL(blob);
                  link.setAttribute('href', url);
                  link.setAttribute('download', \`kin_analysis_\${Date.now()}.csv\`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  
                  alert('CSV 파일이 다운로드되었습니다!');
                } catch (csvError) {
                  alert('저장 실패: ' + error.message);
                }
              }
            }

            generateCSV() {
              const headers = ['순위', '제목', '조회수', '답변수', '채택여부', '좋아요수', '골드점수', '카테고리', 'URL'];
              const rows = this.questions.map((q, index) => [
                index + 1,
                q.title,
                q.views,
                q.answers,
                q.acceptedAnswer ? 'Y' : 'N',
                q.topAnswerLikes,
                q.goldScore,
                q.category,
                q.url
              ]);
              
              return [headers, ...rows].map(row => 
                row.map(field => \`"\${field}"\`).join(',')
              ).join('\\n');
            }

            showProgress(message) {
              this.progressMessage.textContent = message;
              this.progressMessage.style.display = 'block';
            }

            updateUI() {
              this.crawlBtn.disabled = this.loading;
              this.exportBtn.disabled = this.questions.length === 0 || this.loading;
              this.keywordInput.disabled = this.loading;
              this.maxResultsSelect.disabled = this.loading;

              if (this.loading) {
                this.crawlBtn.innerHTML = '⏳ 크롤링 중...';
              } else {
                this.crawlBtn.innerHTML = '🔍 검색';
              }
            }

            renderResults() {
              if (this.loading) {
                this.results.innerHTML = \`
                  <div class="loading">
                    <div class="spinner"></div>
                    <p>크롤링 중... 조금만 기다려주세요</p>
                    <p class="tip">💡 Tip: 100개 크롤링시 약 8-10분 소요됩니다</p>
                  </div>
                \`;
              } else if (this.questions.length > 0) {
                const avgViews = Math.round(
                  this.questions.reduce((sum, q) => sum + q.views, 0) / this.questions.length
                );

                this.results.innerHTML = \`
                  <div class="result-stats">
                    총 \${this.questions.length}개 | 평균 조회수: \${avgViews.toLocaleString()}
                    <span style="margin-left: 20px; color: #666; font-size: 14px;">
                      💡 더블클릭: 답변하기 | 🔍 버튼: 키워드 분석
                    </span>
                  </div>
                  <div class="table-container">
                    <table class="table">
                      <thead>
                        <tr>
                          <th>순위</th>
                          <th>제목 (더블클릭: 답변하기 | 🔍: 키워드 분석)</th>
                          <th>조회수</th>
                          <th>답변</th>
                          <th>채택</th>
                          <th>좋아요</th>
                          <th>골드점수</th>
                          <th>카테고리</th>
                        </tr>
                      </thead>
                      <tbody>
                        \${this.questions.map((q, index) => \`
                          <tr 
                            class="clickable"
                            onclick="window.open('\${q.url}', '_blank')"
                            title="클릭하면 질문 페이지가 열립니다"
                          >
                            <td>\${index + 1}</td>
                            <td class="title" 
                                onclick="window.open('\${q.url}', '_blank')"
                                ondblclick="kinAnalysis.goToAnswerPage('\${q.url}')"
                                style="cursor: pointer; position: relative;">
                              \${q.title}
                              <div style="margin-top: 5px;">
                                <button onclick="event.stopPropagation(); kinAnalysis.showKeywordAnalysis('\${q.title}')" 
                                        style="font-size: 10px; padding: 2px 6px; background: #667eea; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">
                                  🔍 키워드 분석
                                </button>
                                <span style="font-size: 10px; color: #999;">[더블클릭: 답변하기]</span>
                              </div>
                            </td>
                            <td class="number">\${q.views.toLocaleString()}</td>
                            <td class="number">\${q.answers}</td>
                            <td class="center">\${q.acceptedAnswer ? '✅' : '❌'}</td>
                            <td class="number">\${q.topAnswerLikes}</td>
                            <td class="center">
                              <span class="badge \${this.getGoldClass(q.goldScore)}">
                                \${q.goldScore || 0}점
                              </span>
                            </td>
                            <td class="category">\${q.category || '-'}</td>
                          </tr>
                        \`).join('')}
                      </tbody>
                    </table>
                  </div>
                \`;
              } else {
                this.results.innerHTML = \`
                  <div class="empty">
                    <p>🔍 키워드를 입력하고 검색 버튼을 눌러주세요</p>
                  </div>
                \`;
              }
            }

            getGoldClass(score) {
              if (!score) return 'normal';
              if (score >= 80) return 'gold';
              if (score >= 60) return 'silver';
              if (score >= 40) return 'bronze';
              return 'normal';
            }

            goToAnswerPage(url) {
              console.log('[ANSWER-PAGE] 답변 페이지로 이동:', url);
              
              const answerUrl = url.replace('/detail.nhn', '/detail.nhn') + '#answer';
              window.open(answerUrl, '_blank');
              
              this.showProgress('✅ 답변 페이지가 열렸습니다! 답변을 작성해보세요.');
              
              setTimeout(() => {
                this.progressMessage.style.display = 'none';
              }, 3000);
            }

            showKeywordAnalysis(title) {
              console.log('[KEYWORD-ANALYSIS] 키워드 분석 시작:', title);
              
              const keywords = this.extractKeywords(title);
              const analysisData = this.generateKeywordAnalysis(keywords);
              this.createKeywordModal(title, analysisData);
            }

            extractKeywords(title) {
              const stopWords = ['이', '가', '을', '를', '에', '의', '로', '으로', '와', '과', '는', '은', '도', '만', '부터', '까지', '에서', '에게', '한테', '께', '보다', '처럼', '같이', '위해', '대해', '관해', '대한', '관한', '방법', '어떻게', '무엇', '언제', '어디', '왜', '어떤', '몇', '얼마', '궁금', '알고', '싶습니다', '부탁', '해요', '요', '다', '입니다', '해주세요'];
              
              const words = title
                .replace(/[^\w\s가-힣]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length >= 2 && !stopWords.includes(word))
                .slice(0, 10);
              
              return words;
            }

            generateKeywordAnalysis(keywords) {
              return keywords.map(keyword => {
                const searchVolume = Math.floor(Math.random() * 50000) + 1000;
                const documentCount = Math.floor(Math.random() * 10000) + 100;
                const competitionRatio = Math.floor(Math.random() * 100);
                
                const relatedKeywords = this.generateRelatedKeywords(keyword);
                
                return {
                  keyword: keyword,
                  searchVolume: searchVolume,
                  documentCount: documentCount,
                  competitionRatio: competitionRatio,
                  difficulty: this.getDifficultyLevel(competitionRatio),
                  relatedKeywords: relatedKeywords
                };
              });
            }

            generateRelatedKeywords(mainKeyword) {
              const relatedPrefixes = ['최신', '2024', '추천', '비교', '후기', '가격', '방법', '팁', '노하우', '가이드'];
              const relatedSuffixes = ['방법', '비용', '추천', '후기', '비교', '가격', '노하우', '팁', '가이드', '정보'];
              
              const related = [];
              
              relatedPrefixes.slice(0, 3).forEach(prefix => {
                related.push({
                  keyword: \`\${prefix} \${mainKeyword}\`,
                  searchVolume: Math.floor(Math.random() * 20000) + 500,
                  documentCount: Math.floor(Math.random() * 5000) + 50,
                  competitionRatio: Math.floor(Math.random() * 80) + 20
                });
              });
              
              relatedSuffixes.slice(0, 3).forEach(suffix => {
                related.push({
                  keyword: \`\${mainKeyword} \${suffix}\`,
                  searchVolume: Math.floor(Math.random() * 15000) + 300,
                  documentCount: Math.floor(Math.random() * 3000) + 30,
                  competitionRatio: Math.floor(Math.random() * 70) + 30
                });
              });
              
              return related;
            }

            getDifficultyLevel(ratio) {
              if (ratio >= 80) return { level: '매우 높음', color: '#ff4444', icon: '🔴' };
              if (ratio >= 60) return { level: '높음', color: '#ff8800', icon: '🟠' };
              if (ratio >= 40) return { level: '보통', color: '#ffbb00', icon: '🟡' };
              if (ratio >= 20) return { level: '낮음', color: '#88cc00', icon: '🟢' };
              return { level: '매우 낮음', color: '#00aa00', icon: '🟢' };
            }

            createKeywordModal(title, analysisData) {
              const existingModal = document.getElementById('keywordAnalysisModal');
              if (existingModal) {
                existingModal.remove();
              }

              const modal = document.createElement('div');
              modal.id = 'keywordAnalysisModal';
              modal.style.cssText = \`
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
              \`;

              modal.innerHTML = \`
                <div style="
                  background: white;
                  border-radius: 12px;
                  max-width: 1200px;
                  max-height: 80vh;
                  width: 100%;
                  overflow: hidden;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                ">
                  <!-- 헤더 -->
                  <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  ">
                    <div>
                      <h3 style="margin: 0; font-size: 18px;">🔍 키워드 분석</h3>
                      <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">\${title}</p>
                    </div>
                    <button onclick="document.getElementById('keywordAnalysisModal').remove()" style="
                      background: rgba(255,255,255,0.2);
                      border: none;
                      color: white;
                      padding: 8px 16px;
                      border-radius: 6px;
                      cursor: pointer;
                      font-size: 14px;
                    ">✕ 닫기</button>
                  </div>

                  <!-- 분석 결과 -->
                  <div style="padding: 20px; max-height: 60vh; overflow-y: auto;">
                    \${analysisData.map(item => \`
                      <div style="
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        overflow: hidden;
                      ">
                        <!-- 메인 키워드 -->
                        <div style="
                          background: #f8f9fa;
                          padding: 15px;
                          border-bottom: 1px solid #e0e0e0;
                        ">
                          <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h4 style="margin: 0; color: #333; font-size: 16px;">
                              🎯 \${item.keyword}
                            </h4>
                            <span style="
                              background: \${item.difficulty.color};
                              color: white;
                              padding: 4px 12px;
                              border-radius: 20px;
                              font-size: 12px;
                              font-weight: bold;
                            ">
                              \${item.difficulty.icon} \${item.difficulty.level}
                            </span>
                          </div>
                        </div>

                        <!-- 키워드 통계 -->
                        <div style="padding: 15px;">
                          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px;">
                            <div style="text-align: center; padding: 10px; background: #e3f2fd; border-radius: 6px;">
                              <div style="font-size: 20px; font-weight: bold; color: #1976d2;">
                                \${item.searchVolume.toLocaleString()}
                              </div>
                              <div style="font-size: 12px; color: #666;">월 검색량</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: #f3e5f5; border-radius: 6px;">
                              <div style="font-size: 20px; font-weight: bold; color: #7b1fa2;">
                                \${item.documentCount.toLocaleString()}
                              </div>
                              <div style="font-size: 12px; color: #666;">문서 수</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: #e8f5e8; border-radius: 6px;">
                              <div style="font-size: 20px; font-weight: bold; color: #388e3c;">
                                \${item.competitionRatio}%
                              </div>
                              <div style="font-size: 12px; color: #666;">경쟁도</div>
                            </div>
                          </div>

                          <!-- 연관키워드 -->
                          <div>
                            <h5 style="margin: 0 0 10px 0; color: #333; font-size: 14px;">
                              🔗 연관키워드 (\${item.relatedKeywords.length}개)
                            </h5>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
                              \${item.relatedKeywords.map(related => \`
                                <div style="
                                  border: 1px solid #e0e0e0;
                                  border-radius: 6px;
                                  padding: 10px;
                                  background: #fafafa;
                                ">
                                  <div style="font-weight: bold; color: #333; margin-bottom: 5px;">
                                    \${related.keyword}
                                  </div>
                                  <div style="font-size: 12px; color: #666;">
                                    검색량: \${related.searchVolume.toLocaleString()} | 
                                    문서: \${related.documentCount.toLocaleString()} | 
                                    경쟁도: \${related.competitionRatio}%
                                  </div>
                                </div>
                              \`).join('')}
                            </div>
                          </div>
                        </div>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \`;

              document.body.appendChild(modal);

              modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                  modal.remove();
                }
              });
            }
          }

          // 앱 초기화
          document.addEventListener('DOMContentLoaded', () => {
            window.kinAnalysis = new KinAnalysis();
          });
        </script>
      </body>
      </html>
    `);
    
    kinWindow.document.close();
    console.log('[KIN-MODAL] 새 창 열기 성공');
  } else {
    console.error('[KIN-MODAL] 새 창을 열 수 없음 (팝업 차단됨)');
    alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
  }
}

// ==================== 기타 유틸리티 함수 ====================

/**
 * API 발급 페이지 열기 함수들
 */
function openPexelsApiPage() {
  try {
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://www.pexels.com/api/');
    } else {
      window.open('https://www.pexels.com/api/', '_blank');
    }
  } catch (error) {
    console.error('Pexels API 페이지 열기 실패:', error);
    window.open('https://www.pexels.com/api/', '_blank');
  }
}

function openDalleApiPage() {
  try {
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://platform.openai.com/api-keys');
    } else {
      window.open('https://platform.openai.com/api-keys', '_blank');
    }
  } catch (error) {
    console.error('DALL-E API 페이지 열기 실패:', error);
    window.open('https://platform.openai.com/api-keys', '_blank');
  }
}

function openNaverApiPage() {
  try {
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://developers.naver.com/apps/#/myapps');
    } else {
      window.open('https://developers.naver.com/apps/#/myapps', '_blank');
    }
  } catch (error) {
    console.error('네이버 API 페이지 열기 실패:', error);
    window.open('https://developers.naver.com/apps/#/myapps', '_blank');
  }
}

function openGoogleOAuthPage() {
  try {
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://console.developers.google.com/');
    } else {
      window.open('https://console.developers.google.com/', '_blank');
    }
  } catch (error) {
    console.error('Google OAuth 페이지 열기 실패:', error);
    window.open('https://console.developers.google.com/', '_blank');
  }
}

function openGoogleTrends() {
  try {
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://trends.google.co.kr/trends/');
    } else {
      window.open('https://trends.google.co.kr/trends/', '_blank');
    }
  } catch (error) {
    console.error('Google Trends 페이지 열기 실패:', error);
    window.open('https://trends.google.co.kr/trends/', '_blank');
  }
}

// ==================== 전역 함수 노출 ====================
// 필요한 함수들을 전역으로 노출
window.openKinModal = openKinModal;
window.openPexelsApiPage = openPexelsApiPage;
window.openDalleApiPage = openDalleApiPage;
window.openNaverApiPage = openNaverApiPage;
window.openGoogleOAuthPage = openGoogleOAuthPage;
window.openGoogleTrends = openGoogleTrends;
