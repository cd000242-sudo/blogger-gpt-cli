"use strict";
// src/core/max-mode-structure.ts
// MAX 모드 5개 섹션 구조 정의 및 프롬프트 생성
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_MODE_SECTIONS_MAP = exports.PARAPHRASING_PROFESSIONAL_MODE_SECTIONS = exports.SHOPPING_CONVERSION_MODE_SECTIONS = exports.ADSENSE_APPROVAL_MODE_SECTIONS = exports.UPDATED_CONTENT_MODE_CONFIGS = exports.PARAPHRASING_MODE_SECTIONS = exports.SHOPPING_MODE_SECTIONS = exports.ADSENSE_MODE_SECTIONS = exports.SPIDERWEBBING_MODE_SECTIONS = exports.CONTENT_MODE_CONFIGS = exports.MAX_MODE_SECTIONS = exports.SCHEDULE_MODE_SECTIONS = void 0;
exports.generateRandomColorCTA = generateRandomColorCTA;
exports.buildMaxModePrompt = buildMaxModePrompt;
exports.buildMaxModeTitlePrompt = buildMaxModeTitlePrompt;
exports.buildMaxModeOutlinePrompt = buildMaxModeOutlinePrompt;
exports.buildMaxModePromptWithSubtopic = buildMaxModePromptWithSubtopic;
exports.buildContentModePrompt = buildContentModePrompt;
/**
 * 말투/어투 지시사항 생성 함수
 */
function getToneInstruction(toneStyle) {
    var toneInstructions = {
        'professional': '\n🎭 **말투/어투**: 전문적이고 신뢰할 수 있는 톤으로 작성하되, 독자가 쉽게 이해할 수 있도록 명확하고 간결하게 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.',
        'friendly': '\n🎭 **말투/어투**: 친근하고 따뜻한 톤으로 작성하되, 마치 친구에게 설명하는 것처럼 자연스럽고 편안하게 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.',
        'casual': '\n🎭 **말투/어투**: 캐주얼하고 편안한 톤으로 작성하되, 격식을 차리지 않고 자유롭고 부드럽게 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.',
        'formal': '\n🎭 **말투/어투**: 격식있고 정중한 톤으로 작성하되, 존중과 정중함을 유지하면서도 독자가 이해하기 쉽게 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.',
        'conversational': '\n🎭 **말투/어투**: 대화하듯이 자연스러운 톤으로 작성하되, 독자와 직접 대화하는 것처럼 친밀하고 소통하는 느낌으로 표현해주세요. 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.'
    };
    if (!toneStyle) {
        return toneInstructions['professional'];
    }
    return toneInstructions[toneStyle] || toneInstructions['professional'];
}
/**
 * 랜덤 색상 팔레트 생성 함수
 */
function getRandomColorPalette() {
    var palettes = [
        {
            primary: '#9B59B6',
            secondary: '#8e44ad',
            background: '#f5eeff',
            text: '#8e44ad',
            border: '#9B59B6',
            animationName: 'pulse-purple'
        },
        {
            primary: '#3498db',
            secondary: '#2980b9',
            background: '#ebf5fb',
            text: '#2980b9',
            border: '#3498db',
            animationName: 'pulse-blue'
        },
        {
            primary: '#e74c3c',
            secondary: '#c0392b',
            background: '#fdedec',
            text: '#c0392b',
            border: '#e74c3c',
            animationName: 'pulse-red'
        },
        {
            primary: '#27ae60',
            secondary: '#229954',
            background: '#eafaf1',
            text: '#229954',
            border: '#27ae60',
            animationName: 'pulse-green'
        },
        {
            primary: '#f39c12',
            secondary: '#d68910',
            background: '#fef9e7',
            text: '#d68910',
            border: '#f39c12',
            animationName: 'pulse-orange'
        },
        {
            primary: '#1abc9c',
            secondary: '#16a085',
            background: '#e8f8f5',
            text: '#16a085',
            border: '#1abc9c',
            animationName: 'pulse-teal'
        },
        {
            primary: '#e67e22',
            secondary: '#d35400',
            background: '#fdf2e9',
            text: '#d35400',
            border: '#e67e22',
            animationName: 'pulse-orange-dark'
        },
        {
            primary: '#8e44ad',
            secondary: '#7d3c98',
            background: '#f4ecf7',
            text: '#7d3c98',
            border: '#8e44ad',
            animationName: 'pulse-purple-dark'
        }
    ];
    var palette = palettes[Math.floor(Math.random() * palettes.length)];
    if (!palette) {
        // 기본 팔레트 반환
        return {
            primary: '#3b82f6',
            secondary: '#2563eb',
            background: '#eff6ff',
            text: '#1e40af',
            border: '#3b82f6',
            animationName: 'pulse-blue'
        };
    }
    return palette;
}
/**
 * 랜덤 색상으로 CTA HTML 생성 (반응형 최적화)
 */
function generateRandomColorCTA(hook, url, text, isWordPress) {
    if (isWordPress === void 0) { isWordPress = false; }
    var colors = getRandomColorPalette();
    // 애니메이션 CSS (인라인 스타일로 포함)
    var animationCSS = "\n<style>\n@keyframes ".concat(colors.animationName, " {\n  0%, 100% { transform: scale(1); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }\n  50% { transform: scale(1.02); box-shadow: 0 15px 40px rgba(0,0,0,0.15); }\n}\n@media (max-width: 768px) {\n  .cta-responsive-box {\n    padding: 25px 15px !important;\n    margin: 30px 0 !important;\n  }\n  .cta-responsive-text {\n    font-size: 20px !important;\n    margin-bottom: 18px !important;\n  }\n  .cta-responsive-button {\n    padding: 14px 28px !important;\n    font-size: 18px !important;\n    width: 90% !important;\n    max-width: 100% !important;\n  }\n}\n</style>");
    // 🔧 CTA 크기 키우기 및 후킹멘트 필수 확인
    var finalHook = hook || '🔥 지금 확인하지 않으면 손해입니다!';
    // 🔧 CTA 텍스트에서 &#10022; 문자 제거 (후킹멘트와 버튼 텍스트 모두)
    var cleanHook = finalHook
        .replace(/&#10022;/g, '')
        .replace(/&amp;#10022;/g, '')
        .replace(/&[#]?10022;/gi, '')
        .replace(/\u2726/g, '')
        .trim();
    var cleanText = text
        .replace(/&#10022;/g, '')
        .replace(/&amp;#10022;/g, '')
        .replace(/&[#]?10022;/gi, '')
        .replace(/\u2726/g, '')
        .trim();
    var ctaHTML = "\n<CENTER>\n".concat(animationCSS, "\n<div class=\"cta-responsive-box\" style=\"padding: 40px 35px; border: 4px solid ").concat(colors.border, "; background-color: ").concat(colors.background, "; border-radius: 16px; text-align: center; margin: 50px auto; max-width: 95%; animation: ").concat(colors.animationName, " 2s infinite; box-shadow: 0 12px 40px rgba(0,0,0,0.15);\">\n  <p class=\"cta-responsive-text\" style=\"font-size: 28px !important; font-weight: 900 !important; color: ").concat(colors.text, "; margin-bottom: 25px; line-height: 1.6;\" data-ke-size=\"size20\">").concat(cleanHook, "</p>\n  <a class=\"cta-responsive-button\" style=\"color: white; background-color: ").concat(colors.primary, "; padding: 20px 45px; text-decoration: none; font-weight: 900; border-radius: 12px; display: inline-block; margin-top: 20px; font-size: 22px !important; transition: all 0.3s ease; box-shadow: 0 8px 25px rgba(0,0,0,0.2); letter-spacing: 0.5px;\" href=\"").concat(url, "\" rel=\"noopener\">").concat(cleanText, "</a>\n</div>\n</CENTER>");
    return isWordPress ? "<!-- wp:html -->".concat(ctaHTML, "<!-- /wp:html -->") : ctaHTML;
}
// 일정표/표 형태 콘텐츠용 섹션 구조
exports.SCHEDULE_MODE_SECTIONS = [
    {
        id: "introduction",
        title: "개요",
        description: "일정표 개요와 주요 정보를 소개하는 섹션",
        minChars: 600,
        role: "체계적이고 정확한 정보를 제공하는 전문가",
        contentFocus: "일정표 개요, 주요 일정, 중요 정보 요약",
        requiredElements: [
            "일정표 개요 설명",
            "주요 일정 요약",
            "중요한 정보 강조",
            "자연스러운 키워드 포함"
        ]
    },
    {
        id: "schedule_table",
        title: "상세 일정표",
        description: "체계적인 일정표나 표 형태로 정보를 제공하는 섹션",
        minChars: 1000,
        role: "정확하고 체계적인 정보를 정리하는 전문가",
        contentFocus: "표 형태의 체계적 정보, 시간/날짜/장소 등 구체적 정보",
        requiredElements: [
            "표나 리스트 형태의 체계적 정보",
            "구체적인 시간, 날짜, 장소 정보",
            "정확하고 검증된 데이터",
            "이해하기 쉬운 구조화"
        ]
    },
    {
        id: "important_info",
        title: "중요 정보",
        description: "일정표에서 주의해야 할 중요한 정보를 제공하는 섹션",
        minChars: 800,
        role: "실무 경험이 풍부한 전문가",
        contentFocus: "주의사항, 변경 가능성, 추가 정보",
        requiredElements: [
            "주의사항이나 변경 가능성",
            "추가로 알아야 할 정보",
            "실용적인 팁",
            "관련 링크나 연락처"
        ]
    },
    {
        id: "tips_guide",
        title: "활용 가이드",
        description: "일정표를 효과적으로 활용하는 방법을 안내하는 섹션",
        minChars: 700,
        role: "실무 경험이 풍부한 전문가",
        contentFocus: "활용 방법, 팁, 실용적 조언",
        requiredElements: [
            "일정표 활용 방법",
            "실용적인 팁과 조언",
            "주의할 점",
            "추가 도움이 되는 정보"
        ]
    },
    {
        id: "conclusion",
        title: "마무리",
        description: "일정표 정보를 요약하고 마무리하는 섹션",
        minChars: 500,
        role: "정보를 정리하고 요약하는 전문가",
        contentFocus: "핵심 정보 요약, 추가 안내, 마무리",
        requiredElements: [
            "핵심 정보 요약",
            "추가 안내나 연락처",
            "마무리 멘트",
            "관련 정보나 링크"
        ]
    }
];
exports.MAX_MODE_SECTIONS = [
    {
        id: "introduction",
        title: "서론",
        description: "독자의 관심을 끌고 주제를 소개하는 섹션",
        minChars: 800,
        role: "독자의 관심을 끌고 주제를 매력적으로 소개하는 전문가",
        contentFocus: "문제 인식, 호기심 유발, 주제의 중요성 강조",
        requiredElements: [
            "독자의 관심을 끄는 도입부",
            "주제의 중요성과 관련성",
            "독자가 얻을 수 있는 이익 명시",
            "자연스러운 키워드 포함",
            "3-4개의 명확한 문단으로 구성",
            "각 문단은 공백 라인으로 구분"
        ]
    },
    {
        id: "core1",
        title: "핵심 내용 1",
        description: "주제의 첫 번째 핵심 포인트를 다루는 섹션",
        minChars: 1200,
        role: "실무 경험이 풍부한 전문가",
        contentFocus: "구체적이고 실용적인 정보, 실제 사례, 단계별 설명",
        requiredElements: [
            "구체적인 방법론이나 정보",
            "실제 사례나 경험담",
            "단계별 설명",
            "실용적인 팁과 조언"
        ]
    },
    {
        id: "core2",
        title: "핵심 내용 2",
        description: "주제의 두 번째 핵심 포인트를 다루는 섹션",
        minChars: 1200,
        role: "실무 경험이 풍부한 전문가",
        contentFocus: "심화된 정보, 고급 기법, 전문적 인사이트",
        requiredElements: [
            "심화된 전문 정보",
            "고급 기법이나 방법",
            "전문적 인사이트",
            "주의사항이나 팁"
        ]
    },
    {
        id: "core3",
        title: "핵심 내용 3",
        description: "주제의 세 번째 핵심 포인트를 다루는 섹션",
        minChars: 1200,
        role: "실무 경험이 풍부한 전문가",
        contentFocus: "실전 적용, 문제 해결, 최적화 방법",
        requiredElements: [
            "실전 적용 방법",
            "문제 해결 가이드",
            "최적화 기법",
            "성공 사례나 결과"
        ]
    },
    {
        id: "conclusion",
        title: "결론",
        description: "내용을 정리하고 독자에게 행동을 유도하는 섹션",
        minChars: 800,
        role: "독자에게 실천을 독려하는 멘토",
        contentFocus: "내용 요약, 핵심 포인트 강조, 행동 유도",
        requiredElements: [
            "주요 내용 요약",
            "핵심 포인트 재강조",
            "독자의 다음 행동 제안",
            "마무리 인사"
        ]
    }
];
exports.CONTENT_MODE_CONFIGS = {
    external: {
        name: "SEO 최적화 모드",
        description: "검색 엔진 최적화에 중점을 둔 콘텐츠",
        titleStrategy: "SEO 키워드 포함, 클릭률 최적화, 검색 의도 반영",
        sectionStrategy: "키워드 밀도 최적화, 구조화된 정보 제공, 사용자 경험 향상",
        tone: "전문적이면서도 친근한 톤으로 신뢰성 있는 정보 제공",
        ctaStrategy: "자연스러운 내부 링크와 관련 콘텐츠 연결"
    },
    internal: {
        name: "내부링크 일관성 모드",
        description: "사이트 내 콘텐츠 간 연결과 일관성에 중점",
        titleStrategy: "사이트 내 다른 글과 연결되는 키워드 중심",
        sectionStrategy: "관련 주제 연결, 시리즈 형태 구성, 독자 유도",
        tone: "일관된 브랜드 톤으로 독자와의 관계 구축",
        ctaStrategy: "관련 글 추천과 시리즈 연결"
    },
    shopping: {
        name: "쇼핑/구매유도 모드",
        description: "구매 전환에 최적화된 마케팅 콘텐츠",
        titleStrategy: "문제 해결형, 비밀 공개형, 숫자·리스트형, 긴급·한정형, 결과 보장형, 공감 질문형, 비교·대조형",
        sectionStrategy: "후킹→문제제기→해결책→사회적증거→스토리텔링→시각적분할→희소성·긴급성→CTA→안전장치→클로징",
        tone: "구매를 유도하되 과대광고 없이 신뢰성 있는 톤",
        ctaStrategy: "구매 전환 최적화 CTA"
    },
    adsense: {
        name: "애드센스 승인 전문 모드",
        description: "애드센스 승인을 위한 고품질 전문 콘텐츠",
        titleStrategy: "독창적이고 가치있는 제목, 교육적 가치 중심",
        sectionStrategy: "작성자 소개→서론→완전히 이해하기→직접 경험→단계별 가이드→비교 분석→마무리 리소스",
        tone: "전문적이고 신뢰할 수 있는 톤으로 E-E-A-T 강조",
        ctaStrategy: "자연스러운 내부 링크와 관련 정보 제공"
    },
    paraphrasing: {
        name: "페러프레이징 전문 모드",
        description: "원문을 완전히 다른 표현으로 재작성하는 전문 모드",
        titleStrategy: "원문 제목을 완전히 다른 표현으로, 같은 의미 다른 어순/단어",
        sectionStrategy: "서론 페러프레이징→내용 확장→관점 전환→구조 재편성→새 내용 추가→종합 정리",
        tone: "원문과 유사하지만 완전히 다른 표현으로 작성",
        ctaStrategy: "자연스러운 내부 링크와 관련 정보 제공"
    }
};
function buildMaxModePrompt(contentMode, topic, keywords, section) {
    var config = exports.CONTENT_MODE_CONFIGS[contentMode] || exports.CONTENT_MODE_CONFIGS['external'];
    return "\uB2F9\uC2E0\uC740 ".concat(section.role, "\uC785\uB2C8\uB2E4.\n\n\uD83D\uDCDD **\uC791\uC131 \uC8FC\uC81C**: \"").concat(topic, "\"\n\n **\uC808\uB300\uC801 \uC791\uC131 \uADDC\uCE59 (\uC704\uBC18 \uC2DC \uC989\uC2DC \uC218\uC815)**:\n1.  \uCD94\uC0C1\uC801 \uD45C\uD604 \uC644\uC804 \uAE08\uC9C0: \"A\uC870\", \"B\uC870\", \"C\uC870\", \"~\uD300\", \"~\uAD6D\uAC00\", \"~\uC9C0\uC5ED\" \uB4F1\n2.  \uC815\uD655\uD55C \uC815\uBCF4\uB9CC \uC0AC\uC6A9: \uAD6C\uCCB4\uC801 \uBA85\uCE6D\uACFC \uC815\uD655\uD55C \uC218\uCE58\uB9CC \uC0AC\uC6A9\n3.  \uAC80\uC99D\uB41C \uC815\uBCF4: \uCD94\uCE21\uC774\uB098 \uAC00\uC815 \uC5C6\uC774 \uD655\uC2E4\uD55C \uC0AC\uC2E4\uB9CC \uAE30\uC7AC\n4.  \uCD5C\uC2E0 \uC815\uBCF4: \uD604\uC7AC \uB0A0\uC9DC \uAE30\uC900\uC73C\uB85C \uACFC\uAC70/\uD604\uC7AC/\uBBF8\uB798\uB97C \uC815\uD655\uD788 \uAD6C\uBD84\uD558\uC5EC \uAE30\uC7AC\n **\uD575\uC2EC \uD0A4\uC6CC\uB4DC**: ").concat(keywords.join(', '), "\n **\uC139\uC158**: ").concat(section.title, " (").concat(section.description, ")\n\n**\uCF58\uD150\uCE20 \uBAA8\uB4DC**: ").concat(config.name, "\n").concat(config.description, "\n\n**\uCD5C\uC18C \uAE00\uC790\uC218**: ").concat(section.minChars, "\uC790 \uC774\uC0C1\n\n**\uC791\uC131 \uC2A4\uD0C0\uC77C**:\n- ").concat(config.tone, "\n- ").concat(section.contentFocus, "\n- \uCE5C\uADFC\uD558\uBA74\uC11C\uB3C4 \uC804\uBB38\uC801\uC778 \uD1A4\n- \uB3C5\uC790\uAC00 \uBC14\uB85C \uC2E4\uCC9C\uD560 \uC218 \uC788\uB294 \uAD6C\uCCB4\uC801\uC778 \uC815\uBCF4 \uC81C\uACF5\n\n**\uD544\uC218 \uD3EC\uD568 \uC694\uC18C**:\n").concat(section.requiredElements.map(function (item) { return "- ".concat(item); }).join('\n'), "\n\n**\uC808\uB300 \uAE08\uC9C0\uC0AC\uD56D**:\n- \uC911\uAC04\uC5D0 \uACB0\uB860\uC774\uB098 \uB9C8\uBB34\uB9AC \uBB38\uAD6C \uC0AC\uC6A9 \uAE08\uC9C0 (").concat(section.title, " \uC139\uC158\uC5D0\uC11C\uB294 \uD574\uB2F9 \uB0B4\uC6A9\uB9CC \uC791\uC131)\n- \uB2E4\uB978 \uC139\uC158 \uB0B4\uC6A9 \uC5B8\uAE09 \uAE08\uC9C0\n- \uACFC\uB3C4\uD55C \uD0A4\uC6CC\uB4DC \uC0BD\uC785\n- \uBCF5\uC0AC/\uBD99\uC5EC\uB123\uAE30 \uC218\uC900\uC758 \uC911\uBCF5 \uCF58\uD150\uCE20\n- \uCF54\uB4DC\uB098 \uD568\uC218\uBA85\uC774 \uC11E\uC5EC\uC11C \uB098\uC624\uB294 \uAC83\n- \uC774\uBBF8\uC9C0 \uD50C\uB808\uC774\uC2A4\uD640\uB354\uB098 \uC774\uBBF8\uC9C0 \uAD00\uB828 HTML \uD0DC\uADF8 \uC0AC\uC6A9 \uAE08\uC9C0 (\uC774\uBBF8\uC9C0\uB294 \uBCC4\uB3C4 \uCC98\uB9AC)\n\n **\uCD9C\uB825 \uD615\uC2DD**:\nWordPress HTML \uBE14\uB85D \uD615\uC2DD\uC73C\uB85C \uC791\uC131\uD558\uC138\uC694:\n```html\n<div class=\"max-mode-section ").concat(section.id, "\">\n  <h2>").concat(section.title, "</h2>\n  <div class=\"content\">\n    <!-- \uC5EC\uAE30\uC5D0 ").concat(section.minChars, "\uC790 \uC774\uC0C1\uC758 \uACE0\uD488\uC9C8 \uCF58\uD150\uCE20 \uC791\uC131 -->\n    <!-- SEO \uAD6C\uC870: \uB178\uCD9C(\uD0A4\uC6CC\uB4DC \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568) \u2192 \uD074\uB9AD(\uD638\uAE30\uC2EC \uC720\uBC1C) \u2192 \uCCB4\uB958(\uC2E4\uC6A9\uC801 \uC815\uBCF4) \u2192 \uC804\uD658(\uC790\uC5F0\uC2A4\uB7EC\uC6B4 CTA) -->\n  </div>\n</div>\n```\n\n\uD83C\uDFAF **SEO \uCD5C\uC801\uD654 \uAD6C\uC870 (\uB178\uCD9C\u2192\uD074\uB9AD\u2192\uCCB4\uB958\u2192\uC804\uD658)**:\n1. **\uB178\uCD9C \uCD5C\uC801\uD654**: \uD0A4\uC6CC\uB4DC\uB97C \uC81C\uBAA9(H2)\uACFC \uBCF8\uBB38\uC5D0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568, \uAC80\uC0C9 \uC5D4\uC9C4\uC774 \uC774\uD574\uD560 \uC218 \uC788\uB3C4\uB85D \uAD6C\uC870\uD654\n2. **\uD074\uB9AD \uC720\uB3C4**: \uD638\uAE30\uC2EC\uC744 \uC790\uADF9\uD558\uB294 \uC18C\uC81C\uBAA9, \uB3C5\uC790\uC758 \uBB38\uC81C\uB97C \uC815\uD655\uD788 \uC9DA\uB294 \uB3C4\uC785, \uD574\uACB0\uCC45 \uC57D\uC18D\n3. **\uCCB4\uB958\uC2DC\uAC04 \uC99D\uAC00**: \uC2E4\uC6A9\uC801\uC774\uACE0 \uBC14\uB85C \uC801\uC6A9 \uAC00\uB2A5\uD55C \uC815\uBCF4, \uAD6C\uCCB4\uC801 \uC0AC\uB840, \uC2DC\uAC01\uC801 \uC694\uC18C\uB85C \uB05D\uAE4C\uC9C0 \uC77D\uACE0 \uC2F6\uAC8C \uAD6C\uC131\n4. **\uC804\uD658 \uC720\uB3C4**: \uC139\uC158 \uB05D\uC5D0 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 CTA, \uB3C5\uC790 \uAC80\uC0C9 \uC758\uB3C4\uC5D0 \uB9DE\uB294 \uB9C1\uD06C, \uBA85\uD655\uD55C \uD589\uB3D9 \uC81C\uC548\n\n\uD83D\uDCA1 **\uC791\uC131 \uAC00\uC774\uB4DC**:\n1. \uB3C5\uC790\uC758 \uAD00\uC2EC\uC744 \uB044\uB294 \uB3C4\uC785\uC73C\uB85C \uC2DC\uC791 (\uD074\uB9AD \uC720\uB3C4)\n2. \uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uC6A9\uC801\uC778 \uC815\uBCF4 \uC81C\uACF5 (\uCCB4\uB958\uC2DC\uAC04 \uC99D\uAC00)\n3. \uC2E4\uC81C \uC0AC\uB840\uB098 \uACBD\uD5D8\uB2F4 \uD3EC\uD568 (\uCCB4\uB958\uC2DC\uAC04 \uC99D\uAC00)\n4. \uB3C5\uC790\uAC00 \uBC14\uB85C \uC801\uC6A9\uD560 \uC218 \uC788\uB294 \uD301 \uC81C\uACF5 (\uC804\uD658 \uC720\uB3C4)\n5. \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD0A4\uC6CC\uB4DC \uD3EC\uD568 (\uB178\uCD9C \uCD5C\uC801\uD654)\n6. ").concat(section.minChars, "\uC790 \uC774\uC0C1\uC758 \uCDA9\uBD84\uD55C \uBD84\uB7C9\n\n\uC774\uC81C \"").concat(section.title, "\" \uC139\uC158\uC758 \uB0B4\uC6A9\uC744 \uC791\uC131\uD574\uC8FC\uC138\uC694.");
}
function buildMaxModeTitlePrompt(contentMode, topic, keywords) {
    var config = exports.CONTENT_MODE_CONFIGS[contentMode] || exports.CONTENT_MODE_CONFIGS['external'];
    // 🔧 현재 날짜 가져오기 (실제 포스팅 날짜 기준)
    // 🔧 미리보기 키워드가 있으면 상황에 맞게 년도 결정
    var now = new Date();
    var currentYear = now.getFullYear();
    var currentMonth = now.getMonth() + 1; // 1-12
    // 주제나 키워드에 "미리보기"가 포함되어 있는지 확인
    var topicLower = topic.toLowerCase();
    var keywordsLower = keywords.map(function (k) { return k.toLowerCase(); }).join(' ');
    var hasPreview = topicLower.includes('미리보기') || keywordsLower.includes('미리보기');
    if (hasPreview) {
        // 연말(11-12월): 다음 년도 기준
        if (currentMonth >= 11) {
            currentYear = currentYear + 1;
        }
        // 연초(1-3월): 발행날짜 기준 (현재 년도 유지)
        else if (currentMonth <= 3) {
            // currentYear는 그대로 유지
        }
        // 중간(4-10월): 연말이 가까우면 다음 년도, 아니면 현재 년도
        else {
            // 10월이면 다음 년도, 그 외는 현재 년도
            if (currentMonth >= 10) {
                currentYear = currentYear + 1;
            }
            // 4-9월은 현재 년도 유지 (다음 년도 미리보기는 아직 이르므로)
        }
    }
    var currentDateStr = "".concat(currentYear, "\uB144 ").concat(currentMonth, "\uC6D4");
    return "\uB2E4\uC74C \uC8FC\uC81C\uB85C ".concat(config.name, "\uC5D0 \uCD5C\uC801\uD654\uB41C \uBE14\uB85C\uADF8 \uC81C\uBAA9\uC744 \uC0DD\uC131\uD558\uC138\uC694.\n\n\uD83D\uDCDD **\uC8FC\uC81C**: \"").concat(topic, "\"\n **\uD0A4\uC6CC\uB4DC**: ").concat(keywords.join(', '), "\n\uD604\uC7AC \uB0A0\uC9DC: ").concat(currentDateStr, " (\uD3EC\uC2A4\uD305 \uBC1C\uD589 \uAE30\uC900 \uB0A0\uC9DC)\n\n **\uC81C\uBAA9 \uC804\uB7B5**: ").concat(config.titleStrategy, "\n\n\uD83C\uDFAF **SEO \uCD5C\uC801\uD654 \uC81C\uBAA9 \uC791\uC131 (\uB178\uCD9C\u2192\uD074\uB9AD \uC804\uD658 \uCD5C\uB300\uD654)**:\n\uD83D\uDCC8 **\uB178\uCD9C \uCD5C\uC801\uD654 (\uAC80\uC0C9 \uC5D4\uC9C4)**:\n1. **\uC8FC\uC694 \uD0A4\uC6CC\uB4DC\uB97C \uC81C\uBAA9 \uC55E\uBD80\uBD84\uC5D0 \uBC30\uCE58** (\uAC80\uC0C9 \uC5D4\uC9C4\uC774 \uC911\uC694\uD558\uAC8C \uC778\uC2DD)\n2. \uAD00\uB828 \uD0A4\uC6CC\uB4DC\uC640 LSI \uD0A4\uC6CC\uB4DC \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568\n3. \uAC80\uC0C9 \uC758\uB3C4 \uBC18\uC601 (\uC815\uBCF4\uC131, \uD2B8\uB79C\uC7AD\uC158, \uB124\uBE44\uAC8C\uC774\uC158)\n4. \uBAA8\uBC14\uC77C \uCD5C\uC801\uD654 \uAE38\uC774 (15-25\uC790)\n\n\uD83D\uDC46 **\uD074\uB9AD \uC720\uB3C4 (\uC0AC\uC6A9\uC790 \uD589\uB3D9, \uCC3D\uC758\uC801\uC73C\uB85C):**\n5. **\uC22B\uC790 + \uAD6C\uCCB4\uC801 \uD61C\uD0DD** (\"TOP 5\", \"3\uBD84 \uB9CC\uC5D0\", \"7\uAC00\uC9C0 \uBC29\uBC95\", \"10\uAC1C \uD301\")\n6. **\uC9C8\uBB38 + \uC989\uC2DC \uD574\uACB0** (\"\uC5B4\uB5BB\uAC8C \uD560\uAE4C?\", \"\uC65C \uC548 \uB420\uAE4C?\", \"\uC5B4\uB514\uC11C \uCC3E\uC744\uAE4C?\")\n7. **\uAE34\uAE09\uC131/\uD2B9\uBCC4\uD568** (\"\uC9C0\uAE08 \uBC14\uB85C\", \"\uB193\uCE58\uBA74 \uD6C4\uD68C\", \"\uD55C\uC815\", \"\uC774\uBC88 \uC8FC\uB9CC\")\n8. **\uBE44\uAD50/\uCD94\uCC9C** (\"\uBE44\uAD50 \uBD84\uC11D\", \"\uC5B4\uB5A4 \uAC8C \uCD5C\uACE0?\", \"\uCD94\uCC9C TOP 3\", \"vs\")\n9. **\uAC00\uC774\uB4DC/\uB2E8\uACC4** (\"3\uBD84 \uB9CC\uC5D0\", \"\uB2E8\uACC4\uBCC4 \uC815\uB9AC\", \"\uCD08\uBCF4\uC790\uB3C4 OK\", \"\uD55C \uBC88\uC5D0 \uB05D\uB0B4\uAE30\")\n10. **\uACBD\uD5D8/\uD6C4\uAE30** (\"\uB098\uB3C4 \uBC1B\uC558\uB2E4\", \"\uC131\uACF5 \uD6C4\uAE30\", \"\uC2E4\uC81C \uACBD\uD5D8\uB2F4\", \"\uB098\uB3C4 \uC131\uACF5\")\n11. **\uC804\uBB38\uAC00/\uB178\uD558\uC6B0** (\"\uC804\uBB38\uAC00 \uCD94\uCC9C\", \"\uACE0\uC218\uB9CC \uC544\uB294\", \"\uC170\uD504\uAC00 \uC54C\uB824\uC8FC\uB294\", \"\uACF5\uC2DD\")\n12. **\uAD6C\uCCB4\uC801 \uD61C\uD0DD** (\"\uD658\uAE09\uAE08\", \"\uC808\uC57D\", \"\uD61C\uD0DD\", \"\uD560\uC778\", \"\uBB34\uB8CC\", \"\uC131\uACF5\")\n\n\uD83D\uDEAB **\uC808\uB300 \uD53C\uD574\uC57C \uD560 \uBED4\uD55C \uD45C\uD604 (\uD074\uB9AD\uB960 \uC800\uC870):**\n- \"\uC644\uBCBD \uAC00\uC774\uB4DC\", \"\uC644\uC804 \uC815\uB9AC\", \"\uCD1D\uC815\uB9AC\", \"\uBAA8\uB4E0 \uAC83\" (\uB108\uBB34 \uBED4\uD568)\n- \"\uBC29\uBC95\", \"\uD301\", \"\uC815\uBCF4\" \uB2E8\uB3C5 \uC0AC\uC6A9 (\uC77C\uBC18\uC801)\n- \"\uCD08\uBCF4\uC790\uB97C \uC704\uD55C\", \"\uC774\uB807\uAC8C \uD558\uBA74\" (\uACFC\uB3C4\uD558\uAC8C \uC77C\uBC18\uC801)\n- \uB300\uC2E0 \uAD6C\uCCB4\uC801 \uC22B\uC790, \uC9C8\uBB38, \uAE34\uAE09\uC131, \uACBD\uD5D8, \uC804\uBB38\uC131 \uB4F1\uC744 \uD65C\uC6A9\uD558\uC138\uC694!\n\n\uD83D\uDCCF **\uC81C\uBAA9 \uC791\uC131 \uADDC\uCE59** (\uCD5C\uC6B0\uC120: \uC9E7\uACE0 \uAC15\uB82C\uD558\uAC8C, \uCC3D\uC758\uC801\uC73C\uB85C):\n1. **15-25\uC790 \uC774\uB0B4**\uC758 \uC9E7\uACE0 \uAC15\uB82C\uD55C \uC81C\uBAA9 (\uCD5C\uB300\uD55C \uC9E7\uAC8C, \uD575\uC2EC\uB9CC)\n2. \uC8FC\uC694 \uD0A4\uC6CC\uB4DC\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568 (SEO \uCD5C\uC801\uD654)\n3. **\uD074\uB9AD\uC744 \uC720\uB3C4\uD558\uB294 \uAC15\uB82C\uD55C \uD45C\uD604** (\uC22B\uC790, \uC9C8\uBB38, \uAE34\uAE09\uC131, \uD638\uAE30\uC2EC, \uACBD\uD5D8, \uC804\uBB38\uC131)\n4. ").concat(currentDateStr, " \uAE30\uC900 \uCD5C\uC2E0 \uC815\uBCF4\uC784\uC744 \uAC04\uB2E8\uD788 \uC554\uC2DC (\uB0A0\uC9DC\uB294 \uC0DD\uB7B5 \uAC00\uB2A5, \uD575\uC2EC\uB9CC)\n5. \uB3C5\uC790\uC758 \uBB38\uC81C\uB97C \uC815\uD655\uD788 \uC9DA\uB294 \uC9E7\uACE0 \uBA85\uD655\uD55C \uC81C\uBAA9\n6. ").concat(config.name, "\uC5D0 \uC801\uD569\uD55C \uD1A4\n7. \uC0C1\uC704 \uB178\uCD9C \uAC00\uB2A5\uD55C \uC9E7\uACE0 \uAC15\uB82C\uD55C \uC81C\uBAA9\n\n\uD83D\uDEAB **\uAE08\uC9C0 \uD45C\uD604 (\uC808\uB300 \uC0AC\uC6A9\uD558\uC9C0 \uB9C8\uC138\uC694):**\n- \"\uC644\uBCBD \uAC00\uC774\uB4DC\", \"\uC644\uC804 \uC815\uB9AC\", \"\uCD1D\uC815\uB9AC\", \"\uBAA8\uB4E0 \uAC83\" (\uBED4\uD558\uACE0 \uD074\uB9AD\uB960 \uC800\uC870)\n- \"\uBC29\uBC95\", \"\uD301\", \"\uC815\uBCF4\" \uB2E8\uB3C5 \uC0AC\uC6A9 (\uB108\uBB34 \uC77C\uBC18\uC801)\n- \"\uCD08\uBCF4\uC790\uB97C \uC704\uD55C\", \"\uC774\uB807\uAC8C \uD558\uBA74\" (\uACFC\uB3C4\uD558\uAC8C \uC77C\uBC18\uC801)\n- \uB300\uC2E0 \uAD6C\uCCB4\uC801 \uC22B\uC790, \uC9C8\uBB38, \uAE34\uAE09\uC131, \uACBD\uD5D8, \uC804\uBB38\uC131 \uB4F1\uC744 \uD65C\uC6A9\uD558\uC138\uC694!\n\n **\uCD9C\uB825 \uD615\uC2DD**: \n- \uBC18\uB4DC\uC2DC **\uB2E8 \uD558\uB098\uC758 \uC81C\uBAA9\uB9CC** \uCD9C\uB825\uD558\uC138\uC694\n- \uC5EC\uB7EC \uC81C\uBAA9\uC744 \uB098\uC5F4\uD558\uC9C0 \uB9C8\uC138\uC694\n- \uC81C\uBAA9\uB9CC \uCD9C\uB825\uD558\uACE0 \uB2E4\uB978 \uC124\uBA85\uC774\uB098 \uBC88\uD638\uB294 \uD3EC\uD568\uD558\uC9C0 \uB9C8\uC138\uC694\n- \uB9C8\uD06C\uB2E4\uC6B4 \uD615\uC2DD(**\uBCFC\uB4DC**)\uC744 \uC0AC\uC6A9\uD558\uC9C0 \uB9C8\uC138\uC694\n- \uC81C\uBAA9\uC740 **15-25\uC790 \uC774\uB0B4**\uB85C \uC791\uC131\uD558\uC138\uC694 (\uCD5C\uB300\uD55C \uC9E7\uAC8C)\n\n\u26A0\uFE0F **\uC911\uC694**: \uC81C\uBAA9\uC740 \uBC18\uB4DC\uC2DC \uD558\uB098\uB9CC \uCD9C\uB825\uD558\uC138\uC694. \uC5EC\uB7EC \uAC1C\uB97C \uB098\uC5F4\uD558\uC9C0 \uB9C8\uC138\uC694.\n\n\uC774\uC81C \"").concat(topic, "\"\uC5D0 \uB300\uD55C SEO \uCD5C\uC801\uD654\uB41C \uB9E4\uB825\uC801\uC778 \uC81C\uBAA9\uC744 **\uD558\uB098\uB9CC** \uC0DD\uC131\uD574\uC8FC\uC138\uC694.");
}
function buildMaxModeOutlinePrompt(contentMode, topic, keywords) {
    var config = exports.CONTENT_MODE_CONFIGS[contentMode] || exports.CONTENT_MODE_CONFIGS['external'];
    // 일관성 모드(internal, spiderwebbing)인 경우 논리적 구조 예시 제공
    var isConsistencyMode = contentMode === 'internal' || contentMode === 'spiderwebbing';
    var consistencyExample = "\u26A0\uFE0F \uD504\uB86C\uD504\uD2B8 \uC608\uC2DC\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uAE00\uC5D0 \uCD9C\uB825\uD558\uBA74 \uC548 \uB429\uB2C8\uB2E4. (\uC77C\uAD00\uC131 \uBAA8\uB4DC - \uB17C\uB9AC\uC801 \uAD6C\uC870):\n\uC8FC\uC81C: \"\uC0C1\uC0DD\uD398\uC774\uBC31 \uC2E0\uCCAD\uBC29\uBC95\"\n\uC18C\uC81C\uBAA9:\n1. \uC0C1\uC0DD\uD398\uC774\uBC31 \uB73B\n2. \uC0C1\uC0DD\uD398\uC774\uBC31 \uC9C0\uAE09 \uAE08\uC561\n3. \uC0C1\uC0DD\uD398\uC774\uBC31 \uB300\uC0C1\uC790\n4. \uC0C1\uC0DD\uD398\uC774\uBC31 \uC2E0\uCCAD\uBC29\uBC95\n5. \uC0C1\uC0DD\uD398\uC774\uBC31 \uAFC0\uD301\n\n\u26A0\uFE0F \uC911\uC694: \uC77C\uAD00\uC131 \uBAA8\uB4DC\uC5D0\uC11C\uB294 \uC704 \uC608\uC2DC\uCC98\uB7FC \uB17C\uB9AC\uC801\uC774\uACE0 \uCCB4\uACC4\uC801\uC778 \uC21C\uC11C\uB85C \uC18C\uC81C\uBAA9\uC744 \uC0DD\uC131\uD558\uC138\uC694:\n- 1\uBC88: \uAE30\uBCF8 \uAC1C\uB150/\uC758\uBBF8 (\uBB34\uC5C7\uC778\uC9C0)\n- 2\uBC88: \uAD6C\uCCB4\uC801 \uC815\uBCF4 (\uAE08\uC561, \uC218\uB7C9, \uAE30\uC900 \uB4F1)\n- 3\uBC88: \uB300\uC0C1/\uBC94\uC704 (\uB204\uAD6C\uC5D0\uAC8C, \uC5B4\uB5A4 \uACBD\uC6B0)\n- 4\uBC88: \uC2E4\uC6A9\uC801 \uBC29\uBC95 (\uC5B4\uB5BB\uAC8C \uD558\uB294\uC9C0)\n- 5\uBC88: \uCD94\uAC00 \uC815\uBCF4/\uD301 (\uAFC0\uD301, \uC8FC\uC758\uC0AC\uD56D, FAQ \uB4F1)";
    var normalExample = "\u26A0\uFE0F \uD504\uB86C\uD504\uD2B8 \uC608\uC2DC\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uAE00\uC5D0 \uCD9C\uB825\uD558\uBA74 \uC548 \uB429\uB2C8\uB2E4. (\uC77C\uBC18 \uBAA8\uB4DC):\n\uC18C\uC81C\uBAA9:\n1. \uAC10\uC790\uC758 \uB180\uB77C\uC6B4 \uC601\uC591 \uC131\uBD84\uACFC \uAC74\uAC15 \uD6A8\uACFC\n2. \uB9E4\uC77C \uAC10\uC790\uB97C \uBA39\uC73C\uBA74 \uB098\uD0C0\uB098\uB294 \uBCC0\uD654 5\uAC00\uC9C0\n3. \uAC10\uC790 \uC694\uB9AC\uBC95\uACFC \uC12D\uCDE8 \uC2DC \uC8FC\uC758\uC0AC\uD56D\n4. \uAC10\uC790 vs \uB2E4\uB978 \uCC44\uC18C, \uC601\uC591 \uBE44\uAD50 \uBD84\uC11D\n5. \uAC74\uAC15\uD55C \uAC10\uC790 \uC12D\uCDE8\uB85C \uC2DC\uC791\uD558\uB294 \uC0C8\uB85C\uC6B4 \uB77C\uC774\uD504\uC2A4\uD0C0\uC77C";
    return "\uB2E4\uC74C \uC8FC\uC81C\uB85C ".concat(config.name, "\uC5D0 \uCD5C\uC801\uD654\uB41C \uBE14\uB85C\uADF8 \uBAA9\uCC28(\uC18C\uC81C\uBAA9)\uB97C \uC0DD\uC131\uD558\uC138\uC694.\n\n\uD83D\uDCDD **\uC8FC\uC81C**: \"").concat(topic, "\"\n **\uD0A4\uC6CC\uB4DC**: ").concat(keywords.join(', '), "\n\n **\uBAA9\uCC28 \uC804\uB7B5**: ").concat(config.sectionStrategy, "\n\n **\uBAA9\uCC28 \uAD6C\uC131 \uADDC\uCE59**:\n1. \uC815\uD655\uD788 5\uAC1C\uC758 \uC18C\uC81C\uBAA9\uC73C\uB85C \uAD6C\uC131\n2. \uAC01 \uC18C\uC81C\uBAA9\uC740 20-40\uC790 \uB0B4\uC678\n3. \uB3C5\uC790\uC758 \uAD00\uC2EC\uACFC \uD638\uAE30\uC2EC\uC744 \uC790\uADF9\uD558\uB294 \uD45C\uD604\n4. \uD0A4\uC6CC\uB4DC\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568\n5. \uB17C\uB9AC\uC801\uC774\uACE0 \uCCB4\uACC4\uC801\uC778 \uC21C\uC11C\n6. ").concat(config.name, "\uC5D0 \uC801\uD569\uD55C \uC811\uADFC \uBC29\uC2DD\n").concat(isConsistencyMode ? "\n7. \u26A0\uFE0F **\uC77C\uAD00\uC131 \uBAA8\uB4DC \uD544\uC218**: \uC8FC\uC81C\uC5D0 \uB300\uD55C \uB17C\uB9AC\uC801 \uD750\uB984\uC73C\uB85C \uC18C\uC81C\uBAA9 \uAD6C\uC131\n   - \uAE30\uBCF8 \uAC1C\uB150 \u2192 \uAD6C\uCCB4\uC801 \uC815\uBCF4 \u2192 \uB300\uC0C1/\uBC94\uC704 \u2192 \uC2E4\uC6A9\uC801 \uBC29\uBC95 \u2192 \uCD94\uAC00 \uC815\uBCF4/\uD301\n   - \uAC01 \uC18C\uC81C\uBAA9\uC740 \uB3C5\uB9BD\uC801\uC774\uBA74\uC11C\uB3C4 \uC804\uCCB4\uC801\uC73C\uB85C \uC77C\uAD00\uB41C \uAD6C\uC870\uB97C \uC720\uC9C0\n" : '', "\n\n **\uCD9C\uB825 \uD615\uC2DD**:\n\uC18C\uC81C\uBAA9:\n1. [\uCCAB \uBC88\uC9F8 \uC18C\uC81C\uBAA9]\n2. [\uB450 \uBC88\uC9F8 \uC18C\uC81C\uBAA9]  \n3. [\uC138 \uBC88\uC9F8 \uC18C\uC81C\uBAA9]\n4. [\uB124 \uBC88\uC9F8 \uC18C\uC81C\uBAA9]\n5. [\uB2E4\uC12F \uBC88\uC9F8 \uC18C\uC81C\uBAA9]\n\n").concat(isConsistencyMode ? consistencyExample : normalExample, "\n\n\uC774\uC81C \"").concat(topic, "\"\uC5D0 \uB300\uD55C 5\uAC1C \uC18C\uC81C\uBAA9\uC744 ").concat(isConsistencyMode ? '논리적이고 일관된 구조로' : '', " \uC0DD\uC131\uD574\uC8FC\uC138\uC694.");
}
/**
 * 크롤링된 소제목을 포함한 섹션 프롬프트 생성
 */
function buildMaxModePromptWithSubtopic(contentMode, topic, keywords, section, subtopic, manualCta, crawledData, extractedData, platform, toneStyle, targetYear) {
    var _a, _b, _c, _d;
    var config = exports.CONTENT_MODE_CONFIGS[contentMode] || exports.CONTENT_MODE_CONFIGS['external'];
    var isWordPress = platform === 'wordpress';
    var yearGuideline = targetYear
        ? "\n\uD83D\uDCC5 **\uC5F0\uB3C4 \uC900\uC218 \uADDC\uCE59**: \uBAA8\uB4E0 \uB370\uC774\uD130\uC640 \uBB38\uC7A5\uC740 \uBC18\uB4DC\uC2DC ".concat(targetYear, "\uB144 \uAE30\uC900\uC73C\uB85C \uC791\uC131\uD558\uACE0, \uACFC\uAC70 \uC5F0\uB3C4\uB97C \uC5B8\uAE09\uD560 \uB54C\uB294 ").concat(targetYear, "\uB144 \uCD5C\uC2E0 \uC0C1\uD669\uACFC \uBE44\uAD50\uD558\uC5EC \uC5C5\uB370\uC774\uD2B8\uD558\uC138\uC694.")
        : '';
    return "\uB2F9\uC2E0\uC740 ".concat(section.role, "\uC785\uB2C8\uB2E4.\n\n\uD83D\uDCDD **\uC791\uC131 \uC8FC\uC81C**: \"").concat(topic, "\"\n **\uD575\uC2EC \uD0A4\uC6CC\uB4DC**: ").concat(keywords.join(', '), "\n **\uC139\uC158**: ").concat(section.title, " (").concat(section.description, ")\n **\uC18C\uC81C\uBAA9**: \"").concat(subtopic, "\"\n").concat(yearGuideline, "\n\n**\uCD5C\uC6B0\uC120 \uADDC\uCE59 - \uC81C\uBAA9\uACFC \uB0B4\uC6A9\uC758 \uC644\uBCBD\uD55C \uC77C\uCE58**:\n1. **\uC81C\uBAA9\uC774 \"\uC778\uC2A4\uD0C0 \uC54C\uB9BC \uB044\uB294\uBC95\"\uC774\uBA74 \u2192 \uC778\uC2A4\uD0C0 \uC54C\uB9BC\uC744 \uB044\uB294 \uAD6C\uCCB4\uC801\uC778 \uBC29\uBC95\uB9CC \uC791\uC131**\n2. **\uC81C\uBAA9\uC774 \"\uAC10\uC790 \uC694\uB9AC\uBC95\"\uC774\uBA74 \u2192 \uAC10\uC790 \uC694\uB9AC\uD558\uB294 \uAD6C\uCCB4\uC801\uC778 \uBC29\uBC95\uB9CC \uC791\uC131**\n3. **\uC81C\uBAA9\uC774 \"\uCCB4\uC911 \uAC10\uB7C9 \uC6B4\uB3D9\"\uC774\uBA74 \u2192 \uCCB4\uC911 \uAC10\uB7C9\uD558\uB294 \uAD6C\uCCB4\uC801\uC778 \uC6B4\uB3D9\uBC95\uB9CC \uC791\uC131**\n4. **\uC808\uB300 \uAE08\uC9C0**: \uC81C\uBAA9\uACFC \uAD00\uB828 \uC5C6\uB294 \"\uC65C \uD574\uC57C \uD558\uB294\uC9C0\", \"\uC7A5\uC810\", \"\uC774\uB860\" \uB4F1\n5. **\uD544\uC218 \uD3EC\uD568**: \uC81C\uBAA9\uC5D0\uC11C \uC694\uAD6C\uD558\uB294 \uAD6C\uCCB4\uC801\uC778 \"\uBC29\uBC95\", \"\uB2E8\uACC4\", \"\uC808\uCC28\", \"\uAC00\uC774\uB4DC\"\n\n**\"\uC65C\"\uBCF4\uB2E4 \"\uC5B4\uB5BB\uAC8C\"\uC5D0 \uBE44\uC911\uC744 \uB458 \uAC83**:\n- \uB3C5\uC790\uB4E4\uC740 \uC815\uBCF4\uB97C \uC5BB\uAE30 \uC704\uD574 \uB4E4\uC5B4\uC624\uBBC0\uB85C \"\uC5B4\uB5BB\uAC8C\"\uC5D0 \uC9D1\uC911\n- \uC608: \"\uC778\uC2A4\uD0C0 \uC2A4\uD1A0\uB9AC \uC54C\uB9BC \uB044\uAE30\" \u2192 \"\uC65C \uC911\uC694\uD55C\uAC00\"\uBCF4\uB2E4 \"\uC5B4\uB5BB\uAC8C \uB044\uB294\uAC00\"\uC5D0 \uBE44\uC911\n- \uAD81\uAE08\uD55C \uC810\uC744 \uD574\uACB0\uD558\uB294 \uC2E4\uC6A9\uC801 \uC815\uBCF4 \uC81C\uACF5\n- \uC0AC\uC6A9\uC790 \uACBD\uD5D8\uB2F4, \uC804\uBB38\uAC00 \uC870\uC5B8\uC740 \uC81C\uC678\uD558\uACE0 \uC2E4\uC9C8\uC801\uC778 \uBC29\uBC95\uACFC \uC808\uCC28\uB9CC \uD3EC\uD568\n\n**\uC808\uB300 \uAE08\uC9C0\uC0AC\uD56D - \uB9C8\uD06C\uB2E4\uC6B4 \uB9C8\uCEE4 \uC644\uC804 \uAE08\uC9C0**:\n- html, json, javascript, css \uB4F1 \uBAA8\uB4E0 \uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC \uBE14\uB85D \uB9C8\uCEE4 \uC0AC\uC6A9 \uAE08\uC9C0\n- \uBC31\uD2F1 \uBB38\uC790 \uC0AC\uC6A9 \uAE08\uC9C0\n- \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uBC95 \uC0AC\uC6A9 \uAE08\uC9C0\n- \uCF54\uB4DC \uBE14\uB85D \uD45C\uC2DC \uAE08\uC9C0\n- html, json, javascript, css \uB4F1 \uBAA8\uB4E0 \uBC31\uD2F1 \uB9C8\uCEE4 \uC0AC\uC6A9 \uAE08\uC9C0\n- \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uBC95 (**, *, #, ##, ~~) \uC0AC\uC6A9 \uAE08\uC9C0\n- \uCF54\uB4DC \uBE14\uB85D\uC774\uB098 \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uBC95\uC744 \uC0AC\uC6A9\uD558\uBA74 \uC989\uC2DC \uC2E4\uD328\uB85C \uCC98\uB9AC\n- html, json, javascript, css \uB4F1 \uBAA8\uB4E0 \uBC31\uD2F1 \uB9C8\uCEE4 \uC0AC\uC6A9 \uAE08\uC9C0\n- \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uBC95\uC744 \uC0AC\uC6A9\uD558\uBA74 \uC989\uC2DC \uC2E4\uD328\uB85C \uCC98\uB9AC\n- \uBC31\uD2F1 \uBB38\uC790\uB97C \uC0AC\uC6A9\uD558\uBA74 \uC989\uC2DC \uC2E4\uD328\uB85C \uCC98\uB9AC\n\n**\uC808\uB300\uC801 \uC791\uC131 \uADDC\uCE59 (\uC704\uBC18 \uC2DC \uC989\uC2DC \uC218\uC815)**:\n1. \uCD94\uC0C1\uC801 \uD45C\uD604 \uC644\uC804 \uAE08\uC9C0: \"A\uC870\", \"B\uC870\", \"C\uC870\", \"~\uD300\", \"~\uAD6D\uAC00\", \"~\uC9C0\uC5ED\" \uB4F1\n2. \uC815\uD655\uD55C \uC815\uBCF4\uB9CC \uC0AC\uC6A9: \"\uB300\uD55C\uBBFC\uAD6D\", \"\uCE74\uD0C0\uB974\", \"\uBBF8\uAD6D\", \"\uBA55\uC2DC\uCF54\", \"\uCE90\uB098\uB2E4\" \uB4F1 \uAD6C\uCCB4\uC801 \uBA85\uCE6D\n3. \uB0A0\uC9DC/\uC2DC\uAC04 \uC815\uD655\uC131: \"2024\uB144 9\uC6D4\", \"2025\uB144 6\uC6D4\", \"2026\uB144 7\uC6D4\" \uB4F1 \uC815\uD655\uD55C \uB0A0\uC9DC\n4. \uAD6C\uCCB4\uC801 \uC218\uCE58: \"48\uAC1C\uAD6D\", \"16\uAC1C \uC870\", \"3\uAC1C\uAD6D \uACF5\uB3D9\uAC1C\uCD5C\" \uB4F1 \uC815\uD655\uD55C \uC22B\uC790\n5. \uD575\uC2EC\uC815\uB9AC: \uBCF8\uBB38\uC758 \uD575\uC2EC \uB0B4\uC6A9\uC744 \uC815\uD655\uD788 \uC694\uC57D\uD558\uC5EC \uB3C5\uC790\uAC00 \uD575\uC2EC\uC815\uB9AC\uB9CC \uBD10\uB3C4 \uC644\uC804\uD788 \uC774\uD574\uD560 \uC218 \uC788\uB3C4\uB85D \uC791\uC131\n6. \uAC80\uC99D\uB41C \uC815\uBCF4: \uCD94\uCE21\uC774\uB098 \uAC00\uC815 \uC5C6\uC774 \uD655\uC2E4\uD55C \uC0AC\uC2E4\uB9CC \uAE30\uC7AC\n7. \uCD5C\uC2E0 \uC815\uBCF4: \uD604\uC7AC \uB0A0\uC9DC \uAE30\uC900\uC73C\uB85C \uACFC\uAC70/\uD604\uC7AC/\uBBF8\uB798\uB97C \uC815\uD655\uD788 \uAD6C\uBD84\uD558\uC5EC \uAE30\uC7AC\n\n").concat(extractedData && (((_a = extractedData.dates) === null || _a === void 0 ? void 0 : _a.length) || ((_b = extractedData.numbers) === null || _b === void 0 ? void 0 : _b.length) || ((_c = extractedData.prices) === null || _c === void 0 ? void 0 : _c.length) || ((_d = extractedData.percentages) === null || _d === void 0 ? void 0 : _d.length)) ? "\n**\uCD5C\uC2E0 \uC815\uBCF4 (\uD06C\uB864\uB9C1 \uAE30\uBC18)**:\n".concat(extractedData.dates && extractedData.dates.length > 0 ? "- **\uB0A0\uC9DC**: ".concat(extractedData.dates.join(', ')) : '', "\n").concat(extractedData.prices && extractedData.prices.length > 0 ? "- **\uAE08\uC561/\uAC00\uACA9**: ".concat(extractedData.prices.join(', ')) : '', "\n").concat(extractedData.numbers && extractedData.numbers.length > 0 ? "- **\uC8FC\uC694 \uC22B\uC790**: ".concat(extractedData.numbers.join(', ')) : '', "\n").concat(extractedData.percentages && extractedData.percentages.length > 0 ? "- **\uD37C\uC13C\uD2B8**: ".concat(extractedData.percentages.join(', ')) : '', "\n\n **\uC911\uC694**: \uC704\uC758 \uCD5C\uC2E0 \uC815\uBCF4\uB97C \uBCF8\uBB38\uC5D0 \uC801\uADF9 \uD65C\uC6A9\uD558\uC5EC \uC815\uD655\uD558\uACE0 \uAD6C\uCCB4\uC801\uC778 \uC815\uBCF4\uB97C \uC81C\uACF5\uD558\uC138\uC694.\n") : '', "\n\n").concat(crawledData && crawledData.length > 0 ? "\n\uD83D\uDCDA **\uCC38\uACE0 \uD06C\uB864\uB9C1 \uB370\uC774\uD130**:\n".concat(crawledData.slice(0, 3).map(function (item, index) { return "\n".concat(index + 1, ". **\uC81C\uBAA9**: ").concat(item.title || '제목 없음', "\n   **\uB0B4\uC6A9 \uC694\uC57D**: ").concat(item.content ? item.content.substring(0, 200) + '...' : '내용 없음', "\n   **\uCD9C\uCC98**: ").concat(item.source || '알 수 없음', "\n"); }).join('\n'), "\n\n**\uC911\uC694**: \uC704 \uD06C\uB864\uB9C1 \uB370\uC774\uD130\uB97C \uCC38\uACE0\uD558\uB418, \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uB3C5\uCC3D\uC801\uC778 \uB0B4\uC6A9\uC73C\uB85C \uC791\uC131\uD558\uC138\uC694. \n\uBCF5\uC0AC\uD558\uC9C0 \uB9D0\uACE0 \uD575\uC2EC \uC815\uBCF4\uB97C \uBC14\uD0D5\uC73C\uB85C \uB3C5\uC790\uC5D0\uAC8C \uB3C4\uC6C0\uC774 \uB418\uB294 \uC0C8\uB85C\uC6B4 \uAD00\uC810\uACFC \uAD6C\uCCB4\uC801\uC778 \uC815\uBCF4\uB97C \uC81C\uACF5\uD558\uC138\uC694.\n\n\uD83D\uDCCA **\uB3D9\uC801 \uCF58\uD150\uCE20**: \uC0C1\uD669\uC5D0 \uB9DE\uAC8C \uD45C/\uCCB4\uD06C\uB9AC\uC2A4\uD2B8/\uADF8\uB798\uD504/\uB9AC\uC2A4\uD2B8 \uB4F1\uC744 \uB3D9\uC801\uC73C\uB85C \uD3EC\uD568\n") : '', "\n\n**\uCF58\uD150\uCE20 \uBAA8\uB4DC**: ").concat(config.name, "\n").concat(config.description, "\n\n**\uCD5C\uC18C \uAE00\uC790\uC218**: ").concat(section.minChars, "\uC790 \uC774\uC0C1\n\n**\uC791\uC131 \uC2A4\uD0C0\uC77C**:\n- ").concat(config.tone, "\n- ").concat(section.contentFocus, "\n- \uCE5C\uADFC\uD558\uBA74\uC11C\uB3C4 \uC804\uBB38\uC801\uC778 \uD1A4\n- \uB3C5\uC790\uAC00 \uBC14\uB85C \uC2E4\uCC9C\uD560 \uC218 \uC788\uB294 \uAD6C\uCCB4\uC801\uC778 \uC815\uBCF4 \uC81C\uACF5\n").concat(toneStyle ? getToneInstruction(toneStyle) : '', "\n\n\uD83C\uDFAF **SEO \uCD5C\uC801\uD654 \uAD6C\uC870 \uC801\uC6A9 (\uB178\uCD9C\u2192\uD074\uB9AD\u2192\uCCB4\uB958\u2192\uC804\uD658)**:\n\uD83D\uDCC8 **\uB178\uCD9C \uCD5C\uC801\uD654**: \uD0A4\uC6CC\uB4DC\uB97C \uC81C\uBAA9(H2)\uACFC \uBCF8\uBB38\uC5D0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568, \uAC80\uC0C9 \uC5D4\uC9C4\uC774 \uC774\uD574\uD560 \uC218 \uC788\uB3C4\uB85D \uAD6C\uC870\uD654\n\uD83D\uDC46 **\uD074\uB9AD \uC720\uB3C4**: \uD638\uAE30\uC2EC\uC744 \uC790\uADF9\uD558\uB294 \uC18C\uC81C\uBAA9, \uB3C5\uC790\uC758 \uBB38\uC81C\uB97C \uC815\uD655\uD788 \uC9DA\uB294 \uB3C4\uC785, \uD574\uACB0\uCC45 \uC57D\uC18D\n\u23F1\uFE0F **\uCCB4\uB958\uC2DC\uAC04 \uC99D\uAC00**: \uC2E4\uC6A9\uC801\uC774\uACE0 \uBC14\uB85C \uC801\uC6A9 \uAC00\uB2A5\uD55C \uC815\uBCF4, \uAD6C\uCCB4\uC801 \uC0AC\uB840, \uC2DC\uAC01\uC801 \uC694\uC18C\uB85C \uB05D\uAE4C\uC9C0 \uC77D\uACE0 \uC2F6\uAC8C \uAD6C\uC131\n\uD83D\uDCB0 **\uC804\uD658 \uC720\uB3C4**: \uC139\uC158 \uB05D\uC5D0 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 CTA, \uB3C5\uC790 \uAC80\uC0C9 \uC758\uB3C4\uC5D0 \uB9DE\uB294 \uB9C1\uD06C, \uBA85\uD655\uD55C \uD589\uB3D9 \uC81C\uC548\n\n**\uD544\uC218 \uD3EC\uD568 \uC694\uC18C**:\n").concat(section.requiredElements.map(function (item) { return "- ".concat(item); }).join('\n'), "\n\n**\uC808\uB300 \uAE08\uC9C0\uC0AC\uD56D**:\n- \uC911\uAC04\uC5D0 \uACB0\uB860\uC774\uB098 \uB9C8\uBB34\uB9AC \uBB38\uAD6C \uC0AC\uC6A9 \uAE08\uC9C0 (").concat(section.title, " \uC139\uC158\uC5D0\uC11C\uB294 \uD574\uB2F9 \uB0B4\uC6A9\uB9CC \uC791\uC131)\n- \uB2E4\uB978 \uC139\uC158 \uB0B4\uC6A9 \uC5B8\uAE09 \uAE08\uC9C0\n- \uACFC\uB3C4\uD55C \uD0A4\uC6CC\uB4DC \uC0BD\uC785\n- \uBCF5\uC0AC/\uBD99\uC5EC\uB123\uAE30 \uC218\uC900\uC758 \uC911\uBCF5 \uCF58\uD150\uCE20\n- \uCF54\uB4DC\uB098 \uD568\uC218\uBA85\uC774 \uC11E\uC5EC\uC11C \uB098\uC624\uB294 \uAC83\n- \uC774\uBBF8\uC9C0 \uD50C\uB808\uC774\uC2A4\uD640\uB354\uB098 \uC774\uBBF8\uC9C0 \uAD00\uB828 HTML \uD0DC\uADF8 \uC0AC\uC6A9 \uAE08\uC9C0 (\uC774\uBBF8\uC9C0\uB294 \uBCC4\uB3C4 \uCC98\uB9AC)\n\n").concat(manualCta ? "\n **\uC218\uB3D9 CTA \uC124\uC815**:\n- CTA \uB9C1\uD06C: ".concat(manualCta.url, "\n- CTA \uD14D\uC2A4\uD2B8: \"").concat(manualCta.text, "\"\n- \uD6C5\uD0B9 \uBA58\uD2B8: \"").concat(manualCta.hook || '', "\"\n- **\uC911\uC694**: \uC774 CTA\uB294 \uC139\uC158 \uB9C8\uC9C0\uB9C9\uC5D0 \uC911\uC559 \uC815\uB82C\uB85C \uD45C\uC2DC\uD574\uC57C \uD569\uB2C8\uB2E4.\n- **\uB79C\uB364 \uC0C9\uC0C1**: \uB9E4\uBC88 \uB2E4\uB978 \uC0C9\uC0C1\uC73C\uB85C \uC0DD\uC131\uD558\uC5EC \uC2DC\uAC01\uC801 \uB2E4\uC591\uC131 \uC81C\uACF5\n- **\uBC18\uC751\uD615 \uB514\uC790\uC778**: \uBAA8\uBC14\uC77C\uACFC \uB370\uC2A4\uD06C\uD0D1 \uBAA8\uB450\uC5D0\uC11C \uCD5C\uC801\uD654\uB41C \uD06C\uAE30\uC640 \uB808\uC774\uC544\uC6C3\n") : '', "\n\n**\uCD9C\uB825 \uD615\uC2DD** (").concat(isWordPress ? 'WordPress용 - 프리미엄 그라디언트 스킨' : 'Blogger용 - 소프트 클라우드 스킨', "):\n\n\u26A0\uFE0F **\uC808\uB300 \uADDC\uCE59**: CSS class/id \uC0AC\uC6A9 \uAE08\uC9C0! \uBAA8\uB4E0 \uC2A4\uD0C0\uC77C\uC740 \uC778\uB77C\uC778\uC73C\uB85C\uB9CC!\n\u26A0\uFE0F **\uC808\uB300 \uADDC\uCE59**: \uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D(```) \uC0AC\uC6A9 \uAE08\uC9C0! \uC21C\uC218 HTML\uB9CC \uCD9C\uB825!\n\n").concat(manualCta ? "\n\uD83D\uDCCC **CTA \uC0DD\uC131 \uADDC\uCE59 (\uB79C\uB364 \uC0C9\uC0C1 + \uBC18\uC751\uD615 \uCD5C\uC801\uD654)**:\n- CENTER \uD0DC\uADF8\uB85C \uAC10\uC2F8\uAE30\n- \uB79C\uB364 \uC0C9\uC0C1 \uD314\uB808\uD2B8 \uC0AC\uC6A9 (\uBCF4\uB77C #9B59B6, \uD30C\uB791 #3498db, \uBE68\uAC15 #e74c3c, \uCD08\uB85D #27ae60, \uC8FC\uD669 #f39c12, \uCCAD\uB85D #1abc9c \uB4F1)\n- \uBCF8\uBB38 \uB113\uC774\uC5D0 \uB9DE\uCD98 \uD06C\uAE30 (max-width: 95%, padding: 30px 25px)\n- \uBAA8\uBC14\uC77C \uCD5C\uC801\uD654 (768px \uC774\uD558\uC5D0\uC11C \uC790\uB3D9 \uC870\uC815: padding 25px 15px, font-size 20px/18px)\n- \uC560\uB2C8\uBA54\uC774\uC158 \uD6A8\uACFC (pulse \uC560\uB2C8\uBA54\uC774\uC158 2s infinite)\n- \uD6C4\uD0B9 \uBA58\uD2B8: \"".concat(manualCta.hook || '💡 더 자세한 정보가 필요하신가요?', "\"\n- \uBC84\uD2BC \uD14D\uC2A4\uD2B8: \"").concat(manualCta.text, "\"\n- \uB9C1\uD06C: ").concat(manualCta.url, "\n- \uBC18\uC751\uD615: \uBAA8\uBC14\uC77C\uC5D0\uC11C\uB294 \uD3F0\uD2B8 \uD06C\uAE30\uC640 \uD328\uB529 \uC790\uB3D9 \uC870\uC815, \uBC84\uD2BC width 90%\n- \uB370\uC2A4\uD06C\uD0D1: \uD070 \uD654\uBA74\uC5D0\uC11C\uB3C4 \uC815\uC0C1\uC801\uC73C\uB85C \uBCF4\uC774\uB3C4\uB85D max-width 95% \uC0AC\uC6A9\n\n**\u26A0\uFE0F \uC544\uB798\uB294 \uD504\uB86C\uD504\uD2B8 \uC608\uC2DC\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uAE00\uC5D0 \uCD9C\uB825\uD558\uBA74 \uC548 \uB429\uB2C8\uB2E4. CTA HTML \uD615\uC2DD**:\n```html\n<CENTER>\n<style>\n@keyframes pulse-[\uC0C9\uC0C1\uBA85] {\n  0%, 100% { transform: scale(1); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }\n  50% { transform: scale(1.02); box-shadow: 0 15px 40px rgba(0,0,0,0.15); }\n}\n@media (max-width: 768px) {\n  .cta-responsive-box { padding: 25px 15px !important; margin: 30px 0 !important; }\n  .cta-responsive-text { font-size: 20px !important; margin-bottom: 18px !important; }\n  .cta-responsive-button { padding: 14px 28px !important; font-size: 18px !important; width: 90% !important; max-width: 100% !important; }\n}\n</style>\n<div class=\"cta-responsive-box\" style=\"padding: 30px 25px; border: 3px solid [\uB79C\uB364\uC0C9\uC0C1]; background-color: [\uBC30\uACBD\uC0C9]; border-radius: 12px; text-align: center; margin: 40px auto; max-width: 95%; animation: pulse-[\uC0C9\uC0C1\uBA85] 2s infinite; box-shadow: 0 10px 35px rgba(0,0,0,0.12);\">\n  <p class=\"cta-responsive-text\" style=\"font-size: 22px; font-weight: bold; color: [\uD14D\uC2A4\uD2B8\uC0C9]; margin-bottom: 20px; line-height: 1.6;\" data-ke-size=\"size18\">").concat(manualCta.hook || '💡 더 자세한 정보가 필요하신가요?', "</p>\n  <a class=\"cta-responsive-button\" style=\"color: white; background-color: [\uC8FC\uC694\uC0C9\uC0C1]; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; margin-top: 15px; font-size: 19px; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(0,0,0,0.15);\" href=\"").concat(manualCta.url, "\" rel=\"noopener\">").concat(manualCta.text, "</a>\n</div>\n</CENTER>\n```\n") : '', "\n\n").concat(isWordPress ? "\n<!-- \u2705 WordPress\uC6A9 HTML (\uC778\uB77C\uC778 \uC2A4\uD0C0\uC77C\uB9CC) -->\n\n<!-- wp:html -->\n<div style=\"margin:40px 0; padding:25px; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:20px; box-shadow:0 10px 30px rgba(102,126,234,0.3); position:relative; overflow:hidden;\">\n  <div style=\"position:absolute; top:0; right:0; width:150px; height:150px; background:radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); border-radius:50%; transform:translate(30%, -30%);\"></div>\n  <h2 style=\"font-size:26px; font-weight:800; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 10px rgba(0,0,0,0.2); position:relative; z-index:1;\">".concat(subtopic, "</h2>\n</div>\n<!-- /wp:html -->\n\n<!-- wp:html -->\n<div style=\"margin:30px 0 20px 0; padding:18px 22px; background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius:15px; box-shadow:0 6px 20px rgba(240,147,251,0.3); border-left:6px solid #ffffff; position:relative;\">\n  <div style=\"position:absolute; bottom:0; left:0; width:100px; height:100px; background:radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%); border-radius:50%; transform:translate(-20%, 20%);\"></div>\n  <h3 style=\"font-size:23px; font-weight:700; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 8px rgba(0,0,0,0.15); position:relative; z-index:1;\">\uCCAB \uBC88\uC9F8 H3 \uC18C\uC81C\uBAA9</h3>\n</div>\n<!-- /wp:html -->\n\n<!-- wp:paragraph -->\n<!-- \u26A0\uFE0F \uD504\uB86C\uD504\uD2B8 \uC608\uC2DC\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uAE00\uC5D0 \uCD9C\uB825\uD558\uBA74 \uC548 \uB429\uB2C8\uB2E4. -->\n<!-- /wp:paragraph -->\n\n<!-- \uB3D9\uC801 \uD14C\uC774\uBE14 (\uBE44\uAD50 \uC815\uBCF4\uAC00 \uC788\uC744 \uB54C) -->\n<!-- wp:table -->\n<table style=\"width:100%; border-collapse:collapse; margin:30px 0; box-shadow:0 5px 15px rgba(0,0,0,0.1); border-radius:12px; overflow:hidden;\">\n  <thead>\n    <tr style=\"background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);\">\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px;\">\uD56D\uBAA9</th>\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px;\">\uB0B4\uC6A9</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style=\"background:#f8f9fa;\">\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC608\uC2DC 1</td>\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC124\uBA85...</td>\n    </tr>\n  </tbody>\n</table>\n<!-- /wp:table -->\n\n").concat(manualCta ? "\n<!-- wp:html -->\n".concat(generateRandomColorCTA(manualCta.hook || '💡 더 자세한 정보가 필요하신가요?', manualCta.url, manualCta.text, true), "\n<!-- /wp:html -->\n") : '', "\n") : "\n<!-- \u2705 Blogger\uC6A9 HTML (\uC18C\uD504\uD2B8 \uD074\uB77C\uC6B0\uB4DC \uC2A4\uD0A8, \uC778\uB77C\uC778 \uC2A4\uD0C0\uC77C\uB9CC) -->\n\n<div style=\"margin:40px 0; padding:25px; background:linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%); border-radius:20px; box-shadow:0 10px 30px rgba(116,185,255,0.3); position:relative; overflow:hidden;\">\n  <div style=\"position:absolute; top:0; right:0; width:150px; height:150px; background:radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%); border-radius:50%; transform:translate(30%, -30%);\"></div>\n  <h2 style=\"font-size:26px; font-weight:800; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 10px rgba(0,0,0,0.2); position:relative; z-index:1;\">".concat(subtopic, "</h2>\n</div>\n\n<div style=\"margin:30px 0 20px 0; padding:18px 22px; background:linear-gradient(135deg, #fd79a8 0%, #ffeaa7 100%); border-radius:15px; box-shadow:0 6px 20px rgba(253,121,168,0.3); border-left:6px solid #ffffff; position:relative;\">\n  <div style=\"position:absolute; bottom:0; left:0; width:100px; height:100px; background:radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); border-radius:50%; transform:translate(-20%, 20%);\"></div>\n  <h3 style=\"font-size:23px; font-weight:700; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 8px rgba(0,0,0,0.15); position:relative; z-index:1;\">\uCCAB \uBC88\uC9F8 H3 \uC18C\uC81C\uBAA9</h3>\n</div>\n\n<!-- \u26A0\uFE0F \uD504\uB86C\uD504\uD2B8 \uC608\uC2DC\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uAE00\uC5D0 \uCD9C\uB825\uD558\uBA74 \uC548 \uB429\uB2C8\uB2E4. -->\n\n<!-- \uB3D9\uC801 \uD14C\uC774\uBE14 (\uBE44\uAD50 \uC815\uBCF4\uAC00 \uC788\uC744 \uB54C) -->\n<table style=\"width:100%; border-collapse:collapse; margin:30px 0; box-shadow:0 5px 15px rgba(0,0,0,0.1); border-radius:12px; overflow:hidden;\">\n  <thead>\n    <tr style=\"background:linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);\">\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px; text-align:left;\">\uD56D\uBAA9</th>\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px; text-align:left;\">\uB0B4\uC6A9</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style=\"background:#f8f9fa;\">\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC608\uC2DC 1</td>\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC124\uBA85...</td>\n    </tr>\n  </tbody>\n</table>\n\n").concat(manualCta ? generateRandomColorCTA(manualCta.hook || '💡 더 자세한 정보가 필요하신가요?', manualCta.url, manualCta.text, false) : '', "\n"), "\n\n\uD83D\uDCA1 **\uC791\uC131 \uAC00\uC774\uB4DC**:\n1. **\uBCF8\uBB38\uC740 20px, H2\uB294 26px, H3\uB294 23px** (\uC5B4\uB974\uC2E0\uB4E4\uB3C4 \uD3B8\uD558\uAC8C \uC77D\uC744 \uC218 \uC788\uB3C4\uB85D)\n2. **\uBB38\uB2E8\uC740 \uBC18\uB4DC\uC2DC 3-4\uAC1C\uB85C \uB098\uB204\uACE0, \uAC01 \uBB38\uB2E8 \uC0AC\uC774\uC5D0 \uACF5\uBC31 \uCD94\uAC00** (margin-bottom: 28px)\n3. **H3 \uC18C\uC81C\uBAA9\uC744 \uC784\uC758 \uAC1C\uC218 \uC0AC\uC6A9**\uD558\uC5EC \uB0B4\uC6A9\uC744 \uCCB4\uACC4\uC801\uC73C\uB85C \uAD6C\uBD84\n   - \uC791\uC740 \uC18C\uC81C\uBAA9(H3)\uC740 \uBA54\uC778 \uC18C\uC81C\uBAA9(H2)\uC744 \uAE30\uBC18\uC73C\uB85C \uC0AC\uB78C\uB4E4\uC774 \uAC00\uC7A5 \uB9CE\uC774 \uAC80\uC0C9\uD560 \uB9CC\uD55C \uB0B4\uC6A9\uC744 \uAC80\uC0C9 \uC21C\uC704\uBCC4\uB85C AI\uB85C \uC0C8\uB86D\uAC8C \uC0DD\uC131\n   - \uD06C\uB864\uB9C1\uD55C \uC18C\uC81C\uBAA9\uC744 \uCC38\uACE0\uD558\uB418 \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uAD00\uC810\uC73C\uB85C \uC791\uC131\n4. **\uD45C, \uADF8\uB798\uD504, \uCCB4\uD06C\uB9AC\uC2A4\uD2B8\uB97C \uC0C1\uD669\uC5D0 \uB9DE\uAC8C \uB3D9\uC801\uC73C\uB85C \uD3EC\uD568 (\uD544\uC218)**:\n   \u26A0\uFE0F **\uC911\uC694**: \uBCF8\uBB38 \uB0B4\uC6A9\uC5D0 \uBE44\uAD50 \uC815\uBCF4, \uD2B9\uC9D5 \uC815\uBCF4, \uC608\uC2DC \uC815\uBCF4, \uC694\uC57D \uC815\uBCF4, \uC815\uBCF4 \uC815\uB9AC\uAC00 \uC788\uC73C\uBA74 **\uBC18\uB4DC\uC2DC \uD45C(table)\uB97C \uC0DD\uC131**\uD574\uC57C \uD569\uB2C8\uB2E4!\n   - \uBE44\uAD50 \uC815\uBCF4 \u2192 \uBE44\uAD50\uD45C (table) **\uD544\uC218 \uC0DD\uC131**\n   - \uD2B9\uC9D5 \uC815\uBCF4 \u2192 \uD2B9\uC9D5\uD45C (table) **\uD544\uC218 \uC0DD\uC131**\n   - \uC608\uC2DC \uC815\uBCF4 \u2192 \uC608\uC2DC\uD45C (table) **\uD544\uC218 \uC0DD\uC131**\n   - \uC694\uC57D \uC815\uBCF4 \u2192 \uC694\uC57D\uD45C (table) **\uD544\uC218 \uC0DD\uC131**\n   - \uC815\uBCF4 \uC815\uB9AC \u2192 \uC815\uBCF4\uD45C (table) **\uD544\uC218 \uC0DD\uC131**\n   - \uC808\uCC28/\uB2E8\uACC4 \u2192 \uC21C\uC11C \uBAA9\uB85D (ol)\n   - \uD655\uC778 \uD56D\uBAA9 \u2192 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 (ul)\n   - \uC9C4\uD589\uB960/\uB2E8\uACC4 \u2192 \uADF8\uB798\uD504 (progress bar \uB610\uB294 \uB2E8\uACC4 \uD45C\uC2DC)\n   \n   **\uD45C \uC0DD\uC131 \uADDC\uCE59**:\n   - \uBCF8\uBB38\uC5D0 \uBE44\uAD50\uD560 \uB9CC\uD55C \uC815\uBCF4\uAC00 \uC788\uC73C\uBA74 \uBC18\uB4DC\uC2DC \uD45C\uB85C \uC815\uB9AC\n   - \uCD5C\uC18C 1\uAC1C \uC774\uC0C1\uC758 \uD45C\uB97C \uD3EC\uD568\uD574\uC57C \uD568\n   - \uD45C\uB294 <table>, <thead>, <tbody>, <tr>, <th>, <td> \uD0DC\uADF8\uB85C \uAD6C\uC131\n   - \uD45C \uC2A4\uD0C0\uC77C\uC740 \uC778\uB77C\uC778\uC73C\uB85C \uC791\uC131 (\uC608\uC2DC \uD615\uC2DD \uCC38\uACE0)\n5. **\uC808\uB300 \uAE08\uC9C0**: \uC0AC\uC6A9\uC790 \uACBD\uD5D8\uB2F4, \uC804\uBB38\uAC00 \uC870\uC5B8 \uD3EC\uD568\uD558\uC9C0 \uB9D0\uACE0 \uC2E4\uC9C8\uC801\uC778 \uBC29\uBC95\uACFC \uC808\uCC28\uB9CC \uD3EC\uD568\n6. \uD06C\uB864\uB9C1\uD55C \uC0C1\uC704 \uB178\uCD9C \uAE00\uC758 \uD575\uC2EC \uC815\uBCF4\uB97C \uCD94\uCD9C\uD558\uC5EC \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uB0B4\uC6A9\uC73C\uB85C \uC7AC\uC791\uC131\n7. \uC911\uBCF5 \uBB38\uC11C\uB098 \uC720\uC0AC \uBB38\uC11C\uC5D0 \uAC78\uB9AC\uC9C0 \uC54A\uB3C4\uB85D \uB3C5\uCC3D\uC801\uC778 \uB0B4\uC6A9 \uC791\uC131\n8. ").concat(section.minChars, "\uC790 \uC774\uC0C1\uC758 \uCDA9\uBD84\uD55C \uBD84\uB7C9\n9. \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD0A4\uC6CC\uB4DC \uD3EC\uD568\n10. **\uC911\uC694**: ").concat(manualCta ? "CTA\uB294 \uC139\uC158 \uB9C8\uC9C0\uB9C9\uC5D0 \uC911\uC559 \uC815\uB82C\uB85C \uBC30\uCE58, \uD06C\uB864\uB9C1 \uAE30\uBC18 \uC678\uBD80 \uB9C1\uD06C \uC0AC\uC6A9" : "\uC790\uB3D9 CTA\uB97C \uC139\uC158 \uB9C8\uC9C0\uB9C9\uC5D0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uBC30\uCE58", "\n    \u26A0\uFE0F **CTA \uC0DD\uC131 \uD544\uC218**: \uC139\uC158 \uB9C8\uC9C0\uB9C9\uC5D0 \uBC18\uB4DC\uC2DC CTA \uBC84\uD2BC\uC744 \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4!\n    - \uD6C4\uD0B9 \uBA58\uD2B8 + \uB9C1\uD06C \uBC84\uD2BC \uD615\uC2DD\n    - \uC911\uC559 \uC815\uB82C (CENTER \uD0DC\uADF8 \uB610\uB294 text-align: center)\n    - \uD06C\uB864\uB9C1 \uAE30\uBC18 \uC678\uBD80 \uB9C1\uD06C \uC0AC\uC6A9 (\uC5C6\uC73C\uBA74 \uC8FC\uC81C\uC5D0 \uB9DE\uB294 \uACF5\uC2DD \uC0AC\uC774\uD2B8 \uB9C1\uD06C)\n    - CTA \uC5C6\uC774 \uC139\uC158\uC744 \uB9C8\uBB34\uB9AC\uD558\uBA74 \uC548 \uB429\uB2C8\uB2E4!\n11. **\uC808\uB300 \uAE08\uC9C0**: ```html \uAC19\uC740 \uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D \uB9C8\uCEE4 \uC0AC\uC6A9 \uAE08\uC9C0! \uC21C\uC218 HTML\uB9CC \uCD9C\uB825!\n\n\uC774\uC81C \"").concat(subtopic, "\" \uC18C\uC81C\uBAA9\uC5D0 \uB9DE\uB294 ").concat(section.title, " \uC139\uC158\uC758 \uB0B4\uC6A9\uC744 \uC791\uC131\uD574\uC8FC\uC138\uC694.");
}
// ============================================================================
// 새로운 콘텐츠 모드 구조 정의
// ============================================================================
// 일관성/거미줄치기 전문 모드 섹션 구조
exports.SPIDERWEBBING_MODE_SECTIONS = [
    {
        id: "introduction",
        title: "서론",
        description: "검색 의도 파악 및 메인 키워드 자연스러운 삽입",
        minChars: 300,
        role: "검색엔진 최적화 전문가",
        contentFocus: "검색 의도 파악, 메인 키워드 2회 삽입, 가치 제시",
        requiredElements: [
            "검색 의도 파악 문구",
            "메인 키워드 자연스럽게 2회 삽입",
            "이 글에서 얻을 수 있는 가치 제시",
            "독자 관심 유도"
        ]
    },
    {
        id: "basic_concept",
        title: "[메인 키워드]란 무엇인가?",
        description: "기본 개념과 핵심 특징을 설명하는 섹션",
        minChars: 1300,
        role: "해당 분야 전문가",
        contentFocus: "정의, 핵심 특징, 중요성, 최신 트렌드",
        requiredElements: [
            "정의와 핵심 특징 (300-400자)",
            "중요한 이유와 실생활 활용 사례 (400-500자)",
            "최신 트렌드 및 변화 (300-400자)",
            "관련 이미지 1-2개 (alt 태그 포함)",
            "내부링크 1개 삽입"
        ]
    },
    {
        id: "types_classification",
        title: "[롱테일 키워드 1] 종류 및 분류",
        description: "유형별 상세 분류와 선택 기준을 제공하는 섹션",
        minChars: 1500,
        role: "분류 및 비교 분석 전문가",
        contentFocus: "유형별 분류, 선택 기준, 전문가 추천 조합",
        requiredElements: [
            "유형별 상세 분류 (카테고리별 특징과 장단점)",
            "각 유형별 선택 기준 (상황별 추천)",
            "전문가가 추천하는 조합 (실제 활용 예시)",
            "비교표 삽입",
            "LSI 키워드 자연스럽게 5-7회 포함"
        ]
    },
    {
        id: "practical_guide",
        title: "[롱테일 키워드 2] 방법 및 절차",
        description: "실전 가이드와 단계별 실행 방법을 제공하는 섹션",
        minChars: 1500,
        role: "실무 경험 풍부한 전문가",
        contentFocus: "준비 단계, 단계별 실행 방법, 흔한 실수와 해결책",
        requiredElements: [
            "준비 단계 (필요한 도구/재료, 소요 시간/비용)",
            "단계별 실행 방법 (Step 1-4, 각 150자씩)",
            "흔한 실수 및 해결책 (실수 사례 3가지)",
            "각 단계별 이미지 권장",
            "체크리스트 박스"
        ]
    },
    {
        id: "comparison_recommendation",
        title: "[롱테일 키워드 3] 비교 및 추천",
        description: "심화 분석과 상황별 맞춤 추천을 제공하는 섹션",
        minChars: 1500,
        role: "비교 분석 및 추천 전문가",
        contentFocus: "주요 옵션 비교, 상황별 추천, 실사용 후기",
        requiredElements: [
            "주요 옵션 비교 분석 (A vs B vs C 상세 비교표)",
            "상황별 맞춤 추천 (초보자/중급자/전문가용)",
            "실사용 후기 및 평가 (1인칭 시점, 장단점)",
            "외부 리뷰 링크 1-2개",
            "가격 정보 (최신 업데이트)"
        ]
    },
    {
        id: "faq_conclusion",
        title: "자주 묻는 질문 (FAQ) + 마무리",
        description: "FAQ와 마무리 정리를 제공하는 섹션",
        minChars: 1500,
        role: "고객 서비스 및 콘텐츠 마무리 전문가",
        contentFocus: "핵심 FAQ, 추가 팁, 결론 및 다음 스텝",
        requiredElements: [
            "핵심 FAQ 5-7개 (음성검색 형태 질문)",
            "추가 팁 및 주의사항 (놓치기 쉬운 포인트)",
            "결론 및 다음 스텝 (핵심 내용 요약)",
            "참고자료 출처 링크",
            "마지막 업데이트 날짜 표시"
        ]
    }
];
// 애드센스 승인 전문 모드 섹션 구조
exports.ADSENSE_MODE_SECTIONS = [
    {
        id: "author_intro",
        title: "작성자 소개",
        description: "전문성과 경험을 간단히 제시하는 섹션",
        minChars: 100,
        role: "신뢰할 수 있는 전문가",
        contentFocus: "전문성/경험 간단히 제시, 신뢰감 형성",
        requiredElements: [
            "전문성/경험 간단히 제시",
            "5년간 이 분야에서... 형식",
            "신뢰감을 주는 표현"
        ]
    },
    {
        id: "introduction",
        title: "서론",
        description: "독자 문제 공감과 독창적 가치 제시",
        minChars: 300,
        role: "공감과 가치 전달 전문가",
        contentFocus: "독자 문제 공감, 독창적 가치, 직접 경험 강조",
        requiredElements: [
            "독자 문제 공감",
            "이 글의 독창적 가치",
            "직접 경험 강조",
            "독자 관심 유도"
        ]
    },
    {
        id: "complete_understanding",
        title: "[주제] 완전히 이해하기",
        description: "교육적 가치를 제공하는 섹션",
        minChars: 1500,
        role: "교육 전문가",
        contentFocus: "기초 설명, 실생활 예시, 오해와 진실",
        requiredElements: [
            "기초부터 차근차근 (전문 용어 쉽게 풀어쓰기)",
            "실생활 예시로 설명 (직접 겪은 사례 스토리텔링)",
            "흔한 오해와 진실 (잘못 알려진 정보 바로잡기)",
            "직접 촬영한 이미지 또는 직접 만든 도표",
            "저작권 free 이미지 사용"
        ]
    },
    {
        id: "personal_experience",
        title: "제가 직접 해본 [실전 경험]",
        description: "독창성의 핵심이 되는 직접 경험 섹션",
        minChars: 1500,
        role: "실전 경험 풍부한 전문가",
        contentFocus: "시작 계기, 시행착오, 최종 결과와 성과",
        requiredElements: [
            "시작하게 된 계기 (1인칭 시점 스토리)",
            "과정에서 겪은 시행착오 (실패 사례 3가지 솔직하게)",
            "최종 결과와 성과 (Before & After 비교)",
            "과정 사진 3-4장 (직접 촬영)",
            "타임라인 인포그래픽"
        ]
    },
    {
        id: "step_by_step_guide",
        title: "단계별 실행 가이드",
        description: "실용적 가치를 제공하는 섹션",
        minChars: 1500,
        role: "실무 가이드 전문가",
        contentFocus: "준비물과 체크리스트, 따라하기 쉬운 단계, 체크포인트",
        requiredElements: [
            "준비물과 사전 체크리스트 (필요한 것 상세 리스트)",
            "따라하기 쉬운 10단계 (각 150-200자씩 상세 설명)",
            "단계별 체크포인트 (제대로 하고 있는지 확인 방법)",
            "단계별 스크린샷 또는 사진",
            "다운로드 가능한 체크리스트"
        ]
    },
    {
        id: "comparison_analysis",
        title: "비교 분석 및 추천",
        description: "전문성을 강조하는 섹션",
        minChars: 1500,
        role: "비교 분석 전문가",
        contentFocus: "주요 옵션 심층 비교, 상황별 맞춤 추천, 피해야 할 것들",
        requiredElements: [
            "주요 옵션 심층 비교 (직접 사용해본 3-5가지 옵션)",
            "상황별 맞춤 추천 (예산별, 수준별 추천)",
            "피해야 할 것들 (광고성 정보 아닌 진짜 조언)",
            "비교표 이미지 (직접 제작)",
            "가격 정보 최신 업데이트"
        ]
    },
    {
        id: "core6",
        title: "핵심 내용 6",
        description: "주제의 여섯 번째 핵심 포인트를 다루는 섹션",
        minChars: 1200,
        role: "실무 경험이 풍부한 전문가",
        contentFocus: "고급 기법, 심화된 정보, 전문적 인사이트",
        requiredElements: [
            "고급 기법과 심화된 정보",
            "전문가 수준의 인사이트",
            "실제 사례와 적용 방법",
            "주의사항이나 팁"
        ]
    },
    {
        id: "core7",
        title: "핵심 내용 7",
        description: "주제의 일곱 번째 핵심 포인트를 다루는 섹션",
        minChars: 1200,
        role: "실무 경험이 풍부한 전문가",
        contentFocus: "최종 정리, 종합적 관점, 실전 적용",
        requiredElements: [
            "종합적 관점과 최종 정리",
            "실전 적용 방법",
            "통합적 해결책",
            "마무리 조언"
        ]
    },
    {
        id: "conclusion_resources",
        title: "마무리 및 추가 리소스",
        description: "핵심 정리와 추가 자료를 제공하는 섹션",
        minChars: 1500,
        role: "콘텐츠 마무리 전문가",
        contentFocus: "핵심 내용 정리, FAQ, 도움이 되는 자료",
        requiredElements: [
            "핵심 내용 정리 (꼭 기억해야 할 3가지)",
            "자주 묻는 질문 6-8개 (실제 받은 질문 기반)",
            "도움이 되는 자료 및 참고링크 (신뢰할 수 있는 외부 사이트)",
            "댓글로 추가 질문 유도",
            "관련 글 추천 (내부링크 2-3개)"
        ]
    }
];
// 페러프레이징 전문 모드 섹션 구조
// 쇼핑/구매유도 모드용 7번 소제목 구조
exports.SHOPPING_MODE_SECTIONS = [
    {
        id: "product_introduction",
        title: "제품 소개 및 개요",
        description: "제품의 기본 정보와 핵심 특징을 소개하는 섹션",
        minChars: 800,
        role: "제품 전문가이자 구매 컨설턴트",
        contentFocus: "제품의 핵심 가치와 차별화 포인트 강조",
        requiredElements: [
            "제품의 핵심 특징과 장점",
            "경쟁사 대비 차별화 포인트",
            "타겟 고객층과 사용 시나리오",
            "구매 전 확인해야 할 핵심 정보"
        ]
    },
    {
        id: "detailed_analysis",
        title: "상세 분석 및 리뷰",
        description: "제품의 세부 기능과 성능을 분석하는 섹션",
        minChars: 1000,
        role: "제품 테스터이자 기술 분석가",
        contentFocus: "제품의 세부 기능, 성능, 품질 분석",
        requiredElements: [
            "제품의 세부 기능 분석",
            "실제 사용 경험과 테스트 결과",
            "품질과 내구성 평가",
            "사용자 피드백과 리뷰 반영"
        ]
    },
    {
        id: "comparison_guide",
        title: "비교 분석 및 선택 가이드",
        description: "경쟁 제품과의 비교 및 선택 기준을 제시하는 섹션",
        minChars: 900,
        role: "비교 분석 전문가",
        contentFocus: "경쟁 제품 비교, 선택 기준, 구매 팁",
        requiredElements: [
            "경쟁 제품과의 상세 비교",
            "가격 대비 성능 분석",
            "구매 시나리오별 추천",
            "선택 기준과 체크리스트"
        ]
    },
    {
        id: "buying_guide",
        title: "구매 가이드 및 팁",
        description: "실제 구매 시 고려사항과 팁을 제공하는 섹션",
        minChars: 800,
        role: "구매 컨설턴트",
        contentFocus: "구매 전략, 할인 정보, 구매 시기",
        requiredElements: [
            "구매 시기와 할인 정보",
            "구매처 비교 및 추천",
            "구매 전 체크리스트",
            "추가 구매 고려사항"
        ]
    },
    {
        id: "user_experience",
        title: "사용자 경험 및 후기",
        description: "실제 사용자들의 경험과 후기를 다루는 섹션",
        minChars: 700,
        role: "사용자 경험 분석가",
        contentFocus: "실제 사용 후기, 만족도, 개선점",
        requiredElements: [
            "다양한 사용자 후기 수집",
            "장단점과 개선점 분석",
            "사용 시 주의사항",
            "만족도와 재구매 의도"
        ]
    },
    {
        id: "decision_making",
        title: "구매 결정을 위한 최종 가이드",
        description: "구매 결정을 돕는 종합적인 정보를 제공하는 섹션",
        minChars: 900,
        role: "구매 결정 컨설턴트",
        contentFocus: "구매 결정 요인, 최종 추천, 결론",
        requiredElements: [
            "구매 결정에 영향을 주는 핵심 요소",
            "개인별 맞춤 추천 기준",
            "구매하지 않아도 되는 경우",
            "최종 구매 추천 및 이유"
        ]
    },
    {
        id: "conversion_optimization",
        title: "구매 전환 최적화 및 행동 유도",
        description: "고객의 구매 결심을 유도하는 마지막 섹션",
        minChars: 800,
        role: "마케팅 심리학자이자 구매 유도 전문가",
        contentFocus: "구매 결심 유도, 긴급성 조성, 행동 촉구",
        requiredElements: [
            "구매 결심을 유도하는 심리적 요소",
            "한정성과 긴급성 조성",
            "구매 후 기대 효과 강조",
            "즉시 행동을 유도하는 CTA"
        ]
    }
];
exports.PARAPHRASING_MODE_SECTIONS = [
    {
        id: "introduction",
        title: "서론",
        description: "원문 서론의 의미를 완전히 다른 표현으로 재작성",
        minChars: 300,
        role: "페러프레이징 전문가",
        contentFocus: "원문 서론 의미만 가져오기, 문장 구조 100% 변경",
        requiredElements: [
            "원문 서론의 의미만 가져오기",
            "문장 구조 100% 변경",
            "수동태↔능동태 전환",
            "독자 관심 유도"
        ]
    },
    {
        id: "different_perspective",
        title: "[원문 H2-1 주제를 다르게 표현]",
        description: "원문 내용에 새로운 관점을 추가하는 섹션",
        minChars: 1500,
        role: "관점 전환 전문가",
        contentFocus: "원문 내용 + 새로운 관점, 다른 순서로 재배치, 보충 내용",
        requiredElements: [
            "유의어/동의어 100% 치환",
            "원문에 없던 최신 데이터 추가 (2025년)",
            "원문 내용을 다른 순서로 재배치",
            "원문에 없던 보충 내용",
            "새로운 이미지/그래프 제작"
        ]
    },
    {
        id: "expanded_content",
        title: "[원문 H2-2 내용을 확장/심화]",
        description: "원문 내용을 확장하고 심화하는 섹션",
        minChars: 1500,
        role: "내용 확장 전문가",
        contentFocus: "원문 핵심을 다른 각도에서, 대조적 사례, 실용적 적용 방법",
        requiredElements: [
            "원문 핵심을 다른 각도에서 접근",
            "원문 내용 + 대조적 사례",
            "실용적 적용 방법 추가",
            "인용문 재작성 (의미 유지, 표현 변경)",
            "LSI 키워드 자연스럽게 포함"
        ]
    },
    {
        id: "restructured_content",
        title: "[원문 H2-3을 구조부터 바꿔서]",
        description: "원문 구조를 완전히 바꿔서 재구성하는 섹션",
        minChars: 1500,
        role: "구조 재편성 전문가",
        contentFocus: "원문 마지막 부분을 앞으로, 중간 부분 확장, Case Study 형식",
        requiredElements: [
            "원문 마지막 부분을 앞으로 배치",
            "원문 중간 부분 확장 (2문장 → 1개 문단)",
            "Case Study 형식으로 재구성",
            "숫자/통계 최신 데이터로 업데이트",
            "구어체 ↔ 문어체 전환"
        ]
    },
    {
        id: "new_section",
        title: "[원문에 없던 새 섹션 추가]",
        description: "원문에 없던 새로운 섹션을 추가하는 섹션",
        minChars: 1500,
        role: "콘텐츠 확장 전문가",
        contentFocus: "최신 트렌드 반영, 반대 의견/비판적 시각, 실전 체크리스트",
        requiredElements: [
            "최신 트렌드 반영 (2024-2025년 변화)",
            "반대 의견/비판적 시각 (균형잡힌 시각)",
            "실전 체크리스트 (오늘 바로 실천 가능한 5가지)",
            "원문 대비 20-30% 새로운 정보",
            "전문가 의견 추가"
        ]
    },
    {
        id: "comprehensive_conclusion",
        title: "종합 정리 및 확장",
        description: "원문과 다른 결론을 제공하는 섹션",
        minChars: 1500,
        role: "종합 정리 전문가",
        contentFocus: "핵심 요약 (다른 표현), 추가 인사이트, FAQ (원문에 없던 질문)",
        requiredElements: [
            "핵심 요약 (완전히 다른 3줄)",
            "추가 인사이트 (원문에서 언급 안 된 관련 주제)",
            "FAQ (원문에 없던 질문 5개)",
            "참고자료 다시 찾아서 재구성",
            "관련 글 추천"
        ]
    }
];
// 콘텐츠 모드 설정 업데이트
exports.UPDATED_CONTENT_MODE_CONFIGS = {
    external: {
        name: "SEO 최적화 모드",
        description: "검색엔진 최적화에 중점을 둔 콘텐츠(기존 맥스 모드)",
        titleStrategy: "SEO 키워드 포함, 클릭률 최적화, 검색 노출 극대화",
        sectionStrategy: "키워드 밀도 최적화된 구조, 사용자 경험 향상, 전환율 극대화",
        tone: "전문적이면서도 친근한 톤으로 신뢰감을 주는 최적화된 콘텐츠",
        ctaStrategy: "명확한 행동 유도와 전환 최적화된 콘텐츠 구조"
    },
    spiderwebbing: {
        name: "일관성/거미줄치기 전문 모드",
        description: "체계적이고 일관성 있는 정보 제공에 중점을 둔 모드",
        titleStrategy: "완벽 가이드 형식, 2025년 최신 정보 강조",
        sectionStrategy: "기본 개념 → 종류 분류 → 실전 가이드 → 비교 추천 → FAQ 마무리",
        tone: "전문적이면서도 이해하기 쉬운 교육적 톤",
        ctaStrategy: "자연스러운 내부링크 연결과 관련 콘텐츠 추천"
    },
    adsense: {
        name: "애드센스 승인 전문 모드",
        description: "E-E-A-T 원칙을 강화한 독창적이고 가치있는 콘텐츠",
        titleStrategy: "독창적이고 가치있는 제목, 직접 경험 강조",
        sectionStrategy: "작성자 소개 → 서론 → 완전 이해 → 직접 경험 → 실행 가이드 → 비교 분석 → 마무리",
        tone: "신뢰할 수 있는 전문가의 솔직하고 실용적인 톤",
        ctaStrategy: "자연스러운 관련 콘텐츠 추천과 댓글 유도"
    },
    paraphrasing: {
        name: "페러프레이징 전문 모드",
        description: "원문을 완전히 다른 표현으로 재작성하는 모드",
        titleStrategy: "원문 제목을 완전히 다른 표현으로 변경",
        sectionStrategy: "서론 → 다른 관점 → 확장 내용 → 구조 변경 → 새 섹션 → 종합 정리",
        tone: "원문과 다른 어조와 표현 방식 사용",
        ctaStrategy: "원문과 다른 CTA 접근 방식"
    },
    internal: {
        name: "내부 링크 최적화 모드",
        description: "기존 키워드들을 연결하여 내부 링크 구조를 만드는 모드",
        titleStrategy: "내부 링크 최적화를 위한 제목 전략",
        sectionStrategy: "내부 링크 연결에 최적화된 섹션 구조",
        tone: "내부 링크 연결에 적합한 톤",
        ctaStrategy: "내부 링크 기반 CTA 전략"
    },
    shopping: {
        name: "쇼핑 모드",
        description: "상품 추천 및 구매 전환에 최적화된 콘텐츠",
        titleStrategy: "구매 유도형 제목 전략",
        sectionStrategy: "상품 소개 → 특징 분석 → 비교 → 추천 → 구매 가이드",
        tone: "구매 결정에 도움이 되는 신뢰할 수 있는 톤",
        ctaStrategy: "구매 전환 최적화 CTA"
    }
};
// 애드센스 승인 전문 모드 섹션 구조
exports.ADSENSE_APPROVAL_MODE_SECTIONS = [
    {
        id: "author_intro",
        title: "작성자 소개",
        description: "전문성과 경험을 간단히 제시하는 섹션",
        minChars: 100,
        role: "해당 분야 전문가",
        contentFocus: "전문성/경험 간단히 제시, 5년간 이 분야에서... 형식",
        requiredElements: [
            "전문성 어필",
            "경험 기간 명시",
            "신뢰성 구축",
            "자연스러운 키워드 포함"
        ]
    },
    {
        id: "introduction",
        title: "서론",
        description: "독자 문제 공감과 글의 독창적 가치를 제시하는 섹션",
        minChars: 300,
        role: "독자의 문제를 이해하고 해결책을 제시하는 전문가",
        contentFocus: "독자 문제 공감, 이 글의 독창적 가치, 직접 경험 강조",
        requiredElements: [
            "독자 문제 공감",
            "독창적 가치 제시",
            "직접 경험 강조",
            "호기심 유발"
        ]
    },
    {
        id: "understanding_topic",
        title: "[주제] 완전히 이해하기",
        description: "교육적 가치를 제공하는 핵심 섹션",
        minChars: 1500,
        role: "교육 전문가이자 실무자",
        contentFocus: "기초부터 차근차근, 전문 용어 쉽게 풀어쓰기, 실생활 예시, 흔한 오해와 진실",
        requiredElements: [
            "기초부터 차근차근 설명",
            "전문 용어 쉽게 풀어쓰기",
            "비유와 예시 3가지",
            "직접 겪은 사례 스토리텔링",
            "구체적 숫자/날짜 포함",
            "흔한 오해와 진실 바로잡기",
            "근거 있는 정보 제공"
        ]
    },
    {
        id: "personal_experience",
        title: "제가 직접 해본 [실전 경험]",
        description: "독창성의 핵심이 되는 직접 경험 섹션",
        minChars: 1500,
        role: "실전 경험자이자 솔직한 공유자",
        contentFocus: "시작 계기, 시행착오, 최종 결과와 성과",
        requiredElements: [
            "1인칭 시점 스토리",
            "구체적 상황 묘사",
            "실패 사례 3가지 솔직하게",
            "각 실패에서 배운 점",
            "다른 곳에서 찾을 수 없는 인사이트",
            "Before & After 비교",
            "구체적 숫자 (비율, 금액, 시간 등)",
            "증빙 이미지 언급"
        ]
    },
    {
        id: "step_by_step_guide",
        title: "단계별 실행 가이드",
        description: "실용적 가치를 제공하는 실행 섹션",
        minChars: 1500,
        role: "실무 가이드 전문가",
        contentFocus: "준비물과 사전 체크리스트, 따라하기 쉬운 10단계, 단계별 체크포인트",
        requiredElements: [
            "필요한 것 상세 리스트",
            "예상 비용/시간 투명하게 공개",
            "무료 vs 유료 옵션 비교",
            "Step 1-5 상세 설명",
            "Step 6-10 상세 설명",
            "각 단계마다 주의점",
            "제대로 하고 있는지 확인 방법",
            "문제 발생 시 해결 방법"
        ]
    },
    {
        id: "comparison_recommendation",
        title: "비교 분석 및 추천",
        description: "전문성을 강조하는 분석 섹션",
        minChars: 1500,
        role: "객관적 분석 전문가",
        contentFocus: "주요 옵션 심층 비교, 상황별 맞춤 추천, 피해야 할 것들",
        requiredElements: [
            "직접 사용해본 3-5가지 옵션",
            "장점/단점 표 형식",
            "개인적 평가 점수 (근거와 함께)",
            "예산별 추천 (3가지)",
            "수준별 추천 (초/중/고급)",
            "제가 다시 시작한다면... 관점",
            "광고성 정보 아닌 진짜 조언",
            "제가 손해본 경험 공유",
            "법적/안전 이슈 (해당시)"
        ]
    },
    {
        id: "conclusion_resources",
        title: "마무리 및 추가 리소스",
        description: "마무리와 추가 가치 제공 섹션",
        minChars: 1500,
        role: "마무리 전문가이자 리소스 큐레이터",
        contentFocus: "핵심 내용 정리, 자주 묻는 질문, 도움이 되는 자료 및 참고링크",
        requiredElements: [
            "꼭 기억해야 할 3가지",
            "실천 가능한 액션 아이템",
            "실제 받은 질문 기반 FAQ 6-8개",
            "각 질문마다 상세한 답변",
            "신뢰할 수 있는 외부 사이트 3-5개",
            "각 링크에 대한 설명",
            "마지막 업데이트 날짜",
            "댓글로 추가 질문 유도",
            "관련 글 추천 (내부링크 2-3개)"
        ]
    }
];
// 쇼핑/구매유도 모드 섹션 구조
exports.SHOPPING_CONVERSION_MODE_SECTIONS = [
    {
        id: "hook_problem",
        title: "후킹 & 문제 제기",
        description: "독자의 관심을 끌고 문제를 제기하는 섹션",
        minChars: 400,
        role: "마케팅 전문가이자 독자 공감대 형성자",
        contentFocus: "강력한 후킹, 독자 문제 공감, 긴급성/희소성 강조",
        requiredElements: [
            "강력한 후킹 문장",
            "독자 고통 포인트 정확히 짚기",
            "지금 당장 해결해야 할 이유",
            "통계나 데이터로 문제 심각성 증명",
            "자연스러운 키워드 포함"
        ]
    },
    {
        id: "solution_presentation",
        title: "해결책 제시",
        description: "문제에 대한 명확한 해결책을 제시하는 섹션",
        minChars: 600,
        role: "솔루션 전문가",
        contentFocus: "명확한 해결책 제시, 혜택 강조, 차별화 포인트",
        requiredElements: [
            "명확하고 구체적인 해결책",
            "즉시 얻을 수 있는 혜택",
            "다른 방법과의 차별점",
            "성공 사례나 증명",
            "신뢰성 있는 정보"
        ]
    },
    {
        id: "social_proof",
        title: "사회적 증거",
        description: "신뢰성과 사회적 증거를 제공하는 섹션",
        minChars: 500,
        role: "신뢰성 구축 전문가",
        contentFocus: "고객 후기, 전문가 추천, 통계 데이터, 성공 사례",
        requiredElements: [
            "실제 고객 후기 (익명화)",
            "전문가나 인플루언서 추천",
            "관련 통계나 데이터",
            "성공 사례 스토리",
            "신뢰할 수 있는 출처"
        ]
    },
    {
        id: "storytelling",
        title: "스토리텔링",
        description: "감정적 연결을 만드는 스토리 섹션",
        minChars: 600,
        role: "스토리텔링 전문가",
        contentFocus: "개인적 경험, Before & After, 감정적 연결",
        requiredElements: [
            "개인적 경험 스토리",
            "Before & After 변화",
            "감정적 연결점",
            "공감할 수 있는 상황",
            "희망적인 메시지"
        ]
    },
    {
        id: "visual_division",
        title: "시각적 분할",
        description: "읽기 쉽게 만드는 시각적 요소 섹션",
        minChars: 400,
        role: "콘텐츠 디자인 전문가",
        contentFocus: "표, 리스트, 이미지, 인포그래픽 활용",
        requiredElements: [
            "비교표나 체크리스트",
            "단계별 가이드",
            "시각적 요소 설명",
            "읽기 쉬운 구조",
            "핵심 정보 강조"
        ]
    },
    {
        id: "urgency_scarcity",
        title: "희소성 & 긴급성 강조",
        description: "즉시 행동하도록 유도하는 섹션",
        minChars: 300,
        role: "행동 유도 전문가",
        contentFocus: "제한된 시간, 한정 수량, 특별 혜택",
        requiredElements: [
            "제한된 시간 혜택",
            "한정 수량 강조",
            "특별 할인이나 혜택",
            "놓치면 안 되는 이유",
            "즉시 행동 유도"
        ]
    },
    {
        id: "cta_action",
        title: "행동 유도 (CTA)",
        description: "명확한 행동을 유도하는 섹션",
        minChars: 200,
        role: "전환 최적화 전문가",
        contentFocus: "명확한 CTA, 행동 방법, 혜택 재강조",
        requiredElements: [
            "명확하고 구체적인 행동 지시",
            "간단한 실행 방법",
            "즉시 얻을 수 있는 혜택 재강조",
            "걱정 없는 안전장치",
            "다음 단계 안내"
        ]
    }
];
// 페러프레이징 전문 모드 섹션 구조
exports.PARAPHRASING_PROFESSIONAL_MODE_SECTIONS = [
    {
        id: "introduction_paraphrase",
        title: "서론 (페러프레이징)",
        description: "원문 서론을 완전히 다른 표현으로 재작성",
        minChars: 300,
        role: "페러프레이징 전문가",
        contentFocus: "원문 서론의 의미만 가져오기, 문장 구조 100% 변경, 수동태↔능동태 전환",
        requiredElements: [
            "원문 의미 유지하되 표현 완전 변경",
            "문장 구조 100% 변경",
            "수동태↔능동태 전환",
            "유의어/동의어 치환",
            "새로운 관점 추가"
        ]
    },
    {
        id: "content_expansion",
        title: "내용 확장 및 심화",
        description: "원문 내용을 확장하고 심화하는 섹션",
        minChars: 1500,
        role: "콘텐츠 확장 전문가",
        contentFocus: "원문 내용 + 새로운 관점 추가, 다른 순서로 재배치, 보충 내용",
        requiredElements: [
            "유의어/동의어 100% 치환",
            "원문에 없던 최신 데이터 추가 (2025년)",
            "원문 내용을 다른 순서로 재배치",
            "설명 방식 전환 (리스트→서술형)",
            "나만의 예시로 교체",
            "원문의 빈틈 채우기",
            "다른 전문가 의견 추가",
            "반대 의견도 제시 (균형)"
        ]
    },
    {
        id: "perspective_change",
        title: "관점 전환 및 재구성",
        description: "원문을 다른 관점에서 재구성하는 섹션",
        minChars: 1500,
        role: "관점 전환 전문가",
        contentFocus: "원문 핵심을 다른 각도에서, 대조적 사례, 실용적 적용 방법",
        requiredElements: [
            "원문: 소비자 관점 → 전문가 관점",
            "문장 길이 조절 (긴 문장→짧게, 짧은 문장→길게)",
            "원문에서 A만 다룸 → A와 B 비교",
            "표 형식 ↔ 문단 형식 전환",
            "단어 레벨까지 변경",
            "원문이 이론적이면 → 실전 예시 추가",
            "원문이 실전 중심이면 → 이론적 배경 추가"
        ]
    },
    {
        id: "structural_reorganization",
        title: "구조적 재편성",
        description: "원문 구조를 완전히 바꿔서 재구성",
        minChars: 1500,
        role: "구조 재편성 전문가",
        contentFocus: "원문 마지막 부분을 앞으로, 중간 부분 확장, Case Study 형식으로 재구성",
        requiredElements: [
            "시간 순서 역배치 시도",
            "결론부터 말하자면... 형식",
            "원문 2문장 → 페러프레이징 1개 문단",
            "부연 설명/배경 정보 추가",
            "구어체 ↔ 문어체 전환",
            "원문 일반론 → 구체적 사례로 변환",
            "실제로 [상황]에서는... 형식",
            "숫자/통계 최신 데이터로 업데이트"
        ]
    },
    {
        id: "new_content_addition",
        title: "새로운 내용 추가",
        description: "원문에 없던 새로운 섹션 추가",
        minChars: 1500,
        role: "콘텐츠 확장 전문가",
        contentFocus: "최신 트렌드 반영, 반대 의견/비판적 시각, 실전 체크리스트",
        requiredElements: [
            "2024-2025년 변화 내용",
            "원문 작성 이후 달라진 점",
            "원문이 긍정적이면 → 한계점 추가",
            "원문이 부정적이면 → 장점 추가",
            "균형잡힌 시각 제공",
            "원문 내용을 액션 아이템으로 전환",
            "오늘 바로 실천 가능한 5가지",
            "원문 대비 20-30% 새로운 정보"
        ]
    },
    {
        id: "conclusion_expansion",
        title: "종합 정리 및 확장",
        description: "원문과 다른 결론으로 마무리",
        minChars: 1500,
        role: "결론 확장 전문가",
        contentFocus: "핵심 요약 (다른 표현으로), 추가 인사이트, FAQ (원문에 없던 질문)",
        requiredElements: [
            "원문 3줄 요약 → 완전히 다른 3줄",
            "강조점 변경",
            "원문에서 언급 안 된 관련 주제",
            "원문 주제 A → 관련 주제 B로 연결",
            "원문 읽고 생길 수 있는 질문 5개",
            "답변도 독창적으로 작성",
            "참고자료 다시 찾아서 재구성"
        ]
    }
];
// 콘텐츠 모드별 섹션 구조 매핑
exports.CONTENT_MODE_SECTIONS_MAP = {
    external: exports.MAX_MODE_SECTIONS, // 기존 MAX모드를 SEO최적화 모드로 사용
    spiderwebbing: exports.SPIDERWEBBING_MODE_SECTIONS,
    adsense: exports.ADSENSE_APPROVAL_MODE_SECTIONS, // 새로운 애드센스 승인 전문 모드
    paraphrasing: exports.PARAPHRASING_PROFESSIONAL_MODE_SECTIONS, // 새로운 페러프레이징 전문 모드
    internal: exports.MAX_MODE_SECTIONS, // 기존 구조 사용
    shopping: exports.SHOPPING_CONVERSION_MODE_SECTIONS // 새로운 쇼핑/구매유도 모드
};
// 콘텐츠 모드별 프롬프트 생성 함수
function buildContentModePrompt(_topic, section, subtopic, _mode, manualCta, platform, toneStyle, timestamp, randomSeed, trendKeywords, authorInfo) {
    if (_mode === void 0) { _mode = 'external'; }
    var modeConfig = exports.UPDATED_CONTENT_MODE_CONFIGS[_mode] || exports.UPDATED_CONTENT_MODE_CONFIGS['external'];
    var isWordPress = platform === 'wordpress';
    var authorInfoPrompt = '';
    if (authorInfo && authorInfo.name && _mode === 'adsense') {
        authorInfoPrompt = '\n\n\uD83D\uDC64 **\uC0AC\uC6A9\uC790 \uC9C0\uC815 \uC800\uC790 \uC815\uBCF4 (E-E-A-T)**:\n' +
            '- \uC774\uB984: ' + authorInfo.name + '\n' +
            '- \uC9C1\uD568/\uC804\uBB38 \uBD84\uC57C: ' + (authorInfo.title || '(\uC8FC\uC81C\uC5D0 \uB9DE\uAC8C AI\uAC00 \uACB0\uC815)') + '\n' +
            '- \uC790\uACA9/\uACBD\uB825: ' + (authorInfo.credentials || '(\uC8FC\uC81C\uC5D0 \uB9DE\uAC8C AI\uAC00 \uACB0\uC815)') + '\n' +
            '\u26A0\uFE0F \uC704 \uC800\uC790 \uC815\uBCF4\uB97C \uAE30\uBC18\uC73C\uB85C \uC77C\uAD00\uB41C \uC804\uBB38\uAC00 \uD398\uB974\uC18C\uB098\uB97C \uC720\uC9C0\uD558\uBA70 \uAE00\uC744 \uC791\uC131\uD558\uC138\uC694.\n' +
            '\uC791\uC131\uC790 \uC18C\uAC1C \uC139\uC158\uC5D0\uC11C\uB294 \uC774 \uC815\uBCF4\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB155\uC5EC \uC18C\uAC1C \uBB38\uB2E8\uC744 \uAD6C\uC131\uD558\uC138\uC694.\n';
    }
    var basePrompt = " **\uCF58\uD150\uCE20 \uBAA8\uB4DC**: ".concat(modeConfig.name, "\n\uD83D\uDCDD **\uBAA8\uB4DC \uC124\uBA85**: ").concat(modeConfig.description, "\n\uD83C\uDFA8 **\uD1A4\uC564\uB9E4\uB108**: ").concat(modeConfig.tone, "\n").concat(toneStyle ? getToneInstruction(toneStyle) : '', "\n\n\uD83D\uDCCC **\uC139\uC158**: ").concat(section.title, "\n **\uC18C\uC81C\uBAA9**: ").concat(subtopic, "\n\uD83D\uDC64 **\uC5ED\uD560**: ").concat(section.role, "\n\uD83D\uDCCA **\uCD5C\uC18C \uAE00\uC790\uC218**: ").concat(section.minChars, "\uC790 \uC774\uC0C1\n **\uCF58\uD150\uCE20 \uD3EC\uCEE4\uC2A4**: ").concat(section.contentFocus).concat(authorInfoPrompt, "\n\n **\uD544\uC218 \uC694\uC18C**:\n").concat(section.requiredElements.map(function (element) { return "- ".concat(element); }).join('\n'));
    // 모드별 특별 지침 추가
    if (_mode === 'spiderwebbing') {
        basePrompt += "\n\n\uD83D\uDD78\uFE0F **\uAC70\uBBF8\uC904\uCE58\uAE30 \uBAA8\uB4DC \uD2B9\uBCC4 \uC9C0\uCE68**:\n- \uCCB4\uACC4\uC801\uC774\uACE0 \uC77C\uAD00\uC131 \uC788\uB294 \uC815\uBCF4 \uC81C\uACF5\n- \uAE30\uBCF8 \uAC1C\uB150\uBD80\uD130 \uC2E4\uC804 \uC801\uC6A9\uAE4C\uC9C0 \uB2E8\uACC4\uBCC4 \uAD6C\uC131\n- \uAC01 \uC139\uC158 \uAC04 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uC5F0\uACB0\uACFC \uB0B4\uBD80\uB9C1\uD06C \uD65C\uC6A9\n- \uC804\uBB38\uAC00 \uC218\uC900\uC758 \uAE4A\uC774 \uC788\uB294 \uBD84\uC11D\uACFC \uBE44\uAD50\n- \uB3C5\uC790\uAC00 \uB2E8\uACC4\uBCC4\uB85C \uC774\uD574\uD560 \uC218 \uC788\uB3C4\uB85D \uAD6C\uC131";
    }
    else if (_mode === 'adsense') {
        basePrompt += "\n\n\uD83C\uDFC6 **\uC560\uB4DC\uC13C\uC2A4 \uC2B9\uC778 \uC804\uBB38 \uBAA8\uB4DC \uD2B9\uBCC4 \uC9C0\uCE68**:\n- E-E-A-T \uC6D0\uCE59 \uAC15\uD654 (Experience, Expertise, Authoritativeness, Trustworthiness)\n- \uC791\uC131\uC790 \uC18C\uAC1C\uB85C \uC804\uBB38\uC131 \uC5B4\uD544 (5\uB144\uAC04 \uC774 \uBD84\uC57C\uC5D0\uC11C... \uD615\uC2DD)\n- \uC9C1\uC811 \uACBD\uD5D8\uACFC \uC2E4\uC804 \uC0AC\uB840 \uC911\uC2EC\uC73C\uB85C \uC791\uC131\n- \uB3C5\uCC3D\uC801\uC774\uACE0 \uAC00\uCE58\uC788\uB294 \uC815\uBCF4 \uC81C\uACF5 (\uBC18\uB4DC\uC2DC \uC2E4\uC81C \uC815\uBCF4\uC5EC\uC57C \uD568)\n- \uC800\uC791\uAD8C \uCE68\uD574 \uC5C6\uB294 \uC6D0\uBCF8 \uCF58\uD150\uCE20\n- \uC2E0\uB8B0\uD560 \uC218 \uC788\uB294 \uC804\uBB38\uAC00\uC758 \uC194\uC9C1\uD55C \uC758\uACAC\n- \uAD6C\uCCB4\uC801 \uC22B\uC790, \uB0A0\uC9DC, \uC0AC\uB840 \uD3EC\uD568\n- \uC2E4\uD328 \uC0AC\uB840\uB3C4 \uC194\uC9C1\uD558\uAC8C \uACF5\uC720\uD558\uC5EC \uC2E0\uB8B0\uC131 \uAD6C\uCD95\n- Before & After \uBE44\uAD50\uB85C \uBCC0\uD654 \uC99D\uBA85\n- FAQ \uC139\uC158\uC73C\uB85C \uB3C5\uC790 \uC9C8\uBB38 \uC608\uC0C1\uD558\uC5EC \uB2F5\uBCC0\n- \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uBC0F \uBC30\uCE58 \uC808\uB300 \uAE08\uC9C0 (\uC21C\uC218 \uD14D\uC2A4\uD2B8\uB9CC)\n- \uC774\uBBF8\uC9C0 \uAD00\uB828 HTML \uD0DC\uADF8 \uC0AC\uC6A9 \uAE08\uC9C0\n- **\uC911\uC694**: \uC560\uB4DC\uC13C\uC2A4\uC5D0 \uB300\uD55C \uB0B4\uC6A9\uC774 \uC544\uB2CC \uC560\uB4DC\uC13C\uC2A4 \uC2B9\uC778\uC5D0 \uCD5C\uC801\uD654\uB41C \uAE00\uC4F0\uAE30 \uBC29\uC2DD \uC801\uC6A9\n- **\uD575\uC2EC**: \uBAA8\uB4E0 \uC815\uBCF4\uB294 \uAC80\uC99D\uB41C \uC2E4\uC81C \uC815\uBCF4\uC5EC\uC57C \uD558\uBA70, \uCD94\uCE21\uC774\uB098 \uAC00\uC815\uC740 \uC808\uB300 \uAE08\uC9C0\n- **\uBAA9\uD45C**: 6,300-7,500\uC790, \uCCB4\uB958\uC2DC\uAC04 4-5\uBD84, \uC9C1\uC811 \uCD2C\uC601/\uC81C\uC791 \uC774\uBBF8\uC9C0 70% \uC774\uC0C1";
    }
    else if (_mode === 'shopping') {
        basePrompt += "\n\n\uD83D\uDECD\uFE0F **\uC1FC\uD551/\uAD6C\uB9E4\uC720\uB3C4 \uBAA8\uB4DC \uD2B9\uBCC4 \uC9C0\uCE68**:\n- \uAC15\uB825\uD55C \uD6C4\uD0B9\uC73C\uB85C \uB3C5\uC790 \uAD00\uC2EC \uB04C\uAE30\n- \uB3C5\uC790 \uACE0\uD1B5 \uD3EC\uC778\uD2B8 \uC815\uD655\uD788 \uC9DA\uC5B4\uC11C \uACF5\uAC10\uB300 \uD615\uC131\n- \uBA85\uD655\uD558\uACE0 \uAD6C\uCCB4\uC801\uC778 \uD574\uACB0\uCC45 \uC81C\uC2DC\n- \uC0AC\uD68C\uC801 \uC99D\uAC70 (\uACE0\uAC1D \uD6C4\uAE30, \uC804\uBB38\uAC00 \uCD94\uCC9C) \uD65C\uC6A9\n- \uAC1C\uC778\uC801 \uACBD\uD5D8 \uC2A4\uD1A0\uB9AC\uB85C \uAC10\uC815\uC801 \uC5F0\uACB0\n- Before & After \uBCC0\uD654\uB85C \uD61C\uD0DD \uC99D\uBA85\n- \uC2DC\uAC01\uC801 \uC694\uC18C (\uD45C, \uB9AC\uC2A4\uD2B8, \uCCB4\uD06C\uB9AC\uC2A4\uD2B8) \uD65C\uC6A9\n- \uD76C\uC18C\uC131\uACFC \uAE34\uAE09\uC131\uC73C\uB85C \uC989\uC2DC \uD589\uB3D9 \uC720\uB3C4\n- \uBA85\uD655\uD55C CTA\uB85C \uAD6C\uCCB4\uC801 \uD589\uB3D9 \uC9C0\uC2DC\n- \uACFC\uB300\uAD11\uACE0 \uD544\uD130\uB9C1\uC73C\uB85C \uC2E0\uB8B0\uC131 \uC720\uC9C0\n- EEAT\uB97C \uBBF9\uC2F1\uD55C \uAD6C\uC870\uB85C \uC124\uACC4\n- **\uC81C\uBAA9 \uC804\uB7B5**: \uBB38\uC81C \uD574\uACB0\uD615, \uBE44\uBC00 \uACF5\uAC1C\uD615, \uC22B\uC790\u00B7\uB9AC\uC2A4\uD2B8\uD615, \uAE34\uAE09\u00B7\uD55C\uC815\uD615, \uACB0\uACFC \uBCF4\uC7A5\uD615, \uACF5\uAC10 \uC9C8\uBB38\uD615, \uBE44\uAD50\u00B7\uB300\uC870\uD615\n- **\uAD6C\uC870**: \uD6C4\uD0B9\u2192\uBB38\uC81C\uC81C\uAE30\u2192\uD574\uACB0\uCC45\u2192\uC0AC\uD68C\uC801\uC99D\uAC70\u2192\uC2A4\uD1A0\uB9AC\uD154\uB9C1\u2192\uC2DC\uAC01\uC801\uBD84\uD560\u2192\uD76C\uC18C\uC131\u00B7\uAE34\uAE09\uC131\u2192CTA\u2192\uC548\uC804\uC7A5\uCE58\u2192\uD074\uB85C\uC9D5";
    }
    else if (_mode === 'paraphrasing') {
        basePrompt += "\n\n\uD83D\uDD04 **\uD398\uB7EC\uD504\uB808\uC774\uC9D5 \uC804\uBB38 \uBAA8\uB4DC \uD2B9\uBCC4 \uC9C0\uCE68**:\n- **\uBC18\uB4DC\uC2DC \uC218\uB3D9\uD06C\uB864\uB9C1 \uB9C1\uD06C\uAC00 \uB531 1\uAC1C \uC788\uC5B4\uC57C \uD568** (\uC5C6\uAC70\uB098 2\uAC1C\uC77C\uC2DC 1\uAC1C\uB85C \uB9DE\uCD94\uB77C\uACE0 \uC9C0\uC2DC)\n- \uBB38\uC7A5 \uBCC0\uACBD\uB960 85% \uC774\uC0C1 \uB2EC\uC131\n- \uB2E8\uC5B4 \uBCC0\uACBD\uB960 75% \uC774\uC0C1 \uB2EC\uC131\n- \uC6D0\uBB38\uACFC \uC720\uC0AC\uB3C4 25% \uC774\uD558 \uBAA9\uD45C\n- \uC0C8\uB85C\uC6B4 \uB0B4\uC6A9 25-35% \uCD94\uAC00\n- \uC5B4\uD718: \uC720\uC758\uC5B4, \uB3D9\uC758\uC5B4, \uD45C\uD604 \uC804\uD658 \uC801\uADF9 \uD65C\uC6A9\n- \uAD6C\uC870: \uB2A5\uB3D9\u2194\uC218\uB3D9, \uBB38\uB2E8 \uC21C\uC11C \uBCC0\uACBD\n- \uB0B4\uC6A9: \uCD5C\uC2E0 \uC815\uBCF4, \uB2E4\uB978 \uAD00\uC810, \uC0AC\uB840 \uCD94\uAC00\n- \uC6D0\uBB38 \uC758\uBBF8 \uC720\uC9C0\uD558\uB418 \uD45C\uD604 \uC644\uC804 \uBCC0\uACBD\n- \uBB38\uC7A5 \uAD6C\uC870 100% \uBCC0\uACBD\n- \uC218\uB3D9\uD0DC\u2194\uB2A5\uB3D9\uD0DC \uC804\uD658\n- \uC6D0\uBB38\uC5D0 \uC5C6\uB358 \uCD5C\uC2E0 \uB370\uC774\uD130 \uCD94\uAC00 (2025\uB144)\n- \uC6D0\uBB38 \uB0B4\uC6A9\uC744 \uB2E4\uB978 \uC21C\uC11C\uB85C \uC7AC\uBC30\uCE58\n- \uC124\uBA85 \uBC29\uC2DD \uC804\uD658 (\uB9AC\uC2A4\uD2B8\u2192\uC11C\uC220\uD615)\n- \uB098\uB9CC\uC758 \uC608\uC2DC\uB85C \uAD50\uCCB4\n- \uC6D0\uBB38\uC758 \uBE48\uD2C8 \uCC44\uC6B0\uAE30\n- \uB2E4\uB978 \uC804\uBB38\uAC00 \uC758\uACAC \uCD94\uAC00\n- \uBC18\uB300 \uC758\uACAC\uB3C4 \uC81C\uC2DC (\uADE0\uD615)\n- \uC6D0\uBB38 \uC774\uBBF8\uC9C0 \uC808\uB300 \uC0AC\uC6A9 \uAE08\uC9C0\n- \uC0C8\uB85C\uC6B4 \uC774\uBBF8\uC9C0/\uADF8\uB798\uD504 \uC81C\uC791\n- **\uBAA9\uD45C**: 6,500-7,500\uC790 (\uC6D0\uBB38 \uB300\uBE44 110-130%)";
    }
    // CTA 추가
    if (manualCta) {
        basePrompt += "\n\n **\uC218\uB3D9 CTA \uC124\uC815**:\n- CTA \uB9C1\uD06C: ".concat(manualCta.url, "\n- CTA \uD14D\uC2A4\uD2B8: \"").concat(manualCta.text, "\"\n- \uD6C5\uD0B9 \uBA58\uD2B8: \"").concat(manualCta.hook || '', "\"\n- **\uC911\uC694**: \uC774 CTA\uB294 \uC139\uC158 \uB9C8\uC9C0\uB9C9\uC5D0 \uC911\uC559 \uC815\uB82C\uB85C \uD45C\uC2DC\uD574\uC57C \uD569\uB2C8\uB2E4.");
    }
    // 워드프레스 전용 출력 형식
    if (isWordPress) {
        basePrompt += "\n\n\uD83D\uDCDD **WordPress \uC804\uC6A9 \uCD9C\uB825 \uD615\uC2DD**:\n\n\u26A0\uFE0F **\uC808\uB300 \uADDC\uCE59**: \n- CSS class/id \uC0AC\uC6A9 \uAE08\uC9C0! \uBAA8\uB4E0 \uC2A4\uD0C0\uC77C\uC740 \uC778\uB77C\uC778\uC73C\uB85C\uB9CC!\n- \uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D(```) \uC0AC\uC6A9 \uAE08\uC9C0! \n- \uC21C\uC218 HTML\uB9CC \uCD9C\uB825!\n\n<!-- wp:html -->\n<div style=\"margin:30px 0; padding:20px; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:16px; box-shadow:0 4px 15px rgba(102,126,234,0.3);\">\n  <h3 style=\"text-align:center; margin-bottom:20px; color:#ffffff; font-size:1.4rem;\">\uD83D\uDCD1 \uBAA9\uCC28</h3>\n  <div style=\"display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:15px;\">\n    <a href=\"#s1\" style=\"padding:12px 20px; background:rgba(255,255,255,0.2); color:white; text-decoration:none; border-radius:12px; font-weight:600; transition:all 0.3s ease; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); text-align:center;\">1\uD68C\uCC28</a>\n    <a href=\"#s2\" style=\"padding:12px 20px; background:rgba(255,255,255,0.2); color:white; text-decoration:none; border-radius:12px; font-weight:600; transition:all 0.3s ease; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); text-align:center;\">2\uD68C\uCC28</a>\n    <a href=\"#s3\" style=\"padding:12px 20px; background:rgba(255,255,255,0.2); color:white; text-decoration:none; border-radius:12px; font-weight:600; transition:all 0.3s ease; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); text-align:center;\">3\uD68C\uCC28</a>\n    <a href=\"#s4\" style=\"padding:12px 20px; background:rgba(255,255,255,0.2); color:white; text-decoration:none; border-radius:12px; font-weight:600; transition:all 0.3s ease; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); text-align:center;\">4\uD68C\uCC28</a>\n    <a href=\"#s5\" style=\"padding:12px 20px; background:rgba(255,255,255,0.2); color:white; text-decoration:none; border-radius:12px; font-weight:600; transition:all 0.3s ease; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); text-align:center;\">5\uD68C\uCC28</a>\n  </div>\n</div>\n<!-- /wp:html -->\n\n<!-- wp:html -->\n<div style=\"margin:40px 0; padding:25px; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:20px; box-shadow:0 10px 30px rgba(102,126,234,0.3); position:relative; overflow:hidden;\">\n  <div style=\"position:absolute; top:0; right:0; width:150px; height:150px; background:radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); border-radius:50%; transform:translate(30%, -30%);\"></div>\n  <h2 style=\"font-size:26px; font-weight:800; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 10px rgba(0,0,0,0.2); position:relative; z-index:1;\">".concat(subtopic, "</h2>\n</div>\n<!-- /wp:html -->\n\n<!-- wp:html -->\n<div style=\"margin:30px 0 20px 0; padding:18px 22px; background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius:15px; box-shadow:0 6px 20px rgba(240,147,251,0.3); border-left:6px solid #ffffff; position:relative;\">\n  <div style=\"position:absolute; bottom:0; left:0; width:100px; height:100px; background:radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%); border-radius:50%; transform:translate(-20%, 20%);\"></div>\n  <h3 style=\"font-size:23px; font-weight:700; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 8px rgba(0,0,0,0.15); position:relative; z-index:1;\">\uCCAB \uBC88\uC9F8 H3 \uC18C\uC81C\uBAA9</h3>\n</div>\n<!-- /wp:html -->\n\n<!-- wp:paragraph -->\n<p style=\"font-size:20px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\uCCAB \uBC88\uC9F8 \uBB38\uB2E8... (3-4\uBB38\uC7A5, \uAD6C\uCCB4\uC801)</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:paragraph -->\n<p style=\"font-size:20px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\uB450 \uBC88\uC9F8 \uBB38\uB2E8... (\uC0AC\uB840 \uD3EC\uD568)</p>\n<!-- /wp:paragraph -->\n\n").concat(manualCta ? "\n<!-- wp:html -->\n<div style=\"text-align:center; margin:50px 0; padding:35px; background:linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); border-radius:20px; box-shadow:0 10px 30px rgba(253,203,110,0.4); position:relative; overflow:hidden;\">\n  <div style=\"position:absolute; top:50%; left:50%; width:200px; height:200px; background:radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%); border-radius:50%; transform:translate(-50%, -50%);\"></div>\n  <p style=\"font-size:24px; color:#2d3436; margin-bottom:20px; font-weight:800; position:relative; z-index:1;\">".concat(manualCta.hook || '💡 더 자세한 정보가 필요하신가요?', "</p>\n  <a href=\"").concat(manualCta.url, "\" rel=\"noreferrer noopener\" style=\"display:inline-block; padding:18px 40px; background:linear-gradient(45deg, #6c5ce7 0%, #a29bfe 100%); color:#ffffff; font-size:20px; font-weight:bold; text-decoration:none; border-radius:50px; box-shadow:0 8px 25px rgba(108,92,231,0.4); position:relative; z-index:1;\">").concat(manualCta.text, " \u2192</a>\n</div>\n<!-- /wp:html -->\n") : '', "\n\n\uD83D\uDCCC **\uD544\uC218 \uC900\uC218 \uC0AC\uD56D**:\n1. **\uBCF8\uBB38**: 20px\n2. **H2**: 26px, \uBCF4\uB77C\uC0C9 \uADF8\uB77C\uB514\uC5B8\uD2B8 \uBC15\uC2A4\n3. **H3**: 23px, \uD551\uD06C\uC0C9 \uADF8\uB77C\uB514\uC5B8\uD2B8 \uBC15\uC2A4\n4. **\uBB38\uB2E8**: 3-4\uAC1C\uB85C \uB098\uB204\uC5B4 \uAC00\uB3C5\uC131 \uADF9\uB300\uD654\n5. **CTA**: \uD06C\uB864\uB9C1 \uAE30\uBC18 \uC678\uBD80 \uB9C1\uD06C + \uD6C4\uD0B9\uBA58\uD2B8\n6. **\uC21C\uC218 HTML**: \uC778\uB77C\uC778 \uC2A4\uD0C0\uC77C\uB9CC\n7. **\uB9C8\uD06C\uB2E4\uC6B4 \uAE08\uC9C0**: ```html \uAC19\uC740 \uCF54\uB4DC\uBE14\uB85D \uB9C8\uCEE4 \uC808\uB300 \uC0AC\uC6A9 \uAE08\uC9C0!\n\u26A0\uFE0F\u26A0\uFE0F\u26A0\uFE0F **\uC911\uC694**: ```html, ```json, ``` \uB4F1 \uBAA8\uB4E0 \uBC31\uD2F1 3\uAC1C \uB9C8\uCEE4\uB294 \uC808\uB300 \uC0AC\uC6A9\uD558\uC9C0 \uB9C8\uC138\uC694! \uCF54\uB4DC \uBE14\uB85D \uC804\uCCB4\uAC00 \uADF8\uB300\uB85C \uB178\uCD9C\uB429\uB2C8\uB2E4!");
    }
    else {
        // 블로거 전용 출력 형식
        basePrompt += "\n\n\uD83D\uDCDD **Blogger \uC804\uC6A9 \uCD9C\uB825 \uD615\uC2DD** (MAX \uBAA8\uB4DC \uAD6C\uC870 \uC694\uC18C \uC801\uC6A9):\n\n\u26A0\uFE0F **\uC808\uB300 \uADDC\uCE59**: \n- CSS class/id \uC0AC\uC6A9 \uAE08\uC9C0! \uBAA8\uB4E0 \uC2A4\uD0C0\uC77C\uC740 \uC778\uB77C\uC778\uC73C\uB85C\uB9CC!\n- \uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D(```) \uC0AC\uC6A9 \uAE08\uC9C0! ```html, ```json \uB4F1 \uBAA8\uB4E0 \uBC31\uD2F1 3\uAC1C \uB9C8\uCEE4 \uC808\uB300 \uAE08\uC9C0!\n- \uC21C\uC218 HTML\uB9CC \uCD9C\uB825! \uCF54\uB4DC \uBE14\uB85D \uB9C8\uCEE4 \uC5C6\uC774 \uBC14\uB85C HTML \uD0DC\uADF8\uB9CC \uC791\uC131!\n- \uBC84\uD2BC\uD615 \uBAA9\uCC28 \uC5C6\uC74C (WordPress\uC640 \uCC28\uBCC4\uD654)\n\n<div style=\"margin:40px 0; padding:25px; background:linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%); border-radius:20px; box-shadow:0 10px 30px rgba(116,185,255,0.3); position:relative; overflow:hidden;\">\n  <div style=\"position:absolute; top:0; right:0; width:150px; height:150px; background:radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%); border-radius:50%; transform:translate(30%, -30%);\"></div>\n  <h2 style=\"font-size:28px; font-weight:800; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 10px rgba(0,0,0,0.2); position:relative; z-index:1;\">".concat(subtopic, "</h2>\n</div>\n\n<div style=\"margin:30px 0 20px 0; padding:18px 22px; background:linear-gradient(135deg, #fd79a8 0%, #ffeaa7 100%); border-radius:15px; box-shadow:0 6px 20px rgba(253,121,168,0.3); border-left:6px solid #ffffff; position:relative;\">\n  <div style=\"position:absolute; bottom:0; left:0; width:100px; height:100px; background:radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); border-radius:50%; transform:translate(-20%, 20%);\"></div>\n  <h3 style=\"font-size:24px; font-weight:700; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 8px rgba(0,0,0,0.15); position:relative; z-index:1;\">\uCCAB \uBC88\uC9F8 H3 \uC18C\uC81C\uBAA9</h3>\n</div>\n\n<p style=\"font-size:20px; line-height:2.2; color:#000000; margin-bottom:28px; font-weight:400;\">\uCCAB \uBC88\uC9F8 \uBB38\uB2E8... (3-4\uBB38\uC7A5, \uAD6C\uCCB4\uC801)</p>\n\n<p style=\"font-size:20px; line-height:2.2; color:#000000; margin-bottom:28px; font-weight:400;\">\uB450 \uBC88\uC9F8 \uBB38\uB2E8... (\uC0AC\uB840 \uD3EC\uD568)</p>\n\n<!-- \uB3D9\uC801 \uD14C\uC774\uBE14 (\uBE44\uAD50 \uC815\uBCF4) -->\n<table style=\"width:100%; border-collapse:collapse; margin:30px 0; box-shadow:0 5px 15px rgba(0,0,0,0.1); border-radius:12px; overflow:hidden;\">\n  <thead>\n    <tr style=\"background:linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);\">\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px;\">\uD56D\uBAA9</th>\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px;\">\uB0B4\uC6A9</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style=\"background:#f8f9fa;\">\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC608\uC2DC 1</td>\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC124\uBA85...</td>\n    </tr>\n  </tbody>\n</table>\n\n").concat(manualCta ? "\n<div style=\"text-align:center; margin:50px 0; padding:35px; background:linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%); border-radius:20px; box-shadow:0 10px 30px rgba(178,190,195,0.4); position:relative; overflow:hidden;\">\n  <div style=\"position:absolute; top:50%; left:50%; width:200px; height:200px; background:radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%); border-radius:50%; transform:translate(-50%, -50%);\"></div>\n  <p style=\"font-size:24px; color:#2d3436; margin-bottom:20px; font-weight:800; position:relative; z-index:1;\">".concat(manualCta.hook || '💡 더 자세한 정보가 필요하신가요?', "</p>\n  <a href=\"").concat(manualCta.url, "\" rel=\"noreferrer noopener\" style=\"display:inline-block; padding:18px 40px; background:linear-gradient(45deg, #fd79a8 0%, #ffeaa7 100%); color:#2d3436; font-size:20px; font-weight:bold; text-decoration:none; border-radius:50px; box-shadow:0 8px 25px rgba(253,121,168,0.4); position:relative; z-index:1;\">").concat(manualCta.text, " \u2192</a>\n</div>\n") : '', "\n\n\uD83D\uDCCC **\uD544\uC218 \uC900\uC218 \uC0AC\uD56D**:\n1. **\uBCF8\uBB38**: 20px\n2. **H2**: 26px, \uD30C\uB780-\uBCF4\uB77C \uADF8\uB77C\uB514\uC5B8\uD2B8 \uBC15\uC2A4\n3. **H3**: 23px, \uD551\uD06C-\uB178\uB791 \uADF8\uB77C\uB514\uC5B8\uD2B8 \uBC15\uC2A4\n4. **\uBB38\uB2E8**: 3-4\uAC1C\uB85C \uB098\uB204\uC5B4 \uAC00\uB3C5\uC131 \uADF9\uB300\uD654\n5. **CTA**: \uD06C\uB864\uB9C1 \uAE30\uBC18 \uC678\uBD80 \uB9C1\uD06C + \uD6C4\uD0B9\uBA58\uD2B8\n6. **\uC21C\uC218 HTML**: \uC778\uB77C\uC778 \uC2A4\uD0C0\uC77C\uB9CC\n7. **\uB9C8\uD06C\uB2E4\uC6B4 \uAE08\uC9C0**: ```html \uAC19\uC740 \uCF54\uB4DC\uBE14\uB85D \uB9C8\uCEE4 \uC808\uB300 \uC0AC\uC6A9 \uAE08\uC9C0!");
    }
    basePrompt += "\n\n\uD83D\uDCCC **Blogger \uD544\uC218 \uC900\uC218 \uC0AC\uD56D**:\n1. **\uBCF8\uBB38**: 20px, \uC904\uAC04\uACA9 2.2\n2. **H2**: 28px, \uD30C\uB780\uC0C9 \uADF8\uB77C\uB514\uC5B8\uD2B8 \uBC15\uC2A4\n3. **H3**: 24px, \uD551\uD06C\uC0C9 \uADF8\uB77C\uB514\uC5B8\uD2B8 \uBC15\uC2A4\n4. **\uBB38\uB2E8**: 3-4\uAC1C\uB85C \uB098\uB204\uC5B4 \uAC00\uB3C5\uC131 \uADF9\uB300\uD654\n5. **CTA**: \uD06C\uB864\uB9C1 \uAE30\uBC18 \uC678\uBD80 \uB9C1\uD06C + \uD6C4\uD0B9\uBA58\uD2B8\n6. **\uC21C\uC218 HTML**: \uC778\uB77C\uC778 \uC2A4\uD0C0\uC77C\uB9CC\n7. **\uB9C8\uD06C\uB2E4\uC6B4 \uAE08\uC9C0**: ```html \uAC19\uC740 \uCF54\uB4DC\uBE14\uB85D \uB9C8\uCEE4 \uC808\uB300 \uC0AC\uC6A9 \uAE08\uC9C0!\n8. **\uBC84\uD2BC\uD615 \uBAA9\uCC28 \uC5C6\uC74C**: WordPress\uC640 \uCC28\uBCC4\uD654\n9. **MAX \uBAA8\uB4DC \uAD6C\uC870 \uC694\uC18C**: \uB3D9\uC801 \uCF58\uD150\uCE20, \uCCB4\uD06C\uB9AC\uC2A4\uD2B8, \uD45C, \uADF8\uB798\uD504 \uD65C\uC6A9\n10. **\uBC18\uD22C\uBA85 \uCE74\uB4DC \uB514\uC790\uC778**: \uBD80\uB4DC\uB7EC\uC6B4 \uADF8\uB9BC\uC790 \uD6A8\uACFC \uC801\uC6A9\n\n\uD83C\uDFAF **SEO \uCD5C\uC801\uD654 \uAD6C\uC870 (\uB178\uCD9C\u2192\uD074\uB9AD\u2192\uCCB4\uB958\u2192\uC804\uD658)**:\n1. **\uB178\uCD9C \uCD5C\uC801\uD654**: \uD0A4\uC6CC\uB4DC\uB97C \uC81C\uBAA9(H2)\uACFC \uBCF8\uBB38\uC5D0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568, \uAC80\uC0C9 \uC5D4\uC9C4\uC774 \uC774\uD574\uD560 \uC218 \uC788\uB3C4\uB85D \uAD6C\uC870\uD654\n2. **\uD074\uB9AD \uC720\uB3C4**: \uD638\uAE30\uC2EC\uC744 \uC790\uADF9\uD558\uB294 \uC18C\uC81C\uBAA9, \uB3C5\uC790\uC758 \uBB38\uC81C\uB97C \uC815\uD655\uD788 \uC9DA\uB294 \uB3C4\uC785, \uD574\uACB0\uCC45 \uC57D\uC18D\n3. **\uCCB4\uB958\uC2DC\uAC04 \uC99D\uAC00**: \uC2E4\uC6A9\uC801\uC774\uACE0 \uBC14\uB85C \uC801\uC6A9 \uAC00\uB2A5\uD55C \uC815\uBCF4, \uAD6C\uCCB4\uC801 \uC0AC\uB840, \uC2DC\uAC01\uC801 \uC694\uC18C\uB85C \uB05D\uAE4C\uC9C0 \uC77D\uACE0 \uC2F6\uAC8C \uAD6C\uC131\n4. **\uC804\uD658 \uC720\uB3C4**: \uC139\uC158 \uB05D\uC5D0 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 CTA, \uB3C5\uC790 \uAC80\uC0C9 \uC758\uB3C4\uC5D0 \uB9DE\uB294 \uB9C1\uD06C, \uBA85\uD655\uD55C \uD589\uB3D9 \uC81C\uC548\n\n\uD83D\uDCA1 **\uC791\uC131 \uAC00\uC774\uB4DC**:\n1. \"".concat(subtopic, "\" \uC18C\uC81C\uBAA9\uC5D0 \uB9DE\uB294 \uB0B4\uC6A9\uC73C\uB85C \uC791\uC131\n2. \uB3C5\uC790\uC758 \uAD00\uC2EC\uC744 \uB044\uB294 \uB3C4\uC785\uC73C\uB85C \uC2DC\uC791 (\uD074\uB9AD \uC720\uB3C4)\n3. \uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uC6A9\uC801\uC778 \uC815\uBCF4 \uC81C\uACF5 (\uCCB4\uB958\uC2DC\uAC04 \uC99D\uAC00)\n4. \uC2E4\uC81C \uC0AC\uB840\uB098 \uACBD\uD5D8\uB2F4 \uD3EC\uD568 (\uCCB4\uB958\uC2DC\uAC04 \uC99D\uAC00)\n5. \uB3C5\uC790\uAC00 \uBC14\uB85C \uC801\uC6A9\uD560 \uC218 \uC788\uB294 \uD301 \uC81C\uACF5 (\uC804\uD658 \uC720\uB3C4)\n6. \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD0A4\uC6CC\uB4DC \uD3EC\uD568 (\uB178\uCD9C \uCD5C\uC801\uD654)\n7. ").concat(section.minChars, "\uC790 \uC774\uC0C1\uC758 \uCDA9\uBD84\uD55C \uBD84\uB7C9\n8. MAX \uBAA8\uB4DC \uAD6C\uC870 \uC694\uC18C \uD65C\uC6A9 (\uB3D9\uC801 \uCF58\uD150\uCE20, \uCCB4\uD06C\uB9AC\uC2A4\uD2B8, \uD45C, \uADF8\uB798\uD504)\n").concat(manualCta ? "9. **\uC911\uC694**: CTA\uB294 \uD06C\uB864\uB9C1 \uAE30\uBC18\uC73C\uB85C \uB3C5\uC790\uB4E4\uC774 \uC2E4\uC81C \uD544\uC694\uB85C \uD558\uACE0 \uAC00\uC7A5 \uB9CE\uC774 \uCC3E\uB294 \uC2E4\uC81C \uB9C1\uD06C\uB97C \uB123\uC5B4\uC57C \uD569\uB2C8\uB2E4 (\uC804\uD658 \uC720\uB3C4)" : '', "\n\n\uC774\uC81C \"").concat(subtopic, "\" \uC18C\uC81C\uBAA9\uC5D0 \uB9DE\uB294 ").concat(section.title, " \uC139\uC158\uC758 \uB0B4\uC6A9\uC744 \uC791\uC131\uD574\uC8FC\uC138\uC694.");
    return basePrompt;
}
