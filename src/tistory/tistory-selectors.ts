export const TISTORY_URLS = {
  login: 'https://www.tistory.com/auth/login',
  home: 'https://www.tistory.com/',
  manage: 'https://www.tistory.com/',
  write: (blogName: string) => `https://${blogName}.tistory.com/manage/newpost`,
  category: (blogName: string) => `https://${blogName}.tistory.com/manage/category`,
  // 📋 생성된 글목록 탭 — 관리 화면 글 목록 / 기존 글 편집 / 공개 글 주소
  managePosts: (blogName: string, page = 1) => `https://${blogName}.tistory.com/manage/posts?page=${page}`,
  // 티스토리 관리 화면 글목록 경로는 시기별로 달랐다(/manage/posts · /manage/post · /manage/entry).
  // 어느 것이 살아있는지 앱이 알 수 없으므로 순서대로 열어보고 글 링크가 잡히는 첫 주소를 쓴다.
  managePostsCandidates: (blogName: string, page = 1) => [
    `https://${blogName}.tistory.com/manage/posts?page=${page}`,
    `https://${blogName}.tistory.com/manage/post?page=${page}`,
    `https://${blogName}.tistory.com/manage/entry?page=${page}`,
  ],
  // 기존 글 편집은 /manage/post/{id} (관리 화면의 "수정" 링크와 동일). /manage/newpost/{id}는 신규 글 경로라 열리지 않는다.
  editPost: (blogName: string, postId: string) => `https://${blogName}.tistory.com/manage/post/${postId}`,
  entry: (blogName: string, postId: string) => `https://${blogName}.tistory.com/${postId}`,
};

export const TISTORY_SELECTORS = {
  login: {
    kakaoLoginButtons: [
      'a[href*="kakao"]',
      'button:has-text("카카오")',
      'a:has-text("카카오")',
      'text=카카오계정으로 로그인',
    ],
  },
  home: {
    writeLinks: [
      'a.link_tab[href*="/manage/newpost"]',
      'a[href*=".tistory.com/manage/newpost"]',
    ],
  },
  editor: {
    introModalCloseButtons: [
      '.layer_post_intro .btn_close',
      '.layer_post_intro button:has-text("닫기")',
      'button:has-text("닫기")',
      'button[aria-label="닫기"]',
    ],
    titleInputs: [
      'textarea#post-title-inp',
      '#post-title-inp',
      'textarea[placeholder*="제목"]',
      'input[placeholder*="제목"]',
      '[contenteditable="true"][data-placeholder*="제목"]',
    ],
    modeButtons: [
      '#editor-mode-layer-btn-open',
      '[data-button-type="mode"]',
      'button:has-text("기본모드")',
      'button:has-text("마크다운")',
      'button:has-text("HTML")',
      '.editor-mode button',
    ],
    htmlModeButtons: [
      '#editor-mode-html',
      '#editor-mode-html-text',
      'button:has-text("HTML")',
      '[role="menuitem"]:has-text("HTML")',
      'li:has-text("HTML")',
      'text=HTML',
    ],
    htmlEditors: [
      '#html-editor',
      'textarea#html-editor',
      'textarea[name="html"]',
      'textarea[data-mode="html"]',
      'textarea.tx-source',
      'textarea.CodeMirror-code',
      '.CodeMirror textarea',
      '.cm-content[contenteditable="true"]',
    ],
    richEditors: [
      '.contents_style[contenteditable="true"]',
      '.editor-content[contenteditable="true"]',
      '[contenteditable="true"]',
      'iframe',
    ],
    imageUploadButtons: [
      'button[aria-label*="사진"]',
      'button[title*="사진"]',
      'button[aria-label*="이미지"]',
      'button[title*="이미지"]',
      'button[aria-label*="그림"]',
      'button[title*="그림"]',
      'button[aria-label*="Image"]',
      'button[title*="Image"]',
      '[role="button"][aria-label*="사진"]',
      '[role="button"][title*="사진"]',
      '.mce-i-image',
      '.mce-i-photo',
      '.mce-i-picture',
      '[class*="image" i]',
      '[class*="photo" i]',
    ],
    // v3.8.708 첨부 버튼이 연 메뉴에서 "사진" 항목 (실측 id: #attach-image)
    imageMenuItems: [
      '#attach-image',
      '.mce-menu-item[id*="image" i]',
      '[role="menuitem"][id*="image" i]',
    ],
    imageFileInputs: [
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="png"]',
      'input[type="file"][accept*="jpg"]',
      'input[type="file"][accept*="jpeg"]',
      'input[type="file"]',
    ],
    categoryTriggers: [
      'button#category-btn',
      '[data-category-trigger]',
      'button:has-text("카테고리")',
      '.category button',
    ],
    /**
     * 🏷️ v3.8.704 — 후보를 넓힌다.
     *
     * 사장님: "발행 실패: Tistory tag input was not found or tags could not be added."
     *
     * 예전엔 셋뿐이었고 그중 한글 placeholder 규칙은 **이스케이프가 깨져 있었다**
     * (`태그` 가 글자 그대로 들어가 CSS 가 한글로 읽지 못했다 — 이 파일 60곳이 그랬다).
     * 사실상 `input#tagText` 하나로 버티고 있었고, 티스토리가 그 id 를 바꾸면 발행이 멈춘다.
     */
    tagInputs: [
      'input#tagText',
      'input[name="tag"]',
      'input[name="tagText"]',
      'input[placeholder*="태그"]',
      'input[aria-label*="태그"]',
      '.tag_post input',
      '.inp_tag input',
      '.box_tag input[type="text"]',
      '#tagInput',
      '[data-testid="tag-input"]',
    ],
    tempSaveButtons: [
      '#temp-save-btn',
      '#save-btn',
      '#save-button',
      '#draft-btn',
      'button[id*="save"]',
      'button[id*="draft"]',
      'button[class*="save"]',
      '.btn_save',
      '.btn-draft',
      'button:has-text("임시저장")',
      'button:has-text("저장")',
      'button#temp-save-btn',
    ],
    publishButtons: [
      '#publish-layer-btn',
      'button#publish-layer-btn',
    ],
    publishConfirmButtons: [
      '#publish-btn',
      '.layer_publish #publish-btn',
      'button#publish-btn',
      '.layer_publish button:has-text("발행")',
      '.layer_publish button:has-text("공개 발행")',
      'button:has-text("공개 발행")',
      'button:has-text("발행")',
    ],
    // 기존 글 수정발행 시 확인 버튼 — 새 글은 "발행", 수정은 "수정"으로 라벨이 바뀐다
    updateConfirmButtons: [
      '#publish-btn',
      '.layer_publish #publish-btn',
      'button#publish-btn',
      '.layer_publish button:has-text("수정")',
      '.layer_publish button:has-text("공개 발행")',
      '.layer_publish button:has-text("발행")',
      'button:has-text("수정")',
      'button:has-text("발행")',
    ],
    visibility: {
      public: [
        'input[name="visibility"][value="20"]',
      ],
      private: [
        'input[name="visibility"][value="0"]',
      ],
      protected: [
        'input[name="visibility"][value="15"]',
      ],
    },
  },
};
