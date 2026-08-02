/**
 * 반자동 발행 — URL 모드 지원 (v3.8.402)
 *
 * 사용자 보고(2026-08-02): "반자동 발행이 여전히 키워드를 입력해주세요 라고뜨는데?"
 *
 * 원인: 일반 발행(runPosting)은 URL 모드를 지원한다 —
 *   singleInputMode 가 'url' 이고 referenceUrl 에 http(s) 주소가 있으면
 *   키워드 없이 통과하고 백엔드가 URL 본문에서 키워드를 뽑는다.
 *   그런데 반자동은 keywordInput 만 보고 막았다. URL 기반으로 쓰는 사용자는
 *   반자동을 아예 쓸 수 없었다.
 *
 * (이 사용자는 실제로 URL 기반으로 쓴다 — 발행 로그에 "URL 기반 콘텐츠 생성 완료"가 찍힌다)
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const preview = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'preview.js'), 'utf8');
const posting = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'posting.js'), 'utf8');

describe('반자동도 일반 발행과 같은 입력 규칙을 쓴다', () => {
  it('판정 함수가 한 곳에 모여 있다', () => {
    expect(preview).toContain('function resolveTopicInput');
  });

  it('⭐ URL 모드 + 유효 URL 이면 키워드 없이 통과한다', () => {
    const i = preview.indexOf('function resolveTopicInput');
    const block = preview.slice(i, preview.indexOf('v3.8.357', i));
    expect(block).toContain("singleInputMode === 'url'");
    expect(block).toContain("startsWith('http://')");
    expect(block).toContain('ok: true, keyword: \'\'');
  });

  it('⭐ URL 모드인데 URL 이 없으면 URL 을 요구한다 (키워드가 아니라)', () => {
    const i = preview.indexOf('function resolveTopicInput');
    const block = preview.slice(i, preview.indexOf('v3.8.357', i));
    expect(block).toContain('URL 모드: 원본 URL을 입력해주세요.');
  });

  it('키워드 모드에서는 여전히 키워드를 요구한다', () => {
    const i = preview.indexOf('function resolveTopicInput');
    const block = preview.slice(i, preview.indexOf('v3.8.357', i));
    expect(block).toContain('키워드를 입력해주세요.');
  });

  it('⭐ 반자동 진입점이 그 판정을 쓴다 — keywordInput 만 보고 막지 않는다', () => {
    const i = preview.indexOf('export async function startSemiAutoPublish');
    const block = braceBlock(preview, 'export async function startSemiAutoPublish');
    expect(block).toContain('resolveTopicInput()');
    expect(block).not.toMatch(/if \(!keyword\) \{\s*alert\('키워드를 입력해주세요/);
  });

  it('미리보기 생성도 같은 판정을 쓴다', () => {
    const i = preview.indexOf('resolveTopicInput()');
    expect(i).toBeGreaterThan(-1);
    // 두 곳(미리보기 · 반자동)에서 모두 호출한다
    expect(preview.split('resolveTopicInput()').length - 1).toBeGreaterThanOrEqual(2);
  });

  it('⭐ 규칙이 일반 발행과 일치한다 (한쪽만 고치면 또 어긋난다)', () => {
    // 일반 발행 쪽 규칙 — 같은 키·같은 조건을 본다
    expect(posting).toContain("localStorage.getItem('singleInputMode')");
    expect(posting).toContain("singleInputMode === 'url' && hasValidUrl");
    expect(preview).toContain("localStorage.getItem('singleInputMode')");
  });

  it('localStorage 접근이 실패해도 죽지 않는다', () => {
    const i = preview.indexOf('function resolveTopicInput');
    const block = preview.slice(i, preview.indexOf('v3.8.357', i));
    expect(block).toContain('catch');
  });

  it('여러 줄 URL 중 하나만 유효해도 통과한다', () => {
    const i = preview.indexOf('function resolveTopicInput');
    const block = preview.slice(i, preview.indexOf('v3.8.357', i));
    expect(block).toContain("split('\\n')");
    expect(block).toContain('.some(');
  });
});
