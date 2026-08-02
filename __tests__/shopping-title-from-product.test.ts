/**
 * 쇼핑 제목 — 상품 등록명을 그대로 쓰지 않는다 (v3.8.404)
 *
 * 사용자 보고(2026-08-02):
 *   ✅ 제목 완료: "💡미끄러짐방지 쓰레기유입방지 시티가드 그레이팅안전덮개 대(600x500) 1개 팁"
 *   → 쿠팡 등록명을 통째로 쓰고 뒤에 "팁"만 붙었다.
 *
 * 원인: 프롬프트의 `키워드 "..."를 자연스럽게 포함` 규칙.
 *   v3.8.403 에서 상품명을 주제(keyword)로 넘겼더니, 그 긴 등록명을
 *   "제목에 그대로 넣으라"는 지시가 되어버렸다.
 *
 * 쇼핑몰 등록명은 **검색 노출을 노린 키워드 나열**이지 사람이 읽는 제목이 아니다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const gen = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'generation.ts'), 'utf8');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

describe('상품일 때는 제목 규칙이 달라진다', () => {
  it('productName 인자를 받는다', () => {
    expect(gen).toContain('productName?: string');
  });

  it('⭐ 등록명을 그대로 쓰지 말라고 못 박는다', () => {
    expect(gen).toContain('상품 등록명');
    expect(gen).toContain('그대로 쓰지 마세요');
  });

  it('⭐ 규격·수량·포장 단위를 빼라고 지시한다 (사용자가 겪은 "대(600x500) 1개")', () => {
    expect(gen).toContain('규격·치수·수량·포장 단위는 제목에서 빼세요');
    expect(gen).toContain('대(600x500)');
  });

  it('⭐ 핵심 제품 명사와 이점만 뽑으라고 예시까지 준다', () => {
    expect(gen).toContain('핵심 제품 명사');
    expect(gen).toContain('그레이팅 안전덮개');
  });

  it('⭐ 상품일 때는 "키워드를 그대로 포함" 규칙을 끈다 (이게 원인이었다)', () => {
    // 고정 길이 슬라이스는 프롬프트 문구가 늘면 깨진다 — 삼항의 끝을 경계로 잡는다
    const i = gen.indexOf('${productName ?');
    expect(i).toBeGreaterThan(-1);
    const end = gen.indexOf('자연스럽게 포함`}', i);
    expect(end).toBeGreaterThan(i);
    // 삼항의 else 쪽에만 기존 규칙이 남아야 한다
    // end 는 '자연스럽게 포함`}' 의 시작 위치 — 그 문구까지 포함해서 보면 충분하다
    expect(gen.slice(i, gen.indexOf('자연스럽게 포함`}', i) + 12)).toContain('` : `- 키워드 ');   // 삼항의 else 쪽
  });

  it('일반 글은 예전 규칙 그대로다 (동작을 바꾸지 않는다)', () => {
    expect(gen).toContain('키워드 "${keyword}"를 자연스럽게 포함');
  });
});

describe('orchestration 이 상품명을 넘긴다', () => {
  it('⭐ 쇼핑모드일 때만 상품명을 넘긴다', () => {
    const i = orch.indexOf('generateH1TitleFinal(');
    const block = braceBlock(orch, 'generateH1TitleFinal(');
    expect(block).toContain('resolvedProductName');
    expect(block).toContain("=== 'shopping'");
  });

  it('상품명을 못 얻었으면 undefined 로 넘긴다 (빈 문자열로 잘못 켜지지 않게)', () => {
    const i = orch.indexOf('generateH1TitleFinal(');
    expect(braceBlock(orch, 'generateH1TitleFinal(')).toContain("|| '') || undefined");
  });

  it('v3.8.403 에서 심은 resolvedProductName 을 쓴다', () => {
    expect(orch).toContain('(payload as any).resolvedProductName = productName');
  });
});
