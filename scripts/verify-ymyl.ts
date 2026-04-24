/**
 * YMYL 분류기 검증 스크립트
 * - 카테고리별 대표 키워드 정확 분류 확인
 * - 비-YMYL 키워드는 null 반환 확인
 * - CPC 범위 조회 확인
 * - buildIntentPromptBlock 에 YMYL 블록이 실제로 주입되는지 확인
 */

import {
  classifyIntent,
  classifyYmyl,
  getYmylCpcRange,
  buildIntentPromptBlock,
  buildYmylPromptBlock,
} from '../src/core/search-intent-classifier';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${label}: ${JSON.stringify(actual)}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures.push(label);
    fail++;
  }
}

function checkTruthy(label: string, value: any) {
  if (value) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}: value was falsy`);
    failures.push(label);
    fail++;
  }
}

// ═══════════════════════════════════════════
// 1. YMYL 카테고리별 분류 정확도
// ═══════════════════════════════════════════
console.log('\n[1] YMYL 카테고리 분류 정확도');

const ymylCases: { keyword: string; expected: string }[] = [
  // 금융
  { keyword: '연금저축펀드 추천', expected: 'finance' },
  { keyword: '주식 투자 방법', expected: 'finance' },
  { keyword: 'ETF 순위', expected: 'finance' },
  { keyword: '주택담보대출 금리 비교', expected: 'finance' },
  { keyword: 'ISA 계좌 개설', expected: 'finance' },
  // 보험
  { keyword: '실손보험 비교', expected: 'insurance' },
  { keyword: '자동차보험 다이렉트', expected: 'insurance' },
  { keyword: '태아보험 가입 시기', expected: 'insurance' },
  // 의료
  { keyword: '당뇨 증상', expected: 'medical' },
  { keyword: '임플란트 가격', expected: 'medical' },
  { keyword: '탈모 치료', expected: 'medical' },
  { keyword: '비타민D 복용법', expected: 'medical' },
  // 법률
  { keyword: '이혼 재산분할', expected: 'legal' },
  { keyword: '상속세 계산', expected: 'legal' },
  { keyword: '부당해고 소송', expected: 'legal' },
  // 부동산
  { keyword: '아파트 청약', expected: 'realestate' },
  { keyword: '전세 보증금', expected: 'realestate' },
  // 세금
  { keyword: '연말정산 방법', expected: 'tax' },
  { keyword: '종합소득세 신고', expected: 'tax' },
  // 자격증
  { keyword: '공인중개사 시험', expected: 'career' },
  { keyword: '토익 공부법', expected: 'career' },
];

for (const c of ymylCases) {
  check(`"${c.keyword}" → ${c.expected}`, classifyYmyl(c.keyword), c.expected);
}

// ═══════════════════════════════════════════
// 2. 비-YMYL 키워드 (null 반환 확인)
// ═══════════════════════════════════════════
console.log('\n[2] 비-YMYL 키워드 (null 반환 기대)');

const nonYmylCases = [
  '커피머신 추천',
  '블루투스 스피커 비교',
  '파이썬 기초 강좌',
  '무료 이미지 사이트',
  '여행 꿀팁',
  '넷플릭스 추천작',
];

for (const k of nonYmylCases) {
  check(`"${k}" → null`, classifyYmyl(k), null);
}

// ═══════════════════════════════════════════
// 3. CPC 범위 조회
// ═══════════════════════════════════════════
console.log('\n[3] CPC 범위 조회');

check('finance CPC', getYmylCpcRange('finance'), [5000, 15000]);
check('insurance CPC', getYmylCpcRange('insurance'), [5000, 20000]);
check('medical CPC', getYmylCpcRange('medical'), [2000, 8000]);
check('legal CPC', getYmylCpcRange('legal'), [3000, 10000]);
check('null 카테고리 → null CPC', getYmylCpcRange(null), null);

// ═══════════════════════════════════════════
// 4. buildIntentPromptBlock에 YMYL 블록 주입 확인
// ═══════════════════════════════════════════
console.log('\n[4] buildIntentPromptBlock YMYL 블록 주입');

// YMYL 키워드 — 블록 포함 기대
const financeBlock = buildIntentPromptBlock('연금저축펀드 추천');
checkTruthy('finance: "YMYL 고CPC 키워드 감지" 포함', financeBlock.includes('YMYL 고CPC 키워드 감지'));
checkTruthy('finance: "E-E-A-T 강제 규칙" 포함', financeBlock.includes('E-E-A-T 강제 규칙'));
checkTruthy('finance: "금융감독원" 출처 포함', financeBlock.includes('fss.or.kr'));
checkTruthy('finance: "예상 AdSense CPC" 라벨 포함', financeBlock.includes('예상 AdSense CPC'));
checkTruthy('finance: "5,000~15,000원" CPC 범위 표시', financeBlock.includes('5,000~15,000원'));

const medicalBlock = buildIntentPromptBlock('당뇨 증상');
checkTruthy('medical: "전문의 상담 권고" 포함', medicalBlock.includes('전문의'));
checkTruthy('medical: "질병관리청" 출처 포함', medicalBlock.includes('kdca.go.kr'));

const legalBlock = buildIntentPromptBlock('이혼 재산분할');
checkTruthy('legal: "변호사 상담" 포함', legalBlock.includes('변호사'));
checkTruthy('legal: "국가법령정보센터" 출처 포함', legalBlock.includes('law.go.kr'));

// 비-YMYL 키워드 — 블록 없어야 함
const coffeeBlock = buildIntentPromptBlock('커피머신 추천');
checkTruthy('비-YMYL: "YMYL 고CPC" 블록 미포함', !coffeeBlock.includes('YMYL 고CPC 키워드 감지'));
checkTruthy('비-YMYL: 검색 의도 가이드는 여전히 포함', coffeeBlock.includes('검색 의도 분석 결과'));

// ═══════════════════════════════════════════
// 5. 의도 분류와 YMYL은 독립적으로 작동
// ═══════════════════════════════════════════
console.log('\n[5] 의도 분류 × YMYL 독립성');

// 금융 + 투자는 informational, 하지만 finance YMYL
check('"주식 투자 방법" 의도', classifyIntent('주식 투자 방법'), 'informational');
check('"주식 투자 방법" YMYL', classifyYmyl('주식 투자 방법'), 'finance');

// 보험 + 비교는 investigational, YMYL insurance
check('"실손보험 비교" 의도', classifyIntent('실손보험 비교'), 'investigational');
check('"실손보험 비교" YMYL', classifyYmyl('실손보험 비교'), 'insurance');

// ═══════════════════════════════════════════
// 결과 요약
// ═══════════════════════════════════════════
console.log(`\n${'='.repeat(60)}`);
console.log(`YMYL 검증: ✅ ${pass}개 통과 / ❌ ${fail}개 실패`);
if (fail > 0) {
  console.log('\n실패한 테스트:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n🎉 YMYL 분류기가 정상 작동합니다.');
  process.exit(0);
}
