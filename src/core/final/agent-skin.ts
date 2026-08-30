/**
 * agent-skin — 에이전트가 쓴 글에도 **같은 얼굴**을 입힌다. (v3.8.606)
 *
 * ## 사장님 요청
 * "응 에이전트 글도 같은 스킨 입혀줘"
 *
 * ## 왜 안 걸려 있었나
 * 스킨(generateCSSFinal)은 orchestration 이 본문을 조립할 때 `<style>` 블록으로 실린다.
 * 그런데 **에이전트 모드는 orchestration 을 타지 않는다** — 지시서를 CLI 에 넘기고
 * 결과 HTML 만 회수한다. 그래서 실측(발행글 5445)에서 이렇게 나왔다:
 *   `<style>` 블록 0개 · `bgpt-content` 래퍼 없음 · 인라인 스타일 167개
 * 즉 API 모드 글만 「먹과 놋쇠」였고 에이전트 글은 예전 얼굴 그대로였다.
 *
 * ## 무엇을 하나
 *   ① 에이전트 결과의 바깥 요소에 `bgpt-content` 를 **더한다**(교체가 아니라 추가).
 *      스킨 선택자가 전부 `.bgpt-content …` 로 시작하기 때문이다.
 *   ② 그 앞에 스킨 `<style>` 블록을 붙인다.
 *
 * ## 두 번 입히지 않는다
 * 이미 `bgpt-content` 가 있거나 스킨 표식이 보이면 그대로 돌려준다.
 * 글목록의 "다시 생성"으로 같은 글이 여러 번 지나갈 수 있다.
 */

/** 스킨이 이미 입혀졌는지 알아보는 표식 — generateCSSFinal 이 항상 넣는 문자열 */
const SKIN_MARK = 'bgpt-content';

export interface AgentSkinResult {
  html: string;
  /** 입혔는지 — 로그용 */
  applied: boolean;
  reason: string;
}

/**
 * 에이전트 HTML 에 스킨을 입힌다.
 *
 * @param html 에이전트가 돌려준 본문
 * @param styleBlock generateCSSFinal() 결과 (`<style>…</style>`)
 */
export function applyOrbitSkinToAgentHtml(html: string, styleBlock: string): AgentSkinResult {
  const src = String(html || '');
  if (!src.trim()) return { html: src, applied: false, reason: '본문이 비어 있습니다' };
  if (src.includes(SKIN_MARK)) return { html: src, applied: false, reason: '이미 스킨이 입혀져 있습니다' };

  const style = String(styleBlock || '').trim();

  /**
   * 바깥 요소에 클래스를 **더한다.**
   * 에이전트는 보통 `<article class="bgpt-wp-ready bgpt-codex-workshop">` 로 시작한다.
   * 그 클래스들은 다른 곳(퍼블리셔 가드 등)이 보고 있으므로 지우면 안 된다.
   */
  const withClass = src.replace(
    /^(\s*<(article|div|section)\b[^>]*?)(\sclass="([^"]*)")?([^>]*>)/i,
    (match, head: string, _tag: string, classAttr: string | undefined, classes: string | undefined, tail: string) => {
      if (classAttr === undefined) return `${head} class="${SKIN_MARK}"${tail}`;
      return `${head} class="${classes} ${SKIN_MARK}"${tail}`;
    },
  );

  // 바깥 요소를 못 찾았으면(평문 조각) 감싸 준다
  const body = withClass.includes(SKIN_MARK) ? withClass : `<div class="${SKIN_MARK}">${src}</div>`;

  return {
    html: style ? `${style}\n${body}` : body,
    applied: true,
    reason: style ? '스킨 CSS 와 클래스를 입혔습니다' : '클래스만 입혔습니다 (CSS 없음)',
  };
}
