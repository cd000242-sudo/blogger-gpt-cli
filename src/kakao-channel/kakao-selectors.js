// src/kakao-channel/kakao-selectors.js
// v3.8.511 — 카카오 비즈니스(business.kakao.com) 소식 자동 발행 셀렉터.
// 2026-08-17 실측 확정 (로그인 세션으로 소식 작성 화면 DOM 덤프 — 스크린샷·JSON 보존).
// 주의: 화면은 Shadow DOM — querySelector 로는 안 보이고 playwright locator 만 뚫는다.

'use strict';

const KAKAO_URLS = {
  dashboard: (channelId) => `https://business.kakao.com/${channelId}/dashboard`,
  // 소식 작성 화면 직행 (실측: "소식 올리기" 클릭 시 이 주소로 이동)
  posts: (channelId) => `https://business.kakao.com/${channelId}/posts`,
  channelHome: (channelId) => `https://pf.kakao.com/${channelId}`,
};

const KAKAO_SELECTORS = {
  // URL 로 로그인 여부 판정 — 로그아웃이면 accounts.kakao.com 으로 튕긴다
  loggedOutUrlPattern: /accounts\.kakao\.com/,
  loggedInUrlPattern: /business\.kakao\.com/,
  // 작성 폼 (2026-08-17 실측값)
  titleInput: 'input[placeholder="제목"]',
  bodyInput: 'textarea[type="creator"]',      // 본문 0/2000 텍스트박스
  linkTabText: '링크',                          // 첨부 탭: 사진/동영상/링크/쿠폰/카드뷰 (btn_tab)
  linkInputCandidates: ['input[placeholder*="URL"]', 'input[placeholder*="주소"]', 'input[placeholder*="링크"]', 'input[type="url"]', 'input[placeholder*="http"]'],
  // 발행 버튼은 정확히 "등록" — 목록의 "등록순" 버튼과 substring 매칭되면 안 된다 (실측에서 확인)
  submitExactText: '등록',
  submitClass: 'btn_rc_highlight',
};

// 도배 = 채널 제재 리스크 (계획서 확정값). 바꾸려면 계획서부터.
const DAILY_CAP = 2;

module.exports = { KAKAO_URLS, KAKAO_SELECTORS, DAILY_CAP };
