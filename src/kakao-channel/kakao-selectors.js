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
  // 첨부 탭은 전부 button.btn_tab — 화면 다른 곳의 '링크' 텍스트 오클릭 방지 (실측)
  tabButton: 'button.btn_tab',
  // 첫 후보 = 정확 실측값 (2026-08-17). 뒤는 UI 문구 변경 대비 폴백.
  linkInputCandidates: ['input[placeholder="링크 (URL)을 입력해주세요."]', 'input[placeholder*="링크"]', 'input[placeholder*="URL"]', 'input[type="url"]'],
  // 발행 버튼은 정확히 "등록" — 목록의 "등록순" 버튼과 substring 매칭되면 안 된다 (실측에서 확인)
  submitExactText: '등록',
  submitClass: 'btn_rc_highlight',
  // 카드뷰(카드뉴스) 모달 — 2026-08-17 실이미지 업로드 실측
  cardViewTabText: '카드뷰',
  // 이미지 형태 (실측 2026-08-17): 세로형은 비율이 3:4 보다 길어야 통과 (권장 720×960~2880).
  //  - 인스타 4:5(1080×1350) → ❌ 거부됨 / kakao34(1080×1440) → ✅ 통과 (실물 업로드 검증)
  //  - 정사각형은 1:1 (720×720+) — kakao 1:1(1080×1080) 통과 검증.
  cardShapePortraitText: '세로형',
  cardShapeSquareText: '정사각형',
  cardFileInput: 'input[type="file"][accept*="jpeg"]', // setInputFiles 직접 주입 (첨부 클릭 불필요)
  cardTitleInput: 'input[placeholder="제목을 입력해주세요."]',   // 30자 한도
  cardBodyInput: 'textarea[placeholder="내용을 입력해주세요."]', // 600자 한도
  cardButtonYesText: '예',                                        // exact — "예약"과 충돌 방지
  cardButtonNameInput: 'input[placeholder="버튼명을 입력해주세요."]', // 16자 한도
  cardButtonUrlInput: 'input[placeholder^="예)"]',                // 연결할 곳 URL
  cardConfirmText: '확인',                                        // 모달 노란 버튼 (exact)
  cardUploadedMarker: '이미지가 첨부되었습니다',
  // 카드 추가 (두 번째 카드부터) — button.btn_upload > span.ico_rocket "카드 추가" (2026-08-17 DOM 실측)
  cardAddText: '카드 추가',
};

// 카드뷰 캐러셀 상한 (방어값 — 카카오 실상한 미확인, 사장님 카드뉴스는 7장)
const CARD_MAX = 10;

// 카드뷰 필드 한도 (실측)
const CARD_LIMITS = { title: 30, body: 600, buttonLabel: 16 };

// 도배 = 채널 제재 리스크 (계획서 확정값). 바꾸려면 계획서부터.
const DAILY_CAP = 2;

module.exports = { KAKAO_URLS, KAKAO_SELECTORS, CARD_LIMITS, CARD_MAX, DAILY_CAP };
