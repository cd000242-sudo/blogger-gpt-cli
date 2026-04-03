"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EnhancedQuestionValidator {
    constructor() {
        this.maxRetries = 3;
        this.confidenceThreshold = 0.8;
    }
    async validateQuestion(question, page) {
        let attempts = 0;
        let lastError = '';
        while (attempts < this.maxRetries) {
            try {
                attempts++;
                console.log(`🔍 질문 검증 시도 ${attempts}/${this.maxRetries}: ${question.title}`);
                const validationData = await this.extractValidationData(page, question.url);
                const confidence = this.calculateConfidence(question, validationData);
                if (confidence >= this.confidenceThreshold) {
                    console.log(`✅ 검증 성공 (신뢰도: ${(confidence * 100).toFixed(1)}%)`);
                    return {
                        question: { ...question, ...validationData },
                        isValid: true,
                        confidence,
                        attempts
                    };
                }
                else {
                    console.log(`⚠️ 낮은 신뢰도 (${(confidence * 100).toFixed(1)}%), 재시도...`);
                    lastError = `낮은 신뢰도: ${(confidence * 100).toFixed(1)}%`;
                }
            }
            catch (error) {
                lastError = error.message;
                console.log(`❌ 검증 실패 (시도 ${attempts}): ${error.message}`);
                if (attempts < this.maxRetries) {
                    await this.randomDelay(1000, 3000);
                }
            }
        }
        console.log(`❌ 최종 검증 실패: ${question.title}`);
        return {
            question,
            isValid: false,
            confidence: 0,
            attempts,
            errorMessage: lastError
        };
    }
    async extractValidationData(page, url) {
        await page.goto(url, { waitUntil: 'networkidle2' });
        await this.randomDelay(1000, 2000);
        const data = await page.evaluate(() => {
            const result = {};
            // 제목 재확인
            const titleEl = document.querySelector('.title, .question-title, h1');
            if (titleEl) {
                result.title = titleEl.textContent?.trim() || '';
            }
            // 조회수 추출
            const viewsText = document.querySelector('.views, .view-count, .hit')?.textContent || '';
            const viewsMatch = viewsText.match(/(\d+(?:,\d+)*)/);
            if (viewsMatch) {
                result.views = parseInt(viewsMatch[1].replace(/,/g, '')) || 0;
            }
            // 답변 수 추출
            const answersEl = document.querySelector('.answers, .answer-count, .reply-count');
            if (answersEl) {
                const answersText = answersEl.textContent || '';
                const answersMatch = answersText.match(/(\d+)/);
                result.answers = parseInt(answersMatch?.[1] || '0') || 0;
            }
            // 채택 답변 확인
            const acceptedEl = document.querySelector('.accepted, .selected, .best-answer');
            result.acceptedAnswer = !!acceptedEl;
            // 최고 답변 좋아요 수
            const likesEl = document.querySelector('.likes, .like-count, .recommend-count');
            if (likesEl) {
                const likesText = likesEl.textContent || '';
                const likesMatch = likesText.match(/(\d+)/);
                result.topAnswerLikes = parseInt(likesMatch?.[1] || '0') || 0;
            }
            // 카테고리 추출
            const categoryEl = document.querySelector('.category, .tag, .breadcrumb a:last-child');
            if (categoryEl) {
                result.category = categoryEl.textContent?.trim() || '';
            }
            // 설명 추출
            const descEl = document.querySelector('.question-content, .content, .description');
            if (descEl) {
                result.description = descEl.textContent?.trim() || '';
            }
            return result;
        });
        return data;
    }
    calculateConfidence(original, extracted) {
        let score = 0;
        let totalChecks = 0;
        // 제목 일치도 확인
        if (extracted.title) {
            totalChecks++;
            const titleSimilarity = this.calculateSimilarity(original.title, extracted.title);
            score += titleSimilarity * 0.3; // 제목은 30% 가중치
        }
        // 조회수 일치도 확인 (허용 오차 10%)
        if (extracted.views !== undefined) {
            totalChecks++;
            const viewsDiff = Math.abs(original.views - extracted.views) / Math.max(original.views, 1);
            const viewsScore = viewsDiff <= 0.1 ? 1 : Math.max(0, 1 - viewsDiff);
            score += viewsScore * 0.2; // 조회수는 20% 가중치
        }
        // 답변 수 일치도 확인
        if (extracted.answers !== undefined) {
            totalChecks++;
            const answersMatch = original.answers === extracted.answers ? 1 : 0;
            score += answersMatch * 0.2; // 답변 수는 20% 가중치
        }
        // 채택 상태 일치도 확인
        if (extracted.acceptedAnswer !== undefined) {
            totalChecks++;
            const acceptedMatch = original.acceptedAnswer === extracted.acceptedAnswer ? 1 : 0;
            score += acceptedMatch * 0.15; // 채택 상태는 15% 가중치
        }
        // 좋아요 수 일치도 확인 (허용 오차 20%)
        if (extracted.topAnswerLikes !== undefined) {
            totalChecks++;
            const likesDiff = Math.abs(original.topAnswerLikes - extracted.topAnswerLikes) / Math.max(original.topAnswerLikes, 1);
            const likesScore = likesDiff <= 0.2 ? 1 : Math.max(0, 1 - likesDiff);
            score += likesScore * 0.15; // 좋아요는 15% 가중치
        }
        return totalChecks > 0 ? score / totalChecks : 0;
    }
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0)
            return 1.0;
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[str2.length][str1.length];
    }
    randomDelay(min, max) {
        const delay = min + Math.random() * (max - min);
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    async validateBatch(questions, page) {
        const results = [];
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            console.log(`📊 배치 검증 진행: ${i + 1}/${questions.length}`);
            const result = await this.validateQuestion(question, page);
            results.push(result);
            // 배치 간 지연
            if (i < questions.length - 1) {
                await this.randomDelay(2000, 4000);
            }
        }
        return results;
    }
}
exports.default = EnhancedQuestionValidator;
