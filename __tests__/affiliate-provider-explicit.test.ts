/**
 * 제휴사를 사용자가 직접 고른다 — 링크 정규식 추측 제거 (v3.8.430)
 *
 * 사용자 요구: "쇼핑모드를 선택하면 버튼3개가 생기고 원하는 제휴사를 클릭하면
 *   그 제휴사의 하네스가 연동되서 최적의 글을 발행해주는거지 쿠팡은 수집한
 *   이미지로 발행 안 되니까 차별화해주고"
 *
 * 그동안은 붙여넣은 링크를 정규식으로 훑어 제휴사를 **추측**했다. 추측은 틀릴 수
 * 있고(단축 URL·리다이렉트·새 도메인), 틀리면 엉뚱한 제휴사의 대가성 문구가 붙는다.
 * 이제 고른 값이 곧 정답이다.
 *
 * ⚠️ 구버전 UI로 만들어 둔 대기열·예약 payload 에는 이 값이 없다.
 *    그 글들이 깨지면 안 되므로 **값이 없으면 기존 자동판별로 폴백**해야 한다.
 *    아래 테스트들은 그 폴백이 살아 있는지도 함께 잠근다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');
const posting = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'posting.js'), 'utf8');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const crawl = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'crawl.ts'), 'utf8');
const policies = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'policies.ts'), 'utf8');

/** policies.ts 의 AffiliateProviderId 와 글자 하나까지 같아야 한다 */
const IDS = ['coupang', 'toss-sharelink', 'naver-shopping-connect'];

describe('① UI — 제휴사 버튼 3개가 실존한다', () => {
  it('⭐ 세 제휴사 박스와 라디오가 모두 있다 (id 오타는 조용한 미배선의 단골 원인)', () => {
    for (const id of IDS) {
      expect(html).toContain(`id="provider-${id}-box"`);
      expect(html).toContain(`id="affprovider-${id}"`);
      expect(html).toContain(`value="${id}"`);
    }
  });

  it('⭐ 세 값이 policies.ts 의 AffiliateProviderId 와 정확히 일치한다', () => {
    for (const id of IDS) {
      expect(policies).toContain(`'${id}'`);
    }
  });

  it('⭐ 라디오 name 이 하나로 묶여 있다 (한 글에 한 제휴사 원칙)', () => {
    // ⚠️ /name="affiliateProvider"/ 로 세면 JS 셀렉터 문자열
    //   (querySelectorAll('input[name="affiliateProvider"]')) 까지 잡혀 6이 나온다.
    //   실제 <input> 태그만 센다.
    const count = (html.match(/type="radio"\s+name="affiliateProvider"/g) || []).length;
    expect(count).toBe(3);
  });

  it('기본 선택이 없다 — 사용자가 반드시 고르게 한다', () => {
    // checked 가 박혀 있으면 안 고르고 발행해도 쿠팡으로 조용히 나간다
    const boxes = html.slice(html.indexOf('id="affiliateProviderField"'), html.indexOf('id="affiliateLinkField"'));
    expect(boxes).not.toContain('checked');
  });
});

describe('② UI — 선택 동작과 쇼핑모드 연동', () => {
  it('⭐ selectAffiliateProvider 가 나머지를 명시적으로 해제한다', () => {
    const fn = braceBlock(html, 'function selectAffiliateProvider(provider) {');
    expect(fn).toContain("document.querySelectorAll('input[name=\"affiliateProvider\"]').forEach");
    expect(fn).toContain('r.checked = false');
    expect(fn).toContain("getElementById('affprovider-' + provider)");
  });

  it('⭐ 쇼핑모드를 벗어나면 선택을 초기화한다 (다음 글에 딸려가지 않게)', () => {
    const fn = braceBlock(html, 'function syncContentModeSections(mode) {');
    expect(fn).toContain("getElementById('affiliateProviderField')");
    expect(fn).toContain("mode !== 'shopping'");
  });

  it('제휴사별로 링크 칸 안내가 바뀐다 (어떤 링크를 넣을지 헷갈리지 않게)', () => {
    expect(html).toContain('AFFILIATE_PROVIDER_PLACEHOLDER');
    expect(html).toContain('AFFILIATE_PROVIDER_HINT');
  });

  it('⭐ 쿠팡만 이미지 전략이 다르다고 안내한다 (사용자 요구: "쿠팡은 차별화")', () => {
    expect(html).toContain('AI로 생성');
    expect(html).toContain('수집한 실제 상품 사진');
  });
});

describe('③ payload — 고른 값이 백엔드로 넘어간다', () => {
  it('⭐ createPayload 가 affiliateProvider 를 실어 보낸다', () => {
    expect(posting).toContain("document.querySelector('input[name=\"affiliateProvider\"]:checked')?.value");
    expect(posting).toContain('affiliateProvider:');
  });

  it('안 골랐으면 undefined 로 보낸다 — 빈 문자열로 잘못 켜지지 않게', () => {
    expect(blockBetween(posting, 'affiliateProvider: (() => {', '})(),')).toContain('picked || undefined');
  });
});

describe('④ 백엔드 — 태그가 있으면 추측하지 않는다 (없으면 폴백)', () => {
  it('⭐ payload.affiliateProvider 를 읽는다', () => {
    expect(orch).toContain("const explicitProvider = String((payload as any).affiliateProvider || '').trim();");
  });

  it('⭐ 쿠팡 판정: 태그 우선, 없으면 기존 정규식 그대로', () => {
    const block = blockBetween(orch, 'const coupangLink = explicitProvider', ';');
    expect(block).toContain("explicitProvider === 'coupang' ? affiliateAll[0] : undefined");
    // 폴백(구버전 payload 용)이 살아 있어야 한다
    expect(block).toContain('affiliateAll.find((u) => /coupang\\.com|coupa\\.ng/i.test(u))');
  });

  it('⭐ 비-쿠팡 판정도 같은 규칙 (태그 우선 → 정규식 폴백)', () => {
    const block = blockBetween(orch, 'const nonCoupangLinks = explicitProvider', ';');
    expect(block).toContain("explicitProvider === 'coupang' ? [] : affiliateAll");
    expect(block).toContain('affiliateAll.filter((u) => !/coupang\\.com|coupa\\.ng/i.test(u))');
  });

  it('⭐ 고지문 제휴사 판정도 태그를 먼저 본다', () => {
    const block = blockBetween(orch, 'const provider = (explicitProvider && getPolicy(explicitProvider)', ';');
    expect(block).toContain('AFFILIATE_PROVIDER_IDS.find');
  });

  it('크롤러 두 호출부 모두에 태그를 넘긴다', () => {
    const calls = orch.match(/crawlAffiliateLinks\([\s\S]{0,200}?\)/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) expect(c).toContain('expectedProvider');
  });
});

describe('⑤ 크롤러 — 태그를 맹신하지 않는다', () => {
  it('⭐ 넘어온 태그가 그 링크의 호스트와 실제로 맞을 때만 쓴다', () => {
    // 낡거나 잘못된 태그가 와도 엉뚱한 제휴사로 크롤하면 안 된다
    expect(crawl).toContain('opts.expectedProvider && getPolicy(opts.expectedProvider)?.linkHosts.test(clean)');
  });

  it('⭐ 맞지 않으면 기존 자동판별로 넘어간다', () => {
    const block = blockBetween(crawl, 'const provider = (opts.expectedProvider', 'if (!provider)');
    expect(block).toContain("['toss-sharelink', 'naver-shopping-connect', 'coupang']");
    expect(block).toContain('.find((id) => getPolicy(id)!.linkHosts.test(clean))');
  });

  it('CrawlOptions 에 expectedProvider 가 선언돼 있다', () => {
    const iface = braceBlock(crawl, 'export interface CrawlOptions {');
    expect(iface).toContain('expectedProvider?: AffiliateProviderId | undefined;');
  });
});
