/**
 * 쇼핑모드 — 제목보다 상품을 먼저 확정한다 (v3.8.403)
 *
 * 실측 사고(2026-08-02) — 사용자 로그 그대로:
 *   [02:20:04] ✅ 제목 완료: "💡 와플래시 게임 아카이브 실행 안 될 때 해결법 총정리"
 *   [02:20:17] 🛒 쿠팡 파트너스 API: 실제 상품 데이터 조회 중...
 *   [02:20:17] ℹ️ 쿠팡 검색 결과 없음
 *
 * 무슨 일이 있었나:
 *   쿠팡 링크를 넣었는데 **키워드 칸에 남아 있던 이전 키워드**가 글의 주제가 됐다.
 *   그 키워드로 쿠팡 API 를 검색하니 0개였고, 결과가 0개라
 *   productId 대조 구제 경로는 실행조차 못 했다. 상품명·가격·후기가 하나도 안 붙었다.
 *
 * 원인은 **순서**다 — 제목 생성(25%)이 상품 조회(41%)보다 먼저였다.
 * 링크에서 상품명을 먼저 알아내 주제로 삼으면 그 뒤가 전부 풀린다.
 *
 * 사용자 요구: "제목도 쇼핑모드면 그 제품에 딱 맞는 제목으로 최적화되어서 생성해줘야 돼요"
 */
import * as fs from 'fs';
import * as path from 'path';
import { cleanProductName, isSameProduct } from '../src/core/affiliate/coupang-enrich';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const enrich = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'coupang-enrich.ts'), 'utf8');

describe('페이지 제목에서 상품명만 뽑는다', () => {
  it('⭐ 실측 형태 — 쿠팡이 붙이는 꼬리를 걷어낸다', () => {
    expect(cleanProductName('수영장 에어 탱크 물총 튜브 워터파크 물놀이 바닷가 - 대형/패밀리풀장 | 쿠팡'))
      .toBe('수영장 에어 탱크 물총 튜브 워터파크 물놀이 바닷가');
    expect(cleanProductName('쿠쿠 전기보온 에그밥솥 6인용 - 전기밥솥 | 쿠팡'))
      .toBe('쿠쿠 전기보온 에그밥솥 6인용');
  });

  it('꼬리가 없으면 그대로 둔다', () => {
    expect(cleanProductName('몽크로스 초강력 바디팬')).toBe('몽크로스 초강력 바디팬');
  });

  it('빈 값에 안전하다', () => {
    expect(cleanProductName('')).toBe('');
    expect(cleanProductName(null as any)).toBe('');
  });
});

describe('이름을 모를 때는 교차검증을 건너뛴다', () => {
  it('⭐ API 상품명이 비면 페이지가 이름의 출처다 — 대조 실패로 보면 안 된다', () => {
    expect(enrich).toContain('apiProductName ? isSameProduct(apiProductName, pageInfo.title) : true');
  });

  it('이름을 알 때는 여전히 대조한다 (엉뚱한 상품 후기 차단)', () => {
    expect(isSameProduct('쿠쿠 전기보온 에그밥솥 6인용', '삼성 갤럭시 Z폴드8 - 휴대폰 | 쿠팡')).toBe(false);
  });
});

describe('제목보다 상품을 먼저 확정한다', () => {
  const block = orch.slice(
    orch.indexOf('**제목을 짓기 전에** 상품을 확정한다'),
    orch.indexOf('🔥 URL 전용 모드'),
  );

  it('⭐ 상품 확정이 제목 생성보다 앞선다', () => {
    const resolveAt = orch.indexOf('**제목을 짓기 전에** 상품을 확정한다');
    const titleAt = orch.indexOf('AI가 제목(H1) 생성 중');
    expect(resolveAt).toBeGreaterThan(-1);
    expect(titleAt).toBeGreaterThan(resolveAt);      // 순서가 뒤집히면 같은 사고가 재발한다
  });

  it('링크에서 productId 를 뽑아 상품명을 얻는다', () => {
    expect(block).toContain('resolveCoupangProductId(coupangLink)');
    expect(block).toContain("enrichCoupangProduct(pid, ''");   // 이름을 모르는 상태로 호출
    expect(block).toContain('cleanProductName');
  });

  it('⭐ 상품명을 글의 주제로 삼는다 (그래야 제목이 상품에 맞는다)', () => {
    expect(block).toContain('keyword = productName');
    expect(block).toContain('(payload as any).topic = productName');
  });

  it('⭐ 주제를 바꿨으면 무엇에서 무엇으로 바꿨는지 알린다', () => {
    expect(block).toContain('쇼핑 글이라 주제를 상품으로 바꿉니다');
  });

  it('쇼핑모드가 아니면 건드리지 않는다', () => {
    expect(block).toContain("contentMode || '') === 'shopping'");
  });

  it('쿠팡 링크가 없으면 돌지 않는다', () => {
    expect(block).toContain('coupangLink && ');
  });

  it('⭐ 실패해도 발행을 막지 않는다', () => {
    expect(block).toContain('계속 진행');
    expect(block).toContain('catch (nameErr: any)');
  });

  it('⭐ 브라우저를 두 번 열지 않는다 — 뒤 단계가 결과를 재사용한다', () => {
    expect(block).toContain('(payload as any).coupangEnrichment = enriched');
    expect(orch).toContain('already.productId === pid');
  });

  it('keyword 가 재할당 가능해야 한다', () => {
    expect(orch).toContain('let keyword = payload.topic');
  });
});

describe('쇼핑 글에는 공공기관 근거를 모으지 않는다', () => {
  it('⭐ 쇼핑모드에서 CSE 수집을 건너뛴다', () => {
    expect(orch).toContain("cseKey && cseCx && contentMode !== 'shopping'");
  });

  it('왜 빼는지 근거가 적혀 있다', () => {
    const i = orch.indexOf('쇼핑 글에는 공공기관 근거를 모으지 않는다');
    expect(braceBlock(orch, '쇼핑 글에는 공공기관 근거를 모으지 않는다')).toContain('상품 스펙과 구매자 후기');
  });

  it('다른 모드는 그대로 수집한다 (할루시네이션 차단은 유지)', () => {
    expect(orch).toContain('collectOfficialSources(keyword, cseKey, cseCx, onLog)');
  });
});
