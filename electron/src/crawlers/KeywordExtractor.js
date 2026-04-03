"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class KeywordExtractor {
    constructor() {
        this.stopWords = new Set([
            '이', '가', '을', '를', '에', '의', '로', '으로', '와', '과', '도', '는', '은',
            '어떻게', '무엇', '어디', '언제', '왜', '어떤', '누구', '어느', '몇', '얼마',
            '방법', '방식', '과정', '절차', '단계', '기법', '팁', '노하우', '비법',
            '질문', '답변', '해결', '문제', '이슈', '고민', '궁금', '알고', '싶어',
            '좋은', '나쁜', '최고', '최악', '추천', '비추천', '후기', '리뷰'
        ]);
    }
    extractKeywords(text) {
        // 한글, 영문, 숫자만 추출
        const words = text
            .replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\s]/g, ' ')
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length >= 2 && !this.stopWords.has(word));
        // 빈도 계산
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        // 빈도순 정렬 및 상위 키워드 반환
        return Object.entries(frequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([word]) => word);
    }
    analyzeTrends(questions, baseKeyword) {
        console.log(`📈 트렌드 분석 시작: ${questions.length}개 질문`);
        // 모든 질문에서 키워드 추출
        const allKeywords = [];
        questions.forEach(question => {
            const keywords = this.extractKeywords(question.title);
            allKeywords.push(...keywords);
            if (question.description) {
                const descKeywords = this.extractKeywords(question.description);
                allKeywords.push(...descKeywords);
            }
        });
        // 키워드 빈도 분석
        const keywordFrequency = {};
        allKeywords.forEach(keyword => {
            keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
        });
        // 키워드별 통계 계산
        const keywordStats = {};
        questions.forEach(question => {
            const keywords = this.extractKeywords(question.title);
            keywords.forEach(keyword => {
                if (!keywordStats[keyword]) {
                    keywordStats[keyword] = { views: [], answers: [], likes: [] };
                }
                keywordStats[keyword].views.push(question.views);
                keywordStats[keyword].answers.push(question.answers);
                keywordStats[keyword].likes.push(question.topAnswerLikes);
            });
        });
        // 트렌드 분석
        const keywordTrends = Object.entries(keywordFrequency)
            .filter(([keyword]) => keywordFrequency[keyword] >= 2) // 최소 2회 이상 언급
            .map(([keyword, frequency]) => {
            const stats = keywordStats[keyword];
            const avgViews = stats.views.reduce((a, b) => a + b, 0) / stats.views.length;
            const avgAnswers = stats.answers.reduce((a, b) => a + b, 0) / stats.answers.length;
            const avgLikes = stats.likes.reduce((a, b) => a + b, 0) / stats.likes.length;
            // 트렌드 점수 계산 (빈도 + 평균 참여도)
            const score = frequency * 0.4 + (avgViews / 1000) * 0.3 + avgAnswers * 0.2 + avgLikes * 0.1;
            // 트렌드 방향 결정 (간단한 휴리스틱)
            let trend = 'stable';
            if (frequency >= 5 && avgViews > 1000)
                trend = 'rising';
            else if (frequency < 3 || avgViews < 500)
                trend = 'declining';
            return {
                keyword,
                frequency,
                avgViews: Math.round(avgViews),
                avgAnswers: Math.round(avgAnswers),
                avgLikes: Math.round(avgLikes),
                trend,
                score: Math.round(score * 100) / 100
            };
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, 15);
        // 카테고리 분석
        const categoryStats = {};
        questions.forEach(question => {
            if (question.category) {
                if (!categoryStats[question.category]) {
                    categoryStats[question.category] = { count: 0, totalEngagement: 0 };
                }
                categoryStats[question.category].count++;
                categoryStats[question.category].totalEngagement += question.views + question.answers * 10 + question.topAnswerLikes;
            }
        });
        const topCategories = Object.entries(categoryStats)
            .map(([category, stats]) => ({
            category,
            count: stats.count,
            avgEngagement: Math.round(stats.totalEngagement / stats.count)
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        // 참여 패턴 분석
        const engagementPatterns = this.analyzeEngagementPatterns(questions);
        // 추천사항 생성
        const recommendations = this.generateRecommendations(keywordTrends, topCategories, baseKeyword);
        console.log(`✅ 트렌드 분석 완료: ${keywordTrends.length}개 키워드, ${topCategories.length}개 카테고리`);
        return {
            keywords: keywordTrends,
            topCategories,
            engagementPatterns,
            recommendations
        };
    }
    analyzeEngagementPatterns(questions) {
        const patterns = [];
        // 고조회수 패턴
        const highViews = questions.filter(q => q.views > 1000);
        if (highViews.length > 0) {
            patterns.push({
                pattern: '고조회수 질문',
                description: '1000회 이상 조회된 질문들의 공통점',
                examples: highViews.slice(0, 3).map(q => q.title)
            });
        }
        // 고답변수 패턴
        const highAnswers = questions.filter(q => q.answers > 5);
        if (highAnswers.length > 0) {
            patterns.push({
                pattern: '고답변수 질문',
                description: '5개 이상 답변이 달린 질문들의 특징',
                examples: highAnswers.slice(0, 3).map(q => q.title)
            });
        }
        // 채택 답변 패턴
        const accepted = questions.filter(q => q.acceptedAnswer);
        if (accepted.length > 0) {
            patterns.push({
                pattern: '채택 답변 질문',
                description: '채택 답변이 있는 질문들의 패턴',
                examples: accepted.slice(0, 3).map(q => q.title)
            });
        }
        return patterns;
    }
    generateRecommendations(keywords, categories, baseKeyword) {
        const recommendations = [];
        // 상위 키워드 기반 추천
        const topKeywords = keywords.slice(0, 5);
        if (topKeywords.length > 0) {
            recommendations.push(`🔥 인기 키워드: ${topKeywords.map(k => k.keyword).join(', ')}`);
        }
        // 상승 트렌드 키워드
        const risingKeywords = keywords.filter(k => k.trend === 'rising');
        if (risingKeywords.length > 0) {
            recommendations.push(`📈 상승 트렌드: ${risingKeywords.slice(0, 3).map(k => k.keyword).join(', ')}`);
        }
        // 인기 카테고리
        const topCategory = categories[0];
        if (topCategory) {
            recommendations.push(`📂 인기 카테고리: ${topCategory.category} (${topCategory.count}개 질문)`);
        }
        // 기반 키워드와의 연관성
        if (baseKeyword) {
            const relatedKeywords = keywords.filter(k => k.keyword.includes(baseKeyword) || baseKeyword.includes(k.keyword));
            if (relatedKeywords.length > 0) {
                recommendations.push(`🔗 "${baseKeyword}" 관련 키워드: ${relatedKeywords.slice(0, 3).map(k => k.keyword).join(', ')}`);
            }
        }
        // 참여도 기반 추천
        const highEngagementKeywords = keywords.filter(k => k.avgViews > 500 && k.avgAnswers > 2);
        if (highEngagementKeywords.length > 0) {
            recommendations.push(`💬 높은 참여도 키워드: ${highEngagementKeywords.slice(0, 3).map(k => k.keyword).join(', ')}`);
        }
        return recommendations;
    }
    findRelatedKeywords(keyword, questions) {
        const relatedKeywords = [];
        questions.forEach(question => {
            if (question.title.includes(keyword) || question.description?.includes(keyword)) {
                const keywords = this.extractKeywords(question.title);
                keywords.forEach(k => {
                    if (k !== keyword && !relatedKeywords.includes(k)) {
                        relatedKeywords.push(k);
                    }
                });
            }
        });
        return relatedKeywords.slice(0, 10);
    }
    calculateKeywordScore(keyword, questions) {
        let score = 0;
        let count = 0;
        questions.forEach(question => {
            if (question.title.includes(keyword) || question.description?.includes(keyword)) {
                score += question.views * 0.1 + question.answers * 10 + question.topAnswerLikes * 5;
                count++;
            }
        });
        return count > 0 ? score / count : 0;
    }
}
exports.default = KeywordExtractor;
