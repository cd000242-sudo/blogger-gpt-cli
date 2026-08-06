/**
 * v3.8.467 — 같은 키워드로 써도 다른 글이 나오게 (중복문서 회피)
 *
 * 사용자 지적: "내 툴로 같은 키워드로 작성하는 사람들은 전부 중복문서에 걸릴수도
 * 있다는거자나" · "뼈대자체를 … 여러가지 구조를 추가해서 랜덤으로 생성되게 하면
 * 되지않나".
 *
 * ## 조사로 확정한 것 — 순서 섞기는 효과가 없다
 * 구글의 근접중복 판정은 셰인글링(겹치는 단어 묶음)으로 지문을 만들고, 그 지문은
 * **집합 기반이라 순서와 무관**하다. 문단을 섞어도 같은 단어 묶음이면 유사도는
 * 그대로다. mode-dispatcher 의 애드센스 Fisher-Yates 셔플이 그 한계였다.
 * → 순서가 아니라 **다루는 각도**를 바꿔야 한다.
 *
 * ## 실측 근거 (self-overlap.ts 주석)
 * 발행글 322편 51,681쌍 중 유사도 0.35 초과 11쌍이 전부 같은 주제 반복이었다
 * (청년내일저축계좌 4편 0.40~0.55).
 */
import * as fs from 'fs';
import * as path from 'path';
import { planVariedSections, seedFrom, SECTION_ANGLE_VARIANTS } from '../src/core/max-mode/section-variants';
import {
  INTERNAL_CONSISTENCY_SECTIONS,
  SEO_OPTIMIZED_MODE_SECTIONS,
} from '../src/core/max-mode/mode-sections-extended';

const root = path.join(__dirname, '..');
const dispatcher = fs.readFileSync(path.join(root, 'src/core/final/mode-dispatcher.ts'), 'utf-8');
const orchestration = fs.readFileSync(path.join(root, 'src/core/final/orchestration.ts'), 'utf-8');

const ids = (secs: Array<{ id: string }>) => secs.map((s) => s.id);
const plan = (mode: string, base: any[], site: string, kw = '전기요금 절약') =>
  planVariedSections(mode, base, seedFrom(kw, site, mode));

describe('① 같은 키워드라도 사이트가 다르면 다른 각도로 쓴다', () => {
  it('⭐⭐ 세 플랫폼의 소제목 구성이 서로 다르다', () => {
    const t = ids(plan('internal', INTERNAL_CONSISTENCY_SECTIONS, 'leadernam.tistory.com').sections);
    const w = ids(plan('internal', INTERNAL_CONSISTENCY_SECTIONS, 'myblog.wordpress.com').sections);
    const b = ids(plan('internal', INTERNAL_CONSISTENCY_SECTIONS, 'myblog.blogspot.com').sections);
    const unique = new Set([t.join('|'), w.join('|'), b.join('|')]);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('⭐⭐ 원래 뼈대에서 최소 2개 섹션이 다른 각도로 바뀐다', () => {
    // 1개만 바뀌면 5섹션 중 4섹션이 그대로라 유사도가 충분히 안 떨어진다
    const base = INTERNAL_CONSISTENCY_SECTIONS;
    const out = plan('internal', base, 'siteA').sections;
    const changed = out.filter((s, i) => s.id !== base[i]!.id).length;
    expect(changed).toBeGreaterThanOrEqual(2);
  });

  it('⭐⭐ 바뀐 섹션은 표현만 다른 게 아니라 다루는 축이 다르다', () => {
    const out = plan('internal', INTERNAL_CONSISTENCY_SECTIONS, 'siteA').sections;
    const variants = out.filter((s) => s.id.startsWith('variant_'));
    expect(variants.length).toBeGreaterThanOrEqual(2);
    for (const v of variants) {
      expect(String(v.contentFocus || '').length).toBeGreaterThan(10);
      expect((v.requiredElements || []).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('② 글의 알맹이는 지킨다', () => {
  it('⭐⭐ 첫 섹션(도입)과 마지막 섹션(마무리)은 그대로다', () => {
    const base = INTERNAL_CONSISTENCY_SECTIONS;
    const out = plan('internal', base, 'siteA').sections;
    expect(out[0]!.id).toBe(base[0]!.id);
    expect(out[out.length - 1]!.id).toBe(base[base.length - 1]!.id);
  });

  it('⭐⭐ 핵심 정보 섹션은 어떤 시드에서도 빠지지 않는다', () => {
    // "정보를 주려면 확실하게 줘야 되니까" — 각도를 벌리려다 알맹이를 빼면 안 된다
    for (const site of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const out = ids(plan('internal', INTERNAL_CONSISTENCY_SECTIONS, site).sections);
      expect(out).toContain('core_knowledge');
    }
    for (const site of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const out = ids(plan('seo', SEO_OPTIMIZED_MODE_SECTIONS, site).sections);
      expect(out).toContain('concept_definition');
      expect(out).toContain('core_features');
    }
  });

  it('⭐ 섹션 수는 변하지 않는다 (분량이 줄면 글이 얄팍해진다)', () => {
    const base = INTERNAL_CONSISTENCY_SECTIONS;
    expect(plan('internal', base, 'siteA').sections).toHaveLength(base.length);
  });

  it('⭐ 최소 분량이 지나치게 깎이지 않는다', () => {
    for (const site of ['a', 'b', 'c', 'd', 'e']) {
      for (const sec of plan('internal', INTERNAL_CONSISTENCY_SECTIONS, site).sections) {
        expect(sec.minChars).toBeGreaterThanOrEqual(500);
      }
    }
  });
});

describe('③ 결정적이고 안전하다', () => {
  it('⭐⭐ 같은 키워드+같은 사이트는 늘 같은 구조 (다시 뽑을 때마다 바뀌면 혼란스럽다)', () => {
    const a = ids(plan('internal', INTERNAL_CONSISTENCY_SECTIONS, 'sameSite').sections);
    const b = ids(plan('internal', INTERNAL_CONSISTENCY_SECTIONS, 'sameSite').sections);
    expect(a).toEqual(b);
  });

  it('⭐⭐ 같은 사이트라도 키워드가 다르면 구조가 달라질 수 있다', () => {
    const seen = new Set<string>();
    for (const kw of ['전기요금 절약', '청년내일저축계좌', '추석 연휴 진료', '자동차 보험 갱신', '전세 계약 주의사항']) {
      seen.add(ids(plan('internal', INTERNAL_CONSISTENCY_SECTIONS, 'siteA', kw).sections).join('|'));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('⭐⭐ 변형 후보가 없는 모드는 원래 뼈대 그대로 (발행을 막지 않는다)', () => {
    const base = INTERNAL_CONSISTENCY_SECTIONS;
    const r = planVariedSections('알수없는모드', base, 12345);
    expect(r.sections).toBe(base);
    expect(r.changes).toEqual([]);
  });

  it('⭐ 섹션이 너무 적으면 손대지 않는다', () => {
    const tiny = INTERNAL_CONSISTENCY_SECTIONS.slice(0, 3);
    expect(planVariedSections('internal', tiny, 999).sections).toBe(tiny);
  });

  it('⭐ 모드마다 조합이 충분히 많다 (후보가 적으면 사이트끼리 같은 조합이 겹친다)', () => {
    for (const [mode, pool] of Object.entries(SECTION_ANGLE_VARIANTS)) {
      expect(pool.length).toBeGreaterThanOrEqual(5);
      // 서로 다른 id 여야 한다
      expect(new Set(pool.map((p) => p.id)).size).toBe(pool.length);
      expect(mode.length).toBeGreaterThan(0);
    }
  });
});

describe('④ 배선 — 값이 실제로 전달된다', () => {
  it('⭐⭐ 효과 없는 순서 셔플이 제거됐다', () => {
    // 지문이 순서 무관이라 셔플은 중복 방지에 효과가 없었다.
    // 주석에는 경위가 남아 있으므로 코드 형태로 검사한다.
    const code = dispatcher.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(code).not.toMatch(/\[middle\[i\], middle\[j\]\]/);
    expect(code).not.toMatch(/Math\.random\(\)\s*\*\s*\(i \+ 1\)/);
    expect(code).toContain('planVariedSections');
  });

  it('⭐⭐ orchestration 이 사이트 식별자를 넘긴다 (안 넘기면 조용히 무효)', () => {
    expect(orchestration).toContain('siteKey: siteKeyForVariation');
    expect(dispatcher).toContain('siteKey?: string');
    expect(dispatcher).toContain("seedFrom(keyword, options?.siteKey, contentMode)");
  });
});
