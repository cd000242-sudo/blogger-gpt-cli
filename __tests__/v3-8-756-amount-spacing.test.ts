const fs = require('fs');
const path = require('path');

import { inspectFactIntegrity, sanitizeArticleFactClaims, sanitizeFactUnsafeHtml, type FactEvidence } from '../src/core/final/fact-integrity';
import { normalizeForMatch, containsValueToken } from '../src/core/final/number-token';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/run-f607bc/filter-inputs.json'), 'utf8'));
/** weak 근거는 본문 200자 이상이어야 대조 대상이 된다(기존 규칙) — 파서 검증용 합성 문장이라 문맥을 채운다 */
const PAD = ' 청년 자산형성 상품은 은행 창구와 앱에서 신청하며 자세한 절차는 취급 은행이 안내합니다. 가입 전 본인 소득 요건을 확인하세요.'.repeat(3);
const ev = (context: string, subjectHint?: string): FactEvidence => ({ provider: 'Naver Grounding', trustLevel: 'weak', topic: '상품 비교', context: context + PAD, ...(subjectHint ? { subjectHint } : {}) });
const status = (html: string, e: FactEvidence) => inspectFactIntegrity(html, e).status;
const detail = (html: string, e: FactEvidence) => inspectFactIntegrity(html, e).violations.map((v) => v.detail).join(' | ');
const plain = (o: any) => [String(o.introduction || ''), ...(o.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => String(h.content || '')))].join('\n');

/*
 * v3.8.756 — 금액 단위 띄어쓰기 사각. 실측(run f607bc 재생): "90만원" 은 VALUE_PATTERNS 에 걸려 대조됐지만
 * "90만 원" 은 단위 목록에 `만원` 만 있어 토큰이 안 뽑혔다(미추출 → 대조 없이 통과). 억 은 이미 `억(?:\s*원)?` 였다.
 * 아래 문장은 파서 검증용 합성 예시다. 실제 상품 조건이 아니다.
 */
describe('v3.8.756 금액 단위 띄어쓰기 — 같은 검사 경로를 지난다', () => {
  test('경로 확인: "90만 원" 이 이제 값 토큰으로 추출된다 (미추출 → 추출·대조)', () => {
    const none = ev('월 한도는 정해져 있다.');
    expect(status('<p>월 한도는 90만원이다.</p>', none)).toBe('blocked');
    expect(status('<p>월 한도는 90만 원이다.</p>', none)).toBe('blocked');           // 예전엔 passed(미추출)
    expect(detail('<p>월 한도는 90만 원이다.</p>', none)).toContain('90만원');       // 추출된 토큰(정규화 뒤)
    expect(status('<p>매출 3억 원 이하</p>', none)).toBe('blocked');
    expect(status('<p>원금 3,600만 원</p>', none)).toBe('blocked');
  });

  test('A 근거가 있을 때 — 양쪽 방향 모두 보존', () => {
    expect(status('<p>월 한도는 90만 원이다.</p>', ev('월 한도는 90만원이다.'))).toBe('passed');
    expect(status('<p>월 한도는 90만원이다.</p>', ev('월 한도는 90만 원이다.'))).toBe('passed');
    expect(status('<p>매출 3억 원 이하</p>', ev('연매출 3억원 이하 소상공인'))).toBe('passed');
    expect(status('<p>매출 3억원 이하</p>', ev('연매출 3억 원 이하 소상공인'))).toBe('passed');
    expect(status('<p>원금 3,600만 원</p>', ev('총 납입원금 3,600만원'))).toBe('passed');
    expect(status('<p>원금 3,600만원</p>', ev('총 납입원금 3,600만 원'))).toBe('passed');
    // 공용 계층(number-token)에서 같은 꼴이 된다 — 검사기마다 정규식을 복사하지 않는다
    expect(normalizeForMatch('90만 원')).toBe(normalizeForMatch('90만원'));
    expect(normalizeForMatch('3,600만 원')).toBe('3600만원');
    expect(containsValueToken(normalizeForMatch('한도는 90만 원 이다'), normalizeForMatch('90만원'))).toBe(true);
    // HTML 의 비분리 공백도 실제 정제(toPlainText: &nbsp; → 공백)를 지나 같은 결과
    expect(status('<p>월 한도는 90만&nbsp;원이다.</p>', ev('월 한도는 90만원이다.'))).toBe('passed');
    expect(status('<p>월 한도는 90만&nbsp;원이다.</p>', ev('월 한도는 정해져 있다.'))).toBe('blocked');
  });

  test('B 근거가 없을 때 — 두 표기 모두 추출·대조를 거쳐 차단된다 (한쪽만 지나가면 실패)', () => {
    const none = ev('청년 적금은 월 납입 한도가 있다.');
    for (const s of ['90만원', '90만 원', '3억원', '3억 원', '3,600만원', '3,600만 원']) {
      expect(status(`<p>한도는 ${s}입니다.</p>`, none)).toBe('blocked');
    }
  });

  test('C 의미 경계 — 단위 정규화가 값·단위·범위·유형·부정을 뭉개지 않는다', () => {
    expect(status('<p>한도는 90만 원이다.</p>', ev('한도는 900만원이다.'))).toBe('blocked');          // 다른 값
    expect(status('<p>한도는 90만 원이다.</p>', ev('한도는 90억원이다.'))).toBe('blocked');           // 다른 단위
    expect(status('<p>한도는 90만 원이다.</p>', ev('한도는 90만 명이다.'))).toBe('blocked');          // 다른 단위(명)
    expect(status('<p>비율은 12%p 오른다.</p>', ev('비율은 12%다.'))).toBe('blocked');                 // %p 구분 유지
    // 표의 다른 행(유형) — 이름표 경로는 그대로 가른다
    const two = ev('일반형 월 한도 50만 원, 우대형 월 한도 90만 원.', '일반형 한도');
    expect(sanitizeFactUnsafeHtml('월 90만 원', two)).toBe('');
    expect(sanitizeFactUnsafeHtml('월 50만 원', two)).toBe('월 50만 원');
    expect(sanitizeFactUnsafeHtml('월 90만 원', { ...two, subjectHint: '우대형 한도' })).toBe('월 90만 원');
    // 부정 — "적용되지 않는다" 는 근거가 아니다(이름표 경로)
    expect(sanitizeFactUnsafeHtml('월 90만 원', ev('이번 회차에는 우대형 90만 원 한도가 적용되지 않는다.', '우대형 한도'))).toBe('');
    // 날짜·비율은 금액으로 뽑히지 않는다 — "2026년 3월 15일" 은 날짜 패턴, "15일 원" 같은 우연 결합 없음
    expect(status('<p>2026년 3월 15일 시작</p>', ev('2026년 3월 15일 시작'))).toBe('passed');
    expect(status('<p>2026년 3월 15일 시작</p>', ev('2026년 3월 16일 시작'))).toBe('blocked');
  });

  test('D 기존 회귀 — f607bc 우대형 조건·12퍼센트 행·10월 9일 차단·37% 미지원이 그대로다', () => {
    const items = FX.stage2Items;
    const view = buildValidationEvidence(items, { context: '', provider: 'Naver Grounding', trustLevel: 'weak', topic: '청년미래적금 VS 청년 도약계좌' }, { deliveredIds: new Set(FX.renderUsedIds) });
    const cleaned = sanitizeArticleFactClaims(FX.draft017, view.evidence);
    const out = plain(cleaned);
    expect(out).toContain('총급여 3600만 원과 기준 중위소득 150% 이하 등 우대형 조건을 함께 충족해야 합니다');
    expect(out).toContain('연매출 1억 원 이하 소상공인, 기준 중위소득 150% 이하');
    expect(out).toContain('연매출 3억 원 이하 조건과 가구 기준 중위소득 200% 이하');
    expect(out).not.toContain('10월 9일부터 16일까지는');
    // 표기 수정으로 달라지는 문장은 한 건 — "월 한도는 20만 원 차이"(70만−50만 을 Writer 가 계산한 값, 장부에 없음). 예전엔 미추출로 지나갔고
    // "20만원" 이라고 썼다면 원래도 차단됐을 값이라 기존 정책과 같다(보고서에 별도 기록). 10월 9일 차단은 그대로.
    const norm = (t: string) => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const sentencesOf = (t: string) => norm(t).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 8);
    const removed = sentencesOf(plain(FX.draft017)).filter((s) => !norm(out).includes(s));
    expect(removed).toEqual([
      '기간은 2년, 월 한도는 20만 원 차이이므로 같은 상품처럼 비교하면 판단이 흔들립니다.',
      '10월 9일부터 16일까지는 출생연도 끝자리와 관계없이 신청할 수 있습니다.',
    ]);
    // 이제 제대로 추출되는 4자리 금액(6000만 원·7500만 원·3600만 원)은 장부와 맞아 남는다
    expect(out).toContain('총급여 6000만 원 초과 7500만 원 이하인 경우에는 기여금이 없다는 점을 계산에 넣습니다');
    // 명시된 가정 계산("월 50만 원씩 36개월 … 1800만 원")은 근거에 있어 남는다
    expect(out).toContain('매달 50만 원 납입이 가능한 경우에는 3년 원금이 1800만 원이 됩니다');
    expect(sanitizeFactUnsafeHtml('납입액의 12퍼센트 기여금', { ...view.evidence, subjectHint: '우대형' })).toBe('납입액의 12퍼센트 기여금');
    expect(status('<p>정부가 납입액의 37%를 지원합니다.</p>', view.evidence)).toBe('blocked');
    // 날짜 자체가 금지된 것은 아니다 — 별도 합성 근거가 뒷받침하면 통과
    const dated = buildValidationEvidence([{ ...items[0], id: 'E99', cleanedText: `${items[0].cleanedText}\n금융위원회는 10월 9일부터 16일까지 출생연도와 관계없이 신청을 받는다.` }], { context: '', provider: 'Naver Grounding', trustLevel: 'weak' });
    expect(status('<p>10월 9일부터 16일까지는 출생연도 끝자리와 관계없이 신청할 수 있습니다.</p>', dated.evidence)).toBe('passed');
  });
});
