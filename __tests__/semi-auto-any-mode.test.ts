/**
 * 반자동 발행 — 모든 모드 허용 · 기본은 SEO (v3.8.401)
 *
 * 사용자 지시:
 *   "기본은 SEO모드이고 쇼핑모드는 선택해야됩니다"
 *   "반자동 발행 (편집 후 발행) 이것도 쇼핑모드도 가능하게해주셔야죠 어떤모드든 가능하게 해주세요"
 *   근거: "본인이 이미지를 수집하거나 따로 생성해서 넣으면 API 호출 비용이 들지 않아도 발행이 가능하니까"
 *
 * 실측으로 밝힌 원인:
 *   `semiAutoContentMode` 는 index.html 에 **존재하지 않는 id** 였다(0개).
 *   getElementById 가 늘 null 을 돌려주니 반자동 탭은 어떤 모드에서도
 *   "콘텐츠 모드를 반드시 선택해주세요" 만 띄우고 멈췄다. 쇼핑모드만의 문제가 아니었다.
 *   (같은 유형: generateBtn, thumbnailMode — 없는 id 는 에러 없이 조용히 실패한다)
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const semiAuto = read('electron', 'ui', 'modules', 'semi-auto.js');
const html = read('electron', 'ui', 'index.html');

describe('반자동 발행이 모드 때문에 막히지 않는다', () => {
  it('⭐ 없는 id 때문에 멈추던 차단이 사라졌다', () => {
    expect(semiAuto).not.toContain("alert('콘텐츠 모드를 반드시 선택해주세요.')");
    expect(semiAuto).not.toContain('콘텐츠 모드가 설정되지 않았습니다');
  });

  it('⭐ 글포스팅 탭에서 고른 모드를 그대로 쓴다', () => {
    const i = semiAuto.indexOf("getElementById('semiAutoContentMode')");
    expect(i).toBeGreaterThan(-1);
    const block = braceBlock(semiAuto, "getElementById('semiAutoContentMode')");
    expect(block).toContain("document.getElementById('contentMode')");
  });

  it('⭐ 모드를 못 읽어도 SEO 로 진행한다 — 발행을 막지 않는다', () => {
    expect(semiAuto).toContain("|| 'external'");
  });

  it('쇼핑모드도 그대로 넘어간다 (특정 모드를 걸러내지 않는다)', () => {
    const i = semiAuto.indexOf("getElementById('semiAutoContentMode')");
    const block = braceBlock(semiAuto, "getElementById('semiAutoContentMode')");
    expect(block).not.toContain("!== 'shopping'");
    expect(block).not.toContain("=== 'shopping'");
  });

  it('payload 에 contentMode 를 실어 보낸다', () => {
    expect(semiAuto).toContain('contentMode: contentMode');
  });

  /**
   * 같은 유형(없는 id)이 세 번째다. 문자열이 아니라 **실존**을 검사한다.
   */
  it('⭐ 모드 읽기는 폴백을 거쳐 절대 빈 값이 되지 않는다', () => {
    // 없는 id 를 읽는 것 자체는 문제가 아니다(semiAutoProgressModal 처럼 만들어지지도 않는
    // 죽은 UI 는 `if (!modal) return` 으로 조용히 지나간다).
    // 문제였던 건 **없는 id 로 사용자를 세운 것**이다. 그 지점만 정확히 검증한다.
    const at = semiAuto.indexOf("getElementById('semiAutoContentMode')");
    expect(at).toBeGreaterThan(-1);
    const block = braceBlock(semiAuto, "getElementById('semiAutoContentMode')");
    expect(block).toContain("|| document.getElementById('contentMode')");
    expect(block).toContain("|| 'external'");
    expect(block).not.toContain('alert(');
    expect(block).not.toContain('return;');
  });

  it('⭐ 이중 검증이 throw 대신 로그로 바뀌었다', () => {
    // 예전: if (!contentMode) throw new Error('콘텐츠 모드가 설정되지 않았습니다...')
    //   → 위에서 'external' 로 채우므로 도달할 수 없는데도 생성을 죽이던 코드였다
    expect(semiAuto).toContain('[SEMI-AUTO] 콘텐츠 모드: ${contentMode}');
    expect(semiAuto).not.toContain("throw new Error('콘텐츠 모드");
  });
});

describe('기본은 SEO 모드 — 쇼핑모드는 매번 골라야 한다', () => {
  it('셀렉트 첫 옵션이 SEO 다', () => {
    const i = html.indexOf('<select id="contentMode">');
    const block = braceBlock(html, '<select id="contentMode">');
    const first = block.match(/<option value="([a-z]+)"/);
    expect(first?.[1]).toBe('external');
  });

  it('어떤 옵션에도 selected 가 붙어 있지 않다 (첫 옵션=SEO 가 기본)', () => {
    const i = html.indexOf('<select id="contentMode">');
    const block = html.slice(i, html.indexOf('</select>', i));
    expect(block).not.toContain('selected');
  });

  it('⭐ 지난번에 쇼핑모드를 골랐어도 다시 열면 SEO 로 돌아온다', () => {
    const i = html.indexOf('function restoreContentMode');
    const block = braceBlock(html, 'function restoreContentMode');
    expect(block).toContain("saved !== 'shopping'");
    expect(block).toContain("el.value = 'external'");
  });

  it('쇼핑 외 다른 모드는 그대로 복원된다 (SEO·에드센스·내부링크는 유지)', () => {
    const i = html.indexOf('function restoreContentMode');
    const block = braceBlock(html, 'function restoreContentMode');
    expect(block).toContain('el.value = saved');
  });

  it('왜 쇼핑모드만 예외인지 코드에 적혀 있다', () => {
    const i = html.indexOf('function restoreContentMode');
    const block = braceBlock(html, 'function restoreContentMode');
    expect(block).toContain('쇼핑모드는 쿠팡 조회');
  });
});
