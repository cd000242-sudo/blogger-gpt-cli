/**
 * v3.8.471 — CTA 를 홈페이지가 아니라 "행동하는 화면" 으로
 *
 * 사장님 요구:
 *   "코레일이라고 코레일사이트만 거는게아니라 코레일사이트에서 예약을 바로할수있는
 *    링크로 걸어줘야되 막상 사이트갓는데 어떻게 하는지 모르자나"
 *   "실업급여같은것도 고용24에 그냥 가도록하는게아니라 고용24에서 어디로 가야
 *    실업급여를 신청을할수있는지 … 찾아서 연동해줘야지"
 *   "단, 오류나 없는 페이지는 절대 나오면 안 되고"
 *
 * ## 원인은 검색어 한 줄이었다
 * generation.ts 가 구글에 물어보는 말이 `"${keyword} 공식 홈페이지"` 였다.
 * 홈페이지를 달라고 했으니 홈페이지가 온다. 카탈로그 197개도 전부 홈 주소다.
 * (실측: letskorail.com 은 korail.com **홈으로 리다이렉트**된다)
 *
 * ## 고치는 방법
 * 키워드에서 사람이 하려는 행동을 읽어내고, 그 행동을 검색어에 넣는다.
 *   "실업급여"  → 신청  → "실업급여 온라인 신청 바로가기"
 *   "KTX 할인"  → 예매  → "KTX 예매 바로가기"
 * 살아있는지는 기존 validate-cta-url 이 확인한다(404·에러페이지·리다이렉트 차단).
 * 딥링크가 검증에 실패하면 홈페이지로 물러난다 — 죽은 딥링크보다 살아있는 홈이 낫다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import { detectActionIntent, buildActionQuery, ACTION_INTENTS } from '../src/cta/action-intent';

const generation = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/generation.ts'), 'utf-8',
);

describe('① 키워드에서 하려는 행동을 읽는다', () => {
  it('⭐⭐ 말에 행동이 드러나 있으면 그대로 읽는다', () => {
    expect(detectActionIntent('실업급여 신청 방법')).toBe('신청');
    expect(detectActionIntent('KTX 예매 취소 수수료')).toBe('예매');
    expect(detectActionIntent('등본 인터넷 발급')).toBe('발급');
    expect(detectActionIntent('건강보험 자격득실확인서 조회')).toBe('조회');
  });

  it('⭐⭐ 행동어가 없어도 주제로 추론한다 (사장님: "추론을 해서")', () => {
    // "실업급여" 만 검색해도 사람이 원하는 건 신청 화면이다
    expect(detectActionIntent('실업급여')).toBe('신청');
    expect(detectActionIntent('SRT 시간표')).toBe('예매');
    expect(detectActionIntent('국민내일배움카드')).toBe('신청');
  });

  it('⭐⭐ 행동을 못 읽으면 null 이다 (억지로 붙이면 엉뚱한 데로 보낸다)', () => {
    expect(detectActionIntent('강아지 슬개골 탈구 증상')).toBeNull();
    expect(detectActionIntent('제주도 3박4일 코스')).toBeNull();
  });

  it('⭐ 쇼핑성 키워드에 정부 행동을 붙이지 않는다', () => {
    expect(detectActionIntent('무선 이어폰 추천')).toBeNull();
  });
});

describe('② 검색어를 행동 화면으로 향하게 한다', () => {
  it('⭐⭐ 행동이 읽히면 홈페이지가 아니라 그 화면을 찾는다', () => {
    const q = buildActionQuery('실업급여', '신청');
    expect(q).toContain('실업급여');
    expect(q).toContain('신청');
    expect(q).not.toContain('공식 홈페이지');
  });

  it('⭐⭐ 행동을 못 읽으면 예전대로 공식 사이트를 찾는다 (엉뚱한 링크보다 낫다)', () => {
    expect(buildActionQuery('강아지 슬개골 탈구', null)).toContain('공식');
  });

  it('⭐⭐ 키워드에 이미 든 낱말을 두 번 넣지 않는다', () => {
    // "코레일 예매 예매 바로가기" 처럼 겹치면 검색 결과가 엉킨다
    const q = buildActionQuery('코레일 예매', '예매');
    expect(q.match(/예매/g)).toHaveLength(1);
    expect(buildActionQuery('주민등록등본 발급', '발급').match(/발급/g)).toHaveLength(1);
  });

  it('⭐ 낱말을 다 걷어내도 최소한 바로가기는 남는다 (빈 검색어 방지)', () => {
    expect(buildActionQuery('온라인 신청 바로가기', '신청').trim()).not.toBe('온라인 신청 바로가기');
    expect(buildActionQuery('온라인 신청 바로가기', '신청')).toContain('바로가기');
  });

  it('⭐ 행동별로 검색어가 실제로 달라진다', () => {
    const queries = ACTION_INTENTS.map((a) => buildActionQuery('테스트', a));
    expect(new Set(queries).size).toBe(ACTION_INTENTS.length);
  });
});

describe('③ 발행 경로에 실제로 배선돼 있다', () => {
  it('⭐⭐ generation 이 더 이상 "공식 홈페이지" 를 통째로 박아 쓰지 않는다', () => {
    const code = generation.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(code).not.toContain('${keyword} 공식 홈페이지`');
  });

  it('⭐⭐ 행동 의도 함수를 실제로 부른다 (안 부르면 조용히 무효)', () => {
    expect(generation).toContain('detectActionIntent(');
    expect(generation).toContain('buildActionQuery(');
  });

  it('⭐⭐ 딥링크가 죽으면 홈으로 물러난다 (사장님: "오류나 없는 페이지는 절대 안 됨")', () => {
    // 고정 길이로 자르면 코드가 길어질 때 범위 밖으로 밀린다 - 경계로 자른다
    const block = blockBetween(
      generation,
      'async function searchOfficialSite',
      'export function applySmartLinkToContent',
    );
    expect(block.length).toBeGreaterThan(500);
    expect(block).toContain('validateCtaUrl');
    expect(block).toContain('폴백');
  });

  it('⭐⭐ 폴백이 무한 재귀로 돌지 않는다', () => {
    // 폴백이 자기를 다시 부르는데, 행동 의도를 안 끄면 같은 의도가 또 잡혀 무한히 돈다.
    // 두 번째 호출은 skipActionIntent=true 로 들어가 반드시 한 번에 끝나야 한다.
    expect(generation).toContain('skipActionIntent?: boolean');
    expect(generation).toContain("(contentMode === 'shopping' || skipActionIntent) ? null : detectActionIntent(keyword)");
    // v3.8.501: 글 맥락(articleText)이 뒤에 붙었다. 재귀를 끝내는 건 5번째 인자 true 다 —
    // 그 자리가 true 인지만 본다. 뒤에 인자가 더 붙어도 종료 보장은 그대로다.
    expect(generation).toMatch(
      /searchOfficialSite\(keyword, googleCseKey, googleCseCx, contentMode, true(?:,[^)]*)?\)/,
    );
  });
});
