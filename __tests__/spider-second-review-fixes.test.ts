/**
 * 거미줄 종합글 — 2차 독립 검토 지적 6건 (TDD 재현 시험)
 *
 * 1·2 completeness  : 루트 div 미닫힘 감지, 닫는 태그 공백·커스텀 요소 오탐
 * 3   image-report  : 썸네일은 있는데 본문 이미지가 0장
 * 4   failure       : JSON 형태 키·토큰 가리기
 * 5   draft         : 더 짧은 재시도 결과가 직전 초안을 대체하지 않기
 * 6   finish        : 이미 bgpt-wp-ready 로 감싼 글의 article 2중 방지
 *
 * 전부 순수 함수를 실제로 돌려 값으로 단언한다. 실제 LLM·앱·네트워크는 부르지 않는다.
 */
import {
  judgeSpiderCompleteness,
  buildSpiderImageWarnings,
  redactSecrets,
  chooseSpiderDraft,
  runSpiderDraftLoop,
  finishSpiderHtml,
} from '../src/core/spider';
import { carriesOrbitSkin } from '../src/core/final/skin-marker';

const ROOT_OPEN = '<div class="sw-cornerstone max-mode-article">';

describe('1. completeness — 루트 div 가 안 닫힌 채 </p> 에서 잘린 글', () => {
  it('재현 입력: 루트 div 미닫힘 → hard 로 잡힌다', () => {
    const r = judgeSpiderCompleteness(`${ROOT_OPEN}<h2>다</h2><p>다음 문단입니다.</p>`);
    expect(r.hard.length).toBe(1);
    expect(r.hard[0]).toContain('닫히지 않았습니다');
  });
  it('안쪽 카드 div 는 닫혔지만 루트가 안 닫힌 글도 hard', () => {
    const r = judgeSpiderCompleteness(`${ROOT_OPEN}<div class="card"><p>가.</p></div><h2>다</h2><p>나.</p>`);
    expect(r.hard.length).toBe(1);
  });
  it('정상으로 닫힌 종합글은 아무 신호도 없다', () => {
    expect(judgeSpiderCompleteness(`${ROOT_OPEN}<div class="card"><p>가.</p></div><h2>다</h2><p>나.</p></div>`)).toEqual({ hard: [], soft: [] });
  });
  it('루트 표식이 있고 3개 이상 모자라면 기존처럼 한 줄만 (중복 문구 없음)', () => {
    const r = judgeSpiderCompleteness(`${ROOT_OPEN}<div><div><div><p>가.</p>`);
    expect(r.hard.length).toBe(1);
    expect(r.hard[0]).toContain('4개');
  });
  it('루트 표식이 없는 글에서 div 가 1~2개 모자라면 soft, 3개 이상이면 hard', () => {
    const one = judgeSpiderCompleteness('<div><div><p>가.</p></div>');
    expect(one.hard).toEqual([]);
    expect(one.soft.join(' ')).toContain('<div>');
    const two = judgeSpiderCompleteness('<div><div><div><p>가.</p></div>');
    expect(two.hard).toEqual([]);
    expect(two.soft.join(' ')).toContain('2개');
    expect(judgeSpiderCompleteness('<div><div><div><div><p>가.</p>').hard.length).toBe(1);
  });
  it('sw-cornerstone 와 이름만 비슷한 클래스(sw-cornerstone-x)는 뿌리로 보지 않는다', () => {
    const r = judgeSpiderCompleteness('<div class="sw-cornerstone-x"><p>가.</p>');
    expect(r.hard).toEqual([]);
    expect(r.soft.length).toBeGreaterThan(0);
  });
});

describe('2. completeness — 닫는 태그 공백·커스텀 요소 오탐', () => {
  it('</ul >, </ol\\n>, </table >, </div > 도 닫힘으로 인정한다', () => {
    expect(judgeSpiderCompleteness('<div><ul><li>가</li></ul ><ol><li>나</li></ol\n><table><tr><td>a</td></tr></table ><p>끝.</p></div >').hard).toEqual([]);
    expect(judgeSpiderCompleteness(`${ROOT_OPEN}<p>끝.</p></div >`)).toEqual({ hard: [], soft: [] });
  });
  it('<table-of-contents>·<ul-list>·<div-box> 같은 커스텀 요소는 table·ul·div 로 세지 않는다', () => {
    const custom = '<div><table-of-contents><p>목차.</p></table-of-contents><ul-list><li>가</li></ul-list><ol-x><li>나</li></ol-x><p>끝.</p></div>';
    expect(judgeSpiderCompleteness(custom).hard).toEqual([]);
    expect(judgeSpiderCompleteness('<div-box><div-box><div-box><p>가.</p>').hard).toEqual([]);
  });
  it('진짜 닫히지 않은 <ul>·<table> 은 커스텀 요소가 섞여 있어도 여전히 hard', () => {
    expect(judgeSpiderCompleteness('<div><table-of-contents></table-of-contents><ul><li>가</li><li>나').hard.join(' ')).toContain('<ul>');
    expect(judgeSpiderCompleteness('<div><ul-x></ul-x><table><tr><td>a</td></tr></div>').hard.join(' ')).toContain('<table>');
  });
});

describe('3. image-report — 썸네일은 들어갔는데 본문 이미지가 0장', () => {
  const run = (stats: { thumbnail: boolean; h2Generated: number; h2Failed: number; errors: string[] }, over: Record<string, unknown> = {}) =>
    buildSpiderImageWarnings({ imagePolicy: 'all', thumbEngine: 'gemini', h2Engine: 'gemini', stats, ...over });

  it('재현: thumbnail:true, h2Generated:0, h2Failed:5 → 경고 한 줄', () => {
    const w = run({ thumbnail: true, h2Generated: 0, h2Failed: 5, errors: [] });
    expect(w.length).toBe(1);
    expect(w[0]).toContain('본문 이미지가 0장입니다');
    expect(w[0]).toContain('5장');
  });
  it('재현: 시도 0·errors 만 있으면 엔진 오류가 원인으로 붙는다', () => {
    const w = run({ thumbnail: true, h2Generated: 0, h2Failed: 0, errors: ['dispatcher failed'] });
    expect(w.length).toBe(1);
    expect(w[0]).toContain('본문 이미지가 0장입니다');
    expect(w[0]).toContain('dispatcher failed');
  });
  it('원인이 전혀 없어도 경고는 나가고, 키 값은 새지 않는다', () => {
    const w = run({ thumbnail: true, h2Generated: 0, h2Failed: 0, errors: ['key=AIzaSyD-FAKEKEYFORTESTONLY1234567890abcd'] });
    expect(w.join(' ')).toContain('본문 이미지가 0장입니다');
    expect(w.join(' ')).not.toContain('AIzaSyD');
    expect(run({ thumbnail: true, h2Generated: 0, h2Failed: 0, errors: [] }).length).toBe(1);
  });
  it('같은 말을 두 번 하지 않는다 — 전부 0장이면 기존 한 줄, 일부만이면 기존 한 줄', () => {
    const all = run({ thumbnail: false, h2Generated: 0, h2Failed: 5, errors: ['x 실패'] });
    expect(all.length).toBe(1);
    expect(all[0]).not.toContain('본문 이미지가 0장입니다');
    const partial = run({ thumbnail: true, h2Generated: 2, h2Failed: 3, errors: [] });
    expect(partial.length).toBe(1);
    expect(partial[0]).toContain('2장만');
    const noThumb = run({ thumbnail: false, h2Generated: 3, h2Failed: 0, errors: [] });
    expect(noThumb.length).toBe(1);
    expect(noThumb[0]).toContain('썸네일이 들어가지 않았습니다');
  });
  it('본문 이미지를 기대하지 않는 설정이면 경고하지 않는다', () => {
    const stats = { thumbnail: true, h2Generated: 0, h2Failed: 0, errors: [] as string[] };
    expect(run(stats, { imagePolicy: 'thumbnail-only' })).toEqual([]);
    expect(run(stats, { h2Engine: 'none' })).toEqual([]);
    expect(run(stats, { imagePolicy: 'none' })).toEqual([]);
  });
  it('정상(썸네일 + 본문 전부)은 경고 없음', () => {
    expect(run({ thumbnail: true, h2Generated: 4, h2Failed: 0, errors: [] })).toEqual([]);
  });
});

describe('4. redactSecrets — JSON 형태 키·토큰', () => {
  it('재현: {"apiKey":"…"} 와 {"access_token":"…"} 의 값이 가려진다', () => {
    expect(redactSecrets('{"apiKey":"0123456789abcdef0123456789abcdef"}')).toBe('{"apiKey":"***"}');
    expect(redactSecrets('{"access_token":"abcdefghij123456"}')).toBe('{"access_token":"***"}');
  });
  it("작은따옴표·공백이 낀 형태와 authorization 도 가린다", () => {
    expect(redactSecrets("{'token': 'abcdefghij123456'}")).toBe("{'token': '***'}");
    expect(redactSecrets('{ "refresh_token" : "abcdefghij123456" }')).not.toContain('abcdefghij123456');
    expect(redactSecrets('{"authorization":"Bearer abcdefghijklmnop"}')).not.toContain('abcdefghijklmnop');
    expect(redactSecrets('{"password":"p4ssw0rd-long"}')).not.toContain('p4ssw0rd');
  });
  it('기존에 가려지던 형태는 그대로 가려진다', () => {
    const raw = 'AIzaSyD-FAKEKEYFORTESTONLY1234567890abcd sk-abcdefghijklmnop1234 Bearer abcdefgh12345678 api_key=abcdef123456 api-key: ghijkl654321 https://x.example/v1?key=zzzzzzzz1111';
    const out = redactSecrets(raw);
    for (const secret of ['AIzaSyD', 'sk-abcdefghijklmnop1234', 'abcdefgh12345678', 'abcdef123456', 'ghijkl654321', 'zzzzzzzz1111']) {
      expect(out).not.toContain(secret);
    }
  });
  it('키가 아닌 평범한 글·JSON 은 건드리지 않는다', () => {
    const plainJson = '{"title":"인천 산후조리원 지원금","status":403,"max_tokens":4000,"keywords":"지원금 신청"}';
    expect(redactSecrets(plainJson)).toBe(plainJson);
    expect(redactSecrets('Claude Code 가 글을 돌려주지 않았습니다')).toBe('Claude Code 가 글을 돌려주지 않았습니다');
  });
});

describe('5. chooseSpiderDraft — 더 짧은 재시도 결과는 직전 초안을 대체하지 않는다', () => {
  const prev = `<p>${'가'.repeat(900)}</p>`;
  it('재시도가 200자는 넘지만 직전보다 짧으면 직전 초안 + 경고', () => {
    const shorter = `<p>${'나'.repeat(300)}</p>`;
    const pick = chooseSpiderDraft(prev, shorter);
    expect(pick.draft).toBe(prev);
    expect(pick.kept).toBe(true);
    expect(pick.warning).toContain('더 짧아');
  });
  it('길이가 같거나 더 길면 재시도 결과', () => {
    expect(chooseSpiderDraft(prev, `<p>${'나'.repeat(900)}</p>`)).toEqual({ draft: `<p>${'나'.repeat(900)}</p>`, kept: false });
    expect(chooseSpiderDraft(prev, `<p>${'나'.repeat(1200)}</p>`).kept).toBe(false);
  });
  it('재시도가 비었거나 던진 경우의 기존 동작은 그대로 (경고 문구 없음)', () => {
    expect(chooseSpiderDraft(prev, '')).toEqual({ draft: prev, kept: true });
    expect(chooseSpiderDraft(prev, null)).toEqual({ draft: prev, kept: true });
  });
  it('실행 루프: 짧은 재시도 결과를 버리고 직전 초안으로 가며 그 이유를 경고로 남긴다', async () => {
    const first = `<h2>1</h2><h2>2</h2><p>${'가'.repeat(1500)}</p>`;
    const shorter = `<h2>1</h2><p>${'나'.repeat(400)}</p>`;
    const regenerate = jest.fn().mockResolvedValue(shorter);
    const r = await runSpiderDraftLoop({ mode: 'api', first, regenerate, log: () => {} });
    expect(r.draft).toBe(first);
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(r.warnings.join(' ')).toContain('더 짧아');
    expect(r.warnings.join(' ')).not.toContain('재시도에 실패해');
  });
});

describe('6. finishSpiderHtml — 이미 통과 표식(bgpt-*-ready)으로 감싼 글은 다시 감싸지 않고 스킨도 입히지 않는다', () => {
  const INNER = '<div class="sw-cornerstone max-mode-article"><h2>첫째</h2><p>본문입니다.</p></div>';
  const articles = (html: string) => (html.match(/<article\b/gi) || []).length;
  const closers = (html: string) => (html.match(/<\/article>/gi) || []).length;
  const openTag = (html: string) => (html.match(/<article\b[^>]*>/i) || [''])[0];

  it('WordPress: 에이전트의 <article class="bgpt-wp-ready …"> 는 한 글자도 안 바뀐다 (bgpt-content·스킨 없음)', () => {
    const src = `<article class="bgpt-wp-ready bgpt-codex-workshop">${INNER}</article>`;
    const out = finishSpiderHtml(src, { platform: 'wordpress' }).html;
    expect(out).toBe(src);
    expect(carriesOrbitSkin(out)).toBe(false);
    expect(out).not.toMatch(/<style\b|bgpt-content/);
  });
  it('Blogger: bgpt-blogger-ready article 도 한 겹 그대로 남는다', () => {
    const src = `<article class="bgpt-blogger-ready">${INNER}</article>`;
    const out = finishSpiderHtml(src, { platform: 'blogspot' }).html;
    expect(out).toBe(src);
    expect(articles(out)).toBe(1);
  });
  it('앞쪽 <style>·JSON-LD 는 article 바깥에 남고, 두 번 돌려도 결과가 같다', () => {
    const ld = '<script type="application/ld+json">{"@type":"Article"}</script>';
    const src = `<style>.own{}</style>
${ld}
<article class="bgpt-wp-ready">${INNER}</article>`;
    const once = finishSpiderHtml(src, { platform: 'wordpress' }).html;
    expect(articles(once)).toBe(1);
    expect(once).toBe(src);
    expect(once.indexOf(ld)).toBeLessThan(once.indexOf('<article'));
    expect(finishSpiderHtml(once, { platform: 'wordpress' }).html).toBe(once);
  });
  it("작은따옴표 class 의 bgpt-wp-ready 도 통과 표식으로 알아본다 (다시 감싸지 않음)", () => {
    const src = `<article class='bgpt-wp-ready'>${INNER}</article>`;
    const out = finishSpiderHtml(src, { platform: 'wordpress' }).html;
    expect(articles(out)).toBe(1);
    expect(out).toBe(src);
  });
  it('이미 bgpt-content 를 가진 article 은 그대로 둔다 (기존 동작)', () => {
    const src = `<article class="bgpt-wp-ready bgpt-content">${INNER}</article>`;
    expect(finishSpiderHtml(src, { platform: 'wordpress' }).html).toBe(src);
  });
  it('최외곽이 article 하나가 아니면(형제 article 둘) 통과 표식 article 로 한 번 감싼다', () => {
    const src = '<article class="bgpt-wp-ready"><p>가.</p></article><article><p>나.</p></article>';
    const out = finishSpiderHtml(src, { platform: 'wordpress' }).html;
    expect(articles(out)).toBe(3);
    expect(closers(out)).toBe(3);
    expect(openTag(out)).toBe('<article class="bgpt-wp-ready">');
    expect(out).not.toMatch(/bgpt-content/);
  });
  it('article 이 아닌 종합글 뿌리는 통과 표식 article 로 한 번 감싼다 (스킨 없음)', () => {
    const out = finishSpiderHtml(INNER, { platform: 'wordpress' }).html;
    expect(out).toBe(`<article class="bgpt-wp-ready">${INNER}</article>`);
  });
});
