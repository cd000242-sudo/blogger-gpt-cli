/**
 * 원본 URL 칸에 들어온 제휴 링크 라우팅 (v3.8.402)
 *
 * 실측 사고(2026-08-02) — 사용자 발행 로그 그대로:
 *   [POSTING] 🔗 URL 모드 — 키워드 생략, URL 본문에서 자동 추출
 *   [PROGRESS] 4% - ✅ 쿠팡 제휴 딥링크 0개 변환 완료
 *   [PROGRESS] 2% - 🔗 URL 기반 완전 새로운 콘텐츠 생성 모드
 *   [PROGRESS] 15% - ✅ URL 분석 완료: "fRJGxvXas8..."      ← 단축코드가 주제가 됐다
 *   [PROGRESS] 20% - ⚡ URL 전용 빠른 생성: AI 통합 호출 1회로 …
 *
 * 무슨 일이 있었나:
 *   쿠팡 단축링크를 '원본 URL' 칸에 넣으면 urlOnlyMode 가 켜져
 *   **URL 분석 1회 호출로 글을 뽑고 즉시 반환**한다.
 *   그래서 쇼핑모드 파이프라인(쿠팡 API 상품·후기·스펙·제휴 컴플라이언스)이
 *   통째로 건너뛰어졌다. 쿠팡은 403 이라 분석기가 주제도 못 뽑았다.
 *
 * 제휴 링크는 '참고할 원본 글'이 아니라 '팔 상품'이다 — 경로를 갈라야 한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AFFILIATE_PROVIDER_IDS, getPolicy } from '../src/core/affiliate/policies';
import { blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

/** orchestration 이 쓰는 것과 같은 판정 */
const isAffiliate = (u: string) =>
  AFFILIATE_PROVIDER_IDS.some((id) => getPolicy(id)!.linkHosts.test(u));

describe('제휴 링크 판정', () => {
  it('⭐ 사용자가 실제로 넣은 쿠팡 단축링크를 제휴 링크로 본다', () => {
    expect(isAffiliate('https://link.coupang.com/a/fRJGxvXas8')).toBe(true);
    expect(isAffiliate('https://www.coupang.com/vp/products/9665577597')).toBe(true);
  });

  it('네이버·토스 링크도 제휴 링크다', () => {
    expect(isAffiliate('https://naver.me/I5w1Dexp')).toBe(true);
    expect(isAffiliate('https://smartstore.naver.com/x/products/1')).toBe(true);
    expect(isAffiliate('https://toss.im/_m/bMxjrwji')).toBe(true);
  });

  it('⭐ 일반 참고 URL 은 제휴 링크가 아니다 (뉴스·블로그를 뺏어오면 안 된다)', () => {
    expect(isAffiliate('https://news.naver.com/article/001/0012345678')).toBe(false);
    expect(isAffiliate('https://leadernam.com/post/123')).toBe(false);
    expect(isAffiliate('https://en.wikipedia.org/wiki/Rice_cooker')).toBe(false);
  });
});

describe('URL 칸의 제휴 링크는 상품 경로로 보낸다', () => {
  const block = orch.slice(
    orch.indexOf("원본 URL 칸에 들어온 **제휴 링크**"),
    orch.indexOf('const urlOnlyMode'),
  );

  it('제휴 링크를 URL 분석 대상에서 빼낸다', () => {
    expect(block).toContain('manualUrls.splice(i, 1)');
  });

  it('⭐ 뒤에서부터 지운다 — 앞에서 지우면 인덱스가 밀려 하나씩 건너뛴다', () => {
    expect(block).toContain('for (let i = manualUrls.length - 1; i >= 0; i -= 1)');
  });

  it('⭐ 빼낸 링크를 affiliateLinks 로 넘긴다', () => {
    expect(block).toContain('(payload as any).affiliateLinks =');
  });

  it('제휴 링크 칸에 이미 넣은 것이 있으면 덮어쓰지 않고 합친다', () => {
    expect(block).toContain('existing');
    expect(block).toContain('${existing}\\n${affiliateInUrls.join');
  });

  it('⭐ 제휴 링크만 넣으면 URL 전용 모드가 켜지지 않는다', () => {
    // manualUrls 에서 빠졌으므로 length 0 → urlOnlyMode false → 정상 쇼핑 파이프라인으로 간다
    const after = orch.slice(orch.indexOf('const urlOnlyMode'), orch.indexOf('const urlOnlyMode') + 400);
    expect(after).toContain('manualUrls.length > 0');
    expect(orch).toContain('제휴 링크만 넣은 경우에는 켜지지 않는다');
  });

  it('⭐ 쇼핑모드가 아니면 조용히 넘어가지 않고 이유를 알려준다', () => {
    expect(block).toContain('쇼핑모드가 아닙니다');
    expect(block).toContain('쇼핑/구매유도 모드로 바꿔 다시 발행하세요');
  });

  it('무슨 일이 일어났는지 로그로 남긴다', () => {
    expect(block).toContain('제휴 상품으로 처리합니다');
  });

  it('판정이 실패해도 기존 동작을 유지한다 (발행을 막지 않는다)', () => {
    expect(block).toContain('catch { /* 판정 실패 시 기존 동작 유지 */ }');
  });
});

/**
 * 쇼핑 글끼리 거미줄 (v3.8.402)
 *
 * 사용자 요구: "비슷한 제품들끼리 묶어서 거미줄치기도 가능하게 해야 되잖아"
 *
 * 문제였던 것:
 *   내부링크 검색이 keyword 하나로만 돌았다. 쇼핑 글은 제목이 상품명이라
 *   일반 키워드("여름")로는 "수영장 튜브" 글과 "물놀이 매트" 글이 서로 안 걸린다.
 *   그리고 관련 글 0개일 때의 최근글 폴백이 internal 모드에만 있었다.
 */
describe('쇼핑 글끼리 묶는 거미줄', () => {
  // ⚠️ '썸네일 생성' 문구는 URL 빠른 경로에도 있어 앞에서 먼저 잡힌다.
  //    반드시 내부링크 블록 **뒤에서부터** 끝 마커를 찾는다.
  const start = orch.indexOf('내부 링크 검색 및 삽입 중');
  const block = orch.slice(start, orch.indexOf("let thumbnailUrl = ''", start));

  it('⭐ 쇼핑모드는 상품명·카테고리로 형제 글을 찾는다', () => {
    expect(block).toContain('affiliateProducts?.[0]?.title');
    expect(block).toContain('coupangProducts?.[0]?.productName');
    expect(block).toContain('categoryName');
  });

  it('상품명으로 못 찾으면 키워드로도 시도한다 (순서대로 폴백)', () => {
    expect(block).toContain('[affTitle, apiTitle, apiCategory, keyword].filter(Boolean)');
    expect(block).toContain('for (const term of searchTerms)');
  });

  it('⭐ 쇼핑모드가 아니면 예전처럼 키워드만 쓴다 (동작을 바꾸지 않는다)', () => {
    expect(block).toContain(': [keyword]');
  });

  it('⭐ 관련 글이 0개여도 최근 글로 이어준다 — 쇼핑모드 포함', () => {
    expect(block).toContain("contentMode === 'internal' || contentMode === 'shopping'");
  });

  it('무엇을 기준으로 찾았는지 로그로 남긴다', () => {
    expect(block).toContain('기준으로 관련 상품 글');
  });

  it('애드센스 모드는 여전히 내부링크를 넣지 않는다 (승인 정책)', () => {
    expect(orch).toContain('애드센스 모드 — 내부 링크 삽입 생략');
  });
});

/**
 * 같은 링크 중복 조회 방지 (v3.8.404)
 *
 * 사용자 질문(2026-08-02): "근데 원본 URL이랑 제휴링크랑 둘 다 넣어야 되죠?"
 *   → 아니다. 하나만 넣으면 된다.
 *
 * 실측: 사용자가 양쪽에 넣어 로그에 "제휴 링크 2개 상품 정보 조회 중" 이 떴다.
 *   같은 상품을 두 번 여는 셈이고, 쿠팡은 반복 조회를 차단하므로 차단 위험이 두 배가 된다.
 */
describe('같은 링크는 한 번만 조회한다', () => {
  const block = orch.slice(
    orch.indexOf('const rawLinksAll'),
    orch.indexOf('if (rawLinks.length > 0'),
  );

  it('⭐ 중복 링크를 걸러낸다', () => {
    expect(block).toContain('const seenLinks = new Set<string>()');
    expect(block).toContain('if (seenLinks.has(norm)) continue');
  });

  it('⭐ 정규화해서 비교한다 — 끝 슬래시·http/https·쿼리로 갈리면 못 잡는다', () => {
    // 문자열 안의 정규식 슬래시는 두 번 escape 해야 소스와 같아진다
    expect(block).toContain('replace(/^https?:');
    expect(block).toContain("replace(/[?#].*$/, '')");
    expect(block).toContain('toLowerCase()');
  });

  it('중복을 걸렀으면 알려준다 (조용히 넘어가지 않는다)', () => {
    expect(block).toContain('중복이라 한 번만 조회합니다');
  });

  it('⭐ 서로 다른 링크는 그대로 둔다 (여러 상품 글을 막으면 안 된다)', () => {
    const norm = (u: string) => u.replace(/^https?:\/\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
    expect(norm('https://link.coupang.com/a/AAA')).not.toBe(norm('https://link.coupang.com/a/BBB'));
    // 같은 링크의 표기 차이는 같은 것으로 본다
    expect(norm('https://link.coupang.com/a/AAA/')).toBe(norm('http://link.coupang.com/a/AAA?x=1'));
  });

  it('UI 가 "한 곳에만 넣으면 된다"고 안내한다', () => {
    // v3.8.405: 쇼핑모드에서 원본 URL 칸을 아예 감추면서 문구도 바뀌었다
    const html = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');
    expect(html).toContain('상품 링크는 여기에만 넣으시면 됩니다');
  });
});

/**
 * 링크 입력 칸을 하나로 (v3.8.405)
 *
 * 사용자 지적(2026-08-02):
 *   "UI가 링크 넣을 곳이 두 군데인데 사람 심리상 두 군데 다 넣을 것 같거든. 헷갈려.
 *    둘 중 하나는 없애는 게 낫지 않니?"
 *
 * 맞는 지적이다. 실제로 양쪽에 넣어 쿠팡을 두 번 조회한 로그가 있었다
 * ("제휴 링크 2개 상품 정보 조회 중" — 상품은 하나였다).
 * 게다가 쇼핑모드에서 '원본 URL' 에 제휴가 아닌 참고 글을 넣으면
 * URL 전용 모드가 켜져 쇼핑 파이프라인을 통째로 건너뛴다 — 조용한 사고다.
 */
describe('쇼핑모드에서는 링크 칸이 하나다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');
  const block = blockBetween(html, "v3.8.405 — 쇼핑모드에서는 '원본 URL' 칸을 감춘다", '</script>');

  it('⭐ 쇼핑모드면 원본 URL 칸을 감춘다', () => {
    expect(block).toContain("refBlock.style.display = mode === 'shopping' ? 'none' : ''");
  });

  it('다른 모드에서는 그대로 보인다 (URL 기반 생성을 막으면 안 된다)', () => {
    expect(block).toContain(": ''");
  });

  it('⭐ 숨길 때 값을 흘리지 않는다 — 안 보이는 칸의 값이 따라다니면 안 된다', () => {
    expect(block).toContain("refInput.value = ''");
  });

  it('⭐ 숨기면서 제휴 링크면 옮겨준다 (사용자가 이미 넣어둔 걸 버리지 않는다)', () => {
    expect(block).toContain('affInput.value =');
    expect(block).toContain('coupang');
    expect(block).toContain('toss');
  });

  it('이미 같은 링크가 있으면 중복으로 넣지 않는다', () => {
    expect(block).toContain('!cur.includes(moved)');
  });

  it('안내 문구가 한 곳만 쓰라고 말한다', () => {
    expect(html).toContain('상품 링크는 여기에만 넣으시면 됩니다');
  });
});
