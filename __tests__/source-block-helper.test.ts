/**
 * 소스 블록 추출기 자체 검증 + 고정 길이 슬라이스 재발 방지 (v3.8.405)
 *
 * 추출기가 틀리면 그걸 쓰는 테스트 전부가 조용히 통과해버린다.
 * 그래서 추출기부터 검증한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock, linesAfter, around } from './helpers/source-block';

const SRC = `
// 머리말
function alpha() {
  const a = 1;
  if (a) {
    doThing();
  }
  return a;
}
// 꼬리말
function beta() { return 2; }
`;

describe('blockBetween — 시작과 끝 사이', () => {
  it('두 표식 사이만 잘라낸다', () => {
    const b = blockBetween(SRC, '// 머리말', '// 꼬리말');
    expect(b).toContain('function alpha');
    expect(b).not.toContain('function beta');
  });

  it('⭐ 끝 표식을 시작 뒤에서만 찾는다 — 앞에 같은 문구가 있어도 안 뒤집힌다', () => {
    const src = 'X 끝표식 ... 시작표식 ... 내용 ... 끝표식 마무리';
    const b = blockBetween(src, '시작표식', '끝표식');
    expect(b).toContain('내용');
    expect(b.length).toBeGreaterThan(0);      // 범위가 뒤집혀 빈 문자열이 되면 안 된다
  });

  it('⭐ 표식이 없으면 조용히 통과시키지 않고 실패시킨다', () => {
    expect(() => blockBetween(SRC, '없는표식', '// 꼬리말')).toThrow(/표식을 찾지 못했습니다/);
    expect(() => blockBetween(SRC, '// 머리말', '없는끝표식')).toThrow(/표식을 찾지 못했습니다/);
  });

  it('정규식 표식도 받는다', () => {
    expect(blockBetween(SRC, /function alpha/, /function beta/)).toContain('return a');
  });
});

describe('braceBlock — 중괄호 짝', () => {
  it('중첩 블록을 끝까지 포함한다', () => {
    const b = braceBlock(SRC, 'function alpha');
    expect(b).toContain('doThing()');
    expect(b).toContain('return a');
    expect(b).not.toContain('function beta');
  });

  it('⭐ 내용이 아무리 길어져도 잘리지 않는다 (고정 길이의 반대)', () => {
    const long = `function big() {\n${'  // 주석\n'.repeat(500)}  target();\n}`;
    expect(braceBlock(long, 'function big')).toContain('target()');
  });

  it('중괄호가 없으면 표식 이후 전체를 준다', () => {
    expect(braceBlock('const x = 1; marker; const y = 2;', 'marker')).toContain('const y');
  });
});

describe('linesAfter / around — 줄 단위', () => {
  it('표식부터 N줄만 본다', () => {
    expect(linesAfter(SRC, 'function alpha', 2)).toContain('const a = 1');
    expect(linesAfter(SRC, 'function alpha', 2)).not.toContain('return a');
  });

  it('표식 앞뒤를 함께 본다', () => {
    const a = around(SRC, 'doThing', 2, 1);
    expect(a).toContain('if (a)');
    expect(a).toContain('doThing');
  });
});

/**
 * ⭐ 재발 방지 —
 * 새 테스트에서 또 `slice(i, i + 900)` 을 쓰면 여기서 걸린다.
 * 2026-08-02 하루에 여섯 번 헛되이 깨진 패턴이다.
 */
describe('고정 길이 슬라이스가 다시 늘어나지 않는다', () => {
  const dir = path.join(__dirname);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.ts'));

  it('__tests__ 안에 고정 길이 슬라이스가 없다', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, idx) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;      // 주석 줄은 세지 않는다(설명에 예시가 들어간다)
        // 변수 + 숫자 덧셈으로 끝을 잡는 슬라이스 패턴을 찾는다
        if (/\.slice\(\s*\w+\s*,\s*\w+\s*\+\s*\d+\s*\)/.test(line)) {
          offenders.push(`${f}:${idx + 1}  ${line.trim().slice(0, 70)}`);
        }
      });
    }
    if (offenders.length) {
      throw new Error(
        `고정 길이 슬라이스가 ${offenders.length}곳 남아 있습니다.\n`
        + `길이 대신 경계로 자르세요 — __tests__/helpers/source-block.ts 의 `
        + `blockBetween · braceBlock · linesAfter 를 쓰면 됩니다.\n`
        + offenders.map((o) => `  · ${o}`).join('\n'),
      );
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * try/catch · if/else 는 한 구문이다 (v3.8.405)
 *
 * 코드모드 직후 12개 스위트가 이 이유로 깨졌다.
 * braceBlock 이 try 블록만 잡고 catch 를 놓쳐서
 * "실패해도 발행을 막지 않는다"류 검증이 전부 헛되이 실패했다. 동작은 멀쩡했다.
 */
describe('braceBlock — 이어지는 블록까지', () => {
  const TRY = `
// 표식
try {
  risky();
} catch (e) {
  swallow();
}
after();`;

  it('⭐ catch 까지 포함한다', () => {
    const b = braceBlock(TRY, '// 표식');
    expect(b).toContain('risky()');
    expect(b).toContain('catch');
    expect(b).toContain('swallow()');
    expect(b).not.toContain('after()');
  });

  it('else / else if 도 포함한다', () => {
    const src = '// M\nif (a) {\n  x();\n} else if (b) {\n  y();\n} else {\n  z();\n}\ntail();';
    const b = braceBlock(src, '// M');
    expect(b).toContain('x()');
    expect(b).toContain('y()');
    expect(b).toContain('z()');
    expect(b).not.toContain('tail()');
  });

  it('finally 도 포함한다', () => {
    const src = '// M\ntry {\n  a();\n} finally {\n  cleanup();\n}\ntail();';
    const b = braceBlock(src, '// M');
    expect(b).toContain('cleanup()');
    expect(b).not.toContain('tail()');
  });

  it('이어지는 블록이 없으면 거기서 끝난다 (과하게 넓히지 않는다)', () => {
    const src = '// M\nfunction f() {\n  a();\n}\nconst other = 1;';
    expect(braceBlock(src, '// M')).not.toContain('const other');
  });
});
