/**
 * v3.8.618 — 미리보기를 실제 발행 화면과 같은 치수로
 *
 * 사장님: "넓이가 안 맞네. 실제 발행되는 넓이와 구조를 맞춰줘. 미리보기랑 좀 다르네"
 *
 * ## 원인
 * 미리보기 래퍼에 **폭 제한이 아예 없었다.** 모달이 주는 만큼 끝까지 늘어난다.
 * 발행된 글은 테마 칼럼(1128px) 안에 들어가므로 **줄바꿈 위치가 통째로 달라진다** —
 * 미리보기에서 두 줄이던 문단이 발행하면 세 줄이 된다.
 *
 * ## 값의 출처 — 전부 실측이다
 * 2026-08-31, 발행글 5455 를 Playwright(뷰포트 1440)로 렌더해서 잰 값:
 *   .entry-content 1128px · p 17.5/32.375 · h2 26/900 · h3 19/800 · 목록 15/27
 * 짐작으로 넣은 값이 하나도 없다. 테마가 바뀌면 다시 재야 하고,
 * 재는 방법은 preview.js 의 PUBLISHED_CONTENT_WIDTH 주석에 적혀 있다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const preview = fs.readFileSync(
  path.join(__dirname, '..', 'electron', 'ui', 'modules', 'preview.js'), 'utf-8',
);

describe('① 발행 폭과 같은 칼럼에 가둔다', () => {
  it('실측 폭이 상수로 있다', () => {
    expect(preview).toContain('const PUBLISHED_CONTENT_WIDTH = 1128');
  });

  it('래퍼에 그 폭이 실제로 걸려 있다 (만들고 안 쓰면 죽은 값이다)', () => {
    expect(preview).toContain('max-width: ${PUBLISHED_CONTENT_WIDTH}px !important');
  });

  it('가운데로 모은다 — 폭만 줄이고 왼쪽에 붙으면 발행과 다르게 보인다', () => {
    const wrapper = blockBetween(preview, 'class="preview-content-wrapper" style="', '">');
    expect(wrapper).toContain('margin: ${isPublishReadyContent ? \'0 auto\' : \'20px auto\'}');
  });
});

describe('② 글자 치수도 발행과 같게', () => {
  const css = blockBetween(preview, '실제 발행 화면과 같은 치수', '.preview-content-wrapper h1');

  it('문단 — 17.5px / 32.375px / 아래 여백 23.625px', () => {
    expect(css).toContain('font-size: 17.5px !important');
    expect(css).toContain('line-height: 32.375px !important');
    expect(css).toContain('margin: 0 0 23.625px 0 !important');
  });

  it('소제목 — h2 26px/900, h3 19px/800', () => {
    expect(css).toContain('font-size: 26px !important');
    expect(css).toContain('font-weight: 900 !important');
    expect(css).toContain('font-size: 19px !important');
    expect(css).toContain('font-weight: 800 !important');
  });

  it('목록 — 15px / 27px (본문보다 작다, 발행이 그렇다)', () => {
    expect(css).toContain('font-size: 15px !important');
    expect(css).toContain('line-height: 27px !important');
  });
});

describe('③ 값이 어디서 왔는지 코드가 말한다', () => {
  /** 다음 사람이 "이 숫자 왜 1128이지?" 하고 지우지 않도록 */
  it('실측 날짜·대상·뷰포트가 적혀 있다', () => {
    const doc = blockBetween(preview, '미리보기를 **실제 발행 화면과 같은 치수**', 'const PUBLISHED_CONTENT_WIDTH');
    expect(doc).toContain('2026-08-31');
    expect(doc).toContain('5455');
    expect(doc).toContain('1440');
  });

  it('다시 재는 방법이 적혀 있다', () => {
    const doc = blockBetween(preview, '미리보기를 **실제 발행 화면과 같은 치수**', 'const PUBLISHED_CONTENT_WIDTH');
    expect(doc).toContain('getBoundingClientRect().width');
  });
});
