/**
 * 발행 차단 게이트 — "HTML 콘텐츠에 기본 구조가 없습니다" (v3.8.399)
 *
 * 사용자 보고 (2026-08-01):
 *   153.9초 걸려 생성을 마친 글이 발행 직전에 통째로 버려졌다.
 *   화면 메시지: "발행 실패: HTML 콘텐츠에 기본 구조가 없습니다. 콘텐츠 생성을 다시 시도해주세요."
 *
 * 원인:
 *   게이트가 '<div>' '<p>' **완전일치** 문자열을 봤다.
 *   그런데 같은 함수 앞쪽(4669행)에서 모든 <p> 를 <p style="..."> 로 바꾼다.
 *   → 두 조건은 이미 죽어 있었고, 사실상 '<h' 하나에만 걸려 있었다.
 *   소제목 없는 글은 정상인데도 무조건 차단됐다.
 *
 * 원칙 (사용자 지시): "검수 때문에 글이 통과가 안 되어 발행이 안 되면 절대 안 된다."
 *   → 고칠 수 있으면 고쳐서 발행한다. 정말 본문이 없을 때만 멈춘다.
 *
 * 이 테스트는 **소스에서 실제 정규식을 뽑아 실행한다.**
 *   테스트가 코드를 베껴 쓰면 같이 틀려도 알 수 없기 때문이다.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', 'src', 'core', 'blogger-publisher.js');
const source = fs.readFileSync(SRC, 'utf8');

/** 실제로 배포되는 게이트 정규식을 소스에서 추출한다 */
function shippedGate(): RegExp {
  const m = source.match(/const hasBasicHtml = (\/.+?\/)([a-z]*)\.test\(finalHtmlContent\)/);
  if (!m || !m[1]) throw new Error('게이트 정규식을 소스에서 찾지 못했습니다 — 구현이 바뀌었으면 이 테스트를 먼저 고치세요');
  return new RegExp(m[1].slice(1, -1), m[2] || '');
}

/** 고치기 전 게이트 — 같은 입력으로 비교하기 위해 남겨둔다 */
const legacyGate = (html: string) =>
  html.includes('<div>') || html.includes('<p>') || html.includes('<h');

/** 발행 직전 실제 모양: schema 래퍼 + 인라인 스타일이 주입된 본문 */
const WRAPPER = '<!-- Blogger HTML Content Start -->\n<div itemscope itemtype="https://schema.org/BlogPosting">\n<meta itemprop="headline" content="제목">\n';
const styledP = (t: string) => `<p style="color: #1a1a1a; font-size: clamp(15px, 4.05vw, 17px); line-height: 1.72;">${t}</p>`;
const styledH2 = (t: string) => `<h2 style="color: #991b1b; font-size: 26px;">${t}</h2>`;

describe('게이트가 정상 글을 막지 않는다', () => {
  it('⭐ 소제목 없는 글 — 예전 게이트는 막았고, 지금은 통과한다', () => {
    const html = WRAPPER + [
      styledP('작년 겨울에 이 제품을 직접 써봤습니다.'),
      styledP('설치는 10분 정도 걸렸고 소음은 생각보다 적었습니다.'),
      styledP('한 달 써보니 전기요금은 3천원쯤 늘었습니다.'),
    ].join('\n') + '\n</div>';

    expect(legacyGate(html)).toBe(false);      // ← 사용자가 겪은 차단
    expect(shippedGate().test(html)).toBe(true);
  });

  it('⭐ 대문자 태그도 통과한다 — 예전 includes() 는 대소문자를 구분해 정상 글을 막았다', () => {
    const html = WRAPPER + '<H2>설치 과정</H2><P>대문자로 온 본문입니다.</P></div>';
    expect(legacyGate(html)).toBe(false);      // ← includes('<h') 는 '<H2' 를 못 찾는다
    expect(shippedGate().test(html)).toBe(true);
  });

  it('소제목 있는 일반 글도 당연히 통과한다', () => {
    const html = WRAPPER + styledH2('설치 과정') + styledP('본문입니다.') + '</div>';
    expect(shippedGate().test(html)).toBe(true);
  });

  it('스타일이 붙은 목록·표만 있는 글도 통과한다', () => {
    expect(shippedGate().test(WRAPPER + '<ul style="margin:0"><li style="a">항목</li></ul></div>')).toBe(true);
    expect(shippedGate().test(WRAPPER + '<table style="width:100%"><tr><td>값</td></tr></table></div>')).toBe(true);
    expect(shippedGate().test(WRAPPER + '<figure><img src="a.jpg"></figure></div>')).toBe(true);
  });

  it('속성 없는 맨 태그도 통과한다 (예전 동작 유지)', () => {
    expect(shippedGate().test('<p>글</p>')).toBe(true);
  });

  it('⭐ 유사 이름 태그를 블록으로 착각하지 않는다', () => {
    // <picture> <details> <label> 등은 본문 구조의 증거가 아니다
    expect(shippedGate().test('<picture><source srcset="a"></picture>')).toBe(false);
    expect(shippedGate().test('<span>글자만</span>')).toBe(false);
  });

  it('⭐ 발행기가 스스로 붙이는 <div itemscope> 래퍼는 증거가 아니다', () => {
    // div 를 인정하면 본문이 텅 비어도 무조건 통과한다 — 빈 글 발행이 차단보다 나쁘다
    expect(shippedGate().test(WRAPPER)).toBe(false);
    expect(source).toContain('div 는 증거로 세지 않는다');
  });
});

describe('걸렸을 때 버리지 않고 고친다', () => {
  const gateBlock = source.slice(
    source.indexOf('const hasBasicHtml ='),
    source.indexOf('// JavaScript 코드 잔존 검증'),
  );

  it('⭐ 글자 수도 함께 본다 — 태그만 있고 내용이 없는 껍데기를 잡는다', () => {
    expect(gateBlock).toContain('!hasBasicHtml || visibleText.length < 50');
  });

  it('⭐ 왜 걸렸는지 두 경우를 구분해 기록한다', () => {
    expect(gateBlock).toContain("'블록 태그 없음' : '본문 글자 부족'");
  });

  it('글자가 남아 있으면 <div> 로 감싸 발행을 계속한다', () => {
    expect(gateBlock).toContain('visibleText.length >= 50');
    expect(gateBlock).toContain('finalHtmlContent = `<div>');
  });

  it('⭐ 감싼 결과를 body.content 에도 반영한다 — body 는 앞(4994행)에서 이미 만들어졌다', () => {
    expect(gateBlock).toContain('body.content = finalHtmlContent.trim()');
  });

  it('정말 본문이 없을 때만 멈춘다', () => {
    expect(gateBlock).toContain('ok: false');
    expect(gateBlock).toContain('본문이 비어 있습니다');
  });

  it('⭐ 멈출 때 두루뭉실하게 말하지 않는다 — 글자 수와 원인 단계를 밝힌다', () => {
    expect(gateBlock).toContain('실제 글자 ${visibleText.length}자');
    expect(gateBlock).toContain('생성 단계에서 내용이 만들어지지 않았습니다');
    expect(gateBlock).not.toContain('콘텐츠 생성을 다시 시도해주세요');
  });

  it('⭐ 다음 재발을 위해 실제 HTML 증거를 남긴다', () => {
    expect(gateBlock).toContain('앞 300자');
    expect(gateBlock).toContain('뒤 300자');
    expect(gateBlock).toContain('onLog?.');
  });
});

describe('보이는 글자 세는 방식', () => {
  /** 소스와 같은 방식인지 눈으로 확인 가능하게 남긴다 */
  const visible = (html: string) => html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  it('CSS·주석·태그는 본문 글자가 아니다', () => {
    expect(visible(WRAPPER + '<style>.a{color:red}</style>')).toBe('');
  });

  it('진짜 글자는 센다', () => {
    expect(visible('<span>직접 써본 후기입니다</span>')).toBe('직접 써본 후기입니다');
  });
});
