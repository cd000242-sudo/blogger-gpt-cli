/**
 * v3.8.769 - A tag must never become "object Object".
 *
 * Field report (2026-11-10, leadernam.com post 1): the published post carried the tag
 * "object Object". Evidence: the job's payload.json has keywords = [{ keyword, title }]
 * (objects, not strings). src/core/index.ts and tistory-publisher.ts did String(item) on
 * each entry -> "[object Object]" (15 chars, under the 20-char limit), and normalizeTagName
 * then turned the brackets into spaces -> "object Object", which passes every filter.
 */
import * as fs from 'fs';
import * as path from 'path';
import { normalizeTagName, sanitizeTagNames, tagTextOf, tagTextsFromBucket } from '../src/core/tag-hygiene';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('tagTextOf - 후보 하나에서 글자만 꺼낸다', () => {
  test('문자열은 그대로', () => {
    expect(tagTextOf('인천 지원금')).toBe('인천 지원금');
  });

  test('{ keyword, title } 객체는 keyword 를 쓴다 (실제 payload 모양)', () => {
    expect(tagTextOf({ keyword: '인천 산후조리원 지원금', title: null })).toBe('인천 산후조리원 지원금');
  });

  test.each([
    [{ name: '이름형' }, '이름형'],
    [{ tag: '태그형' }, '태그형'],
    [{ label: '라벨형' }, '라벨형'],
    [{ text: '글자형' }, '글자형'],
  ])('%j -> %s', (input, expected) => {
    expect(tagTextOf(input)).toBe(expected);
  });

  test('글자를 꺼낼 수 없는 객체는 빈 글자 - "[object Object]" 가 되지 않는다', () => {
    expect(tagTextOf({})).toBe('');
    expect(tagTextOf({ id: 3 })).toBe('');
    expect(tagTextOf({ keyword: null, title: null })).toBe('');
    expect(tagTextOf([])).toBe('');
    expect(tagTextOf(null)).toBe('');
    expect(tagTextOf(undefined)).toBe('');
  });
});

describe('tagTextsFromBucket - 칸 하나(배열·객체·문자열)에서 후보 글자 목록', () => {
  test('객체 배열 - 실제 payload.keywords', () => {
    expect(tagTextsFromBucket([{ keyword: '인천 산후조리원 지원금 자격조건', title: null }]))
      .toEqual(['인천 산후조리원 지원금 자격조건']);
  });

  test('문자열 배열은 그대로', () => {
    expect(tagTextsFromBucket(['가나다', '라마바'])).toEqual(['가나다', '라마바']);
  });

  test('쉼표·#·줄바꿈으로 이어진 문자열은 나눈다', () => {
    // "a,#b" leaves an empty piece between "," and "#"; callers drop empties
    expect(tagTextsFromBucket('가나다,#라마바\n사아자').filter(Boolean)).toEqual(['가나다', '라마바', '사아자']);
  });

  test('객체 하나가 통째로 와도 글자만 꺼낸다', () => {
    expect(tagTextsFromBucket({ keyword: '단일 객체' })).toEqual(['단일 객체']);
  });

  test('비어 있으면 빈 목록', () => {
    expect(tagTextsFromBucket(undefined)).toEqual([]);
    expect(tagTextsFromBucket(null)).toEqual([]);
    expect(tagTextsFromBucket('')).toEqual([]);
  });
});

describe('sanitizeTagNames / normalizeTagName - 마지막 방어선', () => {
  test('객체는 태그가 되지 않는다', () => {
    expect(normalizeTagName({})).toBeNull();
    expect(sanitizeTagNames([{}, { id: 1 }])).toEqual([]);
  });

  test('객체에서 이름을 꺼내 정상 태그로 만든다', () => {
    expect(sanitizeTagNames([{ keyword: '청년월세지원', title: null }])).toEqual(['청년월세지원']);
  });

  test('이미 글자가 되어 버린 "[object Object]" 도 거른다', () => {
    expect(normalizeTagName('[object Object]')).toBeNull();
    expect(normalizeTagName('object Object')).toBeNull();
    expect(sanitizeTagNames(['[object Object]', '실손보험'])).toEqual(['실손보험']);
  });
});

describe('발행 경로 연결', () => {
  test('워드프레스 발행 경로(core/index.ts)가 객체를 String() 으로 바꾸지 않는다', () => {
    const src = read('src/core/index.ts');
    expect(src).toContain('tagTextsFromBucket');
    expect(src).not.toMatch(/Array\.isArray\(bucket\) \? bucket : String\(bucket\)/);
  });

  test('티스토리 발행 경로도 같은 도우미를 쓴다', () => {
    const src = read('src/tistory/tistory-publisher.ts');
    expect(src).toContain('tagTextsFromBucket');
    expect(src).not.toMatch(/Array\.isArray\(candidate\)\s*\?\s*candidate\s*:\s*String\(candidate\)/);
  });
});
