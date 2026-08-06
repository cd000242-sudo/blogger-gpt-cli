/**
 * v3.8.455 — 제목을 "궁금증·상황"으로 + 티스토리 썸네일 실패를 보이게
 *
 * 사용자 지적:
 *   "제목은 우리블로거들은 궁금증 해결을 해주는사람이야 그러면 이 궁금증과 상황이
 *    제목이되어야 제품이 잘팔리지않을까?? 글은 좋아도 손님이없으면 아무의미없는
 *    글이니까 … 색인되더라도 사람들이 클릭을 해야 하나라도 구매전환이되자나"
 *   "생성된글목록에 썸네일 안보이구요 블로그 홈에서도 썸네일이 안보입니다"
 *
 * 조사(멀티에이전트 + 적대적 검증)로 확인된 근본 원인:
 *   ① 검색자 실제 질문(지식인·자동완성)이 H2 생성에만 가고 제목에는 한 번도 안 갔다.
 *   ② 쇼핑 제목 few-shot 3개가 전부 `상품명 + 속성 + ~할까` 한 틀이라 모델이 표면
 *      형태를 베꼈다. 게다가 셋 다 에어컨 프레임(전기요금·소음·원룸)이었다.
 *   ③ 티스토리만 onLog 가 console.log 로 배선돼 썸네일 진단 문구가 앱에 안 왔다
 *      (Blogger 는 v3.8.385 에 emit 으로 고쳐졌는데 티스토리는 빠졌다).
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import { composeShoppingTitleDirective } from '../src/core/affiliate/buyer-concerns';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const gen = read('src/core/final/generation.ts');
const orch = read('src/core/final/orchestration.ts');
const coreIndex = read('src/core/index.ts');
const publisher = read('src/tistory/tistory-publisher.ts');

describe('① 검색자의 실제 질문이 제목까지 간다', () => {
  it('⭐⭐ generateH1TitleFinal 이 demandSignals 를 받는다', () => {
    const sig = blockBetween(gen, 'export async function generateH1TitleFinal(', '): Promise<string> {');
    expect(sig).toContain('demandSignals?: { userQuestions?: string[]; searchQueries?: string[] }');
  });

  it('⭐⭐ orchestration 이 실제로 넘긴다 (배선 누락 방지)', () => {
    const call = blockBetween(orch, 'h1 = await generateH1TitleFinal(', ');');
    expect(call).toContain('demandSignals');
  });

  /**
   * v3.8.468 에서 문구가 강해졌다 — "1순위 재료" → "다른 어떤 규칙보다 먼저".
   *
   * 사용자 지적: "제목에 상황이나 사람들의 실제 키워드에 관련된 겪는 문제가 있어야
   * 구글봇이나 네이버봇이 상위로 올려주지 않을까?? 검색량은 높고 저경쟁에서 싸워야 되니까".
   * 예전에는 이 블록이 아래 "제목 스타일(아키타입)" 선택과 **동등하게** 놓여 있어서
   * 모델이 스타일 쪽으로 새곤 했다. 이제 부딪히면 질문을 따르라고 못 박았다.
   */
  it('⭐ 프롬프트에서 검색자 질문이 다른 규칙보다 우선한다', () => {
    expect(gen).toContain('검색자가 실제로 물어본 것');
    expect(gen).toContain('다른 어떤 규칙보다 먼저');
    expect(gen).toContain('질문과 스타일이 부딪히면 질문을 따르세요');
  });

  it('⭐⭐ 저경쟁 롱테일을 노리도록 구체성을 요구한다', () => {
    // 넓은 말은 큰 사이트가 이미 차지하고 있다 — 검색자가 실제로 친 좁은 말이 들어가야 이긴다
    expect(gen).toContain('두루뭉실할수록 경쟁이 셉니다');
  });

  it('⭐ 질문이 없으면 아무 블록도 넣지 않는다 (빈 섹션으로 프롬프트를 더럽히지 않는다)', () => {
    const block = blockBetween(gen, '// v3.8.455: 검색자의 실제 질문을 제목 재료로', '})()}');
    expect(block).toContain("if (qs.length === 0 && kw.length === 0) return '';");
  });

  it('⭐⭐ 지어내기 금지가 함께 걸려 있다', () => {
    expect(gen).toContain('위 목록에 없는 걱정거리를 지어내지 마세요');
  });
});

describe('② 쇼핑 제목이 한 가지 틀로 굳지 않는다', () => {
  const directive = composeShoppingTitleDirective('브리즈 누비아 이동식 에어컨', []);

  it('⭐⭐ 좋은 예시가 상품명으로 시작하지 않는다', () => {
    const good = directive.slice(directive.indexOf('이런 꼴이면 좋습니다'), directive.indexOf('이런 꼴이면 실패입니다'));
    expect(good).not.toContain('브리즈 누비아');
  });

  it('⭐⭐ "~할까" 어미를 명시적으로 금지한다', () => {
    expect(directive).toContain('"~할까 / ~일까 / ~될까"로 끝내지 마세요');
  });

  it('⭐⭐ 상황이 앞자리라고 못 박는다', () => {
    expect(directive).toContain('맨 앞자리는 상황에 내주세요');
  });

  it('⭐ 예시를 그대로 베끼는 것도 막는다 (에어컨 프레임이 식품 글에 나오던 문제)', () => {
    expect(directive).toContain('이 상품의** 상황을 쓰세요');
  });

  it('⭐ 나쁜 예시는 여전히 상품명으로 보여준다 (대비가 있어야 학습된다)', () => {
    expect(directive).toContain('브리즈 누비아 이동식 에어컨 핵심 정리');
  });

  it('⭐ 상품명 강제 삽입을 요구하지 않는다 (등록명 그대로 쓰지 말라는 규칙과 충돌)', () => {
    expect(directive).not.toContain('반드시 한 번 넣');
  });
});

describe('③ 티스토리 썸네일 실패가 사용자에게 보인다', () => {
  it('⭐⭐ 티스토리도 emit 으로 로그를 넘긴다 (console.log 아님)', () => {
    const call = blockBetween(coreIndex, 'const { publishToTistory } = require', 'console.log(\'[PUBLISH] 티스토리 발행 결과:\'');
    expect(call).toContain('emit,');
    expect(call).not.toContain('(msg: string) => console.log(msg),');
  });

  it('⭐⭐ 대표이미지 지정 실패를 알린다 (예전엔 반환값을 버렸다)', () => {
    expect(publisher).toContain('const marked = await trySetUploadedImageAsRepresentative(page, onLog)');
    expect(publisher).toContain('대표이미지 지정 컨트롤을 찾지 못했습니다');
  });

  it('⭐⭐ 업로드 실패 시 목록 썸네일이 빈다는 것까지 설명한다', () => {
    expect(publisher).toContain('티스토리는 첨부된 이미지만 목록 썸네일로 씁니다');
  });

  it('⭐ 그래도 발행은 막지 않는다', () => {
    const fn = blockBetween(publisher, 'async function uploadThumbnailThroughTistoryEditor(', 'export function buildTistoryFinalHtml');
    expect(fn).not.toContain('throw new Error');
  });
});
