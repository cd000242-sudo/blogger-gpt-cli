/**
 * 글 목록에 임시·예약이 뜨는가 — v3.8.498
 *
 * 목록 조회가 발행글만 물어봐서 임시저장·예약발행 글이 통째로 안 보였다.
 * 조용히 빠지는 종류의 사고라 (에러도 안 나고 목록만 짧다) 소스 수준에서 못 박는다.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

describe('워드프레스 목록', () => {
  const src = read('src/wordpress/wordpress-posts.ts');

  it('임시(draft)·예약(future)을 함께 조회한다', () => {
    expect(src).toMatch(/LIST_STATUSES\s*=\s*'[^']*draft[^']*'/);
    expect(src).toMatch(/LIST_STATUSES\s*=\s*'[^']*future[^']*'/);
    expect(src).toMatch(/LIST_STATUSES\s*=\s*'[^']*publish[^']*'/);
  });

  it('status=publish 를 박아 두지 않는다 — 그게 원인이었다', () => {
    expect(src).not.toContain('status=publish&');
    expect(src).not.toMatch(/status=publish`/);
  });

  it('조회한 상태를 항목에 실어 보낸다 — 안 실으면 화면이 구분을 못 한다', () => {
    expect(src).toMatch(/status:\s*String\(post\?\.status/);
  });
});

describe('블로거 목록', () => {
  const src = read('src/core/blogger-publisher.js');

  it('임시(draft)·예약(scheduled)을 함께 조회한다', () => {
    expect(src).toMatch(/status:\s*\['live',\s*'draft',\s*'scheduled'\]/);
  });

  it("status: 'live' 단일 조회가 남아 있지 않다", () => {
    expect(src).not.toMatch(/status:\s*'live'\s*,/);
  });

  it('조회한 상태를 항목에 실어 보낸다', () => {
    expect(src).toMatch(/status:\s*String\(p\.status/);
  });

  it('임시글은 published 가 비어 정렬이 깨지므로 updated 로 정렬한다', () => {
    const block = src.slice(src.indexOf('async function listBloggerPosts'), src.indexOf('async function listBloggerPosts') + 900);
    expect(block).toContain("orderBy: 'updated'");
  });
});

describe('화면 표시', () => {
  const ui = read('electron/ui/modules/published-posts.js');

  it('상태 배지를 실제로 그린다 — 함수만 만들고 안 부르면 조용히 죽는다', () => {
    expect(ui).toContain('function statusBadge');
    expect(ui).toContain('${statusBadge(item.status)}');
  });

  it('임시·예약을 각각 다른 말로 보여준다', () => {
    expect(ui).toMatch(/draft:\s*\{\s*label:\s*'임시'/);
    expect(ui).toMatch(/(scheduled|future):\s*\{\s*label:\s*'예약'/);
  });

  it('날짜 앞 문구도 상태에 맞춘다 — 임시글에 "발행"이라 쓰면 오해한다', () => {
    expect(ui).toContain('${statusDateLabel(item.status)}');
    expect(ui).toContain("if (s === 'draft') return '저장'");
  });
});

describe('타입', () => {
  it('PublishedPostItem 에 status 가 있다', () => {
    expect(read('src/types.ts')).toMatch(/interface PublishedPostItem[\s\S]{0,600}?status\?:\s*string/);
  });
});
