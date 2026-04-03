"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/crawlers/ExcelExporter.ts
const XLSX = __importStar(require("xlsx"));
class ExcelExporter {
    export(questions, filePath, options = {}) {
        console.log(`📊 Excel 내보내기 시작: ${questions.length}개 질문`);
        const { includeGoldScore = true, includeTimestamp = true, includeDescription = true, sheetName = '네이버 지식iN 분석' } = options;
        // 워크북 생성
        const workbook = XLSX.utils.book_new();
        // 데이터 준비
        const data = questions.map((question, index) => {
            const row = {
                '순위': index + 1,
                '제목': question.title,
                'URL': question.url,
                '조회수': question.views,
                '답변수': question.answers,
                '채택답변': question.acceptedAnswer ? 'Y' : 'N',
                '최고답변좋아요': question.topAnswerLikes,
                '카테고리': question.category || ''
            };
            if (includeGoldScore && question.goldScore !== undefined) {
                row['골드점수'] = question.goldScore;
            }
            if (includeTimestamp) {
                row['수집시간'] = question.timestamp.toLocaleString('ko-KR');
            }
            if (includeDescription && question.description) {
                row['설명'] = question.description;
            }
            return row;
        });
        // 워크시트 생성
        const worksheet = XLSX.utils.json_to_sheet(data);
        // 컬럼 너비 설정
        const columnWidths = [
            { wch: 5 }, // 순위
            { wch: 50 }, // 제목
            { wch: 30 }, // URL
            { wch: 10 }, // 조회수
            { wch: 8 }, // 답변수
            { wch: 10 }, // 채택답변
            { wch: 12 }, // 최고답변좋아요
            { wch: 15 }, // 카테고리
        ];
        if (includeGoldScore) {
            columnWidths.push({ wch: 10 }); // 골드점수
        }
        if (includeTimestamp) {
            columnWidths.push({ wch: 20 }); // 수집시간
        }
        if (includeDescription) {
            columnWidths.push({ wch: 40 }); // 설명
        }
        worksheet['!cols'] = columnWidths;
        // 워크시트를 워크북에 추가
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        // 통계 시트 추가
        this.addStatisticsSheet(workbook, questions);
        // 파일 저장
        XLSX.writeFile(workbook, filePath);
        console.log(`✅ Excel 파일 저장 완료: ${filePath}`);
    }
    addStatisticsSheet(workbook, questions) {
        const stats = this.calculateStatistics(questions);
        const statsData = [
            ['통계 항목', '값'],
            ['총 질문 수', stats.totalQuestions],
            ['평균 조회수', Math.round(stats.avgViews)],
            ['평균 답변수', Math.round(stats.avgAnswers)],
            ['평균 좋아요수', Math.round(stats.avgLikes)],
            ['채택 답변 비율', `${(stats.acceptedRatio * 100).toFixed(1)}%`],
            ['최고 조회수', stats.maxViews],
            ['최고 답변수', stats.maxAnswers],
            ['최고 좋아요수', stats.maxLikes],
            ['', ''],
            ['카테고리별 통계', ''],
            ...stats.categoryStats.map(cat => [cat.category, cat.count])
        ];
        const statsWorksheet = XLSX.utils.aoa_to_sheet(statsData);
        statsWorksheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, statsWorksheet, '통계');
    }
    calculateStatistics(questions) {
        const totalQuestions = questions.length;
        if (totalQuestions === 0) {
            return {
                totalQuestions: 0,
                avgViews: 0,
                avgAnswers: 0,
                avgLikes: 0,
                acceptedRatio: 0,
                maxViews: 0,
                maxAnswers: 0,
                maxLikes: 0,
                categoryStats: []
            };
        }
        const totalViews = questions.reduce((sum, q) => sum + q.views, 0);
        const totalAnswers = questions.reduce((sum, q) => sum + q.answers, 0);
        const totalLikes = questions.reduce((sum, q) => sum + q.topAnswerLikes, 0);
        const acceptedCount = questions.filter(q => q.acceptedAnswer).length;
        const maxViews = Math.max(...questions.map(q => q.views));
        const maxAnswers = Math.max(...questions.map(q => q.answers));
        const maxLikes = Math.max(...questions.map(q => q.topAnswerLikes));
        // 카테고리별 통계
        const categoryCount = {};
        questions.forEach(q => {
            const category = q.category || '미분류';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        const categoryStats = Object.entries(categoryCount)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);
        return {
            totalQuestions,
            avgViews: totalViews / totalQuestions,
            avgAnswers: totalAnswers / totalQuestions,
            avgLikes: totalLikes / totalQuestions,
            acceptedRatio: acceptedCount / totalQuestions,
            maxViews,
            maxAnswers,
            maxLikes,
            categoryStats
        };
    }
    exportTrendAnalysis(trendData, filePath) {
        console.log('📈 트렌드 분석 Excel 내보내기 시작');
        const workbook = XLSX.utils.book_new();
        // 키워드 트렌드 시트
        if (trendData.keywords && trendData.keywords.length > 0) {
            const keywordData = trendData.keywords.map((keyword, index) => ({
                '순위': index + 1,
                '키워드': keyword.keyword,
                '빈도': keyword.frequency,
                '평균조회수': keyword.avgViews,
                '평균답변수': keyword.avgAnswers,
                '평균좋아요수': keyword.avgLikes,
                '트렌드': keyword.trend === 'rising' ? '상승' : keyword.trend === 'declining' ? '하락' : '안정',
                '점수': keyword.score
            }));
            const keywordWorksheet = XLSX.utils.json_to_sheet(keywordData);
            keywordWorksheet['!cols'] = [
                { wch: 5 }, { wch: 15 }, { wch: 8 }, { wch: 12 },
                { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 }
            ];
            XLSX.utils.book_append_sheet(workbook, keywordWorksheet, '키워드 트렌드');
        }
        // 카테고리 통계 시트
        if (trendData.topCategories && trendData.topCategories.length > 0) {
            const categoryData = trendData.topCategories.map((category, index) => ({
                '순위': index + 1,
                '카테고리': category.category,
                '질문수': category.count,
                '평균참여도': category.avgEngagement
            }));
            const categoryWorksheet = XLSX.utils.json_to_sheet(categoryData);
            categoryWorksheet['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 10 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(workbook, categoryWorksheet, '카테고리 통계');
        }
        // 추천사항 시트
        if (trendData.recommendations && trendData.recommendations.length > 0) {
            const recommendationData = trendData.recommendations.map((rec, index) => ({
                '순위': index + 1,
                '추천사항': rec
            }));
            const recommendationWorksheet = XLSX.utils.json_to_sheet(recommendationData);
            recommendationWorksheet['!cols'] = [{ wch: 5 }, { wch: 60 }];
            XLSX.utils.book_append_sheet(workbook, recommendationWorksheet, '추천사항');
        }
        XLSX.writeFile(workbook, filePath);
        console.log(`✅ 트렌드 분석 Excel 파일 저장 완료: ${filePath}`);
    }
    exportCrawlingStats(stats, filePath) {
        console.log('📊 크롤링 통계 Excel 내보내기 시작');
        const workbook = XLSX.utils.book_new();
        // 통계 데이터 변환
        const statsData = stats.map((stat, index) => ({
            '순번': index + 1,
            '시작시간': new Date(stat.startTime).toLocaleString('ko-KR'),
            '종료시간': stat.endTime ? new Date(stat.endTime).toLocaleString('ko-KR') : '진행중',
            '총수집': stat.total,
            '성공': stat.success,
            '실패': stat.failed,
            '낮은신뢰도': stat.lowConfidence,
            '성공률': `${(stat.successRate * 100).toFixed(1)}%`,
            '평균신뢰도': `${(stat.avgConfidence * 100).toFixed(1)}%`,
            '소요시간(분)': stat.endTime ? Math.round((stat.endTime - stat.startTime) / 60000 * 10) / 10 : '진행중'
        }));
        const worksheet = XLSX.utils.json_to_sheet(statsData);
        worksheet['!cols'] = [
            { wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
            { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(workbook, worksheet, '크롤링 통계');
        XLSX.writeFile(workbook, filePath);
        console.log(`✅ 크롤링 통계 Excel 파일 저장 완료: ${filePath}`);
    }
}
exports.default = ExcelExporter;
