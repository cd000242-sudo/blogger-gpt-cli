/**
 * 문단 길이 고르기 · 구매 CTA 카드 (v3.8.404)
 *
 * 사용자 요구(2026-08-02):
 *   "줄바꿈도 한 문단~두 문단씩 깔끔하게. 한 문단이 너무 길면 줄바꿈, 짧으면 두 문단."
 *   "CTA 버튼이 제품 이미지도 같이 보이면 좋겠는데"
 *
 * 실측 근거 — 사용자 발행글:
 *   문단 46개 · 평균 203자 · 최장 310자 · **모바일 6줄 초과 문단 42개(91%)**
 *   구매링크로 감싼 이미지 8개인데 **버튼형 구매 CTA 는 0개** (있던 4개는 전부 공유 버튼)
 */
import {
  normalizeParagraphs, regroupParagraph, splitSentencesSafe, visibleLength,
} from '../src/core/final/paragraph-normalizer';
import { renderProductCtaCard, insertCtaCards } from '../src/core/affiliate/cta-card';

const LONG = '철제 그레이팅은 도심 속 원활한 배수를 위해 꼭 필요한 시설물이지만, 금속 재질의 특성상 물기가 조금만 닿아도 마찰력이 급격하게 떨어지는 치명적인 단점이 있어요. '
  + '특히 지하철 역사 출입구 근처나 버스 정류장 주변처럼 유동인구가 많고 발걸음을 재촉하는 장소에서는 아주 잠깐의 방심이 커다란 낙상 사고로 이어지기 쉽거든요. '
  + '비가 내리는 날 배수구 위를 무심코 지나가다가 미끄러져 타박상을 입거나 뼈가 부러지는 골절 사고를 당하는 안타까운 사례가 매년 반복해서 발생하고 있답니다.';

const paras = (html: string) => [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]!);

describe('긴 문단은 문장 경계에서 나눈다', () => {
  it('⭐ 실제 발행글의 265자 문단이 여러 문단으로 나뉜다', () => {
    const r = normalizeParagraphs(`<p>${LONG}</p>`);
    const lens = paras(r.html).map(visibleLength);
    expect(lens.length).toBeGreaterThan(1);
    lens.forEach((l) => expect(l).toBeLessThanOrEqual(150));   // 모바일 6줄 이내
    expect(r.split).toBeGreaterThan(0);
  });

  it('⭐ 글자가 하나도 사라지지 않는다', () => {
    const r = normalizeParagraphs(`<p>${LONG}</p>`);
    expect(visibleLength(r.html)).toBe(visibleLength(LONG));
  });

  it('짧은 문단은 그대로 둔다', () => {
    const short = '<p>짧은 문단입니다. 그대로 둡니다. 건드릴 이유가 없으니까요.</p>';
    expect(normalizeParagraphs(short).split).toBe(0);
  });

  it('⭐ 한 문장이 아무리 길어도 쪼개지 않는다 (문장 중간을 자르면 뜻이 깨진다)', () => {
    const oneSentence = `<p>${'가'.repeat(300)}</p>`;
    expect(normalizeParagraphs(oneSentence).split).toBe(0);
  });
});

describe('짧은 문단은 합친다', () => {
  it('⭐ 한 줄짜리들이 이어지면 한 문단으로 묶는다', () => {
    const r = normalizeParagraphs('<p>정말 좋아요.</p><p>추천합니다.</p><p>다음에 또 살게요.</p>');
    expect(paras(r.html)).toHaveLength(1);
    expect(r.merged).toBe(2);
    expect(r.html).toContain('정말 좋아요. 추천합니다. 다음에 또 살게요.');
  });

  it('마지막에 남은 짧은 문단도 버리지 않는다', () => {
    const r = normalizeParagraphs('<p>긴 문단입니다. 충분히 길게 써서 합쳐지지 않도록 만든 문장이 여기 있습니다. 세 번째 문장도 넣습니다.</p><p>짧아요.</p>');
    expect(r.html).toContain('짧아요.');
  });
});

describe('HTML 을 깨뜨리지 않는다', () => {
  const RISKY = '<p>자세한 건 <a href="https://link.coupang.com/a/x.y.z">여기 쿠팡 링크</a>를 보세요. '
    + '그리고 <strong>중요합니다. 꼭 확인하세요.</strong> 마지막 문장입니다. 이건 네 번째 문장이고요. 다섯 번째까지 갑니다.</p>';

  it('⭐ <a> 태그 안에서 자르지 않는다 (링크가 두 동강 나면 안 된다)', () => {
    const r = normalizeParagraphs(RISKY);
    expect((r.html.match(/<a\b/g) || []).length).toBe((r.html.match(/<\/a>/g) || []).length);
    expect(r.html).toContain('https://link.coupang.com/a/x.y.z');
  });

  it('⭐ <strong> 안의 마침표에서 자르지 않는다', () => {
    const r = normalizeParagraphs(RISKY);
    expect((r.html.match(/<strong\b/g) || []).length).toBe((r.html.match(/<\/strong>/g) || []).length);
  });

  it('URL 안의 점을 문장 끝으로 착각하지 않는다', () => {
    const sents = splitSentencesSafe('<a href="https://a.b.c/d.e">링크</a> 다음 문장입니다.');
    expect(sents.join('')).toContain('https://a.b.c/d.e');
  });
});

describe('구조가 잡힌 요소는 건드리지 않는다', () => {
  const MIXED = '<ul><li>항목 하나입니다.</li></ul><table><tr><td>표</td></tr></table>'
    + '<div data-orbit-cta="1"><a href="x">버튼</a></div>'
    + '<p class="affiliate-disclosure">고지문입니다.</p>';

  it('목록·표를 그대로 둔다', () => {
    const r = normalizeParagraphs(MIXED);
    expect(r.html).toContain('<ul>');
    expect(r.html).toContain('<table>');
  });

  it('⭐ CTA 카드와 대가성 문구를 건드리지 않는다', () => {
    const r = normalizeParagraphs(MIXED);
    expect(r.html).toContain('data-orbit-cta');
    expect(r.html).toContain('class="affiliate-disclosure">고지문입니다.');
  });

  it('빈 입력에 안전하다', () => {
    expect(normalizeParagraphs('').html).toBe('');
    expect(normalizeParagraphs(null as any).html).toBe('');
  });

  it('regroupParagraph 단독으로도 동작한다', () => {
    expect(regroupParagraph('짧다.').length).toBe(1);
    expect(regroupParagraph(LONG).length).toBeGreaterThan(1);
  });
});

describe('구매 CTA 카드', () => {
  const P = {
    name: '시티가드 그레이팅 안전덮개',
    priceKrw: 52700,
    imageUrl: 'https://img.example/x.jpg',
    url: 'https://link.coupang.com/a/fRJGxvXas8',
    provider: 'coupang' as const,
    note: '무료배송',
  };

  it('⭐ 상품 이미지가 카드에 들어간다 (사용자 요구)', () => {
    expect(renderProductCtaCard(P, 'final')).toContain('<img src="https://img.example/x.jpg"');
  });

  it('⭐ 가격을 모르면 아예 쓰지 않는다 (추정 금지)', () => {
    const c = renderProductCtaCard({ ...P, priceKrw: null }, 'mid');
    expect(c).not.toContain('원</div>');
    expect(c).toContain('시티가드');            // 상품명은 남는다
  });

  it('⭐ 버튼 문구가 구체적이다 (모호한 "여기 클릭" 금지 — 전환 +161%)', () => {
    expect(renderProductCtaCard(P, 'final')).toMatch(/최저가 확인/);
  });

  it('⭐ rel="sponsored" 를 반드시 붙인다', () => {
    expect(renderProductCtaCard(P, 'mid')).toContain('rel="sponsored nofollow noopener"');
  });

  it('⭐ 링크를 원본 그대로 쓴다 (주소 변조 = 계약 위반)', () => {
    expect(renderProductCtaCard(P, 'mid')).toContain('fRJGxvXas8');
  });

  it('링크가 없으면 카드를 만들지 않는다', () => {
    expect(renderProductCtaCard({ ...P, url: '' }, 'mid')).toBe('');
    expect(renderProductCtaCard({ ...P, url: '그냥텍스트' }, 'mid')).toBe('');
  });

  it('⭐ 세 자리에 심는다 — 요약 직후·본문 중간·글 끝', () => {
    const html = '<h2>성급한 분들을 위한 핵심 요약</h2><p>요약</p><h2>A</h2><p>a</p><h2>B</h2><p>b</p>'
      + '<h2>C</h2><p>c</p><h2>D</h2><p>d</p><p class="affiliate-disclosure">고지문</p>';
    const r = insertCtaCards(html, P);
    expect(r.inserted).toBe(3);
  });

  it('⭐ 마지막 카드는 대가성 문구보다 앞에 온다', () => {
    const html = '<h2>A</h2><p>a</p><p class="affiliate-disclosure">고지문</p>';
    const r = insertCtaCards(html, P);
    expect(r.html.indexOf('data-orbit-cta')).toBeLessThan(r.html.indexOf('affiliate-disclosure'));
  });

  it('⭐ 두 번 호출해도 중복으로 심지 않는다', () => {
    const once = insertCtaCards('<h2>A</h2><p>a</p>', P);
    expect(insertCtaCards(once.html, P).inserted).toBe(0);
  });

  it('HTML 특수문자를 이스케이프한다', () => {
    const c = renderProductCtaCard({ ...P, name: '<script>bad</script>' }, 'mid');
    expect(c).not.toContain('<script>');
    expect(c).toContain('&lt;script&gt;');
  });
});
