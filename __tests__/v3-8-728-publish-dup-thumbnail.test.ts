/**
 * 새 발행에서도 같은 그림이 두 번 나오지 않게 (v3.8.728)
 *
 * 사장님: "앱에서는 이제 이렇게 안 나오겠지?"
 *
 * ## 확인해 보니 빈틈이 남아 있었다
 * v3.8.727 은 **수정발행** 길만 막았다. 새 발행에는 v3.8.336 의 `stripBodyThumbnailBox` 가 있지만
 * 그건 `bgpt-thumbnail-box` 클래스만 본다. 실제 본문은 `div.separator > img`(발행기 모양)이나
 * `figure > img`(에이전트 글)로 들어온다 — 그 둘은 안 걸린다.
 *
 * 게다가 v3.8.724 가 "후보 하나 죽었다고 포기하지 않는다"를 넣으면서 위험이 커졌다:
 * 지정 썸네일 업로드가 실패하면 이제 **본문 첫 그림**이 대표 이미지가 되고, 본문에도 그대로 남는다.
 * 그게 발행글 5714 에서 사장님이 잡아낸 모습이다.
 *
 * ## 주소를 맞춰 보고 뺀다
 * 맨 앞 그림이라고 무조건 지우면 소제목 이미지가 사라질 수 있다.
 * **대표 이미지로 쓴 그 그림일 때만** 뺀다.
 */
import { stripLeadingImageMatching } from '../src/wordpress/wordpress-publisher';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const SEP = (src: string) => `<div class="separator"><img src="${src}"></div><p>본문</p>`;

describe('① 대표 이미지와 같은 그림일 때만 뺀다', () => {
  it('⭐⭐ 같은 주소면 뺀다', () => {
    expect(stripLeadingImageMatching(SEP('https://files.catbox.moe/a.webp'), 'https://files.catbox.moe/a.webp'))
      .toBe('<p>본문</p>');
  });

  it('⭐⭐ 다른 그림이면 그대로 둔다 (소제목 이미지를 지우면 글이 헐거워진다)', () => {
    const body = SEP('https://files.catbox.moe/a.webp');
    expect(stripLeadingImageMatching(body, 'https://files.catbox.moe/other.webp')).toBe(body);
  });

  it('⭐⭐ 이미지 CDN 으로 감싼 주소도 같은 그림으로 알아본다', () => {
    expect(stripLeadingImageMatching(SEP('https://files.catbox.moe/a.webp'), 'https://i0.wp.com/files.catbox.moe/a.webp?ssl=1'))
      .toBe('<p>본문</p>');
  });

  it('⭐⭐ 지연 로딩 속성에 진짜 주소가 있어도 알아본다 (실제 페이지가 그 모양이다)', () => {
    const lazy = '<div class="separator"><img src="data:image/svg+xml;base64,AAA" '
      + 'data-breeze="https://i0.wp.com/files.catbox.moe/a.webp?w=900"></div><p>본문</p>';
    expect(stripLeadingImageMatching(lazy, 'https://files.catbox.moe/a.webp')).toBe('<p>본문</p>');
  });

  it('⭐⭐ 에이전트 글 모양(figure)도 본다', () => {
    const fig = '<figure><img src="https://x/a.jpg"></figure><p>본문</p>';
    expect(stripLeadingImageMatching(fig, 'https://x/a.jpg')).toBe('<p>본문</p>');
  });

  it('⭐⭐ 본문 중간 그림은 건드리지 않는다', () => {
    const mid = '<p>앞</p><figure><img src="https://x/a.jpg"></figure><p>뒤</p>';
    expect(stripLeadingImageMatching(mid, 'https://x/a.jpg')).toBe(mid);
  });

  it('⭐ 값이 없으면 원본 그대로', () => {
    expect(stripLeadingImageMatching('', 'https://x/a.jpg')).toBe('');
    expect(stripLeadingImageMatching(SEP('https://x/a.jpg'), '')).toBe(SEP('https://x/a.jpg'));
  });
});

describe('② 발행 경로에 배선돼 있다', () => {
  const pub = read('src/wordpress/wordpress-publisher.ts');

  it('⭐⭐ 어느 그림이 대표가 됐는지 기억한다 (안 기억하면 무엇을 뺄지 알 수 없다)', () => {
    expect(pub).toMatch(/let featuredSourceUrl = '';/);
    expect(pub).toContain('featuredSourceUrl = candidate;');
  });

  it('⭐⭐ 대표 이미지가 생겼을 때만, 그 주소로 뺀다', () => {
    expect(pub).toContain('stripLeadingImageMatching(optimizedContent, featuredSourceUrl)');
    const block = pub.slice(pub.indexOf('if (featuredSourceUrl) {'), pub.indexOf('두 장으로 보이던 문제'));
    expect(block).toContain('const before = optimizedContent;');
  });

  it('⭐ 뺀 본문이 실제로 발행에 실린다', () => {
    expect(pub).toMatch(/optimizedContent = stripLeadingImageMatching\(/);
    expect(pub).toContain('wrapAsHtmlBlock(optimizedContent)');
  });
});
