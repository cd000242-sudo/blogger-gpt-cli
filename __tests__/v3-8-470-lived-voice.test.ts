/**
 * v3.8.470 — 어떤 모드든 "겪은 사람이 설명하듯" 나오게
 *
 * 사용자 요구:
 *   "경험을 사용자가 적는것보다 … 키워드를 보고 추론해서 경험으로 진짜 사람이
 *    설명하듯이 글이 나오게 해야되" · "3인칭으로 나오면 안 되고" ·
 *   "이게 어떤 모드든 이런식으로 나와야되"
 *
 * ## 재료는 이미 있었는데 버리고 있었다
 * content-crawler 가 지식인을 `Q. 질문\nA. 답변` 으로 통째로 수집하는데,
 * orchestration 은 `subheadings`(질문)만 꺼내 쓰고 **답변을 버렸다.**
 * 그 답변이 실제로 겪은 사람들이 쓴 내용이다 — "등본 때문에 반려됐다",
 * "2주라더니 한 달 걸렸다". 쇼핑 모드에는 상품 후기가 같은 역할을 한다.
 *
 * ## 지어내지는 않는다
 * "제가 3월 8일에 신청해서 2주 만에 받았습니다" 같은 1인칭 체험담은 만들지 않는다.
 * 검증 가능한 가짜 사실이고, 애드센스 심사·표시광고법 양쪽에서 문제가 된다.
 * 대신 **어디서 막히는지 아는 말투**로 쓴다 — 인용도 하지 않는다("누가 그러던데" 금지).
 *
 * 실측(2026-08-06, GPT):
 *   전: "청년내일저축계좌는 신청 전 본인이 해당 모집 공고의 대상인지 …"  ← 안내문
 *   후: "가장 먼저 등본 등 제출서류의 발급일과 유효기간을 확인하세요.
 *        내용이 맞아도 유효기간이 지나면 반려될 수 있어 …"              ← 아는 사람 말투
 */
import * as fs from 'fs';
import * as path from 'path';
import { extractLivedSignals, buildLivedVoiceBlock } from '../src/core/final/lived-voice';

const orchestration = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf-8',
);
const lived = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/lived-voice.ts'), 'utf-8',
);

const kin = (answer: string) => ({ source: 'naver-kin', content: `Q. 질문\nA. ${answer}` });

describe('① 실제로 막힌 지점을 뽑는다', () => {
  it('⭐⭐ 지식인 답변에서 막힘·기간·조건·금액을 분류해 뽑는다', () => {
    const signals = extractLivedSignals([
      kin('등본 유효기간 지나서 반려됐어요. 3개월 이내 발급분이어야 합니다. '
        + '소득이 애매한 경우에는 먼저 조회부터 해보세요. '
        + '보통 2주 정도 걸린다고 하는데 저는 한 달 넘게 걸렸습니다.'),
    ]);
    const kinds = new Set(signals.map((s) => s.kind));
    expect(signals.length).toBeGreaterThanOrEqual(3);
    expect(kinds.has('friction')).toBe(true);
    expect(kinds.has('duration')).toBe(true);
    expect(kinds.has('condition')).toBe(true);
  });

  it('⭐⭐ 질문이 아니라 답변에서 뽑는다 (질문은 이미 제목 재료로 쓴다)', () => {
    const signals = extractLivedSignals([
      { source: 'naver-kin', content: 'Q. 반려되면 어떻게 되나요 재신청 기간은\nA. 서류 보완하면 됩니다.' },
    ]);
    // 질문 쪽 문장이 신호로 잡히면 안 된다
    expect(signals.every((s) => !s.text.includes('반려되면 어떻게 되나요'))).toBe(true);
  });

  it('⭐⭐ 광고·인사말은 걸러낸다', () => {
    const signals = extractLivedSignals([
      kin('대출 상담 환영합니다 010-1234-5678. 채택 부탁드립니다. 도움이 되셨으면 좋겠습니다.'),
    ]);
    expect(signals).toHaveLength(0);
  });

  it('⭐ 링크·아이디가 섞인 줄은 버린다', () => {
    const signals = extractLivedSignals([kin('자세한 건 https://spam.example.com 에서 확인하세요 반려 조건 안내')]);
    expect(signals).toHaveLength(0);
  });

  it('⭐ 같은 내용이 여러 번 나와도 한 번만 쓴다', () => {
    const same = '등본 유효기간 때문에 반려됐어요.';
    const signals = extractLivedSignals([kin(same), kin(same), kin(same)]);
    expect(signals).toHaveLength(1);
  });
});

describe('② 어떤 모드든 재료가 들어간다', () => {
  it('⭐⭐ 쇼핑 모드 — 지식인이 없어도 상품 후기에서 뽑는다', () => {
    const signals = extractLivedSignals([], [
      { body: '설치는 10분 정도 걸렸습니다. 다만 벽에 붙이려면 별도 브라켓이 필요해요.' },
      { body: '소음이 있는 편이라 침실에 두는 경우에는 비추천합니다.' },
      { body: '가격은 12만원인데 이 정도면 괜찮은 것 같아요.' },
    ]);
    expect(signals.length).toBeGreaterThanOrEqual(3);
    expect(signals.some((s) => s.kind === 'cost')).toBe(true);
    expect(signals.some((s) => s.kind === 'condition')).toBe(true);
  });

  it('⭐⭐ 정보성 모드 — 후기가 없어도 지식인에서 뽑는다', () => {
    const signals = extractLivedSignals([kin('등본 때문에 반려됐어요.')], []);
    expect(signals.length).toBeGreaterThanOrEqual(1);
  });

  it('⭐⭐ orchestration 이 두 재료를 모두 넘긴다 (한쪽만 넘기면 그 모드가 밋밋해진다)', () => {
    expect(orchestration).toContain('extractLivedSignals(crawledPosts as any, livedReviews)');
    expect(orchestration).toContain('shoppingEnrichment?.reviews');
    expect(orchestration).toContain('affiliateProducts || [])[0]?.reviews');
  });

  it('⭐ 재료가 0이면 왜 그런지 로그로 남긴다 (조용히 밋밋해지면 원인을 못 찾는다)', () => {
    expect(orchestration).toContain('겪은 사람 말투 재료 없음');
    expect(orchestration).toContain('네이버 API 키를 넣으면');
  });
});

describe('③ 인용하지 않고, 겪은 척하지 않는다', () => {
  const block = buildLivedVoiceBlock(extractLivedSignals([kin('등본 때문에 반려됐어요. 2주 걸린다더니 한 달 넘었습니다.')]));

  it('⭐⭐ 3인칭 인용을 금지한다 (사용자: "3인칭으로 나오면 안 되고")', () => {
    expect(block).toContain('인용하지 마세요');
    expect(block).toContain('누가 그러던데');
    expect(block).toContain('많은 분들이');
  });

  it('⭐⭐ 1인칭 체험담 날조도 금지한다', () => {
    expect(block).toContain('제가 ~해봤는데');
    expect(block).toContain('겪지 않은 일을 겪은 것처럼');
  });

  it('⭐⭐ 목록에 없는 수치를 지어내지 말라고 못 박는다', () => {
    expect(block).toContain('없는** 수치·기간·금액을 새로 지어내지 마세요');
  });

  it('⭐⭐ 사람 글의 장치를 지시한다 (순서·조건·한계)', () => {
    expect(block).toContain('순서와 우선순위를 매기세요');
    expect(block).toContain('조건을 나누세요');
    expect(block).toContain('모르는 건 모른다고 하세요');
  });

  it('⭐⭐ 재료가 없으면 빈 문자열 (프롬프트가 이전과 완전히 같아진다)', () => {
    expect(buildLivedVoiceBlock([])).toBe('');
    expect(buildLivedVoiceBlock(extractLivedSignals([], []))).toBe('');
  });

  it('⭐⭐ 경험 메모가 없으면 겪은 척 금지 가드가 붙는다', () => {
    // v3.8.470: lived-voice 는 if/else 밖으로 나갔고, 가드는 else 안에 남는다
    const block = orchestration.slice(
      orchestration.indexOf('const expInput = normalizeExperience'),
      orchestration.indexOf("} catch (expErr"),
    );
    expect(block).toContain('NO_EXPERIENCE_GUARD');
    expect(block.indexOf('NO_EXPERIENCE_GUARD'))
      .toBeLessThan(block.indexOf('const livedSignals = extractLivedSignals'));
  });

  it('⭐ 모듈이 경험을 생성하지 않는다는 원칙을 문서로 남긴다', () => {
    expect(lived).toContain('겪지 않은 일을 겪은 것처럼 쓰지 않는다');
  });
});
