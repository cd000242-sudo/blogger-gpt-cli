"use strict";
// electron/oneclick/config/selectors.ts
// 외부 사이트 CSS 셀렉터 중앙 관리
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCP_SELECTORS = exports.ZUM_SELECTORS = exports.BING_SELECTORS = exports.DAUM_SELECTORS = exports.NAVER_SELECTORS = exports.GSC_SELECTORS = exports.CLOUDWAYS_SELECTORS = exports.WORDPRESS_SELECTORS = exports.BLOGGER_SELECTORS = void 0;
// ─── Blogger / Blogspot ───────────────────────────────────────────────────────
exports.BLOGGER_SELECTORS = {
    // createBlog.ts — 블로그 생성
    newBlogText: 'text="새 블로그"',
    createBlogText: 'text="블로그 만들기"',
    newBlogLink: 'a:has-text("새 블로그"), a:has-text("New blog")',
    titleInput: 'input[aria-label*="제목"], input[aria-label*="Title"], input[placeholder*="제목"]',
    titleInputFallback: 'input[type="text"]',
    nextBtn: 'button:has-text("다음"), button:has-text("Next")',
    addressInput: 'input[aria-label*="주소"], input[aria-label*="Address"], input[aria-label*="URL"]',
    saveOrCreateBtn: 'button:has-text("저장"), button:has-text("Save"), button:has-text("만들기"), button:has-text("Create")',
    // optimizeSettings.ts — 설정 최적화
    settingsLink: 'a[href*="settings"], a:has-text("설정"), a:has-text("Settings")',
    descriptionSection: 'text="설명", text="Description"',
    descriptionTextarea: 'textarea, [contenteditable="true"]',
    saveBtn: 'button:has-text("저장"), button:has-text("Save")',
    commentSection: 'text="댓글", text="Comments"',
    hideOption: 'text="숨기기", text="Hide", [value="HIDE"]',
    timezoneSection: 'text="시간대", text="Time zone"',
    seoulOption: 'option:has-text("서울"), option:has-text("Seoul")',
    // metaGaAds.ts — 메타태그 / GA / ads.txt
    metaTagSection: 'text="메타태그", text="Meta tags"',
    metaToggle: '[role="switch"], [role="checkbox"]',
    metaTextareaOrInput: 'textarea, input[type="text"]',
    gaSection: 'text="Google 애널리틱스", text="Google Analytics"',
    gaInput: 'input[type="text"]',
    earningsLink: 'a:has-text("수익 창출"), a:has-text("Earnings"), a[href*="earnings"]',
    adsTxtSection: 'text="ads.txt"',
    adsTxtCustomToggle: '[role="switch"], [role="checkbox"]',
    adsTxtTextarea: 'textarea',
    // faviconUpload.ts — 파비콘 업로드
    faviconSection: 'text="파비콘", text="Favicon"',
    fileInput: 'input[type="file"]',
    // applySkinCSS.ts — 테마 HTML 에디터
    themeLink: 'a:has-text("테마"), a:has-text("Theme")',
    editHtmlBtn: 'button:has-text("HTML 편집"), button:has-text("Edit HTML")',
    codeEditor: '.CodeMirror, textarea, [contenteditable]',
    saveThemeBtn: 'button[aria-label*="저장"], button[aria-label*="Save"], button:has-text("💾")',
    // searchConsole.ts (Blogger 설정에서 GSC 연동)
    gscSection: 'text="Google Search Console", text="구글 서치 콘솔", text="Search Console"',
    domainInput: 'input[type="text"]',
    verifyBtn: 'button:has-text("확인"), button:has-text("Verify"), button:has-text("등록")',
};
// ─── WordPress ────────────────────────────────────────────────────────────────
exports.WORDPRESS_SELECTORS = {
    // wordpressSetup.ts — 설정 자동화
    cssPanelOrAdditionalCss: '[id*="custom_css"], li:has-text("추가 CSS"), li:has-text("Additional CSS")',
    cssTextarea: 'textarea.wp-editor-area, textarea[id*="custom-css"], .CodeMirror',
    postNameRadio: 'input[value="/%postname%/"], input[name="selection"][value*="postname"]',
    submitBtn: '#submit, input[type="submit"]',
    // wordpressConnect.ts — Application Password 생성
    wpAdminBarDisplayName: '#wp-admin-bar-my-account .display-name',
    userLoginInput: '#user_login',
    applicationPasswordsSection: '#application-passwords-section',
    applicationPasswordsSectionFallback: '.application-passwords',
    newAppPasswordNameInput: '#new_application_password_name',
    addNewAppPasswordBtn: '#do_new_application_password',
    newAppPasswordCode: '.new-application-password code',
    newAppPasswordValue: '#new-application-password-value',
    noticeSuccessCode: '.notice.notice-success code',
    appPasswordDisplayInput: '.application-password-display input',
};
// ─── Cloudways ────────────────────────────────────────────────────────────────
exports.CLOUDWAYS_SELECTORS = {
    // cloudwaysInfra.ts — 도메인 + SSL
    appLink: 'a[href*="/apps/"]',
    // 도메인 추가
    domainInput: 'input[placeholder*="domain"], input[placeholder*="Domain"], input[name*="domain"]',
    addDomainBtn: 'button:has-text("Add Domain"), button:has-text("도메인 추가"), button:has-text("Save"), button[type="submit"]',
    // SSL — 고유 ID 패턴 (appId를 런타임에 보간: `#_apps_${appId}_ssl_uid-field-1_ssl_email_field`)
    sslEmailFieldIdPattern: '#_apps_{appId}_ssl_uid-field-1_ssl_email_field',
    sslDomainFieldIdPattern: '#_apps_{appId}_ssl__ssl_domain_field',
    // SSL 폴백 셀렉터
    emailInputFallback: 'input[placeholder*="email"], input[type="email"]',
    sslDomainInputFallback: 'input[placeholder*="www.domain"], input[placeholder*="domain.com"]',
    // SSL 설치 버튼 / 결과 확인
    installCertBtn: 'button:has-text("Install Certificate"), button:has-text("인증서 설치")',
    certInstalledText: 'text="Certificate Installed"',
    installedSuccessText: 'text="Installed successfully"',
    alertSuccess: '.alert-success',
    successClass: '[class*="success"]',
};
// ─── Google Search Console (webmaster) ───────────────────────────────────────
exports.GSC_SELECTORS = {
    // googleSearchConsole.ts
    urlPrefixPanelKo: 'div:has-text("URL 접두어")',
    urlPrefixPanelEn: 'div:has-text("URL prefix")',
    urlInput: 'input[placeholder="https://www.example.com"]',
    urlInputFallback: 'input[placeholder*="example.com"]',
    continueBtnKo: 'button:has-text("계속"):not([disabled])',
    continueBtnEn: 'button:has-text("Continue"):not([disabled])',
    sitemapInput: 'input[type="text"]',
    submitBtnKo: 'button:has-text("제출")',
    submitBtnEn: 'button:has-text("Submit")',
    okBtnKo: 'button:has-text("확인")',
    okBtnEn: 'button:has-text("OK")',
    okBtnGotIt: 'button:has-text("Got it")',
    inspectInput: 'input[type="text"]',
    requestIndexingBtnKo: 'button:has-text("색인 생성 요청")',
    requestIndexingBtnEn: 'button:has-text("Request Indexing")',
};
// ─── Naver Search Advisor ─────────────────────────────────────────────────────
exports.NAVER_SELECTORS = {
    // naverSearchAdvisor.ts
    loginBtnKo: 'a:has-text("로그인")',
    loginBtnClass: '.login_area a',
    // 사이트 추가
    siteInput: 'input[placeholder*="사이트"]',
    siteInputUrl: 'input[type="url"]',
    siteInputClass: '.site_input input',
    addBtnKo: 'button:has-text("추가")',
    addBtnClass: '.btn_add',
    addBtnSubmit: 'button[type="submit"]',
    // 소유 확인 — HTML 태그 탭
    htmlTagTabA: 'a:has-text("HTML 태그")',
    htmlTagTabBtn: 'button:has-text("HTML 태그")',
    htmlTagTabLi: 'li:has-text("HTML 태그")',
    // 소유 확인 버튼
    ownerVerifyBtn: 'button:has-text("소유확인"), button:has-text("확인")',
    // 사이트맵
    sitemapInput: 'input[placeholder*="사이트맵"]',
    sitemapInputFallback: 'input[type="text"]',
    sitemapSubmitKo: 'button:has-text("확인")',
    sitemapSubmitKo2: 'button:has-text("제출")',
    // RSS
    rssInput: 'input[placeholder*="RSS"]',
    rssInputFallback: 'input[type="text"]',
    // 수집 요청
    reqInput: 'input[placeholder*="URL"]',
    reqInputFallback: 'input[type="text"]',
    reqBtn: 'button:has-text("수집 요청")',
    reqBtnFallback: 'button:has-text("확인")',
};
// ─── Daum Webmaster ───────────────────────────────────────────────────────────
exports.DAUM_SELECTORS = {
    // daumWebmaster.ts
    siteUrlInput: 'input[placeholder="사이트 URL"]',
    siteUrlInputFallback: 'input:near(:text("사이트 URL"))',
    pinInputAll: 'input[placeholder*="PIN"]',
    agreeCheckbox: 'input[type="checkbox"]',
    confirmBtn: 'button:has-text("확인")',
    authUrlInput: 'input[placeholder="사이트 URL"]',
    authPinInput: 'input[placeholder*="PIN코드 입력"]',
    authBtn: 'button:has-text("인증하기")',
};
// ─── Bing Webmaster ───────────────────────────────────────────────────────────
exports.BING_SELECTORS = {
    // bingWebmaster.ts
    signInBtnClass: 'button.signInButton',
    signInBtnText: 'button:has-text("Sign In")',
    // 사이트 추가
    addSiteInputUrl: 'input[placeholder*="URL"]',
    addSiteInputType: 'input[type="url"]',
    addSiteInputText: 'input[type="text"]',
    addBtnEn: 'button:has-text("Add")',
    addBtnKo: 'button:has-text("추가")',
    addBtnSubmit: 'input[type="submit"]',
    // 인증
    verifyBtnEn: 'button:has-text("Verify")',
    verifyBtnKo: 'button:has-text("확인")',
    // 사이트맵
    sitemapInput: 'input[placeholder*="sitemap"]',
    sitemapInputFallback: 'input[type="text"]',
    submitBtnEn: 'button:has-text("Submit")',
    submitBtnKo: 'button:has-text("제출")',
    // URL 제출
    urlSubmitTextarea: 'textarea',
    urlSubmitInput: 'input[type="text"]',
};
// ─── ZUM Webmaster ────────────────────────────────────────────────────────────
exports.ZUM_SELECTORS = {
    // zumWebmaster.ts
    loginBtnKo: 'a:has-text("로그인")',
    loginBtnClass: '.login',
    loginBtnSign: 'a:has-text("Sign")',
    // 사이트 등록
    siteInputUrl: 'input[placeholder*="URL"]',
    siteInputType: 'input[type="url"]',
    siteInputText: 'input[type="text"]',
    registerBtn: 'button:has-text("등록")',
    addBtn: 'button:has-text("추가")',
    submitBtn: 'button[type="submit"]',
    // RSS
    rssLink: 'a:has-text("RSS")',
    rssLinkHref: 'a[href*="rss"]',
    rssInput: 'input[type="text"]',
    rssInputPlaceholder: 'input[placeholder*="RSS"]',
    rssRegisterBtn: 'button:has-text("등록")',
    rssConfirmBtn: 'button:has-text("확인")',
    rssSubmitBtn: 'button[type="submit"]',
    // 수집 요청
    crawlLink: 'a:has-text("수집")',
    crawlLinkHref: 'a[href*="request"]',
    crawlLinkHref2: 'a[href*="crawl"]',
    reqInput: 'input[type="text"]',
    reqBtn: 'button:has-text("요청")',
    reqBtnFallback: 'button:has-text("확인")',
    reqBtnSubmit: 'button[type="submit"]',
};
// ─── Google Cloud Console (bloggerConnect) ────────────────────────────────────
exports.GCP_SELECTORS = {
    // bloggerConnect.ts — GCP 프로젝트 / OAuth / Blogger API
    projectNameInput: 'input[formcontrolname="projectName"], input[name="projectName"], #p6ntest-name-input, input[aria-label*="Project name"]',
    createBtnKo: 'button:has-text("만들기")',
    createBtnEn: 'button:has-text("CREATE")',
    createBtnEn2: 'button:has-text("Create")',
    // Blogger API 활성화
    enableBtnKo: 'button:has-text("사용")',
    enableBtnEn: 'button:has-text("ENABLE")',
    enableBtnEn2: 'button:has-text("Enable")',
    manageBtnKo: 'button:has-text("관리")',
    manageBtnEn: 'button:has-text("MANAGE")',
    manageBtnEn2: 'button:has-text("Manage")',
    // OAuth 동의 화면
    externalRadio: 'input[value="EXTERNAL"], label:has-text("외부"), label:has-text("External")',
    saveAndContinueBtnKo: 'button:has-text("저장 후 계속")',
    saveAndContinueBtnEn: 'button:has-text("SAVE AND CONTINUE")',
    saveAndContinueBtnEn2: 'button:has-text("Save and continue")',
    appNameInput: 'input[formcontrolname="displayName"], input[aria-label*="App name"], input[aria-label*="앱 이름"]',
    // OAuth 클라이언트 ID 생성
    createCredsBtnKo: 'button:has-text("사용자 인증 정보 만들기")',
    createCredsBtnEn: 'button:has-text("CREATE CREDENTIALS")',
    createCredsBtnEn2: 'button:has-text("Create credentials")',
    oauthOptionKo: 'a:has-text("OAuth 클라이언트 ID")',
    oauthOptionEn: 'a:has-text("OAuth client ID")',
    oauthOptionData: '[data-value="oauth-client-id"]',
    appTypeSelect: 'select, [role="listbox"], mat-select',
    desktopOptionKo: 'mat-option:has-text("데스크톱 앱")',
    desktopOptionEn: 'mat-option:has-text("Desktop app")',
    desktopOptionEn2: 'option:has-text("Desktop")',
    oauthClientNameInput: 'input[formcontrolname="displayName"], input[aria-label*="Name"], input[aria-label*="이름"]',
};
