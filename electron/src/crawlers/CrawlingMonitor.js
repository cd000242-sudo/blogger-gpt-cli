"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CrawlingMonitor {
    constructor() {
        this.statsHistory = [];
        this.maxHistorySize = 100;
    }
    recordStats(stats) {
        this.statsHistory.push({ ...stats });
        // 히스토리 크기 제한
        if (this.statsHistory.length > this.maxHistorySize) {
            this.statsHistory = this.statsHistory.slice(-this.maxHistorySize);
        }
        this.logStats(stats);
    }
    logStats(stats) {
        const duration = stats.endTime ? stats.endTime - stats.startTime : 0;
        const durationMinutes = Math.round(duration / 60000 * 10) / 10;
        console.log('📊 크롤링 통계:');
        console.log(`   총 수집: ${stats.total}개`);
        console.log(`   성공: ${stats.success}개`);
        console.log(`   실패: ${stats.failed}개`);
        console.log(`   낮은 신뢰도: ${stats.lowConfidence}개`);
        console.log(`   성공률: ${(stats.successRate * 100).toFixed(1)}%`);
        console.log(`   평균 신뢰도: ${(stats.avgConfidence * 100).toFixed(1)}%`);
        console.log(`   소요 시간: ${durationMinutes}분`);
    }
    getStats() {
        return [...this.statsHistory];
    }
    getLastStats() {
        return this.statsHistory.length > 0
            ? this.statsHistory[this.statsHistory.length - 1]
            : null;
    }
    getAverageStats() {
        if (this.statsHistory.length === 0)
            return null;
        const totals = this.statsHistory.reduce((acc, stats) => ({
            total: acc.total + stats.total,
            success: acc.success + stats.success,
            failed: acc.failed + stats.failed,
            lowConfidence: acc.lowConfidence + stats.lowConfidence,
            avgConfidence: acc.avgConfidence + stats.avgConfidence,
            successRate: acc.successRate + stats.successRate,
            duration: acc.duration + (stats.endTime ? stats.endTime - stats.startTime : 0)
        }), {
            total: 0,
            success: 0,
            failed: 0,
            lowConfidence: 0,
            avgConfidence: 0,
            successRate: 0,
            duration: 0
        });
        const count = this.statsHistory.length;
        return {
            total: Math.round(totals.total / count),
            success: Math.round(totals.success / count),
            failed: Math.round(totals.failed / count),
            lowConfidence: Math.round(totals.lowConfidence / count),
            avgConfidence: totals.avgConfidence / count,
            successRate: totals.successRate / count,
            startTime: 0,
            endTime: Math.round(totals.duration / count)
        };
    }
    getPerformanceTrend() {
        return this.statsHistory.map(stats => ({
            date: new Date(stats.startTime).toISOString().split('T')[0],
            successRate: stats.successRate,
            avgConfidence: stats.avgConfidence
        }));
    }
    getErrorAnalysis() {
        const totalStats = this.statsHistory.reduce((acc, stats) => ({
            total: acc.total + stats.total,
            failed: acc.failed + stats.failed,
            lowConfidence: acc.lowConfidence + stats.lowConfidence
        }), { total: 0, failed: 0, lowConfidence: 0 });
        if (totalStats.total === 0)
            return [];
        return [
            {
                errorType: '완전 실패',
                count: totalStats.failed,
                percentage: (totalStats.failed / totalStats.total) * 100
            },
            {
                errorType: '낮은 신뢰도',
                count: totalStats.lowConfidence,
                percentage: (totalStats.lowConfidence / totalStats.total) * 100
            },
            {
                errorType: '성공',
                count: totalStats.total - totalStats.failed - totalStats.lowConfidence,
                percentage: ((totalStats.total - totalStats.failed - totalStats.lowConfidence) / totalStats.total) * 100
            }
        ];
    }
    clearHistory() {
        this.statsHistory = [];
        console.log('📊 크롤링 통계 히스토리가 초기화되었습니다.');
    }
    exportStats() {
        const exportData = {
            timestamp: new Date().toISOString(),
            totalRecords: this.statsHistory.length,
            stats: this.statsHistory,
            summary: this.getAverageStats(),
            performanceTrend: this.getPerformanceTrend(),
            errorAnalysis: this.getErrorAnalysis()
        };
        return JSON.stringify(exportData, null, 2);
    }
    importStats(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.stats && Array.isArray(data.stats)) {
                this.statsHistory = data.stats;
                console.log(`📊 ${data.stats.length}개의 통계 기록을 가져왔습니다.`);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('📊 통계 데이터 가져오기 실패:', error);
            return false;
        }
    }
}
exports.default = CrawlingMonitor;
