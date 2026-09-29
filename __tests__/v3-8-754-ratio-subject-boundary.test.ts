const fs = require('fs');
const path = require('path');

import { inspectFactIntegrity, sanitizeFactUnsafeHtml, type FactEvidence } from '../src/core/final/fact-integrity';
import { assembleEvidence } from '../src/core/final/evidence';

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/run-1b7d92/evidence-and-packet.json'), 'utf8'));

/*
 * v3.8.754 §5 — 대조 로직 반례. 아래 '상품 A/B' 문장은 실제 상품 규정이 아니라 로직 검증용 테스트 문장이다.
 * weak 근거는 본문 200자 이상이어야 대조 대상이 되므로(기존 규칙) 문맥을 채운다.
 */
const PAD = ' 청년 자산형성 상품은 은행 창구와 앱에서 신청하며 자세한 절차는 취급 은행이 안내합니다. 가입 전 본인 소득 요건을 확인하세요.'.repeat(3);
const ev = (context: string, subjectHint?: string): FactEvidence => ({ provider: 'Naver Grounding', trustLevel: 'weak', topic: '상품 비교', context: context + PAD, ...(subjectHint ? { subjectHint } : {}) });
const status = (html: string, e: FactEvidence) => inspectFactIntegrity(html, e).status;

describe('v3.8.754 비율 대조 — 유형·회차·부정을 숫자만 같다고 인정하지 않는다', () => {
  const A = '상품 A 일반형 6%, 우대형 12%.';

  test('한 문장에 두 유형: 우대형 12퍼센트는 통과, 일반형 12퍼센트는 거절', () => {
    expect(status('<p>상품 A 우대형: 12퍼센트</p>', ev(A, '상품 A 우대형'))).toBe('passed');
    expect(status('<p>상품 A 일반형: 12퍼센트</p>', ev(A, '상품 A 일반형'))).toBe('blocked');
    expect(status('<p>상품 A 일반형: 6퍼센트</p>', ev(A, '상품 A 일반형'))).toBe('passed');
    // 괄호 표기·"에는" 표기(실제 근거 문장 형태)도 같다
    expect(status('<p>우대형: 12퍼센트</p>', ev('일반형(정부 기여금 6%)과 우대형(정부 기여금 12%)으로 나뉜다.', '우대형 기여금'))).toBe('passed');
    expect(status('<p>일반형: 12퍼센트</p>', ev('일반형(정부 기여금 6%)과 우대형(정부 기여금 12%)으로 나뉜다.', '일반형 기여금'))).toBe('blocked');
    expect(status('<p>우대형: 12퍼센트</p>', ev('일반형에는 납입액의 6%, 중소기업 재직자와 신규 취업자 소상공인 등 우대형에는 12%의 기여금이 지급된다.', '우대형 기여금'))).toBe('passed');
  });

  test('같은 문서에 상품 B 의 12% 가 있어도 상품 A 일반형의 근거가 되지 않는다', () => {
    const doc = `${A} 상품 B 우대형 12%.`;
    expect(status('<p>상품 A 일반형: 12퍼센트</p>', ev(doc, '상품 A 일반형'))).toBe('blocked');
    expect(status('<p>상품 A 우대형: 12퍼센트</p>', ev(doc, '상품 A 우대형'))).toBe('passed');
  });

  test('회차(시점)가 다른 비율을 섞지 않는다', () => {
    const doc = '1차 모집 우대형 10%, 2차 모집 우대형 12%.';
    expect(status('<p>2차 우대형: 12퍼센트</p>', ev(doc, '2차 우대형 기여금'))).toBe('passed');
    expect(status('<p>1차 우대형: 12퍼센트</p>', ev(doc, '1차 우대형 기여금'))).toBe('blocked');
    expect(status('<p>1차 우대형: 10퍼센트</p>', ev(doc, '1차 우대형 기여금'))).toBe('passed');
  });

  test('부정 설명은 근거가 아니다 — "우대형 12%가 적용되지 않는다"', () => {
    expect(status('<p>우대형: 12퍼센트</p>', ev('이번 회차에는 우대형 12%가 적용되지 않는다.', '우대형 기여금'))).toBe('blocked');
    expect(status('<p>우대형: 12퍼센트</p>', ev('우대형은 12%를 받지 못한다.', '우대형 기여금'))).toBe('blocked');
    // 값 뒤가 긍정이면 그대로 통과 — 같은 문장 뒤쪽의 다른 부정에 휘둘리지 않는다
    expect(status('<p>우대형: 12퍼센트</p>', ev('우대형은 12%를 받고 일반형은 우대 기여금을 받지 않는다.', '우대형 기여금'))).toBe('passed');
  });

  test('12% 와 12%p 는 다른 값이다 (유지)', () => {
    expect(status('<p>우대형: 12퍼센트</p>', ev('우대형 기여금 비율을 12%p 높이는 방안이 추진된다.', '우대형 기여금'))).toBe('blocked');
    expect(status('<p>우대형 비율을 12퍼센트포인트 높입니다.</p>', ev('우대형 기여금 비율을 12%p 높이는 방안이 추진된다.', '우대형 기여금'))).toBe('passed');
  });

  test('이름표에 유형 낱말이 없으면 예전 동작(값 존재만) — 다른 경로를 흔들지 않는다', () => {
    expect(status('<p>기여금: 12퍼센트</p>', ev(A))).toBe('passed');
    expect(status('<p>기여금: 12퍼센트</p>', ev(A, '정부 기여금'))).toBe('passed');
  });

  test('실제 014 표 — 근거 장부(stage2 실제 본문)로 우대형 12퍼센트 행은 남고, 일반형 12퍼센트 행은 비운다', () => {
    const items = assembleEvidence(FX.stage2.candidates, '2026-09-29');
    const context = items.map((i) => `${i.title} ${i.cleanedText}`).join('\n');   // orchestration 의 factEvidence 조립과 같은 꼴
    const real: FactEvidence = { provider: 'Naver Grounding', trustLevel: 'weak', topic: '청년미래적금 VS 청년 도약계좌', context };
    const cell = (label: string, value: string) => sanitizeFactUnsafeHtml(value, { ...real, subjectHint: label });
    expect(cell('우대형 기여금', '납입액의 12퍼센트')).toBe('납입액의 12퍼센트');       // 표시 문구 그대로
    expect(cell('일반형 기여금', '납입액의 6퍼센트')).toBe('납입액의 6퍼센트');
    expect(cell('일반형 기여금', '납입액의 12퍼센트')).toBe('');                       // 반례: 같은 문서의 우대형 12% 를 빌리지 않는다
    expect(context).toContain('15%');                                                   // 실제 장부엔 "우대형 비율은 15%로(예산안 통과 시)" 가 있다 — 15 는 근거 있는 값
    expect(context).not.toMatch(/37\s*%/);
    expect(cell('우대형 기여금', '납입액의 37퍼센트')).toBe('');                       // 근거 없는 수치 차단 유지
    const rows = FX.summaryRaw.rows.map((r: string[]) => r.map((v: string, ci: number) => (ci > 0 ? cell(r[0]!, v) : v)));
    expect(rows.find((r: string[]) => r[0] === '우대형 기여금')).toEqual(['우대형 기여금', '납입액의 12퍼센트']);
  });
});
