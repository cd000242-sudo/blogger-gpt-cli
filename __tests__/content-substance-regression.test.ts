/**
 * v3.8.374 회귀 테스트 — 본문 실속 관련 개별 수정 4건
 *
 * 1. sanitizePromptLeaks: 회피 문장을 "공식 사이트에서 확인" 필러로 치환하지 않고 삭제
 * 2. applyCasualTransform: '습니다.' → 어간 모음에 따라 '아요./어요.' (좋습니다→좋아요)
 * 3. classifyIntentFromSignals: 수집된 실제 질문에서 검색 의도 도출
 * 4. detectSeoPluginsFromNamespaces: REST namespaces로 SEO 플러그인 판정
 */

import { sanitizePromptLeaks, applyCasualTransform, setActiveToneStyle } from '../src/core/final/generation';
import {
  classifyIntent,
  classifyIntentFromSignals,
  buildIntentPromptBlock,
} from '../src/core/search-intent-classifier';
import { detectSeoPluginsFromNamespaces } from '../src/wordpress/wordpress-api';

describe('sanitizePromptLeaks — 회피 문장은 치환이 아니라 삭제 (v3.8.374)', () => {
  it('"제공된 자료에는 …않아요"를 공식 사이트 안내로 치환하지 않는다', () => {
    const input = '<p>지원금은 얼마인가요? 제공된 참고 자료에는 정확한 금액이 제시되지 않았어요.</p>';
    const out = sanitizePromptLeaks(input);
    expect(out).not.toContain('공식 사이트에서 확인');
    expect(out).not.toContain('제시되지 않았어요');
  });

  it('"본문 근거만으로는 …어렵습니다"도 필러를 남기지 않는다', () => {
    const input = '<p>본문 근거만으로는 정확한 기준을 판단하기 어렵습니다.</p>';
    const out = sanitizePromptLeaks(input);
    expect(out).not.toContain('공식 안내');
    expect(out).not.toContain('근거만으로는');
  });

  it('회피 문장만 있던 단락은 빈 <p>로 남지 않는다', () => {
    const input = '<p>제공된 자료에는 나와 있지 않아요.</p>';
    expect(sanitizePromptLeaks(input).trim()).toBe('');
  });

  it('정상 문장은 건드리지 않는다', () => {
    const input = '<p>지원금은 월 30만 원이고 신청은 복지로에서 합니다.</p>';
    expect(sanitizePromptLeaks(input)).toBe(input);
  });
});

describe('applyCasualTransform — 모음조화 (v3.8.374)', () => {
  beforeEach(() => setActiveToneStyle('friendly'));
  afterEach(() => setActiveToneStyle('professional'));

  it('양성모음 어간은 "아요"가 된다 (좋습니다 → 좋아요)', () => {
    expect(applyCasualTransform('이 방법이 더 좋습니다.')).toBe('이 방법이 더 좋아요.');
  });

  it('많습니다 → 많아요', () => {
    expect(applyCasualTransform('혜택이 많습니다.')).toBe('혜택이 많아요.');
  });

  it('음성모음 어간은 "어요"를 유지한다 (있습니다 → 있어요)', () => {
    expect(applyCasualTransform('조건이 있습니다.')).toBe('조건이 있어요.');
  });

  it('없습니다 → 없어요', () => {
    expect(applyCasualTransform('제한이 없습니다.')).toBe('제한이 없어요.');
  });

  it('합니다 → 해요, 입니다 → 이에요는 유지된다', () => {
    expect(applyCasualTransform('신청을 합니다.')).toBe('신청을 해요.');
    expect(applyCasualTransform('대상은 청년입니다.')).toBe('대상은 청년이에요.');
  });

  it('professional 톤에서는 변환하지 않는다', () => {
    setActiveToneStyle('professional');
    expect(applyCasualTransform('이 방법이 더 좋습니다.')).toBe('이 방법이 더 좋습니다.');
  });
});

describe('classifyIntentFromSignals — 실제 질문 기반 의도 도출 (v3.8.374)', () => {
  it('신호가 없으면 기존 키워드 분류로 폴백한다', () => {
    expect(classifyIntentFromSignals('청년 지원금 신청 방법')).toBe(classifyIntent('청년 지원금 신청 방법'));
  });

  it('한정자 없는 키워드는 여전히 informational 기본값이다 (기존 동작)', () => {
    expect(classifyIntent('시애틀 공항 다운타운')).toBe('informational');
  });

  it('수집된 질문이 비교형이면 investigational로 뒤집힌다', () => {
    const intent = classifyIntentFromSignals('시애틀 공항 다운타운', {
      userQuestions: [
        '시애틀 공항에서 우버랑 라이트레일 중 뭐가 더 나은가요?',
        '링크 라이트레일과 택시 비교해주세요',
        '어떤게 더 편한가요 추천 부탁드려요',
      ],
    });
    expect(intent).toBe('investigational');
  });

  it('수집된 질문이 가격/구매형이면 transactional로 뒤집힌다', () => {
    const intent = classifyIntentFromSignals('시애틀 공항 다운타운', {
      userQuestions: [
        '시애틀 공항 택시 가격 얼마인가요?',
        '라이트레일 최저가 티켓 구매 어디서 하나요?',
        '할인 쿠폰 있나요?',
      ],
      searchQueries: ['시애틀 택시 가격', '시애틀 라이트레일 할인'],
    });
    expect(intent).toBe('transactional');
  });

  it('빈 배열은 신호 없음으로 취급한다', () => {
    expect(classifyIntentFromSignals('연말정산 방법', { userQuestions: [], searchQueries: [] }))
      .toBe(classifyIntent('연말정산 방법'));
  });

  it('프롬프트 블록이 판정 근거를 표기한다', () => {
    const withSignals = buildIntentPromptBlock('시애틀 공항 다운타운', {
      userQuestions: ['우버랑 라이트레일 비교해주세요'],
      searchQueries: ['시애틀 교통'],
    });
    expect(withSignals).toContain('실제 검색자 질문 1개 + 검색어 1개 기반');

    const withoutSignals = buildIntentPromptBlock('시애틀 공항 다운타운');
    expect(withoutSignals).toContain('키워드 패턴 기반');
  });
});

describe('mode-dispatcher — [주제] 자리표시자 미치환 (v3.8.374)', () => {
  // dispatchMode는 플러그인 등록이 선행되어야 한다
  beforeAll(() => {
    require('../src/core/content-modes/register-all');
  });

  const MODES = ['external', 'adsense', 'internal'];

  it.each(MODES)('%s 모드의 섹션 프롬프트에 자리표시자가 남지 않는다', (mode) => {
    const { dispatchMode } = require('../src/core/final/mode-dispatcher');
    const result = dispatchMode(mode, '전기차 보조금', {});
    const block = String(result?.sectionPromptBlock || '');
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/\[주제\]|\[소주제\]|\[제품명\]|\[실전 경험\]/);
  });

  it('"[주제]란" 조사를 받침에 맞게 치환한다 (보조금 → 보조금이란)', () => {
    const { dispatchMode } = require('../src/core/final/mode-dispatcher');
    const block = String(dispatchMode('external', '전기차 보조금', {})?.sectionPromptBlock || '');
    expect(block).toContain('전기차 보조금이란');
    expect(block).not.toContain('전기차 보조금란');
  });

  it('받침 없는 키워드는 "란"을 쓴다 (그리스 → 그리스란)', () => {
    const { dispatchMode } = require('../src/core/final/mode-dispatcher');
    const block = String(dispatchMode('external', '그리스', {})?.sectionPromptBlock || '');
    expect(block).toContain('그리스란');
    expect(block).not.toContain('그리스이란');
  });
});

describe('buildIntentPromptBlock — 아키타입 자리표시자 (v3.8.374)', () => {
  it('아키타입의 [주제]가 키워드로 치환된다', () => {
    const block = buildIntentPromptBlock('전기차 보조금');
    expect(block).not.toMatch(/\[주제\]|\[제품명\]/);
    expect(block).toContain('전기차 보조금');
  });

  it('아키타입 문구 복사 금지를 명시한다', () => {
    expect(buildIntentPromptBlock('전기차 보조금')).toContain('그대로 복사하지 마세요');
  });
});

describe('detectSeoPluginsFromNamespaces — SEO 플러그인 감지 (v3.8.374)', () => {
  it('yoast/v1 네임스페이스로 Yoast를 감지한다 (leadernam.com 실측 형태)', () => {
    const namespaces = ['oembed/1.0', 'contact-form-7/v1', 'yoast/v1', 'wp/v2', 'wp-site-health/v1'];
    expect(detectSeoPluginsFromNamespaces(namespaces)).toEqual(['yoast']);
  });

  it('rankmath/v1 네임스페이스로 Rank Math를 감지한다', () => {
    expect(detectSeoPluginsFromNamespaces(['wp/v2', 'rankmath/v1'])).toEqual(['rankmath']);
  });

  it('두 플러그인이 모두 있으면 둘 다 반환한다', () => {
    const found = detectSeoPluginsFromNamespaces(['yoast/v1', 'rankmath/v1', 'wp/v2']);
    expect(found).toContain('yoast');
    expect(found).toContain('rankmath');
  });

  it('SEO 플러그인이 없으면 빈 배열 (= 전체 키 전송 폴백)', () => {
    expect(detectSeoPluginsFromNamespaces(['wp/v2', 'oembed/1.0'])).toEqual([]);
  });

  it('잘못된 입력에도 빈 배열을 반환한다', () => {
    expect(detectSeoPluginsFromNamespaces(null)).toEqual([]);
    expect(detectSeoPluginsFromNamespaces(undefined)).toEqual([]);
    expect(detectSeoPluginsFromNamespaces('yoast/v1')).toEqual([]);
    expect(detectSeoPluginsFromNamespaces([123, null, 'yoast/v1'])).toEqual(['yoast']);
  });

  it('부분 문자열에 오탐하지 않는다', () => {
    expect(detectSeoPluginsFromNamespaces(['my-yoast-helper/v1', 'notrankmath/v2'])).toEqual([]);
  });
});
