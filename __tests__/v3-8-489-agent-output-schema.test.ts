/**
 * v3.8.489 — 제목이 키워드로 떨어지던 버그의 뿌리를 막는다
 *
 * ## 원인
 * 제목은 metadata.json → 본문 H1 → (없으면) 키워드 순으로 정해진다.
 * 에이전트가 metadata.json 을 빠뜨리거나 H1 을 안 쓰면 **키워드가 제목이 된다.**
 * v3.8.485 에서 지시를 강화했지만, 지시는 지켜질 수도 안 지켜질 수도 있다.
 *
 * ## 고침
 * Codex 의 `--output-schema` 는 **마지막 응답**이 정해진 형태를 따르게 만든다(파일이 아니다).
 * 그래서 파일을 빠뜨려도 제목이 구조화된 채로 돌아온다.
 *
 * articleHtml 을 선택 필드로 둔 이유: 지시서에 "파일 쓰기가 막히면 텍스트로 출력하라" 는
 * 최후 수단이 있는데, 스키마를 강제하면 그 자유 텍스트 통로가 막힌다. 같은 역할을
 * 스키마 안에 넣어 최후 수단을 잃지 않게 했다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AGENT_OUTPUT_SCHEMA, parseAgentFinalResponse } from '../src/core/final/agent-output-schema';

const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf-8');

describe('① 스키마가 필요한 것을 요구한다', () => {
  it('⭐⭐ 제목과 요약은 필수다', () => {
    expect(AGENT_OUTPUT_SCHEMA.required).toContain('title');
    expect(AGENT_OUTPUT_SCHEMA.required).toContain('summary');
  });

  it('⭐⭐ 제목 설명에 키워드 복창 금지가 들어 있다', () => {
    expect(AGENT_OUTPUT_SCHEMA.properties.title.description).toContain('키워드를 그대로');
  });

  it('⭐⭐ 최후 수단(본문 회수)을 잃지 않는다', () => {
    expect(AGENT_OUTPUT_SCHEMA.properties.articleHtml).toBeDefined();
    // 필수가 되면 파일을 제대로 쓴 경우에도 본문을 두 번 만들게 된다
    expect(AGENT_OUTPUT_SCHEMA.required).not.toContain('articleHtml');
  });

  it('⭐ 참고 주소를 담을 자리가 있다', () => {
    expect(AGENT_OUTPUT_SCHEMA.properties.sources.type).toBe('array');
  });
});

describe('② 응답에서 값을 건져낸다', () => {
  it('⭐⭐ 정상 JSON 에서 제목을 얻는다', () => {
    const r = parseAgentFinalResponse('{"title":"실업급여, 등본 때문에 반려되는 경우","summary":"요약"}');
    expect(r.title).toBe('실업급여, 등본 때문에 반려되는 경우');
  });

  it('⭐⭐ 앞뒤에 설명이 붙어 와도 읽는다', () => {
    const r = parseAgentFinalResponse('작업 완료했습니다.\n{"title":"제목","summary":"요약"}\n감사합니다.');
    expect(r.title).toBe('제목');
  });

  it('⭐⭐ 주소가 아닌 것은 sources 에서 걸러낸다', () => {
    const r = parseAgentFinalResponse('{"title":"t","summary":"s","sources":["https://a.test","확인함","ftp://b"]}');
    expect(r.sources).toEqual(['https://a.test']);
  });

  it('⭐⭐ JSON 이 아니면 빈 값 (기존 경로가 그대로 동작해야 한다)', () => {
    expect(parseAgentFinalResponse('그냥 텍스트 응답입니다').title).toBe('');
    expect(parseAgentFinalResponse('').title).toBe('');
    expect(parseAgentFinalResponse(null as any).sources).toEqual([]);
  });

  it('⭐⭐ 망가진 JSON 에도 던지지 않는다', () => {
    expect(() => parseAgentFinalResponse('{"title": ')).not.toThrow();
    expect(parseAgentFinalResponse('{"title": ').title).toBe('');
  });

  it('⭐ 타입이 엉뚱하면 무시한다', () => {
    const r = parseAgentFinalResponse('{"title":123,"summary":null,"sources":"a"}');
    expect(r.title).toBe('');
    expect(r.sources).toEqual([]);
  });
});

describe('③ 실행 경로에 배선돼 있다', () => {
  it('⭐⭐ 스키마 파일을 job 폴더에 쓴다', () => {
    expect(mainTs).toContain("'output-schema.json'");
  });

  it('⭐⭐ Codex 에 --output-schema 를 넘긴다', () => {
    expect(mainTs).toContain("'--output-schema'");
  });

  it('⭐⭐ 파일이 없으면 플래그를 넣지 않는다 (없는 파일을 가리키면 실행이 깨진다)', () => {
    const idx = mainTs.indexOf("'--output-schema'");
    const block = mainTs.slice(idx - 300, idx + 200);
    expect(block).toContain('existsSync');
  });

  it('⭐⭐ 제목을 응답에서도 건진다 (metadata 를 빠뜨려도 키워드로 안 떨어진다)', () => {
    expect(mainTs).toContain('parseAgentFinalResponse(');
    expect(mainTs).toContain('metadata?.title || structured.title');
  });

  it('⭐⭐ 파일이 없을 때 본문을 응답에서 회수한다', () => {
    expect(mainTs).toContain('structured.articleHtml');
  });
});
