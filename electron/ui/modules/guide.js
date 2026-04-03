// 🔧 초보자 가이드 모듈 - 완벽 상세 버전

// 가이드 데이터
const guideData = {
  'ai-api': {
    title: '🤖 AI API 키 발급 완벽 가이드',
    steps: [
      {
        title: '📌 필수! Gemini API 키 발급 (무료)',
        content: `
          <div style="background: #ecfdf5; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #10b981;">
            <strong style="color: #059669; font-size: 16px;">✅ Gemini는 필수입니다! (무료)</strong><br>
            글 생성에 반드시 필요합니다. 무료로 사용 가능해요!
          </div>
          
          <strong style="font-size: 16px;">① 구글 AI Studio 접속</strong><br>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace;">
            https://aistudio.google.com
          </div>
          - 위 주소를 인터넷 주소창에 복사 → 붙여넣기 → Enter<br>
          - 구글 계정으로 로그인 (없으면 만들기)<br><br>
          
          <strong style="font-size: 16px;">② API 키 만들기</strong><br>
          - 화면 왼쪽 메뉴에서 <code style="background: #fef3c7; padding: 2px 6px; border-radius: 4px;">Get API key</code> 클릭<br>
          - <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">Create API key</code> 버튼 클릭<br>
          - 프로젝트 선택창이 뜨면 <code>Create API key in new project</code> 클릭<br>
          - 화면에 API 키가 나타납니다!<br><br>
          
          <strong style="font-size: 16px;">③ API 키 복사하기</strong><br>
          - API 키 옆의 <code style="background: #e0e7ff; padding: 2px 6px; border-radius: 4px;">📋 복사</code> 버튼 클릭<br>
          - 또는 키 전체를 드래그해서 Ctrl+C (복사)<br><br>
          
          <strong style="font-size: 16px;">④ 앱에 붙여넣기</strong><br>
          - 환경설정 → <code>Gemini API Key</code> 칸 클릭<br>
          - Ctrl+V (붙여넣기)<br>
          - 아래 <code style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px;">💾 저장</code> 버튼 클릭<br><br>
          
          <div style="background: #fef3c7; padding: 14px; border-radius: 10px; border-left: 4px solid #f59e0b;">
            <strong>⚠️ 주의사항:</strong><br>
            - API 키는 <code>AIza...</code>로 시작해요<br>
            - 키를 다른 사람과 공유하지 마세요
          </div>
        `
      },
      {
        title: '💡 선택! OpenAI API 키 발급 (유료)',
        content: `
          <div style="background: #fef3c7; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #f59e0b;">
            <strong style="color: #b45309; font-size: 16px;">⭐ 선택사항입니다 (유료)</strong><br>
            더 똑똑한 AI를 원하면 사용하세요. 없어도 됩니다!
          </div>
          
          <strong style="font-size: 16px;">① OpenAI 사이트 접속</strong><br>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace;">
            https://platform.openai.com
          </div>
          - 회원가입 또는 로그인<br>
          - (구글/마이크로소프트 계정으로 가능)<br><br>
          
          <strong style="font-size: 16px;">② 결제 수단 등록</strong><br>
          - 왼쪽 메뉴에서 <code>Settings</code> → <code>Billing</code> 클릭<br>
          - <code>Add payment method</code>로 카드 등록<br>
          - 최소 $5부터 충전 가능<br><br>
          
          <strong style="font-size: 16px;">③ API 키 만들기</strong><br>
          - 왼쪽 메뉴에서 <code>API keys</code> 클릭<br>
          - <code style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px;">+ Create new secret key</code> 버튼 클릭<br>
          - 이름 입력 (예: 블로그자동화)<br>
          - <code>Create secret key</code> 클릭<br><br>
          
          <strong style="font-size: 16px;">④ API 키 복사</strong><br>
          <div style="background: #fee2e2; padding: 14px; border-radius: 10px; margin: 12px 0; border-left: 4px solid #ef4444;">
            <strong>🚨 매우 중요!</strong><br>
            키는 <strong>한 번만</strong> 보여줍니다!<br>
            반드시 바로 복사해서 저장하세요!
          </div>
          - <code style="background: #e0e7ff; padding: 2px 6px; border-radius: 4px;">📋 Copy</code> 버튼 클릭<br>
          - 메모장에 임시 저장해두세요<br><br>
          
          <strong style="font-size: 16px;">⑤ 앱에 붙여넣기</strong><br>
          - 환경설정 → <code>OpenAI API Key</code> 칸에 붙여넣기<br>
          - <code style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px;">💾 저장</code> 버튼 클릭<br><br>
          
          <div style="background: #f1f5f9; padding: 14px; border-radius: 10px;">
            <strong>💰 비용 안내:</strong><br>
            - GPT-4o: 약 100~200원/글<br>
            - GPT-3.5: 약 10~20원/글<br>
            - 한 달 $5~20면 충분해요
          </div>
        `
      }
    ]
  },
  
  'image-api': {
    title: '📸 이미지 API 키 발급 완벽 가이드',
    steps: [
      {
        title: '🆓 Pollinations AI (무료! 설정 불필요)',
        content: `
          <div style="background: #d1fae5; padding: 20px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #10b981; text-align: center;">
            <span style="font-size: 48px;">🎉</span><br><br>
            <strong style="color: #059669; font-size: 20px;">API 키 필요 없음!</strong><br><br>
            Pollinations AI는 무료이며<br>
            <strong>아무 설정 없이 바로 사용 가능</strong>합니다!
          </div>
          
          <div style="background: #f1f5f9; padding: 16px; border-radius: 10px;">
            <strong>💡 Pollinations 특징:</strong><br>
            ✅ 완전 무료<br>
            ✅ API 키 필요 없음<br>
            ✅ 무제한 사용 가능<br>
            ✅ 빠른 이미지 생성<br><br>
            <strong>🎨 이미지 소스에서 "Pollinations" 선택하면 끝!</strong>
          </div>
        `
      },
      {
        title: '📷 Pexels API 키 발급 (무료!)',
        content: `
          <div style="background: #ecfdf5; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #10b981;">
            <strong style="color: #059669; font-size: 16px;">✅ 무료 고품질 사진!</strong><br>
            실제 사진이 필요할 때 사용하세요. 완전 무료!
          </div>
          
          <strong style="font-size: 16px;">① Pexels 사이트 접속</strong><br>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace;">
            https://www.pexels.com/api
          </div>
          
          <strong style="font-size: 16px;">② 회원가입</strong><br>
          - <code style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px;">Get Started</code> 또는 <code>Your API Key</code> 버튼 클릭<br>
          - 이메일로 회원가입<br>
          - (구글/페이스북 로그인도 가능)<br>
          - 이메일로 온 인증 링크 클릭<br><br>
          
          <strong style="font-size: 16px;">③ API 키 확인</strong><br>
          - 로그인하면 자동으로 API 키 페이지로 이동<br>
          - <code>Your API Key</code> 아래에 키가 보여요<br>
          - 복사 버튼 클릭<br><br>
          
          <strong style="font-size: 16px;">④ 앱에 붙여넣기</strong><br>
          - 환경설정 → <code>Pexels API Key</code> 칸에 붙여넣기<br>
          - <code style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px;">💾 저장</code> 버튼 클릭<br><br>
          
          <div style="background: #f1f5f9; padding: 14px; border-radius: 10px;">
            <strong>💡 Pexels 특징:</strong><br>
            - 완전 무료 (월 20,000건)<br>
            - 실제 고품질 사진<br>
            - 출처 표기 자동 처리됨
          </div>
        `
      },
      {
        title: '🎨 Stability AI 키 발급 (유료, 고품질)',
        content: `
          <div style="background: #fef3c7; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #f59e0b;">
            <strong style="color: #b45309; font-size: 16px;">⭐ 선택사항 (유료)</strong><br>
            고품질 AI 이미지가 필요할 때 사용하세요
          </div>
          
          <strong style="font-size: 16px;">① Stability AI 사이트 접속</strong><br>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace;">
            https://platform.stability.ai
          </div>
          
          <strong style="font-size: 16px;">② 회원가입 및 로그인</strong><br>
          - <code>Sign Up</code> 또는 <code>Log In</code> 클릭<br>
          - 구글 계정으로 간편 가입 가능<br><br>
          
          <strong style="font-size: 16px;">③ API 키 생성</strong><br>
          - 로그인 후 오른쪽 위 프로필 클릭<br>
          - <code>API Keys</code> 메뉴 선택<br>
          - <code style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px;">+ Create API Key</code> 클릭<br>
          - 이름 입력 후 생성<br>
          - <code>sk-...</code>로 시작하는 키 복사<br><br>
          
          <strong style="font-size: 16px;">④ 앱에 붙여넣기</strong><br>
          - 환경설정 → <code>Stability AI API Key</code> 칸에 붙여넣기<br>
          - <code style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px;">💾 저장</code> 버튼 클릭<br><br>
          
          <div style="background: #f1f5f9; padding: 14px; border-radius: 10px;">
            <strong>💰 비용 안내:</strong><br>
            - 신규 가입 시 무료 크레딧 제공<br>
            - 이미지 1장당 약 0.02~0.05 크레딧<br>
            - 10$ 충전으로 수백장 생성 가능
          </div>
        `
      }
    ]
  },
  
  'naver-api': {
    title: '🟢 네이버 API 발급 완벽 가이드',
    steps: [
      {
        title: '📊 네이버 검색광고 API (키워드 분석용)',
        content: `
          <div style="background: #d1fae5; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #10b981;">
            <strong style="color: #059669; font-size: 16px;">💡 키워드 마스터 기능에 필요</strong><br>
            한국 키워드 검색량 분석에 사용됩니다
          </div>
          
          <strong style="font-size: 16px;">① 네이버 검색광고 접속</strong><br>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace;">
            https://searchad.naver.com
          </div>
          
          <strong style="font-size: 16px;">② 광고 계정 만들기</strong><br>
          - 네이버 계정으로 로그인<br>
          - <code style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px;">광고 계정 만들기</code> 버튼 클릭<br>
          - "개인" 선택 (사업자 없어도 됨)<br>
          - 필요한 정보 입력 후 완료<br><br>
          
          <strong style="font-size: 16px;">③ API 설정 페이지 이동</strong><br>
          - 로그인 후 오른쪽 위 <code>도구</code> 클릭<br>
          - <code>API 관리</code> 메뉴 선택<br>
          - (또는 검색창에 "API 관리" 검색)<br><br>
          
          <strong style="font-size: 16px;">④ Customer ID 확인</strong><br>
          - API 관리 페이지 상단에 표시됨<br>
          - 숫자로 된 ID를 복사<br>
          - 환경설정 → <code>Customer ID</code> 칸에 붙여넣기<br><br>
          
          <strong style="font-size: 16px;">⑤ Secret Key 생성</strong><br>
          - <code style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">API Secret Key 생성</code> 버튼 클릭<br>
          - 생성된 키 복사<br>
          - 환경설정 → <code>Secret Key</code> 칸에 붙여넣기<br>
          - <code style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px;">💾 저장</code> 버튼 클릭<br><br>
          
          <div style="background: #fef3c7; padding: 14px; border-radius: 10px; border-left: 4px solid #f59e0b;">
            <strong>⚠️ 주의:</strong> 광고비 충전 없이도 API는 무료로 사용 가능합니다!
          </div>
        `
      }
    ]
  },
  
  'google-cse': {
    title: '🔍 Google CSE 설정 완벽 가이드',
    steps: [
      {
        title: '☁️ Google Cloud Console 설정',
        content: `
          <div style="background: #dbeafe; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #3b82f6;">
            <strong style="color: #1d4ed8; font-size: 16px;">📌 이미지 검색에 사용됩니다</strong><br>
            설정이 조금 복잡하지만 천천히 따라하세요!
          </div>
          
          <strong style="font-size: 16px;">① Google Cloud Console 접속</strong><br>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace;">
            https://console.cloud.google.com
          </div>
          - 구글 계정으로 로그인<br>
          - 처음이면 약관 동의<br><br>
          
          <strong style="font-size: 16px;">② 새 프로젝트 만들기</strong><br>
          - 화면 상단 <code>프로젝트 선택</code> 클릭<br>
          - <code style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">새 프로젝트</code> 버튼 클릭<br>
          - 프로젝트 이름: <code>블로그자동화</code> 입력<br>
          - <code>만들기</code> 클릭하고 잠시 대기<br><br>
          
          <strong style="font-size: 16px;">③ Custom Search API 활성화</strong><br>
          - 왼쪽 메뉴 ☰ → <code>API 및 서비스</code> → <code>라이브러리</code><br>
          - 검색창에 <code>Custom Search API</code> 입력<br>
          - <code>Custom Search API</code> 클릭<br>
          - <code style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">사용</code> 버튼 클릭<br><br>
          
          <strong style="font-size: 16px;">④ API 키 만들기</strong><br>
          - 왼쪽 메뉴 → <code>사용자 인증 정보</code><br>
          - <code style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">+ 사용자 인증 정보 만들기</code> 클릭<br>
          - <code>API 키</code> 선택<br>
          - 생성된 API 키 복사<br>
          - 환경설정 → <code>API Key</code> 칸에 붙여넣기
        `
      },
      {
        title: '🔎 검색 엔진(CX) 만들기',
        content: `
          <strong style="font-size: 16px;">① Programmable Search Engine 접속</strong><br>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace;">
            https://programmablesearchengine.google.com
          </div>
          
          <strong style="font-size: 16px;">② 새 검색 엔진 만들기</strong><br>
          - <code style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">시작하기</code> 또는 <code>Add</code> 버튼 클릭<br><br>
          
          - <strong>검색 엔진 이름:</strong> <code>블로그이미지검색</code><br>
          - <strong>검색할 사이트:</strong> 빈칸으로 두기 또는 <code>*.com</code><br>
          - <strong>전체 웹 검색:</strong> <code style="background: #d1fae5; padding: 2px 8px; border-radius: 4px;">✅ 켜기</code><br>
          - <strong>이미지 검색:</strong> <code style="background: #d1fae5; padding: 2px 8px; border-radius: 4px;">✅ 켜기</code><br><br>
          
          - <code>만들기</code> 버튼 클릭<br><br>
          
          <strong style="font-size: 16px;">③ 검색 엔진 ID (CX) 확인</strong><br>
          - 만든 검색 엔진 클릭<br>
          - <code>기본 정보</code> 또는 <code>Setup</code> 탭<br>
          - <strong>검색 엔진 ID</strong>를 찾아 복사<br>
          - (보통 <code>영문숫자:숫자</code> 형식)<br><br>
          
          <strong style="font-size: 16px;">④ 앱에 붙여넣기</strong><br>
          - 환경설정 → <code>Search Engine ID (CX)</code> 칸에 붙여넣기<br>
          - <code style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px;">💾 저장</code> 버튼 클릭<br><br>
          
          <div style="background: #f1f5f9; padding: 14px; border-radius: 10px;">
            <strong>💡 무료 한도:</strong> 하루 100건 검색 무료
          </div>
        `
      }
    ]
  },
  
  'platform': {
    title: '📝 블로그 플랫폼 연동 완벽 가이드',
    steps: [
      {
        title: '🌐 WordPress 연동하기',
        content: `
          <div style="background: #dbeafe; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #3b82f6;">
            <strong style="color: #1d4ed8; font-size: 16px;">💡 WordPress.org 자체 호스팅 사이트만 가능</strong><br>
            WordPress.com 무료 블로그는 지원하지 않습니다
          </div>
          
          <strong style="font-size: 16px;">① 사이트 URL 확인</strong><br>
          - 내 워드프레스 사이트 주소 확인<br>
          - 예: <code>https://myblog.com</code><br>
          - 환경설정 → <code>Site URL</code> 칸에 입력<br><br>
          
          <strong style="font-size: 16px;">② Username 입력</strong><br>
          - 워드프레스 관리자 아이디 입력<br>
          - (로그인할 때 쓰는 아이디)<br><br>
          
          <strong style="font-size: 16px;">③ Application Password 만들기</strong><br>
          <div style="background: #fee2e2; padding: 12px; border-radius: 8px; margin: 8px 0; border-left: 4px solid #ef4444;">
            <strong>🚨 중요!</strong> 일반 비밀번호가 아닙니다!<br>
            반드시 Application Password를 만들어야 합니다!
          </div>
          
          - 워드프레스 관리자 페이지 접속<br>
          - 왼쪽 메뉴 → <code>사용자</code> → <code>프로필</code><br>
          - 맨 아래로 스크롤<br>
          - <code style="background: #1e293b; color: white; padding: 2px 8px; border-radius: 4px;">Application Passwords</code> 섹션 찾기<br>
          - 새 이름 입력: <code>자동포스팅</code><br>
          - <code style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">Add New Application Password</code> 클릭<br><br>
          
          <strong style="font-size: 16px;">④ 비밀번호 복사 및 저장</strong><br>
          <div style="background: #fee2e2; padding: 12px; border-radius: 8px; margin: 8px 0; border-left: 4px solid #ef4444;">
            <strong>🚨 한 번만 보여줍니다!</strong> 반드시 바로 복사하세요!
          </div>
          - 생성된 비밀번호 전체 복사 (공백 포함!)<br>
          - 예: <code>l3rq pnAO QTfU 8RjE mwVc j9kQ</code><br>
          - 환경설정 → <code>Application Password</code> 칸에 붙여넣기<br>
          - <code style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px;">💾 저장</code> 버튼 클릭
        `
      },
      {
        title: '🔶 Blogger 연동하기',
        content: `
          <div style="background: #fef3c7; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #f59e0b;">
            <strong style="color: #b45309; font-size: 16px;">📌 구글 블로그(Blogger) 연동 방법</strong><br>
            설정이 조금 복잡하지만 천천히 따라하세요!
          </div>
          
          <strong style="font-size: 16px;">① Blog ID 확인하기</strong><br>
          - <code>blogger.com</code> 접속 및 로그인<br>
          - 내 블로그 선택<br>
          - 주소창 URL 확인:<br>
          <div style="background: #f1f5f9; padding: 8px; border-radius: 6px; margin: 8px 0; font-size: 13px;">
            https://www.blogger.com/blog/posts/<strong style="color: #ef4444;">1234567890123456789</strong>
          </div>
          - 빨간색 숫자가 Blog ID입니다!<br>
          - 환경설정 → <code>Blog ID</code> 칸에 붙여넣기<br><br>
          
          <strong style="font-size: 16px;">② Google Cloud Console 설정</strong><br>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace;">
            https://console.cloud.google.com
          </div>
          - 구글 계정으로 로그인<br>
          - 새 프로젝트 만들기 (위에서 만들었으면 그대로 사용)<br><br>
          
          <strong style="font-size: 16px;">③ Blogger API 활성화</strong><br>
          - 왼쪽 메뉴 ☰ → <code>API 및 서비스</code> → <code>라이브러리</code><br>
          - 검색창에 <code>Blogger API v3</code> 입력<br>
          - <code>Blogger API v3</code> 클릭<br>
          - <code style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">사용</code> 버튼 클릭<br><br>
          
          <strong style="font-size: 16px;">④ OAuth 동의 화면 설정</strong><br>
          - 왼쪽 메뉴 → <code>OAuth 동의 화면</code><br>
          - User Type: <code>외부</code> 선택 → <code>만들기</code><br>
          - 앱 이름: <code>블로그자동화</code><br>
          - 사용자 지원 이메일: 내 이메일 선택<br>
          - 개발자 연락처: 내 이메일 입력<br>
          - <code>저장 후 계속</code> → <code>저장 후 계속</code> → <code>저장 후 계속</code><br>
          - 테스트 사용자에 내 이메일 추가<br><br>
          
          <strong style="font-size: 16px;">⑤ OAuth 클라이언트 만들기</strong><br>
          - 왼쪽 메뉴 → <code>사용자 인증 정보</code><br>
          - <code style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px;">+ 사용자 인증 정보 만들기</code> 클릭<br>
          - <code>OAuth 클라이언트 ID</code> 선택<br>
          - 애플리케이션 유형: <code style="background: #fef3c7; padding: 2px 8px; border-radius: 4px;">데스크톱 앱</code><br>
          - 이름: <code>블로그자동화</code><br>
          - <code>만들기</code> 클릭<br><br>
          
          <strong style="font-size: 16px;">⑥ 클라이언트 정보 복사</strong><br>
          - 팝업에서 <code>클라이언트 ID</code> 복사 → 환경설정 <code>Google Client ID</code>에 붙여넣기<br>
          - <code>클라이언트 보안 비밀</code> 복사 → 환경설정 <code>Google Client Secret</code>에 붙여넣기<br>
          - <code style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px;">💾 저장</code> 버튼 클릭<br><br>
          
          <div style="background: #d1fae5; padding: 14px; border-radius: 10px;">
            <strong>✅ 첫 발행 시:</strong><br>
            구글 로그인 창이 뜨면 로그인하고 권한 허용해주세요!
          </div>
        `
      }
    ]
  },
  
  'api-keys': {
    title: '🔑 API 키 발급 전체 가이드',
    steps: [
      {
        title: '❓ API 키가 뭔가요?',
        content: `
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 64px;">🎫</span>
          </div>
          
          <strong style="font-size: 18px;">API 키 = "디지털 출입증"</strong><br><br>
          
          놀이공원에 들어가려면 입장권이 필요하듯이,<br>
          AI 서비스를 사용하려면 <strong>API 키</strong>가 필요해요!<br><br>
          
          <div style="background: #f1f5f9; padding: 16px; border-radius: 12px; margin: 12px 0;">
            <strong>🔑 API 키로 할 수 있는 것들:</strong><br><br>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div>🤖 AI가 글을 써줘요</div>
              <div>🖼️ 이미지를 찾아줘요</div>
              <div>📊 키워드를 분석해요</div>
              <div>📝 블로그에 발행해요</div>
            </div>
          </div>
        `
      },
      {
        title: '⭐ 필수 vs 선택 API',
        content: `
          <div style="background: #d1fae5; padding: 20px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #10b981;">
            <strong style="color: #059669; font-size: 18px;">✅ 필수 API (이것만 있으면 사용 가능!)</strong><br><br>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #a7f3d0;"><strong>Gemini API</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #a7f3d0;">AI 글 생성</td>
                <td style="padding: 8px; border-bottom: 1px solid #a7f3d0; color: #059669; font-weight: bold;">무료!</td>
              </tr>
              <tr>
                <td style="padding: 8px;"><strong>Pollinations</strong></td>
                <td style="padding: 8px;">AI 이미지 생성</td>
                <td style="padding: 8px; color: #059669; font-weight: bold;">무료! (설정 불필요)</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 12px; border: 2px solid #f59e0b;">
            <strong style="color: #b45309; font-size: 18px;">⭐ 선택 API (있으면 더 좋아요)</strong><br><br>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a;"><strong>OpenAI</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a;">더 똑똑한 AI</td>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a;">유료</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a;"><strong>Pexels</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a;">실제 사진</td>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a; color: #059669;">무료!</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a;"><strong>Stability AI</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a;">고품질 AI 이미지</td>
                <td style="padding: 8px; border-bottom: 1px solid #fde68a;">유료</td>
              </tr>
              <tr>
                <td style="padding: 8px;"><strong>네이버 API</strong></td>
                <td style="padding: 8px;">키워드 분석</td>
                <td style="padding: 8px; color: #059669;">무료!</td>
              </tr>
            </table>
          </div>
        `
      },
      {
        title: '🚀 초보자 추천 설정 순서',
        content: `
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
            <strong style="font-size: 20px;">15분이면 끝!</strong><br>
            아래 순서대로 따라하세요
          </div>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 12px; border-left: 4px solid #10b981;">
            <strong style="font-size: 16px; color: #059669;">1️⃣ Gemini API 발급 (5분)</strong><br>
            환경설정 → 🤖 AI API 키 → 초보자 가이드
          </div>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 12px; border-left: 4px solid #3b82f6;">
            <strong style="font-size: 16px; color: #1d4ed8;">2️⃣ 블로그 연동 (10분)</strong><br>
            환경설정 → 📝 블로그 플랫폼 → 초보자 가이드
          </div>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 12px; border-left: 4px solid #f59e0b;">
            <strong style="font-size: 16px; color: #b45309;">3️⃣ 저장하기</strong><br>
            환경설정 맨 아래 💾 저장 버튼 클릭!
          </div>
          
          <div style="background: #d1fae5; padding: 20px; border-radius: 12px; text-align: center;">
            <span style="font-size: 48px;">🎉</span><br><br>
            <strong style="font-size: 18px; color: #059669;">완료! 이제 바로 사용할 수 있어요!</strong>
          </div>
        `
      }
    ]
  },
  
  'calendar': {
    title: '📅 달력 메모 사용법',
    steps: [
      {
        title: '✏️ 메모 작성하기',
        content: `
          <strong>① 날짜 클릭하기</strong><br>
          - 달력에서 원하는 날짜를 마우스로 클릭하세요<br>
          - 메모 입력창이 나타나요<br><br>
          
          <strong>② 메모 입력하기</strong><br>
          - 할 일이나 기억할 내용을 적으세요<br>
          - 예: "블로그 글 3개 작성하기"<br>
          - "확인" 버튼을 클릭하세요<br><br>
          
          <strong>③ 메모 확인하기</strong><br>
          - 메모가 있는 날짜는 <span style="color: #ffd700; font-weight: 800;">금색</span>으로 표시돼요<br>
          - 날짜 옆에 작은 금색 점이 보여요<br>
          - 다시 클릭하면 메모를 볼 수 있어요
        `
      },
      {
        title: '✅ 완료 표시하기',
        content: `
          <strong>① 마우스 우클릭하기</strong><br>
          - 완료한 날짜에서 마우스 오른쪽 버튼 클릭<br>
          - (맥: Control + 클릭)<br><br>
          
          <strong>② 완료 표시 확인</strong><br>
          - 날짜에 줄이 그어져요 (취소선)<br>
          - 조금 흐리게 보여요<br><br>
          
          <strong>③ 완료 취소하기</strong><br>
          - 다시 우클릭하면 완료 표시가 사라져요<br>
          - 언제든지 바꿀 수 있어요!
        `
      },
      {
        title: '🗑️ 메모 삭제하기',
        content: `
          <strong>① 날짜 클릭하기</strong><br>
          - 삭제하고 싶은 메모가 있는 날짜 클릭<br><br>
          
          <strong>② 내용 지우기</strong><br>
          - 메모 입력창에서 모든 내용 지우기<br>
          - 빈 칸으로 만들기<br><br>
          
          <strong>③ 확인 클릭</strong><br>
          - "확인" 버튼 클릭<br>
          - 메모가 완전히 삭제돼요<br>
          - 날짜 색도 원래대로 돌아와요
        `
      },
      {
        title: '💡 활용 팁',
        content: `
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
            <strong>📝 이렇게 사용해보세요!</strong><br><br>
            • 매일 작성할 블로그 개수 기록<br>
            • 중요한 마감일 표시<br>
            • 완료한 작업은 우클릭으로 체크<br>
            • 한 주 계획 미리 적어두기
          </div>
          
          <div style="background: #d1fae5; padding: 16px; border-radius: 8px;">
            <strong>🎯 예시 메모:</strong><br><br>
            "블로그 글 5개 작성"<br>
            "키워드 조사하기"<br>
            "이미지 10개 준비"<br>
            "워드프레스 설정 확인"
          </div>
        `
      }
    ]
  }
};

// 가이드 모달 표시
export function showGuide(guideType) {
  const guide = guideData[guideType];
  if (!guide) {
    console.error('가이드를 찾을 수 없습니다:', guideType);
    return;
  }
  
  // 가이드 모달 생성
  const modal = document.getElementById('guideModal');
  if (!modal) {
    console.error('guideModal 요소를 찾을 수 없습니다');
    return;
  }
  
  const modalContent = document.getElementById('guideModalContent');
  if (!modalContent) {
    console.error('guideModalContent 요소를 찾을 수 없습니다');
    return;
  }
  
  // 가이드 내용 생성
  let contentHTML = `<h2 style="font-size: 28px; font-weight: 800; color: #1e293b; margin-bottom: 24px;">${guide.title}</h2>`;
  
  guide.steps.forEach((step, index) => {
    contentHTML += `
      <div style="background: ${index % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-radius: 16px; padding: 24px; margin-bottom: 16px; border-left: 4px solid #10b981;">
        <h3 style="font-size: 20px; font-weight: 700; color: #059669; margin-bottom: 16px;">${step.title}</h3>
        <div style="font-size: 15px; line-height: 1.8; color: #475569;">
          ${step.content}
        </div>
      </div>
    `;
  });
  
  modalContent.innerHTML = contentHTML;
  modal.style.display = 'flex';
}

// 가이드 모달 닫기
export function closeGuide() {
  const modal = document.getElementById('guideModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 전역 함수로 등록
window.showGuide = showGuide;
window.closeGuide = closeGuide;
