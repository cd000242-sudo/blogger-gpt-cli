const fs = require('fs');
const path = require('path');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.656 — 제목이 약속한 조각을 검색어로 더 찾는다.
 *
 * 실측: 소제목을 약속에 맞춰도 근거 장부에 답이 없으면 절이 "확인하세요" 로 찬다.
 * 근거부터 약속 조각("신청 방법")으로 모아야 한다. 무료(네이버), LLM 호출 0.
 */
describe('v3.8.656 제목 약속 근거', () => {
  const o = read('src/core/final/orchestration.ts');

  test('근거 수집 뒤에 약속 조각으로 fetchGrounding 을 더 부른다', () => {
    const at = o.indexOf('[제목 약속 근거:');
    expect(at).toBeGreaterThan(0);
    const block = o.slice(at - 1500, at + 600);
    expect(block).toContain("require('./reader-retention')");
    expect(block).toContain('titlePromises(String(h1');
    expect(block).toMatch(/fetchGrounding\(q, naverSearch as any, \{ display: 5 \}\)/);
  });

  test('약속 근거는 장부 앞에 놓인다 — 12,000자에서 잘려도 살아남게', () => {
    expect(o).toContain('naverGrounding = [...extra, naverGrounding]');
  });

  test('조각은 최대 2개, 각 2,000자 — 비용·길이 상한', () => {
    expect(o).toContain('.slice(0, 2);');
    expect(o).toContain('pg.text.slice(0, 2000)');
  });

  test('실패해도 생성을 막지 않는다', () => {
    expect(o).toContain("'[GROUNDING] 제목 약속 근거 스킵:'");
  });
});
