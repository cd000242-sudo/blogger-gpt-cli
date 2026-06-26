# 리더스 프로 크몽 이미지형 상세페이지 제작 키트

이 폴더는 `leaders-pro-kmong-final`의 확정 텍스트를 기준으로 만든 이미지형 상세페이지 제작/내보내기 키트입니다.

## 기준 파일

- `leaders-pro-kmong-final/kmong-copy-paste-final.md`
- `leaders-pro-kmong-final/package-table-final.md`
- `leaders-pro-kmong-final/faq-final.md`
- `leaders-pro-kmong-final/final-risk-check-report.md`

## 산출물 구조

- `src/index.html`: 이미지형 상세페이지 렌더링 원본
- `src/styles.css`: 섹션별 디자인 스타일
- `src/export.js`: 실제 앱 화면 캡처 및 섹션 PNG export 스크립트
- `prompts/gpt-image-2-prompts.md`: GPT Image 2 배경/그래픽 생성용 프롬프트
- `captures/raw/`: 원본 앱 화면 캡처
- `captures/safe/`: 민감정보가 없거나 마스킹 처리된 캡처
- `export/main/00-main-image.png`: 크몽 메인이미지
- `export/detail/*.png`: 상세페이지 섹션 이미지
- `export/check-report.md`: 최종 위험/품질 점검 보고서
- `export/upload-order.md`: 크몽 업로드 순서

## 실행

```powershell
node leaders-pro-kmong-visual/src/export.js
```

Playwright Chromium 실행 권한이 필요한 환경에서는 권한 승인이 필요합니다.

## 캡처 원칙

- 상세페이지에는 `captures/safe` 버전만 사용합니다.
- 실제 앱 UI가 실행되지 않거나 외부 앱이 필요한 화면은 가짜로 만들지 않고 `check-report.md`에 캡처 불가 사유를 기록합니다.
- 아이디, 비밀번호, 라이선스코드, API 키, 계정명, 개인정보는 이미지에 노출하지 않습니다.
