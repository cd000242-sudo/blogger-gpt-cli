/**
 * 보이는 링크 칸이 곧 '원본 URL' 이다 (v3.8.410)
 *
 * 사용자 보고(2026-08-02), 화면 그대로:
 *   제휴 링크 칸에 https://link.coupang.com/a/fSFaSF1ggS 를 넣고 발행 →
 *   "URL 모드: 원본 URL을 입력해주세요."
 *
 * 원인 — v3.8.405 에서 칸은 합쳤는데 검증은 안 합쳤다.
 *   쇼핑모드는 '원본 URL' 칸을 감추고 '제휴 링크' 칸 하나로 받게 바꿨다.
 *   그런데 URL 모드 검증은 여전히 referenceUrl 만 봤다.
 *   숨긴 칸은 영영 비어 있으니, 링크를 제대로 넣어도 절대 통과할 수 없었다.
 *
 * 이 테스트는 **소스 문자열이 아니라 실제 판정 함수를 실행**한다.
 * 브라우저 모듈이라 document·localStorage 를 세워주고 함수 본문만 떼어 돌린다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const preview = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'preview.js'), 'utf8');
const posting = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'posting.js'), 'utf8');
const uiHtml = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');

const COUPANG = 'https://link.coupang.com/a/fSFaSF1ggS';

/** 판정 함수를 실제로 실행한다 — 두 칸의 값과 입력 모드를 준다. */
function judge(referenceUrl: string, affiliateLinks: string, mode: string) {
  const body = braceBlock(preview, 'function resolveTopicInput()');
  const doc = {
    getElementById: (id: string) =>
      ({ referenceUrl: { value: referenceUrl }, affiliateLinks: { value: affiliateLinks } } as any)[id] || null,
  };
  const store = { getItem: () => mode };
  // eslint-disable-next-line no-new-func
  return new Function('document', 'localStorage', `${body}; return resolveTopicInput();`)(doc, store);
}

describe('URL 모드 — 제휴 링크 칸도 원본 URL로 인정한다', () => {
  it('⭐ 실측 재현 — 제휴 칸에만 링크가 있어도 통과한다', () => {
    expect(judge('', COUPANG, 'url')).toEqual({ ok: true, keyword: '' });
  });

  it('원본 URL 칸에 넣던 기존 방식도 그대로 통과한다', () => {
    expect(judge(COUPANG, '', 'url')).toEqual({ ok: true, keyword: '' });
  });

  it('양쪽 다 넣어도 통과한다 (두 군데 넣는 사람도 막지 않는다)', () => {
    expect(judge(COUPANG, COUPANG, 'url').ok).toBe(true);
  });

  it('⭐ 둘 다 비면 여전히 막는다 — 검증이 무력해지면 안 된다', () => {
    const r = judge('', '', 'url');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('원본 URL');
  });

  it('http:// 가 아닌 값은 URL 로 치지 않는다', () => {
    expect(judge('', '그냥 텍스트', 'url').ok).toBe(false);
  });

  it('키워드 모드에서는 링크가 키워드를 대신하지 않는다', () => {
    const r = judge('', COUPANG, 'keyword');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('키워드');
  });

  it('키워드가 있으면 링크와 무관하게 통과한다', () => {
    const body = braceBlock(preview, 'function resolveTopicInput()');
    const doc = { getElementById: (id: string) => (id === 'keywordInput' ? { value: '에어 튜브' } : null) };
    // eslint-disable-next-line no-new-func
    const r = new Function('document', 'localStorage', `${body}; return resolveTopicInput();`)(doc, { getItem: () => 'url' });
    expect(r).toEqual({ ok: true, keyword: '에어 튜브' });
  });
});

describe('발행 경로도 같은 규칙을 쓴다', () => {
  it('⭐ runPosting 검증이 제휴 칸을 함께 본다', () => {
    // 판정이 preview 에만 있고 posting 이 옛 규칙이면, 미리보기는 되는데 발행만 막힌다
    expect(posting).toContain("document.getElementById('affiliateLinks')?.value || ''");
  });

  it('URL 보유 판정 헬퍼도 제휴 칸을 본다', () => {
    const hits = posting.split('\n')
      .filter((l) => l.includes("getElementById('affiliateLinks')?.value || ''"));
    expect(hits.length).toBeGreaterThanOrEqual(2);   // 발행 검증 + 헬퍼
  });
});

describe('UI 문구가 사실과 맞는다', () => {
  it('⭐ 칸 이름이 원본 URL 역할을 겸한다고 알려준다', () => {
    expect(uiHtml).toContain('🔗 원본 URL · 제휴 링크');
  });

  it('숨겨진 칸을 찾아 헤매지 않도록 설명한다', () => {
    expect(uiHtml).toContain("이 칸이 위 '원본 URL' 칸을 <b>대신합니다</b>");
    expect(uiHtml).not.toContain("쇼핑모드에서는 위 '원본 URL' 칸이 숨겨집니다");
  });
});
