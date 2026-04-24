/**
 * Summary Table Sanitization 검증
 * - AI가 상품 카드 HTML을 셀에 넣는 케이스 재현 → 스트립 되는지 확인
 */

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}\n     expected: ${JSON.stringify(expected)}\n     got:      ${JSON.stringify(actual)}`); failures.push(label); fail++; }
}

function checkContains(label: string, actual: string, expected: string) {
  if (actual.includes(expected)) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}: "${expected}" not in "${actual.slice(0, 80)}..."`); failures.push(label); fail++; }
}

function checkNotContains(label: string, actual: string, forbidden: string) {
  if (!actual.includes(forbidden)) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}: forbidden "${forbidden}" still in cell`); failures.push(label); fail++; }
}

// ═══════════════════════════════════════════
// orchestration.ts의 sanitizeSummaryCell와 동일한 로직
// ═══════════════════════════════════════════
const sanitizeSummaryCell = (raw: unknown): string => {
  const s = String(raw ?? '');
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
};

// ═══════════════════════════════════════════
// 1. 상품 카드 HTML 스트립
// ═══════════════════════════════════════════
console.log('\n[1] 상품 카드 HTML 전체 제거');

const productCard = `<div class="coupang-product" style="border:2px solid red;"><img src="https://jacket.jpg"/><h4>조르쥬 레쉬 자켓</h4><p>289,000원</p><p><strong>할인가 49,000원</strong></p><button style="background:red;">구매하기</button></div>`;
const cleaned = sanitizeSummaryCell(productCard);
console.log(`  입력: ${productCard.slice(0, 60)}...`);
console.log(`  출력: "${cleaned}"`);
checkNotContains('<div> 제거', cleaned, '<div');
checkNotContains('<img> 제거', cleaned, '<img');
checkNotContains('<button> 제거', cleaned, '<button');
checkNotContains('style 속성 제거', cleaned, 'style');
checkContains('텍스트는 유지', cleaned, '조르쥬');
checkContains('가격 텍스트 유지', cleaned, '49,000원');

// ═══════════════════════════════════════════
// 2. 스크립트/스타일 블록 제거
// ═══════════════════════════════════════════
console.log('\n[2] 스크립트/스타일 블록 완전 제거');

const mixed = `안전한 텍스트 <script>alert("XSS")</script> 계속 <style>.ad{display:none}</style> 끝`;
const cleaned2 = sanitizeSummaryCell(mixed);
console.log(`  출력: "${cleaned2}"`);
checkNotContains('script 내용 제거', cleaned2, 'alert');
checkNotContains('style 내용 제거', cleaned2, 'display:none');
checkContains('안전한 텍스트 유지', cleaned2, '안전한 텍스트');

// ═══════════════════════════════════════════
// 3. HTML 엔티티 디코딩
// ═══════════════════════════════════════════
console.log('\n[3] HTML 엔티티 디코딩');

check('nbsp → space', sanitizeSummaryCell('a&nbsp;b'), 'a b');
check('&amp; → &', sanitizeSummaryCell('A &amp; B'), 'A & B');
check('&#128640; 제거', sanitizeSummaryCell('텍스트&#128640;끝'), '텍스트끝');

// ═══════════════════════════════════════════
// 4. 빈 셀 필터링 (rows가 전부 비어있으면 드롭)
// ═══════════════════════════════════════════
console.log('\n[4] 전체 셀 비어있는 row 필터');

const rows = [
  ['주요 내용', '<div></div>'],
  ['대상', '30대 직장인'],
  ['<img src=""/>', '<br/>'],
  ['', ''],
  ['가격', '월 3만원'],
];
const cleanedRows = rows
  .map(row => row.map(sanitizeSummaryCell))
  .filter(row => row.some(c => c.length > 0));

console.log(`  원본 ${rows.length}개 row → 정제 후 ${cleanedRows.length}개`);
check('빈 row 제거됨', cleanedRows.length, 3);
check('첫 row 유지', cleanedRows[0], ['주요 내용', '']);
check('빈 셀만 있던 row 제거', cleanedRows.some(r => r[0] === '' && r[1] === ''), false);

// ═══════════════════════════════════════════
// 5. 최대 길이 제한 (120자)
// ═══════════════════════════════════════════
console.log('\n[5] 긴 셀 120자 컷');

const longText = 'A'.repeat(500);
const cleanedLong = sanitizeSummaryCell(longText);
check('120자 컷', cleanedLong.length, 120);

// ═══════════════════════════════════════════
// 6. generateSummaryTableFinal의 input pre-clean 로직
// ═══════════════════════════════════════════
console.log('\n[6] allContent 사전 정제 (generation.ts)');

const cleanContent = (raw: string) => String(raw || '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<img[^>]*>/gi, '')
  .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
  .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
  .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
  .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
  .replace(/<div[^>]*class="[^"]*(cta|ad-|product|coupang|affiliate|price|buy)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const section = `
<p>이 섹션은 텍스트 설명입니다.</p>
<div class="coupang-product">
  <img src="//jacket.jpg"/>
  <button>구매하기</button>
  <p>가격 49000원</p>
</div>
<p>다음 문단 계속</p>
`;
const cleanedSection = cleanContent(section);
console.log(`  출력: "${cleanedSection}"`);
checkContains('일반 텍스트 유지', cleanedSection, '이 섹션은 텍스트 설명');
checkContains('다음 문단 유지', cleanedSection, '다음 문단 계속');
checkNotContains('coupang-product div 블록 제거', cleanedSection, '구매하기');
checkNotContains('img 제거', cleanedSection, 'jacket.jpg');

// ═══════════════════════════════════════════
// 결과
// ═══════════════════════════════════════════
console.log(`\n${'='.repeat(60)}`);
console.log(`Summary Sanitization: ✅ ${pass}개 통과 / ❌ ${fail}개 실패`);
if (fail > 0) {
  console.log('\n실패:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n🎉 Summary Table 셀에 상품 카드 HTML 절대 렌더링 불가.');
  process.exit(0);
}
