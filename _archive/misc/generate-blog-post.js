// 키워드로 블로그 포스트 생성 및 발행 시스템
const fs = require('fs');
const path = require('path');

// 키워드 기반 콘텐츠 생성 및 발행
async function generateBlogPost(keyword, isPreview = false) {
    console.log('🎯 키워드 기반 블로그 포스트 생성');
    console.log('=================================');
    console.log(`📝 키워드: "${keyword}"`);

    try {
        // 1. 환경 설정 로드
        console.log('\n🔧 환경 설정 로드 중...');
        const envData = loadEnvironment();

        // 2. 콘텐츠 전략 분석
        console.log('\n🎭 콘텐츠 전략 분석 중...');
        const contentStrategy = analyzeContentStrategy(keyword);

        // 3. AI 콘텐츠 생성 (모의)
        console.log('\n🤖 AI 콘텐츠 생성 중...');
        const generatedContent = await generateAIContent(keyword, contentStrategy);

        // 4. HTML 포맷팅 및 스타일 적용
        console.log('\n🎨 HTML 포맷팅 및 스타일 적용 중...');
        const formattedContent = formatContent(generatedContent.content, keyword);

        // 5. CTA 자동 삽입
        console.log('\n🎯 CTA 자동 삽입 중...');
        const contentWithCTA = await addCTAs(formattedContent, keyword);

        // 6. Blogger 발행 또는 미리보기
    if (isPreview) {
        // 미리보기 모드
        console.log('\n👀 콘텐츠 미리보기');
        console.log('==================');

        // 콘텐츠 미리보기 (HTML 태그 제거)
        const plainText = contentWithCTA
            .replace(/<[^>]*>/g, '') // HTML 태그 제거
            .replace(/\n\s*\n/g, '\n') // 빈 줄 정리
            .trim();

        console.log(`📝 제목: ${generatedContent.title}`);
        console.log(`📊 콘텐츠 길이: ${contentWithCTA.length}자 (${plainText.length}자 텍스트)`);
        console.log(`🏷️ 키워드: ${keyword}`);
        console.log(`🎯 전략: ${contentStrategy.expertise}`);
        console.log('');

        // 콘텐츠 요약 미리보기 (처음 500자)
        console.log('📄 콘텐츠 미리보기 (처음 500자):');
        console.log('=====================================');
        console.log(plainText.substring(0, 500) + (plainText.length > 500 ? '...\n\n[콘텐츠가 길어 500자로 요약 표시했습니다]' : ''));
        console.log('');

        // CTA 정보
        console.log('🎯 포함된 CTA:');
        const ctaMatches = contentWithCTA.match(/href="([^"]+)"/g);
        if (ctaMatches) {
            ctaMatches.forEach((match, index) => {
                const url = match.replace('href="', '').replace('"', '');
                console.log(`   ${index + 1}. ${url}`);
            });
        } else {
            console.log('   (CTA 없음)');
        }

        console.log('\n💡 실제 발행을 원하시면 --preview 옵션을 제거하세요!');
        console.log('   node generate-blog-post.js "연말정산"');

        return {
            keyword,
            title: generatedContent.title,
            content: contentWithCTA,
            contentLength: contentWithCTA.length,
            strategy: contentStrategy.expertise,
            preview: true
        };

    } else {
        // 실제 발행 모드
        console.log('\n📤 Blogger 발행 중...');
        const publishResult = await publishToBlogger(
            generatedContent.title,
            contentWithCTA,
            envData.BLOGGER_BLOG_ID,
            keyword
        );

        // 7. 결과 출력
        console.log('\n🎉 포스트 발행 완료!');
        console.log('===================');
        console.log(`📝 제목: ${generatedContent.title}`);
        console.log(`🔗 URL: ${publishResult.url}`);
        console.log(`📊 콘텐츠 길이: ${contentWithCTA.length}자`);
        console.log(`🏷️ 키워드: ${keyword}`);
        console.log(`🎯 전략: ${contentStrategy.expertise}`);

        return {
            keyword,
            title: generatedContent.title,
            url: publishResult.url,
            contentLength: contentWithCTA.length,
            strategy: contentStrategy.expertise
        };
    }

    } catch (error) {
        console.error('\n❌ 포스트 생성 실패:', error.message);
        throw error;
    }
}

// 환경 설정 로드
function loadEnvironment() {
    const envPath = path.join(process.env.APPDATA || '', 'blogger-gpt-cli', '.env');
    const envData = {};

    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                    envData[key.trim()] = value.trim();
                }
            }
        });
    }

    if (!envData.BLOGGER_BLOG_ID && envData.GOOGLE_BLOG_ID) {
        envData.BLOGGER_BLOG_ID = envData.GOOGLE_BLOG_ID;
    }

    return envData;
}

// 콘텐츠 전략 분석
function analyzeContentStrategy(keyword) {
    const lowerKeyword = keyword.toLowerCase();

    // 키워드별 전략 매핑
    if (lowerKeyword.includes('프로그래밍') || lowerKeyword.includes('코딩') || lowerKeyword.includes('개발')) {
        return {
            expertise: "시니어 개발자의 실무 노하우",
            contentFocus: "실무에서 바로 써먹는 꿀팁과 커리어 전략",
            primaryGoal: "개발자들이 '이렇게 일했으면...' 하는 후회 방지",
            audienceFocus: "주니어에서 시니어까지 - 현업에서 살아남고 싶은 모든 개발자",
            contentApproach: "'나도 5년차 때 이런 실수 했었어' 스타일의 생생한 경험 공유",
            writingStyle: "선배 개발자의 따뜻한 조언, 기술 용어 쉽게 풀어쓰기",
            requiredElements: ["실제 프로젝트 경험담", "코드 예시", "직장 생활 팁", "커리어 조언"],
            contentStructure: ["후회되는 실수 고백", "실무 꿀팁 공유", "커리어 전략 조언", "마무리 응원"],
            engagementElements: ["개발 고민 댓글 요청", "코드 리뷰 제안", "커리어 상담 요청"],
            uniqueAngle: "실무 현장에서 쌓은 피와 땀의 노하우"
        };
    }

    if (lowerKeyword.includes('건강') || lowerKeyword.includes('약') || lowerKeyword.includes('병원')) {
        return {
            expertise: "약국 현장 15년차 약사의 건강 조언",
            contentFocus: "병원에서는 말하지 않는 약의 진짜 이야기",
            primaryGoal: "환자들이 '이제 건강 관리 자신 있어!' 하는 마음가짐 갖게 하기",
            audienceFocus: "약 먹느라 불안한 모든 환자들과 건강 고민러",
            contentApproach: "약사로서 겪은 환자들의 진짜 얼굴들 공유",
            writingStyle: "약사 선생님의 따뜻한 목소리, 어려운 용어 쉽게 설명",
            requiredElements: ["부작용 사례 공유", "생활 속 관리법", "병원 밖 꿀팁", "심리적 위로"],
            contentStructure: ["불안한 마음 공감", "약의 진짜 속사정", "생활 관리 전략", "안심 메시지"],
            engagementElements: ["약 관련 고민 공유", "건강 일기 챌린지", "병원 방문 팁 요청"],
            uniqueAngle: "약국 현장에서 환자들을 돌보며 쌓은 실질적 건강 지혜"
        };
    }

    if (lowerKeyword.includes('투자') || lowerKeyword.includes('주식') || lowerKeyword.includes('금융')) {
        return {
            expertise: "현직 펀드매니저의 투자 심리 분석",
            contentFocus: "월가에서는 가르쳐주지 않는 진짜 투자 전략",
            primaryGoal: "투자 초보들이 '이제 투자가 두렵지 않아!' 하는 자신감 갖기",
            audienceFocus: "주린이에서 중급까지 - '돈 벌고 싶지만 무서운' 투자 고민러",
            contentApproach: "수십억 원 굴리며 겪은 성공과 실패의 생생한 스토리",
            writingStyle: "펀드매니저의 현장감 있는 조언, 투자 심리학 중심",
            requiredElements: ["실패담 고백", "심리 관리 전략", "실전 투자 팁", "리스크 관리"],
            contentStructure: ["투자 초보 시절 고백", "겪은 실패들 공유", "성공 전략 공개", "마음가짐 조언"],
            engagementElements: ["투자 실패 경험 공유", "포트폴리오 상담", "시장 전망 토론"],
            uniqueAngle: "현직 펀드매니저로서의 시장 통찰과 투자자 심리 이해"
        };
    }

    // 기본 전략
    return {
        expertise: "전문가의 실무적 조언",
        contentFocus: "남들이 모르는 실질적 노하우 공유",
        primaryGoal: "독자들이 '이렇게 알았으면...' 하는 후회 방지",
        audienceFocus: "해당 분야에 관심 있는 모든 사람들",
        contentApproach: "실무 현장에서 쌓은 생생한 경험 공유",
        writingStyle: "친근하면서도 전문적인 톤",
        requiredElements: ["개인 경험담", "실질적 팁", "주의사항", "마무리 조언"],
        contentStructure: ["문제 인식", "해결 전략", "실행 팁", "마무리 응원"],
        engagementElements: ["경험 공유 요청", "질문 환영", "커뮤니티 형성"],
        uniqueAngle: "현장 전문가의 독보적인 관점"
    };
}

// AI 콘텐츠 생성 (모의 - 실제로는 AI API 호출)
async function generateAIContent(keyword, strategy) {
    console.log(`   📝 콘텐츠 생성 전략: ${strategy.expertise}`);

    // 실제 AI 호출 대신 고품질 샘플 콘텐츠 생성
    let title, content;

    if (keyword.toLowerCase().includes('프로그래밍')) {
        title = `개발자라면 반드시 알아야 할 ${keyword} 실무 꿀팁 7가지`;
        content = `
<h1>${title}</h1>

<p>나도 처음 ${keyword} 배울 때 솔직히 말해서 '이게 왜 이렇게 중요하지?' 싶었어요. 7년차 개발자로 일하면서 깨달은 건데, ${keyword}의 진짜 가치는 '생산성'에 있어요. 오늘은 나처럼 야근에 찌든 개발자들을 위해 실무에서 바로 써먹을 수 있는 꿀팁들을 공유하려고 해요.</p>

<h2>1. 개념부터 제대로 잡아라</h2>
<p>나도 처음엔 '설명서 읽기 귀찮아' 하면서 시작했어요. 결국 3개월간 헤맸죠. ${keyword}의 기본 개념을 제대로 이해하지 않으면 나중에 큰코다칩니다. 차라리 처음에 시간을 투자하세요.</p>

<h2>2. 실제 프로젝트에 바로 적용하기</h2>
<p>공부만 하지 말고 실제 프로젝트에 적용해보세요. 나도 ${keyword} 배운지 1년 만에 처음 적용했는데, 그때의 실패 경험이 지금의 노하우가 되었어요. 실전이 최고의 스승입니다.</p>

<h2>3. 커뮤니티 활용하기</h2>
<p>혼자 끙끙 앓지 마세요. Stack Overflow나 Reddit 같은 커뮤니티에서 같은 고민을 하는 사람들이 많아요. 나도 ${keyword} 적용할 때 커뮤니티 덕분에 해결했어요.</p>

<h2>4. 테스트 코드 작성하기</h2>
<p>이건 정말 중요한데, 초보 개발자들이 가장 많이 실수해요. ${keyword} 적용 후 버그가 나면 큰일이예요. 반드시 테스트 코드를 작성하세요. 나도 처음엔 귀찮다고 안 썼다가 밤을 새웠어요.</p>

<h2>5. 성능 모니터링하기</h2>
<p>${keyword} 적용 후 시스템 성능이 어떻게 변하는지 모니터링하세요. 나도 적용하고 나서 성능이 떨어진 줄 모르고 한 달을 헤맸어요. 지금은 적용 전후로 항상 모니터링합니다.</p>

<h2>6. 문서화 습관 들이기</h2>
<p>나중에 본인이 봐도 이해할 수 있도록 코드를 문서화하세요. ${keyword} 같은 복잡한 기술일수록 문서화가 중요해요. 나도 처음엔 '귀찮아' 했는데 지금은 필수 습관이에요.</p>

<h2>7. 지속적인 학습 유지하기</h2>
<p>${keyword} 기술은 계속 발전해요. 나도 처음엔 '이제 배웠으니 끝'이라고 생각했어요. 하지만 기술은 살아있는 생물입니다. 꾸준히 공부하세요.</p>

<h2>마무리</h2>
<p>이 7가지 꿀팁만 제대로 실천해도 ${keyword} 실력이 확 올라갈 거예요. 나처럼 '개발자로서 어떻게 하면 더 효율적으로 일할 수 있을까' 고민하는 분들에게 도움이 되었으면 좋겠어요. 궁금한 점 있으면 댓글 남겨주세요!</p>
        `;
    } else if (keyword.toLowerCase().includes('건강')) {
        title = `병원에서 절대 말하지 않는 ${keyword} 관리법`;
        content = `
<h1>${title}</h1>

<p>10년차 약사로 일하면서 환자분들께 가장 많이 받는 질문이 있어요. "${keyword} 이렇게 관리하면 정말 괜찮을까요?" 사실 병원에서는 치료 효과만 강조하느라 일상 관리에 대해서는 자세히 말씀드리지 못해요. 오늘은 제가 현장에서 직접 본 ${keyword} 관리 노하우를 솔직하게 말씀드릴게요.</p>

<h2>병원의 한계와 현실</h2>
<p>병원에서는 ${keyword}의 증상 완화와 치료에 초점을 맞춰요. 하지만 일상에서의 관리는 결국 환자분들께 달려있어요. 나도 처음 약사 됐을 때 이 사실을 깨닫고 많이 놀랐어요. 환자분들이 병원 밖에서 얼마나 고민이 많으신지 알게 되었죠.</p>

<h2>약과 함께하는 생활 관리</h2>
<p>약만 복용한다고 ${keyword}가 해결되지 않아요. 생활 습관이 70%를 차지해요. 나도 환자분들께 늘 "약은 도구일 뿐, 진짜 치료사는 당신 자신"이라고 말씀드려요.</p>

<h3>식단 조절의 중요성</h3>
<p>${keyword}에 좋은 음식과 피해야 할 음식이 있어요. 나도 위장약 처방할 때마다 식단 상담을 함께 해요. 환자분들 중 80%가 식단 조절만으로도 증상이 호전되셨어요.</p>

<h3>규칙적인 생활 리듬</h3>
<p>규칙적인 식사와 수면이 중요해요. 특히 ${keyword}는 스트레스가 악화시키는 경우가 많아요. 나도 바쁜 약국 일하면서도 규칙적인 생활을 유지하려고 노력해요.</p>

<h2>증상 관리의 기술</h2>
<p>증상이 나타났을 때 어떻게 대처할지 미리 계획하세요. 나도 환자분들께 '증상 일지'를 작성하라고 권유해요. 패턴을 알면 관리하기가 훨씬 쉽거든요.</p>

<h2>심리적 안정의 중요성</h2>
<p>${keyword}는 몸과 마음이 연결되어 있어요. 불안감이 증상을 악화시키는 경우가 많아요. 나도 환자분들께 마음 챙김 명상을 추천하곤 해요. 실제로 효과를 보신 분들이 많아요.</p>

<h2>언제 전문가의 도움을 받아야 할까</h2>
<p>스스로 관리하다가도 증상이 악화되면 바로 병원을 찾으세요. 나도 환자분들께 "자기 몸 신호를 무시하지 마세요"라고 늘 말씀드려요. 건강이 최고예요.</p>

<h2>마무리</h2>
<p>${keyword} 관리의 핵심은 '균형'이에요. 병원 치료와 일상 관리의 균형이 중요합니다. 저도 환자분들과 함께 ${keyword}을 극복해가는 여정이 참 보람차요. 건강 때문에 고민 많으시죠? 혼자 고민하지 마시고 전문가와 상의하세요.</p>
        `;
    } else if (keyword.toLowerCase().includes('투자') || keyword.toLowerCase().includes('주식')) {
        title = `주린이 탈출하기: ${keyword} 초보자를 위한 생존 전략`;
        content = `
<h1>${title}</h1>

<p>안녕하세요, 12년차 펀드매니저입니다. 매일 수십억원의 돈을 굴리다 보니 주변에서 "주식으로 돈 벌었다"는 소리를 들을 때마다 마음이 복잡했어요. 왜냐하면 저는 '안전한 투자'의 중요성을 누구보다 잘 알거든요. 오늘은 나처럼 '${keyword}으로 성공하고 싶다'고 생각하는 분들을 위해 솔직한 이야기를 해볼게요.</p>

<h2>주린이 시절의 아픈 기억</h2>
<p>나도 처음엔 다들 그렇듯 '묻지마 투자' 했어요. ${keyword} 핫한 테마주만 보면 눈이 돌아갔죠. 결국 40% 손실 보고 깨달았어요. "이렇게 하면 안 되겠다"고요.</p>

<h2>프로들이 말하지 않는 진실들</h2>

<h3>1. ${keyword}는 마라톤이지 스프린트가 아니다</h3>
<p>나도 처음엔 "빨리 부자 되야지" 생각했어요. 근데 현실은 달라요. 꾸준히 20-25% 수익이면 성공이에요. 그 이상 바라면 리스크가 커져요.</p>

<h3>2. 타이밍보다 전략이 80%다</h3>
<p>"언제 사야 하나요?"라는 질문 정말 많이 받아요. 저는 이렇게 답해요: "좋은 전략을 세우면 타이밍은 자연스럽게 따라온다"</p>

<h3>3. 감정 조절이 모든 것의 70%다</h3>
<p>이건 정말 중요한데, 초보 투자자들이 가장 많이 실수해요. 나도 2018년 폭락장에서 엄청 흔들렸어요. 결국 손실 키웠죠.</p>

<h2>나의 ${keyword} 원칙 5가지</h2>

<h3>원칙 1: 분산 투자의 철칙</h3>
<p>한 종목에 올인하지 마세요. 나도 처음엔 삼성전자만 갖고 있었어요. 지금은 15개 종목으로 분산했어요. 마음이 편해요.</p>

<h3>원칙 2: 장기 투자 마인드</h3>
<p>단타 말고 장기로 가세요. 복리 효과가 엄청나요. 나도 5년 이상 들고 있는 종목들이 대부분이에요.</p>

<h3>원칙 3: 공부와 분석의 연속</h3>
<p>무슨 종목 살지 결정하기 전에 사업 모델을 이해하세요. 나도 처음엔 PER, PBR만 봤어요. 지금은 사업의 미래를 봐요.</p>

<h3>원칙 4: 철저한 리스크 관리</h3>
<p>손실이 20% 넘으면 정리하세요. 이 규칙 지키니 마음이 편해요. 나도 이 규칙 덕분에 큰 손실 피했어요.</p>

<h3>원칙 5: 세금과 비용 계산</h3>
<p>수익에서 세금, 수수료 빼면 실제 받는 돈이 적어요. 나도 처음엔 이 계산 안 해서 깜짝 놀랐어요.</p>

<h2>실전 ${keyword} 전략</h2>

<h3>핵심 포트폴리오 구성</h3>
<p>50% 성장주, 30% 가치주, 20% 현금 및 채권. 나도 이 비율로 운용하고 있어요.</p>

<h3>분기별 리밸런싱</h3>
<p>3개월마다 포트폴리오 비율 확인하고 조정하세요. 나도 매년 말에 이 작업 해요.</p>

<h3>배당주 투자로 안정성 확보</h3>
<p>주가 오르지 않아도 배당금 받을 수 있어요. 나도 노후 준비로 배당주 많이 갖고 있어요.</p>

<h2>마무리</h2>
<p>${keyword}는 마라톤이에요. 빨리 부자 되려다 큰 손실 볼 수 있어요. 나처럼 12년 걸려도 꾸준히 공부하고 실천하는 게 중요해요. 질문 있으면 언제든 물어보세요. 함께 성장해요!</p>
        `;
    } else {
        title = `${keyword} 전문가의 실무 가이드`;
        content = `
<h1>${title}</h1>

<p>${keyword}에 대해 이야기하려고 해요. 저는 이 분야에서 10년 이상 경험을 쌓았어요. 많은 분들이 ${keyword}에 관심은 있지만 어떻게 시작해야 할지 모르시는 것 같아요. 오늘은 제가 현장에서 깨달은 노하우를 공유하려고 합니다.</p>

<h2>${keyword}의 중요성</h2>
<p>${keyword}는 이제 선택이 아닌 필수예요. 저도 처음엔 '괜찮겠지'라고 생각했어요. 하지만 실제로 적용해보니 효율성이 확 달라지더라고요. 여러분도 경험해보시면 아마 같은 생각 하실 거예요.</p>

<h2>기본 개념부터 제대로</h2>
<p>많은 분들이 급하게 시작하시다가 어려움을 겪어요. ${keyword}의 기본을 제대로 이해하는 게 중요해요. 저도 처음엔 이 부분을 무시했다가 나중에 고생했어요.</p>

<h2>실전 적용 사례</h2>
<p>이론만으로는 부족해요. 실제로 적용해보는 게 중요합니다. 저는 ${keyword}를 업무에 적용한 후 업무 효율이 2배 이상 향상되었어요. 구체적인 사례를 들어 설명드릴게요.</p>

<h2>주의해야 할 점들</h2>
<p>${keyword}도 완벽하지 않아요. 몇 가지 주의점이 있어요. 저도 처음엔 이 부분을 간과했다가 문제를 겪었어요. 미리 알아두시면 도움이 되실 거예요.</p>

<h2>지속적인 발전을 위해</h2>
<p>${keyword} 기술은 계속 발전해요. 꾸준한 학습이 중요합니다. 저도 매년 새로운 트렌드를 공부하고 있어요. 함께 성장하는 자세가 필요해요.</p>

<h2>마무리</h2>
<p>${keyword}의 세계에 입문하시는 걸 환영해요. 처음엔 어렵겠지만 꾸준히 노력하시면 좋은 결과 얻으실 수 있어요. 궁금한 점 있으시면 언제든 물어보세요!</p>
        `;
    } else if (keyword.toLowerCase().includes('연말정산') || keyword.toLowerCase().includes('세금') || keyword.toLowerCase().includes('세무')) {
        title = `세무사도 깜짝! ${keyword} 미리보기 활용법`;
        content = `
<h1>${title}</h1>

<p>15년차 세무사로 일하면서 가장 많이 받는 질문이 있어요. "${keyword} 어떻게 하면 세금 많이 환급받을 수 있을까요?" 사실 많은 분들이 연말정산 시즌에만 바짝 긴장하시다가 중요한 공제 항목들을 놓치고 계세요. 오늘은 제가 세무 현장에서 직접 본 ${keyword} 꿀팁들을 공유할게요.</p>

<h2>연말정산 미리보기의 진짜 가치</h2>
<p>홈택스에서 제공하는 연말정산 미리보기는 그냥 '예상 금액 보여주는 기능'이 아니에요. 이걸 제대로 활용하면 연말정산 때 받을 환급금을 최대화할 수 있어요. 저도 처음 세무사 됐을 때 미리보기 서비스의 중요성을 제대로 몰랐어요. 하지만 현장에서 다양한 케이스를 보다 보니, 미리보기를 활용하는 분들이 환급금을 평균 20-30만원 더 받더라고요.</p>

<h2>미리보기에서 놓치기 쉬운 공제 항목들</h2>
<p>많은 분들이 기본적인 인적공제, 근로소득공제만 확인하시고 끝내요. 하지만 세법은 계속 바뀌고 있고, 놓치기 쉬운 공제 항목들이 있어요. 예를 들어:</p>
<ul>
<li>자녀 세액공제 (만 6세 이하 자녀는 50% 추가 공제)</li>
<li>신용카드 소득공제 (전통시장·대중교통 추가 공제)</li>
<li>의료비 공제 (난임 시술비, 건강보험 미보험금)</li>
<li>교육비 공제 (대학교 학자금 대출이자 상환액)</li>
</ul>

<h2>실제 환급 사례 공유</h2>
<p>작년 한 고객분의 경우, 미리보기를 통해 연금저축공제 15만원과 건강보험 미보험금 8만원을 추가로 발견했어요. 그분은 "세무사 상담 안 받고 그냥 제출할 뻔했어요"라고 하시더라고요. 이런 사례가 너무 많아요. 미리보기는 그냥 '예상'이 아니라 '발견'의 도구예요.</p>

<h2>미리보기 활용 5단계 전략</h2>
<p>연말정산 미리보기를 효과적으로 활용하는 방법이에요:</p>
<ol>
<li><strong>기본 정보 입력</strong>: 홈택스 로그인 후 연말정산 → 미리보기 메뉴 선택</li>
<li><strong>공제 항목 검토</strong>: 각 공제 항목별로 입력된 금액 확인</li>
<li><strong>증빙서류 준비</strong>: 부족한 부분 있으면 영수증·증명서 미리 준비</li>
<li><strong>추가 공제 탐색</strong>: 놓친 공제 항목 없는지 세무사 상담</li>
<li><strong>세금 부담 분석</strong>: 환급 vs 추가납부 금액 확인 후 전략 수립</li>
</ol>

<h2>세무서에서 알려주지 않는 숨겨진 꿀팁</h2>
<p>세무 현장에서 직접 본 꿀팁들을 공유할게요:</p>
<p><strong>1. 연금저축공제 한도 확인</strong><br/>
연금저축 납입액이 400만원 이상이면 세액공제 한도가 115.2만원까지 늘어나요. 미리보기에서 이 부분 꼭 확인하세요.</p>

<p><strong>2. 건강보험 미보험금 주의</strong><br/>
건강보험에서 환급받을 수 있는 금액이 있어요. 미리보기에서 이걸 확인하고 건강보험공단에 청구하세요. 연말정산 전에 받을 수 있어요.</p>

<p><strong>3. 자녀 관련 공제 꼼꼼히</strong><br/>
자녀가 있는 분들은 특히 주의하세요. 출산·육아 관련 공제, 교육비 공제 등 놓치기 쉬운 항목들이 많아요.</p>

<h2>연말정산 미리보기 시뮬레이션</h2>
<p>한 번 직접 체험해보세요. 월급 300만원 받는 직장인의 경우:</p>
<ul>
<li>인적공제: 150만원</li>
<li>근로소득공제: 100만원</li>
<li>신용카드 공제: 50만원</li>
<li>의료비 공제: 20만원</li>
</ul>
<p>총 공제액 320만원으로 계산하면, 예상 환급금은 25만원 정도 됩니다. 하지만 미리보기를 통해 추가 공제를 발견하면 이 금액이 더 늘어날 수 있어요.</p>

<h2>세금 부담 줄이는 생활 습관</h2>
<p>연말정산은 1년 내내 준비하는 거예요. 평소에 이런 습관을 들이면 세금 부담을 크게 줄일 수 있어요:</p>
<ul>
<li>현금 대신 신용카드 사용 (전통시장·대중교통 우선)</li>
<li>의료비 영수증 꼼꼼히 챙기기</li>
<li>연금저축·IRP 등 세액공제 상품 활용</li>
<li>기부금 영수증 분기별 정리</li>
</ul>

<h2>마무리: 세금은 전략이다</h2>
<p>${keyword} 미리보기를 활용하는 분들은 연말정산 때 스트레스 덜 받고 환급금은 더 많이 받으세요. 저희 세무사 사무실에 상담 오시는 분들 중 80% 이상이 미리보기를 통해 추가 환급금을 발견하고 있어요.</p>

<p>연말정산 시즌이 오기 전에 미리미리 준비하세요. 궁금한 점 있으시면 언제든 물어보세요. 세금 문제로 고민하는 분들께 도움이 되었으면 좋겠어요!</p>
        `;
    }

    return { title, content };
}

// 콘텐츠 포맷팅 및 스타일 적용
function formatContent(content, keyword) {
    // HTML 구조 개선 및 스타일 적용
    let formatted = content
        .replace(/<h1>/g, '<h1 style="color: #2c3e50; margin-bottom: 20px; font-size: 28px;">')
        .replace(/<h2>/g, '<h2 style="color: #34495e; margin: 30px 0 15px 0; font-size: 24px; border-bottom: 2px solid #3498db; padding-bottom: 5px;">')
        .replace(/<h3>/g, '<h3 style="color: #7f8c8d; margin: 25px 0 10px 0; font-size: 20px;">')
        .replace(/<p>/g, '<p style="line-height: 1.8; margin-bottom: 15px; font-size: 16px; color: #333;">')
        .replace(/<ul>/g, '<ul style="margin: 15px 0; padding-left: 30px;">')
        .replace(/<li>/g, '<li style="margin-bottom: 8px; line-height: 1.6;">')
        .replace(/<blockquote>/g, '<blockquote style="border-left: 4px solid #3498db; padding-left: 20px; margin: 20px 0; font-style: italic; background: #f8f9fa; padding: 15px 20px;">');

    // 키워드 강조
    const keywordRegex = new RegExp(keyword, 'gi');
    formatted = formatted.replace(keywordRegex, `<strong style="color: #e74c3c;">${keyword}</strong>`);

    return formatted;
}

// CTA 자동 삽입
async function addCTAs(content, keyword) {
    // 키워드별 관련 CTA 추천
    let ctaSuggestions = [];

    if (keyword.toLowerCase().includes('프로그래밍') || keyword.toLowerCase().includes('개발')) {
        ctaSuggestions = [
            { name: 'GitHub', url: 'https://github.com', description: '코드 공유와 협업 플랫폼' },
            { name: 'Stack Overflow', url: 'https://stackoverflow.com', description: '개발자 Q&A 커뮤니티' },
            { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', description: '웹 개발 문서' }
        ];
    } else if (keyword.toLowerCase().includes('건강') || keyword.toLowerCase().includes('약')) {
        ctaSuggestions = [
            { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', description: '건강보험 정보 포털' },
            { name: '국민건강보험', url: 'https://www.nhis.or.kr', description: '건강보험 민원 서비스' },
            { name: '질병관리청', url: 'https://www.kdca.go.kr', description: '질병 예방 및 관리' }
        ];
    } else if (keyword.toLowerCase().includes('투자') || keyword.toLowerCase().includes('주식')) {
        ctaSuggestions = [
            { name: '네이버 금융', url: 'https://finance.naver.com', description: '주식 및 금융 정보' },
            { name: '한국거래소', url: 'https://www.krx.co.kr', description: '주식시장 정보' },
            { name: '금융감독원', url: 'https://www.fss.or.kr', description: '금융 소비자 보호' }
        ];
    } else if (keyword.toLowerCase().includes('연말정산') || keyword.toLowerCase().includes('세금') || keyword.toLowerCase().includes('세무')) {
        ctaSuggestions = [
            { name: '홈택스', url: 'https://www.hometax.go.kr', description: '연말정산 미리보기 서비스' },
            { name: '국세청', url: 'https://www.nts.go.kr', description: '세무 관련 정보 및 상담' },
            { name: '연말정산 간소화', url: 'https://www.yesform.com', description: '연말정산 서류 간소화 서비스' }
        ];
    } else {
        ctaSuggestions = [
            { name: '네이버 검색', url: 'https://search.naver.com', description: '종합 검색 포털' },
            { name: '다음 검색', url: 'https://search.daum.net', description: '포털 검색 서비스' },
            { name: '구글 검색', url: 'https://www.google.com', description: '글로벌 검색 엔진' }
        ];
    }

    // CTA HTML 생성 (1-2개만 삽입)
    const selectedCTAs = ctaSuggestions.slice(0, 2);
    let ctaHtml = '';

    selectedCTAs.forEach((cta, index) => {
        ctaHtml += `
<section class="ln-cta" style="margin:24px 0;padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#fafafa">
  <div style="font-weight:700;font-size:18px;line-height:1.4;margin-bottom:8px">💡 관련 정보 확인하기</div>
  <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#555">${cta.description}에서 더 자세한 정보를 확인하세요.</p>
  <a href="${cta.url}" role="button" aria-label="${cta.name} 바로가기"
     style="display:inline-block;padding:12px 18px;border-radius:12px;text-decoration:none;background:#111;color:#fff;font-weight:700;">
    ${cta.name} 바로가기
  </a>
  <div style="margin-top:8px;color:#888;font-size:13px">※ 이 링크는 검증된 출처를 기반으로 제공됩니다.</div>
</section>`;
    });

    // 콘텐츠 중간에 CTA 삽입
    const contentParts = content.split('</p>');
    if (contentParts.length > 3) {
        const insertIndex = Math.floor(contentParts.length / 2);
        contentParts.splice(insertIndex, 0, `${ctaHtml}</p>`);
    }

    return contentParts.join('</p>');
}

// Blogger 발행 함수
async function publishToBlogger(title, content, blogId, keyword) {
    // 실제 발행 로직 (이전 테스트에서 확인된 코드 사용)
    const { OAuth2Client } = require('google-auth-library');
    const { google } = require('googleapis');

    // 토큰 로드
    let tokens = {};
    const tokenPaths = [
        path.join(process.env.APPDATA || '', 'blogger-gpt-cli', 'blogger-token.json'),
        path.join(process.env.APPDATA || '', 'blogger-gpt-cli', 'google-token.json')
    ];

    for (const tokenPath of tokenPaths) {
        if (fs.existsSync(tokenPath)) {
            try {
                const tokenData = fs.readFileSync(tokenPath, 'utf8');
                tokens = { ...tokens, ...JSON.parse(tokenData) };
                break;
            } catch (error) {
                continue;
            }
        }
    }

    if (!tokens.access_token) {
        throw new Error('액세스 토큰을 찾을 수 없습니다.');
    }

    // 환경 변수 로드
    const envData = loadEnvironment();
    const oauth2Client = new OAuth2Client(
        envData.GOOGLE_CLIENT_ID,
        envData.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expires_at || (Date.now() + 3600000)
    });

    // 토큰 갱신 확인
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
        console.log('🔄 액세스 토큰 만료됨, 리프레시 시도...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        console.log('✅ 토큰 리프레시 성공');
    }

    // Blogger API 호출
    const blogger = google.blogger({
        version: 'v3',
        auth: oauth2Client
    });

    const postData = {
        title: title,
        content: content,
        labels: ['AI 생성', '자동화', keyword, '블로그']
    };

    const response = await blogger.posts.insert({
        blogId: blogId,
        resource: postData
    });

    return {
        id: response.data.id,
        url: response.data.url,
        published: response.data.published
    };
}

// 메인 실행 함수
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('❌ 키워드를 입력해주세요.');
        console.log('사용법:');
        console.log('  실제 발행: node generate-blog-post.js "키워드"');
        console.log('  미리보기: node generate-blog-post.js "키워드" --preview');
        console.log('');
        console.log('예시:');
        console.log('  node generate-blog-post.js "프로그래밍"');
        console.log('  node generate-blog-post.js "연말정산" --preview');
        return;
    }

    const keyword = args[0];
    const isPreview = args.includes('--preview');

    // 콘텐츠 모드 파싱 (앱 기본값: external)
    let contentMode = 'external';
    const modeIndex = args.indexOf('--mode');
    if (modeIndex !== -1 && args[modeIndex + 1]) {
        contentMode = args[modeIndex + 1];
    }

    console.log(`🎭 콘텐츠 모드: ${contentMode}`);

    try {
        const result = await generateBlogPost(keyword, isPreview);
        console.log('\n🎊 블로그 포스트 생성 완료!');
        console.log('===========================');
        console.log(`🏷️ 키워드: ${result.keyword}`);
        console.log(`📝 제목: ${result.title}`);
        console.log(`🔗 발행 URL: ${result.url}`);
        console.log(`📊 콘텐츠 길이: ${result.contentLength}자`);
        console.log(`🎯 전략: ${result.strategy}`);
        console.log('\n💡 브라우저에서 위 URL을 확인해보세요!');

    } catch (error) {
        console.error('\n❌ 포스트 생성 실패:');
        console.error(error.message);
        process.exit(1);
    }
}

// 스크립트 직접 실행시
if (require.main === module) {
    main();
}

module.exports = { generateBlogPost, analyzeContentStrategy };
