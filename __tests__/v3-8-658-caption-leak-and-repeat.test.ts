const fs = require('fs');
const path = require('path');

import { findProcessLeak } from '../src/core/final/article-audit';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.658 — 네 번째 읽기(5편 중 남은 2편).
 *
 *  ① "이미지 설명문은 고지서 차량 번호와 … 적으면 됩니다" — 캡션 지시가 본문 문장으로 새어 나왔다.
 *     writing-process-leak 이 "제공된 근거" 류만 봐서 못 잡았다.
 *  ② 첫 문장을 지키기 시작하자(v3.8.657) 절마다 같은 확인 순서를 되풀이하는 게 그대로 남았다.
 *     지우는 게 아니라 안 쓰게 해야 한다 — 절 프롬프트에 되풀이 금지.
 */
describe('v3.8.658 캡션 지시 누출 · 되풀이 금지', () => {
  test('① 이미지 설명문·대체 텍스트 지시가 본문에 있으면 잡는다', () => {
    expect(findProcessLeak('이미지 설명문은 고지서 차량 번호와 2026년 상반기 부과 기간 확인 화면처럼 내용이 드러나게 적으면 됩니다.')).toHaveLength(1);
    expect(findProcessLeak('대체 텍스트는 차량번호가 보이게 적습니다.')).toHaveLength(1);
    expect(findProcessLeak('화면을 남긴다면 고지서의 차량 번호가 보이는 부분을 기록하세요.')).toHaveLength(1);
  });

  test('① 정상 문장은 안 잡는다', () => {
    expect(findProcessLeak('고지서의 차량 번호와 부과 기간을 먼저 확인합니다.')).toHaveLength(0);
    expect(findProcessLeak('이미지 파일을 첨부해 문의할 수 있습니다.')).toHaveLength(0);
  });

  test('② 절 프롬프트에 되풀이 금지 규칙이 있다', () => {
    const g = read('src/core/final/generation.ts');
    expect(g).toContain('**되풀이 금지 (v3.8.658)**');
    expect(g).toContain('그 절에서만 할 수 있는 말');
  });

  test('측정 스크립트가 리포트 여러 장을 합쳐 서로 다른 키워드로 잰다', () => {
    const q = read('scripts/quality-run.js');
    expect(q).toContain("process.argv[4] || '') === 'all'");
    expect(q).toContain('seen.has(s.keyword)');
  });
});
