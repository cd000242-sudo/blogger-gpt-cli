// src/kakao-channel/kakao-selectors.js
// v3.8.510 — 카카오 비즈니스(business.kakao.com) 소식 자동 발행 셀렉터.
// UI 가 바뀌면 여기만 고친다 (티스토리 tistory-selectors 패턴).
// 실측: 2026-08-17 스크래치패드 kakao-measure (로그인 세션으로 DOM 덤프).

'use strict';

const KAKAO_URLS = {
  dashboard: (channelId) => `https://business.kakao.com/${channelId}/dashboard`,
  channelHome: (channelId) => `https://pf.kakao.com/${channelId}`,
};

const KAKAO_SELECTORS = {
  // URL 로 로그인 여부 판정 — 로그아웃이면 accounts.kakao.com 으로 튕긴다
  loggedOutUrlPattern: /accounts\.kakao\.com|login/i,
  loggedInUrlPattern: /business\.kakao\.com/,
  // 좌측 메뉴에서 포스트(소식) 화면으로 가는 링크 텍스트
  postMenuText: /포스트|소식/,
  // 목록 화면의 새 글 작성 버튼 텍스트
  composerOpenText: /포스트 작성|작성|만들기|등록/,
  // 작성 폼 — 실측 값으로 조정 (placeholder/aria 기반 폴백 포함)
  titleInputCandidates: ['input[placeholder*="제목"]', 'textarea[placeholder*="제목"]'],
  bodyInputCandidates: [
    'textarea[placeholder*="내용"]',
    '[contenteditable="true"]',
    'textarea',
  ],
  linkButtonText: /링크/,
  linkInputCandidates: ['input[placeholder*="URL"]', 'input[placeholder*="주소"]', 'input[placeholder*="링크"]', 'input[type="url"]'],
  submitText: /발행|게시|등록|완료/,
};

// 도배 = 채널 제재 리스크 (계획서 확정값). 바꾸려면 계획서부터.
const DAILY_CAP = 2;

module.exports = { KAKAO_URLS, KAKAO_SELECTORS, DAILY_CAP };
