// src/core/external-traffic/prompts/messenger/kakao-channel-parse.js
/**
 * v3.8.523 — 카카오톡 채널 마커 출력 파서.
 *
 * 사장님 화면 보고: 결과창에 "===A안 (수치형)===", "[헤드라인]", "[본문]" 이 그대로 나오고
 * A안 본문만 중간에 끊긴 채 끝났다.
 * 원인: 프롬프트는 처음부터 이 마커 형식으로 A/B/C 3안을 요구했는데 **파싱하는 쪽이 없었다.**
 * 인스타·스레드에는 구조화 파서가 있는데 카카오 채널만 빠져 있었다(조용한 미배선).
 *
 * 카카오 소식 작성 폼은 제목·본문·버튼·링크가 각각 다른 칸이므로 칸별로 나눠 돌려준다.
 * 형식이 깨져도 절대 던지지 않는다 — 검수 때문에 발행이 막히면 안 된다는 원칙.
 */

'use strict';

/** ===A안 (…)=== 블록으로 자른다. 라벨(수치형/충격수치형…)은 모델이 바꿔 써도 받아준다. */
function splitVariantBlocks(text) {
  const marks = [];
  const re = /===\s*([ABC])\s*안[^=]*===/g;
  let match;
  while ((match = re.exec(text))) {
    marks.push({ key: match[1], end: re.lastIndex, start: match.index });
  }
  return marks.map((mark, i) => ({
    key: mark.key,
    block: text.slice(mark.end, i + 1 < marks.length ? marks[i + 1].start : text.length),
  }));
}

/**
 * [라벨] 다음부터 다음 대괄호 라벨 전까지를 한 칸으로 본다.
 * 본문이 여러 줄이어도 이어 붙는다 — 예전엔 첫 줄만 보여 글이 끊긴 것처럼 보였다.
 */
function readField(block, name) {
  const pattern = new RegExp('\\[' + name + '\\]([\\s\\S]*?)(?=\\n\\s*\\[[가-힣A-Za-z]+\\]|$)');
  const match = pattern.exec(block);
  if (!match) return '';
  return String(match[1] || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseKakaoChannelVariants(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n');
  const blocks = splitVariantBlocks(text);
  if (!blocks.length) return [];
  return blocks
    .map(({ key, block }) => ({
      key,
      headline: readField(block, '헤드라인'),
      body: readField(block, '본문'),
      buttonLabel: readField(block, '버튼라벨'),
      url: (readField(block, 'URL').match(/https?:\/\/\S+/) || [''])[0],
    }))
    .filter((variant) => variant.headline || variant.body);
}

/** 채널 모듈이 그대로 붙여 쓰는 구조화 응답 처리기 */
function processKakaoChannelResponse(rawText) {
  try {
    const variants = parseKakaoChannelVariants(rawText);
    if (!variants.length) return null; // 파싱 실패 시 기존 경로(원문 표시)로 둔다
    const first = variants[0];
    return {
      formatted: {
        parts: {
          headline: first.headline,
          body: first.body,
          buttonLabel: first.buttonLabel,
          url: first.url,
        },
      },
      extra: { kakaoChannel: { variants } },
    };
  } catch {
    return null; // 파서가 죽어도 발행은 막지 않는다
  }
}

module.exports = { parseKakaoChannelVariants, processKakaoChannelResponse };
