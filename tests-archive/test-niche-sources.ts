/**
 * Quick diagnostic test for niche keyword engine source distribution
 */
import { scanNicheKeywords } from './src/utils/niche-keyword-engine';

async function main() {
    console.log('='.repeat(60));
    console.log('🔍 Niche Keyword Engine 진단 테스트');
    console.log('='.repeat(60));

    try {
        const result = await scanNicheKeywords(
            { maxKeywords: 30, categoryFilter: 'all', enableKinCrawling: true },
            (msg, pct) => {
                console.log(`[진행] ${Math.round(pct)}% - ${msg}`);
            }
        );

        console.log('\n' + '='.repeat(60));
        console.log('📊 결과 요약');
        console.log('='.repeat(60));
        console.log(`총 키워드: ${result.keywords.length}개`);
        console.log(`총 분석: ${result.totalScanned}개`);
        console.log(`소스: ${result.sources.join(', ')}`);

        // Source distribution
        const sourceCount: Record<string, number> = {};
        for (const kw of result.keywords) {
            const src = kw.source || 'unknown';
            sourceCount[src] = (sourceCount[src] || 0) + 1;
        }
        console.log('\n📈 소스별 분포:');
        for (const [src, count] of Object.entries(sourceCount)) {
            console.log(`  ${src}: ${count}개 (${Math.round(count / result.keywords.length * 100)}%)`);
        }

        // Top 10 keywords with source
        console.log('\n🏆 상위 10 키워드:');
        for (const kw of result.keywords.slice(0, 10)) {
            console.log(`  [${kw.source}] ${kw.keyword} (gapScore: ${kw.gapScore}, vol: ${kw.estimatedVolume}, docs: ${kw.documentCount})`);
        }

    } catch (err: any) {
        console.error('❌ 에러:', err.message);
        console.error(err.stack);
    }

    process.exit(0);
}

main();
