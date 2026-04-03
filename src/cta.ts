const fallbackLabels = [
  "지금 확인하기",
  "공식 안내 보기",
  "신청 페이지 열기",
  "자세히 알아보기",
];

export function renderCTA(
  officialUrl: string | null,
  opts?: { label?: string; note?: string; eeatNote?: string }
) {
  const href = officialUrl ?? "#";
  const disabled = officialUrl ? "" : 'aria-disabled="true"';
  const label = opts?.label ?? fallbackLabels[Math.floor(Math.random() * fallbackLabels.length)];
  const note = opts?.note ?? "신뢰 가능한 공식·권장 경로로 연결됩니다.";

  return `
  <div style="margin:2em 0;padding:24px 28px;background:#f0f9ff;border-left:4px solid #2563eb;border-radius:0 16px 16px 0">
    <p style="font-size:17px;font-weight:700;color:#1e293b;margin:0 0 12px 0;line-height:1.6;word-break:keep-all">💡 ${note}</p>
    <a href="${href}" ${disabled} role="button" aria-label="${label}"
       style="display:inline-block;padding:12px 32px;border-radius:8px;text-decoration:none;background:#2563eb;color:#fff;font-weight:700;font-size:15px;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(37,99,235,0.25)">
      👉 ${label}
    </a>
    ${!officialUrl ? `<div style="margin-top:12px;color:#dc2626;font-size:13px">※ 관련 공식 링크를 찾지 못해 버튼이 비활성화되었습니다.</div>` : ''}
  </div>`;
}
