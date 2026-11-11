/**
 * Instruction sheet (instructions.md) handed to the Agent CLI for the spider post.
 *
 * Moved verbatim from the generate-internal-consistency handler in electron/main.ts so the Agent run can be
 * repeated (short-answer retry on the SAME engine) without copying 130 lines. Only the variable names changed:
 * the handler passes its values in, the text itself is untouched.
 * One later change (2026-11-11): the CTA button wording rule in section 9 (short topic word + action, 17px).
 */

/** Colour fields the sheet reads from the eye-comfort palette (the whole palette is also dumped as JSON). */
export interface SpiderAgentTheme {
  gradientStart: string;
  gradientEnd: string;
  primary: string;
  heading: string;
  ctaShadow: string;
  surfaceAlt?: string;
  borderSoft?: string;
  [key: string]: unknown;
}

export interface SpiderAgentInstructionInput {
  /** The full work order (the same prompt the Gemini path would get). */
  prompt: string;
  theme: SpiderAgentTheme;
  /** Number of source posts. */
  sourceCount: number;
  /** Inline style strings built by the handler (buildSpiderCtaBoxStyle / buildSpiderCtaButtonStyle). */
  ctaBoxStyle: string;
  ctaButtonStyle: string;
  /** YYYY-MM-DD, printed in the "Last updated" badge. */
  today: string;
}

export function buildSpiderAgentInstructions(input: SpiderAgentInstructionInput): string {
  const { prompt, theme, sourceCount, ctaBoxStyle, ctaButtonStyle, today } = input;
  const themeJson = JSON.stringify(theme, null, 2);
  return [
    '# LEADERNAM Orbit Spider-Web Agent — 끝판왕 통합글',
    '',
    '## 역할',
    '당신은 한국 cornerstone 거미줄 통합글 제작 에이전트입니다.',
    `여러 글(${sourceCount}개)을 분석해 **인라인 스타일이 모두 박힌 완성형 HTML 1편**을 \`result/article.html\`에 저장합니다.`,
    'API 키 호출자가 만드는 것보다 훨씬 정교하고 풍부한 디자인·구조·문체를 직접 작성합니다.',
    '',
    '## 디자인 시스템 (반드시 그대로 사용)',
    '아래 spiderTheme 색상을 모든 컴포넌트에 적용합니다. 다른 색 임의 사용 금지.',
    '```json',
    themeJson,
    '```',
    '',
    '## 작업지시서 (원본 거미줄 프롬프트 — 구조·콘텐츠 요구사항)',
    prompt,
    '',
    '## 끝판왕 인라인 스킨 — 컴포넌트별 명세 (반드시 이대로 박아 출력)',
    '',
    '### 1) 최상단 TL;DR 답변 박스 (H1 직후)',
    '```html',
    `<div style="background:linear-gradient(135deg,${theme.gradientStart},${theme.gradientEnd});border-left:5px solid ${theme.primary};border-radius:12px;padding:20px 24px;margin:18px 0 28px;box-shadow:0 4px 14px ${theme.ctaShadow};">`,
    `  <div style="font-size:13px;font-weight:900;color:${theme.primary};letter-spacing:0.05em;margin-bottom:8px;">📌 핵심 요약 (TL;DR)</div>`,
    '  <div style="font-size:16px;line-height:1.75;color:#1f2937;font-weight:600;">3~5문장으로 글 전체 정답·결론 요약</div>',
    '</div>',
    '```',
    '',
    '### 2) Last updated 배지 (TL;DR 다음)',
    '```html',
    '<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(0,0,0,0.04);border-radius:999px;font-size:12px;color:#6b7280;font-weight:700;margin-bottom:20px;">',
    `  <span style="color:${theme.primary};">🕒</span> Last updated: ${today}`,
    '</div>',
    '',
    '### 3) H2 섹션 카드 (각 H2 시작)',
    '```html',
    `<h2 style="font-size:26px;font-weight:900;color:${theme.heading};margin:40px 0 16px;padding:14px 18px;background:linear-gradient(90deg,${theme.gradientStart} 0%,transparent 100%);border-left:6px solid ${theme.primary};border-radius:8px;line-height:1.4;">H2 제목</h2>`,
    '```',
    '',
    '### 4) H3 sub-section',
    '```html',
    `<h3 style="font-size:19px;font-weight:800;color:${theme.heading};margin:28px 0 10px;padding-left:14px;border-left:4px solid ${theme.primary};">H3 제목</h3>`,
    '```',
    '',
    '### 5) 본문 단락',
    '```html',
    `<p style="font-size:16px;line-height:1.85;color:#1f2937;margin:0 0 18px;">본문...</p>`,
    '```',
    '',
    '### 6) 강조 인용 박스 (필요할 때 사용)',
    '```html',
    `<blockquote style="margin:20px 0;padding:18px 22px;background:rgba(0,0,0,0.025);border-left:4px solid ${theme.primary};border-radius:8px;font-style:italic;color:${theme.heading};font-size:15px;line-height:1.7;">핵심 한 줄</blockquote>`,
    '```',
    '',
    '### 7) 체크리스트 박스',
    '```html',
    `<div style="background:${theme.surfaceAlt || '#f9fafb'};border:1px solid ${theme.borderSoft || '#e5e7eb'};border-radius:12px;padding:18px 22px;margin:20px 0;">`,
    `  <div style="font-weight:900;color:${theme.heading};margin-bottom:10px;font-size:15px;">✅ 체크포인트</div>`,
    '  <ul style="margin:0;padding-left:20px;color:#1f2937;line-height:1.8;font-size:15px;">',
    '    <li>항목 1</li><li>항목 2</li><li>항목 3</li>',
    '  </ul>',
    '</div>',
    '```',
    '',
    '### 8) 비교표 (Q&A·테이블)',
    '```html',
    `<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border:1px solid ${theme.borderSoft || '#e5e7eb'};border-radius:8px;overflow:hidden;">`,
    `  <thead><tr style="background:${theme.gradientStart};"><th style="padding:12px 14px;text-align:left;font-weight:900;color:${theme.heading};font-size:14px;border-bottom:2px solid ${theme.primary};">항목</th><th style="...">값</th></tr></thead>`,
    '  <tbody><tr><td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:14px;">A</td><td style="...">설명</td></tr></tbody>',
    '</table>',
    '```',
    '',
    '### 9) ⭐ 거미줄 회유 CTA 박스 (각 H2 끝에 정확히 1개)',
    '🚨 매우 중요 — 각 원본 글 ↔ H2 매칭으로 거미줄 회유. 작업지시서 명세 그대로 박기.',
    '```html',
    `<div style="${ctaBoxStyle}">`,
    `  <p style="margin:0 0 16px !important;color:${theme.heading} !important;font-size:17px !important;font-weight:800 !important;line-height:1.5 !important;text-align:center !important;">독자가 클릭하고 싶어지는 강한 한 줄 후킹 (예: "정확한 신청 조건이 따로 있어요. 확인해보세요!")</p>`,
    '  <p style="margin:0 !important;text-align:center !important;">',
    `    <a href="ORIGINAL_URL_여기에_그대로_쓰기" target="_blank" rel="noopener" style="${ctaButtonStyle}">[주제 낱말] 자세히 보기 →</a>`,
    '  </p>',
    '</div>',
    '```',
    '- ORIGINAL_URL은 작업지시서의 원본 글 URL을 그대로. 변형/단축 금지.',
    '- 각 H2가 어떤 원본 글에 대응하는지 명확히 (작업지시서 sortedContents 순서대로 매칭).',
    '- 버튼 문구는 그 글의 주제 낱말 + 행동으로 **20자 안쪽** (예: "자격조건 자세히 보기 →", "신청방법 순서 보기 →"). 원본 글 제목 전체를 넣지 않는다. 이모지는 넣지 않거나 맨 앞 하나만.',
    '- 버튼 글자 크기는 위 스타일의 17px 를 그대로 쓴다 (줄이지 않는다).',
    '',
    '### 10) FAQ 박스 (글 끝 FAQ 섹션)',
    '```html',
    `<div style="background:${theme.surfaceAlt || '#fff'};border:2px solid ${theme.borderSoft || '#e5e7eb'};border-radius:14px;padding:20px 24px;margin:24px 0;">`,
    `  <div style="font-weight:900;color:${theme.primary};margin-bottom:6px;font-size:15px;">❓ Q. 질문 텍스트</div>`,
    `  <div style="font-size:15px;line-height:1.8;color:#1f2937;">답변...</div>`,
    '</div>',
    '```',
    '',
    '### 11) 면책 박스 (글 마지막)',
    '```html',
    '<div style="margin:32px 0 0;padding:14px 18px;background:rgba(0,0,0,0.03);border-radius:8px;font-size:12px;color:#6b7280;line-height:1.7;">',
    '  ⚠️ 본 글은 정보 제공 목적이며 정확한 정책·금액·일정은 공식 사이트에서 확인하세요. 본 글의 정보로 인한 손해에 책임지지 않습니다.',
    '</div>',
    '```',
    '',
    '### 12) 이미지 자리 (Orbit 앱이 뒤에서 자동 삽입)',
    '- 본문 안에 `<img>`, `<figure>`, `<picture>`, base64 데이터 URL 절대 금지',
    '- 대신 metadata.json에 H2별 이미지 prompt 자세히 제공 → Orbit이 API 이미지 엔진으로 생성·삽입',
    '',
    '## 반드시 생성할 파일',
    '',
    '1. `result/article.html`',
    '   - 본문 평문 **8,000~12,000자** (5,000자 미만 절대 금지)',
    '   - H1 1개, H2 작업지시서 요구 수, H2당 H3 2~3개, FAQ + 결론·면책',
    '   - **모든 컴포넌트 위 9~11번 inline style 그대로 박기** (사용자 후처리에 의존 X)',
    '   - 잘림 절대 금지: `(이하 생략)`, `(계속)`, `...` X. 마지막 닫힘 태그로 한 호흡에 완성',
    '   - `**`, `## `, `### ` 같은 마크다운 절대 사용 X. 모든 강조는 `<strong>` 또는 inline style',
    '   - script, iframe, form, onclick, 추적 코드 금지',
    '',
    '2. `result/metadata.json`',
    '```json',
    '{',
    '  "title": "최종 H1 제목 (50~60자, 검색 친화, 숫자/연도 포함 권장)",',
    '  "summary": "글 자체 검수 요약 (300자)",',
    '  "imagePrompts": {',
    `    "thumbnail": "썸네일 이미지 prompt (테마 색상: ${theme.primary}, 한글 텍스트 없음, 자연 풍경/상징)",`,
    '    "h2_1": "H2 1번 섹션용 이미지 prompt (텍스트 없음)",',
    '    "h2_2": "H2 2번 섹션용 이미지 prompt (텍스트 없음)"',
    '  }',
    '}',
    '```',
    '',
    '## 출력 마감 절대 규칙',
    '- article.html 5,000자 이상 + 마지막은 명시적 닫힘 태그',
    '- 자체 검수: 잘림/짧음/마크다운/이미지 태그/placeholder 발견 시 한 번 더 작성',
    '- inline style 누락된 컴포넌트 있으면 다시 작성',
    '- 사용자가 "끝판왕"이라고 부를 만한 완성도 — Orbit 후처리가 거의 필요 없을 정도로 마감',
  ].join('\n');
}
