/**
 * 스마트 CTA 라우터 테스트 (v3.8.538)
 *
 * 사장님 요구: "어떤글이던지 cta를 제대로 가져오고 소제목이나 본문 상황에맞게
 * 그사이트로 가게끔. api로 스마트하게."
 *
 * 설계 계약:
 *  ① AI 는 기관 "이름"만 정한다 — URL 이 섞여 오면 통째로 기각 (날조 방어)
 *  ② 실패·타임아웃·낮은 확신 → null → 기존 경로 그대로 (발행 절대 안 막힘)
 *  ③ 주소는 기존 CSE+검증 파이프만 만든다 — 스마트 결과는 검색어와 버튼 문구까지만
 *  ④ 쇼핑모드·재귀 폴백에서는 개입하지 않는다
 */

const callGeminiWithRetry = jest.fn();
jest.mock('../src/core/final/gemini-engine', () => ({
  callGeminiWithRetry: (...args: unknown[]) => callGeminiWithRetry(...args),
}));

import { resolveSmartCtaTarget, clearSmartCtaCache } from '../src/cta/smart-cta';
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const genSrc = read('src/core/final/generation.ts');

beforeEach(() => {
  callGeminiWithRetry.mockReset();
  clearSmartCtaCache();
});

describe('① 정상 경로 — 이름과 행동을 정하고 검색어를 만든다', () => {
  it('⭐ 토지 글 → 토지이음 + 상황 맞춤 버튼 문구', async () => {
    callGeminiWithRetry.mockResolvedValue(
      '{"site":"토지이음","action":"토지이용계획 조회","buttonLabel":"토지이음에서 용도지역 조회","confidence":0.9}',
    );
    const r = await resolveSmartCtaTarget({ keyword: '고양 그린벨트 토지거래허가', articleHint: '1. 허가 기준 2. 불허 사유' });
    expect(r).toEqual({
      site: '토지이음',
      action: '토지이용계획 조회',
      buttonLabel: '토지이음에서 용도지역 조회',
      searchQuery: '토지이음 토지이용계획 조회',
    });
  });

  it('짧은 타임아웃 예산을 쓴다 — CTA 하나에 본문급 예산 금지', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"홈택스","action":"환급 조회","buttonLabel":"홈택스에서 환급 조회","confidence":0.8}');
    await resolveSmartCtaTarget({ keyword: '종합소득세 환급' });
    expect(callGeminiWithRetry).toHaveBeenCalledWith(expect.any(String), 1, { timeoutMs: 15_000 });
  });

  it('프롬프트가 본문 맥락과 날조 금지 규칙을 담는다', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"없음","confidence":0}');
    await resolveSmartCtaTarget({ keyword: 'k', articleHint: '소제목A 소제목B' });
    const prompt = String(callGeminiWithRetry.mock.calls[0]![0]);
    expect(prompt).toContain('소제목A 소제목B');
    expect(prompt).toContain('이름만');
    expect(prompt).toContain('지어내는 것이 최악');
  });
});

describe('② 날조·저확신 방어 — 의심스러우면 기존 경로로', () => {
  it('site 에 URL/도메인이 섞이면 기각', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"eum.go.kr","action":"조회","buttonLabel":"바로 조회","confidence":0.9}');
    expect(await resolveSmartCtaTarget({ keyword: '토지' })).toBeNull();
  });

  it('confidence < 0.6 이면 기각', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"토지이음","action":"조회","buttonLabel":"조회","confidence":0.5}');
    expect(await resolveSmartCtaTarget({ keyword: '토지2' })).toBeNull();
  });

  it('"없음"·파싱 실패·예외 전부 null — 발행은 계속된다', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"없음","confidence":0.9}');
    expect(await resolveSmartCtaTarget({ keyword: 'a' })).toBeNull();
    callGeminiWithRetry.mockResolvedValue('JSON 아님');
    expect(await resolveSmartCtaTarget({ keyword: 'b' })).toBeNull();
    callGeminiWithRetry.mockRejectedValue(new Error('timeout'));
    expect(await resolveSmartCtaTarget({ keyword: 'c' })).toBeNull();
  });

  it('쇼핑모드는 개입하지 않는다 — 상품 링크가 기관으로 바뀌면 안 된다', async () => {
    expect(await resolveSmartCtaTarget({ keyword: '전기레인지', contentMode: 'shopping' })).toBeNull();
    expect(callGeminiWithRetry).not.toHaveBeenCalled();
  });

  it('같은 키워드는 캐시로 1콜 — 연속발행 비용 방어', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"복지로","action":"신청","buttonLabel":"복지로에서 신청","confidence":0.8}');
    await resolveSmartCtaTarget({ keyword: '기초연금' });
    await resolveSmartCtaTarget({ keyword: '기초연금' });
    expect(callGeminiWithRetry).toHaveBeenCalledTimes(1);
  });
});

describe('③ 배선 — generation.ts 가 스마트 목적지를 실제로 쓴다', () => {
  it('searchOfficialSite 가 스마트 검색어를 우선하고, 재귀 폴백·쇼핑에선 안 부른다', () => {
    expect(genSrc).toContain("require('../../cta/smart-cta')");
    expect(genSrc).toContain('smartTarget?.searchQuery || buildActionQuery(keyword, actionIntent)');
    expect(genSrc).toMatch(/contentMode !== 'shopping' && !skipActionIntent/);
  });

  it('버튼 문구까지 상황 맞춤으로 흐른다 (smartLabel)', () => {
    expect(genSrc).toContain('smartLabel: smartTarget.buttonLabel');
    expect(genSrc).toContain('(officialLink as any).smartLabel');
  });

  it('주소는 여전히 검증 파이프만 만든다 — 스마트 결과에 url 필드가 없다', () => {
    const smartSrc = read('src/cta/smart-cta.ts');
    expect(smartSrc).not.toMatch(/url\s*:/); // SmartCtaTarget 에 url 없음
    expect(smartSrc).toContain('URL·도메인·주소를 절대 쓰지 마라');
  });
});
