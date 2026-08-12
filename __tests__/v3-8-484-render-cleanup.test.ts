/**
 * v3.8.484 — 눈에 거슬리는 것들을 걷어낸다 (사장님 지시 3·4·5번)
 *
 *   3. H2 하위 이탤릭 중복 제목 제거
 *   4. 공유 링크를 canonical URL 로 수정
 *   5. 제휴 문구는 실제 제휴 링크가 있을 때만
 */
import * as fs from 'fs';
import * as path from 'path';
import { applyShareUrl } from '../src/core/final/share-url';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const orchestration = read('src/core/final/orchestration.ts');
const bloggerPublisher = read('src/core/blogger-publisher.js');
// wordpress-publisher.js 는 빌드가 dist → src 로 역동기화하는 산출물이다.
// 손으로 고칠 곳은 .ts 다 — .js 를 검사하면 빌드 전에는 늘 실패한다.
const wpPublisher = read('src/wordpress/wordpress-publisher.ts');

describe('③ 이미지 캡션이 H2 제목을 되풀이하지 않는다', () => {
  it('⭐⭐ figcaption 으로 소제목을 다시 찍지 않는다', () => {
    const code = orchestration.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(code).not.toContain('<figcaption');
  });

  it('⭐⭐ alt·title 은 남긴다 (접근성·SEO 는 캡션이 아니라 여기서 나온다)', () => {
    const figures = orchestration.slice(
      orchestration.indexOf('<figure class="section-image"'),
      orchestration.indexOf('<figure class="section-image"') + 1200,
    );
    expect(figures).toContain('alt="${cleanH2}"');
    expect(figures).toContain('title="${cleanH2}"');
  });
});

describe('④ 공유 링크가 실제 글 주소를 가리킨다', () => {
  const HTML = '<a data-orbit-share="1" href="https://story.kakao.com/share?url=https%3A%2F%2Fhome.test">공유</a>'
    + '<a data-orbit-share="1" href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fhome.test">FB</a>';

  it('⭐⭐ 홈 주소를 글 주소로 갈아끼운다', () => {
    const out = applyShareUrl(HTML, 'https://blog.test/2026/08/post.html');
    expect(out).toContain(encodeURIComponent('https://blog.test/2026/08/post.html'));
    expect(out).not.toContain(encodeURIComponent('https://home.test'));
  });

  it('⭐⭐ url 과 u 파라미터를 모두 처리한다 (카카오는 url, 페이스북은 u)', () => {
    const out = applyShareUrl(HTML, 'https://blog.test/p');
    expect(out.match(new RegExp(encodeURIComponent('https://blog.test/p'), 'g'))).toHaveLength(2);
  });

  it('⭐⭐ 공유 링크가 아닌 링크는 건드리지 않는다', () => {
    const html = '<a href="https://other.test/a?url=https%3A%2F%2Fkeep.test">본문 링크</a>';
    expect(applyShareUrl(html, 'https://blog.test/p')).toBe(html);
  });

  it('⭐⭐ 글 주소가 없으면 원본 그대로 (홈 주소라도 살아있는 게 낫다)', () => {
    expect(applyShareUrl(HTML, '')).toBe(HTML);
    expect(applyShareUrl(HTML, 'not-a-url')).toBe(HTML);
  });

  it('⭐ 바꿀 게 없으면 같은 문자열을 돌려준다 (불필요한 재발행 방지)', () => {
    const html = '<p>공유 버튼이 없는 글</p>';
    expect(applyShareUrl(html, 'https://blog.test/p')).toBe(html);
  });

  it('⭐⭐ 블로그스팟이 공용 헬퍼를 쓴다 (퍼블리셔마다 따로 짜면 또 어긋난다)', () => {
    expect(bloggerPublisher).toContain('applyShareUrl');
  });

  it('⭐⭐ 워드프레스에도 배선돼 있다 (여기엔 아예 없어서 홈 주소가 박혔다)', () => {
    expect(wpPublisher).toContain('applyShareUrl');
  });
});

describe('⑤ 제휴 문구는 실제 제휴 링크가 있을 때만', () => {
  it('⭐⭐ 면책 문구에 제휴 문장을 무조건 박지 않는다', () => {
    const code = orchestration.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(code).not.toContain('전문적인 조언을 대체하지 않습니다. 일부 링크는 제휴 링크가 포함되어 있습니다.');
  });

  it('⭐⭐ 제휴 링크 유무를 따져서 붙인다', () => {
    expect(orchestration).toContain('hasAffiliateLink');
  });

  it('⭐ 제휴가 아닐 때도 기본 면책 문구는 남는다 (이건 항상 필요하다)', () => {
    expect(orchestration).toContain('정보 제공 목적으로 작성되었으며');
  });
});
