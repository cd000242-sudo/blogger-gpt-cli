"use strict";
/**
 * block-strings — 본문에 자동으로 들어가는 블록의 문구를 언어별로 모아 둔다.
 *
 * ## 왜 만드는가 (v3.8.562 · 하네스 E5)
 * v3.8.559 의 결론 블록과 v3.8.560 의 독자 확보 블록은 **한국어 문구가 코드에 박혀 있었다.**
 * 영어 사이트를 발행하면 영어 본문 사이에 "이런 글, 놓치지 않으려면" 이 그대로 나온다.
 *
 * 영어 발행에 필요한 일곱 가지 중 **이게 가장 싸고 눈에 바로 보인다.** 그래서 먼저 한다.
 * 프롬프트 97곳(E2)·CTA 목적지(E6)는 이 다음이다.
 *
 * ## 번역이 아니라 다시 쓴 것이다
 * "즐겨 보는 출처로 지정해 두면 …" 을 그대로 옮기면 영어로는 장황하다.
 * 영어권 기준(문장 15~20단어)에 맞춰 짧게 다시 썼다.
 *
 * ## 덤 — 조사도 고쳤다
 * 예전엔 `${사이트명}을(를)` 이라고 병기했다. 이제 받침을 보고 을/를 을 고른다.
 * 영어에는 조사가 없으니 이 처리 자체가 돌지 않는다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBlockLanguage = normalizeBlockLanguage;
exports.attachJosa = attachJosa;
exports.blockStrings = blockStrings;
/** 알 수 없는 값이 오면 한국어로 둔다 — 기존 동작을 바꾸지 않기 위해서다 */
function normalizeBlockLanguage(raw) {
    const value = String(raw ?? '').trim().toLowerCase();
    if (value === 'en' || value.startsWith('en-') || value.startsWith('en_') || value === 'english')
        return 'en';
    return 'ko';
}
/**
 * 받침이 있으면 앞 조사, 없으면 뒤 조사.
 * 한글 음절은 유니코드에서 (초성×21 + 중성)×28 + 종성 으로 배열돼 있어
 * 0xAC00 을 뺀 나머지를 28로 나눈 나머지가 곧 종성 번호다. 0 이면 받침이 없다.
 */
function attachJosa(word, withBatchim, withoutBatchim) {
    const text = String(word || '').trim();
    const last = text.charCodeAt(text.length - 1);
    if (!Number.isFinite(last) || last < 0xac00 || last > 0xd7a3) {
        // 한글이 아니면(영문·숫자로 끝나는 사이트명) 병기하지 않고 뒤 조사를 쓴다
        return withoutBatchim;
    }
    return (last - 0xac00) % 28 === 0 ? withoutBatchim : withBatchim;
}
const KO = {
    answerQuestionFallback: (keyword) => `${keyword}, 결론부터`,
    answerBasisLabel: '근거',
    audienceTitle: '이런 글, 놓치지 않으려면',
    audienceLine: (siteName) => `구글에서 <strong>${siteName}</strong>${attachJosa(siteName, '을', '를')} 즐겨 보는 출처로 지정해 두면, ` +
        `다음에 비슷한 내용을 찾을 때 검색 결과 위쪽에서 다시 만날 수 있습니다.`,
    audienceCta: '즐겨 보는 출처로 지정하기',
    audienceFollow: '모바일 크롬에서 이 페이지 메뉴의 <strong>팔로우</strong>를 누르면, 새 글이 올라올 때 크롬 첫 화면에 뜹니다.',
};
const EN = {
    answerQuestionFallback: (keyword) => `${keyword}: the short answer`,
    answerBasisLabel: 'Source',
    audienceTitle: "Don't want to miss the next one?",
    audienceLine: (siteName) => `Set <strong>${siteName}</strong> as a preferred source on Google. ` +
        `Next time you search for something like this, it shows up higher.`,
    audienceCta: 'Set as preferred source',
    audienceFollow: 'On mobile Chrome, tap <strong>Follow</strong> in the page menu to get new articles on your home screen.',
};
function blockStrings(language) {
    return language === 'en' ? EN : KO;
}
