/**
 * v3.8.468 — 제목 상투어 · 키워드 중복 · 설정 제공자 무시
 *
 * 사용자 지적: "제목도 신경써서 나와야할텐데" · "환경변수를 이용하지".
 *
 * ## 제목 — 실측으로 드러난 것 (2026-08-06, 같은 키워드 3편)
 *   "…신청조건 서류부터 만기 해지까지 완벽 가이드 ✅"
 *   "…신청조건 서류부터 만기해지까지 3단계 ✅"
 *   "…신청조건 서류부터 만기 해지까지 핵심 정리 ✅"
 * 셋이 12자를 통째로 공유했고 꼬리만 달랐다. 그리고
 *   "전기요금 절약 꿀팁 1인 가구 에어컨 선풍기 전기요금 절약 방법 💡"
 * 는 키워드가 두 번 들어갔다.
 *
 * 원인은 프롬프트의 아키타입 목록이었다 — 모델에게 "OO 완벽 가이드",
 * "OO 핵심 정리", "OO 총정리", "OO 꿀팁 모음" 을 **본보기로 보여주고** 있었다.
 * 모든 사용자가 같은 목록을 보니 제목이 그 몇 개로 수렴한다.
 */
import * as fs from 'fs';
import { blockBetween } from './helpers/source-block';
import * as path from 'path';
import { stripTitleCliches, dedupeKeywordInTitle, enforceTitleLength } from '../src/core/final/generation';

const gen = fs.readFileSync(path.join(__dirname, '..', 'src/core/final/generation.ts'), 'utf-8');
const main = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf-8');

describe('① 제목 본보기에서 상투어를 걷어냈다', () => {
  // v3.8.485: 목록이 title-archetypes.ts 로 옮겨갔다(에이전트 모드와 공유).
  //   보장 내용은 그대로다 — 본보기에 상투어가 없어야 한다.
  const archetypes = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src/core/final/title-archetypes.ts'), 'utf-8',
  ) as string;

  it('⭐⭐ 아키타입이 상투어 예시를 더 이상 보여주지 않는다', () => {
    const block = blockBetween(archetypes, 'return [', '];');
    expect(block.length).toBeGreaterThan(100);
    for (const cliche of ['완벽 가이드', '핵심 정리', '총정리', '꿀팁 모음', '한눈에 보는']) {
      expect(block).not.toContain(cliche);
    }
  });

  it('⭐⭐ 형태만 알려주고 낱말은 글에서 뽑게 한다', () => {
    const block = blockBetween(archetypes, 'return [', '];');
    expect(block).toContain('hint:');
    expect(block).not.toContain('pattern:');
  });

  it('⭐⭐ 프롬프트가 상투어를 명시적으로 금지한다', () => {
    expect(gen).toContain('아래 표현은 쓰지 마세요');
    expect(gen).toContain('키워드는 제목에 **한 번만**');
  });

  it('⭐ 이모지를 강제하지 않는다 (모든 글이 같은 자리에 달면 기계 티가 난다)', () => {
    expect(gen).not.toContain('이모지 1개 필수 포함');
  });
});

describe('② 후처리가 실제로 걸러낸다 (프롬프트만으로는 새어 나온다)', () => {
  it('⭐⭐ 실측된 제목에서 상투어가 빠진다', () => {
    expect(stripTitleCliches('2026년 청년내일저축계좌 신청조건 서류부터 만기 해지까지 완벽 가이드 ✅'))
      .toBe('2026년 청년내일저축계좌 신청조건 서류부터 만기 해지까지 ✅');
    expect(stripTitleCliches('전기요금 절약 방법 에어컨 선풍기 조합과 고효율 가전 꿀팁 💡'))
      .toBe('전기요금 절약 방법 에어컨 선풍기 조합과 고효율 가전 💡');
  });

  it('⭐⭐ 키워드가 두 번 들어가면 뒤쪽을 지운다 (앞쪽이 검색에 유리하다)', () => {
    expect(dedupeKeywordInTitle('전기요금 절약 꿀팁 1인 가구 에어컨 선풍기 전기요금 절약 방법 💡', '전기요금 절약'))
      .toBe('전기요금 절약 꿀팁 1인 가구 에어컨 선풍기 방법 💡');
  });

  it('⭐⭐ 지우고 나면 제목 구실을 못 할 때는 손대지 않는다', () => {
    // 제목을 망가뜨리느니 상투어가 붙은 게 낫다
    expect(stripTitleCliches('청년내일저축계좌 총정리')).toBe('청년내일저축계좌 총정리');
    expect(dedupeKeywordInTitle('전기요금 절약 전기요금 절약', '전기요금 절약')).toBe('전기요금 절약 전기요금 절약');
  });

  it('⭐ 상투어가 없으면 그대로 둔다', () => {
    const clean = '2026년 청년내일저축계좌 소득 기준 최소 얼마부터일까';
    expect(stripTitleCliches(clean)).toBe(clean);
    expect(dedupeKeywordInTitle(clean, '청년내일저축계좌')).toBe(clean);
  });

  it('⭐ 빈 값·짧은 키워드에도 안전하다', () => {
    expect(stripTitleCliches('')).toBe('');
    expect(dedupeKeywordInTitle('제목', '')).toBe('제목');
    expect(dedupeKeywordInTitle('가가 가가 가가', '가가')).toBe('가가 가가 가가'); // 4자 미만 키워드는 무시
  });
});

describe('③ 설정 제공자가 무시되던 문제', () => {
  it('⭐⭐ 앱 시작 때 설정을 환경변수로 올린다', () => {
    expect(main).toContain('설정 ${applied}개를 환경변수로 반영');
    expect(main).toContain("loadEnvFromFile");
  });

  it('⭐⭐ 이미 있는 환경변수는 덮지 않는다 (터미널 값이 더 명시적인 의사표시다)', () => {
    const block = main.slice(
      main.indexOf('설정을 **앱 시작 때 한 번 process.env 로 올린다.**'),
      main.indexOf('설정 → 환경변수 반영 실패'),
    );
    expect(block).toContain('if (process.env[key] !== undefined');
    expect(block).toContain('continue;');
  });

  it('⭐ 설정을 못 읽어도 앱이 뜬다', () => {
    const block = main.slice(
      main.indexOf('설정을 **앱 시작 때 한 번 process.env 로 올린다.**'),
      main.indexOf('설정 → 환경변수 반영 실패') + 200,
    );
    expect(block).toContain('catch');
  });
});

/**
 * ④ 상위노출 리서치 반영 (2026-08-06)
 *
 * · 구글은 제목의 60~76% 를 스스로 다시 쓴다. 가장 큰 이유가 **길이·키워드 반복·상투어** 셋이다.
 * · 구글·네이버 모두 제목 **앞부분**의 말에 더 큰 가중치를 준다.
 * · 네이버 D.I.A. 는 제목만으로 검색 의도가 드러나는지를 본다.
 *
 * 예전 규칙은 "25~45자" 에 50자에서 `...` 로 잘랐다 — 한글 기준으로 검색 결과에서
 * 잘리는 길이고, 말줄임표가 붙으면 미완성으로 보여 재작성을 더 부른다.
 */
describe('④ 길이와 위치 — 검색 결과에 맞춘다', () => {
  it('⭐⭐ 40자를 넘지 않는다', () => {
    const long = '2026년 청년내일저축계좌 신청조건 서류부터 만기 해지까지 자세히 알아보는 안내문';
    expect(long.length).toBeGreaterThan(40);
    expect(enforceTitleLength(long, 40).length).toBeLessThanOrEqual(40);
  });

  it('⭐⭐ 말줄임표를 붙이지 않는다 (미완성으로 보이면 구글이 다시 쓴다)', () => {
    expect(enforceTitleLength('가'.repeat(60), 40)).not.toContain('...');
    expect(enforceTitleLength('가나 다라 마바 사아 자차 카타 파하 가나 다라 마바', 40)).not.toContain('…');
  });

  it('⭐⭐ 낱말 중간을 자르지 않는다', () => {
    const t = '2026년 청년내일저축계좌 신청조건 서류부터 만기 해지까지 확인하세요';
    const out = enforceTitleLength(t, 40);
    // 잘린 끝이 원문의 낱말 경계와 맞아야 한다
    expect(t.startsWith(out)).toBe(true);
    expect(out.endsWith(' ')).toBe(false);
  });

  it('⭐ 짧은 제목은 손대지 않는다', () => {
    const ok = '2026년 청년내일저축계좌 소득 기준 최소 얼마부터일까';
    expect(enforceTitleLength(ok, 40)).toBe(ok);
  });

  it('⭐⭐ 전체 파이프라인 — 실측 제목이 규격 안으로 들어온다', () => {
    const run = (t: string, kw: string) =>
      enforceTitleLength(dedupeKeywordInTitle(stripTitleCliches(t), kw), 40);

    const a = run('2026년 청년내일저축계좌 신청조건 서류부터 만기 해지까지 완벽 가이드 ✅', '청년내일저축계좌');
    expect(a.length).toBeLessThanOrEqual(40);
    expect(a).not.toContain('완벽 가이드');

    const b = run('전기요금 절약 꿀팁 1인 가구 에어컨 선풍기 전기요금 절약 방법 💡', '전기요금 절약');
    expect(b.length).toBeLessThanOrEqual(40);
    // 키워드가 한 번만, 그리고 맨 앞에
    expect(b.indexOf('전기요금 절약')).toBe(0);
    expect(b.split('전기요금 절약').length - 1).toBe(1);
  });
});

describe('⑤ 프롬프트가 리서치 결과를 담고 있다', () => {
  it('⭐⭐ 길이·키워드 위치·검색 의도 규칙이 들어 있다', () => {
    expect(gen).toContain('25~35자');
    expect(gen).toContain('키워드를 앞쪽에');
    expect(gen).toContain('검색 의도');
    // 예전의 느슨한 규칙이 남아 있으면 안 된다
    expect(gen).not.toContain('제목 길이: 25~45자');
  });
});
