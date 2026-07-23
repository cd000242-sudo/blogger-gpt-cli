/**
 * 회귀 방지: "URL로 생성"인데 이전에 키워드로 발행했던 주제로 글이 나오는 문제
 *
 * 원인 — URL 탭에서 키워드 입력란은 화면에서만 숨겨지고 값은 남는다. 그 값이 payload.topic으로
 * 넘어오면 url-content-generator의 effectiveKeyword(= keyword || 크롤링 제목)가 stale 키워드를
 * 우선 채택해 제목·H2·본문·태그·썸네일이 전부 이전 키워드 기준으로 생성된다.
 */
import fs from 'fs';
import path from 'path';
import { resolveUrlModeKeyword } from '../src/core/final/url-mode';

const readUiSource = (...segments: string[]) =>
  fs.readFileSync(path.join(process.cwd(), 'electron', 'ui', ...segments), 'utf8');

describe('resolveUrlModeKeyword — URL 모드 키워드 오염 차단', () => {
  it('URL 기반 생성이면 남아 있던 이전 키워드를 버린다', () => {
    expect(resolveUrlModeKeyword(true, '2026년 세금 추징과 탈세의 차이점')).toBe('');
  });

  it('URL 기반 생성이면 큐가 넣는 URL 라벨도 주제로 쓰지 않는다', () => {
    expect(resolveUrlModeKeyword(true, 'URL 1: leadernam.com/tax-guide')).toBe('');
  });

  it('키워드 모드(플래그 없음)에서는 키워드를 그대로 유지한다', () => {
    expect(resolveUrlModeKeyword(undefined, '블로그 수익화 방법')).toBe('블로그 수익화 방법');
    expect(resolveUrlModeKeyword(false, '블로그 수익화 방법')).toBe('블로그 수익화 방법');
  });

  it('문자열 "true" 등 느슨한 값은 URL 모드로 오인하지 않는다', () => {
    expect(resolveUrlModeKeyword('true', '블로그 수익화 방법')).toBe('블로그 수익화 방법');
    expect(resolveUrlModeKeyword(1, '블로그 수익화 방법')).toBe('블로그 수익화 방법');
  });

  it('URL 모드에서 키워드가 애초에 비어 있어도 빈 문자열을 유지한다', () => {
    expect(resolveUrlModeKeyword(true, '')).toBe('');
  });
});

/**
 * 렌더러 모듈(electron/ui/*.js)은 jest에서 import할 수 없어(ESM + DOM 전역) 소스 계약으로 검증한다.
 * 백엔드 헬퍼는 payload.urlBasedGeneration === true 일 때만 키워드를 버리므로,
 * 발행 경로 3종(단일/큐/스케줄)이 모두 이 플래그를 실어 보내는지가 회귀의 핵심이다.
 */
describe('URL 모드 플래그 전달 — 단일·큐·스케줄 3경로', () => {
  it('단일 발행: URL 모드면 숨겨진 키워드 입력란 값을 payload에서 제외한다', () => {
    const source = readUiSource('modules', 'posting.js');
    expect(source).toContain('function isUrlInputModeActive()');
    expect(source).toContain('const keywordValue = isUrlInputModeActive() ? \'\' : rawKeywordValue;');
    expect(source).toContain('const isUrlInputMode = isUrlInputModeActive();');
    expect(source).toContain('urlBasedGeneration: isUrlInputMode ? true : undefined,');
  });

  it('큐 발행: URL 라벨 항목을 판별해 urlBasedGeneration 플래그를 실어 보낸다', () => {
    const source = readUiSource('modules', 'publish-queue.js');
    expect(source).toContain('function isUrlBasedQueueItem(item)');
    expect(source).toContain('const urlBased = isUrlBasedQueueItem(item);');
    expect(source).toContain('urlBasedGeneration: urlBased ? true : undefined,');
    // 큐 항목 생성 시 URL 모드 여부를 항목에 저장해 두어야 재실행/복원 후에도 판별된다
    expect(source).toContain('urlBased: true,');
    expect(source).toContain('urlBased: keywordIsUrl,');
    expect(source).toContain('urlBased: entry.urlBased === true,');
  });

  it('스케줄 실행: 저장된 payload의 URL 모드 플래그를 재구성 payload로 넘긴다', () => {
    const source = readUiSource('script.js');
    expect(source).toContain('const scheduleUrlBasedGeneration = (schedule.urlBasedGeneration === true || storedPayload.urlBasedGeneration === true)');
    expect(source).toContain('urlBasedGeneration: scheduleUrlBasedGeneration,');
  });
});
