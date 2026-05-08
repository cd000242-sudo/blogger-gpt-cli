// quality-report-modal.js — AdSense 품질 리포트 모달
//
// 단발 발행: showQualityReportModal(report) — 발행 완료 후 결과 모달 표시
// 큐 모드: accumulateQualityReport(report) → 큐 완료 후 showQueueQualityReport() 1회

const PHASE_LABELS = {
  length: '본문 정보량',
  paragraphs: '단락 수',
  sources: '공공기관 출처',
  sentenceAvg: '평균 문장 길이',
  imageAlt: '이미지 alt',
  internalLinks: '내부 링크',
  metaDescription: '메타 description',
  sourceSuspicion: '출처 환각 의심',
};

let queueAccumulator = [];

function buildMetricsTable(metrics) {
  if (!metrics) return '';
  const rows = [
    ['정보량 (한글환산)', metrics.textLength, '/ 4,500자'],
    ['원본 글자수', metrics.rawLength, '자'],
    ['단락 수', metrics.paragraphCount, '/ 8개'],
    ['공공기관 출처', metrics.sourceMentions, '/ 2회'],
    ['평균 문장 길이', metrics.sentenceAvgLength, '/ 25자'],
    ['이미지 alt', `${metrics.imagesWithAlt}/${metrics.imageCount}`, ''],
    ['내부 링크', metrics.internalLinkCount, '/ 2개'],
    ['메타 description', `${metrics.metaDescriptionLength}자`, '/ 110~160자'],
  ];
  return rows.map(([label, value, target]) => `
    <tr style="border-bottom:1px solid rgba(148,163,184,0.15);">
      <td style="padding:8px 12px;color:#94a3b8;font-size:13px;">${label}</td>
      <td style="padding:8px 12px;color:#f1f5f9;font-weight:600;text-align:right;">${value}</td>
      <td style="padding:8px 12px;color:#64748b;font-size:12px;">${target}</td>
    </tr>
  `).join('');
}

function buildWarningsList(warnings) {
  if (!warnings || warnings.length === 0) {
    return `<div style="padding:14px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#bbf7d0;">✅ 모든 임계값 통과 — AdSense 승인률 양호</div>`;
  }
  return warnings.map(w => `
    <div style="padding:10px 12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;margin-bottom:8px;">
      <div style="font-weight:600;color:#fde68a;font-size:13px;margin-bottom:4px;">⚠️ ${PHASE_LABELS[w.metric] || w.metric}</div>
      <div style="color:#cbd5f5;font-size:12px;line-height:1.5;">${w.message}</div>
    </div>
  `).join('');
}

function buildSourceVerifyBlock(sourceVerify) {
  if (!sourceVerify) return '';
  const score = sourceVerify.suspicionScore;
  const color = score < 25 ? '#22c55e' : score < 50 ? '#f59e0b' : '#ef4444';
  return `
    <div style="margin-top:14px;padding:12px;background:rgba(15,23,42,0.4);border-left:3px solid ${color};border-radius:6px;">
      <div style="font-size:13px;color:#cbd5f5;margin-bottom:6px;">출처 환각 의심도: <strong style="color:${color};">${score}/100</strong> (인용 ${sourceVerify.citationCount}건)</div>
      <div style="font-size:11px;color:#94a3b8;">구체성 ${sourceVerify.signals.specificityScore}/25 · 숫자 ${sourceVerify.signals.numericSanityScore}/25 · 반복 ${sourceVerify.signals.repetitionScore}/25 · 연도 ${sourceVerify.signals.yearSanityScore}/15 · 외국 ${sourceVerify.signals.foreignOveruseScore}/10</div>
    </div>
  `;
}

function renderModal({ title, summary, warnings, metrics, sourceVerify, footerHtml }) {
  // 기존 모달 제거
  const existing = document.getElementById('qualityReportModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'qualityReportModal';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:2147483630;
    background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);
    display:flex; align-items:center; justify-content:center; padding:24px;
  `;

  const isOk = !warnings || warnings.length === 0;
  const headerColor = isOk ? '#22c55e' : '#f59e0b';

  const box = document.createElement('div');
  box.style.cssText = `
    width:560px; max-width:96vw; max-height:90vh; overflow-y:auto;
    background:linear-gradient(160deg,#1e293b,#0f172a);
    border:1px solid rgba(148,163,184,0.25); border-radius:16px;
    padding:24px; color:#f1f5f9;
    box-shadow:0 24px 60px rgba(0,0,0,0.5);
    font-family:-apple-system,"Segoe UI",Roboto,sans-serif;
  `;

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div>
        <div style="font-size:18px;font-weight:700;color:${headerColor};">${title}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:4px;">${summary || ''}</div>
      </div>
      <button id="qualityModalClose" style="background:rgba(148,163,184,0.15);border:1px solid rgba(148,163,184,0.3);color:#e2e8f0;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;">×</button>
    </div>

    ${metrics ? `
      <div style="background:rgba(15,23,42,0.5);border-radius:10px;border:1px solid rgba(148,163,184,0.15);overflow:hidden;margin-bottom:14px;">
        <table style="width:100%;border-collapse:collapse;">
          ${buildMetricsTable(metrics)}
        </table>
      </div>
    ` : ''}

    ${buildSourceVerifyBlock(sourceVerify)}

    <div style="margin-top:14px;">
      ${buildWarningsList(warnings)}
    </div>

    ${footerHtml || ''}

    <div style="margin-top:18px;text-align:right;">
      <button id="qualityModalOk" style="padding:9px 20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">확인</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const close = () => {
    const el = document.getElementById('qualityReportModal');
    if (el) el.remove();
  };
  box.querySelector('#qualityModalClose').addEventListener('click', close);
  box.querySelector('#qualityModalOk').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

/**
 * 단발 발행 결과 모달 — 발행 완료 후 호출
 */
export function showQualityReportModal(report) {
  if (!report) return;
  const ok = report.ok && (!report.warnings || report.warnings.length === 0);
  renderModal({
    title: ok ? '✅ 품질 게이트 통과' : `⚠️ 품질 경고 ${report.warnings?.length || 0}건`,
    summary: report.summary,
    warnings: report.warnings || [],
    metrics: report.metrics,
    sourceVerify: report.sourceVerify,
  });
}

/**
 * 큐 모드: 매 글마다 호출해 누적
 */
export function accumulateQualityReport(report, meta = {}) {
  if (!report) return;
  queueAccumulator.push({ report, meta, ts: Date.now() });
}

/**
 * 큐 모드: 큐 완료 후 종합 리포트 1회 표시
 */
export function showQueueQualityReport() {
  if (queueAccumulator.length === 0) return;

  const items = queueAccumulator.slice();
  const total = items.length;
  const passed = items.filter(it => it.report?.ok).length;
  const totalWarnings = items.reduce((s, it) => s + (it.report?.warnings?.length || 0), 0);

  // 평균 metrics
  const avg = (key) => {
    const vals = items.map(it => Number(it.report?.metrics?.[key]) || 0);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const avgMetrics = {
    textLength: avg('textLength'),
    rawLength: avg('rawLength'),
    paragraphCount: avg('paragraphCount'),
    sourceMentions: avg('sourceMentions'),
    sentenceAvgLength: avg('sentenceAvgLength'),
    imageCount: avg('imageCount'),
    imagesWithAlt: avg('imagesWithAlt'),
    internalLinkCount: avg('internalLinkCount'),
    metaDescriptionLength: avg('metaDescriptionLength'),
  };

  const avgSuspicion = Math.round(items.reduce((s, it) => s + (it.report?.sourceVerify?.suspicionScore || 0), 0) / total);

  // 경고 종류별 카운트
  const warningCounts = {};
  items.forEach(it => {
    (it.report?.warnings || []).forEach(w => {
      warningCounts[w.metric] = (warningCounts[w.metric] || 0) + 1;
    });
  });
  const warningRows = Object.entries(warningCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([metric, count]) => `
      <tr>
        <td style="padding:6px 12px;color:#fde68a;font-size:12px;">⚠️ ${PHASE_LABELS[metric] || metric}</td>
        <td style="padding:6px 12px;color:#fef3c7;font-weight:600;text-align:right;">${count}/${total}글</td>
      </tr>
    `).join('');

  const footerHtml = `
    <div style="margin-top:14px;background:rgba(15,23,42,0.5);border-radius:8px;padding:8px 12px;">
      <div style="font-size:13px;color:#cbd5f5;margin-bottom:8px;font-weight:600;">📊 큐 ${total}글 종합 — 통과 ${passed}/${total} (출처의심 평균 ${avgSuspicion}/100)</div>
      ${warningRows ? `<table style="width:100%;border-collapse:collapse;">${warningRows}</table>` : '<div style="color:#bbf7d0;font-size:12px;">✅ 경고 0건</div>'}
    </div>
  `;

  renderModal({
    title: passed === total
      ? `🎉 큐 ${total}글 모두 통과`
      : `⚠️ 큐 ${total}글 — 경고 ${totalWarnings}건`,
    summary: `평균 정보량 ${avgMetrics.textLength}자 · 평균 출처 ${avgMetrics.sourceMentions}회`,
    warnings: [],
    metrics: avgMetrics,
    sourceVerify: { suspicionScore: avgSuspicion, citationCount: avg('sourceMentions'), signals: { specificityScore: 0, numericSanityScore: 0, repetitionScore: 0, yearSanityScore: 0, foreignOveruseScore: 0 } },
    footerHtml,
  });

  queueAccumulator = [];
}

export function clearQualityAccumulator() {
  queueAccumulator = [];
}

if (typeof window !== 'undefined') {
  window.showQualityReportModal = showQualityReportModal;
  window.accumulateQualityReport = accumulateQualityReport;
  window.showQueueQualityReport = showQueueQualityReport;
}
