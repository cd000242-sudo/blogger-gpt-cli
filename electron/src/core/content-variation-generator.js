"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentVariationGenerator = void 0;
var ContentVariationGenerator = /** @class */ (function () {
    function ContentVariationGenerator() {
    }
    ContentVariationGenerator.prototype.generateVariations = function (topic, _keywords) {
        var variations = [
            {
                type: 'news',
                title: "".concat(topic, " \uCD5C\uC2E0 \uB3D9\uD5A5\uACFC \uD2B8\uB80C\uB4DC \uBD84\uC11D"),
                approach: '최신 뉴스와 트렌드를 중심으로 한 시의성 있는 콘텐츠',
                structure: ['최신 동향', '트렌드 분석', '전문가 의견', '미래 전망', '실무 적용'],
                tone: '객관적이고 신뢰성 있는',
                targetAudience: '업계 전문가, 트렌드 관심자',
                uniqueValue: '실시간 정보와 전문적 분석'
            },
            {
                type: 'guide',
                title: "".concat(topic, " \uC644\uBCBD \uC2E4\uC804 \uAC00\uC774\uB4DC"),
                approach: '단계별 실습 중심의 실용적 가이드',
                structure: ['기본 개념', '준비사항', '단계별 실습', '문제해결', '고급 팁'],
                tone: '친근하고 설명적인',
                targetAudience: '초보자, 실무자',
                uniqueValue: '즉시 적용 가능한 실용적 정보'
            },
            {
                type: 'review',
                title: "".concat(topic, " \uC804\uBB38\uAC00 \uB9AC\uBDF0\uC640 \uD3C9\uAC00"),
                approach: '다양한 관점에서의 객관적 리뷰와 평가',
                structure: ['개요', '장단점 분석', '비교 평가', '사용자 후기', '종합 평가'],
                tone: '균형잡힌 분석적',
                targetAudience: '구매 고려자, 비교 검토자',
                uniqueValue: '신뢰할 수 있는 객관적 평가'
            },
            {
                type: 'analysis',
                title: "".concat(topic, " \uC2EC\uCE35 \uB370\uC774\uD130 \uBD84\uC11D"),
                approach: '데이터와 통계를 바탕으로 한 전문적 분석',
                structure: ['데이터 수집', '통계 분석', '패턴 발견', '인사이트 도출', '결론'],
                tone: '전문적이고 논리적인',
                targetAudience: '데이터 분석가, 의사결정자',
                uniqueValue: '검증된 데이터 기반 인사이트'
            },
            {
                type: 'story',
                title: "".concat(topic, " \uC131\uACF5 \uC2A4\uD1A0\uB9AC\uC640 \uACBD\uD5D8\uB2F4"),
                approach: '실제 경험과 스토리를 통한 감동적 콘텐츠',
                structure: ['도입 스토리', '도전과 극복', '핵심 교훈', '실용적 적용', '영감 메시지'],
                tone: '감동적이고 영감을 주는',
                targetAudience: '동기부여 추구자, 경험 공유자',
                uniqueValue: '감정적 연결과 실질적 교훈'
            },
            {
                type: 'comparison',
                title: "".concat(topic, " \uC885\uD569 \uBE44\uAD50 \uBD84\uC11D"),
                approach: '다양한 옵션과 방법론의 체계적 비교',
                structure: ['비교 기준', '옵션별 분석', '장단점 비교', '상황별 추천', '최종 결론'],
                tone: '객관적이고 체계적인',
                targetAudience: '선택 고민자, 비교 검토자',
                uniqueValue: '체계적이고 신뢰할 수 있는 비교'
            }
        ];
        var recommendedType = 'analysis'; // 데이터 기반 분석이 애드센스에 가장 친화적
        var differentiationPoints = [
            '각 변형마다 완전히 다른 접근법과 구조 사용',
            '타겟 오디언스에 맞는 맞춤형 톤앤매너',
            '고유한 가치 제안으로 차별화',
            '다양한 콘텐츠 타입으로 포트폴리오 구성'
        ];
        var contentMix = [
            '뉴스형: 시의성 있는 최신 정보',
            '가이드형: 실용적이고 적용 가능한 정보',
            '리뷰형: 신뢰할 수 있는 객관적 평가',
            '분석형: 데이터 기반 전문적 인사이트',
            '스토리형: 감정적 연결과 영감',
            '비교형: 체계적이고 신뢰할 수 있는 비교'
        ];
        return {
            variations: variations,
            recommendedType: recommendedType,
            differentiationPoints: differentiationPoints,
            contentMix: contentMix
        };
    };
    ContentVariationGenerator.prototype.generateContentOutline = function (variation, _topic) {
        var baseOutline = [
            "\uB3C5\uCC3D\uC801\uC778 \uB3C4\uC785\uBD80: ".concat(variation.uniqueValue, "\uB97C \uAC15\uC870"),
            "\uD575\uC2EC \uB0B4\uC6A9: ".concat(variation.approach),
            "\uAD6C\uCCB4\uC801 \uC0AC\uB840: ".concat(variation.targetAudience, "\uB97C \uC704\uD55C \uC2E4\uC81C \uC801\uC6A9 \uC0AC\uB840"),
            "\uC804\uBB38\uC801 \uBD84\uC11D: \uB370\uC774\uD130\uC640 \uD1B5\uACC4\uB97C \uD65C\uC6A9\uD55C \uC2E0\uB8B0\uC131 \uC788\uB294 \uC815\uBCF4",
            "\uC2E4\uC6A9\uC801 \uAC00\uC774\uB4DC: \uB3C5\uC790\uAC00 \uBC14\uB85C \uC801\uC6A9\uD560 \uC218 \uC788\uB294 \uAD6C\uCCB4\uC801 \uBC29\uBC95",
            "\uCC28\uBCC4\uD654\uB41C \uACB0\uB860: ".concat(variation.uniqueValue, "\uB97C \uB2E4\uC2DC \uAC15\uC870\uD558\uBA70 \uD589\uB3D9 \uC720\uB3C4")
        ];
        return baseOutline;
    };
    return ContentVariationGenerator;
}());
exports.ContentVariationGenerator = ContentVariationGenerator;
