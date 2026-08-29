/**
 * v3.8.574 — 돈 안 드는 구조 검사
 *
 * ## 왜 만들었나
 * 사장님이 발행된 글을 LLM 에게 비평시켰더니 이런 게 나왔다:
 *   "2·3·4세대는 있는데 **1세대 설명이 없고**, 첫 문장이 '반면'이라 앞 문단이 잘려나간 티가 나요"
 *   "YMYL 치고 행동 지시가 단정적이에요 — '단호히 거부하세요'를 예외 없는 정답처럼"
 *
 * 사장님: "그런 글을 누가 올리고 싶어할까. 누군가 내 앱으로 글을 만들고 똑같이
 * 비평시키면 내 얼굴에 스스로 먹칠하는 꼴이다."
 *
 * 그라운딩·퍼플렉시티는 비싸서 못 쓴다 — **무료에 가깝게 쓰게 하는 것**이 차별점이다.
 * 그래서 이 검사는 AI 를 한 번도 부르지 않는다. 글자를 세고 번호를 맞추는 일이다.
 *
 * 아래 예시는 **실제 글(5316 도수치료 실비보험)에서 그대로 가져왔다.**
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  findEnumerationGaps, findDanglingConnectives, findOverclaims,
  findStructureIssues, describeStructureIssues,
} from '../src/core/final/structure-guard';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 열거의 구멍 — 실제 사고', () => {
  test('2·3·4세대는 있는데 1세대가 없다', () => {
    const html = '<p>2세대 실손은 연 180회 한도입니다.</p><p>3세대는 자기부담금이 다릅니다.</p><p>4세대는 비급여를 분리했습니다.</p>';
    const [issue] = findEnumerationGaps(html);
    expect(issue).toBeDefined();
    expect(issue!.kind).toBe('enumeration-gap');
    expect(issue!.detail).toContain('1세대');
  });

  test('범위 안쪽 구멍도 잡는다 (2·4 는 있고 3 이 없다)', () => {
    const html = '<p>1단계와 2단계를 거칩니다.</p><p>4단계에서 결정됩니다.</p>';
    expect(findEnumerationGaps(html)[0]?.detail).toContain('3단계');
  });

  /** 억지로 만들지 않는다 — 이게 없으면 경고가 늑대 소년이 된다 */
  test('빠짐없이 이어지면 아무 말도 안 한다', () => {
    expect(findEnumerationGaps('<p>1세대</p><p>2세대</p><p>3세대</p>')).toHaveLength(0);
  });

  test('하나만 언급하면 열거가 아니다', () => {
    expect(findEnumerationGaps('<p>4세대 실손보험만 다룹니다.</p>')).toHaveLength(0);
  });

  test('두 자리 수에 낚이지 않는다', () => {
    expect(findEnumerationGaps('<p>23세대 아파트와 45세대 단지입니다.</p>')).toHaveLength(0);
  });
});

describe('② 앞이 잘린 문단', () => {
  test('소제목 첫 문단이 "반면"으로 시작하면 잡는다', () => {
    const html = '<h2>세대별 비교</h2><p>반면 2009년부터의 2세대 실손은 연 180회 한도입니다.</p>';
    const [i] = findDanglingConnectives(html);
    expect(i).toBeDefined();
    expect(i!.detail).toContain('반면');
  });

  /** 문단 중간의 "하지만"은 정상이다 — 좁게 봐야 오탐이 안 난다 */
  test('첫 문단이 아니면 잡지 않는다', () => {
    const html = '<h2>제목</h2><p>먼저 기본을 봅니다.</p><p>하지만 예외가 있습니다.</p>';
    expect(findDanglingConnectives(html)).toHaveLength(0);
  });

  test('소제목이 없으면 검사하지 않는다', () => {
    expect(findDanglingConnectives('<p>반면 이렇습니다.</p>')).toHaveLength(0);
  });
});

describe('③ YMYL 과한 단정', () => {
  test('여러 번 겹치면 알린다', () => {
    const html = '<p>절대 서명하지 마세요. 반드시 거부하세요. 무조건 단호히 거부하세요.</p>'
      + '<p>절대 안 됩니다. 반드시 100% 거부하세요. 무조건입니다.</p>';
    const [i] = findOverclaims(html);
    expect(i).toBeDefined();
    expect(i!.detail).toContain('단정 표현');
  });

  /** 한두 번은 강조다 — 그것까지 잡으면 글이 밋밋해진다 */
  test('한두 번은 넘어간다', () => {
    expect(findOverclaims('<p>반드시 확인하세요.</p><p>절대 잊지 마세요.</p>')).toHaveLength(0);
  });
});

describe('④ 합쳐서 · 안전하게', () => {
  test('실제 글 모양이면 셋 다 잡는다', () => {
    const html = `
      <h2>세대별 비교</h2>
      <p>반면 2009년 10월부터의 2세대 실손은 연 180회 한도입니다.</p>
      <p>3세대는 자기부담금이 다르고 4세대는 비급여를 분리했습니다.</p>
      <h2>대응</h2>
      <p>절대 서명하지 마세요. 반드시 거부하세요. 무조건 단호히 거부하세요.</p>
      <p>절대 안 됩니다. 반드시 100% 거부하세요. 무조건입니다.</p>`;
    const kinds = findStructureIssues(html).map((i) => i.kind);
    expect(kinds).toContain('enumeration-gap');
    expect(kinds).toContain('dangling-connective');
    expect(kinds).toContain('overclaim');
  });

  test('멀쩡한 글에는 아무 말도 안 한다', () => {
    const html = '<h2>안내</h2><p>신청 절차를 순서대로 정리했습니다.</p><p>서류는 두 가지입니다.</p>';
    expect(findStructureIssues(html)).toHaveLength(0);
    expect(describeStructureIssues([])).toContain('통과');
  });

  /** fact-guard 와 같은 원칙 — 검수 때문에 발행이 멈추면 안 된다 */
  test('빈 값·깨진 입력에도 던지지 않는다', () => {
    for (const bad of ['', null, undefined, '<p>닫히지 않은', '<<<>>>']) {
      expect(() => findStructureIssues(bad as any)).not.toThrow();
    }
  });
});

describe('⑤ 배선 — 발행 경로에서 실제로 부른다', () => {
  const orch = read('src/core/final/orchestration.ts');

  test('import 하고 호출한다', () => {
    expect(orch).toContain("import { findStructureIssues, describeStructureIssues } from './structure-guard'");
    expect(orch).toContain('findStructureIssues(html)');
  });

  test('사실 검수(fact-guard) 다음에 온다 — 고친 뒤의 글을 봐야 한다', () => {
    const fact = orch.indexOf('await guardFacts(');
    const structure = orch.indexOf('findStructureIssues(html)');
    expect(fact).toBeGreaterThan(-1);
    expect(structure).toBeGreaterThan(fact);
  });

  test('발행을 막지 않는다 (try 로 감싸고 알리기만)', () => {
    const block = orch.slice(orch.indexOf('findStructureIssues(html)') - 400, orch.indexOf('findStructureIssues(html)') + 700);
    expect(block).toContain('try {');
    expect(block).toContain('catch');
    expect(block).toContain('onLog?.');
    // 던지거나 발행을 중단시키는 코드가 없어야 한다
    expect(block).not.toContain('throw new Error');
  });

  test('AI 를 부르지 않는다 (비용 0 이 이 모듈의 존재 이유다)', () => {
    const src = read('src/core/final/structure-guard.ts');
    expect(src).not.toMatch(/callGemini|callLLM|openai|fetch\(/i);
  });
});

/**
 * v3.8.592 — 표 무결성 · 소제목이 약속한 내용
 *
 * ## 실측 사고 (발행글 5432)
 *   · 표2 `4,3,3,3` · 표3 `4,4,3,4` — 행마다 칸 수가 달라 표가 밀렸다
 *   · 섹션 5 제목이 "9월 대출규제 전 소비계획 점검"인데 본문에 그 얘기가 없었다
 *     (크롤에 섞인 9월 대출규제 뉴스가 제목으로만 승격)
 *
 * 발행글 5364 에서도 같은 병이 나왔다:
 *   "방문판매법 계속거래 규정의 이해" — 본문에 방문판매법이 한 번도 안 나온다
 */
describe('⑥ 표가 깨졌는지 본다 (v3.8.592)', () => {
  const { findBrokenTables } = require('../src/core/final/structure-guard');
  const row = (n: number) => `<tr>${'<td>값</td>'.repeat(n)}</tr>`;

  test('⭐ 실측 그 표 — 칸 수가 행마다 다르다', () => {
    const html = `<table>${row(4)}${row(3)}${row(3)}${row(3)}</table>`;
    const found = findBrokenTables(html);
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('4,3,3,3');
  });

  test('칸 수가 같으면 넘어간다', () => {
    expect(findBrokenTables(`<table>${row(3)}${row(3)}${row(3)}</table>`)).toHaveLength(0);
  });

  test('행이 하나뿐이면 비교할 게 없다', () => {
    expect(findBrokenTables(`<table>${row(3)}</table>`)).toHaveLength(0);
  });

  test('표가 여러 개면 각각 본다', () => {
    const html = `<table>${row(3)}${row(3)}</table><table>${row(4)}${row(2)}</table>`;
    expect(findBrokenTables(html)).toHaveLength(1);
  });

  test('th 로 된 머리행도 센다', () => {
    const html = '<table><tr><th>a</th><th>b</th><th>c</th></tr>' + row(2) + '</table>';
    expect(findBrokenTables(html)).toHaveLength(1);
  });
});

describe('⑦ 소제목이 약속한 내용이 본문에 있는가 (v3.8.592)', () => {
  const { findUnfulfilledHeadings } = require('../src/core/final/structure-guard');
  const body = (t: string) => `<p>${t.repeat(1)}${'내용을 채웁니다. '.repeat(12)}</p>`;

  test('⭐ 실측 그 소제목 — 방문판매법을 달고 본문엔 없다', () => {
    const html = '<h2>방문판매법 계속거래 규정의 이해</h2>' + body('환불 절차를 설명합니다.');
    const found = findUnfulfilledHeadings(html);
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('방문판매법');
  });

  test('본문이 다루면 넘어간다', () => {
    const html = '<h2>방문판매법 계속거래 규정의 이해</h2>' + body('방문판매법에 따른 계속거래 규정을 봅니다.');
    expect(findUnfulfilledHeadings(html)).toHaveLength(0);
  });

  /** 실측 오탐 — 조사가 붙은 어절을 핵심 명사로 집었다 */
  test('조사가 붙은 어절은 명사로 세지 않는다', () => {
    // detail 에는 소제목 원문도 인용되므로, **빠진 낱말 목록**만 떼어 본다
    const missingWords = (h: string) => findUnfulfilledHeadings(`<h2>${h}</h2>${body('다른 이야기를 씁니다.')}`)
      .map((i: any) => /약속한 내용\(([^)]*)\)/.exec(i.detail)?.[1] || '')
      .join(', ');

    expect(missingWords('등록 정보부터 대조하기')).not.toContain('정보부터');
    expect(missingWords('누락은 연결에서 생겨요')).not.toContain('연결에서');
    expect(missingWords('소견서나 진료확인서 제출')).not.toContain('소견서나');
    // 진짜 명사는 그대로 잡는다 — 조사 거르기가 검사를 무디게 만들면 안 된다
    expect(missingWords('소견서나 진료확인서 제출')).toContain('진료확인서');
  });

  /** 우리가 넣는 틀 제목은 내용을 약속하지 않는다 */
  test('틀 제목은 검사하지 않는다', () => {
    for (const h of ['성급한 분들을 위한 핵심 요약', '📌 전체 읽어보기 절차', '자주 묻는 질문 (FAQ)']) {
      expect(findUnfulfilledHeadings(`<h2>${h}</h2>${body('아무 내용')}`)).toHaveLength(0);
    }
  });

  test('본문이 거의 없으면 다른 검사에 맡긴다', () => {
    expect(findUnfulfilledHeadings('<h2>방문판매법 규정</h2><p>짧음</p>')).toHaveLength(0);
  });

  test('깨진 값에 던지지 않는다', () => {
    for (const bad of ['', null, undefined, '<h2>']) {
      expect(() => findUnfulfilledHeadings(bad as any)).not.toThrow();
    }
  });
});
