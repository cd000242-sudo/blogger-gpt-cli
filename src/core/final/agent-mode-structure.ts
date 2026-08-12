/**
 * agent-mode-structure — 에이전트에게 "이 모드는 이렇게 쓰는 글"이라고 알려준다.
 *
 * ## 왜 필요한가
 * 에이전트 지시서는 contentMode 를 아예 읽지 않았다. 실측(2026-08-12):
 *   shopping / 쇼핑 0건, coupang / 쿠팡 0건, adsense 0건, paraphrasing 0건.
 * 그래서 쇼핑 모드로 돌려도 정보성 글이 나왔다.
 *
 * ## 구성을 베끼지 않는다
 * 모드별 섹션 목록은 이미 mode-registry 에 등록돼 있다(API 경로가 쓰는 그것).
 * 여기서 다시 적으면 한쪽만 고쳐진다 — 레지스트리에서 읽어 문장으로 풀어 쓴다.
 *
 * 등록되지 않은 모드는 빈 문자열을 돌려준다. 없는 구성을 지어내지 않는다.
 */
import { getMode } from '../content-modes/mode-registry';

/**
 * 모드 플러그인은 파일을 import 할 때 스스로 레지스트리에 등록한다(부수 효과).
 * 아무도 부르지 않으면 레지스트리가 비어 있어 getMode 가 전부 undefined 를 돌려주고,
 * 그러면 이 모듈이 **조용히 빈 문자열만** 뱉는다 — 에러 없이 기능이 죽는다.
 * 그래서 여기서 직접 불러 등록을 보장한다.
 */
import '../content-modes/adsense/adsense-mode';
import '../content-modes/shopping/shopping-mode';
import '../content-modes/external/external-mode';
import '../content-modes/internal/internal-mode';
import '../content-modes/paraphrasing/paraphrasing-mode';

/** 섹션 하나를 사람이 읽는 지시문으로 푼다 */
function describeSection(index: number, section: any): string {
  const lines = [`${index + 1}. **${section?.title || '(제목 없음)'}**`];
  if (section?.role) lines.push(`   역할: ${section.role}`);
  if (section?.contentFocus) lines.push(`   핵심: ${section.contentFocus}`);
  const reqs = Array.isArray(section?.requiredElements) ? section.requiredElements : [];
  if (reqs.length > 0) {
    lines.push('   필수 요소:');
    for (const r of reqs) lines.push(`     - ${r}`);
  }
  if (section?.minChars) lines.push(`   최소 ${section.minChars}자`);
  return lines.join('\n');
}

/**
 * 모드별 글 구성을 지시문으로 만든다.
 * API 경로가 쓰는 것과 **같은 레지스트리**에서 읽으므로, 모드를 고치면 양쪽이 함께 바뀐다.
 */
export function buildModeStructureBlock(contentMode: string, keyword: string): string {
  try {
    const mode = getMode(String(contentMode || '').trim());
    if (!mode) return '';

    const cfg = mode.config || ({} as any);
    const sections = Array.isArray(mode.sections) ? mode.sections : [];

    const head = [
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `🧭 **[이 글의 모드: ${cfg.name || contentMode}]**`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      cfg.description ? `${cfg.description}` : '',
      cfg.titleStrategy ? `· 제목 방향: ${cfg.titleStrategy}` : '',
      cfg.sectionStrategy ? `· 구성: ${cfg.sectionStrategy}` : '',
      cfg.tone ? `· 톤: ${cfg.tone}` : '',
      cfg.ctaStrategy ? `· CTA: ${cfg.ctaStrategy}` : '',
      '',
    ].filter(Boolean);

    const body = sections.length > 0
      ? [
        `**"${keyword}" 를 아래 구성으로 씁니다. 섹션마다 역할과 필수 요소를 지키세요.**`,
        '',
        ...sections.map((s: any, i: number) => describeSection(i, s)),
        '',
        '⚠️ 위 구성은 이 모드의 뼈대입니다. 소제목 문구는 이 글의 내용에 맞게 다시 지으세요 —',
        '   목록의 제목을 그대로 베끼면 다른 글과 똑같아집니다.',
      ]
      : [];

    return [...head, ...body].join('\n');
  } catch {
    return '';
  }
}
