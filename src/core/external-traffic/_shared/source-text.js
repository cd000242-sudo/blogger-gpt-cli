/**
 * v3.8.508 — 외부유입 원문 공급선.
 *
 * 발행 글 목록(localStorage 레지스트리)의 source 에는 본문이 없다 — title·url·thumbnail 뿐.
 * sourceText 가 빈 채로 가면 프롬프트의 7000자 본문 슬롯이 "(본문 없음)" 으로 나가고,
 * 모델은 실명할 사실이 없어 두루뭉실한 글만 쓴다 (2026-08-16 실물 검수에서 확인).
 * 여기서 원문 URL 을 직접 가져와 본문을 복원한다.
 * 실패는 조용히 원값 반환 — 원문을 못 가져왔다고 생성을 막지 않는다.
 */

const MIN_USEFUL_TEXT = 280; // 이보다 짧으면 "본문이 있다"고 볼 수 없다
const FETCH_TIMEOUT_MS = 6000;
const MAX_TEXT_LENGTH = 8000; // buildSourceInputBlock 의 7000자 슬롯 + 여유

function decodeBasicEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const num = Number(code);
      return num > 31 && num < 65536 ? String.fromCharCode(num) : ' ';
    })
    .replace(/&amp;/gi, '&');
}

function stripHtmlToText(html) {
  let scoped = String(html || '');
  // 본문 컨테이너가 있으면 그 안만 쓴다 — 메뉴·푸터·위젯이 사실 후보를 오염시키지 않게
  const article = scoped.match(/<article[\s\S]*?<\/article>/i);
  if (article) scoped = article[0];
  const text = scoped
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<(nav|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeBasicEntities(text)
    .replace(/[\t  ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

async function fetchArticleText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return '';
    const html = await res.text();
    return stripHtmlToText(html);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * sourceText 가 충분하면 그대로, 얇으면 sourceUrl 에서 본문을 가져온다.
 * @param {{ sourceText?: string, sourceUrl?: string }} params
 * @returns {Promise<string>}
 */
async function ensureSourceText(params = {}) {
  const existing = String(params.sourceText || '').trim();
  if (existing.length >= MIN_USEFUL_TEXT) return existing;
  const url = String(params.sourceUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return existing;
  const fetched = await fetchArticleText(url);
  // 가져온 게 기존보다 실속 있을 때만 교체
  return fetched.length > existing.length ? fetched : existing;
}

module.exports = { ensureSourceText, fetchArticleText, stripHtmlToText, MIN_USEFUL_TEXT };
