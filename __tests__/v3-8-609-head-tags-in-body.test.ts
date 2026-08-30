/**
 * v3.8.609 — 제목 아래 빈 공간의 정체
 *
 * 사장님: "실제글에서는 핵심요약위에 왜 빈공간이 생기는거니" (발행글 5448 스크린샷)
 *
 * 본문 첫머리가 이랬다 — 에이전트가 SEO 메타를 **본문에** 적어 넣었다:
 *   <p><meta name="description" …><br /><meta name="robots" …><br /> … 12개</p>
 * `<meta>` 는 안 보이는데 워드프레스가 사이사이에 넣은 `<br />` 가 **빈 줄로 쌓였다.**
 * 즉 공백의 정체는 여백이 아니라 줄바꿈 12개다.
 */
import { stripHeadOnlyTags } from '../src/core/final/head-tag-strip';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 발행글 5448 의 실제 첫머리 (줄여서) */
const REAL = `<p><meta name="description" content="📌 핵심 요약 월급 300만 원을…"><br />
<meta name="robots" content="index, follow"><br />
<meta property="og:title" content="월급 300만 원, 95년생·85년생"><br />
<meta property="og:image" content="https://iili.io/Cy2UOnp.webp"><br />
<meta name="twitter:card" content="summary_large_image"></p>
<article class="bgpt-wp-ready bgpt-content"><div>핵심 요약</div></article>`;

describe('빈 공간을 만들던 것을 걷어낸다', () => {
  const out = stripHeadOnlyTags(REAL);

  test('meta 를 전부 지운다', () => {
    expect(out.removed).toBe(5);
    expect(out.html).not.toContain('<meta');
  });

  test('남은 빈 껍데기(<p><br></p>)도 지운다 — 그게 실제 빈 줄이었다', () => {
    expect(out.html).not.toMatch(/<p\b[^>]*>(?:\s|<br\s*\/?>)*<\/p>/i);
  });

  test('본문은 그대로 남는다', () => {
    expect(out.html).toContain('<article');
    expect(out.html).toContain('핵심 요약');
  });

  test('본문이 맨 앞에서 시작한다 — 앞에 빈 것이 없다', () => {
    expect(out.html.trim().startsWith('<article')).toBe(true);
  });
});

describe('지워도 되는 것만 지운다', () => {
  test('스킨 CSS(<style>)는 남긴다 — 이 저장소는 본문에 스킨을 싣는다', () => {
    const html = '<style>.bgpt-content h2{color:#000}</style><article>글</article>';
    const out = stripHeadOnlyTags(html);
    expect(out.html).toContain('<style>');
    expect(out.removed).toBe(0);
  });

  test('본문 태그는 건드리지 않는다', () => {
    const html = '<h2>제목</h2><p>문단</p><img src="a.webp"><a href="#">링크</a>';
    expect(stripHeadOnlyTags(html).html).toBe(html);
  });

  test('head 태그가 없으면 손대지 않는다', () => {
    const html = '<article><p>글</p></article>';
    expect(stripHeadOnlyTags(html).html).toBe(html);
    expect(stripHeadOnlyTags(html).removed).toBe(0);
  });

  test('빈 입력에도 안전하다', () => {
    expect(stripHeadOnlyTags('').html).toBe('');
    expect(stripHeadOnlyTags(null as any).removed).toBe(0);
  });

  test('link·title·base 도 head 전용이라 지운다', () => {
    const out = stripHeadOnlyTags('<link rel="canonical" href="x"><title>제목</title><article>글</article>');
    expect(out.removed).toBe(2);
    expect(out.html).toContain('<article>');
  });
});

describe('두 경로 모두에 배선됐다', () => {
  test('에이전트 결과에서 걷는다 — 스킨 입히기 전에', () => {
    const main = read('electron/main.ts');
    expect(main).toContain('stripHeadOnlyTags');
    const cleanIdx = main.indexOf('[AGENT-CLEAN]');
    const skinIdx = main.indexOf('applyOrbitSkinToAgentHtml');
    expect(cleanIdx).toBeGreaterThan(-1);
    expect(cleanIdx).toBeLessThan(skinIdx);   // 지운 뒤에 스킨을 입힌다
  });

  test('워드프레스 발행 직전에도 한 번 더 본다', () => {
    const publisher = read('src/wordpress/wordpress-publisher.ts');
    expect(publisher).toContain('stripHeadOnlyTags');
    expect(publisher).toContain('neutralizeWpAutop(contentBeforeAutop)');
  });
});

/**
 * v3.8.609 — 공식 출처를 위에도 한 줄 (사장님: "핵심 요약쪽에 있는게 클릭률이 좋지 않니?")
 *
 * 통째로 올리지 않은 이유: 답만 확인하고 본문을 안 읽고 나간다.
 * 위에는 핵심 출처 1개만 한 줄, 아래 카드 목록은 그대로 — 역할이 다르다.
 */
describe('답변 박스에 근거 링크 한 줄', () => {
  const main = read('electron/main.ts');

  test('TL;DR 박스 안에 근거 줄이 있다', () => {
    expect(main).toContain('📌 근거 ·');
    expect(main).toMatch(/rel="nofollow noopener" target="_blank"[^>]*>\[기관·매체 이름\]/);
  });

  test('확인 시점을 함께 적는다 — 정책 글의 신뢰 축', () => {
    expect(main).toMatch(/근거[\s\S]{0,200}확인 \[YYYY\.MM\.DD\]/);
  });

  test('아래 카드 박스는 그대로 남는다 (중복이 아니라 역할 분담)', () => {
    expect(main).toContain('25-B. 📚 **1차 자료 버튼 카드 박스**');
  });

  test('출처 1개만 올린다 — 목록을 통째로 올리지 않는다', () => {
    expect(main).toContain('가장 핵심 출처 1개만');
  });
});
