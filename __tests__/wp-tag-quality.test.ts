/**
 * WordPress auto tags - field report 2026-11-12 (posts published 11/9).
 *
 * Symptom: every post carried the tag "object Object", and the other tags were the title split on
 * spaces ("방법과", "예약하는", "직접").
 *
 * Root cause:
 *   1. src/core/index.ts padded the collected tags with raw title words, so the list was never empty.
 *   2. WordPressPublisher.publish() skips AI tag generation whenever ANY pre-generated tag exists,
 *      so the padding always blocked the AI. The only title fallback (extractTagsFallback) kept particles/verbs.
 *   3. (fixed in v3.8.769) payload.keywords = [{ keyword, title }] turned into "[object Object]".
 *
 * These tests call the pure helpers directly; the few source checks only pin the wiring.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  collectTagCandidates,
  completeTagsWithAi,
  extractTitleTagsFallback,
  isJunkTagText,
  mergeTagLists,
} from '../src/wordpress/wp-tag-utils';
import { normalizeUpdateExtras, resolveTagIds } from '../src/wordpress/wordpress-update-extras';
import { braceBlock } from './helpers/source-block';

jest.mock('../src/core/final/gemini-engine', () => ({ callGeminiWithRetry: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { callGeminiWithRetry } = require('../src/core/final/gemini-engine') as { callGeminiWithRetry: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WordPressPublisher } = require('../src/wordpress/wordpress-publisher');

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

const REPORTED_TITLES = [
  '자동차 종합검사 직접 예약하는 방법과 준비물 총정리',
  '스타링크 요금표 할인 받는 방법과 신청 안내',
  '근로장려금 기한 신청 지급일 확인하는 방법',
  '협의이혼 신청서 작성 방법과 절차 총정리',
];
const FORBIDDEN = ['직접', '예약하는', '방법과', '방법', '총정리', '안내', '확인하는', '받는'];

describe('1) 객체·쓰레기 글자는 태그 후보가 되지 못한다', () => {
  test.each(['[object Object]', 'object Object', 'Object object', 'undefined', 'null', 'NaN', '#null', '  undefined '])(
    'isJunkTagText(%j) = true', (value) => {
      expect(isJunkTagText(value)).toBe(true);
    });

  test.each(['실손보험', 'Object 지향', '널 포인터', 'nullable'])('isJunkTagText(%j) = false', (value) => {
    expect(isJunkTagText(value)).toBe(false);
  });

  test('실제 payload 모양 [{ keyword, title }] 에서 keyword 만 꺼낸다', () => {
    expect(collectTagCandidates([[{ keyword: '인천 산후조리원 지원금', title: null }]]))
      .toEqual(['인천 산후조리원 지원금']);
  });

  test('이미 글자가 되어 버린 "[object Object]" 는 문자열·배열·쉼표 목록 어디서든 버린다', () => {
    const out = collectTagCandidates([
      '[object Object]',
      ['object Object', 'undefined', '청년월세'],
      '[object Object],null,#지원금',
      [{}, { id: 3 }, [['중첩 배열']], true, null, undefined],
    ]);
    expect(out).toEqual(['청년월세', '지원금']);
    expect(out.join('|')).not.toMatch(/object|undefined|null/i);
  });

  test('숫자는 글자로, # 는 떼고, 중복·1글자·21글자 이상은 버린다', () => {
    expect(collectTagCandidates([[2026, '#연말정산', '연말정산', '가', '가'.repeat(21)]]))
      .toEqual(['2026', '연말정산']);
  });

  test('최대 10개까지만 모은다', () => {
    const many = Array.from({ length: 15 }, (_v, i) => `태그${i + 1}번`);
    expect(collectTagCandidates([many])).toHaveLength(10);
  });

  test('수정발행 경로(resolveTagIds)도 "object Object" 태그를 만들지 않는다', async () => {
    const created: string[] = [];
    const request = jest.fn(async (endpoint: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const name = JSON.parse(String(init.body)).name as string;
        created.push(name);
        return { ok: true, json: async () => ({ id: 77, name }) } as any;
      }
      return { ok: true, json: async () => [] } as any;
    });
    const extras = normalizeUpdateExtras({ tags: [{ keyword: '객체' } as any, '[object Object]', '실손보험'] });
    await resolveTagIds(request as any, extras.tags);
    expect(created).toEqual(['실손보험']);
  });
});

describe('2) 수집한 태그가 모자라도 제목 낱말로 채우지 않는다', () => {
  test('두 개만 모였으면 두 개만 돌려준다', () => {
    expect(collectTagCandidates([['근로장려금', '신청'], undefined, null])).toEqual(['근로장려금', '신청']);
  });

  test('아무것도 없으면 빈 목록 (index.ts 가 undefined 로 바꿔 넘긴다)', () => {
    expect(collectTagCandidates([undefined, null, '', [], {}])).toEqual([]);
  });

  test('core/index.ts 의 preGeneratedTags 블록은 제목을 쪼개 채우지 않고 수집 함수만 쓴다', () => {
    const src = read('src/core/index.ts');
    const block = braceBlock(src, 'preGeneratedTags: (() =>');
    expect(block).toContain('collectTagCandidates(');
    expect(block).not.toMatch(/\btitle\b/);
    expect(block).not.toMatch(/split\(\/\\s/);
    expect(block).toContain('collected.length > 0 ? collected : undefined');
  });
});

describe('3) 발행 쪽: 5개 미만이면 AI 태그를 합친다', () => {
  const five = ['가나다라', '마바사아', '자차카타', '파하갸냐', '댜랴먀뱌'];

  test('5개 이상이면 AI 를 부르지 않는다', async () => {
    const generate = jest.fn(async () => ['사용안함']);
    expect(await completeTagsWithAi(five, generate)).toEqual(five);
    expect(generate).not.toHaveBeenCalled();
  });

  test('2개만 왔으면 AI 를 한 번 불러 넘겨받은 것 먼저, 중복 없이 합친다', async () => {
    const generate = jest.fn(async () => ['연금 신청', '노령연금', '국민연금', '수급 자격', '노후 준비']);
    const out = await completeTagsWithAi(['국민연금', '지급일'], generate);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(out.slice(0, 2)).toEqual(['국민연금', '지급일']);
    expect(out).toEqual(expect.arrayContaining(['노령연금', '수급 자격', '노후 준비']));
    expect(new Set(out.map((t) => t.replace(/\s+/g, '').toLowerCase())).size).toBe(out.length);
  });

  test('합친 목록은 최대 8개', async () => {
    const ai = Array.from({ length: 8 }, (_v, i) => `AI태그${i + 1}번`);
    const out = await completeTagsWithAi(['하나둘', '셋넷다'], async () => ai);
    expect(out).toHaveLength(8);
    expect(out.slice(0, 2)).toEqual(['하나둘', '셋넷다']);
  });

  test('넘어온 게 없으면(undefined) AI 태그만 쓴다', async () => {
    expect(await completeTagsWithAi(undefined, async () => ['금융', '대출', '한도'])).toEqual(['금융', '대출', '한도']);
  });

  test('쓰레기가 섞인 5개는 5개로 치지 않는다 - 쓸 수 있는 것만 세어 AI 를 부른다', async () => {
    const generate = jest.fn(async () => ['보조태그']);
    const out = await completeTagsWithAi(['object Object', 'undefined', '가나다라', '마바사아', '자차카타'], generate);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(out).toEqual(['가나다라', '마바사아', '자차카타', '보조태그']);
  });

  test('AI 가 던지거나 쓰레기를 돌려줘도 발행은 멈추지 않는다', async () => {
    const warn = jest.fn();
    expect(await completeTagsWithAi(['가나다라'], async () => { throw new Error('엔진 없음'); }, warn)).toEqual(['가나다라']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await completeTagsWithAi(['가나다라'], async () => ['[object Object]', 'null'])).toEqual(['가나다라']);
  });

  test('mergeTagLists: 앞쪽 우선, 쓰레기 제거', () => {
    expect(mergeTagLists(['실손보험', 'undefined'], ['실손보험', '자동차보험'])).toEqual(['실손보험', '자동차보험']);
  });

  test('publish() 는 사전 태그 유무로 AI 를 건너뛰지 않고 completeTagsWithAi 를 거친다', () => {
    const src = read('src/wordpress/wordpress-publisher.ts');
    const block = braceBlock(src, /let tagIds: number\[\] = \[\];\s*try\s*\{/);
    expect(block).toContain('completeTagsWithAi(');
    expect(block).toContain('generateTagsSmart(');
    expect(block).not.toMatch(/options\.preGeneratedTags\.length\s*>\s*0/);
  });
});

describe('4) 제목 폴백은 조사·동사·뜻 없는 낱말을 태그로 쓰지 않는다', () => {
  test('신고 화면의 제목 꼴: 금지 낱말이 하나도 나오지 않는다', () => {
    for (const title of REPORTED_TITLES) {
      const tags = extractTitleTagsFallback(title);
      expect(tags.length).toBeGreaterThan(0);
      for (const bad of FORBIDDEN) expect(tags).not.toContain(bad);
      for (const tag of tags) expect(tag.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('자동차 제목에서는 명사만 남는다', () => {
    expect(extractTitleTagsFallback('자동차 종합검사 직접 예약하는 방법과 준비물 총정리'))
      .toEqual(['자동차', '종합검사', '준비물']);
  });

  test('나머지 신고 제목도 핵심 명사는 남는다', () => {
    expect(extractTitleTagsFallback(REPORTED_TITLES[1])).toEqual(['스타링크', '요금표', '할인', '신청']);
    expect(extractTitleTagsFallback(REPORTED_TITLES[2])).toEqual(['근로장려금', '기한', '신청', '지급일']);
    expect(extractTitleTagsFallback(REPORTED_TITLES[3])).toEqual(['협의이혼', '신청서', '작성', '절차']);
  });

  test('끝의 조사를 뗀다', () => {
    expect(extractTitleTagsFallback('스타링크는 요금표를 서울에서 신청서로')).toEqual(['스타링크', '요금표', '서울', '신청서']);
  });

  test('조사를 떼고 2글자 미만이 되면 버린다', () => {
    expect(extractTitleTagsFallback('집이 값은 책을')).toEqual([]);
  });

  test('명사 끝 글자가 조사처럼 보이는 낱말은 자르지 않는다', () => {
    expect(extractTitleTagsFallback('신용평가 청약제도 대출한도 고속도로')).toEqual(['신용평가', '청약제도', '대출한도', '고속도로']);
  });

  test('기호는 걷고 중복은 한 번만, 최대 8개, 빈 제목은 빈 목록', () => {
    expect(extractTitleTagsFallback('[속보] 연금! 연금, 연금?')).toEqual(['속보', '연금']);
    const long = Array.from({ length: 12 }, (_v, i) => `주제${i + 1}번`).join(' ');
    expect(extractTitleTagsFallback(long)).toHaveLength(8);
    expect(extractTitleTagsFallback('')).toEqual([]);
  });
});

describe('4b) 발행기 안의 AI 태그 생성·폴백 (엔진 호출은 가짜)', () => {
  const makePublisher = () => new WordPressPublisher({ siteUrl: 'https://example.com', username: 'u', applicationPassword: 'p' } as any);
  const title = REPORTED_TITLES[0];

  beforeEach(() => {
    callGeminiWithRetry.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  test('AI 가 3개 이상 돌려주면 그대로 쓴다', async () => {
    callGeminiWithRetry.mockResolvedValue('자동차 종합검사, 검사 예약, 검사 준비물, 자동차 검사소');
    const tags = await (makePublisher() as any).generateTagsSmart(title, '<p>본문</p>');
    expect(tags).toEqual(['자동차 종합검사', '검사 예약', '검사 준비물', '자동차 검사소']);
  });

  test('AI 호출이 실패하면 다듬은 제목 폴백을 쓴다 (예외를 던지지 않는다)', async () => {
    callGeminiWithRetry.mockRejectedValue(new Error('선택한 엔진 키가 없습니다'));
    const tags = await (makePublisher() as any).generateTagsSmart(title, '<p>본문</p>');
    expect(tags).toEqual(['자동차', '종합검사', '준비물']);
  });

  test('extractTagsFallback 은 순수 함수와 같은 결과', () => {
    expect((makePublisher() as any).extractTagsFallback(title)).toEqual(extractTitleTagsFallback(title));
  });

  test('조용한 엔진 바꿔치기 없이 callGeminiWithRetry 한 번만 부른다', async () => {
    callGeminiWithRetry.mockRejectedValue(new Error('실패'));
    await (makePublisher() as any).generateTagsSmart(title, '<p>본문</p>');
    expect(callGeminiWithRetry).toHaveBeenCalledTimes(1);
  });
});
