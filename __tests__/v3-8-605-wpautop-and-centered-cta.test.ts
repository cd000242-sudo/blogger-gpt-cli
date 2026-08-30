/**
 * v3.8.605 — ① wpautop 이 본문을 갈라놓는 것 막기 ② CTA·공식 확인처 가운데 정렬
 *
 * 사장님(발행글 5445): "CTA는 센터로 와야되고 마지막 공식 확인처 직접보기도
 *                       센터로 깔끔하게 보여주고 먼가 어색하고 엉성해"
 *
 * 실측해 보니 어색한 게 아니라 **마크업이 깨져 있었다**:
 *   <p> 열림 34 · </p> 닫힘 57 → 짝 없는 </p> 23개
 *   `<span …>📚</span></p>` 처럼 flex 컨테이너 한가운데 문단이 끼어 있었다.
 */
import { neutralizeWpAutop } from '../src/wordpress/wordpress-publisher';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① wpautop 이 끼어들 틈을 없앤다', () => {
  test('블록 사이 줄바꿈이 사라진다 — 문단을 끼워 넣을 자리가 없어진다', () => {
    const src = '<div style="display:flex">\n  <span>📚</span>\n  <div>제목</div>\n</div>';
    const out = neutralizeWpAutop(src);
    expect(out).not.toMatch(/\r?\n/);
    expect(out).toContain('<span>📚</span>');
  });

  test('낱말이 붙지 않는다 — 줄바꿈은 공백 한 칸이 된다', () => {
    expect(neutralizeWpAutop('<b>가</b>\n<b>나</b>')).toBe('<b>가</b> <b>나</b>');
  });

  test('빈 줄(문단 트리거)도 없앤다', () => {
    const out = neutralizeWpAutop('<div>하나</div>\n\n<div>둘</div>');
    expect(out).not.toMatch(/\n/);
  });

  test('pre·code 안의 줄바꿈은 내용이므로 지키다', () => {
    const src = '<p>앞</p>\n<pre>첫 줄\n둘째 줄</pre>\n<p>뒤</p>';
    const out = neutralizeWpAutop(src);
    expect(out).toContain('첫 줄\n둘째 줄');
    expect(out.replace(/<pre>[\s\S]*?<\/pre>/, '')).not.toMatch(/\n/);
  });

  test('줄바꿈이 없으면 손대지 않는다', () => {
    const src = '<div>그대로</div>';
    expect(neutralizeWpAutop(src)).toBe(src);
  });

  test('빈 입력에도 안전하다', () => {
    expect(neutralizeWpAutop('')).toBe('');
    expect(neutralizeWpAutop(null as any)).toBe('');
  });

  test('실제 깨진 모양이 재현되지 않는다', () => {
    // 발행글 5445 에서 나온 그 구조
    const src = [
      '<div style="display:flex;align-items:center;gap:10px;">',
      '  <span style="width:32px;">📚</span>',
      '  <div>',
      '    <div>공식 확인처 · 직접 보기</div>',
      '  </div>',
      '</div>',
    ].join('\n');
    const out = neutralizeWpAutop(src);
    const open = (out.match(/<p[ >]/g) || []).length;
    const close = (out.match(/<\/p>/g) || []).length;
    expect(open).toBe(close);      // 우리가 문단을 만들지 않는다
    expect(out).not.toMatch(/\n/); // wpautop 이 만들 자리도 없다
  });
});

describe('② 발행 경로가 반드시 그 함수를 지난다', () => {
  const publisher = read('src/wordpress/wordpress-publisher.ts');

  test('포스트 본문에 적용된다', () => {
    // v3.8.609 에서 앞단에 head 태그 제거가 붙으며 입력 변수명이 바뀌었다.
    // 변수명이 아니라 **동작**을 본다 — 발행되는 본문이 이 함수를 거쳤는가.
    expect(publisher).toMatch(/const contentForWp = neutralizeWpAutop\(\w+\)/);
    expect(publisher).toContain('content: contentForWp');
  });

  test('에이전트 글(bgpt-wp-ready)도 이 단계는 건너뛸 수 없다', () => {
    // 스타일 파이프라인은 건너뛰지만(422행 가드) 발행 직전 이 처리는 공통 경로다
    const idx = publisher.indexOf('const contentForWp');
    const guard = publisher.indexOf('bgpt-wp-ready');
    expect(idx).toBeGreaterThan(guard);
  });
});

describe('③ CTA 와 공식 확인처가 가운데로', () => {
  const main = read('electron/main.ts');

  test('CTA 버튼이 가운데 정렬 안에 들어간다', () => {
    expect(main).toMatch(/text-align:center[^']*">',\s*\n\s*'\s*<a href="\[검증 URL\]"/);
  });

  test('안내 문구가 버튼 옆이 아니라 아래 줄로 내려간다', () => {
    expect(main).not.toContain('margin-left:12px;font-size:13px;color:#92400e');
    expect(main).toMatch(/margin-top:10px;font-size:13px;color:#92400e/);
  });

  test('공식 확인처 머리말이 가로 flex 가 아니라 세로 가운데다', () => {
    expect(main).not.toMatch(/display:flex;align-items:center;gap:10px;margin-bottom:18px/);
    expect(main).toMatch(/text-align:center;margin-bottom:18px;padding-bottom:16px/);
  });
});
