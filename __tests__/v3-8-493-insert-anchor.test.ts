/**
 * v3.8.493 — 커서를 보고 눌렀는데도 광고가 맨 아래로 가던 진짜 원인
 *
 * 사장님: "원하는위치에 클릭하고 커서 뜨는거보고 광고버튼눌럿는데 여전히 맨아래에 광고가 생겨요"
 *
 * ## 원인 — 커서는 맞았고 앵커 해석이 틀렸다
 * 발행된 글은 본문 전체가 래퍼 하나(.wp-styled-content 등)에 싸여 있다.
 * findDirectBlock 은 "컨테이너의 직계 자식" 까지 올라가므로, 클릭한 문단이 아니라
 * **글 전체 래퍼** 를 앵커로 돌려줬다. 그 다음(afterend)에 넣으니 맨 아래가 됐다.
 * v3.8.492 의 폴백(마우스 자리·화면 중앙)도 같은 함수를 쓰므로 같은 이유로 틀렸다.
 *
 * ## 고침
 * 클릭 지점에서 가장 가까운 블록 요소(P·H2·FIGURE…)를 앵커로 쓴다.
 * 표 셀·목록 항목 안이면 광고를 넣을 수 없으므로 TABLE/UL/OL 까지 올라간다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const images = fs.readFileSync(
  path.join(__dirname, '..', 'electron/ui/modules/editor-images.js'), 'utf-8',
);

describe('① 문단 수준 앵커', () => {
  it('⭐⭐ findInsertAnchor 가 존재하고 블록 태그를 명시한다', () => {
    expect(images).toContain('function findInsertAnchor');
    expect(images).toContain('INSERT_ANCHOR_TAG');
    for (const tag of ['P|H1', 'FIGURE', 'TABLE', 'UL|OL']) {
      expect(images.match(new RegExp(tag))).not.toBeNull();
    }
  });

  it('⭐⭐ 표 셀·목록 항목 안이면 후보를 버리고 더 위로 간다 (셀 안에 광고를 넣으면 표가 깨진다)', () => {
    const fn = blockBetween(images, 'function findInsertAnchor', 'function findDirectBlock');
    expect(fn).toContain('INSERT_ESCAPE_TAG');
    expect(fn).toContain('candidate = null');
  });

  it('⭐⭐ 래퍼(div)는 앵커 후보가 아니다 (글 전체 래퍼가 앵커가 되면 맨 아래로 간다)', () => {
    expect(images.match(/INSERT_ANCHOR_TAG = \/[^/]*\//)?.[0]).not.toContain('DIV');
  });
});

describe('② 모든 경로가 문단 앵커를 먼저 쓴다 (한 곳이라도 빠지면 그 경로만 또 맨 아래로 간다)', () => {
  it('⭐⭐ 커서 선택 경로', () => {
    const fn = blockBetween(images, 'export function findCaretBlock', 'export function insertHtmlAtCaret');
    expect(fn.indexOf('findInsertAnchor')).toBeGreaterThan(-1);
    expect(fn.indexOf('findInsertAnchor')).toBeLessThan(fn.indexOf('findDirectBlock'));
  });

  it('⭐⭐ 커서 기억 경로', () => {
    const fn = blockBetween(images, 'const rememberCaret', "doc.addEventListener('keyup', rememberCaret)");
    expect(fn).toContain('findInsertAnchor');
  });

  it('⭐⭐ 마우스 자리 경로', () => {
    expect(images).toContain('state.lastPointerBlock = findInsertAnchor(e.target, container) || block');
  });

  it('⭐⭐ 화면 중앙 폴백 경로', () => {
    const fn = blockBetween(images, 'elementFromPoint', 'return block');
    expect(fn).toContain('findInsertAnchor');
  });
});
