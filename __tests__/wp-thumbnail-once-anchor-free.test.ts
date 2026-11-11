/**
 * 워드프레스 글에 썸네일이 제목 위(대표 이미지)와 본문 맨 위에 두 번 보이던 문제 (발행글 6657)
 *
 * 사장님: "코덱스로 하니까 썸네일을 본문에 한번 더 넣는 버그가 또 생겼네요"
 *
 * ## 실제 사고의 순서 (6657, 에이전트 글 + Codex 이미지)
 *   1. 첫 발행에서 Codex 한도에 걸려 이미지 0장으로 나갔다.
 *   2. 편집기 [이미지 모두 생성] — 썸네일을 `<article>` 안 맨 앞에 넣는다 (editor-image-plan.js placeEditorImage:
 *      `slot.root.prepend(wrapper)`, root = article).
 *   3. [수정발행] — 편집기가 그 썸네일 주소를 대표 이미지로 같이 보낸다 (updateWordPressPost).
 *   4. 본문 맨 위 그림을 떼는 장치(v3.8.727 stripLeadingThumbnail)가 **본문 맨 앞(^\s*)** 만 봐서,
 *      `<article class="bgpt-wp-ready …">` 가 앞을 막으면 못 뗀다 → 대표 이미지 + 본문 맨 위, 두 장.
 *
 * 새 발행 경로의 같은 장치(v3.8.728 stripLeadingImageMatching)도 똑같이 `^\s*` 였다.
 * 티스토리는 v3.8.695 에서 같은 앵커 문제를 고쳤고(앞부분에서 처음 걸리는 하나), 워드프레스엔 옮기지 않았다.
 *
 * 여기서는 "본문 앞 모양 × 썸네일 주소 형태" 표를 두 장치에 모두 돌려, 본문에 남는 썸네일 수를 센다.
 */
import { stripLeadingThumbnail } from '../src/wordpress/wordpress-posts';
import { stripLeadingImageMatching } from '../src/wordpress/wordpress-publisher';

const SECTION_IMG = 'https://i0.wp.com/iili.io/section1.webp?w=1200&ssl=1';

const thumbBlock = (src: string): string =>
  `<div class="separator" style="clear: both; text-align: center; margin: 18px 0px;">`
  + `<img decoding="async" src="${src}" alt="제목" loading="lazy" style="max-width: 100%; height: auto; border-radius: 12px;" `
  + `data-orbit-image-role="thumbnail"></div>`;

const SUMMARY = '<div style="background:#fef9e7;padding:26px;"><p>📌 핵심 요약</p></div>';
const SECTION = `<h2>첫 소제목</h2><div class="separator"><img src="${SECTION_IMG}" data-orbit-image-role="section"></div><p>본문</p>`;

/** 본문 맨 앞이 어떤 모양인가 — 마지막 칸은 6657 이 실제로 가진 모양 */
const LEADS: Array<[string, (thumb: string) => string]> = [
  ['맨 앞 (예전에 되던 모양)', (t) => `${thumbBlock(t)}${SUMMARY}${SECTION}`],
  ['article 안 맨 앞 (6657)', (t) => `<article class="bgpt-wp-ready bgpt-codex-workshop bgpt-content">${thumbBlock(t)} ${SUMMARY}${SECTION}</article>`],
  ['style + article', (t) => `<style>.bgpt-content{color:#111}</style>\n<article class="bgpt-wp-ready">${thumbBlock(t)}${SUMMARY}${SECTION}</article>`],
  ['JSON-LD script + article', (t) => `<script type="application/ld+json">{"@type":"Article"}</script>\n<article class="bgpt-wp-ready">${thumbBlock(t)}${SUMMARY}${SECTION}</article>`],
  ['감싼 div 두 겹', (t) => `<div class="wp-styled-content bgpt-wp-ready"><div class="orbit-import">${thumbBlock(t)}${SUMMARY}${SECTION}</div></div>`],
];

/** 썸네일 주소 형태 */
const THUMBS: Array<[string, string]> = [
  ['외부 호스팅 주소', 'https://iili.io/nmqZ7RV.webp'],
  ['워드프레스 미디어 주소', 'https://leadernam.example/wp-content/uploads/2026/11/nmqZ7RV.jpg'],
  ['data:image 주소', `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgGAWjgAAAAQABo2cWuQAAAABJRU5ErkJggg=='}`],
];

const countOf = (html: string, src: string): number => html.split(src).length - 1;

describe('① 수정발행 — 대표 이미지로 보낸 썸네일은 본문 맨 위에 또 남지 않는다', () => {
  for (const [leadName, build] of LEADS) {
    for (const [thumbName, thumb] of THUMBS) {
      it(`⭐⭐ ${leadName} × ${thumbName}`, () => {
        // 실제 수정발행은 대표 이미지 주소를 같이 넘긴다 — 주소 없이 부르는 옛 형태도 같은 결과여야 한다
        for (const out of [stripLeadingThumbnail(build(thumb), thumb), stripLeadingThumbnail(build(thumb))]) {
          expect(countOf(out, thumb)).toBe(0);
          expect(countOf(out, SECTION_IMG)).toBe(1);   // 소제목 그림은 그대로
          expect(out).toContain('핵심 요약');          // 글자는 그대로
        }
      });
    }
  }
});

describe('② 새 발행 — 대표 이미지로 쓴 그림이 본문 맨 위에 또 남지 않는다', () => {
  for (const [leadName, build] of LEADS) {
    for (const [thumbName, thumb] of THUMBS) {
      it(`⭐⭐ ${leadName} × ${thumbName}`, () => {
        const out = stripLeadingImageMatching(build(thumb), thumb);
        expect(countOf(out, thumb)).toBe(0);
        expect(countOf(out, SECTION_IMG)).toBe(1);
        expect(out).toContain('핵심 요약');
      });
    }
  }
});

describe('③ 지우면 안 되는 것은 그대로 둔다', () => {
  const thumb = 'https://iili.io/nmqZ7RV.webp';

  it('⭐⭐ 대표 이미지와 다른 그림이면 새 발행 경로는 건드리지 않는다', () => {
    const body = `<article class="bgpt-wp-ready">${thumbBlock('https://iili.io/other.webp')}${SUMMARY}${SECTION}</article>`;
    expect(stripLeadingImageMatching(body, thumb)).toBe(body);
  });

  it('⭐⭐ 요약 상자(글자) 뒤에 나오는 그림은 맨 위 썸네일이 아니다', () => {
    const body = `<article class="bgpt-wp-ready">${SUMMARY}${thumbBlock(thumb)}${SECTION}</article>`;
    expect(stripLeadingImageMatching(body, thumb)).toBe(body);
    expect(stripLeadingThumbnail(body)).toBe(body);
  });

  it('⭐⭐ 수정발행도 대표 이미지와 다른 그림이면 건드리지 않는다 (사장님이 맨 위에 직접 둔 그림)', () => {
    const body = `<article class="bgpt-wp-ready">${thumbBlock('https://iili.io/mine.webp')}${SUMMARY}${SECTION}</article>`;
    expect(stripLeadingThumbnail(body, thumb)).toBe(body);
  });

  it('⭐ 썸네일이 맨 앞에 없는 글(6662 모양)은 그대로', () => {
    const body = `<article class="bgpt-wp-ready bgpt-codex-workshop bgpt-content">${SUMMARY}${SECTION}</article>`;
    expect(stripLeadingThumbnail(body)).toBe(body);
    expect(stripLeadingImageMatching(body, thumb)).toBe(body);
  });
});

describe('④ 배선 — 두 길이 같은 앵커 없는 장치를 쓴다', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { blockBetween } = require('./helpers/source-block') as typeof import('./helpers/source-block');
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

  it('⭐⭐ 수정발행은 대표 이미지 주소를 넘겨 같은 그림만 뗀다', () => {
    const posts = read('src/wordpress/wordpress-posts.ts');
    const block = blockBetween(posts, 'export async function updateWordPressPost', 'const body: Record<string, any>');
    expect(block).toMatch(/if \(mediaId\) \{\s*\n\s*const withoutLead = stripLeadingThumbnail\(finalContent, options\.thumbnailUrl\)/);
  });

  it('⭐⭐ 본문 맨 앞(^\s*)에만 기대는 정규식이 두 곳에서 사라졌다', () => {
    const posts = read('src/wordpress/wordpress-posts.ts');
    const fn = blockBetween(posts, 'export function stripLeadingThumbnail', 'export async function updateWordPressPost');
    expect(fn).not.toMatch(/\^\s\*/);
    const shared = read('src/wordpress/leading-thumbnail.ts');
    expect(shared).not.toMatch(/\.match\(\s*\/\^\s\*/);
  });

  it('⭐ 새 발행 경로는 공용 장치를 쓰고 대표 이미지가 생겼을 때만 부른다', () => {
    const pub = read('src/wordpress/wordpress-publisher.ts');
    expect(pub).toContain("import { stripLeadingImageMatching } from './leading-thumbnail';");
    expect(pub).toContain('stripLeadingImageMatching(optimizedContent, featuredSourceUrl)');
  });
});
