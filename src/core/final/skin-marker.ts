/**
 * skin-marker — 이 글이 앱 스킨(generateCSSFinal)을 싣고 있는가. (v3.8.749)
 *
 * ## 왜 필요한가
 * 스킨을 실은 글은 퍼블리셔가 **다시 칠하면 안 된다.** 스킨은 글 안(.bgpt-content)을 전부 꾸미는데,
 * 퍼블리셔가 h2·p·th… 에 인라인 style 을 박거나 접은 클래스(점수 0,4,0)를 얹으면 스킨을 이긴다.
 *
 * 실측(leadernam.com 5814): 스킨이 정한 h2 는 30px·먹색·위쪽 놋쇠 선인데, 실제로는
 * 26px·짙은 초록·왼쪽 6px 세로줄(워드프레스 퍼블리셔 디자인)로 그려졌다.
 * 블로거 퍼블리셔는 스킨 <style> 을 아예 지우고 자기 청록 디자인으로 바꿨다.
 *
 * ## 판정
 * `.bgpt-content` 규칙을 담은 <style> 이 하나라도 있으면 스킨을 실은 글이다.
 * 래퍼 클래스 글자만으로는 안 된다 — 스킨이 실제로 실려 있어야 글 모양이 보장된다.
 */

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;

export function carriesOrbitSkin(html: string): boolean {
  const src = String(html || '');
  for (const match of src.matchAll(STYLE_BLOCK)) {
    if (/\.bgpt-content\b/.test(match[1] || '')) return true;
  }
  return false;
}
