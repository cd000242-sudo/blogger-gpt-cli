/**
 * DataLab Shopping Insight 키워드 크롤링 테스트 v2
 * 결과를 UTF-8 파일로 직접 저장
 */

const { crawlDataLabShoppingKeywords } = require('./dist/utils/niche-keyword-engine');
const fs = require('fs');

async function main() {
    const lines = [];
    const log = (msg) => { lines.push(msg); console.log(msg); };

    log('=== DataLab 쇼핑 키워드 테스트 시작 ===');
    log(`시작 시각: ${new Date().toLocaleString('ko-KR')}`);
    log('');

    try {
        const keywords = await crawlDataLabShoppingKeywords((msg) => {
            log(`[Progress] ${msg}`);
        });

        log('');
        log(`=== 결과 요약 ===`);
        log(`총 키워드 수: ${keywords.length}개`);
        log('');

        // 키워드 길이 분포 분석
        const lenBuckets = { '2-3자': 0, '4-5자': 0, '6-10자': 0, '11자 이상': 0 };
        for (const kw of keywords) {
            if (kw.length <= 3) lenBuckets['2-3자']++;
            else if (kw.length <= 5) lenBuckets['4-5자']++;
            else if (kw.length <= 10) lenBuckets['6-10자']++;
            else lenBuckets['11자 이상']++;
        }
        log('키워드 길이 분포: ' + JSON.stringify(lenBuckets));

        // 쓸모없는 키워드 검출
        const suspicious = keywords.filter(kw => {
            if (kw.length <= 1) return true;
            if (/^[0-9]+$/.test(kw)) return true;
            if (/^[a-zA-Z]{1,2}$/.test(kw)) return true;
            return false;
        });
        if (suspicious.length > 0) {
            log(`\n⚠️ 의심스러운 키워드 ${suspicious.length}개: ${JSON.stringify(suspicious)}`);
        } else {
            log('\n✅ 의심스러운 키워드 없음');
        }

        // 전체 키워드 목록 출력
        log('\n--- 전체 키워드 목록 ---');
        keywords.forEach((kw, i) => {
            log(`  ${i + 1}. ${kw}`);
        });

        // 쇼핑 관련성 분석
        const shoppingPatterns = /추천|비교|리뷰|후기|가격|할인|세일|최저가|구매|인기|베스트|랭킹/;
        const shoppingRelated = keywords.filter(kw => shoppingPatterns.test(kw));
        log(`\n쇼핑 의도 키워드: ${shoppingRelated.length}개 (${Math.round(shoppingRelated.length / keywords.length * 100)}%)`);
        if (shoppingRelated.length > 0) {
            log('  샘플: ' + shoppingRelated.slice(0, 10).join(', '));
        }

    } catch (err) {
        log('❌ 테스트 실패: ' + err.message);
        log(err.stack);
    }

    log(`\n종료 시각: ${new Date().toLocaleString('ko-KR')}`);

    // UTF-8로 파일 저장
    fs.writeFileSync('datalab-test-result-utf8.txt', lines.join('\n'), 'utf-8');
    console.log('\n결과가 datalab-test-result-utf8.txt에 저장되었습니다.');
    
    // 카테고리별 수집 개수 분석
    const catCounts = {};
    const catKeywords = {
        패션의류: ['트위드자켓','원피스','써스데이아일랜드','모조에스핀'],
        화장품: ['ahc아이크림','마데카크림','디올립글로우','마스크팩'],
        디지털: ['냉장고','공기청정기','노트북'],
        가구: ['화장대','식탁의자','침대프레임'],
        식품: ['알부민','댕유자','오메가3'],
        생활건강: ['금고','텀블러','스타벅스텀블러']
    };
    for (const [cat, markers] of Object.entries(catKeywords)) {
        const count = keywords.filter(kw => markers.some(m => kw === m)).length;
        catCounts[cat] = count > 0 ? '있음' : '없음';
    }
    log('\n카테고리 데이터 확인: ' + JSON.stringify(catCounts));
}

main();
